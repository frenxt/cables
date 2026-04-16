import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../cli";

describe("CLI convert command", () => {
  let sourceRoot: string;
  let codexRoot: string;
  let roundtripRoot: string;

  beforeEach(() => {
    sourceRoot = mkdtempSync(join(tmpdir(), "frenxt-cli-convert-src-"));
    codexRoot = mkdtempSync(join(tmpdir(), "frenxt-cli-convert-codex-"));
    roundtripRoot = mkdtempSync(join(tmpdir(), "frenxt-cli-convert-rt-"));
    mkdirSync(join(sourceRoot, ".claude", "skills", "qa", "scripts"), { recursive: true });
    writeFileSync(
      join(sourceRoot, ".claude", "skills", "qa", "SKILL.md"),
      "# QA\nUse CLAUDE.md.\n"
    );
    writeFileSync(
      join(sourceRoot, ".claude", "skills", "qa", "scripts", "run.sh"),
      "#!/usr/bin/env bash\ncat CLAUDE.md\n"
    );
    mkdirSync(join(sourceRoot, ".claude", "commands"), { recursive: true });
    writeFileSync(join(sourceRoot, ".claude", "commands", "audit.md"), "Audit this repo.\n");
  });

  it("runs convert claude-to-codex and codex-to-claude through CLI parsing", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await run([
        "node",
        "frenxt",
        "convert",
        "claude-to-codex",
        "--source",
        sourceRoot,
        "--target",
        codexRoot,
      ]);
      expect(existsSync(join(codexRoot, ".agents", "skills", "cmd-audit", "SKILL.md"))).toBe(true);
      expect(existsSync(join(codexRoot, ".agents", "skills", "qa", "scripts", "run.sh"))).toBe(true);

      await run([
        "node",
        "frenxt",
        "convert",
        "codex-to-claude",
        "--source",
        codexRoot,
        "--target",
        roundtripRoot,
      ]);
      expect(existsSync(join(roundtripRoot, ".claude", "commands", "audit.md"))).toBe(true);
      expect(existsSync(join(roundtripRoot, ".claude", "skills", "qa", "scripts", "run.sh"))).toBe(true);
    } finally {
      logSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
