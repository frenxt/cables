import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectClaudeCodeProject } from "../lib/project";

describe("detectClaudeCodeProject", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "frenxt-project-"));
  });

  it("returns true when CLAUDE.md exists", () => {
    writeFileSync(join(root, "CLAUDE.md"), "# project\n");
    expect(detectClaudeCodeProject(root)).toBe(true);
  });

  it("returns true when .claude/ directory exists", () => {
    mkdirSync(join(root, ".claude"));
    expect(detectClaudeCodeProject(root)).toBe(true);
  });

  it("returns true when both exist", () => {
    writeFileSync(join(root, "CLAUDE.md"), "# project\n");
    mkdirSync(join(root, ".claude"));
    expect(detectClaudeCodeProject(root)).toBe(true);
  });

  it("returns false when neither exists", () => {
    expect(detectClaudeCodeProject(root)).toBe(false);
  });

  it("returns false when the path itself does not exist", () => {
    expect(detectClaudeCodeProject(join(root, "nonexistent-subdir"))).toBe(false);
  });
});
