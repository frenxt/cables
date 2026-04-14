import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export function detectClaudeCodeProject(cwd: string): boolean {
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) return false;
  const claudeMd = join(cwd, "CLAUDE.md");
  const claudeDir = join(cwd, ".claude");
  if (existsSync(claudeMd) && statSync(claudeMd).isFile()) return true;
  if (existsSync(claudeDir) && statSync(claudeDir).isDirectory()) return true;
  return false;
}
