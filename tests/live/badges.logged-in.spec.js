// Difficulty badges on pages that need a login: Library, My list, series
// modals, and watch-page chips. Read-only: these tests never add to the
// Library or My list, and skip a page that has nothing to check.
import { test, expect } from "./fixtures.js";
import {
  expectEnhancedCards,
  expectSeriesCards,
  formatDifficultyRange,
  loadCatalog,
  readSeriesCards,
  readVideoCards,
  settledBadgeCount,
} from "./catalog.js";
import { openWatchPage } from "./players.js";
import { DREAMING_PLAYER_VIDEO, routes } from "./routes.js";

const LIBRARY_SERIES_CARD = '[data-testid="library-series-card"]';
const SERIES_CATALOG_CARD = '[data-testid="series-catalog-card"]';
const SERIES_MODAL = ".ds-series-modal";
const PAGE_SETTLE_MS = 5_000;

let catalog;
test.beforeAll(async () => {
  catalog = await loadCatalog("spanish");
});

test.beforeEach(async ({ setSettings }) => {
  await setSettings({ difficultyEnabled: true, behavior: "enhanced-everywhere", style: "dreaming" });
});

async function openLibraryPage(context, url) {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForTimeout(PAGE_SETTLE_MS);
  return page;
}

test("Library History: watched videos are badged per the catalog", async ({ context }, testInfo) => {
  const page = await openLibraryPage(context, routes.libraryHistory);
  const cards = await readVideoCards(page);
  test.skip(cards.length === 0, "History is empty for this account");
  await settledBadgeCount(page);
  expectEnhancedCards(await readVideoCards(page), catalog, testInfo);
});

test("My list: saved videos and series are badged per the catalog", async ({ context }, testInfo) => {
  const page = await openLibraryPage(context, routes.myList);
  const videos = await readVideoCards(page);
  const series = await readSeriesCards(page, LIBRARY_SERIES_CARD);
  test.skip(videos.length + series.length === 0, "My list is empty for this account; the tests never add to it");
  await settledBadgeCount(page);
  if (videos.length) {
    expectEnhancedCards(await readVideoCards(page), catalog, testInfo);
  }
  if (series.length) {
    expectSeriesCards(await readSeriesCards(page, LIBRARY_SERIES_CARD), catalog, testInfo);
  }
});

async function openSeriesModal(context) {
  const page = await context.newPage();
  await page.goto(routes.series("spanish"));
  await settledBadgeCount(page);
  // Open the first series card that the catalog gives a range.
  const cards = await readSeriesCards(page, SERIES_CATALOG_CARD);
  const index = cards.findIndex((card) => card.badges === 1);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator(SERIES_CATALOG_CARD).nth(index).click();
  await expect(page.locator(SERIES_MODAL)).toBeVisible({ timeout: 15_000 });
  const seriesId = new URL(page.url()).searchParams.get("id");
  return { page, seriesId };
}

test("series modal: episode cards are badged per the catalog", async ({ context }, testInfo) => {
  const { page } = await openSeriesModal(context);
  await settledBadgeCount(page, `${SERIES_MODAL} [data-video-id] .ds-difficulty-extension-badge`);
  expectEnhancedCards(await readVideoCards(page, SERIES_MODAL), catalog, testInfo);
});

// Dreaming replaced the modal's .ds-series-modal__header with
// .ds-series-modal__hero, which src/difficulty.js does not target yet, so the
// cover shows no range badge. Found by this suite on 2026-11-09; see TODO.md.
test.fixme("series modal: the cover shows the series range", async ({ context }) => {
  const { page, seriesId } = await openSeriesModal(context);
  const range = catalog.seriesRanges.get(seriesId);
  expect(range, `series ${seriesId} should have a catalog range`).toBeDefined();
  await expect(page.locator(".ds-series-modal__hero .ds-difficulty-extension-badge"))
    .toHaveText(formatDifficultyRange(range));
});

test("watch page: chips show the video's difficulty and its series range, and follow navigation", async ({ context }) => {
  const page = await openWatchPage(context, DREAMING_PLAYER_VIDEO);
  const row = page.locator('[data-testid="video-badges"]');

  async function expectChipsFor(videoId) {
    const video = catalog.videosById.get(videoId);
    const difficulty = catalog.difficulty(videoId);
    const videoChip = row.locator(".ds-difficulty-extension-chip--video");
    if (difficulty === null) {
      await expect(videoChip).toHaveCount(0);
    } else {
      await expect(videoChip).toHaveText(`Difficulty ${difficulty}`);
    }
    const range = video?.seriesId ? catalog.seriesRanges.get(video.seriesId) : undefined;
    const seriesChip = row.locator(".ds-difficulty-extension-chip--series");
    if (range) {
      await expect(seriesChip).toHaveText(`Series ${formatDifficultyRange(range)}`);
    } else {
      await expect(seriesChip).toHaveCount(0);
    }
  }

  await expect(row).toBeVisible({ timeout: 15_000 });
  await expectChipsFor(DREAMING_PLAYER_VIDEO.id);

  // Watch-to-watch navigation is client-side; the chips must follow it.
  // A free account cannot open premium videos, so pick a free one.
  const nextId = await page.locator("[data-video-id]").evaluateAll((cards, current) => cards
    .find((card) => card.dataset.videoId !== current && !/premium/i.test(card.className) && card.offsetWidth > 0)
    ?.dataset.videoId, DREAMING_PLAYER_VIDEO.id);
  expect(nextId, "the sidebar should list another free video").toBeTruthy();
  await page.locator(`[data-video-id="${nextId}"] a`).first().click();
  await expect(page).toHaveURL(new RegExp(`id=${nextId}`), { timeout: 15_000 });
  await expectChipsFor(nextId);
});
