(() => {
  const CATALOG_URL = "https://app.dreaming.com/videos/prod/es.json";
  const EXTENSION_BADGE_SELECTOR = ".ds-difficulty-extension-badge";
  const NATIVE_DIFFICULTY_SELECTOR = ".ds-video-thumbnail__badge--vocab-range";
  const SERIES_CARD_SELECTOR = [
    '[data-testid="series-catalog-card"]',
    '[data-testid="library-series-card"]',
    ".ds-series-modal__header",
  ].join(",");

  const {
    buildCatalogIndexes,
    calculateDifficulty,
    extractSeriesId,
    formatDifficultyRange,
  } = globalThis.DreamingDifficultyCore;

  function findAll(root, selector) {
    const matches = root.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
    if (root.matches?.(selector)) {
      matches.unshift(root);
    }
    return matches;
  }

  function createBadge(text, modifier, label) {
    const badge = document.createElement("span");
    badge.className = `ds-difficulty-extension-badge ds-difficulty-extension-badge--${modifier}`;
    badge.textContent = text;
    badge.title = label;
    badge.setAttribute("aria-label", label);
    return badge;
  }

  function enhanceVideoCards(root, videosById) {
    for (const thumbnail of findAll(root, "[data-video-id] .ds-video-thumbnail")) {
      if (
        thumbnail.querySelector(EXTENSION_BADGE_SELECTOR) ||
        thumbnail.querySelector(NATIVE_DIFFICULTY_SELECTOR)
      ) {
        continue;
      }

      const videoId = thumbnail.closest("[data-video-id]")?.dataset.videoId;
      const difficulty = calculateDifficulty(videosById.get(videoId)?.difficultyScore);
      if (difficulty === null) {
        continue;
      }

      thumbnail.append(
        createBadge(
          String(difficulty),
          "video",
          `Difficulty ${difficulty} out of 100`,
        ),
      );
    }
  }

  function getSeriesId(card) {
    const imageId = extractSeriesId(card.querySelector('img[src*="series-"]')?.src);
    if (imageId) {
      return imageId;
    }

    return extractSeriesId(card.querySelector('a[href*="series="]')?.href);
  }

  function enhanceSeriesCards(root, seriesRanges) {
    for (const card of findAll(root, SERIES_CARD_SELECTOR)) {
      if (card.querySelector(EXTENSION_BADGE_SELECTOR)) {
        continue;
      }

      const range = seriesRanges.get(getSeriesId(card));
      const text = formatDifficultyRange(range);
      if (!text) {
        continue;
      }

      const label = range.minimum === range.maximum
        ? `Difficulty ${range.minimum} out of 100`
        : `Difficulty range ${range.minimum} to ${range.maximum} out of 100`;
      card.append(createBadge(text, "series", label));
    }
  }

  function enhancePage(root, indexes) {
    enhanceVideoCards(root, indexes.videosById);
    enhanceSeriesCards(root, indexes.seriesRanges);
  }

  async function loadCatalog() {
    const response = await fetch(CATALOG_URL, { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`Catalog request failed with status ${response.status}`);
    }

    const catalog = await response.json();
    if (!Array.isArray(catalog.videos)) {
      throw new Error("Catalog response does not contain a videos array");
    }

    return buildCatalogIndexes(catalog.videos);
  }

  async function initialize() {
    try {
      const indexes = await loadCatalog();
      enhancePage(document, indexes);

      let updateScheduled = false;
      const observer = new MutationObserver(() => {
        if (updateScheduled) {
          return;
        }

        updateScheduled = true;
        requestAnimationFrame(() => {
          updateScheduled = false;
          enhancePage(document, indexes);
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (error) {
      console.error("Dreaming Difficulty could not load the video catalog.", error);
    }
  }

  globalThis.DreamingDifficultyContent = { enhancePage, initialize };

  if (globalThis.chrome?.runtime?.id && typeof document !== "undefined") {
    initialize();
  }
})();
