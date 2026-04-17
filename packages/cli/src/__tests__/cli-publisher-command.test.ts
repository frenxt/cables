import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chdir, cwd } from "node:process";
import { execFileSync } from "node:child_process";
import { run } from "../cli";

describe("CLI publisher command", () => {
  let sourceRoot: string;
  let registryRoot: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = cwd();
    sourceRoot = mkdtempSync(join(tmpdir(), "frenxt-cli-publisher-src-"));
    registryRoot = mkdtempSync(join(tmpdir(), "frenxt-cli-publisher-reg-"));

    mkdirSync(join(sourceRoot, "content", "claude-code", "release-gate", "artifact"), {
      recursive: true,
    });
    writeFileSync(
      join(sourceRoot, "content", "claude-code", "release-gate", "index.mdx"),
      `---
title: "Release gate checklist"
slug: "release-gate"
tool: "claude-code"
track: "fundamentals"
category: "workflow"
difficulty: "beginner"
last_verified: "2026-04-17"
contributors: ["@acme"]
artifact_type: "subagent"
---

# Release gate checklist

Field note.
`,
      "utf8"
    );
    writeFileSync(
      join(sourceRoot, "content", "claude-code", "release-gate", "registry.json"),
      `{
  "slug": "release-gate",
  "artifact_type": "subagent",
  "version": "1.0.0",
  "requires": [],
  "files": [
    { "source": "artifact/reviewer.md", "target": ".claude/agents/reviewer.md", "action": "copy", "on_conflict": "prompt" }
  ]
}
`,
      "utf8"
    );
    writeFileSync(
      join(sourceRoot, "content", "claude-code", "release-gate", "artifact", "reviewer.md"),
      "# reviewer\n",
      "utf8"
    );

    execFileSync("git", ["init", "-q"], { cwd: sourceRoot });
    execFileSync("git", ["config", "user.name", "tester"], { cwd: sourceRoot });
    execFileSync("git", ["config", "user.email", "tester@example.com"], { cwd: sourceRoot });
    execFileSync("git", ["add", "."], { cwd: sourceRoot });
    execFileSync("git", ["commit", "-qm", "initial source cable"], { cwd: sourceRoot });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:acme-labs/cables.git"], {
      cwd: sourceRoot,
    });

    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: registryRoot });
    execFileSync("git", ["config", "user.name", "tester"], { cwd: registryRoot });
    execFileSync("git", ["config", "user.email", "tester@example.com"], { cwd: registryRoot });
    writeFileSync(join(registryRoot, "README.md"), "# registry\n", "utf8");
    execFileSync("git", ["add", "README.md"], { cwd: registryRoot });
    execFileSync("git", ["commit", "-qm", "init registry"], { cwd: registryRoot });
  });

  afterEach(() => {
    chdir(originalCwd);
  });

  it("runs publisher init, pack, and submit through CLI parsing", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      chdir(sourceRoot);
      await run(["node", "frenxt", "publisher", "init", "--publisher", "acme-labs"]);
      expect(existsSync(join(sourceRoot, ".cables", "publisher.json"))).toBe(true);

      await run(["node", "frenxt", "publisher", "pack", "--tool", "claude-code", "--slug", "release-gate"]);
      expect(logSpy.mock.calls.some((call) => String(call[0]).includes('"publisher_id": "acme-labs"'))).toBe(true);

      await run([
        "node",
        "frenxt",
        "publisher",
        "submit",
        "--tool",
        "claude-code",
        "--slug",
        "release-gate",
        "--registry-root",
        registryRoot,
        "--prepare-commit",
      ]);
      expect(existsSync(join(sourceRoot, ".cables", "submissions", "release-gate", "pr-body.md"))).toBe(true);
      expect(existsSync(join(registryRoot, "imports", "acme-labs", "release-gate.json"))).toBe(true);
      expect(readFileSync(join(registryRoot, "imports", "acme-labs", "release-gate.json"), "utf8")).toContain(
        '"publisher_id": "acme-labs"'
      );
      expect(execFileSync("git", ["branch", "--show-current"], { cwd: registryRoot, encoding: "utf8" }).trim()).toBe(
        "publisher/acme-labs-release-gate"
      );
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
