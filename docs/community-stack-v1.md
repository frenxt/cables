# Community Stack Spec v1

The contract a community publisher ships in their own public GitHub repo to register a stack on frenxt.com.

## Location

One file, one path:

```
<repo-root>/.cables/stack.json
```

Optionally:

```
<repo-root>/.cables/README.md         # rendered on the directory page
```

## Shape

```json
{
  "$schema": "https://frenxt.com/schema/community-stack-v1.json",
  "schema_version": 1,
  "slug": "ravagin-ai-agents",
  "title": "Ravagin's AI agent stack",
  "description": "What I actually use for LangGraph + prompt-caching work.",
  "purpose": "ai-agent-development",
  "author": {
    "github": "ravagin",
    "url": "https://github.com/ravagin"
  },
  "version": "0.1.0",
  "last_verified": "2026-04-18",
  "marketplaces": [
    { "name": "marketingskills", "source": "https://github.com/coreyhaines31/marketingskills" }
  ],
  "claude_plugins": [
    "superpowers@claude-plugins-official",
    "vercel@claude-plugins-official",
    "sentry@claude-plugins-official"
  ],
  "codex_plugins": [
    "vercel@openai-curated"
  ],
  "skills": [
    "analyse-langsmith-trace",
    "debug-prompt-caching"
  ]
}
```

## Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | `1` | ✓ | Schema version this manifest targets |
| `slug` | kebab-case | ✓ | Unique on frenxt.com; first-come first-served, moderated |
| `title` | string | ✓ | Shown on the directory page |
| `description` | string | ✓ | 1–2 sentences, shown in search |
| `purpose` | enum | ✓ | `fullstack-development` · `ai-agent-development` · `ux-design` · `qa-release` · `marketing-growth` · `meta` · `other` |
| `author.github` | string | ✓ | GitHub handle; must match repo owner for auto-approve |
| `author.url` | string | optional | Author's site or LinkedIn |
| `version` | semver | ✓ | Bump on changes; re-triggers security review |
| `last_verified` | ISO date | ✓ | Must be within 90 days at publish time |
| `marketplaces[]` | array | optional | Non-official marketplaces the stack needs |
| `claude_plugins[]` | array | optional | `plugin@marketplace` — each must resolve |
| `codex_plugins[]` | array | optional | `plugin@marketplace` — Codex config enablement |
| `skills[]` | array | optional | Skill slugs to sync from the repo's `.claude/skills/` |

## Forbidden fields

Any field matching these patterns is rejected at publish time:

- `exec`, `post_install_exec`, `scripts`, `commands`, `run` — no shell execution
- Any nested object containing a string that starts with `bash`, `curl`, `wget`, `eval`, `&&`, `||`, `;`
- Any URL that's not `https://` or a bare `github.com/org/repo`

## Security contract (automated, on every publish)

| Check | Fail = |
|---|---|
| Manifest parses + validates against schema | Reject |
| `last_verified` within 90 days | Reject |
| Every `marketplace.source` is `github.com/<author.github>/...` OR on the allowlist | Flag for human review |
| Every `@marketplace` in plugins is configured in `marketplaces[]` or is official (`claude-plugins-official`, `openai-curated`) | Reject |
| No plugin name within edit-distance 2 of a popular plugin name that it isn't (typo-squat) | Flag for human review |
| Skill slugs map to real files at `.claude/skills/<slug>/SKILL.md` in the source repo | Reject |
| GitHub OAuth signer matches `author.github` | Reject (unsigned publish always reviewed) |

## Marketplace allowlist (v1)

Stacks can use these marketplaces without triggering review:

- `claude-plugins-official` — Anthropic's official plugin registry
- `openai-curated` — OpenAI Codex curated plugins
- `github.com/<author.github>/<repo>` — marketplaces published by the same author as the stack

Anything else → flagged for human review.

## How users install a community stack

```bash
npx -y frenxt-cables stack install ravagin-ai-agents
```

Behind the scenes:
1. CLI queries `https://frenxt.com/api/stacks/<slug>` for the current approved `stack.json` + source repo SHA
2. Fetches that specific SHA from the author's repo (pinned for install-time reproducibility)
3. Runs the same flow as `frenxt stack <built-in-slug>` — marketplaces, plugins, skills

## Versioning

- Bumping `version` with any change to `marketplaces`, `claude_plugins`, `codex_plugins`, `skills`, or forbidden-field scans → re-triggers security review.
- Cosmetic changes to `title`, `description`, `author.url` don't trigger review.
- Old versions stay installable via `frenxt stack install <slug>@<version>`.

## Example repos (Phase 1 reference)

- `frenxt/cables` uses this same schema internally for the built-in stacks (`stack-fullstack`, `stack-ai-agent`, `stack-ux`, `skill-stack-replication`).
