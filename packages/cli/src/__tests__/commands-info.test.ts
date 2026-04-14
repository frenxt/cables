import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runInfo } from "../commands/info";
import { LocalResolver } from "../lib/resolver/local";

const here = dirname(fileURLToPath(import.meta.url));
const fakeRoot = resolve(here, "../../__fixtures__/fake-cables-root");

describe("runInfo", () => {
  const resolver = new LocalResolver(fakeRoot);

  it("returns metadata for a cable with an artifact", async () => {
    const output = await runInfo(resolver, "sample-with-artifact");
    expect(output).toContain("sample-with-artifact");
    expect(output).toContain("claude-md");
    expect(output).toContain("2026-04-10");
    expect(output).toContain("CLAUDE.md");
  });

  it("returns metadata for a tutorial-only cable", async () => {
    const output = await runInfo(resolver, "sample-tutorial");
    expect(output).toContain("sample-tutorial");
    expect(output.toLowerCase()).toContain("no installable artifact");
  });

  it("throws a clean error when slug is unknown", async () => {
    await expect(runInfo(resolver, "does-not-exist")).rejects.toThrow(/not found/i);
  });
});
