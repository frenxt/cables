import { z } from "zod";
import type { SkillCompatibility, SkillSpec } from "./skill";

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const ArtifactTypeSchema = z.enum([
  "claude-md",
  "skill",
  "subagent",
  "slash-command",
]);

export const SourceLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

const GitHubRepoRegex = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const CommitShaRegex = /^[0-9a-f]{40}$/i;

export const FrontmatterSchema = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  tool: z.string().min(1),
  track: z.string().min(1),
  category: z.string().min(1),
  difficulty: DifficultySchema,
  last_verified: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "last_verified must be YYYY-MM-DD"),
  day: z.number().int().positive().nullable().optional(),
  series: z.string().min(1).optional(),
  series_title: z.string().min(1).optional(),
  series_order: z.number().int().positive().optional(),
  series_total: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  time_required: z.string().optional(),
  artifact_type: ArtifactTypeSchema.nullable().optional(),
  has_war_story: z.boolean().optional(),
  contributors: z.array(z.string()).min(1),
  source_links: z.array(SourceLinkSchema).optional(),
  publisher: z
    .string()
    .regex(/^[a-z0-9-]+$/, "publisher must be kebab-case")
    .optional(),
  provenance_repo: z
    .string()
    .regex(GitHubRepoRegex, "provenance_repo must be in owner/repo format")
    .optional(),
  provenance_ref: z
    .string()
    .regex(CommitShaRegex, "provenance_ref must be a full 40-char commit SHA")
    .optional(),
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

const SemverRegex = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const RegistryFileSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  action: z.enum(["copy"]),
  on_conflict: z.enum(["prompt", "skip", "overwrite"]),
});

export const RegistrySchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  artifact_type: ArtifactTypeSchema,
  version: z.string().regex(SemverRegex, "version must be semver (e.g. 1.0.0)"),
  requires: z.array(z.string()),
  files: z.array(RegistryFileSchema).min(1),
  post_install_notes: z.string().optional(),
});

export type Registry = z.infer<typeof RegistrySchema>;

export interface Entry {
  folder: string;
  frontmatter: Frontmatter;
  body: string;
  registry: Registry | null;
  skillSpec: SkillSpec | null;
  compatibility: SkillCompatibility | null;
}
