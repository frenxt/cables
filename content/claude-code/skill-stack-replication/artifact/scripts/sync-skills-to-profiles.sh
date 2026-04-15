#!/usr/bin/env bash
set -euo pipefail

SOURCE_SKILLS_DIR="${1:-.claude/skills}"
PROFILES=(
  "$HOME/.claude"
  "$HOME/.claude-curious"
  "$HOME/.claude-frenxt"
  "$HOME/.claude-interviewlm"
  "$HOME/.claude-juliet"
)

if [ ! -d "$SOURCE_SKILLS_DIR" ]; then
  echo "Skills source directory not found: $SOURCE_SKILLS_DIR" >&2
  exit 1
fi

for profile in "${PROFILES[@]}"; do
  mkdir -p "$profile/skills"
  for skill_dir in "$SOURCE_SKILLS_DIR"/*; do
    [ -d "$skill_dir" ] || continue
    skill_name="$(basename "$skill_dir")"
    mkdir -p "$profile/skills/$skill_name"
    cp "$skill_dir/SKILL.md" "$profile/skills/$skill_name/SKILL.md"
  done
  echo "Synced skills to $profile/skills"
done

echo "Skill sync complete."
