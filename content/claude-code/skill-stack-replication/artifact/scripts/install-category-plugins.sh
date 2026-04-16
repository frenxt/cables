#!/usr/bin/env bash
set -euo pipefail

CATEGORY="${1:-}"
if [ -z "$CATEGORY" ]; then
  echo "Usage: $0 <developer-workflow-systems|reasoning-frameworks|domain-playbooks>" >&2
  exit 1
fi

CLAUDE_MANIFEST=".claude/stacks/frenxt/categories/plugins-${CATEGORY}.txt"
CODEX_MANIFEST=".claude/stacks/frenxt/categories/codex-plugins-${CATEGORY}.txt"
".claude/stacks/frenxt/install-plugins.sh" "$CLAUDE_MANIFEST" "$CODEX_MANIFEST" both
