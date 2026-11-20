import { describe, expect, it } from "vitest";
import "../src/settings.js";

const { DEFAULT_SETTINGS, SETTING_KEYS, normalizeSettings } = globalThis.DreamingToolsSettings;

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
      revealMode: "hold",
      revealKey: "KeyS",
      revealAutoHide: 5,
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
      revealMode: "press",
      revealKey: "Space",
      revealAutoHide: 7,
      revealJumpBack: 4,
    })).toEqual({
      difficultyEnabled: false,
      behavior: "fill-missing",
      style: "dreaming",
      size: "large",
      position: "upper-right",
      subtitlesEnabled: false,
      subtitleStyle: "blur",
      revealMode: "hold",
      revealKey: "KeyS",
      revealAutoHide: 5,
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
      revealMode: "toggle",
      revealKey: "KeyJ",
      revealAutoHide: "caught-up",
      revealJumpBack: 3,
    })).toEqual({
      difficultyEnabled: false,
      behavior: "enhanced-everywhere",
      style: "enhanced",
      size: "medium",
      position: "upper-left",
      subtitlesEnabled: true,
      subtitleStyle: "small-faint",
      revealMode: "toggle",
      revealKey: "KeyJ",
      revealAutoHide: "caught-up",
      revealJumpBack: 3,
    });
  });

  it("lists every stored key so reads return only what the user saved", () => {
    expect(SETTING_KEYS).toEqual(Object.keys(DEFAULT_SETTINGS));
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

describe("jump back and auto-hide values", () => {
  it.each([0, 1, 2, 3, 5, 10])("accepts a jump back of %s seconds", (revealJumpBack) => {
    expect(normalizeSettings({ revealJumpBack }).revealJumpBack).toBe(revealJumpBack);
  });

  it.each([0.5, 4, 11, -1, "3", null])("rejects a jump back of %s", (revealJumpBack) => {
    expect(normalizeSettings({ revealJumpBack }).revealJumpBack).toBe(0);
  });

  it.each([0, "caught-up", 3, 5, 10])("accepts auto-hide %s", (revealAutoHide) => {
    expect(normalizeSettings({ revealAutoHide }).revealAutoHide).toBe(revealAutoHide);
  });

  // "When caught up" is kept even with jump back off; the feature treats it
  // as Off then, so turning jump back on again restores it.
  it("keeps When caught up stored while jump back is off", () => {
    expect(normalizeSettings({ revealAutoHide: "caught-up", revealJumpBack: 0 }).revealAutoHide).toBe("caught-up");
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
