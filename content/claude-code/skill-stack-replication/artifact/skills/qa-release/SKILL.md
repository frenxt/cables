---
name: qa-release
description: Run full release QA pipeline. Syncs CSV test cases, runs browser tests, uploads report to Supabase, links to Linear. Use before releases or when user asks to run release tests.
argument-hint: --csv path --linear-issue NOR-XXX --category automated --dry-run
---

# Release QA Pipeline

Run the full release QA test suite from a CSV test matrix.

**Project location:** `apps/qa-agent/`

## Step 0: Setup Check

```bash
cd apps/qa-agent && source .venv/bin/activate && python -c "from src.release_runner import run_release; print('Ready')"
```

## Step 1: Determine Parameters

- **CSV path**: Default in config.yaml release.default_csv. Override with --csv.
- **Linear issue**: Pass --linear-issue NOR-XXX or auto-create.
- **Category**: --category automated to skip manual tests.
- **Dry run**: --dry-run for local only.

## Step 2: Run the Pipeline

```bash
cd apps/qa-agent && source .venv/bin/activate
python cli.py release [--csv path] [--linear-issue NOR-XXX] [--category automated] [--dry-run]
```

## Step 3: Review Results

Report to user: pass/fail counts, Supabase report URL, Linear issue link, any bug issues created.
