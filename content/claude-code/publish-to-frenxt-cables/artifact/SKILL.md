# Publish To FRE|Nxt Cables

End-to-end operating procedure for publishing a cable in the FRE|Nxt cables ecosystem.

## Goal

Take a cable from "drafted content" to "published and resolvable" with deterministic checks.

## Use This Skill When

- You are creating a new cable under `content/cables/content/claude-code/<slug>/`.
- You are changing frontmatter, artifact files, or `registry.json` for an existing cable.
- You need to ship both submodule and parent repo changes without broken pointers.

## Required Inputs

- Cable `slug`
- Intent:
  - `new` (brand new cable)
  - `update` (existing cable changes)
- Target branch names for:
  - `content/cables` repo
  - parent `frenxt` repo

## Output Contract

Always produce these sections:

1. `Scope`
2. `Changes Made`
3. `Validation`
4. `Git State`
5. `Publish Commands`
6. `Risks / Follow-ups`

## Workflow

### 1) Preflight

- Confirm working tree state in both repos:
  - parent: `git status --short`
  - submodule: `git -C content/cables status --short`
- Do not revert unrelated local changes.
- Isolate only files relevant to this cable.

### 2) Content Authoring

For `new` cables, create:

- `content/cables/content/claude-code/<slug>/index.mdx`
- `content/cables/content/claude-code/<slug>/registry.json` (if installable)
- `content/cables/content/claude-code/<slug>/artifact/*` (if installable)

Frontmatter requirements:

- Required: `title`, `slug`, `tool`, `track`, `category`, `difficulty`, `last_verified`, `contributors`
- Optional but recommended: `tags`, `time_required`, `source_links`, `has_war_story`
- Installable cables must set `artifact_type` and include `registry.json`.

Authoring quality checks:

- Clear problem statement
- Concrete workflow or operating pattern
- No placeholder TODO text
- Markdown and heading structure is readable

### 3) Artifact Quality (Installable Cables)

For `artifact_type: "skill"`:

- Artifact must be at `artifact/SKILL.md`
- `registry.json` must map source -> target skill path:
  - target pattern: `.claude/skills/<slug>/SKILL.md`
- Keep instructions deterministic and scoped.

### 4) Validate and Rebuild Index

Run in submodule:

```bash
npm --prefix content/cables run validate
npm --prefix content/cables run build-index
```

Optional confidence check:

```bash
npm --prefix content/cables test
```

If `tsx` sandbox IPC fails, rerun with elevated permissions.

### 5) Git Sequencing

Commit order must be:

1. Submodule (`content/cables`) commit
2. Parent repo commit to update submodule pointer and site code (if any)

Submodule sequence:

```bash
git -C content/cables add <files>
git -C content/cables commit -m "<message>"
git -C content/cables push origin <branch>
```

Parent sequence:

```bash
git add content/cables <any parent files>
git commit -m "<message>"
git push origin <branch>
```

### 6) Definition Of Done

A publish-ready result requires all:

- `validate` passes
- `build-index` runs and `content/index.json` updated when needed
- installable artifact paths are valid
- submodule commit is pushed
- parent pointer commit is pushed

## Failure Modes To Catch Early

- Missing required frontmatter field
- `artifact_type` set but `registry.json` missing
- `registry.json` target path typo
- Submodule commit exists locally but not pushed
- Parent pointer updated to a submodule commit that remote cannot resolve

## Reporting Template

Use this exact structure when you finish:

```md
## Scope
- ...

## Changes Made
- ...

## Validation
- `npm --prefix content/cables run validate`: pass/fail
- `npm --prefix content/cables run build-index`: pass/fail
- `npm --prefix content/cables test` (optional): pass/fail

## Git State
- submodule branch + commit:
- parent branch + commit:

## Publish Commands
- ...

## Risks / Follow-ups
- ...
```

