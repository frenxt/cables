import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadEntry, EntryLoadError } from "../lib/load-entry";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesRoot = resolve(here, "../__fixtures__");

describe("loadEntry", () => {
  it("loads a valid tutorial-only entry", () => {
    const entry = loadEntry(resolve(fixturesRoot, "valid-entry-no-artifact"));
    expect(entry.frontmatter.slug).toBe("valid-entry-no-artifact");
    expect(entry.frontmatter.title).toBe("A valid tutorial-only entry");
    expect(entry.registry).toBeNull();
    expect(entry.body.trim()).toBe("This is the body of a valid tutorial-only entry.");
  });

  it("loads a valid entry with an artifact and parses registry.json", () => {
    const entry = loadEntry(resolve(fixturesRoot, "valid-entry-with-artifact"));
    expect(entry.frontmatter.slug).toBe("valid-entry-with-artifact");
    expect(entry.registry).not.toBeNull();
    expect(entry.registry?.files).toHaveLength(1);
    expect(entry.registry?.files[0].target).toBe("CLAUDE.md");
  });

  it("throws EntryLoadError when frontmatter is missing required fields", () => {
    expect(() =>
      loadEntry(resolve(fixturesRoot, "invalid-entry-bad-frontmatter"))
    ).toThrow(EntryLoadError);
  });

  it("throws EntryLoadError when slug does not match folder name", () => {
    expect(() =>
      loadEntry(resolve(fixturesRoot, "invalid-entry-slug-mismatch"))
    ).toThrow(/slug.*must match folder name/i);
  });

  it("throws EntryLoadError when artifact_type is set but artifact/ is missing", () => {
    expect(() =>
      loadEntry(resolve(fixturesRoot, "invalid-entry-missing-artifact-dir"))
    ).toThrow(/artifact.*directory/i);
  });

  it("throws EntryLoadError when the folder does not exist", () => {
    expect(() => loadEntry(resolve(fixturesRoot, "does-not-exist"))).toThrow(
      EntryLoadError
    );
  });
});
