import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import pc from "picocolors";
import type { ContentResolver } from "../lib/resolver/types";
import { installPlan, type InstallOptions } from "../lib/installer";
import type { PreparedInstall, InstallResult, Registry, StackMarketplace } from "../lib/types";
import {
  parseSlug,
  resolveCommunityStack,
  type ResolvedCommunityStack,
} from "../lib/resolve-community-stack";

export interface StackOptions extends InstallOptions {
  skipPlugins?: boolean;
  skipSkills?: boolean;
  skipMarketplaces?: boolean;
}

export interface StackResult {
  install: InstallResult;
  marketplaces: { added: string[]; skipped: string[]; failed: string[] };
  claudePlugins: { installed: string[]; failed: string[] };
  skillsSyncedTo: string[];
  community?: { repo: string; ref: string };
}

interface ResolvedFirstPartyStack {
  kind: "first-party";
  registry: Registry;
  files: Map<string, string>;
}

interface ResolvedCommunityStackTagged extends ResolvedCommunityStack {
  kind: "community";
}

type ResolvedStack = ResolvedFirstPartyStack | ResolvedCommunityStackTagged;

/**
 * Resolve a stack slug to an installable plan. First tries the first-party
 * content index in the cables repo. If the slug looks scoped (@handle/slug) or
 * isn't found first-party, falls back to community-stacks/ submissions.
 */
async function resolveStack(
  resolver: ContentResolver,
  rawSlug: string
): Promise<ResolvedStack> {
  const parsed = parseSlug(rawSlug);
  if (!parsed) {
    throw new Error(
      `Invalid slug "${rawSlug}". Expected kebab-case (e.g. stack-fullstack) or scoped (e.g. @handle/stack-name).`
    );
  }

  // Scoped slugs are always community — skip the first-party lookup.
  if (parsed.kind === "bare") {
    const index = await resolver.getIndex();
    const entry = index.entries.find((e) => e.slug === parsed.slug);
    if (entry && entry.artifact_type !== null) {
      const registry = await resolver.getRegistry(parsed.slug);
      if (registry && registry.stack) {
        const files = new Map<string, string>();
        for (const file of registry.files) {
          const content = await resolver.getArtifactFile(parsed.slug, file.source);
          files.set(file.source, content);
        }
        return { kind: "first-party", registry, files };
      }
    }
  }

  const community = await resolveCommunityStack(parsed);
  if (!community) {
    const hint =
      parsed.kind === "scoped"
        ? `community-stacks/${parsed.handle}/${parsed.slug}.json not found in frenxt/cables.`
        : `Stack "${parsed.slug}" not found as a first-party cable or community submission.`;
    throw new Error(hint);
  }
  return { ...community, kind: "community" };
}

export async function runStack(
  resolver: ContentResolver,
  slug: string,
  options: StackOptions
): Promise<StackResult> {
  const resolved = await resolveStack(resolver, slug);
  const { registry, files } = resolved;

  if (!registry.stack) {
    throw new Error(`Stack "${slug}" resolved but has no stack block.`);
  }

  // Step 1 — install files (same behavior as `add`).
  const plan: PreparedInstall = { registry, files };
  const install = await installPlan(plan, options);

  const result: StackResult = {
    install,
    marketplaces: { added: [], skipped: [], failed: [] },
    claudePlugins: { installed: [], failed: [] },
    skillsSyncedTo: [],
    community:
      resolved.kind === "community"
        ? { repo: resolved.source.submission.repo, ref: resolved.source.submission.ref }
        : undefined,
  };

  if (options.dryRun) {
    console.log(pc.dim("Dry run — skipping marketplace/plugin/skill operations."));
    return result;
  }

  const stack = registry.stack;

  if (!options.skipMarketplaces && stack.marketplaces && stack.marketplaces.length > 0) {
    console.log(`\n${pc.cyan("──")}  Step 2 · Configure marketplaces`);
    await configureMarketplaces(stack.marketplaces, result);
  }

  if (!options.skipPlugins && stack.claude_plugins && stack.claude_plugins.length > 0) {
    console.log(`\n${pc.cyan("──")}  Step 3 · Install Claude plugins`);
    installClaudePlugins(stack.claude_plugins, result);
  }

  if (!options.skipSkills && stack.sync_skills_from) {
    console.log(`\n${pc.cyan("──")}  Step 4 · Sync skills to Claude profiles`);
    syncSkillsToProfiles(
      resolve(options.projectRoot, stack.sync_skills_from),
      result
    );
  }

  printSummary(result);
  return result;
}

function hasClaudeCLI(): boolean {
  const probe = spawnSync("claude", ["--version"], { stdio: "ignore" });
  return probe.status === 0;
}

