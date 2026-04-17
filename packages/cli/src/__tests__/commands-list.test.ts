import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runList } from "../commands/list";
import { LocalResolver } from "../lib/resolver/local";

const here = dirname(fileURLToPath(import.meta.url));
const fakeRoot = resolve(here, "../../__fixtures__/fake-cables-root");

describe("runList", () => {
  const resolver = new LocalResolver(fakeRoot);

  it("returns a multi-line string listing all cables", async () => {
    const output = await runList(resolver, {});
    expect(output).toContain("sample-tutorial");
    expect(output).toContain("sample-with-artifact");
  });

  it("filters by category when --category is provided", async () => {
    const output = await runList(resolver, { category: "configuration" });
    expect(output).toContain("sample-with-artifact");
    expect(output).not.toContain("sample-tutorial");
  });

  it("filters by difficulty", async () => {
    const output = await runList(resolver, { difficulty: "beginner" });
    expect(output).toContain("sample-tutorial");
    expect(output).toContain("sample-with-artifact");
  });

  it("filters by artifact_type", async () => {
    const output = await runList(resolver, { artifactType: "claude-md" });
    expect(output).toContain("sample-with-artifact");
    expect(output).not.toContain("sample-tutorial");
  });

  it("filters by publisher", async () => {
    const output = await runList(resolver, { publisher: "acme-labs" });
    expect(output).toContain("sample-with-artifact");
    expect(output).not.toContain("sample-tutorial");
  });

  it("returns empty-state message when no entries match", async () => {
    const output = await runList(resolver, { category: "nonexistent" });
    expect(output.toLowerCase()).toContain("no cables");
  });
});
