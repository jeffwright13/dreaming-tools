import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The worker loads settings.js itself (importScripts in Chrome, the manifest's
// background scripts in Firefox); here it is loaded once for every test.
import "../src/settings.js";

const MANIFEST = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const [DREAMING_SCRIPT] = MANIFEST.content_scripts;

let onInstalled;
let chromeStub;

// background.js registers its listener when it loads, as a service worker
// must, so each test stubs chrome first and then imports a fresh copy.
async function loadBackground({ tabs = [], stored = {} } = {}) {
  onInstalled = undefined;
  const storage = { ...stored };
  chromeStub = {
    storage: {
      sync: {
        data: storage,
        get: vi.fn(async (keys) => Object.fromEntries(keys.filter((key) => key in storage).map((key) => [key, storage[key]]))),
        set: vi.fn(async (values) => { Object.assign(storage, values); }),
        remove: vi.fn(async (keys) => { for (const key of keys) delete storage[key]; }),
      },
    },
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

describe("loading settings.js", () => {
  it("lists settings.js before background.js for Firefox's background scripts", () => {
    expect(MANIFEST.background.scripts).toEqual(["src/settings.js", "src/background.js"]);
  });

  it("imports settings.js in a service worker, where importScripts exists", async () => {
    const importScripts = vi.fn();
    vi.stubGlobal("importScripts", importScripts);
    vi.resetModules();
    await import("../src/background.js");
    expect(importScripts).toHaveBeenCalledWith("settings.js");
  });
});

// 1.2.0 and earlier stored revealMode and revealAutoHide; see SPEC.
describe("migrating the Hold and Toggle settings after an update", () => {
  it("writes the mapped after-release choice, then removes the old keys", async () => {
    await loadBackground({ stored: { revealMode: "toggle", revealAutoHide: 3, revealKey: "KeyJ" } });
    await onInstalled({ reason: "update", previousVersion: "1.2.0" });

    const { set, remove, data } = chromeStub.storage.sync;
    expect(set).toHaveBeenCalledWith({ revealAfterRelease: 3 });
    expect(remove).toHaveBeenCalledWith(["revealMode", "revealAutoHide"]);
    expect(set.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
    expect(data).toEqual({ revealAfterRelease: 3, revealKey: "KeyJ" });
  });

  it("keeps a stored after-release choice and only removes old keys a 1.2.0 device wrote back", async () => {
    await loadBackground({ stored: { revealMode: "toggle", revealAfterRelease: "caught-up" } });
    await onInstalled({ reason: "update", previousVersion: "1.3.0" });

    expect(chromeStub.storage.sync.set).not.toHaveBeenCalled();
    expect(chromeStub.storage.sync.data).toEqual({ revealAfterRelease: "caught-up" });
  });

  it("does nothing without old keys", async () => {
    await loadBackground({ stored: { revealAfterRelease: 5 } });
    await onInstalled({ reason: "update", previousVersion: "1.3.0" });

    expect(chromeStub.storage.sync.set).not.toHaveBeenCalled();
    expect(chromeStub.storage.sync.remove).not.toHaveBeenCalled();
  });

  it("does not migrate on a fresh install or a browser update", async () => {
    await loadBackground({ stored: { revealMode: "toggle" } });
    await onInstalled({ reason: "chrome_update" });
    expect(chromeStub.storage.sync.set).not.toHaveBeenCalled();
  });

  it("logs rather than throws when storage fails", async () => {
    await loadBackground({ stored: { revealMode: "hold" } });
    const error = new Error("storage unavailable");
    chromeStub.storage.sync.get.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(onInstalled({ reason: "update" })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Dreaming Tools could not migrate its reveal settings.", error);
  });
});
