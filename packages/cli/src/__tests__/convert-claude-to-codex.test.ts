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

  it("converts skills, commands (as skills), CLAUDE.md, and settings permissions", () => {
    mkdirSync(join(sourceRoot, ".claude", "skills", "qa"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".claude", "skills", "qa", "SKILL.md"),
      "# QA Skill\n\nUse CLAUDE.md and .claude/skills.\n"
    );
    mkdirSync(join(sourceRoot, ".claude", "skills", "qa", "scripts"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".claude", "skills", "qa", "scripts", "run-checks.sh"),
      "#!/usr/bin/env bash\ncat CLAUDE.md\n"
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
    expect(result.writtenFiles).toContain(".agents/skills/qa/scripts/run-checks.sh");
    expect(result.writtenFiles).toContain(".agents/skills/cmd-ship/SKILL.md");
    expect(result.writtenFiles).toContain("AGENTS.md");
    expect(result.writtenFiles).toContain(".codex/rules/default.rules");

    const skill = readFileSync(join(targetRoot, ".agents", "skills", "qa", "SKILL.md"), "utf8");
    expect(skill).toContain('name: "qa"');
    expect(skill).toContain('description: "Use AGENTS.md and .agents/skills."');
    expect(skill).toContain('argument-hint: ""');
    expect(skill).toContain("AGENTS.md");
    expect(skill).toContain(".agents/skills");
    const script = readFileSync(
      join(targetRoot, ".agents", "skills", "qa", "scripts", "run-checks.sh"),
      "utf8"
    );
    expect(script).toContain("AGENTS.md");

    const commandSkill = readFileSync(join(targetRoot, ".agents", "skills", "cmd-ship", "SKILL.md"), "utf8");
    expect(commandSkill).toContain('converted-from: "claude-command"');
    expect(commandSkill).toContain('claude-command-path: "ship.md"');
    expect(commandSkill).toContain("Run release checks.");

    const agents = readFileSync(join(targetRoot, "AGENTS.md"), "utf8");
    expect(agents).toContain("Source: CLAUDE.md");
    expect(agents).toContain("# Team rules");

    const rules = readFileSync(join(targetRoot, ".codex", "rules", "default.rules"), "utf8");
    expect(rules).toContain('prefix_rule(["git", "status"], decision = "allow")');
    expect(rules).toContain('prefix_rule(["npm", "test"], decision = "prompt")');
    expect(rules).toContain('prefix_rule(["rm", "-rf", "/"], decision = "forbidden")');
  });

  it("quotes argument-hint in converted skill frontmatter", () => {
    mkdirSync(join(sourceRoot, ".claude", "skills", "image-gen"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".claude", "skills", "image-gen", "SKILL.md"),
      [
        "---",
        "name: image-gen",
        "description: Generate images.",
        "argument-hint: [prompt] [--model MODEL] [--out PATH]",
        "---",
        "",
        "# Image Gen",
        "",
        "Use this skill for image generation.",
        "",
      ].join("\n")
    );

    convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: false,
    });

    const skill = readFileSync(join(targetRoot, ".agents", "skills", "image-gen", "SKILL.md"), "utf8");
    expect(skill).toContain('name: "image-gen"');
    expect(skill).toContain('description: "Generate images."');
    expect(skill).toContain('argument-hint: "[prompt] [--model MODEL] [--out PATH]"');
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

    expect(result.writtenFiles).toContain(".agents/skills/cmd-audit/SKILL.md");
    expect(existsSync(join(targetRoot, ".agents", "skills", "cmd-audit", "SKILL.md"))).toBe(false);
  });

  it("skips existing files unless force is true", () => {
    mkdirSync(join(sourceRoot, ".claude", "commands"), { recursive: true });
    writeFileSync(join(sourceRoot, ".claude", "commands", "ship.md"), "new content\n");
    mkdirSync(join(targetRoot, ".agents", "skills", "cmd-ship"), { recursive: true });
    writeFileSync(join(targetRoot, ".agents", "skills", "cmd-ship", "SKILL.md"), "old content\n");

    const first = convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: false,
    });
    expect(first.skippedFiles).toContain(".agents/skills/cmd-ship/SKILL.md");
    expect(readFileSync(join(targetRoot, ".agents", "skills", "cmd-ship", "SKILL.md"), "utf8")).toBe("old content\n");

    const second = convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: true,
      dryRun: false,
    });
    expect(second.writtenFiles).toContain(".agents/skills/cmd-ship/SKILL.md");
  });

  it("can map commands to prompts when requested", () => {
    mkdirSync(join(sourceRoot, ".claude", "commands"), { recursive: true });
    writeFileSync(join(sourceRoot, ".claude", "commands", "release.md"), "Run release checks.\n");

    const result = convertClaudeToCodex({
      sourceRoot,
      targetRoot,
      force: false,
      dryRun: false,
      commandsAs: "prompts",
    });

    expect(result.writtenFiles).toContain(".codex/prompts/release.md");
    expect(result.warnings.some((w) => w.includes("deprecated"))).toBe(true);
    const prompt = readFileSync(join(targetRoot, ".codex", "prompts", "release.md"), "utf8");
    expect(prompt).toContain("Converted from a Claude Code slash command.");
  });
});
