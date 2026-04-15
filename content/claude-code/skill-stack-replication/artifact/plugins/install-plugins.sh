#!/usr/bin/env bash
set -euo pipefail

MANIFEST_FILE="${1:-.claude/stacks/frenxt/installed-plugins.txt}"

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude CLI not found. Install Claude Code first." >&2
  exit 1
fi

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "Plugin manifest not found: $MANIFEST_FILE" >&2
  exit 1
fi

while IFS= read -r plugin; do
  [ -z "$plugin" ] && continue
  echo "Installing plugin: $plugin"
  if claude plugins install "$plugin"; then
    continue
  fi
  # Backward-compatible fallback for older plugin CLIs.
  if claude plugin install "$plugin"; then
    continue
  fi
  echo "Failed to install plugin: $plugin" >&2
  exit 1
done < "$MANIFEST_FILE"

echo "Plugin install complete."
