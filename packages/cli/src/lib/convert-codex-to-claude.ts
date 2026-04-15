import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export interface ConvertCodexToClaudeOptions {
  sourceRoot: string;
  targetRoot: string;
  force: boolean;
  dryRun: boolean;
}

export interface ConvertCodexToClaudeResult {
  plannedWrites: string[];
  writtenFiles: string[];
  skippedFiles: string[];
  warnings: string[];
}

interface PlannedWrite {
  source: string;
  target: string;
  content: string;
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const queue: string[] = [root];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(abs);
      } else if (entry.isFile()) {
        out.push(abs);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function normalizeNewline(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function transformSkill(content: string): string {
  return ensureTrailingNewline(
    normalizeNewline(content)
      .replaceAll(".agents/skills", ".claude/skills")
      .replaceAll("~/.agents/skills", "~/.claude/skills")
      .replaceAll("AGENTS.md", "CLAUDE.md")
  );
}

function transformPrompt(content: string): string {
  const normalized = normalizeNewline(content);
  const withoutConverterHeader = normalized.replace(
    /^<!--\nConverted from a Claude Code slash command\.\nCodex treats this file as a custom prompt in \.codex\/prompts\/\.\n-->\n\n/,
    ""
  );
  return ensureTrailingNewline(
    withoutConverterHeader
      .replaceAll(".codex/prompts", ".claude/commands")
      .replaceAll("~/.codex/prompts", "~/.claude/commands")
      .replaceAll("AGENTS.md", "CLAUDE.md")
  );
}

function parsePrefixRule(line: string): { command: string[]; decision: "allow" | "prompt" | "forbidden" } | null {
  const trimmed = line.trim();
  const match = trimmed.match(
    /^prefix_rule\(\s*(\[[^\]]*\])\s*,\s*decision\s*=\s*"(allow|prompt|forbidden)"\s*\)\s*$/
  );
  if (!match) return null;
  const listLiteral = match[1];
  const decision = match[2] as "allow" | "prompt" | "forbidden";
  try {
    const command = JSON.parse(listLiteral) as unknown;
    if (!Array.isArray(command) || !command.every((item) => typeof item === "string")) {
      return null;
    }
    return { command, decision };
  } catch {
    return null;
  }
}

function toClaudePermission(command: string[]): string {
  return `Bash(${command.join(" ")}:*)`;
}

function buildSettingsFromRules(rulesPath: string): { content: string | null; warnings: string[] } {
  if (!existsSync(rulesPath)) return { content: null, warnings: [] };
  const warnings: string[] = [];
  const allow = new Set<string>();
  const ask = new Set<string>();
  const deny = new Set<string>();
  const raw = normalizeNewline(readFileSync(rulesPath, "utf8"));

  for (const line of raw.split("\n")) {
    const parsed = parsePrefixRule(line);
    if (!parsed) continue;
    const permission = toClaudePermission(parsed.command);
    if (parsed.decision === "allow") allow.add(permission);
    if (parsed.decision === "prompt") ask.add(permission);
    if (parsed.decision === "forbidden") deny.add(permission);
  }

  if (allow.size === 0 && ask.size === 0 && deny.size === 0) {
    warnings.push(`No convertible prefix_rule entries found in ${rulesPath}.`);
    return { content: null, warnings };
  }

  const settings = {
    permissions: {
      allow: Array.from(allow).sort(),
      ask: Array.from(ask).sort(),
      deny: Array.from(deny).sort(),
    },
  };
  return { content: JSON.stringify(settings, null, 2) + "\n", warnings };
}

function buildClaudeMdFromAgents(path: string): string | null {
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  const raw = normalizeNewline(readFileSync(path, "utf8"));
  const strippedTitle = raw.startsWith("# AGENTS.md\n")
    ? raw.replace(/^# AGENTS\.md\n/, "# CLAUDE.md\n")
    : raw;
  const header = [
    "<!--",
    "Converted from AGENTS.md.",
    "-->",
    "",
  ].join("\n");
  return ensureTrailingNewline(header + strippedTitle.replaceAll("AGENTS.md", "CLAUDE.md"));
}

function buildPlan(sourceRoot: string): { writes: PlannedWrite[]; warnings: string[] } {
  const writes: PlannedWrite[] = [];
  const warnings: string[] = [];

  const skillsRoot = join(sourceRoot, ".agents", "skills");
  for (const file of walkFiles(skillsRoot)) {
    if (!file.endsWith("/SKILL.md")) continue;
    const rel = relative(skillsRoot, dirname(file));
    const target = rel.length > 0 ? join(".claude", "skills", rel, "SKILL.md") : join(".claude", "skills", "SKILL.md");
    writes.push({
      source: relative(sourceRoot, file),
      target,
      content: transformSkill(readFileSync(file, "utf8")),
    });
  }

  const promptsRoot = join(sourceRoot, ".codex", "prompts");
  for (const file of walkFiles(promptsRoot)) {
    if (!file.endsWith(".md")) continue;
    const rel = relative(promptsRoot, file);
    writes.push({
      source: relative(sourceRoot, file),
      target: join(".claude", "commands", rel),
      content: transformPrompt(readFileSync(file, "utf8")),
    });
  }

  const claudeMd = buildClaudeMdFromAgents(join(sourceRoot, "AGENTS.md"));
  if (claudeMd) {
    writes.push({
      source: "AGENTS.md",
      target: "CLAUDE.md",
      content: claudeMd,
    });
  }

  const rulesPath = join(sourceRoot, ".codex", "rules", "default.rules");
  const { content: settingsContent, warnings: settingsWarnings } = buildSettingsFromRules(rulesPath);
  warnings.push(...settingsWarnings);
  if (settingsContent) {
    writes.push({
      source: relative(sourceRoot, rulesPath),
      target: join(".claude", "settings.json"),
      content: settingsContent,
    });
  }

  if (writes.length === 0) {
    warnings.push(
      `Nothing to convert in ${sourceRoot}. Expected at least one of: .agents/skills, .codex/prompts, AGENTS.md, .codex/rules/default.rules`
    );
  }

  return { writes, warnings };
}

export function convertCodexToClaude(options: ConvertCodexToClaudeOptions): ConvertCodexToClaudeResult {
  const sourceRoot = resolve(options.sourceRoot);
  const targetRoot = resolve(options.targetRoot);
  const { writes, warnings } = buildPlan(sourceRoot);
  const plannedWrites = writes.map((w) => w.target);
  const writtenFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const write of writes) {
    const absTarget = join(targetRoot, write.target);
    const exists = existsSync(absTarget);
    if (exists && !options.force) {
      skippedFiles.push(write.target);
      warnings.push(`Skipped existing file ${write.target} (use --force to overwrite).`);
      continue;
    }
    if (options.dryRun) {
      writtenFiles.push(write.target);
      continue;
    }
    mkdirSync(dirname(absTarget), { recursive: true });
    writeFileSync(absTarget, write.content, "utf8");
    writtenFiles.push(write.target);
  }

  return { plannedWrites, writtenFiles, skippedFiles, warnings };
}
