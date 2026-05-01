import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PreparedInstall, InstallResult } from "./types";
import type { SupportedProjectTool } from "./project";

export type ConflictResolution = "overwrite" | "skip";

export interface InstallOptions {
  projectRoot: string;
  force: boolean;
  dryRun: boolean;
  targetTool?: SupportedProjectTool;
  onConflict: (
    relativeTargetPath: string,
    existingContent: string,
    newContent: string
  ) => Promise<ConflictResolution>;
}

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function transformTargetPath(target: string, targetTool: SupportedProjectTool): string {
  if (targetTool !== "codex") return target;

  const normalized = toPosixPath(target);
  if (normalized === "CLAUDE.md") return "AGENTS.md";
  if (normalized.startsWith(".claude/skills/")) {
    return normalized.replace(/^\.claude\/skills\//, ".agents/skills/");
  }
  if (normalized.startsWith(".claude/commands/")) {
    return normalized.replace(/^\.claude\/commands\//, ".codex/prompts/");
  }
  return target;
}

function transformContent(content: string, targetTool: SupportedProjectTool): string {
  if (targetTool !== "codex") return content;
  return content
    .replaceAll(".claude/skills", ".agents/skills")
    .replaceAll("~/.claude/skills", "~/.agents/skills")
    .replaceAll(".claude/commands", ".codex/prompts")
    .replaceAll("~/.claude/commands", "~/.codex/prompts")
    .replaceAll("CLAUDE.md", "AGENTS.md");
}

export async function installPlan(
  plan: PreparedInstall,
  options: InstallOptions
): Promise<InstallResult> {
  const writtenFiles: string[] = [];
  const skippedFiles: string[] = [];
  const conflicts: string[] = [];
  const targetTool = options.targetTool ?? "claude-code";

  for (const file of plan.registry.files) {
    const rawContent = plan.files.get(file.source);
    if (rawContent === undefined) {
      throw new Error(`installPlan: content for source "${file.source}" was not prepared`);
    }
    const target = transformTargetPath(file.target, targetTool);
    const content = transformContent(rawContent, targetTool);
    const absTarget = join(options.projectRoot, target);
    const targetExists = existsSync(absTarget);

    if (targetExists && !options.force) {
      conflicts.push(target);
      const existing = readFileSync(absTarget, "utf8");
      const resolution = await options.onConflict(target, existing, content);
      if (resolution === "skip") {
        skippedFiles.push(target);
        continue;
      }
    }

    if (options.dryRun) {
      writtenFiles.push(target);
      continue;
    }

    mkdirSync(dirname(absTarget), { recursive: true });
    writeFileSync(absTarget, content, "utf8");
    writtenFiles.push(target);
  }

  return { writtenFiles, skippedFiles, conflicts };
}
