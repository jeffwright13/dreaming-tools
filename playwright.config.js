import { defineConfig } from "@playwright/test";

// Live-site browser tests. Local only: they load the packaged extension into a
// real browser and visit app.dreaming.com, so they are excluded from Vitest
// and from CI. Run with `npm run test:live`; see docs/TESTING.md.
export default defineConfig({
  testDir: "tests/live",
  testMatch: "**/*.spec.js",
  // One worker: the logged-in profile can only be opened by one browser at a
  // time, and the tests should keep their load on the live site gentle.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // Spike tests explore rather than check; they run only via test:live:spike.
  grepInvert: process.env.SPIKE ? undefined : /@spike/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: "logged-out",
      testIgnore: "**/*.logged-in.spec.js",
      use: { profileMode: "fresh" },
    },
    {
      name: "logged-in",
      testMatch: "**/*.logged-in.spec.js",
      use: { profileMode: "persistent" },
    },
  ],
});
