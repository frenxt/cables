import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAll } from "../validate";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = resolve(here, "../__fixtures__");

function makeTempContent(entries: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "bwai-validate-"));
  const toolDir = join(root, "claude-code");
  mkdirSync(toolDir, { recursive: true });
  for (const entry of entries) {
    cpSync(join(fixturesRoot, entry), join(toolDir, entry), { recursive: true });
  }
  return root;
}

describe("validateAll", () => {
  it("returns no errors when all entries are valid", () => {
    const contentRoot = makeTempContent([
      "valid-entry-no-artifact",
      "valid-entry-with-artifact",
    ]);
    const result = validateAll(contentRoot);
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
  });

  it("collects errors from invalid entries without throwing", () => {
    const contentRoot = makeTempContent([
      "valid-entry-no-artifact",
      "invalid-entry-bad-frontmatter",
      "invalid-entry-slug-mismatch",
    ]);
    const result = validateAll(contentRoot);
    expect(result.errors).toHaveLength(2);
    expect(result.entries).toHaveLength(1);
  });

  it("returns no errors and no entries when content/ is empty", () => {
    const root = mkdtempSync(join(tmpdir(), "bwai-validate-empty-"));
    mkdirSync(join(root, "claude-code"), { recursive: true });
    const result = validateAll(root);
    expect(result.errors).toEqual([]);
    expect(result.entries).toEqual([]);
  });
});
