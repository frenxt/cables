import { z } from "zod";

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "slug must be kebab-case");

export const CapabilityClusterSchema = z.enum([
  "workflow-automation",
  "qa-testing",
  "debugging-observability",
  "performance-optimization",
  "content-ops",
  "developer-productivity",
]);

export const SkillMaturitySchema = z.enum(["stable", "beta", "experimental"]);

export const SkillInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "path", "url", "enum"]),
  required: z.boolean(),
  description: z.string().min(1),
});

export const SkillOutputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "file", "command-plan", "report", "patch"]),
  description: z.string().min(1),
});

export const SkillDependencySchema = z.object({
  env_vars: z.array(z.string()).default([]),
  binaries: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  plugins: z.array(z.string()).default([]),
});

export const SkillVerificationSchema = z.object({
  smoke_test: z.string().min(1),
  expected_artifacts: z.array(z.string()).default([]),
});

export const SkillSpecSchema = z.object({
  slug: SlugSchema,
  canonical_name: z.string().min(1),
  summary: z.string().min(1),
  capability_cluster: CapabilityClusterSchema,
  maturity: SkillMaturitySchema,
  owner: z.string().min(1),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "version must be semver (e.g. 1.0.0)"),
  inputs: z.array(SkillInputSchema).default([]),
  outputs: z.array(SkillOutputSchema).default([]),
  dependencies: SkillDependencySchema.default({
    env_vars: [],
    binaries: [],
    services: [],
    plugins: [],
  }),
  workflow_steps: z.array(z.string().min(1)).min(1),
  verification: SkillVerificationSchema,
});

export type SkillSpec = z.infer<typeof SkillSpecSchema>;

export const CompatibilityStatusSchema = z.enum(["pass", "partial", "fail"]);

export const ToolCompatibilitySchema = z.object({
  status: CompatibilityStatusSchema,
  adapter_version: z.string().min(1),
  verified_on: DateSchema,
  plugin_equivalents: z.array(z.string()).default([]),
  skill_fallbacks: z.array(z.string()).default([]),
  notes: z.string().optional(),
  blockers: z.array(z.string()).default([]),
});

export const SkillCompatibilitySchema = z
  .object({
    slug: SlugSchema,
    owner: z.string().min(1),
    reviewed_at: DateSchema,
    tier: z.enum(["core", "extended", "experimental"]),
    quality_score: z.number().min(0).max(100).optional(),
    matrix: z.object({
      "claude-code": ToolCompatibilitySchema,
      codex: ToolCompatibilitySchema,
    }),
  })
  .superRefine((value, ctx) => {
    const claudeStatus = value.matrix["claude-code"].status;
    const codexStatus = value.matrix.codex.status;
    if (claudeStatus === "fail" && codexStatus === "fail") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matrix"],
        message:
          "at least one tool must be pass/partial; cannot mark both claude-code and codex as fail",
      });
    }
  });

export type SkillCompatibility = z.infer<typeof SkillCompatibilitySchema>;
