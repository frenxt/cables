import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCompatibility } from "../build-compatibility";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = resolve(here, "../__fixtures__");

function makeTempContent(entries: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "bwai-compat-"));
  const toolDir = join(root, "claude-code");
  mkdirSync(toolDir, { recursive: true });
  for (const entry of entries) {
    cpSync(join(fixturesRoot, entry), join(toolDir, entry), { recursive: true });
  }
  return root;
}

describe("buildCompatibility", () => {
  it("writes compatibility summary and watchlist", () => {
    const contentRoot = makeTempContent(["valid-entry-no-artifact", "valid-entry-skill-with-compat"]);
    const outputPath = join(contentRoot, "compatibility.json");

    buildCompatibility(contentRoot, outputPath, 50);

    const report = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(report).toHaveProperty("generated_at");
    expect(report.limit).toBe(50);
    expect(report.summary.total_entries).toBe(2);
    expect(report.summary.skill_entries).toBe(1);
    expect(report.summary.dual_pass_count).toBe(0);
    expect(report.top_compatible).toHaveLength(0);
    expect(report.watchlist).toHaveLength(1);
    expect(report.watchlist[0].slug).toBe("valid-entry-skill-with-compat");
    expect(report.watchlist[0].codex_status).toBe("partial");
  });

  it("includes dual-pass skills in top_compatible list", () => {
    const contentRoot = makeTempContent(["valid-entry-skill-with-compat"]);
    const compatPath = join(contentRoot, "claude-code", "valid-entry-skill-with-compat", "compatibility.json");
    const compat = JSON.parse(readFileSync(compatPath, "utf8"));
    compat.matrix.codex.status = "pass";
    compat.quality_score = 93;
    writeFileSync(compatPath, JSON.stringify(compat, null, 2) + "\n", "utf8");

    const outputPath = join(contentRoot, "compatibility.json");
    buildCompatibility(contentRoot, outputPath, 10);

    const report = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(report.summary.dual_pass_count).toBe(1);
    expect(report.top_compatible).toHaveLength(1);
    expect(report.top_compatible[0].slug).toBe("valid-entry-skill-with-compat");
    expect(report.watchlist).toHaveLength(0);
  });

  it("throws when content contains invalid entries", () => {
    const contentRoot = makeTempContent(["invalid-entry-bad-frontmatter"]);
    const outputPath = join(contentRoot, "compatibility.json");
    expect(() => buildCompatibility(contentRoot, outputPath)).toThrow(/validation/i);
  });
});
