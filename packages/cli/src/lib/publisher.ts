import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ImportManifestSchema, type ImportManifest } from "../../../../schema/publisher";
import { loadEntry } from "../../../../scripts/lib/load-entry";

const KEBAB_CASE_REGEX = /^[a-z0-9-]+$/;
const GITHUB_REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export interface PublisherLocalConfig {
  publisher_id: string;
  repo: string;
  default_branch: string;
}

export interface GitClient {
  getHeadSha(repoRoot: string): string;
  getOriginUrl(repoRoot: string): string | null;
}

export interface PublisherInitOptions {
  repoRoot: string;
  publisherId: string;
  repo?: string;
  defaultBranch?: string;
  force?: boolean;
  gitClient?: GitClient;
}

export interface PublisherInitResult {
  config: PublisherLocalConfig;
  path: string;
}

export interface PublisherPackOptions {
  repoRoot: string;
  slug: string;
  tool: string;
  outputPath?: string;
  publisherId?: string;
  gitClient?: GitClient;
}

export interface PublisherPackResult {
  entryFolder: string;
  manifest: ImportManifest;
  manifestJson: string;
  outputPath: string | null;
}

export interface PublisherSubmitOptions {
  repoRoot: string;
  slug: string;
  tool: string;
  publisherId?: string;
  manifestOutputPath?: string;
  prBodyOutputPath?: string;
  registryRepo?: string;
  registryRoot?: string;
  prepareCommit?: boolean;
  branchName?: string;
  commitMessage?: string;
  gitClient?: GitClient;
}

export interface PublisherSubmitResult {
  packResult: PublisherPackResult;
  manifestPath: string;
  prBodyPath: string;
  prBody: string;
  centralManifestPath: string;
  registryRepo: string;
  registryManifestPath: string | null;
  branchName: string | null;
  commitMessage: string | null;
}

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function ensureCleanSourceState(repoRoot: string, relativePath: string): void {
  const status = runGit(repoRoot, ["status", "--porcelain", "--", relativePath]);
  if (status.length > 0) {
    throw new Error(
      `working tree has uncommitted changes under ${relativePath}. Commit or stash them before packing a pinned import manifest.`
    );
  }
}

export const defaultGitClient: GitClient = {
  getHeadSha(repoRoot) {
    return runGit(repoRoot, ["rev-parse", "HEAD"]);
  },
  getOriginUrl(repoRoot) {
    try {
      const value = runGit(repoRoot, ["config", "--get", "remote.origin.url"]);
      return value.length > 0 ? value : null;
    } catch {
      return null;
    }
  },
};

export function normalizeGitHubRepo(input: string): string | null {
  const value = input.trim().replace(/\.git$/i, "");
  if (GITHUB_REPO_REGEX.test(value)) {
    return value;
  }

  const scpLike = value.match(/^git@github\.com:([^/]+\/[^/]+)$/i);
  if (scpLike) {
    return scpLike[1];
  }

  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const path = url.pathname.replace(/^\/+/, "");
    return GITHUB_REPO_REGEX.test(path) ? path : null;
  } catch {
    return null;
  }
}

function assertPublisherId(value: string): string {
  const trimmed = value.trim();
  if (!KEBAB_CASE_REGEX.test(trimmed)) {
    throw new Error(`publisher id must be kebab-case; received "${value}"`);
  }
  return trimmed;
}

function assertGitHubRepo(value: string): string {
  const normalized = normalizeGitHubRepo(value);
  if (!normalized) {
    throw new Error(
      `repo must point to a GitHub repository in owner/repo format; received "${value}"`
    );
  }
  return normalized;
}

function assertDefaultBranch(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("default branch cannot be empty");
  }
  return trimmed;
}

function configPath(repoRoot: string): string {
  return join(resolve(repoRoot), ".cables", "publisher.json");
}

