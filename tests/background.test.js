import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let onInstalled;
let openOptionsPage;

// background.js registers its listener when it loads, as a service worker
// must, so each test stubs chrome first and then imports a fresh copy.
async function loadBackground() {
  onInstalled = undefined;
  openOptionsPage = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("chrome", {
    runtime: {
      onInstalled: { addListener: vi.fn((listener) => { onInstalled = listener; }) },
      openOptionsPage,
    },
  });
  vi.resetModules();
  await import("../src/background.js");
}

beforeEach(loadBackground);

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

    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });

  it.each(["update", "chrome_update", "shared_module_update"])("does not open the options page on %s", async (reason) => {
    await onInstalled({ reason, previousVersion: "0.7.1" });

    expect(openOptionsPage).not.toHaveBeenCalled();
  });

  it("logs rather than throws when the options page cannot be opened", async () => {
    const error = new Error("Could not create an options page.");
    openOptionsPage.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(onInstalled({ reason: "install" })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith("Dreaming Tools could not open its options page.", error);
  });
});
