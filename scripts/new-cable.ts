import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffoldEntry } from "./lib/scaffold";

async function ask(rl: ReturnType<typeof createInterface>, question: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback || "";
}

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    const title = await ask(rl, "Title (required)");
    if (!title) throw new Error("title is required");
    const slug = await ask(rl, "Slug (kebab-case, e.g. day-02-claude-md)");
    if (!slug) throw new Error("slug is required");
    const track = await ask(rl, "Track", "fundamentals");
    const category = await ask(rl, "Category (e.g. configuration, testing, debugging)");
    const difficulty = await ask(rl, "Difficulty (beginner|intermediate|advanced)", "beginner");
    const dayRaw = await ask(rl, "Day number (blank for reference-only)");
    const artifactRaw = await ask(
      rl,
      "Artifact type (claude-md|skill|subagent|slash-command|blank for none)"
    );
    const folder = scaffoldEntry({
      contentRoot: join(repoRoot(), "content"),
      tool: "claude-code",
      slug,
      title,
      track,
      category,
      difficulty: difficulty as "beginner" | "intermediate" | "advanced",
      day: dayRaw ? parseInt(dayRaw, 10) : null,
      artifact_type: (artifactRaw || null) as
        | "claude-md"
        | "skill"
        | "subagent"
        | "slash-command"
        | null,
      last_verified: todayISO(),
    });
    console.log(`✓ created ${folder}`);
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
