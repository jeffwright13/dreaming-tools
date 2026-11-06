// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/settings.js";
import "../src/difficulty-core.js";
import "../src/difficulty.js";
import "../src/subtitles-core.js";
import "../src/subtitles.js";
import "../src/content.js";

const { DEFAULT_SETTINGS, SETTING_KEYS } = globalThis.DreamingToolsSettings;
const { initialize, selectFeatures } = globalThis.DreamingToolsContent;

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

// The parts of window.location that selectFeatures reads.
function place(href, ancestorOrigins = []) {
  const { hostname, pathname } = new URL(href);
  return { hostname, pathname, ancestorOrigins };
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

  it("wires the difficulty and subtitles features by default", async () => {
    window.history.replaceState({}, "", "/spanish/library");
    document.body.innerHTML = '<div data-video-id="abc"><div class="ds-video-thumbnail"></div></div>';
    const { listeners } = stubChromeStorage({ difficultyEnabled: false, subtitlesEnabled: true });
    vi.stubGlobal("fetch", vi.fn());

    await initialize(selectFeatures(place("https://app.dreaming.com/spanish/library")));

    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector(".ds-difficulty-extension-badge")).toBeNull();
    expect(document.documentElement.classList.contains("dt-subtitles")).toBe(true);

    listeners[0]({ subtitlesEnabled: { newValue: false } }, "sync");
    await vi.waitFor(() => expect(document.documentElement.classList.contains("dt-subtitles")).toBe(false));
  });
});

describe("selectFeatures", () => {
  const names = (features) => features.map((feature) => feature.name);

  it("runs every feature on Dreaming pages", () => {
    expect(names(selectFeatures(place("https://app.dreaming.com/spanish/watch")))).toEqual(["difficulty", "subtitles"]);
  });

  it("runs only subtitles inside a YouTube embed on a Dreaming page", () => {
    const youtube = place("https://www.youtube.com/embed/abc", ["https://app.dreaming.com"]);
    expect(names(selectFeatures(youtube))).toEqual(["subtitles"]);
  });

  it.each([
    ["embedded on another site", ["https://example.com"]],
    ["opened directly", []],
    ["nested inside another site's frame on Dreaming", ["https://example.com", "https://app.dreaming.com"]],
  ])("runs nothing in a YouTube embed %s", (_, ancestors) => {
    expect(selectFeatures(place("https://www.youtube.com/embed/abc", ancestors))).toEqual([]);
  });

  it("does not read settings or listen for changes when no feature applies", async () => {
    const { get, listeners } = stubChromeStorage();

    await initialize([]);

    expect(get).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(0);
  });
});

