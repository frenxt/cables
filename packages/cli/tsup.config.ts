import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  bundle: true,
  clean: true,
  shims: false,
  sourcemap: false,
  minify: false,
  splitting: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
