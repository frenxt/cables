import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walkContent } from "./lib/walk-content";
import { loadEntry, EntryLoadError } from "./lib/load-entry";
import type { Entry } from "../schema/entry";

export interface ValidationResult {
  entries: Entry[];
  errors: { folder: string; message: string }[];
}

export function validateAll(contentRoot: string): ValidationResult {
  const entries: Entry[] = [];
  const errors: { folder: string; message: string }[] = [];
  for (const folder of walkContent(contentRoot)) {
    try {
      entries.push(loadEntry(folder));
    } catch (e) {
      if (e instanceof EntryLoadError) {
        errors.push({ folder: e.folder, message: e.message });
      } else {
        errors.push({ folder, message: (e as Error).message });
      }
    }
  }
  return { entries, errors };
}

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function main(): void {
  const contentRoot = join(repoRoot(), "content");
  const { entries, errors } = validateAll(contentRoot);
  if (errors.length === 0) {
    console.log(`✓ ${entries.length} entries validated successfully`);
    process.exit(0);
  }
  console.error(`✗ ${errors.length} validation error(s):`);
  for (const err of errors) {
    console.error(`  - ${err.message}`);
  }
  process.exit(1);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main();
}
