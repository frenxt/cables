import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex } from "../build-index";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = resolve(here, "../__fixtures__");

function makeTempContent(entries: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "bwai-index-"));
  const toolDir = join(root, "claude-code");
  mkdirSync(toolDir, { recursive: true });
  for (const entry of entries) {
    cpSync(join(fixturesRoot, entry), join(toolDir, entry), { recursive: true });
  }
  return root;
}

describe("buildIndex", () => {
  it("writes a content/index.json listing every valid entry", () => {
    const contentRoot = makeTempContent([
      "valid-entry-no-artifact",
      "valid-entry-with-artifact",
    ]);
    const indexPath = join(contentRoot, "index.json");
    buildIndex(contentRoot, indexPath);
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    expect(index).toHaveProperty("generated_at");
    expect(index).toHaveProperty("entries");
    expect(index.entries).toHaveLength(2);
    const slugs = index.entries.map((e: { slug: string }) => e.slug).sort();
    expect(slugs).toEqual(["valid-entry-no-artifact", "valid-entry-with-artifact"]);
  });

  it("each indexed entry exposes title, slug, tool, category, difficulty, artifact_type, path", () => {
    const contentRoot = makeTempContent(["valid-entry-with-artifact"]);
    const indexPath = join(contentRoot, "index.json");
    buildIndex(contentRoot, indexPath);
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    const entry = index.entries[0];
    expect(entry.title).toBe("A valid entry with an artifact");
    expect(entry.slug).toBe("valid-entry-with-artifact");
    expect(entry.tool).toBe("claude-code");
    expect(entry.category).toBe("configuration");
    expect(entry.difficulty).toBe("beginner");
    expect(entry.artifact_type).toBe("claude-md");
    expect(entry.path).toBe("content/claude-code/valid-entry-with-artifact");
  });

  it("throws when any entry is invalid", () => {
    const contentRoot = makeTempContent(["invalid-entry-bad-frontmatter"]);
    const indexPath = join(contentRoot, "index.json");
    expect(() => buildIndex(contentRoot, indexPath)).toThrow(/validation/i);
  });
});
