import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectClaudeCodeProject,
  detectCodexProject,
  detectSupportedProject,
  resolveTargetTool,
} from "../lib/project";

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

describe("detectCodexProject", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "frenxt-project-"));
  });

  it("returns true when AGENTS.md exists", () => {
    writeFileSync(join(root, "AGENTS.md"), "# project\n");
    expect(detectCodexProject(root)).toBe(true);
  });

  it("returns true when .codex/ directory exists", () => {
    mkdirSync(join(root, ".codex"));
    expect(detectCodexProject(root)).toBe(true);
  });

  it("returns true when .agents/ directory exists", () => {
    mkdirSync(join(root, ".agents"));
    expect(detectCodexProject(root)).toBe(true);
  });

  it("returns false when no Codex markers exist", () => {
    expect(detectCodexProject(root)).toBe(false);
  });
});

describe("resolveTargetTool", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "frenxt-project-"));
  });

  it("auto-detects Codex-only projects", () => {
    writeFileSync(join(root, "AGENTS.md"), "# project\n");
    expect(resolveTargetTool(root, "auto")).toBe("codex");
    expect(detectSupportedProject(root)).toBe("codex");
  });

  it("keeps Claude as the default when both project markers exist", () => {
    writeFileSync(join(root, "AGENTS.md"), "# project\n");
    writeFileSync(join(root, "CLAUDE.md"), "# project\n");
    expect(resolveTargetTool(root, "auto")).toBe("claude-code");
  });

  it("honors explicit Codex target", () => {
    expect(resolveTargetTool(root, "codex")).toBe("codex");
  });
});
