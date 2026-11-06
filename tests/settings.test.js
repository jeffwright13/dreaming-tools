import { describe, expect, it } from "vitest";
import "../src/settings.js";

const { DEFAULT_SETTINGS, SETTING_KEYS, normalizeSettings } = globalThis.DreamingToolsSettings;

describe("settings", () => {
  it("supplies conservative defaults for a fresh installation", () => {
    expect(normalizeSettings({})).toEqual({
      difficultyEnabled: true,
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
    })).toEqual({
      difficultyEnabled: true,
      behavior: "fill-missing",
      style: "dreaming",
      size: "large",
      position: "upper-right",
      subtitlesEnabled: false,
      subtitleStyle: "blur",
      revealMode: "hold",
      revealKey: "KeyS",
      revealAutoHide: 5,
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
      revealAutoHide: 0,
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
      revealAutoHide: 0,
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

describe("legacy Original Dreaming behavior", () => {
  it("migrates to a disabled difficulty feature", () => {
    expect(normalizeSettings({ behavior: "original", size: "large" })).toEqual({
      ...DEFAULT_SETTINGS,
      difficultyEnabled: false,
      size: "large",
    });
  });

  it("yields to an explicitly stored enable switch", () => {
    expect(normalizeSettings({ behavior: "original", difficultyEnabled: true })).toEqual(DEFAULT_SETTINGS);
  });
});
