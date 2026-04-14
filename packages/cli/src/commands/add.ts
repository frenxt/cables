import type { ContentResolver } from "../lib/resolver/types";
import { installPlan, type InstallOptions } from "../lib/installer";
import type { PreparedInstall, InstallResult } from "../lib/types";

export async function runAdd(
  resolver: ContentResolver,
  slug: string,
  options: InstallOptions
): Promise<InstallResult> {
  const index = await resolver.getIndex();
  const entry = index.entries.find((e) => e.slug === slug);
  if (!entry) {
    throw new Error(`Cable "${slug}" not found in the index.`);
  }
  if (entry.artifact_type === null) {
    throw new Error(
      `Cable "${slug}" is not installable — it is a tutorial-only cable with no artifact.`
    );
  }

  const registry = await resolver.getRegistry(slug);
  if (!registry) {
    throw new Error(
      `Cable "${slug}" is marked as having an artifact but no registry.json was returned.`
    );
  }

  const files = new Map<string, string>();
  for (const file of registry.files) {
    const content = await resolver.getArtifactFile(slug, file.source);
    files.set(file.source, content);
  }

  const plan: PreparedInstall = { registry, files };
  return await installPlan(plan, options);
}
