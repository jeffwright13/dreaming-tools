(() => {
  const DIFFICULTY_MIN = 200;
  const DIFFICULTY_MAX = 2600;
  const SERIES_ID_PATTERN = /(?:series[=/\-])([a-f0-9]{24})(?:[&#/?\-]|$)/i;

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
    buildCatalogIndexes,
    calculateDifficulty,
    extractSeriesId,
    formatDifficultyRange,
  };
})();
