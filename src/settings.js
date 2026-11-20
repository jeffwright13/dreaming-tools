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
    revealKey: "KeyS",
    revealAfterTap: "hide",
    revealJumpBack: 0,
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
    revealKey: isRevealKeyCode,
    // What a tap (a press released within TAP_MAX_MS) does: "hide" on
    // release like a hold, keep the text up until playback is back where the
    // key was first pressed ("caught-up"), or that many seconds past it.
    revealAfterTap: oneOf("hide", "caught-up", 3, 5, 10),
    // Seconds to move the video back when a press reveals; 0 is off.
    revealJumpBack: oneOf(0, 1, 2, 3, 5, 10),
  };
  // Read storage with this key list rather than with DEFAULT_SETTINGS: passing
  // defaults would make a never-stored difficultyEnabled look explicitly saved,
  // which the legacy behavior: "original" migration treats as overriding it.
  const SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
  // Hold and Toggle, stored by 1.2.0 and earlier, became After a tap. They are
  // read so they can be migrated, and removed from storage after an update.
  const LEGACY_REVEAL_KEYS = Object.freeze(["revealMode", "revealAutoHide"]);
  const STORED_KEYS = Object.freeze([...SETTING_KEYS, ...LEGACY_REVEAL_KEYS]);
  const LEGACY_ORIGINAL_BEHAVIOR = "original";
  const LEGACY_TIMED_AUTO_HIDES = new Set([3, 5, 10]);
  // Toggle with auto-hide Off kept the text up until the next press, which
  // has no equivalent; the longest timed choice is the closest.
  const LONGEST_AFTER_TAP = 10;
  const LEGACY_DEFAULT_AUTO_HIDE = 5;

  // The After a tap choice for settings stored by 1.2.0 and earlier, or
  // undefined when there is nothing to migrate: no old reveal mode, or an
  // After a tap choice is already stored (a device still on 1.2.0 can write
  // the old keys back through sync storage).
  function revealAfterTapFromLegacy({ revealMode, revealAutoHide = LEGACY_DEFAULT_AUTO_HIDE, revealAfterTap }) {
    if (revealAfterTap !== undefined) {
      return undefined;
    }
    if (revealMode === "hold") {
      return "hide";
    }
    if (revealMode === "toggle") {
      return LEGACY_TIMED_AUTO_HIDES.has(revealAutoHide) ? revealAutoHide : LONGEST_AFTER_TAP;
    }
    return undefined;
  }

  function migrateLegacyReveal(settings) {
    const revealAfterTap = revealAfterTapFromLegacy(settings);
    return revealAfterTap === undefined ? settings : { ...settings, revealAfterTap };
  }

  function migrateLegacySettings(stored) {
    const settings = migrateLegacyReveal(stored);
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
    LEGACY_REVEAL_KEYS,
    SETTING_KEYS,
    STORED_KEYS,
    isRevealKeyCode,
    normalizeSettings,
    revealAfterTapFromLegacy,
  };
})();
