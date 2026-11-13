// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/settings.js";
import "../src/difficulty-core.js";
import "../src/difficulty.js";

const { buildCatalogIndexes } = globalThis.DreamingDifficultyCore;
const { DEFAULT_SETTINGS } = globalThis.DreamingToolsSettings;
// Difficulty badges are opt-in, so tests that need them on say so explicitly.
const ENABLED = { ...DEFAULT_SETTINGS, difficultyEnabled: true };
const { createDifficultyFeature, enhancePage, loadCatalog } = globalThis.DreamingDifficultyFeature;

const SERIES_ID = "6a1fe0ea4a6295f32ed34f4d";
const VIDEO_ID = "69aeabe8b0b7b6f88770360c";
const STANDALONE_VIDEO_ID = "6acf7cafde6364c576cb8167";

const indexes = buildCatalogIndexes([
  { _id: VIDEO_ID, seriesId: SERIES_ID, difficultyScore: 1185 },
  { _id: "second", seriesId: SERIES_ID, difficultyScore: 1265 },
  { _id: STANDALONE_VIDEO_ID, difficultyScore: 1400 },
]);

const WATCH_PAGE_BADGES = `
  <div data-testid="video-badges">
    <div data-testid="video-level-badge">Beginner</div>
    <div data-testid="video-country-badge">Spain</div>
  </div>
`;

function showWatchPage(videoId) {
  window.history.replaceState({}, "", `/spanish/watch?id=${videoId}`);
}

function watchPageChipTexts() {
  return [...document.querySelector('[data-testid="video-badges"]').children]
    .map((child) => child.textContent.trim());
}

