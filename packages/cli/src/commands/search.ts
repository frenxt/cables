import type { ContentResolver } from "../lib/resolver/types";
import { renderEntryOneLine } from "../lib/output";

export async function runSearch(
  resolver: ContentResolver,
  query: string
): Promise<string> {
  const index = await resolver.getIndex();
  const needle = query.toLowerCase();

  const matches = index.entries.filter((e) => {
    if (e.title.toLowerCase().includes(needle)) return true;
    if (e.slug.toLowerCase().includes(needle)) return true;
    if (e.tags.some((t) => t.toLowerCase().includes(needle))) return true;
    if (e.category.toLowerCase().includes(needle)) return true;
    return false;
  });

  if (matches.length === 0) {
    return `No cables matched "${query}".`;
  }

  const header = `Found ${matches.length} cable${matches.length === 1 ? "" : "s"} matching "${query}":`;
  const lines = matches.map((e) => `  ${renderEntryOneLine(e)}`);
  return [header, ...lines].join("\n");
}
