(() => {
  // Settings for every Dreaming Tools feature live in one flat object in
  // chrome.storage.sync. Keys are flat (not nested per feature) so that
  // difficulty settings saved by earlier versions keep working unchanged.
  const DEFAULT_SETTINGS = Object.freeze({
    difficultyEnabled: false,
    behavior: "fill-missing",
    style: "dreaming",
    size: "small",
    position: "upper-right",
    subtitlesEnabled: false,
    subtitleStyle: "blur",
    revealMode: "hold",
    revealKey: "KeyS",
    revealAutoHide: 5,
  });
  // Reveal keys are physical key codes (KeyboardEvent.code). Only letter,
  // digit, and punctuation keys are allowed: Space, arrows, Enter, Escape,
  // Tab, function keys, and modifiers belong to the player and the browser.
  const REVEAL_KEY_PATTERN =
    /^(Key[A-Z]|Digit[0-9]|Backquote|Backslash|BracketLeft|BracketRight|Comma|Equal|Minus|Period|Quote|Semicolon|Slash)$/;

  function oneOf(...values) {
    const allowed = new Set(values);
    return (value) => allowed.has(value);
  }

  function isRevealKeyCode(value) {
    return typeof value === "string" && REVEAL_KEY_PATTERN.test(value);
  }

  const SETTING_VALIDATORS = {
    difficultyEnabled: oneOf(true, false),
    behavior: oneOf("enhanced-everywhere", "fill-missing"),
    style: oneOf("enhanced", "dreaming"),
    size: oneOf("small", "medium", "large"),
    position: oneOf("upper-right", "lower-left", "upper-left"),
    subtitlesEnabled: oneOf(true, false),
    subtitleStyle: oneOf("blur", "small-faint", "hidden"),
    revealMode: oneOf("hold", "toggle"),
    revealKey: isRevealKeyCode,
    // Seconds; 0 turns auto-hide off. Applies only in toggle mode.
    revealAutoHide: oneOf(0, 3, 5, 10),
  };
  // Read storage with this key list rather than with DEFAULT_SETTINGS: passing
  // defaults would make a never-stored difficultyEnabled look explicitly saved,
  // which the legacy behavior: "original" migration treats as overriding it.
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
        SETTING_VALIDATORS[key](migrated[key]) ? migrated[key] : defaultValue,
      ]),
    );
  }

  globalThis.DreamingToolsSettings = {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    isRevealKeyCode,
    normalizeSettings,
  };
})();
