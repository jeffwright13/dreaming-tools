import { describe, expect, it } from "vitest";
import "../src/core.js";

const {
  buildCatalogIndexes,
  calculateDifficulty,
  extractSeriesId,
  formatDifficultyRange,
  getCatalogUrl,
  getLanguageCode,
  normalizeSettings,
} = globalThis.DreamingDifficultyCore;

describe("settings", () => {
  it("supplies the recommended defaults", () => {
    expect(normalizeSettings({})).toEqual({
      behavior: "enhanced-everywhere",
      style: "enhanced",
      size: "small",
      position: "lower-left",
    });
  });

  it("replaces invalid values with defaults", () => {
    expect(normalizeSettings({
      behavior: "invalid",
      style: "dreaming",
      size: "large",
      position: "upper-left",
    })).toEqual({
      behavior: "enhanced-everywhere",
      style: "dreaming",
      size: "large",
      position: "upper-left",
    });
  });
});

describe("language selection", () => {
  it.each([
    ["/spanish/library", "es"],
    ["/french/series", "fr"],
    ["/SPANISH/browse", "es"],
    ["/german/library", null],
  ])("maps %s to %s", (pathname, expected) => {
    expect(getLanguageCode(pathname)).toBe(expected);
  });

  it("builds the public catalog URL", () => {
    expect(getCatalogUrl("fr")).toBe("https://app.dreaming.com/videos/prod/fr.json");
  });
});

describe("calculateDifficulty", () => {
  it.each([
    [1185, 41],
    [1224, 43],
    [1265, 44],
    [200, 0],
    [2600, 100],
    [-100, 0],
    [3000, 100],
  ])("converts raw score %s to displayed difficulty %s", (score, expected) => {
    expect(calculateDifficulty(score)).toBe(expected);
  });

  it("returns null for a missing or invalid score", () => {
    expect(calculateDifficulty(undefined)).toBeNull();
    expect(calculateDifficulty("1185")).toBeNull();
  });
});

describe("extractSeriesId", () => {
  it.each([
    [
      "https://example.com/series-6a1fe0ea4a6295f32ed34f4d-vertical.jpg",
      "6a1fe0ea4a6295f32ed34f4d",
    ],
    [
      "https://example.com/series-6a1fe0ea4a6295f32ed34f4d-cover.jpg",
      "6a1fe0ea4a6295f32ed34f4d",
    ],
    [
      "https://app.dreaming.com/spanish/watch?series=6a1fe0ea4a6295f32ed34f4d",
      "6a1fe0ea4a6295f32ed34f4d",
    ],
  ])("extracts the series ID from %s", (value, expected) => {
    expect(extractSeriesId(value)).toBe(expected);
  });

  it("returns null when no series ID is present", () => {
    expect(extractSeriesId("https://example.com/image.jpg")).toBeNull();
  });
});

describe("buildCatalogIndexes", () => {
  it("indexes videos and calculates series ranges while ignoring unscored videos", () => {
    const videos = [
      { _id: "a", seriesId: "series-a", difficultyScore: 1185 },
      { _id: "b", seriesId: "series-a", difficultyScore: 1265 },
      { _id: "c", seriesId: "series-a" },
      { _id: "d", seriesId: "series-b", difficultyScore: 1224 },
    ];

    const { seriesRanges, videosById } = buildCatalogIndexes(videos);

    expect(videosById.get("a")).toEqual(videos[0]);
    expect(seriesRanges.get("series-a")).toEqual({ minimum: 41, maximum: 44 });
    expect(seriesRanges.get("series-b")).toEqual({ minimum: 43, maximum: 43 });
  });
});

describe("formatDifficultyRange", () => {
  it("formats distinct endpoints as a range", () => {
    expect(formatDifficultyRange({ minimum: 32, maximum: 39 })).toBe("32–39");
  });

  it("formats equal endpoints as one value", () => {
    expect(formatDifficultyRange({ minimum: 42, maximum: 42 })).toBe("42");
  });
});
