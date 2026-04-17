import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  initPublisherConfig,
  loadPublisherConfig,
  normalizeGitHubRepo,
  packPublisherManifest,
  submitPublisherManifest,
  type GitClient,
} from "../lib/publisher";

const fakeGitClient: GitClient = {
  getHeadSha: () => "1111111111111111111111111111111111111111",
  getOriginUrl: () => "git@github.com:acme-labs/cables.git",
};

describe("publisher workflow", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "frenxt-publisher-"));
    mkdirSync(join(repoRoot, "content", "claude-code", "release-gate"), { recursive: true });
    writeFileSync(
      join(repoRoot, "content", "claude-code", "release-gate", "index.mdx"),
      `---
title: "Release gate checklist"
slug: "release-gate"
tool: "claude-code"
track: "fundamentals"
category: "workflow"
difficulty: "beginner"
last_verified: "2026-04-17"
contributors: ["@acme"]
---

# Release gate checklist

Field note.
`,
      "utf8"
    );
  });

  function initRealGitRepo(root: string): void {
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.name", "tester"], { cwd: root });
    execFileSync("git", ["config", "user.email", "tester@example.com"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "initial source cable"], { cwd: root });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:acme-labs/cables.git"], {
      cwd: root,
    });
  }

  it("normalizes common GitHub remote URL formats", () => {
    expect(normalizeGitHubRepo("acme-labs/cables")).toBe("acme-labs/cables");
    expect(normalizeGitHubRepo("git@github.com:acme-labs/cables.git")).toBe("acme-labs/cables");
    expect(normalizeGitHubRepo("https://github.com/acme-labs/cables.git")).toBe("acme-labs/cables");
    expect(normalizeGitHubRepo("https://gitlab.com/acme-labs/cables")).toBeNull();
  });

  it("writes .cables/publisher.json from inferred git metadata", () => {
    const result = initPublisherConfig({
      repoRoot,
      publisherId: "acme-labs",
      gitClient: fakeGitClient,
    });

    expect(existsSync(result.path)).toBe(true);
    expect(result.config.repo).toBe("acme-labs/cables");
    expect(loadPublisherConfig(repoRoot)).toEqual({
      publisher_id: "acme-labs",
      repo: "acme-labs/cables",
      default_branch: "main",
    });
  });

  it("packs a validated cable into an import manifest and can write it to disk", () => {
    initRealGitRepo(repoRoot);
    initPublisherConfig({
      repoRoot,
      publisherId: "acme-labs",
      gitClient: fakeGitClient,
    });

    const result = packPublisherManifest({
      repoRoot,
      slug: "release-gate",
      tool: "claude-code",
      outputPath: "imports/acme-labs/release-gate.json",
      gitClient: fakeGitClient,
    });

    expect(result.manifest).toEqual({
      publisher_id: "acme-labs",
      slug: "release-gate",
      tool: "claude-code",
      source: {
        repo: "acme-labs/cables",
        ref: "1111111111111111111111111111111111111111",
        path: "content/claude-code/release-gate",
      },
    });
    expect(result.outputPath).toBe(join(repoRoot, "imports", "acme-labs", "release-gate.json"));
    expect(readFileSync(result.outputPath!, "utf8")).toBe(result.manifestJson);
  });

  it("stages a manifest and PR body for submission", () => {
    initRealGitRepo(repoRoot);
    initPublisherConfig({
      repoRoot,
      publisherId: "acme-labs",
      gitClient: fakeGitClient,
    });

    const result = submitPublisherManifest({
      repoRoot,
      slug: "release-gate",
      tool: "claude-code",
      gitClient: fakeGitClient,
    });

    expect(result.manifestPath).toBe(
      join(repoRoot, ".cables", "submissions", "release-gate", "imports", "acme-labs", "release-gate.json")
    );
    expect(result.prBodyPath).toBe(
      join(repoRoot, ".cables", "submissions", "release-gate", "pr-body.md")
    );
    expect(existsSync(result.manifestPath)).toBe(true);
    expect(existsSync(result.prBodyPath)).toBe(true);
    expect(result.prBody).toContain("source commit SHA: 1111111111111111111111111111111111111111");
    expect(result.prBody).toContain("imports/acme-labs/release-gate.json");
    expect(readFileSync(result.prBodyPath, "utf8")).toBe(result.prBody);
  });

  it("rejects packing when the source cable has uncommitted changes", () => {
    initRealGitRepo(repoRoot);
    initPublisherConfig({
      repoRoot,
      publisherId: "acme-labs",
    });
    writeFileSync(
      join(repoRoot, "content", "claude-code", "release-gate", "index.mdx"),
      `---
title: "Release gate checklist"
slug: "release-gate"
tool: "claude-code"
track: "fundamentals"
category: "workflow"
difficulty: "beginner"
last_verified: "2026-04-18"
contributors: ["@acme"]
---

# Release gate checklist

Dirty working tree.
`,
      "utf8"
    );

    expect(() =>
      packPublisherManifest({
        repoRoot,
        slug: "release-gate",
        tool: "claude-code",
      })
    ).toThrow(/uncommitted changes/i);
  });
});
