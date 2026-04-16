import { describe, it, expect } from "vitest";
import { FrontmatterSchema, RegistrySchema } from "../../schema/entry";
import { SkillCompatibilitySchema, SkillSpecSchema } from "../../schema/skill";
import { ImportManifestSchema, PublisherSchema } from "../../schema/publisher";

describe("FrontmatterSchema", () => {
  const validFrontmatter = {
    title: "Set up your first CLAUDE.md",
    slug: "day-02-claude-md-basics",
    tool: "claude-code",
    track: "fundamentals",
    category: "configuration",
    difficulty: "beginner",
    last_verified: "2026-04-10",
    contributors: ["@sragav"],
  };

  it("accepts minimal valid frontmatter", () => {
    const result = FrontmatterSchema.safeParse(validFrontmatter);
    expect(result.success).toBe(true);
  });

  it("accepts full frontmatter with all optional fields", () => {
    const full = {
      ...validFrontmatter,
      day: 2,
      tags: ["claude-md", "setup"],
      time_required: "10 min",
      artifact_type: "claude-md",
      has_war_story: true,
      contributors: ["@sragav"],
      source_links: [{ label: "Docs", url: "https://example.com" }],
      publisher: "acme-labs",
      provenance_repo: "acme-labs/cables",
      provenance_ref: "0123456789abcdef0123456789abcdef01234567",
    };
    const result = FrontmatterSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("rejects frontmatter missing title", () => {
    const { title, ...missingTitle } = validFrontmatter;
    const result = FrontmatterSchema.safeParse(missingTitle);
    expect(result.success).toBe(false);
  });

  it("rejects frontmatter missing contributors", () => {
    const { contributors, ...missing } = validFrontmatter;
    const result = FrontmatterSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it("accepts frontmatter with a non-empty contributors array", () => {
    const ok = { ...validFrontmatter, contributors: ["@sragav"] };
    const result = FrontmatterSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it("rejects frontmatter with an empty contributors array", () => {
    const bad = { ...validFrontmatter, contributors: [] };
    const result = FrontmatterSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    const bad = { ...validFrontmatter, difficulty: "expert" };
    const result = FrontmatterSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid last_verified format", () => {
    const bad = { ...validFrontmatter, last_verified: "April 10, 2026" };
    const result = FrontmatterSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid artifact_type enum value", () => {
    const bad = { ...validFrontmatter, artifact_type: "hook" };
    const result = FrontmatterSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts null artifact_type", () => {
    const ok = { ...validFrontmatter, artifact_type: null };
    const result = FrontmatterSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it("rejects invalid provenance_repo format", () => {
    const bad = { ...validFrontmatter, provenance_repo: "https://github.com/acme-labs/cables" };
    const result = FrontmatterSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid provenance_ref format", () => {
    const bad = { ...validFrontmatter, provenance_ref: "main" };
    const result = FrontmatterSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("SkillSpecSchema", () => {
  const validSkillSpec = {
    slug: "sample-skill",
    canonical_name: "Sample Skill",
    summary: "A sample skill used for testing schema validation.",
    capability_cluster: "workflow-automation",
    maturity: "stable",
    owner: "@frenxt",
    version: "1.0.0",
    inputs: [],
    outputs: [],
    dependencies: {
      env_vars: [],
      binaries: [],
      services: [],
      plugins: [],
    },
    workflow_steps: ["Run command A", "Verify output B"],
    verification: {
      smoke_test: "echo ok",
      expected_artifacts: [],
    },
  };

  it("accepts valid skill spec", () => {
    const result = SkillSpecSchema.safeParse(validSkillSpec);
    expect(result.success).toBe(true);
  });

  it("rejects invalid capability cluster", () => {
    const bad = { ...validSkillSpec, capability_cluster: "unknown-cluster" };
    const result = SkillSpecSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("SkillCompatibilitySchema", () => {
  const validCompatibility = {
    slug: "sample-skill",
    owner: "@frenxt",
    reviewed_at: "2026-04-16",
    tier: "core",
    quality_score: 84,
    matrix: {
      "claude-code": {
        status: "pass",
        adapter_version: "cli-0.1.5",
        verified_on: "2026-04-16",
        plugin_equivalents: [],
        skill_fallbacks: [],
        blockers: [],
      },
      codex: {
        status: "partial",
        adapter_version: "cli-0.1.5",
        verified_on: "2026-04-16",
        plugin_equivalents: [],
        skill_fallbacks: ["cmd-sample-skill"],
        blockers: [],
      },
    },
  };

  it("accepts valid compatibility manifest", () => {
    const result = SkillCompatibilitySchema.safeParse(validCompatibility);
    expect(result.success).toBe(true);
  });

  it("rejects matrix where both tools are fail", () => {
    const bad = {
      ...validCompatibility,
      matrix: {
        "claude-code": { ...validCompatibility.matrix["claude-code"], status: "fail" },
        codex: { ...validCompatibility.matrix.codex, status: "fail" },
      },
    };
    const result = SkillCompatibilitySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("RegistrySchema", () => {
  const validRegistry = {
    slug: "day-02-claude-md-basics",
    artifact_type: "claude-md",
    version: "1.0.0",
    requires: [],
    files: [
      {
        source: "artifact/CLAUDE.md",
        target: "CLAUDE.md",
        action: "copy",
        on_conflict: "prompt",
      },
    ],
  };

  it("accepts minimal valid registry", () => {
    const result = RegistrySchema.safeParse(validRegistry);
    expect(result.success).toBe(true);
  });

  it("accepts registry with post_install_notes and requires", () => {
    const full = {
      ...validRegistry,
      requires: ["BROWSER_USE_API_KEY"],
      post_install_notes: "Set the API key in your .env file.",
    };
    const result = RegistrySchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("rejects registry with invalid artifact_type", () => {
    const bad = { ...validRegistry, artifact_type: "hook" };
    const result = RegistrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects registry with invalid semver version", () => {
    const bad = { ...validRegistry, version: "1.0" };
    const result = RegistrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects registry files with invalid on_conflict value", () => {
    const bad = {
      ...validRegistry,
      files: [{ ...validRegistry.files[0], on_conflict: "merge" }],
    };
    const result = RegistrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects empty files array", () => {
    const bad = { ...validRegistry, files: [] };
    const result = RegistrySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("PublisherSchema", () => {
  const validPublisher = {
    id: "acme-labs",
    name: "Acme Labs",
    repo: "acme-labs/cables",
    default_branch: "main",
    status: "active",
    tier: "reviewed",
    contacts: {
      github: "@acme",
      email: "oss@acme.dev",
    },
  };

  it("accepts a valid publisher manifest", () => {
    const result = PublisherSchema.safeParse(validPublisher);
    expect(result.success).toBe(true);
  });

  it("rejects publisher contacts without github/email", () => {
    const bad = { ...validPublisher, contacts: {} };
    const result = PublisherSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe("ImportManifestSchema", () => {
  const validImportManifest = {
    publisher_id: "acme-labs",
    slug: "multi-agent-release-gate",
    tool: "claude-code",
    source: {
      repo: "acme-labs/cables",
      ref: "9f1c4d7c0f97f58b4aa8a0f53f2f9c7d4c12ab99",
      path: "content/claude-code/multi-agent-release-gate",
    },
  };

  it("accepts a valid import manifest", () => {
    const result = ImportManifestSchema.safeParse(validImportManifest);
    expect(result.success).toBe(true);
  });

  it("rejects non-SHA source ref", () => {
    const bad = {
      ...validImportManifest,
      source: { ...validImportManifest.source, ref: "main" },
    };
    const result = ImportManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects invalid source path shape", () => {
    const bad = {
      ...validImportManifest,
      source: { ...validImportManifest.source, path: "docs/multi-agent-release-gate" },
    };
    const result = ImportManifestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});
