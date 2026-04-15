import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertCodexToClaude } from "../lib/convert-codex-to-claude";

describe("convertCodexToClaude", () => {
  let sourceRoot: string;
  let targetRoot: string;

  beforeEach(() => {
    sourceRoot = mkdtempSync(join(tmpdir(), "frenxt-convert-source-codex-"));
    targetRoot = mkdtempSync(join(tmpdir(), "frenxt-convert-target-claude-"));
  });

  it("converts codex skills, prompts, AGENTS.md, and rules", () => {
    mkdirSync(join(sourceRoot, ".agents", "skills", "review"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".agents", "skills", "review", "SKILL.md"),
      "# Review Skill\n\nUse AGENTS.md and .agents/skills.\n"
    );

    mkdirSync(join(sourceRoot, ".codex", "prompts"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".codex", "prompts", "release.md"),
      "<!--\nConverted from a Claude Code slash command.\nCodex treats this file as a custom prompt in .codex/prompts/.\n-->\n\nRelease checks.\n"
    );

    writeFileSync(join(sourceRoot, "AGENTS.md"), "# AGENTS.md\n\nTeam process.\n");
    mkdirSync(join(sourceRoot, ".codex", "rules"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".codex", "rules", "default.rules"),
      [
        '# Converted from .claude/settings.json',
        'prefix_rule(["git", "status"], decision = "allow")',
        'prefix_rule(["npm", "test"], decision = "prompt")',
        'prefix_rule(["rm", "-rf", "/"], decision = "forbidden")',
        "",
      ].join("\n")
    );

    const result = convertCodexToClaude({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: false,
    });

    expect(result.writtenFiles).toContain(".claude/skills/review/SKILL.md");
    expect(result.writtenFiles).toContain(".claude/commands/release.md");
    expect(result.writtenFiles).toContain("CLAUDE.md");
    expect(result.writtenFiles).toContain(".claude/settings.json");

    const skill = readFileSync(join(targetRoot, ".claude", "skills", "review", "SKILL.md"), "utf8");
    expect(skill).toContain(".claude/skills");
    expect(skill).toContain("CLAUDE.md");

    const command = readFileSync(join(targetRoot, ".claude", "commands", "release.md"), "utf8");
    expect(command).toContain("Release checks.");
    expect(command).not.toContain("Converted from a Claude Code slash command");

    const claudeMd = readFileSync(join(targetRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("Converted from AGENTS.md");
    expect(claudeMd).toContain("# CLAUDE.md");

    const settings = JSON.parse(readFileSync(join(targetRoot, ".claude", "settings.json"), "utf8")) as {
      permissions: { allow: string[]; ask: string[]; deny: string[] };
    };
    expect(settings.permissions.allow).toContain("Bash(git status:*)");
    expect(settings.permissions.ask).toContain("Bash(npm test:*)");
    expect(settings.permissions.deny).toContain("Bash(rm -rf /:*)");
  });

  it("dry-run reports writes without touching disk", () => {
    mkdirSync(join(sourceRoot, ".codex", "prompts"), { recursive: true });
    writeFileSync(join(sourceRoot, ".codex", "prompts", "audit.md"), "Audit prompt.\n");

    const result = convertCodexToClaude({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: true,
    });

    expect(result.writtenFiles).toContain(".claude/commands/audit.md");
    expect(existsSync(join(targetRoot, ".claude", "commands", "audit.md"))).toBe(false);
  });

  it("skips existing files unless force is true", () => {
    mkdirSync(join(sourceRoot, ".codex", "prompts"), { recursive: true });
    writeFileSync(join(sourceRoot, ".codex", "prompts", "release.md"), "new prompt\n");
    mkdirSync(join(targetRoot, ".claude", "commands"), { recursive: true });
    writeFileSync(join(targetRoot, ".claude", "commands", "release.md"), "old command\n");

    const first = convertCodexToClaude({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: false,
    });
    expect(first.skippedFiles).toContain(".claude/commands/release.md");
    expect(readFileSync(join(targetRoot, ".claude", "commands", "release.md"), "utf8")).toBe("old command\n");

    const second = convertCodexToClaude({
      sourceRoot,
      targetRoot,
      force: true,
      dryRun: false,
    });
    expect(second.writtenFiles).toContain(".claude/commands/release.md");
  });
});