function parsePublisherConfig(raw: unknown, source: string): PublisherLocalConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error(`publisher config at ${source} must be a JSON object`);
  }

  const value = raw as Record<string, unknown>;
  if (typeof value.publisher_id !== "string") {
    throw new Error(`publisher config at ${source} is missing string field "publisher_id"`);
  }
  if (typeof value.repo !== "string") {
    throw new Error(`publisher config at ${source} is missing string field "repo"`);
  }
  if (typeof value.default_branch !== "string") {
    throw new Error(`publisher config at ${source} is missing string field "default_branch"`);
  }

  return {
    publisher_id: assertPublisherId(value.publisher_id),
    repo: assertGitHubRepo(value.repo),
    default_branch: assertDefaultBranch(value.default_branch),
  };
}

export function loadPublisherConfig(repoRoot: string): PublisherLocalConfig {
  const path = configPath(repoRoot);
  if (!existsSync(path)) {
    throw new Error(
      `publisher config not found at ${path}. Run "frenxt publisher init --publisher <id>" first.`
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`publisher config at ${path} is not valid JSON: ${(e as Error).message}`);
  }

  return parsePublisherConfig(raw, path);
}

export function initPublisherConfig(options: PublisherInitOptions): PublisherInitResult {
  const repoRoot = resolve(options.repoRoot);
  const path = configPath(repoRoot);
  if (existsSync(path) && !options.force) {
    throw new Error(`publisher config already exists at ${path}. Re-run with --force to overwrite it.`);
  }

  const gitClient = options.gitClient ?? defaultGitClient;
  const inferredRepo = options.repo ?? gitClient.getOriginUrl(repoRoot);
  if (!inferredRepo) {
    throw new Error(
      "could not infer repo from git remote.origin.url. Pass --repo <owner/repo> explicitly."
    );
  }

  const config: PublisherLocalConfig = {
    publisher_id: assertPublisherId(options.publisherId),
    repo: assertGitHubRepo(inferredRepo),
    default_branch: assertDefaultBranch(options.defaultBranch ?? "main"),
  };

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
  return { config, path };
}

export function packPublisherManifest(options: PublisherPackOptions): PublisherPackResult {
  const repoRoot = resolve(options.repoRoot);
  const gitClient = options.gitClient ?? defaultGitClient;
  const config = loadPublisherConfig(repoRoot);
  const publisherId = assertPublisherId(options.publisherId ?? config.publisher_id);
  const tool = options.tool.trim();
  const slug = options.slug.trim();
  const relativeEntryPath = `content/${tool}/${slug}`;
  const entryFolder = join(repoRoot, "content", tool, slug);

  ensureCleanSourceState(repoRoot, relativeEntryPath);
  loadEntry(entryFolder);

  const manifestCandidate = {
    publisher_id: publisherId,
    slug,
    tool,
    source: {
      repo: config.repo,
      ref: gitClient.getHeadSha(repoRoot),
      path: `content/${tool}/${slug}`,
    },
  };
  const parsed = ImportManifestSchema.safeParse(manifestCandidate);
  if (!parsed.success) {
    throw new Error(
      `generated import manifest is invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`
    );
  }

  const manifest = parsed.data;
  const manifestJson = JSON.stringify(manifest, null, 2) + "\n";
  let outputPath: string | null = null;
  if (options.outputPath) {
    outputPath = resolve(repoRoot, options.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, manifestJson, "utf8");
  }

  return {
    entryFolder,
    manifest,
    manifestJson,
    outputPath,
  };
}

function buildPrBody(
  packResult: PublisherPackResult,
  registryRepo: string
): string {
  const { manifest } = packResult;
  const entry = loadEntry(packResult.entryFolder);
  const centralManifestPath = `imports/${manifest.publisher_id}/${manifest.slug}.json`;
  const artifactFiles = entry.registry?.files.length ?? 0;
  const artifactType = entry.frontmatter.artifact_type ?? "tutorial-only";

  return [
    "## Summary",
    "",
    `- publisher: ${manifest.publisher_id}`,
    `- cable slug: ${manifest.slug}`,
    `- tool: ${manifest.tool}`,
    `- source repo: ${manifest.source.repo}`,
    `- source commit SHA: ${manifest.source.ref}`,
    `- artifact type: ${artifactType}`,
    `- artifact files: ${artifactFiles}`,
    `- target manifest path in \`${registryRepo}\`: \`${centralManifestPath}\``,
    "",
    "## Checklist",
    "",
    "- [ ] I ran `npx frenxt-cables publisher pack --tool <tool> --slug <slug>` against this exact commit",
    `- [ ] The PR adds or updates \`${centralManifestPath}\` only for this cable`,
    "- [ ] The source commit SHA is immutable and pinned to a 40-character commit",
    "- [ ] The cable body is ready for review (house voice + sources)",
    "- [ ] The artifact only writes to approved install roots (`CLAUDE.md`, `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/stacks/`)",
    "- [ ] The artifact does not include blocked binary payloads",
    "",
    "## Notes For Reviewers",
    "",
    "- New publisher approval needed:",
    "- Trust-tier notes:",
  ].join("\n") + "\n";
}