beforeEach(() => {
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("enhancePage", () => {
  it("adds a difficulty badge to a catalog video card", () => {
    document.body.innerHTML = `
      <div data-testid="catalog-video-card" data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail"></div>
      </div>
    `;

    enhancePage(document, indexes, ENABLED);

    const badge = document.querySelector(".ds-difficulty-extension-badge--video");
    expect(badge?.textContent).toBe("41");
    expect(badge?.getAttribute("aria-label")).toBe("Difficulty 41 out of 100");
  });

  it("preserves Dreaming's native badge by default", () => {
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail">
          <span class="ds-video-thumbnail__badge--vocab-range">41</span>
        </div>
      </div>
    `;

    enhancePage(document, indexes, ENABLED);

    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
    expect(document.querySelector(".ds-video-thumbnail__badge--vocab-range")?.hidden).toBe(false);
  });

  it("replaces Dreaming's native badge in enhanced-everywhere mode", () => {
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail">
          <span class="ds-video-thumbnail__badge--vocab-range">41</span>
        </div>
      </div>
    `;

    enhancePage(document, indexes, { ...ENABLED, behavior: "enhanced-everywhere" });

    expect(document.querySelector(".ds-difficulty-extension-badge")?.textContent).toBe("41");
    expect(document.querySelector(".ds-video-thumbnail__badge--vocab-range")?.hidden).toBe(true);
  });

  it("preserves a native badge when the video is absent from the catalog", () => {
    document.body.innerHTML = `
      <div data-video-id="unknown">
        <div class="ds-video-thumbnail">
          <span class="ds-video-thumbnail__badge--vocab-range">41</span>
        </div>
      </div>
    `;

    enhancePage(document, indexes, { ...ENABLED, behavior: "enhanced-everywhere" });

    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
    expect(document.querySelector(".ds-video-thumbnail__badge--vocab-range")?.hidden).toBe(false);
  });

  it("preserves Dreaming's native badge in fill-missing mode", () => {
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail">
          <span class="ds-video-thumbnail__badge--vocab-range">41</span>
        </div>
      </div>
    `;

    enhancePage(document, indexes, { ...ENABLED, behavior: "fill-missing" });

    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
    expect(document.querySelector(".ds-video-thumbnail__badge--vocab-range")?.hidden).toBe(false);
  });

  it("restores the original page when the feature is disabled", () => {
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail">
          <span class="ds-video-thumbnail__badge--vocab-range" hidden>41</span>
          <span class="ds-difficulty-extension-badge">41</span>
        </div>
      </div>
    `;

    enhancePage(document, indexes, { ...ENABLED, difficultyEnabled: false });

    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
    expect(document.querySelector(".ds-video-thumbnail__badge--vocab-range")?.hidden).toBe(false);
  });

  it("applies configured style, size, and position", () => {
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail"></div>
      </div>
    `;

    enhancePage(document, indexes, {
      ...ENABLED,
      behavior: "enhanced-everywhere",
      style: "dreaming",
      size: "large",
      position: "upper-left",
    });

    const badge = document.querySelector(".ds-difficulty-extension-badge");
    expect(badge?.classList.contains("ds-difficulty-extension-badge--style-dreaming")).toBe(true);
    expect(badge?.classList.contains("ds-difficulty-extension-badge--size-large")).toBe(true);
    expect(badge?.classList.contains("ds-difficulty-extension-badge--position-upper-left")).toBe(true);
  });

  it("is idempotent", () => {
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail"></div>
      </div>
    `;

    enhancePage(document, indexes, ENABLED);
    enhancePage(document, indexes, ENABLED);

    expect(document.querySelectorAll(".ds-difficulty-extension-badge")).toHaveLength(1);
  });

  it("omits a series badge when no scored episodes are available", () => {
    document.body.innerHTML = `
      <div data-testid="series-catalog-card">
        <img src="https://example.com/series-000000000000000000000000-vertical.jpg">
      </div>
    `;

    enhancePage(document, indexes, ENABLED);

    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
  });

  it("adds a range to a series catalog card", () => {
    document.body.innerHTML = `
      <div data-testid="series-catalog-card">
        <img src="https://example.com/series-${SERIES_ID}-vertical.jpg">
      </div>
    `;

    enhancePage(document, indexes, ENABLED);

    const badge = document.querySelector(".ds-difficulty-extension-badge--series");
    expect(badge?.textContent).toBe("41–44");
    expect(badge?.getAttribute("aria-label")).toBe("Difficulty range 41 to 44 out of 100");
  });

  // Markup from the Series page's Continue watching row (2026-11-13), trimmed.
  it("adds a range to a Continue watching series card", () => {
    document.body.innerHTML = `
      <div class="_card_175sm_1 _fill_175sm_20" data-testid="series-card">
        <div class="ds-image"><img class="ds-image__image" src="https://example.com/series-${SERIES_ID}-horizontal.jpg" alt=""></div>
        <div class="_overlay_175sm_13"></div>
        <span class="ds-series-continue-watching__play-button" aria-hidden="true"></span>
        <a class="_action_175sm_84" href="/spanish/watch?series=${SERIES_ID}"><span class="sr-only">Play</span></a>
      </div>
    `;

    enhancePage(document, indexes, ENABLED);

    expect(document.querySelector(".ds-difficulty-extension-badge--series")?.textContent).toBe("41–44");
  });

  it("adds a range to the cover in a dynamically rendered series modal", () => {
    document.body.innerHTML = `
      <div class="ds-series-modal__header">
        <img class="ds-series-modal__cover" src="https://example.com/series-${SERIES_ID}-cover.jpg">
      </div>
    `;

    enhancePage(document, indexes, ENABLED);

    expect(document.querySelector(".ds-difficulty-extension-badge--series")?.textContent).toBe("41–44");
  });

  it("adds a range to the cover in the series modal's hero layout", () => {
    document.body.innerHTML = `
      <div class="ds-series-modal__hero">
        <img class="ds-series-modal__cover" src="https://example.com/series-${SERIES_ID}-cover.jpg">
      </div>
    `;

    enhancePage(document, indexes, ENABLED);

    expect(document.querySelector(".ds-difficulty-extension-badge--series")?.textContent).toBe("41–44");
  });

  it("extracts a series ID from a modal link and updates an existing badge", () => {
    document.body.innerHTML = `
      <div class="ds-series-modal__header">
        <a href="/spanish/watch?series=${SERIES_ID}"></a>
        <span class="ds-difficulty-extension-badge"></span>
      </div>
    `;

    enhancePage(document, indexes, { ...ENABLED, size: "large" });

    const badge = document.querySelector(".ds-difficulty-extension-badge");
    expect(badge?.classList.contains("ds-difficulty-extension-badge--series")).toBe(true);
    expect(badge?.classList.contains("ds-difficulty-extension-badge--size-large")).toBe(true);
  });
});

describe("watch page", () => {
  it("adds video and series difficulty chips before the level badge", () => {
    showWatchPage(VIDEO_ID);
    document.body.innerHTML = WATCH_PAGE_BADGES;

    enhancePage(document, indexes, ENABLED);

    expect(watchPageChipTexts()).toEqual(["Difficulty 41", "Series 41–44", "Beginner", "Spain"]);
    expect(document.querySelector(".ds-difficulty-extension-chip--video")?.getAttribute("aria-label"))
      .toBe("Difficulty 41 out of 100");
    expect(document.querySelector(".ds-difficulty-extension-chip--series")?.getAttribute("aria-label"))
      .toBe("Series difficulty range 41 to 44 out of 100");
  });

  it("adds only a video chip when the video is not part of a series", () => {
    showWatchPage(STANDALONE_VIDEO_ID);
    document.body.innerHTML = WATCH_PAGE_BADGES;

    enhancePage(document, indexes, ENABLED);

    expect(watchPageChipTexts()).toEqual(["Difficulty 50", "Beginner", "Spain"]);
  });

  it("shows a single series difficulty when all episodes share one score", () => {
    const uniformSeriesIndexes = buildCatalogIndexes([
      { _id: VIDEO_ID, seriesId: SERIES_ID, difficultyScore: 1185 },
      { _id: "second", seriesId: SERIES_ID, difficultyScore: 1185 },
    ]);
    showWatchPage(VIDEO_ID);
    document.body.innerHTML = WATCH_PAGE_BADGES;

    enhancePage(document, uniformSeriesIndexes, ENABLED);

    expect(watchPageChipTexts()).toEqual(["Difficulty 41", "Series 41", "Beginner", "Spain"]);
    expect(document.querySelector(".ds-difficulty-extension-chip--series")?.getAttribute("aria-label"))
      .toBe("Series difficulty 41 out of 100");
  });

  it("adds no chips when the video is absent from the catalog", () => {
    showWatchPage("unknown");
    document.body.innerHTML = WATCH_PAGE_BADGES;

    enhancePage(document, indexes, ENABLED);

    expect(document.querySelector(".ds-difficulty-extension-chip")).toBeNull();
  });

  it("updates chips after client-side navigation to another video", () => {
    showWatchPage(VIDEO_ID);
    document.body.innerHTML = WATCH_PAGE_BADGES;
    enhancePage(document, indexes, ENABLED);

    showWatchPage(STANDALONE_VIDEO_ID);
    enhancePage(document, indexes, ENABLED);

    expect(watchPageChipTexts()).toEqual(["Difficulty 50", "Beginner", "Spain"]);
  });

  it("does not modify child nodes when chips are already current", () => {
    showWatchPage(VIDEO_ID);
    document.body.innerHTML = WATCH_PAGE_BADGES;
    enhancePage(document, indexes, ENABLED);
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    enhancePage(document, indexes, ENABLED);

    expect(observer.takeRecords()).toEqual([]);
    observer.disconnect();
  });

  it("applies the configured style", () => {
    showWatchPage(VIDEO_ID);
    document.body.innerHTML = WATCH_PAGE_BADGES;

    enhancePage(document, indexes, { ...ENABLED, style: "enhanced" });

    for (const chip of document.querySelectorAll(".ds-difficulty-extension-chip")) {
      expect(chip.classList.contains("ds-difficulty-extension-chip--style-enhanced")).toBe(true);
    }
  });

  it("removes chips when the feature is disabled", () => {
    showWatchPage(VIDEO_ID);
    document.body.innerHTML = WATCH_PAGE_BADGES;
    enhancePage(document, indexes, ENABLED);

    enhancePage(document, indexes, { ...ENABLED, difficultyEnabled: false });

    expect(watchPageChipTexts()).toEqual(["Beginner", "Spain"]);
  });
});

describe("catalog loading", () => {
  it("downloads and indexes the selected language catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ videos: [{ _id: VIDEO_ID, difficultyScore: 1185 }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const loaded = await loadCatalog("fr");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.dreaming.com/videos/prod/fr.json",
      { credentials: "omit" },
    );
    expect(loaded.videosById.get(VIDEO_ID)?.difficultyScore).toBe(1185);
  });

  it("rejects unsuccessful or malformed catalog responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(loadCatalog("es")).rejects.toThrow("status 503");

    fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ videos: null }) });
    await expect(loadCatalog("es")).rejects.toThrow("videos array");
  });
});

