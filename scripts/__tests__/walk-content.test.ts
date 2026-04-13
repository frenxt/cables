import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walkContent } from "../lib/walk-content";

describe("walkContent", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "bwai-walk-"));
    const claudeCode = join(root, "claude-code");
    mkdirSync(claudeCode, { recursive: true });
    mkdirSync(join(claudeCode, "day-01-install"));
    writeFileSync(join(claudeCode, "day-01-install", "index.mdx"), "");
    mkdirSync(join(claudeCode, "day-02-claude-md"));
    writeFileSync(join(claudeCode, "day-02-claude-md", "index.mdx"), "");
    // A folder with no index.mdx should be skipped
    mkdirSync(join(claudeCode, "scratch"));
    // A non-directory file at the tool level should be ignored
    writeFileSync(join(claudeCode, "NOTES.md"), "notes");
  });

  it("yields every folder under content/<tool>/ that contains an index.mdx", () => {
    const folders = Array.from(walkContent(root)).sort();
    expect(folders).toHaveLength(2);
    expect(folders[0]).toMatch(/day-01-install$/);
    expect(folders[1]).toMatch(/day-02-claude-md$/);
  });

  it("yields an empty iterator when content/ is empty", () => {
    const empty = mkdtempSync(join(tmpdir(), "bwai-walk-empty-"));
    const folders = Array.from(walkContent(empty));
    expect(folders).toEqual([]);
  });
});
