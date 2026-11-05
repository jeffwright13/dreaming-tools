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
        console.error("Dreaming Tools feature failed to update.", error);
      }
    }));
  }

  async function initialize(features = createDefaultFeatures()) {
    let settings = normalizeSettings(await chrome.storage.sync.get(SETTING_KEYS));
    await updateFeatures(features, settings);

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      settings = normalizeSettings({
        ...settings,
        ...Object.fromEntries(
          Object.entries(changes).map(([key, change]) => [key, change.newValue]),
        ),
      });
      updateFeatures(features, settings);
    });
  }

  globalThis.DreamingToolsContent = { initialize };

  if (globalThis.chrome?.runtime?.id && typeof document !== "undefined") {
    initialize();
  }
})();
