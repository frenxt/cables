import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

type Kind = 'standalone' | 'track-episode' | 'migration' | 'team-playbook';

function inferKind(slug: string): Kind {
  if (/^day-\d+/.test(slug)) return 'track-episode';
  if (/^f\d+/.test(slug)) return 'team-playbook';
  if (/migration|claude-to-|codex-to-|cursor-rules-/.test(slug)) return 'migration';
  return 'standalone';
}

const CONTENT_ROOT = path.join(process.cwd(), 'content');
const tools = fs.readdirSync(CONTENT_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'tracks')
  .map((d) => d.name);

let updated = 0;
for (const tool of tools) {
  const toolRoot = path.join(CONTENT_ROOT, tool);
  const slugs = fs.readdirSync(toolRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const slug of slugs) {
    const mdxPath = path.join(toolRoot, slug, 'index.mdx');
    if (!fs.existsSync(mdxPath)) continue;
    const raw = fs.readFileSync(mdxPath, 'utf8');
    const parsed = matter(raw);
    if (parsed.data.kind) continue;
    const kind = inferKind(parsed.data.slug ?? slug);
    parsed.data.kind = kind;
    const out = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(mdxPath, out);
    updated += 1;
    console.log(`[kind=${kind}] ${tool}/${slug}`);
  }
}
console.log(`\nUpdated ${updated} cables.`);
