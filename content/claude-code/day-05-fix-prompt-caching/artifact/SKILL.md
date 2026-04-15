# Debug Prompt Caching

Use this skill to diagnose poor prompt-cache performance.

## Inputs
- Endpoint or workflow name
- Sample prompt payloads (at least 3)
- Latency and token metrics if available

## Checklist
1. Identify immutable prefix candidates.
2. Identify unstable content currently in the prefix.
3. Propose a cache-safe prompt template.
4. Estimate expected latency/token improvements.

## Output
- Current anti-patterns
- Revised prompt layout (before/after)
- Validation plan with measurable success criteria
