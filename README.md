# Cables

Field notes from real projects with AI coding tools (Claude Code, Codex, and more). Written and maintained by [FRE|Nxt Labs](https://frenxt.com).

Every cable is a dispatch from someone who actually did the work — what we tried, what broke, what we learned, and the artifacts you can drop into your own setup.

Built to expand across AI coding tools over time.

## Three ways to use this

- **Day 1 → Day N track** — a sequenced path for someone new to Claude Code.
- **Catalog** — browse by category, tag, or difficulty when you need one specific thing.
- **Registry** — `npx frenxt-cables add <slug>` installs real artifacts (CLAUDE.md templates, skills, subagents, slash commands) directly into your project.
- **Interoperability** — `npx frenxt-cables convert claude-to-codex` and `npx frenxt-cables convert codex-to-claude` map skills, commands/prompts, and instruction/rule files between agent ecosystems.

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
content/<tool>/<slug>/
├── index.mdx          # the tutorial / war story (rendered on the site)
├── registry.json      # optional — describes the installable artifact
└── artifact/          # optional — files the CLI copies into the user's project
```

See `CONTRIBUTING.md` for the house voice rules and PR checklist.

## License

MIT — see `LICENSE`.
