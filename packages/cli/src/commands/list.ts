import type { ContentResolver } from "../lib/resolver/types";
import { renderEntryOneLine } from "../lib/output";
import type { ArtifactType } from "../lib/types";

export interface ListOptions {
  category?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  artifactType?: ArtifactType;
  publisher?: string;
  tag?: string;
}

export async function runList(
  resolver: ContentResolver,
  options: ListOptions
): Promise<string> {
  const index = await resolver.getIndex();
  let entries = index.entries;

  if (options.category) {
    entries = entries.filter((e) => e.category === options.category);
  }
  if (options.difficulty) {
    entries = entries.filter((e) => e.difficulty === options.difficulty);
  }
  if (options.artifactType) {
    entries = entries.filter((e) => e.artifact_type === options.artifactType);
  }
  if (options.publisher) {
    entries = entries.filter((e) => e.publisher === options.publisher);
  }
  if (options.tag) {
    entries = entries.filter((e) => e.tags.includes(options.tag!));
  }

  if (entries.length === 0) {
    return "No cables found matching those filters.";
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.day !== null && b.day !== null) return a.day - b.day;
    return a.slug.localeCompare(b.slug);
  });

  const header = `Found ${sorted.length} cable${sorted.length === 1 ? "" : "s"}:`;
  const lines = sorted.map((e) => `  ${renderEntryOneLine(e)}`);
  return [header, ...lines].join("\n");
}
