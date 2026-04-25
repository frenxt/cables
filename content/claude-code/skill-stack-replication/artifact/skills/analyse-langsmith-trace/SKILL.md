---
name: analyse-langsmith-trace
description: Use when user shares a LangSmith public trace URL (smith.langchain.com/public/...) and asks to analyze, debug, or review it. Also use when user says "analyse trace", "check this run", or pastes a LangSmith link.
args: LangSmith public trace URL
---

# Analyse LangSmith Public Trace

Extract and analyze a LangSmith public trace using Playwright (SPA requires browser rendering).

## Workflow

### Step 1: Extract trace data with Playwright

LangSmith is a React SPA. WebFetch won't work. Use Playwright to render the page and extract text.

```bash
cd /tmp && node -e "
const { chromium } = require('playwright');
const url = '<TRACE_URL>';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1920, height: 4000 });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  const fullText = await page.evaluate(() => document.body.innerText);

  // Click Output tab if present
  try {
    const tab = await page.\$('text=Output');
    if (tab) { await tab.click(); await page.waitForTimeout(2000); }
  } catch {}

  const outputText = await page.evaluate(() => document.body.innerText);

  console.log('=== FULL PAGE TEXT ===');
  console.log(fullText);
  console.log('\n=== AFTER OUTPUT TAB ===');
  console.log(outputText.slice(fullText.length > 0 ? Math.max(0, outputText.indexOf('Output')) : 0));

  await browser.close();
})();
" 2>&1 > /tmp/trace_output.txt
```

If Playwright is not installed:
```bash
cd /tmp && npm install playwright 2>/dev/null && npx playwright install chromium
```

### Step 2: Read the extracted text

Read `/tmp/trace_output.txt` in chunks (typically 500-1500 lines). The trace text has this structure:

```
[Model info: name, duration, tokens, cost]
[Tools: list of available tool names, CALLED markers]
[Input section]
  SYSTEM — system prompt (often duplicated: base + household-specific)
  HUMAN — user message
  AI — assistant response + tool calls
  TOOL — tool results
  AI — next response
  ... (repeating AI/TOOL turns)
[Output section — final assistant message]
[Metadata: start/end time, TTFT, status, token count, latency, type, tags]
```

### Step 3: Analyse and report

Produce a structured report covering:

**Header:**
| Field | Value |
|-------|-------|
| Model | (e.g., claude-sonnet-4-6) |
| Duration | total seconds |
| Tokens | total token count |
| Cost | dollar amount |
| Status | Success/Error |
| TTFT | time to first token |

**User Request:** What the human asked for.

**Execution Flow:** Table of each tool call with result status:
| Step | Tool | Args (brief) | Result |
|------|------|-------------|--------|
| 1 | tool_name | key params | OK / FAILED (reason) |

**Bugs Found:** For each error in the trace:
- What failed (tool name, error message)
- Root cause analysis (trace the error back to code)
- Severity (critical / warning / info)

**Agent Behavior Assessment:**
- Did the agent follow the system prompt instructions?
- Did it recover gracefully from errors?
- Were tool calls efficient (no redundant calls)?
- Did it persist findings as instructed?

**Recommendations:** Actionable fixes, ordered by priority.

## What to Look For

**Common failure patterns:**
- `IndentationError` / `SyntaxError` in generated Python scripts. Sandbox code generation bugs
- `git commit` failures with "Changes not staged". Concurrent write race conditions
- Tool calls returning `error: true`. Check the message field for root cause
- Agent retrying the same failed operation. Indicates missing error handling
- Excessive token usage. System prompt duplication, large tool outputs
- Missing `write_memory` after analysis. Agent not persisting findings

**Performance signals:**
- TTFT > 3s may indicate cold start or large prompt
- Token count vs. actual useful output ratio
- Number of tool round-trips for simple tasks

## Tips

- The system prompt is often duplicated (base template + household-specific). Skip the duplicate when reading.
- Tool calls appear as `tool_name toolu_XXXX` followed by YAML params, then `TOOL` section with the result.
- `YAML` / `RAW` markers are LangSmith UI artifacts. Ignore them.
- For long traces (1000+ lines), focus on: user message, tool call sequence, errors, and final output.
