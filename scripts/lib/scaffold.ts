import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type ArtifactType = "claude-md" | "skill" | "subagent" | "slash-command";

export interface ScaffoldOptions {
  contentRoot: string;
  tool: string;
  slug: string;
  title: string;
  track: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  day: number | null;
  artifact_type: ArtifactType | null;
  last_verified: string;
}

function frontmatter(opts: ScaffoldOptions): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: "${opts.title}"`);
  lines.push(`slug: "${opts.slug}"`);
  lines.push(`tool: "${opts.tool}"`);
  lines.push(`track: "${opts.track}"`);
  if (opts.day !== null) lines.push(`day: ${opts.day}`);
  lines.push(`category: "${opts.category}"`);
  lines.push(`difficulty: "${opts.difficulty}"`);
  lines.push(`last_verified: "${opts.last_verified}"`);
  lines.push(`contributors: ["@TODO-your-handle"]`);
  if (opts.artifact_type !== null) lines.push(`artifact_type: "${opts.artifact_type}"`);
  lines.push("---");
  return lines.join("\n");
}

function body(opts: ScaffoldOptions): string {
  return [
    "",
    "",
    `# ${opts.title}`,
    "",
    "_Lead with a real moment. What happened on a real project that made this cable necessary?_",
    "",
    "## What we tried",
    "",
    "_Describe what we did and why, in first person plural._",
    "",
    "## What happened",
    "",
    "_Describe the outcome honestly, including what broke._",
    "",
    "## What we learned",
    "",
    "_Pull out the reusable lesson._",
    "",
  ].join("\n");
}

function registryJson(opts: ScaffoldOptions): string {
  if (opts.artifact_type === null) throw new Error("registryJson called without artifact_type");
  const targetByType: Record<string, string> = {
    "claude-md": "CLAUDE.md",
    skill: `.claude/skills/${opts.slug}/SKILL.md`,
    subagent: `.claude/agents/${opts.slug}.md`,
    "slash-command": `.claude/commands/${opts.slug}.md`,
  };
  const sourceByType: Record<string, string> = {
    "claude-md": "artifact/CLAUDE.md",
    skill: `artifact/SKILL.md`,
    subagent: `artifact/${opts.slug}.md`,
    "slash-command": `artifact/${opts.slug}.md`,
  };
  const registry = {
    slug: opts.slug,
    artifact_type: opts.artifact_type,
    version: "0.1.0",
    requires: [],
    files: [
      {
        source: sourceByType[opts.artifact_type],
        target: targetByType[opts.artifact_type],
        action: "copy",
        on_conflict: "prompt",
      },
    ],
  };
  return JSON.stringify(registry, null, 2) + "\n";
}

export function scaffoldEntry(opts: ScaffoldOptions): string {
  const folder = join(opts.contentRoot, opts.tool, opts.slug);
  if (existsSync(folder)) {
    throw new Error(`target folder already exists: ${folder}`);
  }
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "index.mdx"), frontmatter(opts) + body(opts), "utf8");
  if (opts.artifact_type !== null) {
    writeFileSync(join(folder, "registry.json"), registryJson(opts), "utf8");
    mkdirSync(join(folder, "artifact"), { recursive: true });
    const placeholderName =
      opts.artifact_type === "claude-md"
        ? "CLAUDE.md"
        : opts.artifact_type === "skill"
          ? "SKILL.md"
          : `${opts.slug}.md`;
    writeFileSync(
      join(folder, "artifact", placeholderName),
      `# TODO: replace with the real artifact for ${opts.slug}\n`,
      "utf8"
    );
  }
  return folder;
}