function listConfiguredMarketplaces(): Set<string> {
  try {
    const out = execFileSync("claude", ["plugins", "marketplace", "list"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const names = new Set<string>();
    for (const line of out.split("\n")) {
      const match = line.match(/^\s*❯\s*(\S+)/);
      if (match) names.add(match[1]);
    }
    return names;
  } catch {
    return new Set();
  }
}

async function configureMarketplaces(
  marketplaces: StackMarketplace[],
  result: StackResult
): Promise<void> {
  if (!hasClaudeCLI()) {
    console.error(pc.red("  Claude CLI not found — skipping marketplaces."));
    for (const m of marketplaces) result.marketplaces.failed.push(m.name);
    return;
  }
  const configured = listConfiguredMarketplaces();
  for (const m of marketplaces) {
    if (configured.has(m.name)) {
      console.log(`  ${pc.dim("·")} already configured: ${m.name}`);
      result.marketplaces.skipped.push(m.name);
      continue;
    }
    console.log(`  adding: ${m.name} ${pc.dim(`(${m.source})`)}`);
    const r = spawnSync("claude", ["plugins", "marketplace", "add", m.source], {
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
    if (r.status === 0) {
      result.marketplaces.added.push(m.name);
    } else {
      console.error(pc.red(`    failed: ${m.name}`));
      if (r.stderr) console.error(pc.dim(`    ${r.stderr.trim()}`));
      result.marketplaces.failed.push(m.name);
    }
  }
}

function installClaudePlugins(plugins: string[], result: StackResult): void {
  if (!hasClaudeCLI()) {
    console.error(pc.red("  Claude CLI not found — skipping plugins."));
    for (const p of plugins) result.claudePlugins.failed.push(p);
    return;
  }
  for (const plugin of plugins) {
    console.log(`  installing: ${plugin}`);
    // Try new form first, fall back to legacy singular.
    let r = spawnSync("claude", ["plugins", "install", plugin], {
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
    if (r.status !== 0) {
      r = spawnSync("claude", ["plugin", "install", plugin], {
        stdio: ["ignore", "ignore", "pipe"],
        encoding: "utf8",
      });
    }
    if (r.status === 0) {
      result.claudePlugins.installed.push(plugin);
    } else {
      console.error(pc.red(`    failed: ${plugin}`));
      if (r.stderr) console.error(pc.dim(`    ${r.stderr.trim().split("\n")[0]}`));
      result.claudePlugins.failed.push(plugin);
    }
  }
}

function syncSkillsToProfiles(sourceDir: string, result: StackResult): void {
  if (!existsSync(sourceDir)) {
    console.error(pc.red(`  Skills source dir not found: ${sourceDir}`));
    return;
  }
  const home = homedir();
  const profiles = readdirSync(home)
    .filter((name) => name === ".claude" || name.startsWith(".claude-"))
    .map((name) => join(home, name))
    .filter((p) => {
      try {
        return statSync(p).isDirectory();
      } catch {
        return false;
      }
    });

  if (profiles.length === 0) {
    console.log(pc.dim(`  No Claude profiles found in ${home}`));
    return;
  }

  // Only accept skill directory names matching the same kebab-case regex we
  // enforce in community-stack.ts. This prevents path traversal via names like
  // "../.ssh" — readdirSync returns raw filesystem entries with no
  // sanitization, so we must validate before joining into target paths.
  const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
  const skillSlugs = readdirSync(sourceDir).filter((name) => {
    if (!SAFE_SLUG.test(name)) return false;
    try {
      return statSync(join(sourceDir, name)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const profile of profiles) {
    const targetDir = join(profile, "skills");
    mkdirSync(targetDir, { recursive: true });
    for (const slug of skillSlugs) {
      cpSync(join(sourceDir, slug), join(targetDir, slug), { recursive: true });
    }
    result.skillsSyncedTo.push(profile);
    console.log(`  ${pc.green("✓")} synced ${skillSlugs.length} skill(s) → ${profile}/skills`);
  }
}

function printSummary(result: StackResult): void {
  const { marketplaces, claudePlugins, skillsSyncedTo, community } = result;
  const totalFailed =
    marketplaces.failed.length + claudePlugins.failed.length;

  console.log(`\n${pc.cyan("═══════════════════════════════════════════")}`);
  if (totalFailed === 0) {
    console.log(`${pc.green("✓")} Stack install complete.`);
  } else {
    console.log(`${pc.yellow("⚠")} Stack install finished with ${totalFailed} failure(s).`);
  }
  if (community) {
    console.log(pc.dim(`  Source: ${community.repo}@${community.ref}`));
  }
  console.log(
    `  Marketplaces — added: ${marketplaces.added.length}, ` +
      `skipped: ${marketplaces.skipped.length}, failed: ${marketplaces.failed.length}`
  );
  console.log(
    `  Plugins — installed: ${claudePlugins.installed.length}, failed: ${claudePlugins.failed.length}`
  );
  console.log(`  Skills synced to ${skillsSyncedTo.length} profile(s).`);

  if (claudePlugins.failed.length > 0) {
    console.log(pc.dim("  Plugins failed: " + claudePlugins.failed.join(", ")));
  }
  if (marketplaces.failed.length > 0) {
    console.log(pc.dim("  Marketplace failed: " + marketplaces.failed.join(", ")));
  }
  console.log(pc.cyan("═══════════════════════════════════════════"));
}
