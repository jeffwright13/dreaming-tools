// Difficulty badges on live Dreaming pages, logged out. Each video card is
// checked against Dreaming's public catalog: a card whose video has a
// difficulty score gets exactly one extension badge, and a card without one
// gets none.
import { test, expect } from "./fixtures.js";
import { DREAMING_PLAYER_VIDEO } from "./videos.js";
import "../../src/difficulty-core.js";

const { buildCatalogIndexes, calculateDifficulty, extractSeriesId, getCatalogUrl } = globalThis.DreamingDifficultyCore;
const SERIES_SCROLL_STEP = 6;

let catalog;
test.beforeAll(async () => {
  // The same public, credential-free request the extension makes.
  const response = await fetch(getCatalogUrl("es"), { credentials: "omit" });
  expect(response.ok).toBe(true);
  const body = await response.json();
  catalog = buildCatalogIndexes(Array.isArray(body) ? body : body.videos ?? []);
  expect(catalog.videosById.size).toBeGreaterThan(0);
});

// Wait until the extension has badged the page and the count stops changing.
async function settledBadgeCount(page) {
  const count = () => page.locator(".ds-difficulty-extension-badge").count();
  await expect.poll(count, { timeout: 20_000 }).toBeGreaterThan(0);
  let previous = -1;
  await expect.poll(async () => {
    const current = await count();
    const stable = current === previous;
    previous = current;
    return stable;
  }, { intervals: [1_000], timeout: 20_000 }).toBe(true);
}

function readVideoCards(page) {
  return page.locator("[data-video-id] .ds-video-thumbnail").evaluateAll((thumbnails) => thumbnails.map((thumbnail) => {
    const native = thumbnail.querySelector(".ds-video-thumbnail__badge--vocab-range");
    return {
      videoId: thumbnail.closest("[data-video-id]").dataset.videoId,
      extensionBadges: thumbnail.querySelectorAll(".ds-difficulty-extension-badge").length,
      native: native ? (native.hidden ? "hidden" : "shown") : "none",
    };
  }));
}

const catalogDifficulty = (videoId) => calculateDifficulty(catalog.videosById.get(videoId)?.difficultyScore);

function expectEnhancedCards(cards, testInfo) {
  expect(cards.length).toBeGreaterThan(0);
  const unbadged = cards.filter((card) => card.extensionBadges === 0);
  for (const card of cards) {
    expect(card.extensionBadges, `video ${card.videoId}`).toBeLessThanOrEqual(1);
    if (catalogDifficulty(card.videoId) === null) {
      expect(card.extensionBadges, `video ${card.videoId} has no catalog difficulty`).toBe(0);
    } else {
      expect(card.extensionBadges, `video ${card.videoId} has catalog difficulty ${catalogDifficulty(card.videoId)}`).toBe(1);
    }
  }
  testInfo.annotations.push({
    type: "cards",
    description: `${cards.length} cards, ${cards.length - unbadged.length} badged; unbadged (no catalog difficulty): ${unbadged.map((card) => card.videoId).join(", ") || "none"}`,
  });
}

test.describe("Enhanced everywhere", () => {
  test.beforeEach(async ({ setSettings }) => {
    await setSettings({ difficultyEnabled: true, behavior: "enhanced-everywhere" });
  });

  test("Browse: every card with a catalog difficulty has one badge", async ({ context }, testInfo) => {
    const page = await context.newPage();
    await page.goto("https://app.dreaming.com/spanish/browse");
    await settledBadgeCount(page);
    expectEnhancedCards(await readVideoCards(page), testInfo);
  });

  test("Browse sorted by Easy: extension badges replace Dreaming's", async ({ context }, testInfo) => {
    const page = await context.newPage();
    await page.goto("https://app.dreaming.com/spanish/browse?sort=easy");
    await settledBadgeCount(page);
    const cards = await readVideoCards(page);
    expectEnhancedCards(cards, testInfo);
    for (const card of cards.filter((candidate) => candidate.extensionBadges === 1)) {
      expect(card.native, `video ${card.videoId}`).not.toBe("shown");
    }
  });

  test("Series catalog: every series with a catalog range has one badge", async ({ context }, testInfo) => {
    const page = await context.newPage();
    await page.goto("https://app.dreaming.com/spanish/series");
    await settledBadgeCount(page);

    // Carousel cards load their image, which carries the series ID, only once
    // scrolled into view; until then neither Dreaming nor the extension can
    // identify them. Bring every few cards into view so the carousels load.
    const cardLocator = page.locator('[data-testid="series-catalog-card"]');
    const total = await cardLocator.count();
    for (let index = 0; index < total; index += SERIES_SCROLL_STEP) {
      await cardLocator.nth(index).scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1_500);

    const cards = await cardLocator.evaluateAll((elements) => elements.map((card) => ({
      image: card.querySelector('img[src*="series-"]')?.src ?? null,
      link: card.querySelector('a[href*="series="]')?.href ?? null,
      badges: card.querySelectorAll(".ds-difficulty-extension-badge").length,
    })));
    const identified = cards
      .map((card) => ({ ...card, seriesId: extractSeriesId(card.image) ?? extractSeriesId(card.link) }))
      .filter((card) => card.seriesId);
    expect(identified.length / cards.length).toBeGreaterThan(0.9);
    for (const card of identified) {
      const expected = catalog.seriesRanges.has(card.seriesId) ? 1 : 0;
      expect(card.badges, `series ${card.seriesId}`).toBe(expected);
    }
    testInfo.annotations.push({
      type: "cards",
      description: `${cards.length} series cards, ${identified.length} identified after scrolling, ${cards.filter((card) => card.badges).length} badged`,
    });
  });

  test("watch page sidebar, behind the login prompt: cards with a catalog difficulty are badged", async ({ context }, testInfo) => {
    const page = await context.newPage();
    await page.goto(DREAMING_PLAYER_VIDEO.url);
    await settledBadgeCount(page);
    expectEnhancedCards(await readVideoCards(page), testInfo);
  });
});

test("Fill missing only, Browse sorted by Easy: Dreaming's badges stay and are not duplicated", async ({ context, setSettings }) => {
  await setSettings({ difficultyEnabled: true, behavior: "fill-missing" });
  const page = await context.newPage();
  await page.goto("https://app.dreaming.com/spanish/browse?sort=easy");
  await expect(page.locator(".ds-video-thumbnail__badge--vocab-range").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3_000); // give the extension time to act, if it wrongly would

  const cards = await readVideoCards(page);
  const withNative = cards.filter((card) => card.native !== "none");
  expect(withNative.length).toBeGreaterThan(0);
  for (const card of withNative) {
    expect(card, `video ${card.videoId}`).toMatchObject({ native: "shown", extensionBadges: 0 });
  }
});

test("badges switched off: no extension badges", async ({ context, setSettings }) => {
  await setSettings({ difficultyEnabled: false });
  const page = await context.newPage();
  await page.goto("https://app.dreaming.com/spanish/browse");
  await expect(page.locator("[data-video-id] .ds-video-thumbnail").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await expect(page.locator(".ds-difficulty-extension-badge")).toHaveCount(0);
});
