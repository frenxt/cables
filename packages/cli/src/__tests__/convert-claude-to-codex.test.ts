import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertClaudeToCodex } from "../lib/convert-claude-to-codex";

describe("convertClaudeToCodex", () => {
  let sourceRoot: string;
  let targetRoot: string;

  beforeEach(() => {
    sourceRoot = mkdtempSync(join(tmpdir(), "frenxt-convert-source-"));
    targetRoot = mkdtempSync(join(tmpdir(), "frenxt-convert-target-"));
  });

  it("converts skills, commands, CLAUDE.md, and settings permissions", () => {
    mkdirSync(join(sourceRoot, ".claude", "skills", "qa"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".claude", "skills", "qa", "SKILL.md"),
      "# QA Skill\n\nUse CLAUDE.md and .claude/skills.\n"
    );

    mkdirSync(join(sourceRoot, ".claude", "commands"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".claude", "commands", "ship.md"),
      "---\ndescription: Ship changes\n---\nRun release checks.\n"
    );

    writeFileSync(join(sourceRoot, "CLAUDE.md"), "# Team rules\n");
    mkdirSync(join(sourceRoot, ".claude"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".claude", "settings.json"),
      JSON.stringify(
        {
          permissions: {
            allow: ["Bash(git status:*)"],
            ask: ["Bash(npm test:*)"],
            deny: ["Bash(rm -rf /:*)"],
          },
        },
        null,
        2
      )
    );

    const result = convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: false,
    });

    expect(result.writtenFiles).toContain(".agents/skills/qa/SKILL.md");
    expect(result.writtenFiles).toContain(".codex/prompts/ship.md");
    expect(result.writtenFiles).toContain("AGENTS.md");
    expect(result.writtenFiles).toContain(".codex/rules/default.rules");

    const skill = readFileSync(join(targetRoot, ".agents", "skills", "qa", "SKILL.md"), "utf8");
    expect(skill).toContain("AGENTS.md");
    expect(skill).toContain(".agents/skills");

    const command = readFileSync(join(targetRoot, ".codex", "prompts", "ship.md"), "utf8");
    expect(command).toContain("Converted from a Claude Code slash command.");
    expect(command).toContain("Run release checks.");

    const agents = readFileSync(join(targetRoot, "AGENTS.md"), "utf8");
    expect(agents).toContain("Source: CLAUDE.md");
    expect(agents).toContain("# Team rules");

    const rules = readFileSync(join(targetRoot, ".codex", "rules", "default.rules"), "utf8");
    expect(rules).toContain('prefix_rule(["git", "status"], decision = "allow")');
    expect(rules).toContain('prefix_rule(["npm", "test"], decision = "prompt")');
    expect(rules).toContain('prefix_rule(["rm", "-rf", "/"], decision = "forbidden")');
  });

  it("dry-run reports writes without touching disk", () => {
    mkdirSync(join(sourceRoot, ".claude", "commands"), { recursive: true });
    writeFileSync(join(sourceRoot, ".claude", "commands", "audit.md"), "Audit changes.\n");

    const result = convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: true,
    });

    expect(result.writtenFiles).toContain(".codex/prompts/audit.md");
    expect(existsSync(join(targetRoot, ".codex", "prompts", "audit.md"))).toBe(false);
  });

  it("skips existing files unless force is true", () => {
    mkdirSync(join(sourceRoot, ".claude", "commands"), { recursive: true });
    writeFileSync(join(sourceRoot, ".claude", "commands", "ship.md"), "new content\n");
    mkdirSync(join(targetRoot, ".codex", "prompts"), { recursive: true });
    writeFileSync(join(targetRoot, ".codex", "prompts", "ship.md"), "old content\n");

    const first = convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: false,
    });
    expect(first.skippedFiles).toContain(".codex/prompts/ship.md");
    expect(readFileSync(join(targetRoot, ".codex", "prompts", "ship.md"), "utf8")).toBe("old content\n");

    const second = convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: true,
      dryRun: false,
    });
    expect(second.writtenFiles).toContain(".codex/prompts/ship.md");
  });
});
