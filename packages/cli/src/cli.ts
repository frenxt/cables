import { cac } from "cac";
import { cwd, exit } from "node:process";
import { createResolver } from "./lib/resolver";
import { detectClaudeCodeProject } from "./lib/project";
import { runList, type ListOptions } from "./commands/list";
import { runSearch } from "./commands/search";
import { runInfo } from "./commands/info";
import { runAdd } from "./commands/add";
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

const VERSION = "0.0.0";

export function run(argv: string[]): void {
  const cli = cac("frenxt");

  cli
    .command("list", "List all cables")
    .option("--category <category>", "Filter by category")
    .option("--difficulty <level>", "Filter by difficulty (beginner|intermediate|advanced)")
    .option("--artifact-type <type>", "Filter by artifact type")
    .option("--tag <tag>", "Filter by tag")
    .action(async (opts) => {
      try {
        const resolver = createResolver();
        const options: ListOptions = {
          category: opts.category,
          difficulty: opts.difficulty,
          artifactType: opts.artifactType as ArtifactType | undefined,
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
        banner();
        const projectRoot = cwd();
        if (!detectClaudeCodeProject(projectRoot)) {
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
        const resolver = createResolver();
        const spin = spinner(`Fetching ${emphasis(slug)} from ${resolver.describe()}`);
        let result;
        try {
          result = await runAdd(resolver, slug, {
            projectRoot,
            force: !!opts.force,
            dryRun: !!opts.dryRun,
            onConflict: async (path, existing, incoming): Promise<ConflictResolution> =>
              promptConflict(path, existing, incoming),
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

  cli.help();
  cli.version(VERSION);
  cli.parse(argv, { run: false });

  if (!cli.matchedCommand && argv.slice(2).length === 0) {
    cli.outputHelp();
    return;
  }

  cli.runMatchedCommand().catch((e: unknown) => {
    logError((e as Error).message);
    exit(1);
  });
}
