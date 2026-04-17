## Summary

- publisher:
- cable slug:
- tool:
- source repo:
- source commit SHA:

## Checklist

- [ ] I ran `pnpm sync-imports`
- [ ] I ran `pnpm validate`
- [ ] I ran `pnpm build-index`
- [ ] Generated snapshot changes under `content/**` are included in this PR
- [ ] `imports/<publisher>/<slug>.json` points to an immutable 40-character commit SHA
- [ ] If any affected publisher is on probation, this PR has the `allow-probation-import` label
- [ ] The imported artifact only writes to approved install roots:
  `CLAUDE.md`, `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/stacks/`
- [ ] The imported artifact does not include blocked binary payloads
- [ ] I reviewed the cable body for source quality and house voice

## Notes For Reviewers

- Link to publisher approval PR, if this is a new publisher:
- Any moderation or trust-tier notes:
