#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(pwd)"

"$PROJECT_ROOT/.claude/stacks/frenxt/install-plugins.sh" "$PROJECT_ROOT/.claude/stacks/frenxt/installed-plugins.txt"
"$PROJECT_ROOT/.claude/stacks/frenxt/sync-skills-to-profiles.sh" "$PROJECT_ROOT/.claude/skills"

echo "FRE|Nxt stack bootstrap complete."
