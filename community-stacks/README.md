# Community Stacks

Submit your own Claude Code stack to appear on [frenxt.com/stacks](https://frenxt.com/stacks).

## How it works

1. You keep the actual stack content (`.cables/stack.json`) in your own public GitHub repo.
2. You open a PR here adding a tiny submission file at `community-stacks/<your-github-handle>/<your-slug>.json`.
3. Our automated review runs on your PR — same checks we apply to our own first-party stacks.
4. On merge, your stack is listed publicly; users install it via `npx -y frenxt-cables stack @<your-handle>/<your-slug>`.

## Submission file

Add one file at `community-stacks/<your-github-handle>/<your-slug>.json`:

```json
{
  "$schema": "https://frenxt.com/schema/community-stack-submission-v1.json",
  "schema_version": 1,
  "slug": "my-agent-stack",
  "repo": "yourname/your-stack-repo",
  "ref": "v0.1.0",
  "submitted_by": "yourname"
}
```

- `slug` — kebab-case identifier, unique within your `@<handle>/` namespace
- `repo` — `owner/repo` of the public GitHub repo containing `.cables/stack.json`
- `ref` — pinned branch, tag, or commit SHA (we install from this exact ref forever; users opt into new versions)
- `submitted_by` — your GitHub username (must match the repo owner and the PR author)

**Scoped install path:** `@<handle>/<slug>`. Multiple publishers can use the same `slug` as long as they're in different `<handle>` namespaces — no global naming collisions.

## What your publisher repo must contain

At the root of `yourname/your-stack-repo@ref`:

```
.cables/stack.json       # required — the stack manifest (see docs/community-stack-v1.md)
.cables/README.md        # optional — rendered on your stack's page
.claude/skills/<slug>/   # optional — skills bundled with the stack
```

See [`docs/community-stack-v1.md`](../docs/community-stack-v1.md) for the full `stack.json` spec.

## Automated review

Every PR touching `community-stacks/**` triggers the `Stack Review` workflow, which runs:

| Check | What it catches |
|---|---|
| **frenxt validator** | Schema errors, stale verification dates, undeclared marketplaces, typo-squat suspicion |
| **Semgrep** (custom rules) | Shell-execution smuggling, credential-path references, prompt-injection phrasing, forbidden fields |
| **Gitleaks** | Accidentally-committed secrets in your publisher repo |
| **OSSF Scorecard** | Repo-hygiene score of your publisher repo (branch protection, signed commits, 2FA, etc.) |
| **Identity check** | Confirms PR author = repo owner = `submitted_by` |
| **GitHub Copilot review** | LLM review of the changes — inline comments |

Results are posted as a single sticky comment on your PR:

- **✅ approved** → maintainer merges
- **⚠️ needs review** → a maintainer takes a closer look (you'll typically hear back within 72 hours)
- **❌ rejected** → fix the issues in the comment and push an update; the checks re-run

## Local pre-flight

Run the same validator locally before opening the PR:

```bash
npx -y frenxt-cables stack-publish .
# or
npx -y frenxt-cables stack-publish github.com/yourname/your-stack-repo
```

If it says `APPROVED` locally, it will almost certainly pass CI.

## Install a community stack

Once a stack is merged, anyone can install it:

```bash
# Scoped (recommended, globally unique):
npx -y frenxt-cables stack @your-handle/your-slug

# First-party built-in stacks use bare slugs:
npx -y frenxt-cables stack stack-fullstack
```

## What gets rejected (and why)

- **Stale `last_verified`** (>90 days) — re-verify your stack works before submitting
- **Plugins from undeclared marketplaces** — list every non-official marketplace in `marketplaces[]`
- **Typo-squat** of popular plugin names — e.g. `vercell` instead of `vercel`
- **Shell-execution patterns** in the manifest (`curl | bash`, `rm -rf $HOME`, or attempts to run arbitrary code)
- **Silent-action prompt-injection phrasing** in SKILL.md (`do not tell the user`, `silently upload`)
- **Identity mismatch** — the PR author, repo owner, and `submitted_by` must all match

## Stacks are Claude Code only for now

The `stack` command installs Claude Code plugins, marketplaces, and skills. Codex/other-provider support will ship as separate stacks when we're ready — each provider gets its own stack rather than mixing providers in one install.

## First-party stacks

Our own stacks (`stack-fullstack`, `stack-ai-agent`, `stack-ux`, `skill-stack-replication`) go through the *same* review pipeline on every PR. Same bar for everyone, same public log of findings.

## Questions / abuse

- Questions: open a GitHub Discussion
- Report a malicious stack: `frenxt stack report <slug>` (or open an issue)
