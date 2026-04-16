import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { FrontmatterSchema, RegistrySchema } from "../schema/entry";
import { SkillCompatibilitySchema, SkillSpecSchema } from "../schema/skill";
import { ImportManifestSchema, PublisherSchema } from "../schema/publisher";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function main(): void {
  const frontmatter = zodToJsonSchema(FrontmatterSchema, { name: "Frontmatter" });
  const registry = zodToJsonSchema(RegistrySchema, { name: "Registry" });
  const skillSpec = zodToJsonSchema(SkillSpecSchema, { name: "SkillSpec" });
  const compatibility = zodToJsonSchema(SkillCompatibilitySchema, { name: "SkillCompatibility" });
  const publisher = zodToJsonSchema(PublisherSchema, { name: "Publisher" });
  const importManifest = zodToJsonSchema(ImportManifestSchema, { name: "ImportManifest" });
  const combined = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "cables content schema",
    description:
      "Schema for frontmatter, registry, skill compatibility, and third-party publisher/import manifests.",
    definitions: {
      ...(frontmatter.definitions ?? {}),
      ...(registry.definitions ?? {}),
      ...(skillSpec.definitions ?? {}),
      ...(compatibility.definitions ?? {}),
      ...(publisher.definitions ?? {}),
      ...(importManifest.definitions ?? {}),
    },
  };
  const outputPath = join(repoRoot(), "schema", "entry.schema.json");
  writeFileSync(outputPath, JSON.stringify(combined, null, 2) + "\n", "utf8");
  console.log(`✓ wrote ${outputPath}`);
}

main();
