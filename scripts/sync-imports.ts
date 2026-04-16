import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncImports } from "./lib/sync-imports";

function repoRootFromScript(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function parseRepoRoot(argv: string[]): string {
  const explicit = argv.find((arg) => arg.startsWith("--repo-root="));
  if (!explicit) return repoRootFromScript();
  const value = explicit.slice("--repo-root=".length).trim();
  if (!value) {
    throw new Error("invalid --repo-root argument: value cannot be empty");
  }
  return resolve(value);
}

async function main(): Promise<void> {
  try {
    const repoRoot = parseRepoRoot(process.argv.slice(2));
    const result = await syncImports({ repoRoot });
    console.log(
      `✓ synchronized ${result.importsProcessed} import manifest(s), wrote ${result.filesWritten} file(s)`
    );
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  void main();
}

