// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/core.js";
import "../src/content.js";

const { buildCatalogIndexes } = globalThis.DreamingDifficultyCore;
const { enhancePage, initialize, loadCatalog } = globalThis.DreamingDifficultyContent;

const SERIES_ID = "6a1fe0ea4a6295f32ed34f4d";
const VIDEO_ID = "69aeabe8b0b7b6f88770360c";

const indexes = buildCatalogIndexes([
  { _id: VIDEO_ID, seriesId: SERIES_ID, difficultyScore: 1185 },
  { _id: "second", seriesId: SERIES_ID, difficultyScore: 1265 },
]);

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

    enhancePage(document, indexes);

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

    enhancePage(document, indexes);

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

    enhancePage(document, indexes, { behavior: "enhanced-everywhere" });

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

    enhancePage(document, indexes, { behavior: "enhanced-everywhere" });

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

    enhancePage(document, indexes, { behavior: "fill-missing" });

    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
    expect(document.querySelector(".ds-video-thumbnail__badge--vocab-range")?.hidden).toBe(false);
  });

  it("restores the original page in original mode", () => {
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}">
        <div class="ds-video-thumbnail">
          <span class="ds-video-thumbnail__badge--vocab-range" hidden>41</span>
          <span class="ds-difficulty-extension-badge">41</span>
        </div>
      </div>
    `;

    enhancePage(document, indexes, { behavior: "original" });

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

    enhancePage(document, indexes);
    enhancePage(document, indexes);

    expect(document.querySelectorAll(".ds-difficulty-extension-badge")).toHaveLength(1);
  });

  it("omits a series badge when no scored episodes are available", () => {
    document.body.innerHTML = `
      <div data-testid="series-catalog-card">
        <img src="https://example.com/series-000000000000000000000000-vertical.jpg">
      </div>
    `;

    enhancePage(document, indexes);

    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
  });

  it("adds a range to a series catalog card", () => {
    document.body.innerHTML = `
      <div data-testid="series-catalog-card">
        <img src="https://example.com/series-${SERIES_ID}-vertical.jpg">
      </div>
    `;

    enhancePage(document, indexes);

    const badge = document.querySelector(".ds-difficulty-extension-badge--series");
    expect(badge?.textContent).toBe("41–44");
    expect(badge?.getAttribute("aria-label")).toBe("Difficulty range 41 to 44 out of 100");
  });

  it("adds a range to the cover in a dynamically rendered series modal", () => {
    document.body.innerHTML = `
      <div class="ds-series-modal__header">
        <img class="ds-series-modal__cover" src="https://example.com/series-${SERIES_ID}-cover.jpg">
      </div>
    `;

    enhancePage(document, indexes);

    expect(document.querySelector(".ds-difficulty-extension-badge--series")?.textContent).toBe("41–44");
  });

  it("extracts a series ID from a modal link and updates an existing badge", () => {
    document.body.innerHTML = `
      <div class="ds-series-modal__header">
        <a href="/spanish/watch?series=${SERIES_ID}"></a>
        <span class="ds-difficulty-extension-badge"></span>
      </div>
    `;

    enhancePage(document, indexes, { size: "large" });

    const badge = document.querySelector(".ds-difficulty-extension-badge");
    expect(badge?.classList.contains("ds-difficulty-extension-badge--series")).toBe(true);
    expect(badge?.classList.contains("ds-difficulty-extension-badge--size-large")).toBe(true);
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

describe("initialization", () => {
  it("loads settings, enhances the page, and applies synchronized changes", async () => {
    window.history.replaceState({}, "", "/spanish/library");
    document.body.innerHTML = `
      <div data-video-id="${VIDEO_ID}"><div class="ds-video-thumbnail"></div></div>
    `;
    const listeners = [];
    let mutationCallback;
    const requestAnimationFrameMock = vi.fn();
    class MutationObserverMock {
      constructor(callback) {
        mutationCallback = callback;
      }

      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ videos: [{ _id: VIDEO_ID, difficultyScore: 1185 }] }),
    }));
    vi.stubGlobal("MutationObserver", MutationObserverMock);
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.stubGlobal("chrome", {
      storage: {
        sync: { get: vi.fn().mockResolvedValue({ size: "small" }) },
        onChanged: { addListener: (listener) => listeners.push(listener) },
      },
    });

    const observer = await initialize();

    expect(document.querySelector(".ds-difficulty-extension-badge")?.textContent).toBe("41");
    listeners[0]({ size: { newValue: "large" } }, "local");
    expect(document.querySelector(".ds-difficulty-extension-badge")?.className).toContain("--size-small");
    listeners[0]({ size: { newValue: "large" } }, "sync");
    expect(document.querySelector(".ds-difficulty-extension-badge")?.className).toContain("--size-large");

    mutationCallback();
    mutationCallback();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    requestAnimationFrameMock.mock.calls[0][0]();
    mutationCallback();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
    observer.disconnect();
  });

  it("does nothing on an unsupported language path", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const result = await initialize();
    expect(result).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports catalog failures without changing the page", async () => {
    window.history.replaceState({}, "", "/french/library");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    vi.stubGlobal("chrome", { storage: { sync: {}, onChanged: {} } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await initialize();

    expect(consoleError).toHaveBeenCalledWith(
      "Dreaming Difficulty could not load the video catalog.",
      expect.any(Error),
    );
  });
});
