import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installPlan, type ConflictResolution } from "../lib/installer";
import type { PreparedInstall } from "../lib/types";

function makePlan(files: { source: string; target: string; content: string }[]): PreparedInstall {
  const fileMap = new Map<string, string>();
  for (const f of files) fileMap.set(f.source, f.content);
  return {
    registry: {
      slug: "test-cable",
      artifact_type: "claude-md",
      version: "1.0.0",
      requires: [],
      files: files.map((f) => ({
        source: f.source,
        target: f.target,
        action: "copy",
        on_conflict: "prompt",
      })),
    },
    files: fileMap,
  };
}

describe("installPlan", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "frenxt-install-"));
  });

  it("writes a file that does not yet exist", async () => {
    const plan = makePlan([
      { source: "artifact/CLAUDE.md", target: "CLAUDE.md", content: "# Hello\n" },
    ]);
    const result = await installPlan(plan, {
      projectRoot,
      force: false,
      dryRun: false,
      onConflict: async () => "overwrite",
    });
    expect(result.writtenFiles).toContain("CLAUDE.md");
    expect(existsSync(join(projectRoot, "CLAUDE.md"))).toBe(true);
    expect(readFileSync(join(projectRoot, "CLAUDE.md"), "utf8")).toBe("# Hello\n");
  });

  it("prompts on conflict when the target exists", async () => {
    writeFileSync(join(projectRoot, "CLAUDE.md"), "# old content\n");
    const plan = makePlan([
      { source: "artifact/CLAUDE.md", target: "CLAUDE.md", content: "# new content\n" },
    ]);
    let promptedPath: string | null = null;
    const onConflict = async (path: string): Promise<ConflictResolution> => {
      promptedPath = path;
      return "overwrite";
    };
    const result = await installPlan(plan, { projectRoot, force: false, dryRun: false, onConflict });
    expect(promptedPath).toBe("CLAUDE.md");
    expect(result.writtenFiles).toContain("CLAUDE.md");
    expect(readFileSync(join(projectRoot, "CLAUDE.md"), "utf8")).toBe("# new content\n");
  });

  it("skips a file when the user chooses skip", async () => {
    writeFileSync(join(projectRoot, "CLAUDE.md"), "# keep me\n");
    const plan = makePlan([
      { source: "artifact/CLAUDE.md", target: "CLAUDE.md", content: "# new content\n" },
    ]);
    const result = await installPlan(plan, {
      projectRoot,
      force: false,
      dryRun: false,
      onConflict: async () => "skip",
    });
    expect(result.skippedFiles).toContain("CLAUDE.md");
    expect(result.writtenFiles).not.toContain("CLAUDE.md");
    expect(readFileSync(join(projectRoot, "CLAUDE.md"), "utf8")).toBe("# keep me\n");
  });

  it("force mode overwrites without prompting", async () => {
    writeFileSync(join(projectRoot, "CLAUDE.md"), "# old\n");
    const plan = makePlan([
      { source: "artifact/CLAUDE.md", target: "CLAUDE.md", content: "# forced\n" },
    ]);
    let called = false;
    const result = await installPlan(plan, {
      projectRoot,
      force: true,
      dryRun: false,
      onConflict: async () => {
        called = true;
        return "skip";
      },
    });
    expect(called).toBe(false);
    expect(result.writtenFiles).toContain("CLAUDE.md");
    expect(readFileSync(join(projectRoot, "CLAUDE.md"), "utf8")).toBe("# forced\n");
  });

  it("dry-run reports planned writes without touching disk", async () => {
    const plan = makePlan([
      { source: "artifact/CLAUDE.md", target: "CLAUDE.md", content: "# hello\n" },
    ]);
    const result = await installPlan(plan, {
      projectRoot,
      force: false,
      dryRun: true,
      onConflict: async () => "overwrite",
    });
    expect(result.writtenFiles).toContain("CLAUDE.md");
    expect(existsSync(join(projectRoot, "CLAUDE.md"))).toBe(false);
  });

  it("creates parent directories for nested targets", async () => {
    const plan = makePlan([
      {
        source: "artifact/skill.md",
        target: ".claude/skills/test/SKILL.md",
        content: "# Skill\n",
      },
    ]);
    const result = await installPlan(plan, {
      projectRoot,
      force: false,
      dryRun: false,
      onConflict: async () => "overwrite",
    });
    expect(result.writtenFiles).toContain(".claude/skills/test/SKILL.md");
    expect(existsSync(join(projectRoot, ".claude/skills/test/SKILL.md"))).toBe(true);
  });

  it("rewrites Claude skill targets and content for Codex installs", async () => {
    const plan = makePlan([
      {
        source: "artifact/SKILL.md",
        target: ".claude/skills/qa/SKILL.md",
        content: "Read CLAUDE.md and .claude/skills/qa/SKILL.md\n",
      },
    ]);
    const result = await installPlan(plan, {
      projectRoot,
      force: false,
      dryRun: false,
      targetTool: "codex",
      onConflict: async () => "overwrite",
    });
    const target = ".agents/skills/qa/SKILL.md";
    expect(result.writtenFiles).toContain(target);
    expect(existsSync(join(projectRoot, target))).toBe(true);
    expect(readFileSync(join(projectRoot, target), "utf8")).toBe(
      "Read AGENTS.md and .agents/skills/qa/SKILL.md\n"
    );
  });

  it("rewrites root CLAUDE.md targets for Codex installs", async () => {
    const plan = makePlan([
      { source: "artifact/CLAUDE.md", target: "CLAUDE.md", content: "# CLAUDE.md\n" },
    ]);
    const result = await installPlan(plan, {
      projectRoot,
      force: false,
      dryRun: false,
      targetTool: "codex",
      onConflict: async () => "overwrite",
    });
    expect(result.writtenFiles).toContain("AGENTS.md");
    expect(readFileSync(join(projectRoot, "AGENTS.md"), "utf8")).toBe("# AGENTS.md\n");
  });

  it("handles multiple files in one plan", async () => {
    const plan = makePlan([
      { source: "a.md", target: "a.md", content: "a\n" },
      { source: "b.md", target: "b.md", content: "b\n" },
    ]);
    const result = await installPlan(plan, {
      projectRoot,
      force: false,
      dryRun: false,
      onConflict: async () => "overwrite",
    });
    expect(result.writtenFiles).toHaveLength(2);
    expect(result.writtenFiles).toContain("a.md");
    expect(result.writtenFiles).toContain("b.md");
  });
});
