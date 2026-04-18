import { z } from "zod";

const SemverRegex = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const KebabRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IsoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const CommunityStackPurposeSchema = z.enum([
  "fullstack-development",
  "ai-agent-development",
  "ux-design",
  "qa-release",
  "marketing-growth",
  "meta",
  "other",
]);

export const CommunityStackMarketplaceSchema = z.object({
  name: z.string().regex(KebabRegex, "marketplace name must be kebab-case"),
  source: z
    .string()
    .url()
    .refine((s) => s.startsWith("https://"), {
      message: "marketplace source must use https://",
    }),
});

export const CommunityStackAuthorSchema = z.object({
  github: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/, "invalid GitHub username"),
  url: z.string().url().optional(),
});

const PluginRefRegex = /^[a-z0-9][a-z0-9-]*@[a-z0-9][a-z0-9-]*$/;
const SkillSlugRegex = /^[a-z0-9][a-z0-9-]*$/;

// Forbidden field names — no shell-adjacent anything.
const ForbiddenKeys = new Set([
  "exec",
  "post_install_exec",
  "postInstallExec",
  "scripts",
  "script",
  "commands",
  "run",
  "shell",
]);

// Trusted marketplaces are pre-registered with Claude/Codex and MUST NOT be
// declared in a stack's `marketplaces[]` — doing so would let an attacker
// supply a malicious source URL that the CLI would then register under a
// trusted name.
const RESERVED_MARKETPLACE_NAMES = new Set([
  "claude-plugins-official",
  "openai-curated",
]);

export const CommunityStackSchema = z
  .object({
    $schema: z.string().optional(),
    schema_version: z.literal(1),
    slug: z.string().regex(KebabRegex, "slug must be kebab-case"),
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(400),
    purpose: CommunityStackPurposeSchema,
    author: CommunityStackAuthorSchema,
    version: z.string().regex(SemverRegex, "version must be semver"),
    last_verified: z
      .string()
      .regex(IsoDateRegex, "last_verified must be YYYY-MM-DD"),
    marketplaces: z.array(CommunityStackMarketplaceSchema).optional(),
    claude_plugins: z
      .array(z.string().regex(PluginRefRegex, "expected name@marketplace"))
      .optional(),
    codex_plugins: z
      .array(z.string().regex(PluginRefRegex, "expected name@marketplace"))
      .optional(),
    skills: z
      .array(z.string().regex(SkillSlugRegex, "skill slug must be kebab-case"))
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    for (const key of Object.keys(val)) {
      if (ForbiddenKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `forbidden field "${key}" — community stacks cannot declare shell execution`,
          path: [key],
        });
      }
    }
    for (const [i, m] of (val.marketplaces ?? []).entries()) {
      if (RESERVED_MARKETPLACE_NAMES.has(m.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `marketplace "${m.name}" is reserved for the official registry and cannot be declared in marketplaces[]`,
          path: ["marketplaces", i, "name"],
        });
      }
    }
    const raw = JSON.stringify(val);
    const forbiddenSubstrings = [
      /\bbash\s+-c\b/,
      /\bcurl\b.*\|\s*bash\b/,
      /\bcurl\b.*\|\s*sh\b/,
      /\bwget\b.*\|\s*bash\b/,
      /\beval\s*\(/,
    ];
    for (const re of forbiddenSubstrings) {
      if (re.test(raw)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `forbidden shell-execution pattern matched: ${re.source}`,
          path: [],
        });
      }
    }
  });

export type CommunityStack = z.infer<typeof CommunityStackSchema>;
export type CommunityStackMarketplace = z.infer<
  typeof CommunityStackMarketplaceSchema
>;
