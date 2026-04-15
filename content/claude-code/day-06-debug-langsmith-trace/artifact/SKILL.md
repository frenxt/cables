# Analyse LangSmith Trace

Review a failing LangSmith trace and identify the earliest causal divergence.

## Inputs
- failing trace URL
- expected behavior summary
- optional known-good trace URL

## Steps
1. Build a concise step timeline.
2. Mark first step that diverges from expected behavior.
3. Classify failure source: prompt, tool contract, retrieval, routing, guardrail.
4. Propose minimal corrective diff.

## Output
- Root cause statement
- Evidence snippets
- Fix plan + verification steps
