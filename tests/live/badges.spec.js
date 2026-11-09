// Difficulty badges on live Dreaming pages, logged out, in Spanish and French.
// Each card is checked against Dreaming's public catalog for that language.
import { test, expect } from "./fixtures.js";
import {
  expectEnhancedCards,
  expectSeriesCards,
  loadAllSeriesCards,
  loadCatalog,
  readSeriesCards,
  readVideoCards,
  settledBadgeCount,
} from "./catalog.js";
import { DREAMING_PLAYER_VIDEO, routes } from "./routes.js";

const SERIES_CARD = '[data-testid="series-catalog-card"]';

for (const language of ["spanish", "french"]) {
  test.describe(`${language}, Enhanced everywhere`, () => {
    let catalog;
    test.beforeAll(async () => {
      catalog = await loadCatalog(language);
    });

    test.beforeEach(async ({ setSettings }) => {
      await setSettings({ difficultyEnabled: true, behavior: "enhanced-everywhere" });
    });

    test("Browse: every card with a catalog difficulty has one badge", async ({ context }, testInfo) => {
      const page = await context.newPage();
      await page.goto(routes.browse(language));
      await settledBadgeCount(page);
      expectEnhancedCards(await readVideoCards(page), catalog, testInfo);
    });

    test("Browse sorted by Easy: extension badges replace Dreaming's", async ({ context }, testInfo) => {
      const page = await context.newPage();
      await page.goto(routes.browseEasy(language));
      await settledBadgeCount(page);
      const cards = await readVideoCards(page);
      expectEnhancedCards(cards, catalog, testInfo);
      for (const card of cards.filter((candidate) => candidate.extensionBadges === 1)) {
        expect(card.native, `video ${card.videoId}`).not.toBe("shown");
      }
    });

    test("Series catalog: every series with a catalog range has one badge", async ({ context }, testInfo) => {
      const page = await context.newPage();
      await page.goto(routes.series(language));
      await settledBadgeCount(page);
      await loadAllSeriesCards(page, SERIES_CARD);
      expectSeriesCards(await readSeriesCards(page, SERIES_CARD), catalog, testInfo);
    });
  });
}

test.describe("spanish, other behaviors", () => {
  let catalog;
  test.beforeAll(async () => {
    catalog = await loadCatalog("spanish");
  });

  test("watch page sidebar, behind the login prompt: cards with a catalog difficulty are badged", async ({ context, setSettings }, testInfo) => {
    await setSettings({ difficultyEnabled: true, behavior: "enhanced-everywhere" });
    const page = await context.newPage();
    await page.goto(DREAMING_PLAYER_VIDEO.url);
    await settledBadgeCount(page);
    expectEnhancedCards(await readVideoCards(page), catalog, testInfo);
  });

  test("Fill missing only, Browse sorted by Easy: Dreaming's badges stay and are not duplicated", async ({ context, setSettings }) => {
    await setSettings({ difficultyEnabled: true, behavior: "fill-missing" });
    const page = await context.newPage();
    await page.goto(routes.browseEasy("spanish"));
    await expect(page.locator(".ds-video-thumbnail__badge--vocab-range").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3_000); // give the extension time to act, if it wrongly would

    const withNative = (await readVideoCards(page)).filter((card) => card.native !== "none");
    expect(withNative.length).toBeGreaterThan(0);
    for (const card of withNative) {
      expect(card, `video ${card.videoId}`).toMatchObject({ native: "shown", extensionBadges: 0 });
    }
  });

  test("badges switched off: no extension badges", async ({ context, setSettings }) => {
    await setSettings({ difficultyEnabled: false });
    const page = await context.newPage();
    await page.goto(routes.browse("spanish"));
    await expect(page.locator("[data-video-id] .ds-video-thumbnail").first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3_000);
    await expect(page.locator(".ds-difficulty-extension-badge")).toHaveCount(0);
  });
});
