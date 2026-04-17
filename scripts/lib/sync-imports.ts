import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve, sep } from "node:path";
import matter from "gray-matter";
import { FrontmatterSchema, RegistrySchema } from "../../schema/entry";
import {
  ImportManifestSchema,
  PublisherSchema,
  type ImportManifest,
  type Publisher,
} from "../../schema/publisher";

type FetchText = (url: string) => Promise<string>;

export interface SyncImportsOptions {
  repoRoot: string;
  fetchText?: FetchText;
}

export interface SyncImportsResult {
  importsProcessed: number;
  filesWritten: number;
  destinations: string[];
}

export const IMPORT_HARDENING_LIMITS = {
  maxArtifactFiles: 48,
  maxTotalBytes: 512 * 1024,
} as const;

const BLOCKED_SOURCE_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".class",
  ".jar",
  ".apk",
  ".ipa",
  ".msi",
  ".deb",
  ".rpm",
  ".bin",
  ".pyc",
  ".wasm",
]);

const ALLOWED_INSTALL_TARGETS = [
  "CLAUDE.md",
  ".claude/skills/",
  ".claude/agents/",
  ".claude/commands/",
  ".claude/stacks/",
] as const;

function isSubpath(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(`${p}${sep}`);
}

function walkJsonFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const stack = [root];
  const files: string[] = [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(abs);
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function parseJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`invalid JSON at ${path}: ${(e as Error).message}`);
  }
}

function loadPublishers(repoRoot: string): Map<string, Publisher> {
  const publishersRoot = join(repoRoot, "publishers");
  const map = new Map<string, Publisher>();
  for (const filePath of walkJsonFiles(publishersRoot)) {
    const parsed = PublisherSchema.safeParse(parseJsonFile(filePath));
    if (!parsed.success) {
      throw new Error(
        `publisher manifest validation failed at ${filePath}: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`
      );
    }
    const publisher = parsed.data;
    if (map.has(publisher.id)) {
      throw new Error(`duplicate publisher id "${publisher.id}" found at ${filePath}`);
    }
    map.set(publisher.id, publisher);
  }
  return map;
}

function loadImportManifests(repoRoot: string): ImportManifest[] {
  const importsRoot = join(repoRoot, "imports");
  const manifests: ImportManifest[] = [];
  for (const filePath of walkJsonFiles(importsRoot)) {
    const parsed = ImportManifestSchema.safeParse(parseJsonFile(filePath));
    if (!parsed.success) {
      throw new Error(
        `import manifest validation failed at ${filePath}: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`
      );
    }
    manifests.push(parsed.data);
  }

  manifests.sort((a, b) =>
    a.publisher_id.localeCompare(b.publisher_id) ||
    a.tool.localeCompare(b.tool) ||
    a.slug.localeCompare(b.slug)
  );
  return manifests;
}

async function defaultFetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return await response.text();
}

function isNotFoundError(error: unknown): boolean {
  return /\b404\b/.test((error as Error).message);
}

async function fetchOptional(url: string, fetchText: FetchText): Promise<string | null> {
  try {
    return await fetchText(url);
  } catch (e) {
    if (isNotFoundError(e)) return null;
    throw e;
  }
}

function rawBaseUrl(manifest: ImportManifest): string {
  return `https://raw.githubusercontent.com/${manifest.source.repo}/${manifest.source.ref}/${manifest.source.path}`;
}

function normalizeRelativePath(value: string, label: string, slug: string): string {
  const normalized = posix.normalize(value.replace(/\\/g, "/"));
  if (normalized.length === 0 || normalized === "." || normalized === "..") {
    throw new Error(`import ${slug}: ${label} "${value}" is not a valid relative path`);
  }
  if (posix.isAbsolute(normalized) || normalized.startsWith("../")) {
    throw new Error(`import ${slug}: ${label} "${value}" cannot escape the cable root`);
  }
  return normalized;
}

function validateImportFileMapping(manifest: ImportManifest, file: { source: string; target: string }): string {
  const source = normalizeRelativePath(file.source, "registry source", manifest.slug);
  const target = normalizeRelativePath(file.target, "registry target", manifest.slug);

  if (!source.startsWith("artifact/")) {
    throw new Error(
      `import ${manifest.slug}: registry source "${file.source}" must stay under artifact/`
    );
  }

  const ext = posix.extname(source).toLowerCase();
  if (BLOCKED_SOURCE_EXTENSIONS.has(ext)) {
    throw new Error(
      `import ${manifest.slug}: registry source "${file.source}" uses blocked extension "${ext}"`
    );
  }

  const allowedTarget = ALLOWED_INSTALL_TARGETS.some((prefix) =>
    prefix.endsWith("/") ? target.startsWith(prefix) : target === prefix
  );
  if (!allowedTarget) {
    throw new Error(
      `import ${manifest.slug}: registry target "${file.target}" is outside approved install roots`
    );
  }

  return source;
}

function ensureExpectedImportContract(manifest: ImportManifest, publisher: Publisher): void {
  if (publisher.status === "suspended") {
    throw new Error(`publisher "${publisher.id}" is suspended`);
  }
  if (manifest.source.repo !== publisher.repo) {
    throw new Error(
      `import ${manifest.slug}: source.repo "${manifest.source.repo}" must match publisher repo "${publisher.repo}"`
    );
  }
  const expectedPath = `content/${manifest.tool}/${manifest.slug}`;
  if (manifest.source.path !== expectedPath) {
    throw new Error(
      `import ${manifest.slug}: source.path "${manifest.source.path}" must match "${expectedPath}"`
    );
  }
}

