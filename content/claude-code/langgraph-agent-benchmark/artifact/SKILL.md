---
name: benchmark
description: Run LangGraph agent benchmarks and manually evaluate results by reading traces. Use when user says /benchmark or asks to run/evaluate benchmarks.
args: scenario glob pattern (e.g., scenarios/landing-page-email.yaml)
---

# Benchmark: Run & Manual Evaluate

Run a benchmark scenario against the LangGraph agent, then manually evaluate results by reading the trace data.

## Workflow

### Step 1: Ensure server is running

Check if the LangGraph dev server is running on port 2024:

```bash
curl -s http://localhost:2024/ok
```

If NOT running, start it:

```bash
cd apps/langgraph-python/benchmarks
./run_with_server.sh run --scenarios '<SCENARIO_GLOB>' \
  --user-id 77e8b508-ddb3-4059-a5c7-aade08693535 \
  --project-id 3ce4c94c-85ed-4a88-9a99-8c49472ce591 \
  --no-screenshots
```

If already running, run the benchmark directly:

```bash
cd apps/langgraph-python/benchmarks
export $(grep LANGGRAPH_SHARED_SECRET apps/langgraph-python/.env) && \
python -m run -v run --scenarios '<SCENARIO_GLOB>' \
  --user-id 77e8b508-ddb3-4059-a5c7-aade08693535 \
  --project-id 3ce4c94c-85ed-4a88-9a99-8c49472ce591 \
  --server-url http://localhost:2024 \
  --no-screenshots
```

**IMPORTANT**: The `LANGGRAPH_SHARED_SECRET` env var must be exported for JWT auth. Source it from `apps/langgraph-python/.env` before running.

Replace `<SCENARIO_GLOB>` with the argument passed to the skill, or default to `scenarios/landing-page-email.yaml`.

### Step 2: Read results

After the benchmark completes, find the latest results directory:

```bash
ls -td apps/langgraph-python/benchmarks/results/2*/ | head -1
```

Read these files from the results directory:
1. `reports/*.md`. The generated report
2. `evaluation.json`. Deterministic evaluation scores
3. Find turn traces: look inside the results dir for a scenario-named subdirectory with `traces/turn-*.json`
4. The scenario YAML that was run (for evaluation criteria)

**Note on trace data**: The runner uses `stream_mode="values"` which emits full state snapshots. Tool call counts in traces are ACCUMULATED across context editing iterations, so raw counts appear inflated. When evaluating, look at DISTINCT tool outputs and state_after values, not raw counts.

### Step 3: Manual evaluation

For each criterion in the scenario YAML's `evaluation.criteria` section, score 0.0-1.0 based on actual trace data.

**Scoring guide:**
- **0.0** = Complete failure. Criterion not addressed at all
- **0.25** = Poor. Attempted but fundamentally wrong
- **0.5** = Partial. Partially met with significant gaps
- **0.75** = Good. Mostly met with minor issues
- **1.0** = Excellent. Fully met the criterion

For each criterion, provide:
- **Score** (0.0-1.0)
- **Evidence**. Specific references to turn traces (tool calls, file contents, state changes)
- **Reasoning**. Why this score was given

Output a summary table:

```
| Criterion | Weight | Score | Reasoning |
|-----------|--------|-------|-----------|
| ...       | ...    | ...   | ...       |
| **Weighted Total** | | **X.XX** | |
```

### Step 4: Save evaluation

Write the manual evaluation to `manual-evaluation.json` in the results directory:

```json
{
  "evaluator": "claude-code-manual",
  "timestamp": "<ISO-8601>",
  "scenario": "<scenario name>",
  "criteria": [
    {
      "name": "<criterion name>",
      "weight": <weight>,
      "score": <0.0-1.0>,
      "reasoning": "<explanation>",
      "evidence": ["<specific trace references>"]
    }
  ],
  "weighted_score": <0.0-1.0>,
  "deterministic_score": <from evaluation.json>,
  "notes": "<any overall observations>"
}
```

### Step 5: Report summary

Print a final summary:

```
Benchmark: <scenario name>
Deterministic Score: X.XX
Manual Judge Score: X.XX (weighted)
Key Observations:
- ...
- ...
```

---

## Cache Debugging

When the user asks to debug caching, analyze cache performance, or mentions "cache" in the benchmark args, perform cache analysis AFTER the benchmark completes.

### Cache data sources

There are TWO sources of cache metrics (use both for cross-validation):

1. **Turn traces** (`traces/turn-*.json`): Each LLM call has `cache_read_tokens` and `cache_creation_tokens` fields. Totals are in `total_cache_read_tokens` and `total_cache_creation_tokens`.
   - **Caveat**: `stream_mode="values"` emits duplicate state snapshots that appear as LLM calls with identical `input_tokens`. These are NOT real LLM calls. Filter them by looking for calls with `cache_read_tokens > 0` to identify real LLM calls.

