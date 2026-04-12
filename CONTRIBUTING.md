# Contributing

Thanks for wanting to contribute. This document is the checklist you need to pass before a PR gets merged.

## House voice (non-negotiable)

Reviewers will reject PRs that don't pass these three rules. They are the reason this repo exists.

1. **First person plural, not second person.** "We tried this and it broke in X way," not "You should do X." Entries are field notes from people who did the work, not instructions from people who think they know better.

2. **Lead with a real moment, not a definition.** Bad: "A CLAUDE.md is a project configuration file." Good: "Three weeks into the frenxt rebuild, we realized our CLAUDE.md was making Claude re-read the whole codebase on every query."

3. **Every behavioral claim about a tool cites a source.** Official docs, a commit link, or a dated blog post. No vibes-based tool lore. AI tools change weekly — unsourced claims go stale fast.

## Frontmatter requirements

Every `index.mdx` must have this frontmatter (see `schema/entry.schema.json` for the machine-readable version):

```yaml
---
title: string                              # required
slug: string                               # required, matches folder name
tool: "claude-code"                        # required
track: string                              # required (e.g., "fundamentals")
category: string                           # required
difficulty: "beginner" | "intermediate" | "advanced"   # required
last_verified: YYYY-MM-DD                  # required, must be within 180 days
day: number | null                         # optional
tags: string[]                             # optional
time_required: string                      # optional
artifact_type: "claude-md" | "skill" | "subagent" | "slash-command" | null  # optional
has_war_story: boolean                     # optional
contributors: string[]                     # optional
source_links: { label: string, url: string }[]  # optional
---
```

If `artifact_type` is set, the folder must also contain a `registry.json` and an `artifact/` directory. If `artifact_type` is null or absent, neither may exist.

## PR checklist

- [ ] `pnpm validate` passes on my branch
- [ ] `pnpm test` passes on my branch
- [ ] Entry frontmatter has all required fields
- [ ] `last_verified` is today's date, and I actually verified the claims today
- [ ] Entry follows all three house voice rules (no second person, leads with a moment, every claim has a source)
- [ ] If the entry ships an artifact, the `registry.json` `requires` array lists every external dependency honestly (API keys, external services, etc.)
- [ ] No secrets, API keys, or project-specific identifiers in the artifact files
- [ ] Licensed MIT (implicit — do not contribute content you can't license this way)

## Scaffolding a new entry

```bash
pnpm new-entry
```

Follow the prompts. The script creates a folder under `content/claude-code/` with a pre-filled `index.mdx` template and (optionally) a `registry.json` stub.
