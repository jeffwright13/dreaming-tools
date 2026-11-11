import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tests/live holds the Playwright live-site suite (npm run test:live).
    exclude: [...configDefaults.exclude, "tests/live/**"],
    coverage: {
      include: ["src/*.js", "scripts/*.js"],
      // Drives a real browser through the live-suite fixtures, like tests/live,
      // so unit tests cannot reach it. Its output is checked by eye.
      exclude: ["scripts/store-screenshots.js"],
      provider: "v8",
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
