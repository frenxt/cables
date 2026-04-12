# Build With AI

A living, community-curated resource for shipping with AI coding tools. Starts with Claude Code. Built and maintained by [FRE|Nxt Labs](https://frenxt.com).

Every entry is a field note: something we actually did on a real project, what worked, what didn't, and the artifacts you can drop into your own setup.

## Three ways to use this

- **Day 1 → Day N track** — a sequenced path for someone new to Claude Code.
- **Catalog** — browse by category, tag, or difficulty when you need one specific thing.
- **Registry** — `npx frenxt add <slug>` installs real artifacts (CLAUDE.md templates, skills, subagents, slash commands) directly into your project.

## Local development

This repo is a local-first monorepo. The companion site (rendering layer) and the `frenxt` CLI live in separate phases and will be wired in later.

Prerequisites: Node 22, pnpm 10.

```bash
pnpm install
pnpm validate        # validate all entries against the schema
pnpm build-index     # regenerate content/index.json
pnpm new-entry       # scaffold a new entry from template
pnpm test            # run the test suite
```

## Repo layout

```
content/claude-code/<day-NN-slug>/
├── index.mdx          # the tutorial / war story (rendered on the site)
├── registry.json      # optional — describes the installable artifact
└── artifact/          # optional — files the CLI copies into the user's project
```

See `CONTRIBUTING.md` for the house voice rules and PR checklist.

## License

MIT — see `LICENSE`.
