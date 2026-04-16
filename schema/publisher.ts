import { z } from "zod";

const KebabCaseRegex = /^[a-z0-9-]+$/;
const GitHubRepoRegex = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const CommitShaRegex = /^[0-9a-f]{40}$/i;

export const PublisherContactSchema = z
  .object({
    github: z
      .string()
      .regex(/^@[A-Za-z0-9_.-]+$/, "contacts.github must start with @")
      .optional(),
    email: z.string().email().optional(),
  })
  .refine((value) => Boolean(value.github || value.email), {
    message: "contacts must include at least one of github or email",
  });

export const PublisherSchema = z.object({
  id: z.string().regex(KebabCaseRegex, "id must be kebab-case"),
  name: z.string().min(1),
  repo: z.string().regex(GitHubRepoRegex, "repo must be in owner/repo format"),
  default_branch: z.string().min(1),
  status: z.enum(["active", "probation", "suspended"]),
  tier: z.enum(["reviewed", "probation"]),
  contacts: PublisherContactSchema,
});

export const ImportSourceSchema = z.object({
  repo: z.string().regex(GitHubRepoRegex, "source.repo must be in owner/repo format"),
  ref: z
    .string()
    .regex(CommitShaRegex, "source.ref must be a full 40-char commit SHA"),
  path: z
    .string()
    .regex(/^content\/[a-z0-9-]+\/[a-z0-9-]+$/, "source.path must be content/<tool>/<slug>"),
});

export const ImportManifestSchema = z.object({
  publisher_id: z.string().regex(KebabCaseRegex, "publisher_id must be kebab-case"),
  slug: z.string().regex(KebabCaseRegex, "slug must be kebab-case"),
  tool: z.string().min(1),
  source: ImportSourceSchema,
});

export type Publisher = z.infer<typeof PublisherSchema>;
export type ImportManifest = z.infer<typeof ImportManifestSchema>;

