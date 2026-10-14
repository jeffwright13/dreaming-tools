(() => {
  const DIFFICULTY_MIN = 200;
  const DIFFICULTY_MAX = 2600;
  const SERIES_ID_PATTERN = /(?:series[=/\-])([a-f0-9]{24})(?:[&#/?\-]|$)/i;
  const DEFAULT_SETTINGS = Object.freeze({
    behavior: "fill-missing",
    style: "dreaming",
    size: "small",
    position: "upper-right",
  });
  const SETTING_VALUES = {
    behavior: new Set(["enhanced-everywhere", "fill-missing", "original"]),
    style: new Set(["enhanced", "dreaming"]),
    size: new Set(["small", "medium", "large"]),
    position: new Set(["upper-right", "lower-left", "upper-left"]),
  };
  const LANGUAGE_CODES = {
    spanish: "es",
    french: "fr",
  };

  function normalizeSettings(settings = {}) {
    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, defaultValue]) => [
        key,
        SETTING_VALUES[key].has(settings[key]) ? settings[key] : defaultValue,
      ]),
    );
  }

  function getLanguageCode(pathname) {
    const languageName = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    return LANGUAGE_CODES[languageName] ?? null;
  }

  function getCatalogUrl(languageCode) {
    return `https://app.dreaming.com/videos/prod/${languageCode}.json`;
  }

  function calculateDifficulty(score) {
    if (!Number.isFinite(score)) {
      return null;
    }

    const percentage = ((score - DIFFICULTY_MIN) * 100) / (DIFFICULTY_MAX - DIFFICULTY_MIN);
    return Math.round(Math.max(0, Math.min(100, percentage)));
  }

  function extractSeriesId(value) {
    if (typeof value !== "string") {
      return null;
    }

    return value.match(SERIES_ID_PATTERN)?.[1] ?? null;
  }

  function buildCatalogIndexes(videos) {
    const videosById = new Map();
    const seriesDifficulties = new Map();

    for (const video of videos) {
      if (video?._id) {
        videosById.set(video._id, video);
      }

      const difficulty = calculateDifficulty(video?.difficultyScore);
      if (!video?.seriesId || difficulty === null) {
        continue;
      }

      const difficulties = seriesDifficulties.get(video.seriesId) ?? [];
      difficulties.push(difficulty);
      seriesDifficulties.set(video.seriesId, difficulties);
    }

    const seriesRanges = new Map(
      [...seriesDifficulties].map(([seriesId, difficulties]) => [
        seriesId,
        {
          minimum: Math.min(...difficulties),
          maximum: Math.max(...difficulties),
        },
      ]),
    );

    return { videosById, seriesRanges };
  }

  function formatDifficultyRange(range) {
    if (!range) {
      return null;
    }

    return range.minimum === range.maximum
      ? String(range.minimum)
      : `${range.minimum}–${range.maximum}`;
  }

  globalThis.DreamingDifficultyCore = {
    DEFAULT_SETTINGS,
    buildCatalogIndexes,
    calculateDifficulty,
    extractSeriesId,
    formatDifficultyRange,
    getCatalogUrl,
    getLanguageCode,
    normalizeSettings,
  };
})();
