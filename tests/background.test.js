import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const [DREAMING_SCRIPT] = MANIFEST.content_scripts;

let onInstalled;
let chromeStub;

// background.js registers its listener when it loads, as a service worker
// must, so each test stubs chrome first and then imports a fresh copy.
async function loadBackground({ tabs = [] } = {}) {
  onInstalled = undefined;
  chromeStub = {
    runtime: {
      getManifest: vi.fn(() => MANIFEST),
      onInstalled: { addListener: vi.fn((listener) => { onInstalled = listener; }) },
      openOptionsPage: vi.fn().mockResolvedValue(undefined),
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
      insertCSS: vi.fn().mockResolvedValue(undefined),
    },
    tabs: { query: vi.fn().mockResolvedValue(tabs) },
  };
  vi.stubGlobal("chrome", chromeStub);
  vi.resetModules();
  await import("../src/background.js");
}

beforeEach(() => loadBackground());

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("background service worker", () => {
  it("registers its install listener when it loads", () => {
    expect(onInstalled).toBeTypeOf("function");
  });

  it("opens the options page on first install, since every tool starts off", async () => {
    await onInstalled({ reason: "install" });

    expect(chromeStub.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
  });

  it.each(["update", "chrome_update", "shared_module_update"])("does not open the options page on %s", async (reason) => {
    await onInstalled({ reason, previousVersion: "0.7.1" });

    expect(chromeStub.runtime.openOptionsPage).not.toHaveBeenCalled();
  });

  it("logs rather than throws when the options page cannot be opened", async () => {
    const error = new Error("Could not create an options page.");
    chromeStub.runtime.openOptionsPage.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(onInstalled({ reason: "install" })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Dreaming Tools could not open its options page.", error);
  });
});

describe("refreshing open Dreaming tabs", () => {
  it.each(["install", "update"])("injects the current Dreaming content script into open tabs on %s", async (reason) => {
    await loadBackground({ tabs: [{ id: 11 }, { id: 12 }] });

    await onInstalled({ reason });

    expect(chromeStub.tabs.query).toHaveBeenCalledWith({ url: DREAMING_SCRIPT.matches, discarded: false });
    for (const tabId of [11, 12]) {
      expect(chromeStub.scripting.insertCSS).toHaveBeenCalledWith({ target: { tabId }, files: DREAMING_SCRIPT.css });
      expect(chromeStub.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId }, files: DREAMING_SCRIPT.js });
    }
  });

  it("injects only the extension's own packaged files, never code", async () => {
    await loadBackground({ tabs: [{ id: 11 }] });

    await onInstalled({ reason: "update" });

    expect(chromeStub.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(chromeStub.scripting.insertCSS).toHaveBeenCalledTimes(1);
    for (const [injection] of [
      ...chromeStub.scripting.executeScript.mock.calls,
      ...chromeStub.scripting.insertCSS.mock.calls,
    ]) {
      expect(Object.keys(injection).sort()).toEqual(["files", "target"]);
    }
  });

  it("does not touch tabs when Chrome itself updates", async () => {
    await loadBackground({ tabs: [{ id: 11 }] });

    await onInstalled({ reason: "chrome_update" });

    expect(chromeStub.tabs.query).not.toHaveBeenCalled();
    expect(chromeStub.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("keeps refreshing other tabs when one cannot be injected", async () => {
    await loadBackground({ tabs: [{ id: 11 }, { id: 12 }] });
    const error = new Error("Cannot access contents of the page.");
    chromeStub.scripting.insertCSS.mockImplementation(({ target }) => (
      target.tabId === 11 ? Promise.reject(error) : Promise.resolve()
    ));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(onInstalled({ reason: "update" })).resolves.toBeUndefined();

    expect(chromeStub.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 12 }, files: DREAMING_SCRIPT.js });
    expect(chromeStub.scripting.executeScript).not.toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 11 } }));
    expect(consoleWarn).toHaveBeenCalledWith("Dreaming Tools could not refresh tab 11.", error);
  });

  it("logs rather than throws when open tabs cannot be listed", async () => {
    const error = new Error("tabs unavailable");
    chromeStub.tabs.query.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(onInstalled({ reason: "update" })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Dreaming Tools could not refresh open Dreaming tabs.", error);
  });
});
