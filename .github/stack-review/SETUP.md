# Stack Review — Repo Setup (one-time)

One-time setup steps that must be done in the GitHub UI. The workflow file alone is not enough.

## 1. Enable GitHub Copilot Code Review (free on public repos)

1. Go to **Settings → Code security → Copilot code review**
2. Toggle on: **"Automatic review for pull requests"**
3. Scope: **All pull requests** (or at least any PR touching `community-stacks/**` or `content/**`)

Copilot will then auto-review every stack PR with inline comments. Free forever for public repos; no Copilot subscription required.

## 2. Branch protection on `main`

Settings → Branches → Add rule for `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass: select `Stack Review / review`
- ✅ Require review from Code Owners (optional but recommended)
- ✅ Require linear history

## 3. CODEOWNERS

Create `.github/CODEOWNERS`:

```
# Default owners for everything
*                         @frenxt

# Community stacks — any maintainer can approve
/community-stacks/        @frenxt

# First-party stack cables — tighter review
/content/claude-code/stack-* @frenxt
```

## 4. Required workflow labels

No action needed — the workflow uses the default `GITHUB_TOKEN` which is automatically provided on PRs.

## 5. (Optional) Enable OSSF Scorecard badge

Add a badge to the repo README that shows our own Scorecard score — signals we take supply-chain hygiene seriously, encourages publishers to do the same:

```markdown
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/frenxt/cables/badge)](https://api.securityscorecards.dev/projects/github.com/frenxt/cables)
```

## Cost summary

| Item | Cost |
|---|---|
| GitHub Actions (public repo) | Free, unlimited |
| Semgrep (self-hosted in CI) | Free |
| Gitleaks | Free |
| OSSF Scorecard API | Free |
| GitHub Copilot code review (public repo) | Free |
| Total ongoing cost | **$0** |

The only cost would be if we added a paid LLM reviewer (e.g. Claude API for deeper semantic review). That's Phase 2 and optional — Copilot review already covers the LLM layer for free.
