// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import "../src/settings.js";
import "../src/subtitles-core.js";

const optionsMarkup = `
  <form id="settings-form">
    <input type="checkbox" name="difficultyEnabled">
    <fieldset id="behavior-controls">
      <input type="radio" name="behavior" value="enhanced-everywhere">
      <input type="radio" name="behavior" value="fill-missing">
    </fieldset>
    <fieldset id="appearance-controls">
      <select name="style"><option value="enhanced">Enhanced</option><option value="dreaming">Dreaming</option></select>
      <select name="size"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select>
      <select name="position"><option value="lower-left">Lower left</option><option value="upper-right">Upper right</option></select>
    </fieldset>
    <span id="preview-badge">42</span>
    <span id="preview-disabled"></span>
    <input type="checkbox" name="subtitlesEnabled">
    <fieldset id="subtitle-controls">
      <select name="subtitleStyle"><option value="blur">Blur</option><option value="small-faint">Small and faint</option><option value="hidden">Hidden</option></select>
      <select name="revealMode"><option value="hold">Hold</option><option value="toggle">Toggle</option></select>
      <label id="auto-hide-control"><select name="revealAutoHide"><option value="0">Off</option><option value="3">3</option><option value="5">5</option><option value="10">10</option></select></label>
      <button id="reveal-key-button" type="button"></button>
      <input type="hidden" name="revealKey">
    </fieldset>
    <div id="subtitle-preview"><div class="shaka-text-container"><span>Hola</span></div></div>
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
    expect(document.querySelector('[name="difficultyEnabled"]')?.checked).toBe(true);
    expect(document.querySelector("#appearance-controls")?.disabled).toBe(false);
  });

  it("reads only stored keys so legacy settings can migrate", async () => {
    const storage = await loadOptions({ behavior: "original" });

    expect(storage.get).toHaveBeenCalledWith(globalThis.DreamingToolsSettings.SETTING_KEYS);
    expect(document.querySelector('[name="difficultyEnabled"]')?.checked).toBe(false);
    expect(document.querySelector('input[name="behavior"]:checked')?.value).toBe("fill-missing");
  });

  it("disables difficulty controls when the feature is switched off", async () => {
    await loadOptions();
    const toggle = document.querySelector('[name="difficultyEnabled"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(document.querySelector("#behavior-controls")?.disabled).toBe(true);
    expect(document.querySelector("#appearance-controls")?.disabled).toBe(true);
    expect(document.querySelector("#preview-badge")?.hidden).toBe(true);
    expect(document.querySelector("#preview-disabled")?.hidden).toBe(false);
  });

  it("saves a switched-off feature as disabled", async () => {
    const storage = await loadOptions();
    document.querySelector('[name="difficultyEnabled"]').checked = false;
    document.querySelector("#settings-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    expect(storage.set.mock.lastCall[0].difficultyEnabled).toBe(false);
  });

  it("saves normalized form settings", async () => {
    const storage = await loadOptions();
    document.querySelector('[name="style"]').value = "dreaming";
    document.querySelector("#settings-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    expect(storage.set).toHaveBeenLastCalledWith({
      ...globalThis.DreamingToolsSettings.DEFAULT_SETTINGS,
      style: "dreaming",
    });
    expect(document.querySelector("#status")?.textContent).toBe("Options saved.");
  });

  it("restores and persists default settings", async () => {
    const storage = await loadOptions({
      difficultyEnabled: false,
      style: "dreaming",
      size: "large",
      position: "upper-right",
    });
    document.querySelector("#reset-options").click();

    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    expect(storage.set).toHaveBeenLastCalledWith(globalThis.DreamingToolsSettings.DEFAULT_SETTINGS);
    expect(document.querySelector('[name="difficultyEnabled"]')?.checked).toBe(true);
    expect(document.querySelector('[name="size"]')?.value).toBe("small");
    expect(document.querySelector('[name="position"]')?.value).toBe("upper-right");
    expect(document.querySelector("#status")?.textContent).toBe("Defaults restored.");
  });
});

describe("saving with a feature switched off", () => {
  it("keeps that feature's other settings instead of resetting them", async () => {
    const storage = await loadOptions({
      difficultyEnabled: false,
      behavior: "enhanced-everywhere",
      size: "large",
      subtitlesEnabled: false,
      subtitleStyle: "hidden",
      revealKey: "KeyJ",
    });
    document.querySelector("#settings-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    expect(storage.set.mock.lastCall[0]).toMatchObject({
      difficultyEnabled: false,
      behavior: "enhanced-everywhere",
      size: "large",
      subtitlesEnabled: false,
      subtitleStyle: "hidden",
      revealKey: "KeyJ",
    });
  });
});

describe("subtitle options", () => {
  const root = () => document.documentElement;
  const keyButton = () => document.querySelector("#reveal-key-button");

  function change(selector, update) {
    const control = document.querySelector(selector);
    update(control);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function pressKey(code) {
    const event = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
  }

  async function save(storage) {
    document.querySelector("#settings-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    return storage.set.mock.lastCall[0];
  }

  beforeEach(() => {
    root().className = "";
  });

  it("starts with subtitle de-emphasis off and its controls disabled", async () => {
    await loadOptions();

    expect(document.querySelector('[name="subtitlesEnabled"]')?.checked).toBe(false);
    expect(document.querySelector("#subtitle-controls")?.disabled).toBe(true);
    expect(document.querySelector('[name="subtitleStyle"]')?.value).toBe("blur");
    expect(keyButton()?.textContent).toBe("S");
    expect(root().classList.contains("dt-subtitles")).toBe(false);
  });

  it("previews the selected style once enabled", async () => {
    await loadOptions({ subtitlesEnabled: true, subtitleStyle: "small-faint" });

    expect(document.querySelector("#subtitle-controls")?.disabled).toBe(false);
    expect(root().classList.contains("dt-subtitles--style-small-faint")).toBe(true);

    change('[name="subtitleStyle"]', (control) => { control.value = "hidden"; });
    expect(root().classList.contains("dt-subtitles--style-small-faint")).toBe(false);
    expect(root().classList.contains("dt-subtitles--style-hidden")).toBe(true);
  });

  it("reveals the preview while it is pressed", async () => {
    await loadOptions({ subtitlesEnabled: true });
    const preview = document.querySelector("#subtitle-preview");

    preview.dispatchEvent(new Event("pointerdown"));
    expect(root().classList.contains("dt-subtitles--revealed")).toBe(true);
    preview.dispatchEvent(new Event("pointerup"));
    expect(root().classList.contains("dt-subtitles--revealed")).toBe(false);
  });

  it("shows auto-hide only in toggle mode and saves it as a number", async () => {
    const storage = await loadOptions({ subtitlesEnabled: true });
    expect(document.querySelector("#auto-hide-control")?.hidden).toBe(true);

    change('[name="revealMode"]', (control) => { control.value = "toggle"; });
    expect(document.querySelector("#auto-hide-control")?.hidden).toBe(false);
    change('[name="revealAutoHide"]', (control) => { control.value = "10"; });

    const saved = await save(storage);
    expect(saved).toMatchObject({ subtitlesEnabled: true, revealMode: "toggle", revealAutoHide: 10 });
  });

  it("records a new reveal key from the next key press", async () => {
    const storage = await loadOptions({ subtitlesEnabled: true });

    keyButton().click();
    expect(keyButton().textContent).toBe("Press a key…");
    expect(pressKey("KeyJ").defaultPrevented).toBe(true);
    expect(keyButton().textContent).toBe("J");

    expect((await save(storage)).revealKey).toBe("KeyJ");
  });

  it("keeps the current key when capture is cancelled or the key is not allowed", async () => {
    await loadOptions({ subtitlesEnabled: true, revealKey: "KeyD" });

    keyButton().click();
    pressKey("Escape");
    expect(keyButton().textContent).toBe("D");

    keyButton().click();
    pressKey("Space");
    expect(keyButton().textContent).toBe("D");
    expect(document.querySelector("#status")?.textContent).toContain("can't be used");
    expect(document.querySelector('[name="revealKey"]')?.value).toBe("KeyD");
  });
});

