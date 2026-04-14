export type ArtifactType = "claude-md" | "skill" | "subagent" | "slash-command";

export interface IndexEntry {
  title: string;
  slug: string;
  tool: string;
  track: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  day: number | null;
  tags: string[];
  time_required: string | null;
  artifact_type: ArtifactType | null;
  has_war_story: boolean;
  last_verified: string;
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

export interface Registry {
  slug: string;
  artifact_type: ArtifactType;
  version: string;
  requires: string[];
  files: RegistryFile[];
  post_install_notes?: string;
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
