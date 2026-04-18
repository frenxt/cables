---
name: e2e-review
description: Use when running periodic E2E test reviews, after UI changes, before releases, or when the user wants to audit test coverage and visual correctness. Works with Playwright, Cypress, Jest E2E, or any test framework.
argument-hint: [test-command-or-path]
---

# E2E Test Review

Periodic exercise to run the full E2E test suite, triage results, review screenshots, and identify coverage gaps.

## Step 0: Discover Test Setup

Before running anything, detect the project's E2E infrastructure:

1. **Find the test config** — search for `playwright.config.ts`, `cypress.config.ts`, `jest.config.ts`, or similar
2. **Find the test directory** — look for `e2e/`, `tests/`, `test/`, `__tests__/`, `cypress/`
3. **Identify the runner** — check `package.json` scripts for `test:e2e`, `test`, `playwright`, `cypress`
4. **Check for a testing guide** — look for `E2E-TESTING-GUIDE.md`, `TESTING.md`, or similar in the test directory

If no E2E tests exist, report that and ask whether to set them up.

## Step 1: Run Full Suite

Use the detected test command. Common patterns:

```bash
# Playwright
npx playwright test 2>&1 | tail -40

# Cypress
npx cypress run 2>&1 | tail -40

# Jest E2E
npx jest --config jest.e2e.config.ts 2>&1 | tail -40

# package.json script
npm run test:e2e 2>&1 | tail -40
```

Record total pass/fail/skip counts.

## Step 2: Triage Failures

For each failure, classify:
- **Test bug**: Selector changed, timing issue, flaky assertion. Fix the test.
- **App bug**: UI actually broke. Report and fix.
- **Pre-existing**: Known issue from before. Note and skip.

Use traces/videos for debugging when available.

## Step 3: Review Screenshots from Passing Tests

Even passing tests can hide visual issues. Find and open screenshots:

```bash
# Common screenshot locations
find . -path "*/test-results/*" -name "*.png" | head -20
find . -path "*/screenshots/*" -name "*.png" | head -20
find . -path "*/cypress/screenshots/*" -name "*.png" | head -20
```

Check for:
- Layout bugs (overlapping, spacing, cutoff)
- Mobile overflow (content beyond viewport)
- Missing content (empty areas)
- Visual regressions from previous runs

Prioritize: mobile viewport tests, recently changed pages, interaction-state screenshots (edit mode, dropdowns, modals).

## Step 4: Check Coverage Gaps

1. **Map app routes** — find all pages/routes in the app (check router config, `app/` directory, `pages/` directory)
2. **Map existing tests** — list what each test file covers
3. **Identify gaps** — routes or features with no test coverage
4. **Prioritize** — critical user flows (auth, payments, core features) first

## Step 5: Report

Summarize:
- Pass/fail/skip counts (compared to last run if available)
- Failures triaged with classification
- Visual issues found in screenshots
- Coverage gaps identified
- Tests added or fixed

## Writing New Tests

Follow the project's existing patterns. General principles:

- **Selectors**: Prefer role-based > text-based > placeholder-based > CSS class
- **Waits**: Use explicit waits (`waitForSelector`, `waitForResponse`) over `waitForTimeout`
- **Auth**: Reuse existing auth fixtures/setup rather than logging in per test
- **Mobile**: Use project-level viewport config, not per-test overrides
- **Assertions**: Check both positive (element visible) and negative (no error banners)

After creating a test file, register it in the test config if required (e.g., Playwright `testMatch` arrays).
