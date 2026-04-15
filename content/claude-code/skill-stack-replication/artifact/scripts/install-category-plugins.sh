#!/usr/bin/env bash
set -euo pipefail

CATEGORY="${1:-}"
if [ -z "$CATEGORY" ]; then
  echo "Usage: $0 <developer-workflow-systems|reasoning-frameworks|domain-playbooks>" >&2
  exit 1
fi

MANIFEST_FILE=".claude/stacks/frenxt/categories/plugins-${CATEGORY}.txt"
".claude/stacks/frenxt/install-plugins.sh" "$MANIFEST_FILE"
