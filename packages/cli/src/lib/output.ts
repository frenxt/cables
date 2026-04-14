import pc from "picocolors";
import { select, intro, outro, isCancel, cancel, spinner as clackSpinner } from "@clack/prompts";
import { createTwoFilesPatch } from "diff";
import type { ConflictResolution } from "./installer";
import type { IndexEntry } from "./types";

export function banner(): void {
  intro(pc.bold(pc.cyan("frenxt — cables CLI")));
}

export function bye(message: string): void {
  outro(message);
}

export function success(message: string): void {
  console.log(`${pc.green("✓")} ${message}`);
}

export function error(message: string): void {
  console.error(`${pc.red("✗")} ${message}`);
}

export function dim(message: string): string {
  return pc.dim(message);
}

export function emphasis(message: string): string {
  return pc.bold(pc.white(message));
}

export function spinner(label: string) {
  const s = clackSpinner();
  s.start(label);
  return {
    succeed: (msg?: string) => s.stop(msg ?? label),
    fail: (msg: string) => s.stop(pc.red(msg)),
  };
}

export async function promptConflict(
  relativePath: string,
  existing: string,
  incoming: string
): Promise<ConflictResolution> {
  const patch = createTwoFilesPatch(
    `existing/${relativePath}`,
    `incoming/${relativePath}`,
    existing,
    incoming
  );
  console.log("\n" + pc.yellow(`File ${pc.bold(relativePath)} already exists. Diff:`));
  console.log(colorizeDiff(patch));
  const choice = await select<ConflictResolution>({
    message: `How should we handle ${relativePath}?`,
    options: [
      { value: "overwrite", label: "Overwrite" },
      { value: "skip", label: "Skip" },
    ],
    initialValue: "skip",
  });
  if (isCancel(choice)) {
    cancel("Install cancelled.");
    process.exit(1);
  }
  return choice;
}

function colorizeDiff(patch: string): string {
  return patch
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) return pc.green(line);
      if (line.startsWith("-") && !line.startsWith("---")) return pc.red(line);
      if (line.startsWith("@@")) return pc.cyan(line);
      return line;
    })
    .join("\n");
}

export function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const sep = widths.map((w) => "─".repeat(w + 2)).join("┼");
  const formatRow = (row: string[]): string =>
    row.map((cell, i) => ` ${(cell ?? "").padEnd(widths[i])} `).join("│");
  return [formatRow(headers.map((h) => pc.bold(h))), sep, ...rows.map(formatRow)].join("\n");
}

export function renderEntryOneLine(entry: IndexEntry): string {
  const day = entry.day !== null ? pc.dim(`Day ${entry.day} · `) : "";
  const slug = pc.cyan(entry.slug);
  const type = entry.artifact_type ? pc.yellow(`[${entry.artifact_type}]`) : pc.dim("[tutorial]");
  const title = entry.title;
  return `${day}${slug} ${type} ${title}`;
}
