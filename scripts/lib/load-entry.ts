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
import {
  SkillCompatibilitySchema,
  SkillSpecSchema,
  type SkillCompatibility,
  type SkillSpec,
} from "../../schema/skill";

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

function loadSkillSpec(folder: string): SkillSpec | null {
  const path = join(folder, "skill.spec.json");
  if (!existsSync(path)) return null;
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new EntryLoadError(folder, `skill.spec.json is not valid JSON: ${(e as Error).message}`);
  }
  const result = SkillSpecSchema.safeParse(json);
  if (!result.success) {
    throw new EntryLoadError(
      folder,
      `skill.spec.json validation failed: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  return result.data;
}

function loadCompatibility(folder: string): SkillCompatibility | null {
  const path = join(folder, "compatibility.json");
  if (!existsSync(path)) return null;
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new EntryLoadError(folder, `compatibility.json is not valid JSON: ${(e as Error).message}`);
  }
  const result = SkillCompatibilitySchema.safeParse(json);
  if (!result.success) {
    throw new EntryLoadError(
      folder,
      `compatibility.json validation failed: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  return result.data;
}

function assertConsistency(
  folder: string,
  frontmatter: Frontmatter,
  registry: Registry | null,
  skillSpec: SkillSpec | null,
  compatibility: SkillCompatibility | null
): void {
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

  if (frontmatter.artifact_type === "skill") {
    if (!skillSpec) {
      throw new EntryLoadError(folder, `artifact_type is "skill" but skill.spec.json is missing`);
    }
    if (!compatibility) {
      throw new EntryLoadError(folder, `artifact_type is "skill" but compatibility.json is missing`);
    }
    if (skillSpec.slug !== frontmatter.slug) {
      throw new EntryLoadError(
        folder,
        `skill.spec.json slug "${skillSpec.slug}" must match frontmatter.slug "${frontmatter.slug}"`
      );
    }
    if (compatibility.slug !== frontmatter.slug) {
      throw new EntryLoadError(
        folder,
        `compatibility.json slug "${compatibility.slug}" must match frontmatter.slug "${frontmatter.slug}"`
      );
    }
  } else {
    if (skillSpec) {
      throw new EntryLoadError(
        folder,
        `skill.spec.json exists but frontmatter artifact_type is "${frontmatter.artifact_type ?? "null"}"`
      );
    }
    if (compatibility) {
      throw new EntryLoadError(
        folder,
        `compatibility.json exists but frontmatter artifact_type is "${frontmatter.artifact_type ?? "null"}"`
      );
    }
  }
}

export function loadEntry(folder: string): Entry {
  assertDirExists(folder);
  const { frontmatter, body } = loadFrontmatterAndBody(folder);
  const registry = loadRegistry(folder);
  const skillSpec = loadSkillSpec(folder);
  const compatibility = loadCompatibility(folder);
  assertConsistency(folder, frontmatter, registry, skillSpec, compatibility);
  return { folder, frontmatter, body, registry, skillSpec, compatibility };
}