describe("difficulty feature", () => {
  const CATALOG = { videos: [{ _id: VIDEO_ID, difficultyScore: 1185 }] };
  const VIDEO_CARD = `<div data-video-id="${VIDEO_ID}"><div class="ds-video-thumbnail"></div></div>`;

  function badge() {
    return document.querySelector(".ds-difficulty-extension-badge");
  }

  function stubCatalog(response = { ok: true, json: vi.fn().mockResolvedValue(CATALOG) }) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  }

  function stubObserver() {
    const observer = { callback: null, observe: vi.fn(), disconnect: vi.fn() };
    vi.stubGlobal("MutationObserver", class {
      constructor(callback) {
        observer.callback = callback;
        this.observe = observer.observe;
        this.disconnect = observer.disconnect;
      }
    });
    return observer;
  }

  beforeEach(() => {
    window.history.replaceState({}, "", "/spanish/library");
    document.body.innerHTML = VIDEO_CARD;
  });

  it("identifies itself for error reports", () => {
    expect(createDifficultyFeature(location.pathname).name).toBe("difficulty");
  });

  it("loads the catalog, enhances the page, and restyles on settings changes", async () => {
    stubCatalog();
    stubObserver();
    const feature = createDifficultyFeature(location.pathname);

    await feature.update(ENABLED);
    expect(badge()?.textContent).toBe("41");
    expect(badge()?.className).toContain("--size-small");

    await feature.update({ ...ENABLED, size: "large" });
    expect(badge()?.className).toContain("--size-large");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("coalesces page mutations into one update per animation frame", async () => {
    stubCatalog();
    const observer = stubObserver();
    const requestAnimationFrameMock = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    await createDifficultyFeature(location.pathname).update(ENABLED);

    expect(observer.observe).toHaveBeenCalledWith(document.body, { childList: true, subtree: true });
    observer.callback();
    observer.callback();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    requestAnimationFrameMock.mock.calls[0][0]();
    observer.callback();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
  });

  it("does not download the catalog while disabled", async () => {
    stubCatalog();
    stubObserver();

    await createDifficultyFeature(location.pathname).update({ ...DEFAULT_SETTINGS, difficultyEnabled: false });

    expect(fetch).not.toHaveBeenCalled();
    expect(badge()).toBeNull();
  });

  it("starts when enabled later and stops cleanly when disabled again", async () => {
    stubCatalog();
    const observer = stubObserver();
    const feature = createDifficultyFeature(location.pathname);
    await feature.update({ ...DEFAULT_SETTINGS, difficultyEnabled: false });

    await feature.update(ENABLED);
    expect(badge()?.textContent).toBe("41");

    await feature.update({ ...DEFAULT_SETTINGS, difficultyEnabled: false });
    expect(badge()).toBeNull();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("stays off when disabled while the catalog is still downloading", async () => {
    let resolveFetch;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    const observer = stubObserver();
    const feature = createDifficultyFeature(location.pathname);

    const enabling = feature.update(ENABLED);
    const disabling = feature.update({ ...DEFAULT_SETTINGS, difficultyEnabled: false });
    resolveFetch({ ok: true, json: vi.fn().mockResolvedValue(CATALOG) });
    await Promise.all([enabling, disabling]);

    expect(badge()).toBeNull();
    expect(observer.observe).not.toHaveBeenCalled();
  });

  it("ends enabled when toggled on, off, and on again while the catalog is downloading", async () => {
    let resolveFetch;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; })));
    const observer = stubObserver();
    const feature = createDifficultyFeature(location.pathname);

    const updates = [
      feature.update(ENABLED),
      feature.update({ ...DEFAULT_SETTINGS, difficultyEnabled: false }),
      feature.update({ ...ENABLED, size: "large" }),
    ];
    resolveFetch({ ok: true, json: vi.fn().mockResolvedValue(CATALOG) });
    await Promise.all(updates);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".ds-difficulty-extension-badge")).toHaveLength(1);
    expect(badge()?.className).toContain("--size-large");
    expect(observer.observe).toHaveBeenCalledTimes(1);
  });

  it("does nothing on an unsupported language path", async () => {
    stubCatalog();
    window.history.replaceState({}, "", "/german/library");

    await createDifficultyFeature(location.pathname).update(ENABLED);

    expect(fetch).not.toHaveBeenCalled();
    expect(badge()).toBeNull();
  });

  it("reports catalog failures without changing the page, then retries on the next update", async () => {
    stubCatalog({ ok: false, status: 500 });
    stubObserver();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const feature = createDifficultyFeature(location.pathname);

    await feature.update(ENABLED);
    expect(consoleError).toHaveBeenCalledWith(
      "Dreaming Tools could not load the video catalog.",
      expect.any(Error),
    );
    expect(badge()).toBeNull();

    fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(CATALOG) });
    await feature.update(ENABLED);
    expect(badge()?.textContent).toBe("41");
  });
});
