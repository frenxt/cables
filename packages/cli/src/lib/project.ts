import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export type SupportedProjectTool = "claude-code" | "codex";

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

export function detectClaudeCodeProject(cwd: string): boolean {
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) return false;
  const claudeMd = join(cwd, "CLAUDE.md");
  const claudeDir = join(cwd, ".claude");
  if (isFile(claudeMd)) return true;
  if (isDirectory(claudeDir)) return true;
  return false;
}

export function detectCodexProject(cwd: string): boolean {
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) return false;
  const agentsMd = join(cwd, "AGENTS.md");
  const codexDir = join(cwd, ".codex");
  const agentsDir = join(cwd, ".agents");
  if (isFile(agentsMd)) return true;
  if (isDirectory(codexDir)) return true;
  if (isDirectory(agentsDir)) return true;
  return false;
}

export function detectSupportedProject(cwd: string): SupportedProjectTool | null {
  const isClaude = detectClaudeCodeProject(cwd);
  const isCodex = detectCodexProject(cwd);
  if (isClaude) return "claude-code";
  if (isCodex) return "codex";
  return null;
}

export function resolveTargetTool(
  cwd: string,
  requested: string | undefined
): SupportedProjectTool {
  const normalized = (requested ?? "auto").trim().toLowerCase();
  if (normalized === "claude" || normalized === "claude-code") return "claude-code";
  if (normalized === "codex") return "codex";
  if (normalized !== "auto") {
    throw new Error(`Unknown --tool value "${requested}". Use "auto", "claude-code", or "codex".`);
  }
  return detectSupportedProject(cwd) ?? "claude-code";
}
