(() => {
  const { DEFAULT_SETTINGS, SETTING_KEYS, normalizeSettings } = globalThis.DreamingToolsSettings;

  const DREAMING_ORIGIN = "https://app.dreaming.com";
  const DREAMING_HOSTNAME = "app.dreaming.com";
  const YOUTUBE_HOSTNAME = "www.youtube.com";
  const YOUTUBE_ORIGIN = "https://www.youtube.com";
  const YOUTUBE_FRAME_SELECTOR = ".ds-youtube-player iframe";
  // After an install or update, the background worker injects this script
  // into Dreaming tabs that were already open, where the previous copy is
  // still running: its storage listener no longer fires, but its key
  // listeners and page observer do. Each copy announces itself with this DOM
  // event, which every copy in the page receives, and a running copy that
  // hears it switches its features off.
  const REPLACED_EVENT = "dreaming-tools:replaced";
  // Every feature's enable switch, so a replaced copy can turn them all off.
  const FEATURE_SWITCHES = Object.keys(DEFAULT_SETTINGS).filter((key) => key.endsWith("Enabled"));

  // This script runs on Dreaming pages and, for YouTube-served videos, inside
  // YouTube embed frames. The manifest cannot restrict a content script by
  // the page that embeds a frame, so a YouTube frame checks its immediate
  // parent and runs nothing unless that parent is Dreaming.
  function selectFeatures(place) {
    if (place.hostname === DREAMING_HOSTNAME) {
      return [
        globalThis.DreamingDifficultyFeature.createDifficultyFeature(place.pathname),
        globalThis.DreamingSubtitlesFeature.createSubtitlesFeature({
          forwardTargets: () => [...document.querySelectorAll(YOUTUBE_FRAME_SELECTOR)]
            .map((frame) => frame.contentWindow)
            .filter(Boolean),
          forwardOrigin: YOUTUBE_ORIGIN,
        }),
      ];
    }

    const parentOrigin = place.ancestorOrigins?.[0];
    if (place.hostname === YOUTUBE_HOSTNAME && parentOrigin === DREAMING_ORIGIN && place.ancestorOrigins.length === 1) {
      return [
        globalThis.DreamingSubtitlesFeature.createSubtitlesFeature({
          // Verified live: works with YouTube's current embed layout. The CC
          // button is not used because that layout differs from the classic
          // player's .ytp-subtitles-button.
          shownSelector: ".ytp-caption-window-container",
          acceptOrigin: DREAMING_ORIGIN,
        }),
      ];
    }

    return [];
  }

  // Each feature updates independently: a failure in one is logged and must
  // not stop the others from receiving settings.
  function updateFeatures(features, settings) {
    return Promise.all(features.map(async (feature) => {
      try {
        await feature.update(settings);
      } catch (error) {
        console.error(`Dreaming Tools ${feature.name} feature failed to update.`, error);
      }
    }));
  }

  // Keep the raw stored values, not the normalized ones: normalization fills
  // in every key, which would make a never-stored difficultyEnabled look
  // explicitly saved and block the legacy "original" migration.
  function applyStorageChanges(stored, changes) {
    const next = { ...stored };
    for (const [key, change] of Object.entries(changes)) {
      if (change.newValue === undefined) {
        delete next[key];
      } else {
        next[key] = change.newValue;
      }
    }
    return next;
  }

  function withFeaturesOff(settings) {
    return { ...settings, ...Object.fromEntries(FEATURE_SWITCHES.map((key) => [key, false])) };
  }

  async function initialize(features = selectFeatures(location)) {
    if (features.length === 0) {
      return;
    }

    // Announce before listening, so this copy does not stop itself. The old
    // copy's features stop synchronously inside this dispatch, before this
    // copy reads settings and starts its own.
    document.dispatchEvent(new Event(REPLACED_EVENT));
    let replaced = false;
    let stored = {};
    document.addEventListener(REPLACED_EVENT, () => {
      replaced = true;
      updateFeatures(features, withFeaturesOff(normalizeSettings(stored)));
    }, { once: true });

    stored = await chrome.storage.sync.get(SETTING_KEYS);
    if (replaced) {
      return;
    }

    // Register before the first update so changes made while a feature is
    // still starting (for example, downloading the catalog) are not lost.
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (replaced || areaName !== "sync") {
        return;
      }

      stored = applyStorageChanges(stored, changes);
      updateFeatures(features, normalizeSettings(stored));
    });

    await updateFeatures(features, normalizeSettings(stored));
  }

  globalThis.DreamingToolsContent = { initialize, selectFeatures };

  if (globalThis.chrome?.runtime?.id && typeof document !== "undefined") {
    initialize();
  }
})();
