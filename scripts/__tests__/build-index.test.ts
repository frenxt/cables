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
      "valid-entry-skill-with-compat",
    ]);
    const indexPath = join(contentRoot, "index.json");
    buildIndex(contentRoot, indexPath);
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    expect(index).toHaveProperty("generated_at");
    expect(index).toHaveProperty("entries");
    expect(index.entries).toHaveLength(3);
    const slugs = index.entries.map((e: { slug: string }) => e.slug).sort();
    expect(slugs).toEqual([
      "valid-entry-no-artifact",
      "valid-entry-skill-with-compat",
      "valid-entry-with-artifact",
    ]);
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
    expect(entry.publisher).toBeNull();
    expect(entry.provenance_repo).toBeNull();
    expect(entry.provenance_ref).toBeNull();
    expect(entry.skill_capability_cluster).toBeNull();
    expect(entry.compatibility_tier).toBeNull();
    expect(entry.compatibility_rank).toBeNull();
    expect(entry.path).toBe("content/claude-code/valid-entry-with-artifact");
  });

  it("indexes skill compatibility fields when manifests exist", () => {
    const contentRoot = makeTempContent(["valid-entry-skill-with-compat"]);
    const indexPath = join(contentRoot, "index.json");
    buildIndex(contentRoot, indexPath);
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    const entry = index.entries[0];
    expect(entry.slug).toBe("valid-entry-skill-with-compat");
    expect(entry.artifact_type).toBe("skill");
    expect(entry.skill_capability_cluster).toBe("workflow-automation");
    expect(entry.skill_maturity).toBe("stable");
    expect(entry.compatibility_tier).toBe("core");
    expect(entry.compatibility_quality_score).toBe(90);
    expect(entry.compatibility_claude_status).toBe("pass");
    expect(entry.compatibility_codex_status).toBe("partial");
    expect(entry.compatibility_reviewed_at).toBe("2026-04-16");
    expect(entry.compatibility_rank).toBe(1);
  });

  it("throws when any entry is invalid", () => {
    const contentRoot = makeTempContent(["invalid-entry-bad-frontmatter"]);
    const indexPath = join(contentRoot, "index.json");
    expect(() => buildIndex(contentRoot, indexPath)).toThrow(/validation/i);
  });
});
