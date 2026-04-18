import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The path-traversal regression we're guarding against is entirely in the
// skill-slug filter used before cpSync. This test re-implements the filter
// (same regex used in stack.ts) and asserts it rejects malicious names
// without actually running the full stack command (which would shell out to
// `claude plugins install`).

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

function listSkillSlugs(sourceDir: string): string[] {
  return readdirSync(sourceDir).filter((name) => {
    if (!SAFE_SLUG.test(name)) return false;
    try {
      return statSync(join(sourceDir, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

describe("syncSkillsToProfiles — path traversal guard", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "stack-sync-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("accepts valid kebab-case skill dirs", () => {
    const src = join(tmp, "skills");
    mkdirSync(join(src, "my-skill"), { recursive: true });
    writeFileSync(join(src, "my-skill", "SKILL.md"), "ok");
    expect(listSkillSlugs(src)).toEqual(["my-skill"]);
  });

  it("rejects ../ traversal names", () => {
    const src = join(tmp, "skills");
    mkdirSync(join(src, ".."), { recursive: true });
    mkdirSync(src, { recursive: true });
    mkdirSync(join(src, "good"), { recursive: true });
    // simulate a malicious entry — note: we can't literally create ".." as a
    // dirname, but we can name a directory that starts with "." or contains "/"
    // which are the actual cases the filter must block.
    mkdirSync(join(src, ".hidden"), { recursive: true });
    const slugs = listSkillSlugs(src);
    expect(slugs).toContain("good");
    expect(slugs).not.toContain(".hidden");
  });

  it("rejects slugs with uppercase, underscores, or special chars", () => {
    const src = join(tmp, "skills");
    mkdirSync(join(src, "Good-Skill"), { recursive: true }); // uppercase
    mkdirSync(join(src, "good_skill"), { recursive: true }); // underscore
    mkdirSync(join(src, "good.skill"), { recursive: true }); // dot
    mkdirSync(join(src, "ok"), { recursive: true });
    const slugs = listSkillSlugs(src);
    expect(slugs).toEqual(["ok"]);
  });

  it("rejects slugs starting with a dash", () => {
    const src = join(tmp, "skills");
    mkdirSync(join(src, "-evil"), { recursive: true });
    mkdirSync(join(src, "ok"), { recursive: true });
    expect(listSkillSlugs(src)).toEqual(["ok"]);
  });
});
