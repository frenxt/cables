import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { FrontmatterSchema, RegistrySchema } from "../schema/entry";

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

function main(): void {
  const frontmatter = zodToJsonSchema(FrontmatterSchema, { name: "Frontmatter" });
  const registry = zodToJsonSchema(RegistrySchema, { name: "Registry" });
  const combined = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "build-with-ai entry schema",
    description: "Schema for frontmatter and registry.json files in content/",
    definitions: {
      ...(frontmatter.definitions ?? {}),
      ...(registry.definitions ?? {}),
    },
  };
  const outputPath = join(repoRoot(), "schema", "entry.schema.json");
  writeFileSync(outputPath, JSON.stringify(combined, null, 2) + "\n", "utf8");
  console.log(`✓ wrote ${outputPath}`);
}

main();
