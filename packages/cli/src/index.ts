import { run } from "./cli";
import { exit } from "node:process";

run(process.argv).catch((e: unknown) => {
  console.error((e as Error).message);
  exit(1);
});
