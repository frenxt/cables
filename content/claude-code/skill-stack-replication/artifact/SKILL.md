# Replicate FRE|Nxt Stack

Install and replicate Ragav's personal Claude stack (skills + plugin manifests + bootstrap scripts).

## Installed assets

- Core skills copied to `.claude/skills/*`
- Full plugin manifest at `.claude/stacks/frenxt/installed-plugins.txt`
- Full-stack bootstrap script at `.claude/stacks/frenxt/bootstrap-frenxt-stack.sh`
- Category manifests and scripts under `.claude/stacks/frenxt/categories/`

## Categories

- Developer Workflow Systems
- Reasoning Frameworks
- Domain Playbooks

## Full replication

```bash
bash .claude/stacks/frenxt/bootstrap-frenxt-stack.sh
```

## Category-only replication

```bash
# 1) Install only category plugins
bash .claude/stacks/frenxt/install-category-plugins.sh developer-workflow-systems

# 2) Sync only category skills to ~/.claude*
bash .claude/stacks/frenxt/sync-category-skills-to-profiles.sh developer-workflow-systems
```

Accepted category values:

- `developer-workflow-systems`
- `reasoning-frameworks`
- `domain-playbooks`

## Notes

- Plugin install commands depend on local Claude CLI plugin command support.
- Some skills include project-specific paths, IDs, and environment assumptions. Tune after bootstrap.
