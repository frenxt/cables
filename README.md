# Cables

Installable AI workflow recipes from real projects.

Every cable combines two things:

- a short field note about what we tried, what broke, and what we learned
- an optional artifact you can install directly into your project

The point is not to collect prompts. The point is to help teams ship faster with working baselines for real AI coding workflows.

Examples:

- `npx frenxt-cables add prompt-caching-fix`
- `npx frenxt-cables add browser-use-qa`
- `npx frenxt-cables add reproduce-fix-verify`
- `npx frenxt-cables convert claude-to-codex`

## How people use this

- Fix one specific problem: prompt caching, browser QA, subagents, bugfix loops, setup drift.
- Follow a track: start at Day 1 and work forward when you are new to Claude Code or Codex.
- Install reusable files: `CLAUDE.md`, skills, subagents, and slash commands.
- Move between ecosystems: convert Claude assets to Codex and back without hand-copying rules and command packs.

## Repo layout

```text
content/<tool>/<slug>/
├── index.mdx          # the field note / tutorial
├── registry.json      # optional — describes the installable artifact
├── skill.spec.json    # required for artifact_type: "skill"
├── compatibility.json # required for artifact_type: "skill"
└── artifact/          # optional — files the CLI copies into the user's project
```

## Local development

Prerequisites:

- Node 22
- pnpm 10

Commands:

```bash
pnpm install
pnpm sync-imports
pnpm validate
pnpm build-index
pnpm build-compatibility -- --limit=200
pnpm new-cable
pnpm test
```

## Third-party publishers

Third-party publishers are onboarded through two repo-level manifests:

- `publishers/<publisher-id>.json` for approved publisher metadata and trust status
- `imports/<publisher-id>/<slug>.json` for the pinned source pointer (`repo + SHA + path`)

Running `pnpm sync-imports` fetches pinned source snapshots from GitHub raw and materializes them into `content/<tool>/<slug>/`, injecting provenance fields in frontmatter.

## License

MIT — see `LICENSE`.