2. **Server logs** (`run_with_server.sh` captures to `results/server-logs/langgraph-*.log`): Grep for middleware log lines:
   - `[OpenRouterCaching] Response:`. Per-call cache metrics (input, cached, write, rate%)
   - `[OpenRouterCaching] Per-block:`. Breakpoint count and placement
   - `[OpenRouterCaching] Converted + added cache_control`. Tool caching confirmation
   - `[AnthropicCaching]`. Should NOT appear for OpenRouter (skip is working)
   - `[MemoryBootstrap]`. Dynamic content injection after cache breakpoint

### Cache analysis script

Run this Python snippet against the traces to get a cache summary:

```python
import json, glob
traces_dir = '<RESULTS_DIR>/<SCENARIO_SLUG>/traces'

total_input = 0
total_cached = 0
for f in sorted(glob.glob(f'{traces_dir}/turn-*.json')):
    data = json.load(open(f))
    ti = data.get('total_input_tokens', 0)
    cr = data.get('total_cache_read_tokens', 0)
    cc = data.get('total_cache_creation_tokens', 0)
    total_input += ti
    total_cached += cr
    rate = (cr/ti*100) if cr and ti else 0
    print(f'Turn {data["turn_number"]}: {data["duration_ms"]/1000:.0f}s, '
          f'{len(data["llm_calls"])} calls, input={ti:,} '
          f'cache_read={cr:,} cache_write={cc:,} rate={rate:.1f}%')

overall = (total_cached/total_input*100) if total_cached and total_input else 0
print(f'\nOverall: input={total_input:,} cached={total_cached:,} rate={overall:.1f}%')
```

### Server-side cache metrics (ground truth)

The server-side `[OpenRouterCaching] Response:` logs are the **ground truth** for cache performance. Extract them:

```bash
grep "OpenRouterCaching.*Response" <SERVER_LOG> | \
  sed 's/.*\[OpenRouterCaching\] //' | sed 's/\[0m.*//'
```

This shows per-LLM-call: `input=N cached=N write=N rate=N%`

### What to look for

| Symptom | Likely Cause | Where to Check |
|---------|-------------|----------------|
| `cached=0` on all calls | Cache cold or middleware not running | Server log: look for `[OpenRouterCaching] Per-block` entries |
| `cached=16153` stuck | Only system prompt cached, tools/messages not | Server log: check `write=0`. Breakpoints set but not creating cache entries |
| `[AnthropicCaching]` in logs | Anthropic middleware firing for OpenRouter | `anthropic_caching.py`. Check `current_model == "openrouter"` skip |
| No `Converted + added cache_control` | Tools not being cached | `openrouter_caching.py`. Tool conversion failing |
| `write=0` consistently | OpenRouter not reporting cache writes (normal) OR breakpoints not reaching API | Check `bind_tools` monkey-patch in `openrouter_caching.py` |
| Rate drops to ~35% on large contexts | 20-block lookback limit hit | Normal for OpenRouter agentic loops. Tool outputs break prefix |
| Rate ~95%+ on consecutive calls then drops | Lookback cascade working then breaking | Expected pattern. Cache resets after large tool output changes |

### Cache architecture reference

**Middleware chain** (execution order): `model_selection` -> `anthropic_caching` -> `openrouter_caching` -> `memory_bootstrap` -> `integration_preferences`

**OpenRouter caching strategy** (3 breakpoints max):
1. System prompt `cache_control` on first content block (~16K tokens, static)
2. Last tool definition `cache_control` (23 tools, ~5-10K tokens, stable per session)
3. Last message with content `cache_control` (leverages 20-block lookback for incremental caching)

**Key files**:
- `src/middleware/before_model/openrouter_caching.py`. Per-block caching + monkey-patches for ChatOpenAI
- `src/middleware/before_model/anthropic_caching.py`. Direct Anthropic API caching (skips OpenRouter)
- `src/middleware/before_model/memory_bootstrap.py`. Injects dynamic content AFTER cache breakpoint
- `benchmarks/runner/scenario_runner.py:_process_chunk`. Extracts cache metrics from stream chunks
- `benchmarks/runner/trace_logger.py`. Stores cache metrics in turn traces

**Monkey-patches** in `openrouter_caching.py` (required because ChatOpenAI strips non-standard fields):
- `_sanitize_chat_completions_content`. Preserves `cache_control` on message content blocks
- `BaseChatOpenAI.bind_tools`. Preserves `cache_control` on tool dicts through `convert_to_openai_tool`

**Known limitations** (OpenRouter per-block caching):
- Haiku 4.5 requires 4,096 minimum cacheable tokens per breakpoint
- Prefix order: `tools -> system -> messages` (NOT system first)
- 20-block lookback finds partial cache hits up to 20 positions back from breakpoint
- Agentic loops with large/variable tool outputs break prefix, causing cache resets to system-only (~16K)
- Practical ceiling: ~60-65% overall cache rate for multi-turn agentic loops
- Peak rates of 97-99%+ achievable during lookback cascades (consecutive similar calls)
- `write=0` in response metrics is normal. OpenRouter may not report `cache_write_tokens`
