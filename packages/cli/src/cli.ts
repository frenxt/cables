export function run(argv: string[]): void {
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log("frenxt 0.0.0");
    return;
  }
  console.log("frenxt CLI — commands not yet wired");
}
