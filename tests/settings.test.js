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
    })).toEqual({
      difficultyEnabled: true,
      behavior: "fill-missing",
      style: "dreaming",
      size: "large",
      position: "upper-right",
    });
  });

  it("preserves valid enhanced settings already stored by a user", () => {
    expect(normalizeSettings({
      difficultyEnabled: false,
      behavior: "enhanced-everywhere",
      style: "enhanced",
      size: "medium",
      position: "upper-left",
    })).toEqual({
      difficultyEnabled: false,
      behavior: "enhanced-everywhere",
      style: "enhanced",
      size: "medium",
      position: "upper-left",
    });
  });

  it("lists every stored key so reads return only what the user saved", () => {
    expect(SETTING_KEYS).toEqual(Object.keys(DEFAULT_SETTINGS));
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
    expect(normalizeSettings({ behavior: "original", difficultyEnabled: true })).toEqual(DEFAULT_SETTINGS);
  });
});
