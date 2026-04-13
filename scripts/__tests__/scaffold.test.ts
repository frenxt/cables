import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldEntry } from "../lib/scaffold";

describe("scaffoldEntry", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bwai-scaffold-"));
  });

  it("creates a tutorial-only entry folder with index.mdx when artifact_type is null", () => {
    scaffoldEntry({
      contentRoot: root,
      tool: "claude-code",
      slug: "day-01-install",
      title: "Install Claude Code and your first / command",
      track: "fundamentals",
      category: "onboarding",
      difficulty: "beginner",
      day: 1,
      artifact_type: null,
      last_verified: "2026-04-13",
    });
    const folder = join(root, "claude-code", "day-01-install");
    expect(existsSync(join(folder, "index.mdx"))).toBe(true);
    expect(existsSync(join(folder, "registry.json"))).toBe(false);
    expect(existsSync(join(folder, "artifact"))).toBe(false);
    const mdx = readFileSync(join(folder, "index.mdx"), "utf8");
    expect(mdx).toContain("slug: \"day-01-install\"");
    expect(mdx).toContain("title: \"Install Claude Code and your first / command\"");
    expect(mdx).toContain("difficulty: \"beginner\"");
    expect(mdx).toContain("contributors:");
  });

  it("creates an artifact-bearing entry with registry.json and artifact/ dir", () => {
    scaffoldEntry({
      contentRoot: root,
      tool: "claude-code",
      slug: "day-02-claude-md",
      title: "Your first CLAUDE.md",
      track: "fundamentals",
      category: "configuration",
      difficulty: "beginner",
      day: 2,
      artifact_type: "claude-md",
      last_verified: "2026-04-13",
    });
    const folder = join(root, "claude-code", "day-02-claude-md");
    expect(existsSync(join(folder, "index.mdx"))).toBe(true);
    expect(existsSync(join(folder, "registry.json"))).toBe(true);
    expect(existsSync(join(folder, "artifact"))).toBe(true);
    const reg = JSON.parse(readFileSync(join(folder, "registry.json"), "utf8"));
    expect(reg.slug).toBe("day-02-claude-md");
    expect(reg.artifact_type).toBe("claude-md");
    expect(reg.version).toBe("0.1.0");
    const mdx2 = readFileSync(join(folder, "index.mdx"), "utf8");
    expect(mdx2).toContain("contributors:");
  });

  it("throws if the target folder already exists", () => {
    scaffoldEntry({
      contentRoot: root,
      tool: "claude-code",
      slug: "day-01-install",
      title: "First entry",
      track: "fundamentals",
      category: "onboarding",
      difficulty: "beginner",
      day: 1,
      artifact_type: null,
      last_verified: "2026-04-13",
    });
    expect(() =>
      scaffoldEntry({
        contentRoot: root,
        tool: "claude-code",
        slug: "day-01-install",
        title: "Duplicate",
        track: "fundamentals",
        category: "onboarding",
        difficulty: "beginner",
        day: 1,
        artifact_type: null,
        last_verified: "2026-04-13",
      })
    ).toThrow(/already exists/i);
  });
});
