// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import "../src/core.js";

const optionsMarkup = `
  <form id="settings-form">
    <input type="radio" name="behavior" value="enhanced-everywhere">
    <input type="radio" name="behavior" value="fill-missing">
    <input type="radio" name="behavior" value="original">
    <fieldset id="appearance-controls">
      <select name="style"><option value="enhanced">Enhanced</option><option value="dreaming">Dreaming</option></select>
      <select name="size"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select>
      <select name="position"><option value="lower-left">Lower left</option><option value="upper-right">Upper right</option></select>
    </fieldset>
    <span id="preview-badge">42</span>
    <span id="preview-original"></span>
    <button id="reset-options" type="button">Restore defaults</button>
    <output id="status"></output>
  </form>
`;

async function loadOptions(stored = {}) {
  const storage = {
    get: vi.fn().mockResolvedValue(stored),
    set: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal("chrome", { storage: { sync: storage } });
  document.body.innerHTML = optionsMarkup;
  vi.resetModules();
  await import("../src/options.js");
  await vi.waitFor(() => {
    expect(document.querySelector('input[name="behavior"]:checked')).not.toBeNull();
  });
  return storage;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("options page", () => {
  it("loads stored settings and renders the configured preview", async () => {
    await loadOptions({
      behavior: "fill-missing",
      style: "dreaming",
      size: "large",
      position: "upper-right",
    });

    expect(document.querySelector('input[name="behavior"]:checked')?.value).toBe("fill-missing");
    expect(document.querySelector('[name="style"]')?.value).toBe("dreaming");
    expect(document.querySelector("#preview-badge")?.className).toContain("--size-large");
    expect(document.querySelector("#appearance-controls")?.disabled).toBe(false);
  });

  it("disables appearance controls in Original Dreaming mode", async () => {
    await loadOptions();
    const original = document.querySelector('input[value="original"]');
    original.checked = true;
    original.dispatchEvent(new Event("change", { bubbles: true }));

    expect(document.querySelector("#appearance-controls")?.disabled).toBe(true);
    expect(document.querySelector("#preview-badge")?.hidden).toBe(true);
    expect(document.querySelector("#preview-original")?.hidden).toBe(false);
  });

  it("saves normalized form settings", async () => {
    const storage = await loadOptions();
    document.querySelector('[name="style"]').value = "dreaming";
    document.querySelector("#settings-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    expect(storage.set).toHaveBeenLastCalledWith({
      behavior: "enhanced-everywhere",
      style: "dreaming",
      size: "small",
      position: "lower-left",
    });
    expect(document.querySelector("#status")?.textContent).toBe("Options saved.");
  });

  it("restores and persists default settings", async () => {
    const storage = await loadOptions({
      behavior: "original",
      style: "dreaming",
      size: "large",
      position: "upper-right",
    });
    document.querySelector("#reset-options").click();

    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    expect(storage.set).toHaveBeenLastCalledWith(globalThis.DreamingDifficultyCore.DEFAULT_SETTINGS);
    expect(document.querySelector('[name="size"]')?.value).toBe("small");
    expect(document.querySelector('[name="position"]')?.value).toBe("lower-left");
    expect(document.querySelector("#status")?.textContent).toBe("Defaults restored.");
  });
});
