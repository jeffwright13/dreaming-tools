// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/settings.js";
import "../src/difficulty-core.js";
import "../src/difficulty.js";
import "../src/content.js";

const { DEFAULT_SETTINGS, SETTING_KEYS } = globalThis.DreamingToolsSettings;
const { initialize } = globalThis.DreamingToolsContent;

function stubChromeStorage(stored = {}) {
  const listeners = [];
  const get = vi.fn().mockResolvedValue(stored);
  vi.stubGlobal("chrome", {
    storage: {
      sync: { get },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
  });
  return { get, listeners };
}

function fakeFeature(name = "fake") {
  return { name, update: vi.fn().mockResolvedValue(undefined) };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("initialize", () => {
  it("reads only stored keys and gives every feature the normalized settings", async () => {
    const { get } = stubChromeStorage({ size: "large", style: "bogus" });
    const features = [fakeFeature(), fakeFeature()];

    await initialize(features);

    expect(get).toHaveBeenCalledWith(SETTING_KEYS);
    for (const feature of features) {
      expect(feature.update).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, size: "large" });
    }
  });

  it("passes merged synchronized changes to every feature and ignores other storage areas", async () => {
    const { listeners } = stubChromeStorage();
    const features = [fakeFeature(), fakeFeature()];
    await initialize(features);

    listeners[0]({ size: { newValue: "large" } }, "local");
    expect(features[0].update).toHaveBeenCalledTimes(1);

    listeners[0]({ size: { newValue: "large" } }, "sync");
    listeners[0]({ difficultyEnabled: { newValue: false } }, "sync");
    for (const feature of features) {
      expect(feature.update).toHaveBeenLastCalledWith({
        ...DEFAULT_SETTINGS,
        size: "large",
        difficultyEnabled: false,
      });
    }
  });

  it("keeps other features running when one fails", async () => {
    stubChromeStorage();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwing = { name: "throwing", update: vi.fn(() => { throw new Error("sync failure"); }) };
    const rejecting = { name: "rejecting", update: vi.fn().mockRejectedValue(new Error("async failure")) };
    const healthy = fakeFeature();

    await initialize([throwing, rejecting, healthy]);

    expect(healthy.update).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith("Dreaming Tools throwing feature failed to update.", expect.any(Error));
    expect(consoleError).toHaveBeenCalledWith("Dreaming Tools rejecting feature failed to update.", expect.any(Error));
  });

  it("migrates a legacy Original Dreaming value that arrives as a change event", async () => {
    const { listeners } = stubChromeStorage({});
    const feature = fakeFeature();
    await initialize([feature]);

    listeners[0]({ behavior: { newValue: "original" } }, "sync");

    expect(feature.update).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, difficultyEnabled: false });
  });

  it("returns a removed setting to its default", async () => {
    const { listeners } = stubChromeStorage({ size: "large" });
    const feature = fakeFeature();
    await initialize([feature]);

    listeners[0]({ size: { oldValue: "large" } }, "sync");

    expect(feature.update).toHaveBeenLastCalledWith(DEFAULT_SETTINGS);
  });

  it("applies settings changes made while the first update is still running", async () => {
    const { listeners } = stubChromeStorage();
    const feature = fakeFeature();
    feature.update.mockReturnValueOnce(new Promise(() => {}));

    initialize([feature]);
    await vi.waitFor(() => expect(feature.update).toHaveBeenCalledTimes(1));
    listeners[0]({ size: { newValue: "large" } }, "sync");

    expect(feature.update).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, size: "large" });
  });

  it("wires the difficulty feature by default", async () => {
    window.history.replaceState({}, "", "/spanish/library");
    document.body.innerHTML = '<div data-video-id="abc"><div class="ds-video-thumbnail"></div></div>';
    stubChromeStorage({ difficultyEnabled: false });
    vi.stubGlobal("fetch", vi.fn());

    await initialize();

    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
  });
});
