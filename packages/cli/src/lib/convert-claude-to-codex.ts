import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export interface ConvertClaudeToCodexOptions {
  sourceRoot: string;
  targetRoot: string;
  force: boolean;
  dryRun: boolean;
}

export interface ConvertClaudeToCodexResult {
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
  const normalized = normalizeNewline(content);
  // Keep the original skill content and only rewrite obvious Claude paths.
  return ensureTrailingNewline(
    normalized
      .replaceAll(".claude/skills", ".agents/skills")
      .replaceAll("~/.claude/skills", "~/.agents/skills")
      .replaceAll("CLAUDE.md", "AGENTS.md")
  );
}

function transformCommand(content: string): string {
  const normalized = normalizeNewline(content);
  const header = [
    "<!--",
    "Converted from a Claude Code slash command.",
    "Codex treats this file as a custom prompt in .codex/prompts/.",
    "-->",
    "",
  ].join("\n");
  return ensureTrailingNewline(
    (header + normalized)
      .replaceAll(".claude/commands", ".codex/prompts")
      .replaceAll("~/.claude/commands", "~/.codex/prompts")
      .replaceAll("CLAUDE.md", "AGENTS.md")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((s) => s.trim()).filter(Boolean);
}

function splitCommandPrefix(command: string): string[] {
  return command
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseClaudePermissionEntry(entry: string): string[] | null {
  const trimmed = entry.trim();
  const bashMatch = trimmed.match(/^Bash\((.+)\)$/);
  if (!bashMatch) return null;
  const inner = bashMatch[1].trim();
  if (inner.length === 0) return null;
  const commandPart = inner.includes(":") ? inner.slice(0, inner.indexOf(":")) : inner;
  const wildcardStripped = commandPart.replace(/\*+$/g, "").trim();
  if (!wildcardStripped) return null;
  const prefix = splitCommandPrefix(wildcardStripped);
  return prefix.length > 0 ? prefix : null;
}

function toRulesLiteral(prefix: string[]): string {
  const items = prefix.map((p) => JSON.stringify(p)).join(", ");
  return `[${items}]`;
}

function buildRulesFile(settingsPath: string): { content: string | null; warnings: string[] } {
  if (!existsSync(settingsPath)) return { content: null, warnings: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (e) {
    return {
      content: null,
      warnings: [`Could not parse ${settingsPath}: ${(e as Error).message}`],
    };
  }
  if (!isRecord(raw)) {
    return { content: null, warnings: [`${settingsPath} is not a JSON object; skipping permissions conversion.`] };
  }

  const permissions = isRecord(raw.permissions) ? raw.permissions : {};
  const allowList = stringArray(permissions.allow ?? permissions.allowed);
  const denyList = stringArray(permissions.deny ?? permissions.denied);
  const promptList = stringArray(permissions.ask ?? permissions.prompt);

  const lines: string[] = [
    "# Converted from .claude/settings.json",
    "# See: https://developers.openai.com/codex/rules",
    "",
  ];
  const warnings: string[] = [];
  const seen = new Set<string>();

  function addEntries(entries: string[], decision: "allow" | "prompt" | "forbidden", label: string) {
    for (const entry of entries) {
      const prefix = parseClaudePermissionEntry(entry);
      if (!prefix) {
        warnings.push(`Skipped ${label} permission "${entry}" (only Bash(...) patterns are auto-converted).`);
        continue;
      }
      const key = `${decision}:${prefix.join("\u0000")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`prefix_rule(${toRulesLiteral(prefix)}, decision = "${decision}")`);
    }
  }

  addEntries(allowList, "allow", "allow");
  addEntries(promptList, "prompt", "ask");
  addEntries(denyList, "forbidden", "deny");

  if (lines.length === 3) {
    warnings.push(`No convertible permissions found in ${settingsPath}.`);
    return { content: null, warnings };
  }
  lines.push("");
  return { content: lines.join("\n"), warnings };
}

function buildAgentsFile(claudeSources: Array<{ path: string; content: string }>): string | null {
  if (claudeSources.length === 0) return null;
  const sections: string[] = [
    "# AGENTS.md",
    "",
    "This file was generated from Claude Code instructions.",
    "",
  ];
  for (const source of claudeSources) {
    sections.push(`## Source: ${source.path}`);
    sections.push("");
    sections.push(ensureTrailingNewline(normalizeNewline(source.content)).trimEnd());
    sections.push("");
  }
  return ensureTrailingNewline(sections.join("\n"));
}

function buildPlan(sourceRoot: string): { writes: PlannedWrite[]; warnings: string[] } {
  const writes: PlannedWrite[] = [];
  const warnings: string[] = [];

  const skillsRoot = join(sourceRoot, ".claude", "skills");
  for (const file of walkFiles(skillsRoot)) {
    if (!file.endsWith("/SKILL.md")) continue;
    const rel = relative(skillsRoot, dirname(file));
    const target = rel.length > 0 ? join(".agents", "skills", rel, "SKILL.md") : join(".agents", "skills", "SKILL.md");
    writes.push({
      source: relative(sourceRoot, file),
      target,
      content: transformSkill(readFileSync(file, "utf8")),
    });
  }

  const commandsRoot = join(sourceRoot, ".claude", "commands");
  for (const file of walkFiles(commandsRoot)) {
    if (!file.endsWith(".md")) continue;
    const rel = relative(commandsRoot, file);
    writes.push({
      source: relative(sourceRoot, file),
      target: join(".codex", "prompts", rel),
      content: transformCommand(readFileSync(file, "utf8")),
    });
  }

  const claudeMdPaths = [join(sourceRoot, "CLAUDE.md"), join(sourceRoot, ".claude", "CLAUDE.md")];
  const claudeSources: Array<{ path: string; content: string }> = [];
  for (const path of claudeMdPaths) {
    if (!existsSync(path) || !statSync(path).isFile()) continue;
    claudeSources.push({
      path: relative(sourceRoot, path),
      content: readFileSync(path, "utf8"),
    });
  }
  const agentsContent = buildAgentsFile(claudeSources);
  if (agentsContent) {
    writes.push({
      source: "CLAUDE.md/.claude/CLAUDE.md",
      target: "AGENTS.md",
      content: agentsContent,
    });
  }

  const settingsPath = join(sourceRoot, ".claude", "settings.json");
  const { content: rulesContent, warnings: rulesWarnings } = buildRulesFile(settingsPath);
  warnings.push(...rulesWarnings);
  if (rulesContent) {
    writes.push({
      source: relative(sourceRoot, settingsPath),
      target: join(".codex", "rules", "default.rules"),
      content: rulesContent,
    });
  }

  if (writes.length === 0) {
    warnings.push(
      `Nothing to convert in ${sourceRoot}. Expected at least one of: .claude/skills, .claude/commands, CLAUDE.md, .claude/CLAUDE.md, .claude/settings.json`
    );
  }

  return { writes, warnings };
}

export function convertClaudeToCodex(options: ConvertClaudeToCodexOptions): ConvertClaudeToCodexResult {
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
