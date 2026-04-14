import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubResolver } from "../lib/resolver/github";

const FAKE_REF = "abc123";
const BASE_URL = `https://raw.githubusercontent.com/frenxt/cables/${FAKE_REF}`;

const fakeIndex = {
  generated_at: "2026-04-13T12:00:00Z",
  entries: [
    {
      title: "GH sample",
      slug: "gh-sample",
      tool: "claude-code",
      track: "fundamentals",
      category: "onboarding",
      difficulty: "beginner",
      day: null,
      tags: [],
      time_required: null,
      artifact_type: "claude-md",
      has_war_story: false,
      last_verified: "2026-04-10",
      path: "content/claude-code/gh-sample",
      contributors: ["@test"],
    },
  ],
};

const fakeRegistry = {
  slug: "gh-sample",
  artifact_type: "claude-md",
  version: "1.0.0",
  requires: [],
  files: [
    { source: "artifact/CLAUDE.md", target: "CLAUDE.md", action: "copy", on_conflict: "prompt" },
  ],
};

describe("GitHubResolver", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockResponse(url: string, body: string): void {
    fetchMock.mockImplementationOnce(async (requestedUrl: string) => {
      if (requestedUrl !== url) {
        throw new Error(`Unexpected URL: ${requestedUrl} (expected ${url})`);
      }
      return {
        ok: true,
        status: 200,
        text: async () => body,
      } as Response;
    });
  }

  it("fetches the index from the correct URL", async () => {
    mockResponse(`${BASE_URL}/content/index.json`, JSON.stringify(fakeIndex));
    const resolver = new GitHubResolver("frenxt/cables", FAKE_REF);
    const index = await resolver.getIndex();
    expect(index.entries).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches a registry.json from the correct URL", async () => {
    mockResponse(`${BASE_URL}/content/index.json`, JSON.stringify(fakeIndex));
    mockResponse(
      `${BASE_URL}/content/claude-code/gh-sample/registry.json`,
      JSON.stringify(fakeRegistry)
    );
    const resolver = new GitHubResolver("frenxt/cables", FAKE_REF);
    const reg = await resolver.getRegistry("gh-sample");
    expect(reg?.slug).toBe("gh-sample");
  });

  it("fetches an artifact file from the correct URL", async () => {
    mockResponse(`${BASE_URL}/content/index.json`, JSON.stringify(fakeIndex));
    mockResponse(
      `${BASE_URL}/content/claude-code/gh-sample/artifact/CLAUDE.md`,
      "# Fetched CLAUDE.md"
    );
    const resolver = new GitHubResolver("frenxt/cables", FAKE_REF);
    const content = await resolver.getArtifactFile("gh-sample", "artifact/CLAUDE.md");
    expect(content).toBe("# Fetched CLAUDE.md");
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "not found",
    } as Response);
    const resolver = new GitHubResolver("frenxt/cables", FAKE_REF);
    await expect(resolver.getIndex()).rejects.toThrow(/404/);
  });

  it("describe() includes the repo and ref", () => {
    const resolver = new GitHubResolver("frenxt/cables", FAKE_REF);
    expect(resolver.describe()).toContain("frenxt/cables");
    expect(resolver.describe()).toContain(FAKE_REF);
  });
});
