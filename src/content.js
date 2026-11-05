(() => {
  const { SETTING_KEYS, normalizeSettings } = globalThis.DreamingToolsSettings;

  function createDefaultFeatures() {
    return [
      globalThis.DreamingDifficultyFeature.createDifficultyFeature(location.pathname),
    ];
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

  async function initialize(features = createDefaultFeatures()) {
    let stored = await chrome.storage.sync.get(SETTING_KEYS);

    // Register before the first update so changes made while a feature is
    // still starting (for example, downloading the catalog) are not lost.
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      stored = applyStorageChanges(stored, changes);
      updateFeatures(features, normalizeSettings(stored));
    });

    await updateFeatures(features, normalizeSettings(stored));
  }

  globalThis.DreamingToolsContent = { initialize };

  if (globalThis.chrome?.runtime?.id && typeof document !== "undefined") {
    initialize();
  }
})();
