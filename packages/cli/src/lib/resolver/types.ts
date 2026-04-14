import type { ContentIndex, Registry } from "../types";

export interface ContentResolver {
  getIndex(): Promise<ContentIndex>;
  getRegistry(slug: string): Promise<Registry | null>;
  getArtifactFile(slug: string, source: string): Promise<string>;
  describe(): string;
}
