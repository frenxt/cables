import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { LocalResolver } from "../lib/resolver/local";

const here = dirname(fileURLToPath(import.meta.url));
const fakeRoot = resolve(here, "../../__fixtures__/fake-cables-root");

describe("LocalResolver", () => {
  const resolver = new LocalResolver(fakeRoot);

  it("loads the content index", async () => {
    const index = await resolver.getIndex();
    expect(index.entries).toHaveLength(2);
    const slugs = index.entries.map((e) => e.slug).sort();
    expect(slugs).toEqual(["sample-tutorial", "sample-with-artifact"]);
  });

  it("returns null registry for a cable with no artifact", async () => {
    const reg = await resolver.getRegistry("sample-tutorial");
    expect(reg).toBeNull();
  });

  it("returns a registry for a cable with an artifact", async () => {
    const reg = await resolver.getRegistry("sample-with-artifact");
    expect(reg).not.toBeNull();
    expect(reg?.files).toHaveLength(1);
    expect(reg?.files[0].target).toBe("CLAUDE.md");
  });

  it("fetches an artifact file by source path", async () => {
    const content = await resolver.getArtifactFile("sample-with-artifact", "artifact/CLAUDE.md");
    expect(content).toContain("Sample CLAUDE.md");
  });

  it("throws when slug is not in the index", async () => {
    await expect(resolver.getRegistry("does-not-exist")).rejects.toThrow(/not found/i);
  });

  it("describe() returns a human-readable local path", () => {
    expect(resolver.describe()).toContain(fakeRoot);
    expect(resolver.describe().toLowerCase()).toContain("local");
  });
});
