import { describe, expect, it } from "vitest";
import "../src/settings.js";

const {
  DEFAULT_SETTINGS, LEGACY_REVEAL_KEYS, SETTING_KEYS, STORED_KEYS, normalizeSettings, revealAfterTapFromLegacy,
} = globalThis.DreamingToolsSettings;

describe("settings", () => {
  it("supplies conservative defaults for a fresh installation", () => {
    expect(normalizeSettings({})).toEqual({
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
  });

  it("treats missing stored settings as a fresh installation", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("replaces invalid and unsupported values with defaults", () => {
    expect(normalizeSettings({
      difficultyEnabled: "yes",
      behavior: "invalid",
      style: "invalid",
      size: "large",
      position: "lower-right",
      subtitlesEnabled: "on",
      subtitleStyle: "invisible",
      revealKey: "Space",
      revealAfterTap: 7,
      revealJumpBack: 4,
    })).toEqual({
      difficultyEnabled: false,
      behavior: "fill-missing",
      style: "dreaming",
      size: "large",
      position: "upper-right",
      subtitlesEnabled: false,
      subtitleStyle: "blur",
      revealKey: "KeyS",
      revealAfterTap: "hide",
      revealJumpBack: 0,
    });
  });

  it("preserves valid enhanced settings already stored by a user", () => {
    expect(normalizeSettings({
      difficultyEnabled: false,
      behavior: "enhanced-everywhere",
      style: "enhanced",
      size: "medium",
      position: "upper-left",
      subtitlesEnabled: true,
      subtitleStyle: "small-faint",
      revealKey: "KeyJ",
      revealAfterTap: "caught-up",
      revealJumpBack: 3,
    })).toEqual({
      difficultyEnabled: false,
      behavior: "enhanced-everywhere",
      style: "enhanced",
      size: "medium",
      position: "upper-left",
      subtitlesEnabled: true,
      subtitleStyle: "small-faint",
      revealKey: "KeyJ",
      revealAfterTap: "caught-up",
      revealJumpBack: 3,
    });
  });

  it("lists every setting key so reads return only what the user saved", () => {
    expect(SETTING_KEYS).toEqual(Object.keys(DEFAULT_SETTINGS));
  });

  // Storage is read with the old reveal keys too, so their values can be
  // migrated; normalizing never returns them.
  it("reads the old reveal keys from storage but never returns them", () => {
    expect(STORED_KEYS).toEqual([...SETTING_KEYS, ...LEGACY_REVEAL_KEYS]);
    expect(LEGACY_REVEAL_KEYS).toEqual(["revealMode", "revealAutoHide"]);
    expect(Object.keys(normalizeSettings({ revealMode: "toggle", revealAutoHide: 3 }))).toEqual(SETTING_KEYS);
  });
});

describe("reveal key validation", () => {
  it.each(["KeyS", "KeyA", "Digit7", "Backquote", "Slash", "BracketRight"])("accepts %s", (revealKey) => {
    expect(normalizeSettings({ revealKey }).revealKey).toBe(revealKey);
  });

  it.each(["Space", "ArrowLeft", "Enter", "Escape", "Tab", "F1", "ShiftLeft", "Keys", 5, null])(
    "rejects %s, which the player or browser needs",
    (revealKey) => {
      expect(normalizeSettings({ revealKey }).revealKey).toBe("KeyS");
    },
  );
});

describe("jump back and after-a-tap values", () => {
  it.each([0, 1, 2, 3, 5, 10])("accepts a jump back of %s seconds", (revealJumpBack) => {
    expect(normalizeSettings({ revealJumpBack }).revealJumpBack).toBe(revealJumpBack);
  });

  it.each([0.5, 4, 11, -1, "3", null])("rejects a jump back of %s", (revealJumpBack) => {
    expect(normalizeSettings({ revealJumpBack }).revealJumpBack).toBe(0);
  });

  it.each(["hide", "caught-up", 3, 5, 10])("accepts after a tap %s", (revealAfterTap) => {
    expect(normalizeSettings({ revealAfterTap }).revealAfterTap).toBe(revealAfterTap);
  });

  it.each([0, 1, "toggle", "3", null])("rejects after a tap %s", (revealAfterTap) => {
    expect(normalizeSettings({ revealAfterTap }).revealAfterTap).toBe("hide");
  });

  // Show until caught up is kept even with jump back off; the feature treats
  // it as Hide on release then, so turning jump back on again restores it.
  it("keeps Show until caught up stored while jump back is off", () => {
    expect(normalizeSettings({ revealAfterTap: "caught-up", revealJumpBack: 0 }).revealAfterTap).toBe("caught-up");
  });
});

// 1.2.0 and earlier stored revealMode (Hold or Toggle) and revealAutoHide.
describe("migration from the Hold and Toggle settings", () => {
  it.each([
    [{ revealMode: "hold" }, "hide"],
    [{ revealMode: "hold", revealAutoHide: 3 }, "hide"],
    [{ revealMode: "toggle", revealAutoHide: 3 }, 3],
    [{ revealMode: "toggle", revealAutoHide: 5 }, 5],
    [{ revealMode: "toggle", revealAutoHide: 10 }, 10],
    // Off kept the text up until the next press: no equivalent; the longest.
    [{ revealMode: "toggle", revealAutoHide: 0 }, 10],
    // Never stored: the old default auto-hide was 5 seconds.
    [{ revealMode: "toggle" }, 5],
  ])("maps %o to after a tap %s", (stored, revealAfterTap) => {
    expect(revealAfterTapFromLegacy(stored)).toBe(revealAfterTap);
    expect(normalizeSettings(stored).revealAfterTap).toBe(revealAfterTap);
  });

  // A second device still on 1.2.0 can write revealMode back through sync.
  it("leaves a stored after-a-tap choice alone", () => {
    const stored = { revealMode: "toggle", revealAutoHide: 3, revealAfterTap: "caught-up" };
    expect(revealAfterTapFromLegacy(stored)).toBeUndefined();
    expect(normalizeSettings(stored).revealAfterTap).toBe("caught-up");
  });

  it("has nothing to migrate without an old reveal mode", () => {
    expect(revealAfterTapFromLegacy({})).toBeUndefined();
    expect(revealAfterTapFromLegacy({ revealMode: "press" })).toBeUndefined();
  });
});

describe("legacy Original Dreaming behavior", () => {
  it("migrates to a disabled difficulty feature", () => {
    expect(normalizeSettings({ behavior: "original", size: "large" })).toEqual({
      ...DEFAULT_SETTINGS,
      difficultyEnabled: false,
      size: "large",
    });
  });

  it("yields to an explicitly stored enable switch", () => {
    expect(normalizeSettings({ behavior: "original", difficultyEnabled: true })).toEqual({
      ...DEFAULT_SETTINGS,
      difficultyEnabled: true,
    });
  });
});
