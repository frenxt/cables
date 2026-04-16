import { writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAll } from "./validate";
import type { Entry } from "../schema/entry";

interface CompatibilityRecord {
  slug: string;
  title: string;
  tool: string;
  tier: "core" | "extended" | "experimental";
  quality_score: number | null;
  claude_status: "pass" | "partial" | "fail";
  codex_status: "pass" | "partial" | "fail";
  reviewed_at: string;
  last_verified: string;
  path: string;
}

interface CompatibilitySummary {
  total_entries: number;
  skill_entries: number;
  dual_pass_count: number;
  dual_pass_rate: number;
  claude_status_counts: Record<"pass" | "partial" | "fail", number>;
  codex_status_counts: Record<"pass" | "partial" | "fail", number>;
  tier_counts: Record<"core" | "extended" | "experimental", number>;
}

interface CompatibilityReport {
  generated_at: string;
  limit: number;
  summary: CompatibilitySummary;
  top_compatible: CompatibilityRecord[];
  watchlist: CompatibilityRecord[];
}

const tierWeight: Record<CompatibilityRecord["tier"], number> = {
  core: 3,
  extended: 2,
  experimental: 1,
};

function toRecord(entry: Entry, contentRoot: string): CompatibilityRecord | null {
  if (entry.frontmatter.artifact_type !== "skill") return null;
  if (!entry.compatibility) return null;

  return {
    slug: entry.frontmatter.slug,
    title: entry.frontmatter.title,
    tool: entry.frontmatter.tool,
    tier: entry.compatibility.tier,
    quality_score: entry.compatibility.quality_score ?? null,
    claude_status: entry.compatibility.matrix["claude-code"].status,
    codex_status: entry.compatibility.matrix.codex.status,
    reviewed_at: entry.compatibility.reviewed_at,
    last_verified: entry.frontmatter.last_verified,
    path: "content/" + relative(contentRoot, entry.folder),
  };
}

function qualityScore(value: number | null): number {
  return value ?? -1;
}

function compareByPriority(a: CompatibilityRecord, b: CompatibilityRecord): number {
  const qualityDelta = qualityScore(b.quality_score) - qualityScore(a.quality_score);
  if (qualityDelta !== 0) return qualityDelta;
  const tierDelta = tierWeight[b.tier] - tierWeight[a.tier];
  if (tierDelta !== 0) return tierDelta;
  const reviewedDelta = b.reviewed_at.localeCompare(a.reviewed_at);
  if (reviewedDelta !== 0) return reviewedDelta;
  return a.slug.localeCompare(b.slug);
}

function compareWatchlist(a: CompatibilityRecord, b: CompatibilityRecord): number {
  const aFailCount = Number(a.claude_status === "fail") + Number(a.codex_status === "fail");
  const bFailCount = Number(b.claude_status === "fail") + Number(b.codex_status === "fail");
  if (bFailCount !== aFailCount) return bFailCount - aFailCount;
  const aPartialCount = Number(a.claude_status === "partial") + Number(a.codex_status === "partial");
  const bPartialCount = Number(b.claude_status === "partial") + Number(b.codex_status === "partial");
  if (bPartialCount !== aPartialCount) return bPartialCount - aPartialCount;
  return compareByPriority(a, b);
}

function computeSummary(totalEntries: number, skills: CompatibilityRecord[]): CompatibilitySummary {
  const claude_status_counts: CompatibilitySummary["claude_status_counts"] = { pass: 0, partial: 0, fail: 0 };
  const codex_status_counts: CompatibilitySummary["codex_status_counts"] = { pass: 0, partial: 0, fail: 0 };
  const tier_counts: CompatibilitySummary["tier_counts"] = { core: 0, extended: 0, experimental: 0 };

  for (const skill of skills) {
    claude_status_counts[skill.claude_status] += 1;
    codex_status_counts[skill.codex_status] += 1;
    tier_counts[skill.tier] += 1;
  }

  const dualPassCount = skills.filter((skill) => skill.claude_status === "pass" && skill.codex_status === "pass").length;
  const dualPassRate = skills.length === 0 ? 0 : Number((dualPassCount / skills.length).toFixed(4));

  return {
    total_entries: totalEntries,
    skill_entries: skills.length,
    dual_pass_count: dualPassCount,
    dual_pass_rate: dualPassRate,
    claude_status_counts,
    codex_status_counts,
    tier_counts,
  };
}

export function buildCompatibility(contentRoot: string, outputPath: string, limit = 100): void {
  const { entries, errors } = validateAll(contentRoot);
  if (errors.length > 0) {
    throw new Error(
      `build-compatibility aborted: ${errors.length} validation error(s). Run \`pnpm validate\` for details.`
    );
  }

  const skills = entries
    .map((entry) => toRecord(entry, contentRoot))
    .filter((entry): entry is CompatibilityRecord => entry !== null);

  const topCompatible = skills
    .filter((skill) => skill.claude_status === "pass" && skill.codex_status === "pass")
    .sort(compareByPriority)
    .slice(0, limit);

  const watchlist = skills
    .filter((skill) => !(skill.claude_status === "pass" && skill.codex_status === "pass"))
    .sort(compareWatchlist)
    .slice(0, limit);

  const report: CompatibilityReport = {
    generated_at: new Date().toISOString(),
    limit,
    summary: computeSummary(entries.length, skills),
    top_compatible: topCompatible,
    watchlist,
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function repoRootFromScript(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function parseLimit(argv: string[]): number {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  if (!limitArg) return 100;
  const parsed = Number(limitArg.slice("--limit=".length));
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new Error(`invalid --limit value "${limitArg}". Expected a positive integer.`);
  }
  return parsed;
}

function main(): void {
  const root = repoRootFromScript();
  const contentRoot = join(root, "content");
  const outputPath = join(contentRoot, "compatibility.json");
  try {
    const limit = parseLimit(process.argv.slice(2));
    buildCompatibility(contentRoot, outputPath, limit);
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
