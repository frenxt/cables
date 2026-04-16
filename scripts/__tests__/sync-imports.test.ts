import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import { syncImports } from "../lib/sync-imports";
import { validateAll } from "../validate";

function makeTempRepoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "cables-imports-"));
  mkdirSync(join(root, "content"), { recursive: true });
  mkdirSync(join(root, "publishers"), { recursive: true });
  mkdirSync(join(root, "imports"), { recursive: true });
  return root;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function makeMockFetch(files: Record<string, string>): (url: string) => Promise<string> {
  return async (url: string) => {
    if (Object.prototype.hasOwnProperty.call(files, url)) {
      return files[url];
    }
    throw new Error(`HTTP 404 fetching ${url}`);
  };
}

describe("syncImports", () => {
  it("materializes a tutorial import and injects provenance frontmatter", async () => {
    const repoRoot = makeTempRepoRoot();

    writeJson(join(repoRoot, "publishers", "acme-labs.json"), {
      id: "acme-labs",
      name: "Acme Labs",
      repo: "acme-labs/cables",
      default_branch: "main",
      status: "active",
      tier: "reviewed",
      contacts: { github: "@acme" },
    });
    writeJson(join(repoRoot, "imports", "acme-labs", "release-gate.json"), {
      publisher_id: "acme-labs",
      slug: "release-gate",
      tool: "claude-code",
      source: {
        repo: "acme-labs/cables",
        ref: "1111111111111111111111111111111111111111",
        path: "content/claude-code/release-gate",
      },
    });

    const base =
      "https://raw.githubusercontent.com/acme-labs/cables/1111111111111111111111111111111111111111/content/claude-code/release-gate";
    const fetchText = makeMockFetch({
      [`${base}/index.mdx`]: `---
title: "Release gate checklist"
slug: "release-gate"
tool: "claude-code"
track: "fundamentals"
category: "workflow"
difficulty: "beginner"
last_verified: "2026-04-16"
contributors: ["@acme"]
---

# Release gate checklist

Field note.
`,
    });

    const result = await syncImports({ repoRoot, fetchText });
    expect(result.importsProcessed).toBe(1);
    expect(result.filesWritten).toBe(1);

    const generatedPath = join(repoRoot, "content", "claude-code", "release-gate", "index.mdx");
    expect(existsSync(generatedPath)).toBe(true);
    const parsed = matter(readFileSync(generatedPath, "utf8"));
    expect(parsed.data.publisher).toBe("acme-labs");
    expect(parsed.data.provenance_repo).toBe("acme-labs/cables");
    expect(parsed.data.provenance_ref).toBe("1111111111111111111111111111111111111111");
  });

  it("materializes skill imports with registry and compatibility metadata", async () => {
    const repoRoot = makeTempRepoRoot();

    writeJson(join(repoRoot, "publishers", "acme-labs.json"), {
      id: "acme-labs",
      name: "Acme Labs",
      repo: "acme-labs/cables",
      default_branch: "main",
      status: "active",
      tier: "reviewed",
      contacts: { github: "@acme" },
    });
    writeJson(join(repoRoot, "imports", "acme-labs", "ops-skill.json"), {
      publisher_id: "acme-labs",
      slug: "ops-skill",
      tool: "claude-code",
      source: {
        repo: "acme-labs/cables",
        ref: "2222222222222222222222222222222222222222",
        path: "content/claude-code/ops-skill",
      },
    });

    const base =
      "https://raw.githubusercontent.com/acme-labs/cables/2222222222222222222222222222222222222222/content/claude-code/ops-skill";
    const fetchText = makeMockFetch({
      [`${base}/index.mdx`]: `---
title: "Ops Skill"
slug: "ops-skill"
tool: "claude-code"
track: "fundamentals"
category: "workflow"
difficulty: "intermediate"
last_verified: "2026-04-16"
contributors: ["@acme"]
artifact_type: "skill"
---

# Ops Skill

Skill notes.
`,
      [`${base}/registry.json`]: `{
  "slug": "ops-skill",
  "artifact_type": "skill",
  "version": "1.0.0",
  "requires": [],
  "files": [
    { "source": "artifact/SKILL.md", "target": ".claude/skills/ops-skill/SKILL.md", "action": "copy", "on_conflict": "prompt" }
  ]
}
`,
      [`${base}/artifact/SKILL.md`]: "# Ops skill\n",
      [`${base}/skill.spec.json`]: `{
  "slug": "ops-skill",
  "canonical_name": "Ops Skill",
  "summary": "Workflow helper",
  "capability_cluster": "workflow-automation",
  "maturity": "stable",
  "owner": "@acme",
  "version": "1.0.0",
  "inputs": [],
  "outputs": [],
  "dependencies": { "env_vars": [], "binaries": [], "services": [], "plugins": [] },
  "workflow_steps": ["Run validation"],
  "verification": { "smoke_test": "echo ok", "expected_artifacts": [] }
}
`,
      [`${base}/compatibility.json`]: `{
  "slug": "ops-skill",
  "owner": "@acme",
  "reviewed_at": "2026-04-16",
  "tier": "core",
  "quality_score": 88,
  "matrix": {
    "claude-code": { "status": "pass", "adapter_version": "cli-0.2.0", "verified_on": "2026-04-16", "plugin_equivalents": [], "skill_fallbacks": [], "blockers": [] },
    "codex": { "status": "partial", "adapter_version": "cli-0.2.0", "verified_on": "2026-04-16", "plugin_equivalents": [], "skill_fallbacks": [], "blockers": [] }
  }
}
`,
    });

    const result = await syncImports({ repoRoot, fetchText });
    expect(result.importsProcessed).toBe(1);
    expect(result.filesWritten).toBe(5);

    const contentRoot = join(repoRoot, "content");
    const validation = validateAll(contentRoot);
    expect(validation.errors).toHaveLength(0);
    expect(validation.entries).toHaveLength(1);
    expect(validation.entries[0].frontmatter.publisher).toBe("acme-labs");
  });

  it("rejects imports from suspended publishers", async () => {
    const repoRoot = makeTempRepoRoot();

    writeJson(join(repoRoot, "publishers", "acme-labs.json"), {
      id: "acme-labs",
      name: "Acme Labs",
      repo: "acme-labs/cables",
      default_branch: "main",
      status: "suspended",
      tier: "reviewed",
      contacts: { github: "@acme" },
    });
    writeJson(join(repoRoot, "imports", "acme-labs", "release-gate.json"), {
      publisher_id: "acme-labs",
      slug: "release-gate",
      tool: "claude-code",
      source: {
        repo: "acme-labs/cables",
        ref: "3333333333333333333333333333333333333333",
        path: "content/claude-code/release-gate",
      },
    });

    await expect(
      syncImports({
        repoRoot,
        fetchText: makeMockFetch({}),
      })
    ).rejects.toThrow(/suspended/i);
  });
});
