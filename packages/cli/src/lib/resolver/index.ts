import { LocalResolver } from "./local";
import { GitHubResolver } from "./github";
import type { ContentResolver } from "./types";

const DEFAULT_REPO = "frenxt/cables";
const DEFAULT_REF = process.env.FRENXT_REF ?? "main";

export function createResolver(): ContentResolver {
  const localRoot = process.env.FRENXT_CONTENT_ROOT;
  if (localRoot) {
    return new LocalResolver(localRoot);
  }
  return new GitHubResolver(DEFAULT_REPO, DEFAULT_REF);
}

export { LocalResolver } from "./local";
export { GitHubResolver } from "./github";
export type { ContentResolver } from "./types";
