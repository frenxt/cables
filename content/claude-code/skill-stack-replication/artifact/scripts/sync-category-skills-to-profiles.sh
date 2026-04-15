#!/usr/bin/env bash
set -euo pipefail

CATEGORY="${1:-}"
if [ -z "$CATEGORY" ]; then
  echo "Usage: $0 <developer-workflow-systems|reasoning-frameworks|domain-playbooks>" >&2
  exit 1
fi

MANIFEST_FILE=".claude/stacks/frenxt/categories/skills-${CATEGORY}.txt"
SOURCE_SKILLS_DIR=".claude/skills"
PROFILES=(
  "$HOME/.claude"
  "$HOME/.claude-curious"
  "$HOME/.claude-frenxt"
  "$HOME/.claude-interviewlm"
  "$HOME/.claude-juliet"
)

if [ ! -f "$MANIFEST_FILE" ]; then
  echo "Category skills manifest not found: $MANIFEST_FILE" >&2
  exit 1
fi

while IFS= read -r skill; do
  [[ -z "$skill" || "$skill" =~ ^# ]] && continue
  if [ ! -f "$SOURCE_SKILLS_DIR/$skill/SKILL.md" ]; then
    echo "Missing skill in project stack: $skill" >&2
    exit 1
  fi
  for profile in "${PROFILES[@]}"; do
    mkdir -p "$profile/skills/$skill"
    cp "$SOURCE_SKILLS_DIR/$skill/SKILL.md" "$profile/skills/$skill/SKILL.md"
  done
  echo "Synced category skill: $skill"
done < "$MANIFEST_FILE"

echo "Category skill sync complete for: $CATEGORY"
