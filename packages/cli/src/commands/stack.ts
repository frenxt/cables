import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, cpSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import pc from "picocolors";
import type { ContentResolver } from "../lib/resolver/types";
import { installPlan, type InstallOptions } from "../lib/installer";
import type { PreparedInstall, InstallResult, Stack, StackMarketplace } from "../lib/types";

export interface StackOptions extends InstallOptions {
  skipPlugins?: boolean;
  skipSkills?: boolean;
  skipMarketplaces?: boolean;
}

export interface StackResult {
  install: InstallResult;
  marketplaces: { added: string[]; skipped: string[]; failed: string[] };
  claudePlugins: { installed: string[]; failed: string[] };
  codexPlugins: { enabled: string[]; failed: string[] };
  skillsSyncedTo: string[];
}

export async function runStack(
  resolver: ContentResolver,
  slug: string,
  options: StackOptions
): Promise<StackResult> {
  const index = await resolver.getIndex();
  const entry = index.entries.find((e) => e.slug === slug);
  if (!entry) {
    throw new Error(`Cable "${slug}" not found in the index.`);
  }
  if (entry.artifact_type === null) {
    throw new Error(`Cable "${slug}" has no artifact — cannot stack.`);
  }

  const registry = await resolver.getRegistry(slug);
  if (!registry) {
    throw new Error(`Cable "${slug}" has no registry.json — cannot stack.`);
  }
  if (!registry.stack) {
    throw new Error(
      `Cable "${slug}" has no "stack" block in registry.json — use "frenxt add ${slug}" instead.`
    );
  }

  // Step 1 — install files (same behavior as `add`).
  const files = new Map<string, string>();
  for (const file of registry.files) {
    const content = await resolver.getArtifactFile(slug, file.source);
    files.set(file.source, content);
  }
  const plan: PreparedInstall = { registry, files };
  const install = await installPlan(plan, options);

  const result: StackResult = {
    install,
    marketplaces: { added: [], skipped: [], failed: [] },
    claudePlugins: { installed: [], failed: [] },
    codexPlugins: { enabled: [], failed: [] },
    skillsSyncedTo: [],
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

  if (!options.skipPlugins) {
    if (stack.claude_plugins && stack.claude_plugins.length > 0) {
      console.log(`\n${pc.cyan("──")}  Step 3a · Install Claude plugins`);
      installClaudePlugins(stack.claude_plugins, result);
    }
    if (stack.codex_plugins && stack.codex_plugins.length > 0) {
      console.log(`\n${pc.cyan("──")}  Step 3b · Enable Codex plugins`);
      enableCodexPlugins(stack.codex_plugins, result);
    }
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

function enableCodexPlugins(plugins: string[], result: StackResult): void {
  const probe = spawnSync("codex", ["--version"], { stdio: "ignore" });
  if (probe.status !== 0) {
    console.log(pc.dim("  Codex CLI not found — skipping Codex plugin enablement."));
    return;
  }
  const cfg = join(homedir(), ".codex", "config.toml");
  mkdirSync(dirname(cfg), { recursive: true });
  let current = "";
  try {
    current = readFileSync(cfg, "utf8");
  } catch {
    current = "";
  }
  for (const plugin of plugins) {
    const header = `[plugins."${plugin}"]`;
    if (current.includes(header)) {
      current = current.replace(
        new RegExp(
          `(${escapeRegex(header)}[^[]*?)enabled\\s*=\\s*(?:true|false)`,
          "s"
        ),
        `$1enabled = true`
      );
      if (!new RegExp(`${escapeRegex(header)}[^[]*?enabled\\s*=`, "s").test(current)) {
        current = current.replace(header, `${header}\nenabled = true`);
      }
    } else {
      current += `\n${header}\nenabled = true\n`;
    }
    result.codexPlugins.enabled.push(plugin);
    console.log(`  enabled: ${plugin}`);
  }
  writeFileSync(cfg, current);
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

  const skillSlugs = readdirSync(sourceDir).filter((name) => {
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function printSummary(result: StackResult): void {
  const { marketplaces, claudePlugins, codexPlugins, skillsSyncedTo } = result;
  const totalFailed =
    marketplaces.failed.length + claudePlugins.failed.length + codexPlugins.failed.length;

  console.log(`\n${pc.cyan("═══════════════════════════════════════════")}`);
  if (totalFailed === 0) {
    console.log(`${pc.green("✓")} Stack install complete.`);
  } else {
    console.log(`${pc.yellow("⚠")} Stack install finished with ${totalFailed} failure(s).`);
  }
  console.log(
    `  Marketplaces — added: ${marketplaces.added.length}, ` +
      `skipped: ${marketplaces.skipped.length}, failed: ${marketplaces.failed.length}`
  );
  console.log(
    `  Claude plugins — installed: ${claudePlugins.installed.length}, failed: ${claudePlugins.failed.length}`
  );
  console.log(
    `  Codex plugins — enabled: ${codexPlugins.enabled.length}, failed: ${codexPlugins.failed.length}`
  );
  console.log(`  Skills synced to ${skillsSyncedTo.length} profile(s).`);

  if (claudePlugins.failed.length > 0) {
    console.log(pc.dim("  Claude failed: " + claudePlugins.failed.join(", ")));
  }
  if (marketplaces.failed.length > 0) {
    console.log(pc.dim("  Marketplace failed: " + marketplaces.failed.join(", ")));
  }
  console.log(pc.cyan("═══════════════════════════════════════════"));
}
