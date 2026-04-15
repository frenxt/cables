---
name: debug-prompt-caching
description: Use when prompt caching isn't working, cache rates are low, cached tokens are stuck at a fixed number, or user asks to debug/optimize prompt caching for Anthropic or OpenRouter models. Also use when investigating token costs, cache_control breakpoints, or cache write/read metrics.
---

# Debug Prompt Caching

Systematic approach to diagnosing and fixing prompt caching issues for Anthropic Claude models — both direct API and via OpenRouter.

## When to Use

- Cache rate is lower than expected
- Cached tokens stuck at a fixed number (e.g., always 16K)
- `cache_write_tokens` or `cache_read_tokens` are 0
- Token costs are higher than expected despite caching being "enabled"
- Switching between providers (Anthropic direct vs OpenRouter) broke caching

## Core Concepts

**Prefix caching**: Anthropic caches a contiguous prefix of the request. The prefix order is:

```
tools -> system -> messages (in conversation order)
```

A `cache_control: {"type": "ephemeral"}` breakpoint marks "cache everything up to here." Max 4 breakpoints per request.

**Minimum cacheable tokens** (content before a breakpoint must exceed this):

| Model | Min Tokens |
|-------|-----------|
| Haiku 4.5 | 4,096 |
| Sonnet 4.5/4.6, Opus 4/4.1/4.5/4.6 | 1,024 |
| Haiku 3.5 (deprecated) | 2,048 |

**20-block lookback**: Anthropic checks up to 20 content blocks backward from each breakpoint for partial cache hits. This enables incremental caching in growing conversations.

## Diagnostic Checklist

Work through these in order. Stop when you find the issue.

### 1. Is caching enabled?

Check that `cache_control` appears in the actual API request payload. Common failures:
- Config flag disabled (`ENABLE_PROMPT_CACHING=false` or equivalent)
- Middleware/interceptor not registered or in wrong order
- Caching code has an early return before adding `cache_control`

### 2. Is the right middleware firing?

If using multiple providers (Anthropic direct + OpenRouter), each needs its own caching strategy. Common failure: **Anthropic caching middleware fires for OpenRouter** because model name contains "claude".

**Check**: Log which caching middleware runs per request. Verify by model type, not model name string.

### 3. Is cache_control reaching the API?

LLM frameworks often strip non-standard fields. Known stripping points:

| Framework | What Gets Stripped | Fix |
|-----------|-------------------|-----|
| LangChain `ChatOpenAI.bind_tools()` | `cache_control` on tool dicts (re-converts via `convert_to_openai_tool`) | Monkey-patch `bind_tools` to re-attach `cache_control` after conversion |
| LangChain `_sanitize_chat_completions_content()` | `cache_control` on message content blocks | Monkey-patch to preserve `cache_control` field |
| Any `convert_to_openai_tool()` call | Non-standard fields on tool definitions | Capture `cache_control` before conversion, re-attach after |

**Debugging approach**: Log the final request payload just before it hits the HTTP client. Compare tool/message structures to what your middleware set.

### 4. Are breakpoints in the right places?

Optimal 3-breakpoint strategy:
1. **System prompt** — static, caches ~10-20K tokens
2. **Last tool definition** — stable within session, caches tools prefix
3. **Last message with content** — leverages 20-block lookback for incremental caching

Common mistakes:
- Breakpoint on assistant message with `content=None` (tool_call messages) — has no effect
- Breakpoint on first message instead of last — doesn't leverage lookback
- Too many breakpoints (>4) — request rejected or degraded

### 5. Does content meet minimum token threshold?

Each prefix up to a breakpoint must exceed the model's minimum (see table above). If your system prompt is only 500 tokens, Haiku 4.5 won't cache it (needs 4,096).

### 6. Are cache writes happening?

Check response for `cache_creation_input_tokens` > 0 on first request. If always 0:
- Breakpoints not reaching the API (see step 3)
- Content below minimum threshold (see step 5)
- Provider doesn't support per-block caching

**Note**: OpenRouter may not report `cache_write_tokens` in responses even when writes succeed. Check `cache_read_tokens` on the NEXT request instead.

### 7. Are cache reads happening on subsequent requests?

If `cache_read_input_tokens` > 0 on second+ requests, caching works. If stuck at a fixed number:
- That number = the only prefix being cached (likely just system prompt)
- Other breakpoints not creating cache entries (go back to steps 3-5)

### 8. Is sticky routing configured? (OpenRouter only)

OpenRouter routes to different providers. Cache is per-provider. Without sticky routing, consecutive requests may hit different providers = 0 cache hits.

**Fix**: Hash a stable request element (e.g., first system message) for routing consistency.

## Reading Cache Metrics

### Anthropic Direct API Response

```json
{
  "usage": {
    "input_tokens": 2500,
    "output_tokens": 200,
    "cache_creation_input_tokens": 2000,
    "cache_read_input_tokens": 0
  }
}
```

### OpenRouter / ChatOpenAI Response

Cache data may appear in multiple locations:

```python
# Location 1: usage_metadata (LangChain standardized)
msg.usage_metadata = {
    "input_tokens": 25000,
    "input_token_details": {
        "cache_read": 16153,
        "cache_creation": 0
    }
}

# Location 2: response_metadata.token_usage (raw provider response)
msg.response_metadata = {
    "token_usage": {
        "prompt_tokens": 25000,
        "prompt_tokens_details": {
            "cached_tokens": 16153,
            "cache_write_tokens": 0
        }
    }
}
```

Check both locations — different framework versions populate different fields.

## Interpreting Cache Patterns

| Pattern | Meaning |
|---------|---------|
| `cached=0` on all calls | Cache completely broken — go to step 1 |
| `cached=N` (fixed) on every call | Only one prefix cached (likely system). Other breakpoints failing — steps 3-5 |
| `cached` grows then resets to fixed N | Lookback working, then tool output breaks prefix. Expected in agentic loops |
| `cached` grows monotonically | Ideal — incremental caching working |
| 95-99% on consecutive calls, then drops to 35% | Lookback cascade working then breaking on large content change. Normal for agentic loops |
| `cache_write=0` always (OpenRouter) | May be normal — OpenRouter doesn't always report writes. Check reads instead |

## Provider-Specific Notes

### Anthropic Direct API
- Full control over `cache_control` placement
- Supports `cache_control` on tools, system blocks, and message content blocks
- Reports both `cache_creation_input_tokens` and `cache_read_input_tokens`
- TTL configurable: 5-min default, 1-hour with `"ttl": "1h"`
- Achievable cache rate: **90-99%** in multi-turn conversations

### OpenRouter
- Translates between OpenAI format and Anthropic format
- Per-block caching: `cache_control` on content blocks within messages
- Tool `cache_control` support depends on OpenRouter's translation layer
- Sticky routing required for cache hits across requests
- `cache_write_tokens` may not be reported (check reads on next call)
- 20-block lookback works but breaks on large/variable tool outputs
- Achievable cache rate: **60-65% overall** in agentic loops (peaks of 97-99% during lookback cascades)

## Quick Diagnosis Flow

```
Is cache_read > 0 on any call?
  NO  -> Is cache_control in the API payload? (log it)
    NO  -> Framework stripping it (step 3) or middleware not running (steps 1-2)
    YES -> Below min token threshold (step 5) or wrong provider routing (step 8)
  YES -> Is it stuck at a fixed number?
    YES -> Only one breakpoint working. Check which prefix = that token count.
           Other breakpoints being stripped (step 3) or below threshold (step 5)
    NO  -> Caching works! If rate too low, check lookback patterns (agentic loop limitation)
```
