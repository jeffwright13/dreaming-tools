// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import "../src/core.js";
import "../src/content.js";

const { buildCatalogIndexes } = globalThis.DreamingDifficultyCore;
const { enhancePage } = globalThis.DreamingDifficultyContent;

const SERIES_ID = "6a1fe0ea4a6295f32ed34f4d";
const VIDEO_ID = "69aeabe8b0b7b6f88770360c";

const indexes = buildCatalogIndexes([
  { _id: VIDEO_ID, seriesId: SERIES_ID, difficultyScore: 1185 },
  { _id: "second", seriesId: SERIES_ID, difficultyScore: 1265 },
]);

beforeEach(() => {
  document.body.replaceChildren();
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
});
