import { writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAll } from "./validate";
import type { Entry } from "../schema/entry";

interface IndexEntry {
  title: string;
  slug: string;
  tool: string;
  track: string;
  category: string;
  difficulty: string;
  day: number | null;
  series: string | null;
  series_title: string | null;
  series_order: number | null;
  series_total: number | null;
  tags: string[];
  time_required: string | null;
  artifact_type: string | null;
  has_war_story: boolean;
  last_verified: string;
  path: string;
}

function toIndexEntry(entry: Entry, contentRoot: string): IndexEntry {
  const fm = entry.frontmatter;
  return {
    title: fm.title,
    slug: fm.slug,
    tool: fm.tool,
    track: fm.track,
    category: fm.category,
    difficulty: fm.difficulty,
    day: fm.day ?? null,
    series: fm.series ?? null,
    series_title: fm.series_title ?? null,
    series_order: fm.series_order ?? null,
    series_total: fm.series_total ?? null,
    tags: fm.tags ?? [],
    time_required: fm.time_required ?? null,
    artifact_type: fm.artifact_type ?? null,
    has_war_story: fm.has_war_story ?? false,
    last_verified: fm.last_verified,
    path: "content/" + relative(contentRoot, entry.folder),
  };
}

export function buildIndex(contentRoot: string, outputPath: string): void {
  const { entries, errors } = validateAll(contentRoot);
  if (errors.length > 0) {
    throw new Error(
      `build-index aborted: ${errors.length} validation error(s). Run \`pnpm validate\` for details.`
    );
  }
  const indexEntries = entries
    .map((e) => toIndexEntry(e, contentRoot))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const index = {
    generated_at: new Date().toISOString(),
    entries: indexEntries,
  };
  writeFileSync(outputPath, JSON.stringify(index, null, 2) + "\n", "utf8");
}

function repoRootFromScript(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function main(): void {
  const root = repoRootFromScript();
  const contentRoot = join(root, "content");
  const outputPath = join(contentRoot, "index.json");
  try {
    buildIndex(contentRoot, outputPath);
    console.log(`✓ wrote ${outputPath}`);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main();
}
