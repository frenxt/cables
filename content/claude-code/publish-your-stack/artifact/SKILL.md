---
name: publish-your-stack
description: Automates publishing a Claude Code stack to the Cables community. Use when the user asks to "publish my stack", "share my Claude setup", "ship my stack to Cables", or wants their plugin+skill bundle to appear on frenxt.com/stacks. Covers detecting the existing setup, generating the stack.json manifest, validating locally, committing and tagging, and opening the submission PR against frenxt/cables.
---

# Publish Your Stack to Cables

You are helping the user publish their Claude Code stack to the Cables community marketplace. Follow these steps in order. Never skip validation. Never publish without the user's explicit confirmation at the submission step.

---

## Prerequisites check (run silently first)

Before talking to the user, confirm these tools are present:

- `gh --version` — GitHub CLI, authenticated
- `git --version` — git
- `claude plugins list` — Claude CLI (to read the user's current plugins)
- `node --version` — Node.js for `npx`

If any missing, stop and tell the user what's missing + install instructions.

---

## Step 1 — Detect the user's existing stack

Read the user's setup so we can pre-fill the manifest. Run:

1. `claude plugins list` → parse the list of `<name>@<marketplace>` entries
2. `claude plugins marketplace list` → parse the list of configured marketplaces
3. `ls ~/.claude/skills/` → list skill slugs the user has locally
4. `ls ~/.codex/` (if exists) + parse `~/.codex/config.toml` for enabled plugins

Show the user a summary like:

```
Detected:
  Claude plugins (N):  superpowers, vercel, sentry, ...
  Codex plugins (M):   (none / list)
  Marketplaces:        claude-plugins-official, marketingskills
  Local skills (K):    qa, e2e-review, debug-prompt-caching, ...
```

Ask: "Publish everything, or a curated subset?" Most users want to pick a subset — not every skill/plugin is ready to share.

---

## Step 2 — Gather the stack metadata

Ask the user (one question at a time, use reasonable defaults):

1. **Slug** (kebab-case, unique on frenxt.com) — suggest `<github-handle>-<purpose>` e.g. `ravagin-ai-agents`
2. **Title** — short, human-readable
3. **Description** — 1–2 sentences; what this stack is for
4. **Purpose** — one of: `fullstack-development`, `ai-agent-development`, `ux-design`, `qa-release`, `marketing-growth`, `meta`, `other`
5. **GitHub username** — fetch with `gh api user -q .login` as default
6. **Repo name** — default `<slug>-stack` or ask for existing repo

---

## Step 3 — Prepare the publisher repo

Two paths:

### 3a. User has an existing repo
- Confirm it's public: `gh repo view <owner/repo> --json visibility -q .visibility`
- If private, tell user to either make it public or create a new one
- Clone it to a scratch dir if not already checked out

### 3b. User wants a new repo
- `gh repo create <owner/repo> --public --clone --description "<title> — a Cables stack"`

---

## Step 4 — Generate `.cables/stack.json`

In the publisher repo root, create `.cables/stack.json` from detected setup + user input:

```json
{
  "$schema": "https://frenxt.com/schema/community-stack-v1.json",
  "schema_version": 1,
  "slug": "<slug>",
  "title": "<title>",
  "description": "<description>",
  "purpose": "<purpose>",
  "author": {
    "github": "<github-username>",
    "url": "https://github.com/<github-username>"
  },
  "version": "0.1.0",
  "last_verified": "<today ISO date>",
  "marketplaces": [ ... only non-official ones the user confirmed ... ],
  "claude_plugins": [ ... user's selected subset, as "name@marketplace" ... ],
  "codex_plugins": [ ... ],
  "skills": [ ... slugs of skills the user wants to ship ... ]
}
```

**Important rules:**
- NEVER include `claude-plugins-official` or `openai-curated` in `marketplaces[]` — they're implicit. Including them gets rejected by the schema.
- Every plugin's `@<marketplace>` must either be an official one or be declared in `marketplaces[]`.
- `last_verified` must be today (YYYY-MM-DD).

---

## Step 5 — Bundle skills (optional)

If the user wants to ship any skills, copy them from `~/.claude/skills/<slug>/` into `<publisher-repo>/.claude/skills/<slug>/`. One directory per skill. Each needs a `SKILL.md` file.

Do NOT copy skills that contain:
- Company-specific prompts (warn user and ask)
- API keys or credentials in example code
- References to proprietary systems

Ask the user to review each bundled skill before proceeding.

---

## Step 6 — Validate locally

Run:

```bash
cd <publisher-repo>
npx -y frenxt-cables stack-publish .
```

Three outcomes:

- **✓ APPROVED** — proceed to Step 7
- **⚠ NEEDS REVIEW** — show the user the flagged items (typo-squat suspicion, external marketplace). Let them decide whether to proceed (maintainer review on PR side is the safety net)
- **✗ REJECTED** — show the errors, help user fix (stale date, undeclared marketplace, forbidden key), re-run validator

Do NOT move forward on REJECTED. Loop until APPROVED or NEEDS REVIEW with user's OK.

---

## Step 7 — Commit, tag, push

```bash
git add .cables/ .claude/skills/
git commit -m "feat: publish Cables stack <slug> v0.1.0"
git tag v0.1.0
git push origin main --tags
```

Capture the tag URL for the submission step.

---

## Step 8 — Open the submission PR against frenxt/cables

This is where the user's stack officially enters the Cables namespace. Do it carefully.

1. Fork and clone frenxt/cables (if not already done):
   ```bash
   gh repo fork frenxt/cables --clone=true --remote=false
   cd cables
   ```
2. Create a branch: `git checkout -b publish/<slug>`
3. Add the submission pointer at `community-stacks/<slug>.json`:
   ```json
   {
     "$schema": "https://frenxt.com/schema/community-stack-submission-v1.json",
     "schema_version": 1,
     "slug": "<slug>",
     "repo": "<owner>/<repo>",
     "ref": "v0.1.0",
     "submitted_by": "<github-username>"
   }
   ```
4. Commit: `git add community-stacks/ && git commit -m "publish: <slug> by <github-username>"`
5. Push: `git push -u origin publish/<slug>`
6. Open PR:
   ```bash
   gh pr create --repo frenxt/cables \
     --title "publish: <slug> by <github-username>" \
     --body "$(cat <<EOF
   ## Stack submission — \`<slug>\`

   - Publisher: [\`<owner>/<repo>\`](https://github.com/<owner>/<repo>) @ \`v0.1.0\`
   - Purpose: <purpose>
   - Contents: N Claude plugins, M Codex plugins, K skills

   Validated locally with \`frenxt stack-publish\`.
   EOF
   )"
   ```

---

## Step 9 — Show the user what's next

Print the PR URL and remind them:

- The automated review pipeline (frenxt validator + Semgrep + Gitleaks + OSSF Scorecard + Copilot review) runs on the PR
- If all green: a maintainer merges within 24 hours
- If flagged: maintainer asks questions on the PR
- Once merged: install with `npx -y frenxt-cables stack install <slug>`

---

## Rules

1. **Never push or open the submission PR without explicit user confirmation at Step 8.**
2. **Never skip local validation (Step 6).** The validator exists to catch issues before CI does.
3. **Never include sensitive content** in bundled skills (credentials, internal paths, company names).
4. **If validator rejects, fix the root cause.** Don't suggest `--force` or bypasses.
5. **Always tag the release** so installs are reproducible. Floating `main` refs are not allowed.
6. **Ask once per decision** — don't re-confirm things the user has already answered.

## Output shape

At the end of each step, show:
- What you did (one line)
- What's next (one line)

Keep your own commentary terse. The user is shipping a stack — they want progress updates, not explanations.
