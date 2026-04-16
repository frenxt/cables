# Replicate FRE|Nxt Stack

Replicate Ragav's stack from the installed artifacts (Claude + Codex plugins, Claude skills).

## Full stack

Run:

- `bash .claude/stacks/frenxt/bootstrap-frenxt-stack.sh`

## Category-only

Run:

- `bash .claude/stacks/frenxt/install-category-plugins.sh <category>`
- `bash .claude/stacks/frenxt/sync-category-skills-to-profiles.sh <category>`

Categories:

- `developer-workflow-systems`
- `reasoning-frameworks`
- `domain-playbooks`

## Verify

- `claude plugins list`
- `rg "^\[plugins\." ~/.codex/config.toml`
- `ls -1 ~/.claude/skills`
- `ls -1 ~/.claude-frenxt/skills`
