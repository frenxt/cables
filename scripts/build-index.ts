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
  publisher: string | null;
  provenance_repo: string | null;
  provenance_ref: string | null;
  skill_capability_cluster: string | null;
  skill_maturity: string | null;
  compatibility_tier: string | null;
  compatibility_quality_score: number | null;
  compatibility_claude_status: string | null;
  compatibility_codex_status: string | null;
  compatibility_reviewed_at: string | null;
  compatibility_rank: number | null;
  path: string;
}

const tierWeight: Record<string, number> = {
  core: 3,
  extended: 2,
  experimental: 1,
};

function isRankEligible(entry: IndexEntry): boolean {
  return (
    entry.artifact_type === "skill" &&
    entry.compatibility_claude_status === "pass" &&
    entry.compatibility_codex_status !== "fail"
  );
}

function toRankableScore(value: number | null): number {
  return value ?? -1;
}

function applyCompatibilityRanks(entries: IndexEntry[]): IndexEntry[] {
  const ranked = entries
    .filter((entry) => isRankEligible(entry))
    .slice()
    .sort((a, b) => {
      const qualityDelta = toRankableScore(b.compatibility_quality_score) - toRankableScore(a.compatibility_quality_score);
      if (qualityDelta !== 0) return qualityDelta;
      const tierDelta = (tierWeight[b.compatibility_tier ?? ""] ?? 0) - (tierWeight[a.compatibility_tier ?? ""] ?? 0);
      if (tierDelta !== 0) return tierDelta;
      const reviewedDelta = (b.compatibility_reviewed_at ?? "").localeCompare(a.compatibility_reviewed_at ?? "");
      if (reviewedDelta !== 0) return reviewedDelta;
      return a.slug.localeCompare(b.slug);
    });

  const rankBySlug = new Map<string, number>();
  ranked.forEach((entry, index) => {
    rankBySlug.set(entry.slug, index + 1);
  });

  return entries.map((entry) => ({
    ...entry,
    compatibility_rank: rankBySlug.get(entry.slug) ?? null,
  }));
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
    publisher: fm.publisher ?? null,
    provenance_repo: fm.provenance_repo ?? null,
    provenance_ref: fm.provenance_ref ?? null,
    skill_capability_cluster: entry.skillSpec?.capability_cluster ?? null,
    skill_maturity: entry.skillSpec?.maturity ?? null,
    compatibility_tier: entry.compatibility?.tier ?? null,
    compatibility_quality_score: entry.compatibility?.quality_score ?? null,
    compatibility_claude_status: entry.compatibility?.matrix["claude-code"].status ?? null,
    compatibility_codex_status: entry.compatibility?.matrix.codex.status ?? null,
    compatibility_reviewed_at: entry.compatibility?.reviewed_at ?? null,
    compatibility_rank: null,
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
  const indexEntries = applyCompatibilityRanks(entries.map((e) => toIndexEntry(e, contentRoot))).sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );
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
