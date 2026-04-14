import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAdd } from "../commands/add";
import { LocalResolver } from "../lib/resolver/local";

const here = dirname(fileURLToPath(import.meta.url));
const fakeRoot = resolve(here, "../../__fixtures__/fake-cables-root");

describe("runAdd (e2e against LocalResolver)", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "frenxt-add-"));
    writeFileSync(join(projectRoot, "CLAUDE.md"), "# pre-existing project marker\n");
  });

  it("installs an artifact into a scratch project", async () => {
    writeFileSync(join(projectRoot, "CLAUDE.md"), "# existing\n");
    const resolver = new LocalResolver(fakeRoot);
    const result = await runAdd(resolver, "sample-with-artifact", {
      projectRoot,
      force: true,
      dryRun: false,
      onConflict: async () => "overwrite",
    });
    expect(result.writtenFiles).toContain("CLAUDE.md");
    expect(existsSync(join(projectRoot, "CLAUDE.md"))).toBe(true);
    expect(readFileSync(join(projectRoot, "CLAUDE.md"), "utf8")).toContain("Sample CLAUDE.md");
  });

  it("dry-run reports what would be written but does not change files", async () => {
    writeFileSync(join(projectRoot, "CLAUDE.md"), "# keep\n");
    const resolver = new LocalResolver(fakeRoot);
    const result = await runAdd(resolver, "sample-with-artifact", {
      projectRoot,
      force: true,
      dryRun: true,
      onConflict: async () => "overwrite",
    });
    expect(result.writtenFiles).toContain("CLAUDE.md");
    expect(readFileSync(join(projectRoot, "CLAUDE.md"), "utf8")).toBe("# keep\n");
  });

  it("throws a clean error when slug is not installable (tutorial-only)", async () => {
    const resolver = new LocalResolver(fakeRoot);
    await expect(
      runAdd(resolver, "sample-tutorial", {
        projectRoot,
        force: true,
        dryRun: false,
        onConflict: async () => "overwrite",
      })
    ).rejects.toThrow(/not installable|no artifact/i);
  });

  it("throws a clean error when slug is not found", async () => {
    const resolver = new LocalResolver(fakeRoot);
    await expect(
      runAdd(resolver, "does-not-exist", {
        projectRoot,
        force: true,
        dryRun: false,
        onConflict: async () => "overwrite",
      })
    ).rejects.toThrow(/not found/i);
  });
});
