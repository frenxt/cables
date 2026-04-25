---
name: qa
description: Run autonomous QA testing using browser-use.com agents. Use when the user asks to QA test, verify changes, run regression tests, check for crashes, or validate a feature works. Also use after significant UI changes or before releases.
argument-hint: [suite|file|tag|release] [--headed] [--parallel N] [--csv path] [--linear-issue NOR-XXX] [--dry-run]
---

# Autonomous QA Agent

Run AI-powered browser testing that follows test cases like a human QA tester. Uses browser-use.com with Gemini 3.1 Flash-Lite for vision-based testing.

**Project location:** `apps/qa-agent/`

## Step 0: Setup Check

Verify the QA agent is ready:

```bash
cd apps/qa-agent
test -d .venv && source .venv/bin/activate && python -c "from src.parser import TestCase; print('QA agent ready')" 2>/dev/null
```

If not ready:
```bash
cd apps/qa-agent && python3.11 -m venv .venv && source .venv/bin/activate && pip install -e . && browser-use install
```

Verify `GOOGLE_API_KEY` is set (check `.env` file or environment).

## Step 1: Determine What to Test

Based on the user's request, choose the right approach:

### Option A: Run existing test suite
If user says "run smoke tests", "run regression", "run QA":
```bash
cd apps/qa-agent && source .venv/bin/activate
python cli.py run --suite smoke          # Quick health check
python cli.py run --suite regression     # Bug regression tests
python cli.py run --suite full           # Everything
```

### Option B: Run specific test
If user mentions a specific feature or test file:
```bash
python cli.py run --file tests/smoke/pricing.md
python cli.py run --tag nor-278
```

### Option C: Generate test case from context
If the user wants to test something new (a feature they just built, a bug they just fixed, a page they changed):

1. **Read the git diff** to understand what changed
2. **Write a new markdown test case** following this format:

```markdown
# [Descriptive test title]

- **persona**: unauthenticated | free-user | pro-user
- **priority**: critical | high | medium | low
- **tags**: [relevant tags]

## Steps

1. Navigate to /affected-page
2. [Actions that exercise the changed code]
3. Verify [expected behavior]

## Expected

- No console errors
- No "Application error" or crash screens
- [Feature-specific expectations]

## Notes

[Context about what changed and why this test matters]
```

3. Save to `apps/qa-agent/tests/` in the appropriate suite directory
4. Run it:
```bash
python cli.py run --file tests/<suite>/<test-name>.md --headed
```

### Option E: Release QA Pipeline
If user says "release", "run release tests", "run all test cases", or "qa release":

This runs the full release pipeline: CSV sync, persona refresh, run all tests, generate report, upload to Supabase, link to Linear.

```bash
cd apps/qa-agent && source .venv/bin/activate

# Full release run (auto-creates Linear issue)
python cli.py release

# With specific CSV
python cli.py release --csv ../../PR-185-final-test-cases.csv

# Attach to existing Linear issue
python cli.py release --linear-issue NOR-400

# Only automated tests (faster, ~15 min)
python cli.py release --category automated

# Local only (no Supabase upload, no Linear)
python cli.py release --dry-run

# Combine options
python cli.py release --csv path/to/tests.csv --linear-issue NOR-400 --category automated
```

**Important:** This runs 60+ browser tests in parallel (3 at a time). Expect ~25-40 minutes for a full run.

**Test categories:**
| Category | Description | Action |
|----------|-------------|--------|
| `automated` | Standard browser flows | Run by agent |
| `semi-automated` | Environment-dependent (CAPTCHA, lockout) | Run with caveat |
| `manual` | OAuth, network toggle, Stripe, DNS | Listed in report for human review |

**Pipeline outputs:**
1. CLI summary with pass/fail/error/manual counts
2. Supabase report URL (shareable HTML with GIFs, screenshots)
3. Linear issue URL (release task with summary table)
4. Individual bug issues auto-filed to Linear for failures

After the release run, report to user: pass/fail counts, Supabase link (or local path if upload failed), Linear issue link, and any bugs filed.

**Supabase Report Hosting (dev env only):**

