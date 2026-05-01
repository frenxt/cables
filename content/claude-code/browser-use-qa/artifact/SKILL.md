---
name: "qa"
description: "Run autonomous browser QA with Browser Use agents. Use when the user asks to QA test, verify changes, run regression tests, check for crashes, validate a feature, or gather browser evidence before release."
argument-hint: "[suite|file|tag|release|url] [--headed] [--parallel N] [--csv path] [--dry-run]"
---

# Autonomous Browser QA

Run browser QA like a human tester: understand the change, exercise the user journey, capture evidence, and return pass/fail findings with reproducible steps.

This skill works best when the repo has a local Browser Use harness such as `apps/qa-agent/`. If no harness exists, use the same workflow to create focused markdown test cases and run them through the available Browser Use CLI, Browser Use cloud project, or the repo's existing browser automation setup.

## Required Inputs

- Target base URL, for example `http://localhost:3000` or a staging URL.
- Credential strategy: unauthenticated, seeded test account, saved browser state, or manually provided credentials.
- Journey scope: suite name, changed route, bug ID, release checklist, CSV, or explicit user flow.
- Evidence policy: headed run for first/debug runs, screenshots or GIFs for failures, console/network notes when available.

## Step 0: Setup Check

Start by finding the QA harness and verifying its dependencies:

```bash
test -d apps/qa-agent && cd apps/qa-agent
test -d .venv && source .venv/bin/activate
python -c "import browser_use; print('Browser Use ready')" 2>/dev/null
```

If a Python harness exists but is not ready:

```bash
cd apps/qa-agent
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .
browser-use install
```

Check for the environment variables used by the local harness. Common setups use one or more of:

- `BROWSER_USE_API_KEY`
- `GOOGLE_API_KEY`
- `OPENAI_API_KEY`
- app-specific auth or database variables for seeded test users

If there is no `apps/qa-agent/`, inspect the repo for equivalents before improvising:

```bash
find . -maxdepth 4 -type f \( -name "*qa*" -o -name "*e2e*" -o -name "*playwright*" \) 2>/dev/null
```

## Step 1: Determine What To Test

Choose the narrowest test scope that answers the user's request.

### Existing suite

Use this when the user says "run smoke tests", "run regression", "QA this", or names a suite:

```bash
cd apps/qa-agent && source .venv/bin/activate
python cli.py run --suite smoke
python cli.py run --suite regression
python cli.py run --suite full
```

### Specific file, tag, or issue

Use this when the user names a test file, feature, bug ID, or tag:

```bash
python cli.py run --file tests/smoke/pricing.md
python cli.py run --tag checkout
python cli.py run --tag NOR-278
```

### New feature or code change

Use this when the user asks to test recent changes or a PR:

1. Read the diff: `git diff --name-only` and, when needed, the changed files.
2. Map changed files to routes, APIs, forms, auth states, and user roles.
3. Write one focused markdown test case per user flow.
4. Run the new test headed first, then unheaded if it is stable.

Test case template:

```markdown
# Descriptive user-facing flow title

- **persona**: unauthenticated | free-user | pro-user | admin
- **priority**: critical | high | medium | low
- **tags**: [feature-name, issue-id]

## Steps

1. Navigate to /affected-page
2. Perform the user action that exercises the changed behavior
3. Verify the expected state is visible

## Expected

- No console errors
- No crash screen, blank page, or application error
- The user-visible outcome matches the requested behavior

## Notes

Include why this flow matters and any data/auth prerequisites.
```

### Release run

Use this when the user says "release QA", "run all test cases", "pre-release", or provides a CSV:

```bash
cd apps/qa-agent && source .venv/bin/activate
python cli.py release
python cli.py release --csv path/to/tests.csv
python cli.py release --dry-run
```

For large suites, tell the user the expected duration before starting if it will be long. If the harness supports categories, separate automated, semi-automated, and manual cases so the report is honest rather than pretending Browser Use can validate OAuth provider flows, CAPTCHAs, payment rails, DNS changes, or network toggles without human setup.

## Step 2: Prepare The Target App

Confirm the app is running before browser QA:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

If it is not running, start the repo's dev server in the correct package. Prefer the documented command in `README.md`, `AGENTS.md`, `CLAUDE.md`, or `package.json`.

Use `--headed` for first runs, bug reproduction, flaky flows, or any flow involving auth. Use `--parallel` only after the suite is stable and isolated:

```bash
python cli.py run --suite smoke --headed --parallel 1
python cli.py run --suite smoke --parallel 3
```

## Step 3: Run And Observe

During the run, watch for:

- Browser-visible failures: crash pages, blank screens, broken layout, missing controls, stuck loading states.
- Console failures: uncaught exceptions, hydration errors, failed client-side requests.
- Network failures: 4xx or 5xx responses on the path being tested.
- Product failures: wrong copy, wrong redirect, missing validation, incorrect success or error state.
- Test harness failures: bad selectors, missing seed data, expired auth, target app unavailable.

Do not collapse app bugs and harness bugs into the same bucket. If the app behavior is correct and the test is stale, update the test. If the test reveals a real product failure, keep the test evidence intact.

## Step 4: Review Reports

After the run:

```bash
python cli.py report --latest
```

Read the run summary and inspect failure evidence. Return a concise QA report with:

- Total pass/fail/error/manual counts.
- Each failure with route, persona, severity, and what broke.
- Reproduction steps that a developer can follow without the Browser Use trace.
- Screenshot, GIF, video, or HTML report paths when available.
- Any likely harness problems separated from product bugs.

## Step 5: Act On Findings

- If all tests pass, report the coverage actually exercised and any residual risk.
- If bugs are found, prioritize by user impact and reproducibility.
- If the user asked you to fix the bugs and the codebase is available, reproduce first, patch, then rerun the failing QA case.
- If the harness supports issue filing, only file product bugs with enough evidence: expected behavior, actual behavior, repro steps, environment, and artifacts.

## Good Browser QA Standards

- Test one flow per file.
- Use natural language steps that describe user intent, not brittle implementation detail.
- Always include negative checks for crash screens, blank pages, and console errors.
- Prefer stable seeded accounts over ad hoc credentials.
- Mark manual-only cases explicitly.
- Keep evidence paths in the final report so failures are inspectable after the run.
- Do not claim release readiness from smoke coverage alone.

## Output Contract

End with one of:

- `Passed`: what was tested, evidence location, and residual risks.
- `Failed`: prioritized failures with repro steps and artifacts.
- `Blocked`: missing dependency, missing credentials, unavailable target app, or harness setup failure, plus the exact command or variable needed to unblock.