function runGitInRepo(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function ensureGitRepo(repoRoot: string): void {
  try {
    runGitInRepo(repoRoot, ["rev-parse", "--show-toplevel"]);
  } catch {
    throw new Error(`registry root is not a git repository: ${repoRoot}`);
  }
}

function createOrResetBranch(repoRoot: string, branchName: string): void {
  runGitInRepo(repoRoot, ["checkout", "-B", branchName]);
}

function commitFile(repoRoot: string, relativePath: string, commitMessage: string): void {
  runGitInRepo(repoRoot, ["add", relativePath]);
  try {
    runGitInRepo(repoRoot, ["commit", "-m", commitMessage]);
  } catch (e) {
    const message = (e as Error).message;
    if (/nothing to commit|no changes added to commit/i.test(message)) {
      return;
    }
    throw e;
  }
}

export function submitPublisherManifest(options: PublisherSubmitOptions): PublisherSubmitResult {
  const repoRoot = resolve(options.repoRoot);
  const packPreview = packPublisherManifest({
    repoRoot,
    slug: options.slug,
    tool: options.tool,
    publisherId: options.publisherId,
    gitClient: options.gitClient,
  });

  const centralManifestPath = `imports/${packPreview.manifest.publisher_id}/${packPreview.manifest.slug}.json`;
  const submissionRoot = join(repoRoot, ".cables", "submissions", packPreview.manifest.slug);
  const manifestOutputPath = options.manifestOutputPath ?? join(submissionRoot, centralManifestPath);
  const prBodyOutputPath = options.prBodyOutputPath ?? join(submissionRoot, "pr-body.md");
  const registryRepo = (options.registryRepo ?? "frenxt/cables").trim();
  const registryRoot = options.registryRoot ? resolve(repoRoot, options.registryRoot) : null;

  const packResult = packPublisherManifest({
    repoRoot,
    slug: options.slug,
    tool: options.tool,
    publisherId: options.publisherId,
    outputPath: manifestOutputPath,
    gitClient: options.gitClient,
  });

  const prBody = buildPrBody(packResult, registryRepo);
  const resolvedPrBodyPath = resolve(repoRoot, prBodyOutputPath);
  mkdirSync(dirname(resolvedPrBodyPath), { recursive: true });
  writeFileSync(resolvedPrBodyPath, prBody, "utf8");

  let registryManifestPath: string | null = null;
  let branchName: string | null = null;
  let commitMessage: string | null = null;

  if (registryRoot) {
    ensureGitRepo(registryRoot);
    registryManifestPath = join(registryRoot, centralManifestPath);
    mkdirSync(dirname(registryManifestPath), { recursive: true });
    writeFileSync(registryManifestPath, packResult.manifestJson, "utf8");

    if (options.prepareCommit) {
      branchName =
        options.branchName?.trim() || `publisher/${packResult.manifest.publisher_id}-${packResult.manifest.slug}`;
      commitMessage =
        options.commitMessage?.trim() ||
        `feat(imports): add ${packResult.manifest.slug} from ${packResult.manifest.publisher_id}`;
      createOrResetBranch(registryRoot, branchName);
      commitFile(registryRoot, centralManifestPath, commitMessage);
    }
  } else if (options.prepareCommit) {
    throw new Error("--prepare-commit requires --registry-root <path>.");
  }

  return {
    packResult,
    manifestPath: packResult.outputPath!,
    prBodyPath: resolvedPrBodyPath,
    prBody,
    centralManifestPath,
    registryRepo,
    registryManifestPath,
    branchName,
    commitMessage,
  };
}
