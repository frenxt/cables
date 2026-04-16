import {
  convertClaudeToCodex,
  type CommandConversionMode,
  type ConvertClaudeToCodexResult,
} from "../lib/convert-claude-to-codex";

export interface RunConvertClaudeToCodexOptions {
  sourceRoot: string;
  targetRoot: string;
  force: boolean;
  dryRun: boolean;
  commandsAs: CommandConversionMode;
}

export function runConvertClaudeToCodex(options: RunConvertClaudeToCodexOptions): ConvertClaudeToCodexResult {
  return convertClaudeToCodex(options);
}
