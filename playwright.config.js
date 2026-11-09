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
    // The logged-in tests change the account's Dreaming subtitle choice; the
    // setup project records it and the teardown project restores it, even
    // when tests fail.
    {
      name: "logged-in-setup",
      testMatch: "**/account.setup.js",
      teardown: "logged-in-teardown",
      use: { profileMode: "persistent" },
    },
    {
      name: "logged-in-teardown",
      testMatch: "**/account.teardown.js",
      use: { profileMode: "persistent" },
    },
    {
      name: "logged-in",
      testMatch: "**/*.logged-in.spec.js",
      dependencies: ["logged-in-setup"],
      use: { profileMode: "persistent" },
    },
  ],
});
