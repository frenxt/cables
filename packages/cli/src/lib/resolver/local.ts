import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ContentResolver } from "./types";
import type { ContentIndex, Registry, IndexEntry } from "../types";

export class LocalResolver implements ContentResolver {
  constructor(private readonly root: string) {}

  describe(): string {
    return `local filesystem at ${this.root}`;
  }

  async getIndex(): Promise<ContentIndex> {
    const indexPath = join(this.root, "content", "index.json");
    if (!existsSync(indexPath)) {
      throw new Error(`LocalResolver: index not found at ${indexPath}`);
    }
    const raw = readFileSync(indexPath, "utf8");
    return JSON.parse(raw) as ContentIndex;
  }

  private async findEntry(slug: string): Promise<IndexEntry> {
    const index = await this.getIndex();
    const entry = index.entries.find((e) => e.slug === slug);
    if (!entry) {
      throw new Error(`LocalResolver: cable "${slug}" not found in index`);
    }
    return entry;
  }

  async getRegistry(slug: string): Promise<Registry | null> {
    const entry = await this.findEntry(slug);
    if (entry.artifact_type === null) return null;
    const registryPath = join(this.root, entry.path, "registry.json");
    if (!existsSync(registryPath)) {
      throw new Error(
        `LocalResolver: cable "${slug}" has artifact_type=${entry.artifact_type} but registry.json is missing at ${registryPath}`
      );
    }
    const raw = readFileSync(registryPath, "utf8");
    return JSON.parse(raw) as Registry;
  }

  async getArtifactFile(slug: string, source: string): Promise<string> {
    const entry = await this.findEntry(slug);
    const filePath = join(this.root, entry.path, source);
    if (!existsSync(filePath)) {
      throw new Error(`LocalResolver: artifact file not found at ${filePath}`);
    }
    return readFileSync(filePath, "utf8");
  }
}
