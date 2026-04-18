import type { Registry } from "./types";

// Resolves a scoped or bare community-stack slug to an installable Registry by
// fetching the submission pointer from frenxt/cables and then the publisher's
// .cables/stack.json at the pinned ref.

const CABLES_REPO = "frenxt/cables";
const GH_RAW = "https://raw.githubusercontent.com";

export interface ParsedSlug {
  kind: "scoped" | "bare";
  handle: string | null;
  slug: string;
}

export interface CommunityStackSource {
  submission: CommunitySubmission;
  stackJsonUrl: string;
}

export interface ResolvedCommunityStack {
  registry: Registry;
  files: Map<string, string>;
  source: CommunityStackSource;
}

interface CommunitySubmission {
  schema_version: number;
  slug: string;
  repo: string;
  ref: string;
  submitted_by: string;
}

interface CommunityStackManifest {
  schema_version: number;
  slug: string;
  title?: string;
  description?: string;
  version: string;
  marketplaces?: { name: string; source: string }[];
  claude_plugins?: string[];
  // codex_plugins is still accepted in submitted manifests for schema
  // compatibility but the CLI no longer installs/enables them. Each provider
  // gets its own stack going forward.
  codex_plugins?: string[];
  skills?: string[];
}

/**
 * Parse `@handle/slug` or a bare `slug`. Returns null for inputs that look
 * neither like a first-party slug (starts with a letter/number) nor a scoped
 * community slug (starts with @).
 */
export function parseSlug(input: string): ParsedSlug | null {
  const scoped = input.match(
    /^@([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/,
  );
  if (scoped) {
    return { kind: "scoped", handle: scoped[1], slug: scoped[2] };
  }
  const bare = input.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  if (bare) {
    return { kind: "bare", handle: null, slug: input };
  }
  return null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const text = await fetchText(url);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function fetchSubmission(
  parsed: ParsedSlug,
): Promise<CommunitySubmission | null> {
  const candidates =
    parsed.kind === "scoped"
      ? [`${GH_RAW}/${CABLES_REPO}/main/community-stacks/${parsed.handle}/${parsed.slug}.json`]
      : [
          `${GH_RAW}/${CABLES_REPO}/main/community-stacks/${parsed.slug}.json`,
        ];
  for (const url of candidates) {
    const submission = await fetchJson<CommunitySubmission>(url);
    if (submission && submission.schema_version === 1 && submission.repo) {
      return submission;
    }
  }
  return null;
}

/**
 * Fetch the publisher's .cables/stack.json and synthesize an installable
 * Registry from it. Bundled skills are fetched inline so the installer can
 * write them to the user's project.
 */
export async function resolveCommunityStack(
  parsed: ParsedSlug,
): Promise<ResolvedCommunityStack | null> {
  const submission = await fetchSubmission(parsed);
  if (!submission) return null;

  const stackJsonUrl = `${GH_RAW}/${submission.repo}/${submission.ref}/.cables/stack.json`;
  const manifest = await fetchJson<CommunityStackManifest>(stackJsonUrl);
  if (!manifest || manifest.schema_version !== 1) {
    throw new Error(
      `Resolved submission pointer but stack.json at ${stackJsonUrl} is missing or malformed.`,
    );
  }

  // Collect bundled skills from the publisher repo.
  const files = new Map<string, string>();
  const registryFiles: Registry["files"] = [];
  for (const skillSlug of manifest.skills ?? []) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(skillSlug)) continue;
    const url = `${GH_RAW}/${submission.repo}/${submission.ref}/.claude/skills/${skillSlug}/SKILL.md`;
    const content = await fetchText(url);
    if (content === null) continue;
    const source = `skills/${skillSlug}/SKILL.md`;
    files.set(source, content);
    registryFiles.push({
      source,
      target: `.claude/skills/${skillSlug}/SKILL.md`,
      action: "copy",
      on_conflict: "prompt",
    });
  }

  // Give the installer *something* to write even if the stack ships only
  // plugins — a thin SKILL.md that identifies the installed stack.
  if (registryFiles.length === 0) {
    const stub = `---\nname: ${manifest.slug}\ndescription: ${manifest.description ?? manifest.slug}\n---\n\n# ${manifest.title ?? manifest.slug}\n\nInstalled from ${submission.repo}@${submission.ref}.\n`;
    const source = `${manifest.slug}/SKILL.md`;
    files.set(source, stub);
    registryFiles.push({
      source,
      target: `.claude/skills/${manifest.slug}/SKILL.md`,
      action: "copy",
      on_conflict: "prompt",
    });
  }

  const registry: Registry = {
    slug: manifest.slug,
    artifact_type: "skill",
    version: manifest.version,
    requires: [],
    files: registryFiles,
    post_install_notes: `Community stack from ${submission.repo}@${submission.ref}.`,
    stack: {
      marketplaces: manifest.marketplaces ?? [],
      claude_plugins: manifest.claude_plugins ?? [],
      // codex_plugins from the manifest are intentionally dropped — each
      // provider gets its own stack.
      sync_skills_from: ".claude/skills",
    },
  };

  return {
    registry,
    files,
    source: { submission, stackJsonUrl },
  };
}