async function gatherRemoteFiles(
  manifest: ImportManifest,
  publisher: Publisher,
  fetchText: FetchText
): Promise<Map<string, string>> {
  ensureExpectedImportContract(manifest, publisher);
  const baseUrl = rawBaseUrl(manifest);
  const files = new Map<string, string>();
  let totalBytes = 0;

  const indexRaw = await fetchText(`${baseUrl}/index.mdx`);
  totalBytes += Buffer.byteLength(indexRaw, "utf8");
  const parsedMdx = matter(indexRaw);
  const frontmatterParse = FrontmatterSchema.safeParse(parsedMdx.data);
  if (!frontmatterParse.success) {
    throw new Error(
      `import ${manifest.slug}: source index.mdx frontmatter invalid: ${frontmatterParse.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  const frontmatter = frontmatterParse.data;
  if (frontmatter.slug !== manifest.slug) {
    throw new Error(
      `import ${manifest.slug}: source frontmatter slug "${frontmatter.slug}" does not match manifest slug "${manifest.slug}"`
    );
  }
  if (frontmatter.tool !== manifest.tool) {
    throw new Error(
      `import ${manifest.slug}: source frontmatter tool "${frontmatter.tool}" does not match manifest tool "${manifest.tool}"`
    );
  }

  const enrichedFrontmatter = {
    ...frontmatter,
    publisher: manifest.publisher_id,
    provenance_repo: manifest.source.repo,
    provenance_ref: manifest.source.ref,
  };
  files.set("index.mdx", matter.stringify(parsedMdx.content, enrichedFrontmatter));

  const registryRaw = await fetchOptional(`${baseUrl}/registry.json`, fetchText);
  if (frontmatter.artifact_type == null && registryRaw !== null) {
    throw new Error(`import ${manifest.slug}: registry.json exists but artifact_type is null/absent`);
  }

  if (frontmatter.artifact_type != null) {
    if (registryRaw === null) {
      throw new Error(`import ${manifest.slug}: artifact_type is set but registry.json is missing`);
    }
    const registryJson = JSON.parse(registryRaw);
    const registryParse = RegistrySchema.safeParse(registryJson);
    if (!registryParse.success) {
      throw new Error(
        `import ${manifest.slug}: source registry.json invalid: ${registryParse.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`
      );
    }
    const registry = registryParse.data;
    if (registry.files.length > IMPORT_HARDENING_LIMITS.maxArtifactFiles) {
      throw new Error(
        `import ${manifest.slug}: registry.json declares ${registry.files.length} files; max is ${IMPORT_HARDENING_LIMITS.maxArtifactFiles}`
      );
    }
    totalBytes += Buffer.byteLength(registryRaw, "utf8");
    files.set("registry.json", registryRaw.endsWith("\n") ? registryRaw : `${registryRaw}\n`);

    for (const file of registry.files) {
      const normalizedSource = validateImportFileMapping(manifest, file);
      const sourceRaw = await fetchText(`${baseUrl}/${normalizedSource}`);
      totalBytes += Buffer.byteLength(sourceRaw, "utf8");
      files.set(normalizedSource, sourceRaw);
    }

    if (frontmatter.artifact_type === "skill") {
      const skillSpec = await fetchText(`${baseUrl}/skill.spec.json`);
      const compatibility = await fetchText(`${baseUrl}/compatibility.json`);
      totalBytes += Buffer.byteLength(skillSpec, "utf8");
      totalBytes += Buffer.byteLength(compatibility, "utf8");
      files.set("skill.spec.json", skillSpec.endsWith("\n") ? skillSpec : `${skillSpec}\n`);
      files.set("compatibility.json", compatibility.endsWith("\n") ? compatibility : `${compatibility}\n`);
    }
  }

  if (totalBytes > IMPORT_HARDENING_LIMITS.maxTotalBytes) {
    throw new Error(
      `import ${manifest.slug}: imported payload is ${totalBytes} bytes; max is ${IMPORT_HARDENING_LIMITS.maxTotalBytes}`
    );
  }

  return files;
}

function writeSnapshot(
  repoRoot: string,
  manifest: ImportManifest,
  files: Map<string, string>
): { destination: string; filesWritten: number } {
  const contentRoot = join(repoRoot, "content");
  const destination = join(contentRoot, manifest.tool, manifest.slug);
  if (!isSubpath(contentRoot, destination)) {
    throw new Error(`refusing to write outside content root: ${destination}`);
  }
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });

  let filesWritten = 0;
  for (const [relativePath, contents] of files.entries()) {
    const targetPath = join(destination, relativePath);
    if (!isSubpath(destination, targetPath)) {
      throw new Error(`refusing to write outside destination for ${manifest.slug}: ${relativePath}`);
    }
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, contents, "utf8");
    filesWritten += 1;
  }
  return { destination, filesWritten };
}

export async function syncImports(options: SyncImportsOptions): Promise<SyncImportsResult> {
  const repoRoot = resolve(options.repoRoot);
  const fetchText = options.fetchText ?? defaultFetchText;
  const publishers = loadPublishers(repoRoot);
  const manifests = loadImportManifests(repoRoot);
  let filesWritten = 0;
  const destinations: string[] = [];

  for (const manifest of manifests) {
    const publisher = publishers.get(manifest.publisher_id);
    if (!publisher) {
      throw new Error(
        `import ${manifest.slug}: publisher_id "${manifest.publisher_id}" does not exist in publishers/`
      );
    }
    const remoteFiles = await gatherRemoteFiles(manifest, publisher, fetchText);
    const writeResult = writeSnapshot(repoRoot, manifest, remoteFiles);
    filesWritten += writeResult.filesWritten;
    destinations.push(writeResult.destination);
  }

  return {
    importsProcessed: manifests.length,
    filesWritten,
    destinations,
  };
}
