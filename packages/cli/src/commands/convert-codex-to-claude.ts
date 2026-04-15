import { convertCodexToClaude, type ConvertCodexToClaudeResult } from "../lib/convert-codex-to-claude";

export interface RunConvertCodexToClaudeOptions {
  sourceRoot: string;
  targetRoot: string;
  force: boolean;
  dryRun: boolean;
}

export function runConvertCodexToClaude(options: RunConvertCodexToClaudeOptions): ConvertCodexToClaudeResult {
  return convertCodexToClaude(options);
}
