// Dreaming's public catalog, and checks of the extension's badges against it.
import { expect } from "./fixtures.js";
import "../../src/difficulty-core.js";

const { buildCatalogIndexes, calculateDifficulty, extractSeriesId, formatDifficultyRange, getCatalogUrl } = globalThis.DreamingDifficultyCore;
export { extractSeriesId, formatDifficultyRange };

export const LANGUAGE_CODES = Object.freeze({ spanish: "es", french: "fr" });

// The same public, credential-free request the extension makes.
export async function loadCatalog(language = "spanish") {
  const response = await fetch(getCatalogUrl(LANGUAGE_CODES[language]), { credentials: "omit" });
  expect(response.ok).toBe(true);
  const body = await response.json();
  const catalog = buildCatalogIndexes(Array.isArray(body) ? body : body.videos ?? []);
  expect(catalog.videosById.size).toBeGreaterThan(0);
  return {
    ...catalog,
    difficulty: (videoId) => calculateDifficulty(catalog.videosById.get(videoId)?.difficultyScore),
  };
}

// Wait until the extension has badged the page and the count stops changing.
export async function settledBadgeCount(page, selector = ".ds-difficulty-extension-badge") {
  const count = () => page.locator(selector).count();
  await expect.poll(count, { timeout: 20_000 }).toBeGreaterThan(0);
  let previous = -1;
  await expect.poll(async () => {
    const current = await count();
    const stable = current === previous;
    previous = current;
    return stable;
  }, { intervals: [1_000], timeout: 20_000 }).toBe(true);
}

export function readVideoCards(page, scope = "") {
  return page.locator(`${scope} [data-video-id] .ds-video-thumbnail`.trim()).evaluateAll((thumbnails) => thumbnails.map((thumbnail) => {
    const native = thumbnail.querySelector(".ds-video-thumbnail__badge--vocab-range");
    return {
      videoId: thumbnail.closest("[data-video-id]").dataset.videoId,
      extensionBadges: thumbnail.querySelectorAll(".ds-difficulty-extension-badge").length,
      badgeText: thumbnail.querySelector(".ds-difficulty-extension-badge")?.textContent ?? null,
      native: native ? (native.hidden ? "hidden" : "shown") : "none",
    };
  }));
}

// In Enhanced everywhere, a card whose video has a catalog difficulty shows
// exactly one badge with that number, and a card without one shows none.
export function expectEnhancedCards(cards, catalog, testInfo) {
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    const difficulty = catalog.difficulty(card.videoId);
    if (difficulty === null) {
      expect(card.extensionBadges, `video ${card.videoId} has no catalog difficulty`).toBe(0);
    } else {
      expect(card.extensionBadges, `video ${card.videoId} has catalog difficulty ${difficulty}`).toBe(1);
      expect(card.badgeText, `video ${card.videoId}`).toBe(String(difficulty));
    }
  }
  const unbadged = cards.filter((card) => card.extensionBadges === 0).map((card) => card.videoId);
  testInfo.annotations.push({
    type: "cards",
    description: `${cards.length} cards, ${cards.length - unbadged.length} badged; unbadged (no catalog difficulty): ${unbadged.join(", ") || "none"}`,
  });
}

// Series carousel cards load their image, which carries the series ID, only
// once scrolled into view. Bring every few cards into view so they load.
const SERIES_SCROLL_STEP = 6;
export async function loadAllSeriesCards(page, selector) {
  const cards = page.locator(selector);
  const total = await cards.count();
  for (let index = 0; index < total; index += SERIES_SCROLL_STEP) {
    await cards.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1_500);
}

export function readSeriesCards(page, selector) {
  return page.locator(selector).evaluateAll((elements) => elements.map((card) => ({
    image: card.querySelector('img[src*="series-"]')?.src ?? null,
    link: card.querySelector('a[href*="series="]')?.href ?? null,
    badges: card.querySelectorAll(".ds-difficulty-extension-badge").length,
  })));
}

export function expectSeriesCards(cards, catalog, testInfo) {
  const identified = cards
    .map((card) => ({ ...card, seriesId: extractSeriesId(card.image) ?? extractSeriesId(card.link) }))
    .filter((card) => card.seriesId);
  expect(cards.length).toBeGreaterThan(0);
  expect(identified.length / cards.length).toBeGreaterThan(0.9);
  for (const card of identified) {
    expect(card.badges, `series ${card.seriesId}`).toBe(catalog.seriesRanges.has(card.seriesId) ? 1 : 0);
  }
  testInfo.annotations.push({
    type: "cards",
    description: `${cards.length} series cards, ${identified.length} identified, ${cards.filter((card) => card.badges).length} badged`,
  });
}
