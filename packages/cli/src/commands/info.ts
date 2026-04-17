import type { ContentResolver } from "../lib/resolver/types";

export async function runInfo(
  resolver: ContentResolver,
  slug: string
): Promise<string> {
  const index = await resolver.getIndex();
  const entry = index.entries.find((e) => e.slug === slug);
  if (!entry) {
    throw new Error(`Cable "${slug}" not found in the index.`);
  }

  const lines: string[] = [];
  lines.push(`Title:         ${entry.title}`);
  lines.push(`Slug:          ${entry.slug}`);
  lines.push(`Tool:          ${entry.tool}`);
  lines.push(`Track:         ${entry.track}`);
  if (entry.day !== null) lines.push(`Day:           ${entry.day}`);
  lines.push(`Category:      ${entry.category}`);
  lines.push(`Difficulty:    ${entry.difficulty}`);
  if (entry.time_required) lines.push(`Time required: ${entry.time_required}`);
  if (entry.tags.length > 0) lines.push(`Tags:          ${entry.tags.join(", ")}`);
  if (entry.contributors && entry.contributors.length > 0) {
    lines.push(`Contributors:  ${entry.contributors.join(", ")}`);
  }
  if (entry.publisher) {
    lines.push(`Publisher:     ${entry.publisher}`);
  }
  if (entry.provenance_repo) {
    lines.push(`Source repo:   ${entry.provenance_repo}`);
  }
  if (entry.provenance_ref) {
    lines.push(`Source ref:    ${entry.provenance_ref}`);
  }
  lines.push(`Last verified: ${entry.last_verified}`);
  lines.push("");

  if (entry.artifact_type === null) {
    lines.push("This cable has no installable artifact — it is a tutorial only.");
  } else {
    lines.push(`Artifact type: ${entry.artifact_type}`);
    const registry = await resolver.getRegistry(slug);
    if (registry) {
      lines.push(`Version:       ${registry.version}`);
      if (registry.requires.length > 0) {
        lines.push(`Requires:      ${registry.requires.join(", ")}`);
      }
      lines.push(`Files:`);
      for (const f of registry.files) {
        lines.push(`  ${f.source} → ${f.target}`);
      }
      if (registry.post_install_notes) {
        lines.push("");
        lines.push(`Post-install notes: ${registry.post_install_notes}`);
      }
    }
    lines.push("");
    lines.push(`Install: npx frenxt-cables add ${slug}`);
  }

  return lines.join("\n");
}
