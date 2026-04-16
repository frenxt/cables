#!/usr/bin/env bash
set -euo pipefail

CLAUDE_MANIFEST="${1:-.claude/stacks/frenxt/installed-plugins.txt}"
CODEX_MANIFEST="${2:-.claude/stacks/frenxt/installed-codex-plugins.txt}"
TARGET="${3:-both}"

install_claude_manifest() {
  local manifest="$1"
  if [ ! -f "$manifest" ]; then
    echo "Claude plugin manifest not found: $manifest" >&2
    return 1
  fi

  if ! command -v claude >/dev/null 2>&1; then
    echo "Claude CLI not found. Install Claude Code first." >&2
    return 1
  fi

  while IFS= read -r plugin; do
    [[ -z "$plugin" || "$plugin" =~ ^# ]] && continue
    echo "Installing Claude plugin: $plugin"
    if claude plugins install "$plugin"; then
      continue
    fi
    # Backward-compatible fallback for older plugin CLIs.
    if claude plugin install "$plugin"; then
      continue
    fi
    echo "Failed to install Claude plugin: $plugin" >&2
    return 1
  done < "$manifest"
  echo "Claude plugin install complete."
}

enable_codex_plugin() {
  local plugin="$1"
  local codex_config="$HOME/.codex/config.toml"
  mkdir -p "$(dirname "$codex_config")"
  touch "$codex_config"
  local header="[plugins.\"${plugin}\"]"
  if grep -Fq "$header" "$codex_config"; then
    local tmp
    tmp="$(mktemp)"
    awk -v header="$header" '
      BEGIN { in_section = 0; enabled_set = 0 }
      {
        if ($0 == header) {
          in_section = 1
          print
          next
        }
        if (in_section && $0 ~ /^\[/) {
          if (!enabled_set) {
            print "enabled = true"
            enabled_set = 1
          }
          in_section = 0
        }
        if (in_section && $0 ~ /^enabled[[:space:]]*=/) {
          print "enabled = true"
          enabled_set = 1
          next
        }
        print
      }
      END {
        if (in_section && !enabled_set) {
          print "enabled = true"
        }
      }
    ' "$codex_config" > "$tmp"
    mv "$tmp" "$codex_config"
  else
    printf '\n%s\nenabled = true\n' "$header" >> "$codex_config"
  fi
}

install_codex_manifest() {
  local manifest="$1"
  if [ ! -f "$manifest" ]; then
    echo "Codex plugin manifest not found: $manifest" >&2
    return 1
  fi

  if ! command -v codex >/dev/null 2>&1; then
    echo "Codex CLI not found. Skipping Codex plugin enablement." >&2
    return 1
  fi

  while IFS= read -r plugin; do
    [[ -z "$plugin" || "$plugin" =~ ^# ]] && continue
    echo "Enabling Codex plugin: $plugin"
    enable_codex_plugin "$plugin"
  done < "$manifest"

  echo "Codex plugin enablement complete."
}

case "$TARGET" in
  claude)
    install_claude_manifest "$CLAUDE_MANIFEST"
    ;;
  codex)
    install_codex_manifest "$CODEX_MANIFEST"
    ;;
  both)
    install_claude_manifest "$CLAUDE_MANIFEST"
    install_codex_manifest "$CODEX_MANIFEST"
    ;;
  *)
    echo "Unknown target: $TARGET (expected claude|codex|both)" >&2
    exit 1
    ;;
esac
