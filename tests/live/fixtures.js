// Playwright fixtures for the live-site suite: load the packaged extension
// into a browser profile and give tests its service worker, ID, and settings.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, chromium, expect } from "@playwright/test";
import { extractZip, listZipEntries, RUNTIME_FILES } from "../../scripts/package-extension.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// LIVE_BROWSER=edge runs the installed Microsoft Edge; the default is
// Playwright's own Chromium, which supports extensions in headless mode.
const BROWSER_CHANNELS = { chromium: "chromium", edge: "msedge" };
export const browserName = process.env.LIVE_BROWSER ?? "chromium";
const channel = BROWSER_CHANNELS[browserName];
if (!channel) {
  throw new Error(`LIVE_BROWSER must be one of: ${Object.keys(BROWSER_CHANNELS).join(", ")}`);
}
const headless = !process.env.HEADED;

// The logged-in profile lives outside the repository and is never committed
// or used in CI. Log into it by hand with `npm run test:live:login`.
export const LOGGED_IN_PROFILE = process.env.DREAMING_TEST_PROFILE
  ?? path.join(os.homedir(), ".dreaming-tools-test-profile");

// The logged-in tests change the account's Dreaming subtitle choice, which
// Dreaming stores server-side. account.setup.js records the original here and
// account.teardown.js restores it and deletes the file.
export const SUBTITLE_CHOICE_RECORD = `${LOGGED_IN_PROFILE}.subtitle-choice.json`;

// Extract the packaged ZIP (what testers install), not the working tree, after
// checking that it holds exactly the runtime files.
export async function extractPackage() {
  const { version } = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const zip = path.join(ROOT, "dist", `dreaming-tools-${version}.zip`);
  if (!existsSync(zip)) {
    throw new Error(`${path.relative(ROOT, zip)} is missing; run \`npm run package\` (npm run test:live does this)`);
  }
  const archive = readFileSync(zip);
  const entries = listZipEntries(archive).sort();
  if (JSON.stringify(entries) !== JSON.stringify([...RUNTIME_FILES].sort())) {
    throw new Error(`${path.relative(ROOT, zip)} does not match the runtime file list`);
  }
  const directory = mkdtempSync(path.join(os.tmpdir(), "dreaming-tools-ext-"));
  await extractZip(archive, directory);
  return { directory, version };
}

export function launchWithExtension(profileDirectory, extensionDirectory, options = {}) {
  return chromium.launchPersistentContext(profileDirectory, {
    channel,
    headless,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extensionDirectory}`,
      `--load-extension=${extensionDirectory}`,
    ],
    ...options,
  });
}

// Each run loads the extension from a new temporary folder, so Chrome treats
// it as a first install and opens the options page in a new tab. In the
// logged-in profile that tab would race the test's own navigation; close it.
const FIRST_INSTALL_TAB_TIMEOUT_MS = 5_000;
async function closeFirstInstallOptionsPage(context) {
  const isOptionsPage = (page) => /^chrome-extension:\/\/[^/]+\/src\/options\.html$/.test(page.url());
  const optionsPage = context.pages().find(isOptionsPage)
    ?? await context.waitForEvent("page", { predicate: async (page) => {
      await page.waitForURL(/^chrome-extension:/, { timeout: FIRST_INSTALL_TAB_TIMEOUT_MS }).catch(() => {});
      return isOptionsPage(page);
    }, timeout: FIRST_INSTALL_TAB_TIMEOUT_MS }).catch(() => null);
  await optionsPage?.close();
}

export const test = base.extend({
  // "fresh": a new empty profile per test, so every test is a first install.
  // "persistent": the hand-logged-in profile at LOGGED_IN_PROFILE.
  profileMode: ["fresh", { option: true }],

  extension: [async ({}, use) => {
    const extension = await extractPackage();
    await use(extension);
    rmSync(extension.directory, { recursive: true, force: true });
  }, { scope: "worker" }],

  context: async ({ profileMode, extension }, use) => {
    let profileDirectory = LOGGED_IN_PROFILE;
    if (profileMode === "fresh") {
      profileDirectory = mkdtempSync(path.join(os.tmpdir(), "dreaming-tools-profile-"));
    } else if (!existsSync(profileDirectory)) {
      test.skip(true, `No logged-in test profile at ${profileDirectory}; run \`npm run test:live:login\` first`);
    }
    const context = await launchWithExtension(profileDirectory, extension.directory);
    if (profileMode === "persistent") {
      await closeFirstInstallOptionsPage(context);
    }
    await use(context);
    await context.close();
    if (profileMode === "fresh") {
      rmSync(profileDirectory, { recursive: true, force: true });
    }
  },

  serviceWorker: async ({ context }, use) => {
    const isOurs = (worker) => worker.url().endsWith("/src/background.js");
    const worker = context.serviceWorkers().find(isOurs)
      ?? await context.waitForEvent("serviceworker", { predicate: isOurs });
    await use(worker);
  },

  // Chrome derives the ID from the unpacked folder's path, so it differs per run.
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  setSettings: async ({ serviceWorker }, use) => {
    await use((settings) => serviceWorker.evaluate((values) => chrome.storage.sync.set(values), settings));
  },

  getSettings: async ({ serviceWorker }, use) => {
    await use(() => serviceWorker.evaluate(() => chrome.storage.sync.get(null)));
  },

  optionsUrl: async ({ extensionId }, use) => {
    await use(`chrome-extension://${extensionId}/src/options.html`);
  },
});

export { expect };

// A Dreaming page shows this instead of the player when nobody is logged in.
export const LOGIN_GATE_TEXT = /Create a free account to watch/i;
