import { describe, it, expect } from "vitest";
import { FrontmatterSchema, RegistrySchema } from "../../schema/entry";

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
