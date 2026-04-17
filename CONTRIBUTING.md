# Contributing

Thanks for wanting to contribute. This document is the checklist you need to pass before a PR gets merged.

## House voice (non-negotiable)

Reviewers will reject PRs that don't pass these three rules. They are the reason this repo exists.

1. **First person plural, not second person.** "We tried this and it broke in X way," not "You should do X." Cables are field notes from people who did the work, not instructions from people who think they know better.

2. **Lead with a real moment, not a definition.** Bad: "A CLAUDE.md is a project configuration file." Good: "Three weeks into the frenxt rebuild, we realized our CLAUDE.md was making Claude re-read the whole codebase on every query."

3. **Every behavioral claim about a tool cites a source.** Official docs, a commit link, or a dated blog post. No vibes-based tool lore. AI tools change weekly — unsourced claims go stale fast.

**Voice clarification:** `we` in the cable body means "the cables community and the FRE|Nxt team." Individual credit is given via the required `contributors[]` frontmatter field, the byline at the top of every cable, and the aggregated `/cables/by/<contributor>` page. This means the collective voice and individual attribution coexist — the body uses "we," the byline shows who you are.

## Frontmatter requirements

Every cable's `index.mdx` must have this frontmatter (see `schema/entry.schema.json` for the machine-readable version):

```yaml
---
title: string                              # required
slug: string                               # required, matches folder name
tool: "claude-code"                        # required
track: string                              # required (e.g., "fundamentals")
category: string                           # required
difficulty: "beginner" | "intermediate" | "advanced"   # required
last_verified: YYYY-MM-DD                  # required, must be within 180 days
contributors: string[]                     # required, non-empty
day: number | null                         # optional
tags: string[]                             # optional
time_required: string                      # optional
artifact_type: "claude-md" | "skill" | "subagent" | "slash-command" | null  # optional
has_war_story: boolean                     # optional
source_links: { label: string, url: string }[]  # optional
---
```

If `artifact_type` is set, the folder must also contain a `registry.json` and an `artifact/` directory. If `artifact_type` is null or absent, neither may exist.

## PR checklist

- [ ] `pnpm validate` passes on my branch
- [ ] `pnpm test` passes on my branch
- [ ] If I changed `imports/**` or `publishers/**`, `pnpm sync-imports` has been run and generated snapshots are committed under `content/**`
- [ ] Cable frontmatter has all required fields (including `contributors`)
- [ ] `last_verified` is today's date, and I actually verified the claims today
- [ ] Cable follows all three house voice rules (no second person, leads with a moment, every claim has a source)
- [ ] If the cable ships an artifact, the `registry.json` `requires` array lists every external dependency honestly (API keys, external services, etc.)
- [ ] Imported artifacts only write to approved install roots (`CLAUDE.md`, `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/stacks/`)
- [ ] Imported artifacts do not include blocked binary payloads (`.exe`, `.dll`, `.so`, `.dylib`, etc.)
- [ ] No secrets, API keys, or project-specific identifiers in the artifact files
- [ ] Licensed MIT (implicit — do not contribute content you can't license this way)

## Scaffolding a new cable

```bash
pnpm new-cable
```

Follow the prompts. The script creates a folder under `content/claude-code/` with a pre-filled `index.mdx` template (including a `contributors: ["@TODO-your-handle"]` placeholder you must edit before committing) and (optionally) a `registry.json` stub.

## Third-party import flow

GitHub-only for this MVP: third-party cables are imported from GitHub repos via pinned manifests, not by writing directly into `content/**` first.

In the publisher's source repo:

```bash
npx frenxt-cables publisher init --publisher acme-labs --repo acme-labs/cables
npx frenxt-cables publisher pack --tool claude-code --slug release-gate
npx frenxt-cables publisher submit --tool claude-code --slug release-gate
```

That scaffolds `.cables/publisher.json`, stages the generated manifest, and writes a PR body under `.cables/submissions/<slug>/`.

In `frenxt/cables`:

1. Add/update `publishers/<publisher-id>.json` (once per publisher).
2. Add/update `imports/<publisher-id>/<slug>.json` with immutable `source.ref` (40-char SHA).
3. Run `pnpm sync-imports`.
4. Commit both the manifest change and the generated `content/<tool>/<slug>/` snapshot.

If the affected publisher is on probation (`status: "probation"` or `tier: "probation"`), the import PR must carry the `allow-probation-import` label before the `import-third-party` workflow will proceed.

## Expected categories

The `category` field in frontmatter is not a closed enum — new categories are fine when genuinely new. But prefer an existing category over inventing one. Expected categories at launch:

| Category | Who it serves | Example |
|---|---|---|
| `onboarding` | Shipping Engineer (beginner end) | Install + first slash command |
| `configuration` | Shipping Engineer | First CLAUDE.md |
| `workflow` | Shipping Engineer | Debugging from a LangSmith trace |
| `testing` | Shipping Engineer | Autonomous browser QA |
| `performance` | Shipping Engineer | Prompt caching fixes |
| `leverage-patterns` | AI-Adopting Founder | Subagents as team leverage |
| `team-setup` | AI-Adopting Founder | Rolling CLAUDE.md out to a team |
| `skill-authoring` | Both | Writing a skill from scratch |
| `meta` | Both | The contributor guide |

Cables for the AI-Adopting Founder persona (the `leverage-patterns` and `team-setup` categories) should be especially clear about team size, scope, and what happened at a scale beyond solo usage.
