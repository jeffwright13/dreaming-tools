(() => {
  const EXTENSION_BADGE_SELECTOR = ".ds-difficulty-extension-badge";
  const EXTENSION_CHIP_SELECTOR = ".ds-difficulty-extension-chip";
  const WATCH_PAGE_BADGES_SELECTOR = '[data-testid="video-badges"]';
  const NATIVE_DIFFICULTY_SELECTOR = ".ds-video-thumbnail__badge--vocab-range";
  const SERIES_CARD_SELECTOR = [
    '[data-testid="series-catalog-card"]',
    '[data-testid="library-series-card"]',
    ".ds-series-modal__header",
  ].join(",");

  const { DEFAULT_SETTINGS, normalizeSettings } = globalThis.DreamingToolsSettings;
  const {
    buildCatalogIndexes,
    calculateDifficulty,
    extractSeriesId,
    formatDifficultyRange,
    getCatalogUrl,
    getLanguageCode,
  } = globalThis.DreamingDifficultyCore;

  function findAll(root, selector) {
    const matches = root.querySelectorAll ? [...root.querySelectorAll(selector)] : [];
    if (root.matches?.(selector)) {
      matches.unshift(root);
    }
    return matches;
  }

  function setBadgeClasses(badge, modifier, settings) {
    badge.className = [
      "ds-difficulty-extension-badge",
      `ds-difficulty-extension-badge--${modifier}`,
      `ds-difficulty-extension-badge--style-${settings.style}`,
      `ds-difficulty-extension-badge--size-${settings.size}`,
      `ds-difficulty-extension-badge--position-${settings.position}`,
    ].join(" ");
  }

  function createBadge(text, modifier, label, settings) {
    const badge = document.createElement("span");
    setBadgeClasses(badge, modifier, settings);
    badge.textContent = text;
    badge.title = label;
    badge.setAttribute("aria-label", label);
    return badge;
  }

  function restorePage(root) {
    for (const badge of findAll(root, `${EXTENSION_BADGE_SELECTOR},${EXTENSION_CHIP_SELECTOR}`)) {
      badge.remove();
    }
    for (const badge of findAll(root, NATIVE_DIFFICULTY_SELECTOR)) {
      badge.hidden = false;
    }
  }

  function enhanceVideoCards(root, videosById, settings) {
    for (const thumbnail of findAll(root, "[data-video-id] .ds-video-thumbnail")) {
      const nativeBadge = thumbnail.querySelector(NATIVE_DIFFICULTY_SELECTOR);
      const extensionBadge = thumbnail.querySelector(EXTENSION_BADGE_SELECTOR);

      if (nativeBadge && settings.behavior === "fill-missing") {
        nativeBadge.hidden = false;
        extensionBadge?.remove();
        continue;
      }

      const videoId = thumbnail.closest("[data-video-id]")?.dataset.videoId;
      const difficulty = calculateDifficulty(videosById.get(videoId)?.difficultyScore);
      if (difficulty === null) {
        if (nativeBadge) {
          nativeBadge.hidden = false;
        }
        continue;
      }

      if (nativeBadge) {
        nativeBadge.hidden = true;
      }

      if (extensionBadge) {
        setBadgeClasses(extensionBadge, "video", settings);
        continue;
      }

      thumbnail.append(
        createBadge(
          String(difficulty),
          "video",
          `Difficulty ${difficulty} out of 100`,
          settings,
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

  function enhanceSeriesCards(root, seriesRanges, settings) {
    for (const card of findAll(root, SERIES_CARD_SELECTOR)) {
      const range = seriesRanges.get(getSeriesId(card));
      const text = formatDifficultyRange(range);
      if (!text) {
        continue;
      }

      const extensionBadge = card.querySelector(EXTENSION_BADGE_SELECTOR);
      if (extensionBadge) {
        setBadgeClasses(extensionBadge, "series", settings);
        continue;
      }

      const label = range.minimum === range.maximum
        ? `Difficulty ${range.minimum} out of 100`
        : `Difficulty range ${range.minimum} to ${range.maximum} out of 100`;
      card.append(createBadge(text, "series", label, settings));
    }
  }

  function getWatchPageChips(indexes) {
    const video = indexes.videosById.get(new URLSearchParams(location.search).get("id"));
    const difficulty = calculateDifficulty(video?.difficultyScore);
    const range = indexes.seriesRanges.get(video?.seriesId);
    const chips = {};

    if (difficulty !== null) {
      chips.video = {
        text: `Difficulty ${difficulty}`,
        label: `Difficulty ${difficulty} out of 100`,
      };
    }

    if (range) {
      chips.series = {
        text: `Series ${formatDifficultyRange(range)}`,
        label: range.minimum === range.maximum
          ? `Series difficulty ${range.minimum} out of 100`
          : `Series difficulty range ${range.minimum} to ${range.maximum} out of 100`,
      };
    }

    return chips;
  }

  // The page observer reruns this on every child-node change, so only touch
  // the DOM when a chip is missing, stale, or no longer wanted.
  function updateWatchPageChip(row, modifier, chip, settings) {
    let element = row.querySelector(`${EXTENSION_CHIP_SELECTOR}--${modifier}`);
    if (!chip) {
      element?.remove();
      return;
    }

    if (!element) {
      element = document.createElement("span");
      if (modifier === "video") {
        row.prepend(element);
      } else {
        const videoChip = row.querySelector(`${EXTENSION_CHIP_SELECTOR}--video`);
        videoChip ? videoChip.after(element) : row.prepend(element);
      }
    }

    element.className = [
      "ds-difficulty-extension-chip",
      `ds-difficulty-extension-chip--${modifier}`,
      `ds-difficulty-extension-chip--style-${settings.style}`,
    ].join(" ");
    if (element.textContent !== chip.text) {
      element.textContent = chip.text;
    }
    element.title = chip.label;
    element.setAttribute("aria-label", chip.label);
  }

  function enhanceWatchPage(root, indexes, settings) {
    for (const row of findAll(root, WATCH_PAGE_BADGES_SELECTOR)) {
      const chips = getWatchPageChips(indexes);
      updateWatchPageChip(row, "video", chips.video, settings);
      updateWatchPageChip(row, "series", chips.series, settings);
    }
  }

  function enhancePage(root, indexes, rawSettings = DEFAULT_SETTINGS) {
    const settings = normalizeSettings(rawSettings);
    if (!settings.difficultyEnabled) {
      restorePage(root);
      return;
    }

    enhanceVideoCards(root, indexes.videosById, settings);
    enhanceSeriesCards(root, indexes.seriesRanges, settings);
    enhanceWatchPage(root, indexes, settings);
  }

  async function loadCatalog(languageCode) {
    const response = await fetch(getCatalogUrl(languageCode), { credentials: "omit" });
    if (!response.ok) {
      throw new Error(`Catalog request failed with status ${response.status}`);
    }

    const catalog = await response.json();
    if (!Array.isArray(catalog.videos)) {
      throw new Error("Catalog response does not contain a videos array");
    }

    return buildCatalogIndexes(catalog.videos);
  }

  // One feature instance per page. update() is called with the full settings
  // object at startup and after every settings change; it downloads the
  // catalog lazily, so a disabled feature makes no network request.
  function createDifficultyFeature(pathname) {
    const languageCode = getLanguageCode(pathname);
    let settings = DEFAULT_SETTINGS;
    let indexes = null;
    let catalogRequest = null;
    let observer = null;
    let updateScheduled = false;

    function scheduleUpdate() {
      if (updateScheduled) {
        return;
      }

      updateScheduled = true;
      requestAnimationFrame(() => {
        updateScheduled = false;
        enhancePage(document, indexes, settings);
      });
    }

    function start() {
      enhancePage(document, indexes, settings);
      observer = new MutationObserver(scheduleUpdate);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    function stop() {
      observer?.disconnect();
      observer = null;
      restorePage(document);
    }

    function getIndexes() {
      catalogRequest ??= loadCatalog(languageCode).catch((error) => {
        catalogRequest = null;
        throw error;
      });
      return catalogRequest;
    }

    async function update(nextSettings) {
      settings = normalizeSettings(nextSettings);
      if (!languageCode) {
        return;
      }

      if (!settings.difficultyEnabled) {
        stop();
        return;
      }

      try {
        indexes ??= await getIndexes();
      } catch (error) {
        console.error("Dreaming Tools could not load the video catalog.", error);
        return;
      }

      // Settings may have changed while the catalog was downloading.
      if (!settings.difficultyEnabled) {
        return;
      }

      if (observer) {
        restorePage(document);
        enhancePage(document, indexes, settings);
      } else {
        start();
      }
    }

    return { update };
  }

  globalThis.DreamingDifficultyFeature = {
    createDifficultyFeature,
    enhancePage,
    loadCatalog,
    restorePage,
  };
})();
