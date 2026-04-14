import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runSearch } from "../commands/search";
import { LocalResolver } from "../lib/resolver/local";

const here = dirname(fileURLToPath(import.meta.url));
const fakeRoot = resolve(here, "../../__fixtures__/fake-cables-root");

describe("runSearch", () => {
  const resolver = new LocalResolver(fakeRoot);

  it("matches on title (case-insensitive)", async () => {
    const output = await runSearch(resolver, "TUTORIAL");
    expect(output).toContain("sample-tutorial");
  });

  it("matches on slug", async () => {
    const output = await runSearch(resolver, "artifact");
    expect(output).toContain("sample-with-artifact");
  });

  it("matches on tag", async () => {
    const output = await runSearch(resolver, "claude-md");
    expect(output).toContain("sample-with-artifact");
  });

  it("returns empty-state when no cables match", async () => {
    const output = await runSearch(resolver, "nothing-matches-this");
    expect(output.toLowerCase()).toContain("no cables");
  });
});
