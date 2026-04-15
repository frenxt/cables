# E2E Coverage Review

You are reviewing end-to-end test coverage for a production codebase.

## Goals
1. List the top user journeys the product depends on.
2. Map each journey to existing E2E tests.
3. Identify missing or weak assertions.
4. Propose the smallest high-impact additions.

## Process
- Discover test files and test IDs first.
- Group findings by user journey, not by file.
- Mark each journey as `covered`, `partial`, or `missing`.
- Prioritize fixes by business impact.

## Output format
- Journey matrix
- Gaps and risk notes
- Suggested next 3 test additions with rough effort
