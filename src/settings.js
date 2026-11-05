(() => {
  // Settings for every Dreaming Tools feature live in one flat object in
  // chrome.storage.sync. Keys are flat (not nested per feature) so that
  // difficulty settings saved by earlier versions keep working unchanged.
  const DEFAULT_SETTINGS = Object.freeze({
    difficultyEnabled: true,
    behavior: "fill-missing",
    style: "dreaming",
    size: "small",
    position: "upper-right",
  });
  const SETTING_VALUES = {
    difficultyEnabled: new Set([true, false]),
    behavior: new Set(["enhanced-everywhere", "fill-missing"]),
    style: new Set(["enhanced", "dreaming"]),
    size: new Set(["small", "medium", "large"]),
    position: new Set(["upper-right", "lower-left", "upper-left"]),
  };
  // Read storage with this key list rather than with DEFAULT_SETTINGS: passing
  // defaults would fill in difficultyEnabled: true and hide a legacy
  // behavior: "original" that should migrate to a disabled feature.
  const SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
  const LEGACY_ORIGINAL_BEHAVIOR = "original";

  function migrateLegacySettings(settings) {
    if (settings.behavior !== LEGACY_ORIGINAL_BEHAVIOR) {
      return settings;
    }

    const { behavior, ...rest } = settings;
    return typeof rest.difficultyEnabled === "boolean" ? rest : { ...rest, difficultyEnabled: false };
  }

  function normalizeSettings(settings = {}) {
    const migrated = migrateLegacySettings(settings ?? {});
    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, defaultValue]) => [
        key,
        SETTING_VALUES[key].has(migrated[key]) ? migrated[key] : defaultValue,
      ]),
    );
  }

  globalThis.DreamingToolsSettings = {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    normalizeSettings,
  };
})();
