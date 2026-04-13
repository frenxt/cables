import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export function* walkContent(contentRoot: string): Generator<string> {
  if (!existsSync(contentRoot)) return;
  const tools = readdirSync(contentRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const tool of tools) {
    const toolDir = join(contentRoot, tool.name);
    const entries = readdirSync(toolDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const entry of entries) {
      const entryDir = join(toolDir, entry.name);
      const indexPath = join(entryDir, "index.mdx");
      if (existsSync(indexPath) && statSync(indexPath).isFile()) {
        yield entryDir;
      }
    }
  }
}
