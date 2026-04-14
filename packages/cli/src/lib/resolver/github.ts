import type { ContentResolver } from "./types";
import type { ContentIndex, Registry, IndexEntry } from "../types";

export class GitHubResolver implements ContentResolver {
  constructor(
    private readonly repo: string,
    private readonly ref: string
  ) {}

  private baseUrl(): string {
    return `https://raw.githubusercontent.com/${this.repo}/${this.ref}`;
  }

  describe(): string {
    return `github.com/${this.repo}@${this.ref}`;
  }

  private async fetchText(path: string): Promise<string> {
    const url = `${this.baseUrl()}/${path}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHubResolver: HTTP ${response.status} fetching ${url}`);
    }
    return await response.text();
  }

  async getIndex(): Promise<ContentIndex> {
    const raw = await this.fetchText("content/index.json");
    return JSON.parse(raw) as ContentIndex;
  }

  private async findEntry(slug: string): Promise<IndexEntry> {
    const index = await this.getIndex();
    const entry = index.entries.find((e) => e.slug === slug);
    if (!entry) {
      throw new Error(`GitHubResolver: cable "${slug}" not found in index`);
    }
    return entry;
  }

  async getRegistry(slug: string): Promise<Registry | null> {
    const entry = await this.findEntry(slug);
    if (entry.artifact_type === null) return null;
    const raw = await this.fetchText(`${entry.path}/registry.json`);
    return JSON.parse(raw) as Registry;
  }

  async getArtifactFile(slug: string, source: string): Promise<string> {
    const entry = await this.findEntry(slug);
    return await this.fetchText(`${entry.path}/${source}`);
  }
}
