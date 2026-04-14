import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PreparedInstall, InstallResult } from "./types";

export type ConflictResolution = "overwrite" | "skip";

export interface InstallOptions {
  projectRoot: string;
  force: boolean;
  dryRun: boolean;
  onConflict: (
    relativeTargetPath: string,
    existingContent: string,
    newContent: string
  ) => Promise<ConflictResolution>;
}

export async function installPlan(
  plan: PreparedInstall,
  options: InstallOptions
): Promise<InstallResult> {
  const writtenFiles: string[] = [];
  const skippedFiles: string[] = [];
  const conflicts: string[] = [];

  for (const file of plan.registry.files) {
    const content = plan.files.get(file.source);
    if (content === undefined) {
      throw new Error(`installPlan: content for source "${file.source}" was not prepared`);
    }
    const absTarget = join(options.projectRoot, file.target);
    const targetExists = existsSync(absTarget);

    if (targetExists && !options.force) {
      conflicts.push(file.target);
      const existing = readFileSync(absTarget, "utf8");
      const resolution = await options.onConflict(file.target, existing, content);
      if (resolution === "skip") {
        skippedFiles.push(file.target);
        continue;
      }
    }

    if (options.dryRun) {
      writtenFiles.push(file.target);
      continue;
    }

    mkdirSync(dirname(absTarget), { recursive: true });
    writeFileSync(absTarget, content, "utf8");
    writtenFiles.push(file.target);
  }

  return { writtenFiles, skippedFiles, conflicts };
}
