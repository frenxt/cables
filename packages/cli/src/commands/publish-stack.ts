import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import pc from "picocolors";
import {
  CommunityStackSchema,
  runSecurityChecks,
  type CommunityStack,
  type SecurityFinding,
} from "../lib/community-stack";

export interface PublishStackOptions {
  json?: boolean;
}

export interface PublishStackResult {
  stack: CommunityStack | null;
  source: string;
  schemaErrors: string[];
  findings: SecurityFinding[];
  decision: "approved" | "needs-review" | "rejected";
}

export async function runPublishStack(
  pathOrUrl: string,
  options: PublishStackOptions = {}
): Promise<PublishStackResult> {
  const { raw, source } = await resolveStackJson(pathOrUrl);
  const result: PublishStackResult = {
    stack: null,
    source,
    schemaErrors: [],
    findings: [],
    decision: "rejected",
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    result.schemaErrors.push(`stack.json is not valid JSON: ${(e as Error).message}`);
    printReport(result, options);
    return result;
  }

  const validation = CommunityStackSchema.safeParse(parsed);
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      result.schemaErrors.push(`${path}: ${issue.message}`);
    }
    printReport(result, options);
    return result;
  }

  result.stack = validation.data;
  result.findings = runSecurityChecks(validation.data);

  const hasReject = result.findings.some((f) => f.level === "reject");
  const hasReview = result.findings.some((f) => f.level === "review");
  result.decision = hasReject ? "rejected" : hasReview ? "needs-review" : "approved";

  printReport(result, options);
  return result;
}

async function resolveStackJson(
  pathOrUrl: string
): Promise<{ raw: string; source: string }> {
  // Local path — look for .cables/stack.json.
  const asLocal = resolve(pathOrUrl);
  if (existsSync(asLocal)) {
    const candidates = [
      join(asLocal, ".cables", "stack.json"),
      asLocal.endsWith(".json") ? asLocal : null,
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return { raw: readFileSync(candidate, "utf8"), source: candidate };
      }
    }
    throw new Error(
      `No stack.json found at ${asLocal} (expected .cables/stack.json or a direct .json path).`
    );
  }

  // GitHub URL — resolve to raw content.
  const ghUrl = normalizeGitHubRef(pathOrUrl);
  if (!ghUrl) {
    throw new Error(
      `Could not resolve "${pathOrUrl}" as a local path or GitHub repo.`
    );
  }
  const res = await fetch(ghUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch stack.json from ${ghUrl} (HTTP ${res.status}).`
    );
  }
  return { raw: await res.text(), source: ghUrl };
}

function normalizeGitHubRef(input: string): string | null {
  // Accept: github.com/owner/repo, https://github.com/owner/repo, owner/repo, with optional @ref
  const withoutProto = input.replace(/^https?:\/\//, "").replace(/^github\.com\//, "");
  const match = withoutProto.match(/^([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]+?)(?:@([a-zA-Z0-9._/-]+))?$/);
  if (!match) return null;
  const [, owner, repo, ref = "main"] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/.cables/stack.json`;
}

function printReport(result: PublishStackResult, options: PublishStackOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("");
  console.log(pc.bold(pc.cyan("═══════════════════════════════════════════")));
  console.log(pc.bold(`Community stack pre-flight`));
  console.log(pc.dim(`Source: ${result.source}`));
  console.log(pc.cyan("═══════════════════════════════════════════"));

  if (result.stack) {
    const s = result.stack;
    console.log(`${pc.dim("slug:")}         ${s.slug}`);
    console.log(`${pc.dim("title:")}        ${s.title}`);
    console.log(`${pc.dim("purpose:")}      ${s.purpose}`);
    console.log(`${pc.dim("author:")}       @${s.author.github}`);
    console.log(`${pc.dim("version:")}      ${s.version}`);
    console.log(
      `${pc.dim("contents:")}     ${s.claude_plugins?.length ?? 0} claude plugins · ${s.codex_plugins?.length ?? 0} codex plugins · ${s.skills?.length ?? 0} skills · ${s.marketplaces?.length ?? 0} marketplaces`
    );
  }

  if (result.schemaErrors.length > 0) {
    console.log("");
    console.log(pc.red(pc.bold("Schema errors:")));
    for (const err of result.schemaErrors) {
      console.log(pc.red(`  ✗ ${err}`));
    }
  }

  if (result.findings.length > 0) {
    const by = { reject: [] as string[], review: [] as string[], warn: [] as string[] };
    for (const f of result.findings) by[f.level].push(`[${f.code}] ${f.message}`);

    if (by.reject.length > 0) {
      console.log("");
      console.log(pc.red(pc.bold("Blockers (reject):")));
      for (const m of by.reject) console.log(pc.red(`  ✗ ${m}`));
    }
    if (by.review.length > 0) {
      console.log("");
      console.log(pc.yellow(pc.bold("Flagged for human review:")));
      for (const m of by.review) console.log(pc.yellow(`  ⚠ ${m}`));
    }
    if (by.warn.length > 0) {
      console.log("");
      console.log(pc.dim(pc.bold("Warnings:")));
      for (const m of by.warn) console.log(pc.dim(`  · ${m}`));
    }
  }

  console.log("");
  console.log(pc.cyan("───────────────────────────────────────────"));
  const verdict = {
    approved: pc.green("✓ APPROVED — ready to submit."),
    "needs-review": pc.yellow("⚠ NEEDS REVIEW — a maintainer will look at this."),
    rejected: pc.red("✗ REJECTED — fix the errors above and re-run."),
  }[result.decision];
  console.log(verdict);
  console.log(pc.cyan("═══════════════════════════════════════════"));
}
