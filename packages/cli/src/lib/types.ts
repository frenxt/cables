export type ArtifactType = "claude-md" | "skill" | "subagent" | "slash-command";

export interface IndexEntry {
  title: string;
  slug: string;
  tool: string;
  track: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  day: number | null;
  series?: string | null;
  series_title?: string | null;
  series_order?: number | null;
  series_total?: number | null;
  tags: string[];
  time_required: string | null;
  artifact_type: ArtifactType | null;
  has_war_story: boolean;
  last_verified: string;
  publisher?: string | null;
  provenance_repo?: string | null;
  provenance_ref?: string | null;
  skill_capability_cluster?: string | null;
  skill_maturity?: "stable" | "beta" | "experimental" | null;
  compatibility_tier?: "core" | "extended" | "experimental" | null;
  compatibility_quality_score?: number | null;
  compatibility_claude_status?: "pass" | "partial" | "fail" | null;
  compatibility_codex_status?: "pass" | "partial" | "fail" | null;
  compatibility_reviewed_at?: string | null;
  compatibility_rank?: number | null;
  path: string;
  contributors?: string[];
}

export interface ContentIndex {
  generated_at: string;
  entries: IndexEntry[];
}

export interface RegistryFile {
  source: string;
  target: string;
  action: "copy";
  on_conflict: "prompt" | "skip" | "overwrite";
}

export interface StackMarketplace {
  name: string;
  source: string;
}

export interface Stack {
  marketplaces?: StackMarketplace[];
  claude_plugins?: string[];
  codex_plugins?: string[];
  sync_skills_from?: string;
}

export interface Registry {
  slug: string;
  artifact_type: ArtifactType;
  version: string;
  requires: string[];
  files: RegistryFile[];
  post_install_notes?: string;
  stack?: Stack;
}

export interface PreparedInstall {
  registry: Registry;
  files: Map<string, string>;
}

export interface InstallResult {
  writtenFiles: string[];
  skippedFiles: string[];
  conflicts: string[];
}
