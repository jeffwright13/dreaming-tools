import { describe, expect, it } from "vitest";
import "../src/core.js";

const {
  buildCatalogIndexes,
  calculateDifficulty,
  extractSeriesId,
  formatDifficultyRange,
} = globalThis.DreamingDifficultyCore;

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