Reports are stored in Supabase `qa-reports` bucket and served via a juliet-v2 API proxy route at `/api/qa-reports/[...path]` (file: `apps/juliet-v2/app/api/qa-reports/[...path]/route.ts`). This proxy exists because Supabase storage forces `text/plain` Content-Type on all public objects, which prevents HTML/GIF rendering. The proxy fetches from Supabase and serves with correct MIME types.

- **Bucket:** `qa-reports` (public, Supabase storage)
- **Proxy route:** `apps/juliet-v2/app/api/qa-reports/[...path]/route.ts`
- **Upload structure:** `qa-reports/releases/{run_id}/index.html`, `gifs/`, `screenshots/`
- **Report URL pattern:** `https://agentic-dev.juliet.space/api/qa-reports/releases/{run_id}/index.html`
- **Env var:** `QA_REPORT_BASE_URL` overrides the base URL (default: `https://agentic-dev.juliet.space`)
- **IMPORTANT:** This route is dev-env only. The `qa-reports` bucket and proxy route should NOT exist in production.

**How the upload works:**
1. `supabase_uploader.py` uploads GIFs in batches of 10 (skip videos. Too large)
2. HTML report paths are rewritten from `reports/{run_id}/gifs/...` to `/api/qa-reports/releases/{run_id}/gifs/...`
3. Rewritten HTML is uploaded to Supabase
4. The proxy route serves it with correct Content-Type headers

**If upload is slow or fails:**
- GIFs are large (~5MB each, 100+ files). Upload takes ~2-3 minutes.
- Videos are skipped by default (500MB+ total). View locally via `python cli.py report --latest`.
- If Supabase env vars not set, pipeline falls back to local report path.
- Local reports at: `apps/qa-agent/reports/{run_id}/index.html`

### Option D: Test based on code changes
If user says "test my changes" or "QA this PR":

1. Run `git diff --name-only HEAD~1` (or against the base branch)
2. Identify affected routes/pages from changed files
3. Generate test cases for each affected area
4. Run them all:
```bash
python cli.py run --suite smoke --parallel 3
```

## Step 2: Run Tests

Always use `--headed` for debugging or first-time test runs. Use `--parallel` for speed on stable suites.

```bash
cd apps/qa-agent && source .venv/bin/activate

# Standard run
python cli.py run --suite smoke

# Debugging mode (visible browser)
python cli.py run --suite smoke --headed --parallel 1

# Fast parallel run
python cli.py run --suite smoke --parallel 5
```

**Important:** Make sure the target app is running before starting tests:
```bash
# Check if juliet-v2 is running on port 3001
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
```

If not running, start it first:
```bash
cd apps/juliet-v2 && pnpm dev &
```

## Step 3: Review Results

After the run completes:

1. **Read the CLI output** for pass/fail summary
2. **Open the HTML report** for detailed findings:
```bash
python cli.py report --latest
```
3. **Report findings to the user** with:
   - Total pass/fail count
   - Each failure: what page, what broke, severity
   - Screenshots of failures (reference paths from the report)
   - Any Sentry errors correlated with the run

## Step 4: Act on Findings

Based on results:

- **All passed**: Report success, note any warnings/observations
- **Bugs found**:
  - Show the user each bug with details
  - If `LINEAR_API_KEY` is set, bugs are auto-filed to Linear
  - Offer to fix the bugs if they're in the codebase
- **Test failures** (not app bugs):
  - Fix the test case if the app behavior is correct
  - Update selectors, timing, or expectations as needed

## Available Test Suites

| Suite | Purpose | Persona | Tests |
|-------|---------|---------|-------|
| `smoke` | Quick health check of public pages | unauthenticated | homepage, pricing |
| `regression` | Verify fixed bugs stay fixed | varies | NOR-278 free user crashes |
| `full` | Comprehensive app exploration | all personas | (add as needed) |

## Writing Good Test Cases

- **One flow per file**. Keep tests focused
- **Natural language steps**. The AI agent interprets them like a human would
- **Include negative checks** — "No crash screens", "No console errors"
- **Tag for discoverability**. Use issue IDs, feature names
- **Set the right persona**. Test as the user type that matters

## Auth Personas

Generate auth state files for authenticated testing:

```bash
python cli.py auth --persona free-user --email test-free@juliet.app
python cli.py auth --persona pro-user --email test-pro@juliet.app
```

Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables.
