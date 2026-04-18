import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import pc from "picocolors";

const STATE_PATH = join(homedir(), ".config", "frenxt", "state.json");

interface NudgeState {
  firstInstallAt?: string;
}

function readState(): NudgeState {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as NudgeState;
  } catch {
    return {};
  }
}

function writeState(state: NudgeState): void {
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // no-op: the nudge is best-effort; failing to persist must never break install.
  }
}

function nudgeEligible(opts: { dryRun?: boolean; json?: boolean; quiet?: boolean }): boolean {
  if (opts.dryRun || opts.json || opts.quiet) return false;
  if (process.env.FRENXT_NO_NUDGE) return false;
  if (process.env.CI) return false;
  if (!process.stdout.isTTY) return false;
  return true;
}

export function maybePrintPostInstallNudge(opts: {
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
}): void {
  if (!nudgeEligible(opts)) return;

  const state = readState();
  if (state.firstInstallAt) return;

  console.log("");
  console.log(
    `${pc.cyan("Liked this cable?")} Star the repo → ${pc.underline("https://github.com/frenxt/cables")}`
  );
  console.log(
    `${pc.cyan("Ship one of your own?")}  → ${pc.bold("npx frenxt publisher init")}`
  );
  console.log(pc.dim(`(silence this with FRENXT_NO_NUDGE=1)`));

  writeState({ ...state, firstInstallAt: new Date().toISOString() });
}
