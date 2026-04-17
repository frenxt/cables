import { cac } from "cac";
import { cwd, exit } from "node:process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createResolver } from "./lib/resolver";
import { detectClaudeCodeProject } from "./lib/project";
import { runList, type ListOptions } from "./commands/list";
import { runSearch } from "./commands/search";
import { runInfo } from "./commands/info";
import { runAdd } from "./commands/add";
import { runConvertClaudeToCodex } from "./commands/convert-claude-to-codex";
import { runConvertCodexToClaude } from "./commands/convert-codex-to-claude";
import type { CommandConversionMode } from "./lib/convert-claude-to-codex";
import { initPublisherConfig, packPublisherManifest, submitPublisherManifest } from "./lib/publisher";
import {
  banner,
  bye,
  success,
  error as logError,
  emphasis,
  promptConflict,
  spinner,
} from "./lib/output";
import { select, isCancel, cancel } from "@clack/prompts";
import type { ArtifactType } from "./lib/types";
import type { ConflictResolution } from "./lib/installer";

function resolveVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, "..", "package.json");
    const raw = readFileSync(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VERSION = resolveVersion();

function isInteractiveTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function printConvertResult(
  actionLabel: "Converted" | "Planned",
  result: { writtenFiles: string[]; skippedFiles: string[]; warnings: string[] }
): void {
  console.log(
    `${actionLabel} ${result.writtenFiles.length} file${result.writtenFiles.length === 1 ? "" : "s"}:`
  );
  for (const file of result.writtenFiles) {
    console.log(`  ${file}`);
  }
  if (result.skippedFiles.length > 0) {
    console.log("");
    console.log(
      `Skipped ${result.skippedFiles.length} existing file${
        result.skippedFiles.length === 1 ? "" : "s"
      }:`
    );
    for (const file of result.skippedFiles) {
      console.log(`  ${file}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log("");
    console.log(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

export async function run(argv: string[]): Promise<void> {
  const cli = cac("frenxt");

  cli
    .command("list", "List all cables")
    .option("--category <category>", "Filter by category")
    .option("--difficulty <level>", "Filter by difficulty (beginner|intermediate|advanced)")
    .option("--artifact-type <type>", "Filter by artifact type")
    .option("--publisher <publisher>", "Filter by publisher id")
    .option("--tag <tag>", "Filter by tag")
    .action(async (opts) => {
      try {
        const resolver = createResolver();
        const options: ListOptions = {
          category: opts.category,
          difficulty: opts.difficulty,
          artifactType: opts.artifactType as ArtifactType | undefined,
          publisher: opts.publisher,
          tag: opts.tag,
        };
        const output = await runList(resolver, options);
        console.log(output);
      } catch (e) {
        logError((e as Error).message);
        exit(1);
      }
    });

  cli
    .command("search <query>", "Search cables by title, slug, tag, or category")
    .action(async (query: string) => {
      try {
        const resolver = createResolver();
        const output = await runSearch(resolver, query);
        console.log(output);
      } catch (e) {
        logError((e as Error).message);
        exit(1);
      }
    });

  cli
    .command("info <slug>", "Show detailed information about a cable")
    .action(async (slug: string) => {
      try {
        const resolver = createResolver();
        const output = await runInfo(resolver, slug);
        console.log(output);
      } catch (e) {
        logError((e as Error).message);
        exit(1);
      }
    });

  cli
    .command("add <slug>", "Install a cable's artifact into the current project")
    .option("--force", "Overwrite existing files without prompting")
    .option("--dry-run", "Print planned writes without touching disk")
    .action(async (slug: string, opts) => {
      try {
        const interactive = isInteractiveTTY();
        if (interactive) {
          banner();
        }
        const projectRoot = cwd();
        if (!detectClaudeCodeProject(projectRoot)) {
          if (!opts.force) {
            if (!interactive) {
              throw new Error(
                "This doesn't look like a Claude Code project (no .claude/ or CLAUDE.md). Re-run with --force or use an interactive terminal."
              );
            }
            const proceed = await select<"yes" | "no">({
              message:
                "This doesn't look like a Claude Code project (no .claude/ or CLAUDE.md). Continue anyway?",
              options: [
                { value: "no", label: "Abort" },
                { value: "yes", label: "Continue" },
              ],
              initialValue: "no",
            });
            if (isCancel(proceed) || proceed === "no") {
              cancel("Install aborted.");
              exit(1);
            }
          }
        }
        const resolver = createResolver();
        const spin = isInteractiveTTY()
          ? spinner(`Fetching ${emphasis(slug)} from ${resolver.describe()}`)
          : {
              succeed: () => undefined,
              fail: () => undefined,
            };
        let result;
        try {
          result = await runAdd(resolver, slug, {
            projectRoot,
            force: !!opts.force,
            dryRun: !!opts.dryRun,
            onConflict: async (path, existing, incoming): Promise<ConflictResolution> =>
              isInteractiveTTY()
                ? promptConflict(path, existing, incoming)
                : Promise.reject(
                    new Error(
                      `Conflict detected at ${path}. Re-run with --force or in an interactive terminal.`
                    )
                  ),
          });
          spin.succeed(`Fetched ${emphasis(slug)}`);
        } catch (e) {
          spin.fail(`Failed to fetch ${slug}`);
          throw e;
        }
        for (const f of result.writtenFiles) success(`Wrote ${f}`);
        for (const f of result.skippedFiles) console.log(`Skipped ${f}`);
        bye(opts.dryRun ? "Dry run complete — no files were written." : "Done.");
      } catch (e) {
        logError((e as Error).message);
        exit(1);
      }
    });

  cli
    .command("publisher <action>", "Publisher workflow helpers: init | pack | submit")
    .option("--publisher <id>", "Publisher id in kebab-case")
    .option("--repo <repo>", "GitHub repo in owner/repo format; defaults to remote.origin.url")
    .option("--branch <branch>", "Default branch for init", { default: "main" })
    .option("--force", "Overwrite an existing .cables/publisher.json")
    .option("--slug <slug>", "Cable slug to package")
    .option("--tool <tool>", "Tool track, e.g. claude-code")
    .option("--output <path>", "Write the generated manifest to a specific file path")
    .option("--manifest-output <path>", "Write the generated manifest to a specific file path")
    .option("--pr-body-output <path>", "Write the generated PR body markdown to a specific file path")
    .option("--registry-repo <repo>", "Curated cables registry repo for reviewer instructions", {
      default: "frenxt/cables",
    })
    .option("--registry-root <path>", "Local checkout of the curated registry repo")
    .option("--prepare-commit", "Create or reset a branch and commit the manifest in --registry-root")
    .option("--commit-branch <name>", "Branch name to use with --prepare-commit")
    .option("--commit-message <message>", "Commit message to use with --prepare-commit")
    .action(
      (
        action: string,
        opts: {
          publisher?: string;
          repo?: string;
          branch?: string;
          force?: boolean;
          slug?: string;
          tool?: string;
          output?: string;
          manifestOutput?: string;
          prBodyOutput?: string;
          registryRepo?: string;
          registryRoot?: string;
          prepareCommit?: boolean;
          commitBranch?: string;
          commitMessage?: string;
        }
      ) => {
        try {
          if (action === "init") {
            if (!opts.publisher) {
              throw new Error('Missing required option "--publisher <id>".');
            }
            const result = initPublisherConfig({
              repoRoot: cwd(),
              publisherId: opts.publisher,
              repo: opts.repo,
              defaultBranch: opts.branch,
              force: Boolean(opts.force),
            });
            success(`Wrote ${result.path}`);
            console.log(`Publisher:      ${result.config.publisher_id}`);
            console.log(`GitHub repo:    ${result.config.repo}`);
            console.log(`Default branch: ${result.config.default_branch}`);
            return;
          }

          if (action === "pack") {
            if (!opts.slug) {
              throw new Error('Missing required option "--slug <slug>".');
            }
            if (!opts.tool) {
              throw new Error('Missing required option "--tool <tool>".');
            }
            const result = packPublisherManifest({
              repoRoot: cwd(),
              slug: opts.slug,
              tool: opts.tool,
              publisherId: opts.publisher,
              outputPath: opts.output,
            });
            if (result.outputPath) {
              success(`Wrote ${result.outputPath}`);
            } else {
              console.log(result.manifestJson.trimEnd());
            }
            return;
          }

          if (action === "submit") {
            if (!opts.slug) {
              throw new Error('Missing required option "--slug <slug>".');
            }
            if (!opts.tool) {
              throw new Error('Missing required option "--tool <tool>".');
            }
            const result = submitPublisherManifest({
              repoRoot: cwd(),
              slug: opts.slug,
              tool: opts.tool,
              publisherId: opts.publisher,
              manifestOutputPath: opts.manifestOutput,
              prBodyOutputPath: opts.prBodyOutput,
              registryRepo: opts.registryRepo,
              registryRoot: opts.registryRoot,
              prepareCommit: Boolean(opts.prepareCommit),
              branchName: opts.commitBranch,
              commitMessage: opts.commitMessage,
            });
            success(`Wrote ${result.manifestPath}`);
            success(`Wrote ${result.prBodyPath}`);
            if (result.registryManifestPath) {
              success(`Wrote ${result.registryManifestPath}`);
            }
            console.log(`Registry repo: ${result.registryRepo}`);
            console.log(`PR target:     ${result.centralManifestPath}`);
            console.log(`Source commit: ${result.packResult.manifest.source.ref}`);
            if (result.branchName) {
              console.log(`Commit branch: ${result.branchName}`);
            }
            if (result.commitMessage) {
              console.log(`Commit msg:    ${result.commitMessage}`);
            }
            return;
          }

          throw new Error(`Unknown publisher action "${action}". Use "init", "pack", or "submit".`);
        } catch (e) {
          logError((e as Error).message);
          exit(1);
        }
      }
    );

  cli
    .command("convert <direction>", "Convert between Claude and Codex artifact layouts")
    .option("--source <dir>", "Source project root (defaults to current working directory)")
    .option("--target <dir>", "Target project root (defaults to current working directory)")
    .option(
      "--commands-as <mode>",
      "For claude-to-codex: map .claude/commands as skills|prompts|both (default: skills)"
    )
    .option("--force", "Overwrite existing files in the target")
    .option("--dry-run", "Print what would be written without touching disk")
    .action(async (direction: string, opts) => {
      try {
        const sourceRoot = opts.source ?? cwd();
        const targetRoot = opts.target ?? cwd();
        const dryRun = Boolean(opts.dryRun);
        const force = Boolean(opts.force);
        const commandsAsRaw = (opts.commandsAs ?? "skills").toString().trim().toLowerCase();
        if (
          commandsAsRaw !== "skills" &&
          commandsAsRaw !== "prompts" &&
          commandsAsRaw !== "both"
        ) {
          throw new Error(
            `Unknown --commands-as value "${commandsAsRaw}". Use "skills", "prompts", or "both".`
          );
        }
        const commandsAs = commandsAsRaw as CommandConversionMode;
        if (direction !== "claude-to-codex" && direction !== "codex-to-claude") {
          throw new Error(
            `Unknown direction "${direction}". Use "claude-to-codex" or "codex-to-claude".`
          );
        }
        const result =
          direction === "claude-to-codex"
            ? runConvertClaudeToCodex({ sourceRoot, targetRoot, force, dryRun, commandsAs })
            : runConvertCodexToClaude({ sourceRoot, targetRoot, force, dryRun });
        if (result.plannedWrites.length === 0) {
          console.log(
            direction === "claude-to-codex"
              ? "No convertible Claude artifacts found."
              : "No convertible Codex artifacts found."
          );
          return;
        }
        printConvertResult(dryRun ? "Planned" : "Converted", result);
      } catch (e) {
        logError((e as Error).message);
        exit(1);
      }
    });

  cli.help();
  cli.version(VERSION);
  cli.parse(argv, { run: false });

  // Built-in flags like --help / --version do not set matchedCommand.
  if (!cli.matchedCommand) {
    if (argv.slice(2).length === 0) {
      cli.outputHelp();
    }
    return;
  }

  try {
    const maybe = cli.runMatchedCommand();
    if (maybe && typeof (maybe as Promise<unknown>).then === "function") {
      await maybe;
    }
  } catch (e) {
    logError((e as Error).message);
    exit(1);
  }
}
