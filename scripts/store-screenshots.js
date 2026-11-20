// Capture Chrome Web Store images from the packaged extension: options-page
// screenshots at the store's 1280x800 and a 440x280 small promo tile. Only the
// extension's own pages and art appear, never Dreaming's site.
//
// Usage: npm run store:screenshots (builds the test package in dist/dev/ first)
// Output: dist/store-assets/ (regenerated each run, not committed).
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { extractPackage, launchWithExtension } from "../tests/live/fixtures.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIRECTORY = path.join(ROOT, "dist", "store-assets");
const SCREENSHOT_SIZE = { width: 1280, height: 800 };
const PROMO_TILE_SIZE = { width: 440, height: 280 };
const SETTLE_MS = 500;

const SHOWCASE_SETTINGS = {
  subtitlesEnabled: true,
  subtitleStyle: "blur",
  revealMode: "hold",
  revealKey: "KeyS",
  difficultyEnabled: true,
  behavior: "enhanced-everywhere",
  style: "enhanced",
  size: "large",
  position: "upper-right",
};

// One light screenshot per subtitle style, then one revealed, so the store
// shows each choice; the Style menu in each shot shows the style it depicts.
// Chrome takes at most five screenshots: these four and the badges.
const SUBTITLE_SHOTS = [
  { file: "1-subtitles-hidden.png", subtitleStyle: "hidden" },
  { file: "2-subtitles-blurred.png", subtitleStyle: "blur" },
  { file: "3-subtitles-small-and-faint.png", subtitleStyle: "small-faint" },
  { file: "4-subtitles-revealed.png", subtitleStyle: "blur", reveal: true },
];
const BADGES_SHOT = "5-difficulty-badges-dark.png";
// Space kept above the "Subtitle appearance" heading when scrolling to it.
const SCROLL_MARGIN_PX = 24;

async function openOptions(colorScheme, overrides = {}) {
  const profileDirectory = mkdtempSync(path.join(os.tmpdir(), "dreaming-tools-store-"));
  const context = await launchWithExtension(profileDirectory, extension.directory, {
    viewport: SCREENSHOT_SIZE,
    deviceScaleFactor: 1,
    colorScheme,
  });
  const worker = context.serviceWorkers().find((candidate) => candidate.url().endsWith("/src/background.js"))
    ?? await context.waitForEvent("serviceworker");
  await worker.evaluate((settings) => chrome.storage.sync.set(settings), { ...SHOWCASE_SETTINGS, ...overrides });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/src/options.html`);
  await page.waitForTimeout(SETTLE_MS);
  // Close the first-install tab the extension opens, so only one page is left.
  for (const other of context.pages()) {
    if (other !== page) await other.close();
  }
  const close = async () => {
    await context.close();
    rmSync(profileDirectory, { recursive: true, force: true });
  };
  return { page, close };
}

// Start the frame at "Subtitle appearance", so the Style menu, the Reveal
// settings, and both player previews all fit in 1280x800.
async function scrollToSubtitleSettings(page) {
  await page.evaluate((margin) => {
    const heading = document.querySelector("#subtitles-feature h3");
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - margin);
  }, SCROLL_MARGIN_PX);
  await page.waitForTimeout(SETTLE_MS);
}

async function captureOptionsScreenshots() {
  for (const shot of SUBTITLE_SHOTS) {
    const light = await openOptions("light", { subtitleStyle: shot.subtitleStyle });
    if (shot.reveal) {
      // Focus the page first; the click would undo a scroll made before it.
      await light.page.locator("body").click({ position: { x: 5, y: 5 } });
      await light.page.keyboard.down("s");
    }
    await scrollToSubtitleSettings(light.page);
    await light.page.screenshot({ path: path.join(OUTPUT_DIRECTORY, shot.file) });
    if (shot.reveal) await light.page.keyboard.up("s");
    await light.close();
  }

  const dark = await openOptions("dark");
  await dark.page.evaluate(() => document.querySelector("#difficulty-feature").scrollIntoView({ block: "start" }));
  await dark.page.waitForTimeout(SETTLE_MS);
  await dark.page.screenshot({ path: path.join(OUTPUT_DIRECTORY, BADGES_SHOT) });
  await dark.close();
}

async function capturePromoTile() {
  const icon = readFileSync(path.join(extension.directory, "icons", "icon-128.png")).toString("base64");
  const { name } = JSON.parse(readFileSync(path.join(extension.directory, "manifest.json"), "utf8"));
  // A plain browser: the tile needs no extension, and loading one would open
  // its first-install options tab, which can leave this page unable to capture.
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: PROMO_TILE_SIZE, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html>
    <style>
      body { margin: 0; width: ${PROMO_TILE_SIZE.width}px; height: ${PROMO_TILE_SIZE.height}px;
        display: flex; align-items: center; gap: 24px; padding: 0 32px; box-sizing: border-box;
        background: #23272a; color: #ffffff; font-family: -apple-system, "Segoe UI", sans-serif; }
      img { width: 112px; height: 112px; flex: none; }
      h1 { margin: 0 0 10px; font-size: 32px; }
      p { margin: 0; font-size: 17px; line-height: 1.35; color: #c9f3df; }
    </style>
    <img src="data:image/png;base64,${icon}" alt="">
    <div><h1>${name}</h1><p>Subtitle practice and difficulty ratings for Dreaming</p></div>`);
  await page.screenshot({ path: path.join(OUTPUT_DIRECTORY, "promo-tile-440x280.png") });
  await browser.close();
}

rmSync(OUTPUT_DIRECTORY, { recursive: true, force: true });
mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
const extension = await extractPackage();
try {
  await captureOptionsScreenshots();
  await capturePromoTile();
  console.log(`Store images for ${extension.version} written to ${path.relative(ROOT, OUTPUT_DIRECTORY)}/`);
} finally {
  rmSync(extension.directory, { recursive: true, force: true });
}
