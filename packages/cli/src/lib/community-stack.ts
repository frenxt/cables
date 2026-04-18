import { z } from "zod";

// Mirror of /schema/community-stack.ts — duplicated here so the CLI bundle is
// self-contained on npm. Keep these in sync.

const SemverRegex = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const KebabRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IsoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const PluginRefRegex = /^[a-z0-9][a-z0-9-]*@[a-z0-9][a-z0-9-]*$/;
const SkillSlugRegex = /^[a-z0-9][a-z0-9-]*$/;

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
// trusted name. Enforced by schema superRefine below.
const RESERVED_MARKETPLACE_NAMES = new Set([
  "claude-plugins-official",
  "openai-curated",
]);

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
  name: z.string().regex(KebabRegex),
  source: z.string().url().refine((s) => s.startsWith("https://"), {
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
    last_verified: z.string().regex(IsoDateRegex, "last_verified must be YYYY-MM-DD"),
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
    const forbiddenPatterns = [
      /\bbash\s+-c\b/,
      /\bcurl\b[^\n]*\|\s*bash\b/,
      /\bcurl\b[^\n]*\|\s*sh\b/,
      /\bwget\b[^\n]*\|\s*bash\b/,
      /\beval\s*\(/,
    ];
    for (const re of forbiddenPatterns) {
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
export type CommunityStackMarketplace = z.infer<typeof CommunityStackMarketplaceSchema>;

// ─── Security checks beyond schema validation ─────────────────────────────

const TRUSTED_MARKETPLACES = new Set<string>([
  "claude-plugins-official",
  "openai-curated",
]);

// Popular plugin names (per marketplace) for typo-squat detection.
const POPULAR_PLUGINS_BY_MARKETPLACE: Record<string, string[]> = {
  "claude-plugins-official": [
    "superpowers",
    "code-review",
    "frontend-design",
    "feature-dev",
    "code-simplifier",
    "claude-md-management",
    "claude-code-setup",
    "linear",
    "sentry",
    "skill-creator",
    "vercel",
    "netlify-skills",
    "posthog",
    "commit-commands",
    "github",
    "security-guidance",
  ],
  "openai-curated": ["build-web-apps", "github", "vercel"],
};

export interface SecurityFinding {
  level: "reject" | "review" | "warn";
  code: string;
  message: string;
}

export function runSecurityChecks(stack: CommunityStack): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // 1. last_verified freshness — reject if older than 90 days from today.
  const today = new Date();
  const lastVerified = new Date(stack.last_verified);
  const ageDays = Math.floor(
    (today.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (ageDays > 90) {
    findings.push({
      level: "reject",
      code: "stale_verification",
      message: `last_verified is ${ageDays} days old (max 90). Re-verify and update the date.`,
    });
  }

  // 2. Every plugin's marketplace must be trusted OR declared in marketplaces[].
  const declaredMarketplaces = new Set(
    (stack.marketplaces ?? []).map((m) => m.name)
  );
  const pluginRefs = [
    ...(stack.claude_plugins ?? []),
    ...(stack.codex_plugins ?? []),
  ];
  for (const ref of pluginRefs) {
    const marketplace = ref.split("@")[1];
    if (!marketplace) continue;
    if (TRUSTED_MARKETPLACES.has(marketplace)) continue;
    if (!declaredMarketplaces.has(marketplace)) {
      findings.push({
        level: "reject",
        code: "undeclared_marketplace",
        message: `plugin "${ref}" references marketplace "${marketplace}" which is not trusted and not declared in marketplaces[].`,
      });
    }
  }

  // 3. Non-trusted marketplaces must be author-owned OR flagged for human review.
  for (const m of stack.marketplaces ?? []) {
    if (TRUSTED_MARKETPLACES.has(m.name)) continue;
    const authorRepoPrefix = `https://github.com/${stack.author.github}/`;
    if (!m.source.startsWith(authorRepoPrefix)) {
      findings.push({
        level: "review",
        code: "external_marketplace",
        message: `marketplace "${m.name}" source (${m.source}) is not owned by the author (${stack.author.github}) — human review required.`,
      });
    }
  }

  // 4. Typo-squat — each plugin name in a trusted marketplace must match a known
  //    plugin exactly; close but non-exact matches are flagged.
  for (const ref of pluginRefs) {
    const [name, marketplace] = ref.split("@");
    const popular = POPULAR_PLUGINS_BY_MARKETPLACE[marketplace];
    if (!popular) continue;
    if (popular.includes(name)) continue;
    const nearest = popular
      .map((p) => ({ p, d: levenshtein(name, p) }))
      .sort((a, b) => a.d - b.d)[0];
    if (nearest && nearest.d > 0 && nearest.d <= 2) {
      findings.push({
        level: "review",
        code: "typo_squat_suspicion",
        message: `plugin "${name}" is edit-distance ${nearest.d} from known plugin "${nearest.p}" in ${marketplace} — possible typo-squat. Human review required.`,
      });
    }
  }

  // 5. Soft warn: no plugins AND no skills declared.
  const totalItems =
    (stack.claude_plugins?.length ?? 0) +
    (stack.codex_plugins?.length ?? 0) +
    (stack.skills?.length ?? 0);
  if (totalItems === 0) {
    findings.push({
      level: "warn",
      code: "empty_stack",
      message: "stack declares no plugins or skills — nothing would be installed.",
    });
  }

  return findings;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
