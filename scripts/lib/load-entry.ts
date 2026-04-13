import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import {
  FrontmatterSchema,
  RegistrySchema,
  type Frontmatter,
  type Registry,
  type Entry,
} from "../../schema/entry";

export class EntryLoadError extends Error {
  constructor(
    public folder: string,
    message: string
  ) {
    super(`[${folder}] ${message}`);
    this.name = "EntryLoadError";
  }
}

function assertDirExists(folder: string): void {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new EntryLoadError(folder, `folder does not exist or is not a directory`);
  }
}

function loadFrontmatterAndBody(folder: string): { frontmatter: Frontmatter; body: string } {
  const mdxPath = join(folder, "index.mdx");
  if (!existsSync(mdxPath)) {
    throw new EntryLoadError(folder, `index.mdx is missing`);
  }
  const raw = readFileSync(mdxPath, "utf8");
  const parsed = matter(raw);
  const result = FrontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    throw new EntryLoadError(
      folder,
      `frontmatter validation failed: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  return { frontmatter: result.data, body: parsed.content };
}

function loadRegistry(folder: string): Registry | null {
  const registryPath = join(folder, "registry.json");
  if (!existsSync(registryPath)) return null;
  const raw = readFileSync(registryPath, "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new EntryLoadError(folder, `registry.json is not valid JSON: ${(e as Error).message}`);
  }
  const result = RegistrySchema.safeParse(json);
  if (!result.success) {
    throw new EntryLoadError(
      folder,
      `registry.json validation failed: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  return result.data;
}

function assertConsistency(folder: string, frontmatter: Frontmatter, registry: Registry | null): void {
  const folderName = basename(folder);
  if (frontmatter.slug !== folderName) {
    throw new EntryLoadError(
      folder,
      `slug "${frontmatter.slug}" must match folder name "${folderName}"`
    );
  }
  const hasArtifactType = frontmatter.artifact_type != null;
  const artifactDir = join(folder, "artifact");
  const hasArtifactDir = existsSync(artifactDir) && statSync(artifactDir).isDirectory();
  if (hasArtifactType && !registry) {
    throw new EntryLoadError(folder, `artifact_type is set but registry.json is missing`);
  }
  if (!hasArtifactType && registry) {
    throw new EntryLoadError(folder, `registry.json exists but frontmatter artifact_type is null or absent`);
  }
  if (hasArtifactType && !hasArtifactDir) {
    throw new EntryLoadError(folder, `artifact_type is set but artifact/ directory is missing`);
  }
  if (!hasArtifactType && hasArtifactDir) {
    throw new EntryLoadError(folder, `artifact/ directory exists but frontmatter artifact_type is null or absent`);
  }
  if (registry && registry.slug !== frontmatter.slug) {
    throw new EntryLoadError(
      folder,
      `registry.slug "${registry.slug}" must match frontmatter.slug "${frontmatter.slug}"`
    );
  }
  if (registry && registry.artifact_type !== frontmatter.artifact_type) {
    throw new EntryLoadError(
      folder,
      `registry.artifact_type "${registry.artifact_type}" must match frontmatter.artifact_type "${frontmatter.artifact_type}"`
    );
  }
  if (registry) {
    for (const file of registry.files) {
      const sourcePath = join(folder, file.source);
      if (!existsSync(sourcePath)) {
        throw new EntryLoadError(
          folder,
          `registry file "${file.source}" does not exist on disk`
        );
      }
    }
  }
}

export function loadEntry(folder: string): Entry {
  assertDirExists(folder);
  const { frontmatter, body } = loadFrontmatterAndBody(folder);
  const registry = loadRegistry(folder);
  assertConsistency(folder, frontmatter, registry);
  return { folder, frontmatter, body, registry };
}
