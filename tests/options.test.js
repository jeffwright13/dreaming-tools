// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// The shipped page, for tests of its structure. The other tests use the
// trimmed optionsMarkup above, which would not catch a reshuffled layout.
// A plain path rather than new URL(...): under jsdom the global URL is jsdom's,
// which readFileSync does not accept.
const OPTIONS_HTML_PATH = join(dirname(fileURLToPath(import.meta.url)), "../src/options.html");
const realOptionsMarkup = new DOMParser()
  .parseFromString(readFileSync(OPTIONS_HTML_PATH, "utf8"), "text/html")
  .body.innerHTML;

// Each test imports a fresh options.js, but listeners it adds to document
// and window outlive the test, still holding that copy's settings. A real
// options page has only one copy, so remove the previous copy's listeners
// before loading the next.
let pageListenerSpies = [];

function removePreviousPageListeners() {
  for (const { target, spy } of pageListenerSpies) {
    for (const args of spy.mock.calls) {
      target.removeEventListener(...args);
    }
    spy.mockRestore();
  }
  pageListenerSpies = [document, window].map((target) => ({ target, spy: vi.spyOn(target, "addEventListener") }));
}

async function loadOptions(stored = {}, markup = optionsMarkup) {
  removePreviousPageListeners();
  const storage = {
    get: vi.fn().mockResolvedValue(stored),
    set: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal("chrome", { storage: { sync: storage } });
  // Scripts in the real page's markup are inert under innerHTML; options.js
  // is imported explicitly below.
  document.body.innerHTML = markup;
  vi.resetModules();
  await import("../src/options.js");
  await vi.waitFor(() => {
    expect(document.querySelector('input[name="behavior"]:checked')).not.toBeNull();
  });
  return storage;
}

function change(selector, update = () => {}) {
  const control = document.querySelector(selector);
  update(control);
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

async function lastSaved(storage) {
  await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
  return storage.set.mock.lastCall[0];
}

beforeEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("options page", () => {
  it("loads stored settings and renders the configured preview", async () => {
    await loadOptions({
      difficultyEnabled: true,
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

  it("starts with difficulty badges off and their controls disabled", async () => {
    await loadOptions();

    expect(document.querySelector('[name="difficultyEnabled"]')?.checked).toBe(false);
    expect(document.querySelector("#behavior-controls")?.disabled).toBe(true);
    expect(document.querySelector("#appearance-controls")?.disabled).toBe(true);
    expect(document.querySelector("#preview-badge")?.hidden).toBe(true);
  });

  it("disables difficulty controls when the feature is switched off", async () => {
    await loadOptions({ difficultyEnabled: true });
    const toggle = document.querySelector('[name="difficultyEnabled"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(document.querySelector("#behavior-controls")?.disabled).toBe(true);
    expect(document.querySelector("#appearance-controls")?.disabled).toBe(true);
    expect(document.querySelector("#preview-badge")?.hidden).toBe(true);
    expect(document.querySelector("#preview-disabled")?.hidden).toBe(false);
  });

  it("saves a switched-off feature as disabled", async () => {
    const storage = await loadOptions({ difficultyEnabled: true });
    change('[name="difficultyEnabled"]', (control) => { control.checked = false; });

    expect((await lastSaved(storage)).difficultyEnabled).toBe(false);
  });

  it("does not save when the page only loads settings", async () => {
    const storage = await loadOptions({ difficultyEnabled: true, size: "large" });

    expect(storage.set).not.toHaveBeenCalled();
  });

  it("saves normalized form settings as soon as a control changes", async () => {
    const storage = await loadOptions({ difficultyEnabled: true });
    change('[name="style"]', (control) => { control.value = "enhanced"; });

    expect(await lastSaved(storage)).toEqual({
      ...globalThis.DreamingToolsSettings.DEFAULT_SETTINGS,
      difficultyEnabled: true,
      style: "enhanced",
    });
    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toBe("Saved."));
  });

  it("reports a save that fails", async () => {
    const storage = await loadOptions({ difficultyEnabled: true });
    storage.set.mockRejectedValueOnce(new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    change('[name="size"]', (control) => { control.value = "large"; });

    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toContain("couldn't be saved"));
    expect(document.querySelector("#status")?.textContent).toContain("quota exceeded");
  });

  it("restores and persists default settings", async () => {
    const storage = await loadOptions({
      difficultyEnabled: true,
      style: "dreaming",
      size: "large",
      position: "upper-right",
    });
    document.querySelector("#reset-options").click();

    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toBe("Defaults restored."));
    expect(storage.set).toHaveBeenLastCalledWith(globalThis.DreamingToolsSettings.DEFAULT_SETTINGS);
    expect(document.querySelector('[name="difficultyEnabled"]')?.checked).toBe(false);
    expect(document.querySelector('[name="size"]')?.value).toBe("small");
    expect(document.querySelector('[name="position"]')?.value).toBe("upper-right");
  });

  it("keeps the current form and reports it when restoring defaults fails", async () => {
    const storage = await loadOptions({ difficultyEnabled: true, size: "large" });
    storage.set.mockRejectedValueOnce(new Error("sync unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    document.querySelector("#reset-options").click();

    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toContain("couldn't be saved"));
    expect(document.querySelector("#status")?.textContent).toContain("sync unavailable");
    expect(document.querySelector('[name="difficultyEnabled"]')?.checked).toBe(true);
    expect(document.querySelector('[name="size"]')?.value).toBe("large");
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
    // Any change saves the whole form, including the disabled fieldsets.
    change('[name="difficultyEnabled"]');

    expect(await lastSaved(storage)).toMatchObject({
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

  function pressKey(code, init = {}, target = document) {
    const event = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  function releaseKey(code, target = document) {
    target.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true, cancelable: true }));
  }

  const revealed = () => root().classList.contains("dt-subtitles--revealed");

  beforeEach(() => {
    root().className = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("previewing the reveal key", () => {
    it("reveals while the key is held in Hold mode and ignores repeats", async () => {
      await loadOptions({ subtitlesEnabled: true });

      expect(pressKey("KeyS").defaultPrevented).toBe(true);
      expect(revealed()).toBe(true);
      pressKey("KeyS", { repeat: true });
      expect(revealed()).toBe(true);
      releaseKey("KeyS");
      expect(revealed()).toBe(false);
    });

    it("toggles on each press in Toggle mode and auto-hides after the delay", async () => {
      await loadOptions({ subtitlesEnabled: true, revealMode: "toggle", revealAutoHide: 3 });
      vi.useFakeTimers();

      pressKey("KeyS");
      releaseKey("KeyS");
      expect(revealed()).toBe(true);
      pressKey("KeyS");
      expect(revealed()).toBe(false);

      pressKey("KeyS");
      vi.advanceTimersByTime(2999);
      expect(revealed()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(revealed()).toBe(false);
    });

    it("follows a newly chosen key", async () => {
      await loadOptions({ subtitlesEnabled: true });
      keyButton().click();
      pressKey("KeyJ", {}, keyButton());

      pressKey("KeyS");
      expect(revealed()).toBe(false);
      pressKey("KeyJ");
      expect(revealed()).toBe(true);
    });

    it("records the current key without revealing while a new key is being chosen", async () => {
      const storage = await loadOptions({ subtitlesEnabled: true });
      keyButton().click();

      pressKey("KeyS", {}, keyButton());

      expect(revealed()).toBe(false);
      expect(keyButton().textContent).toBe("S");
      expect((await lastSaved(storage)).revealKey).toBe("KeyS");
    });

    it("does nothing while subtitles are off, in a select, or with Ctrl held", async () => {
      await loadOptions();
      expect(pressKey("KeyS").defaultPrevented).toBe(false);
      expect(revealed()).toBe(false);

      await loadOptions({ subtitlesEnabled: true });
      pressKey("KeyS", {}, document.querySelector('[name="subtitleStyle"]'));
      expect(revealed()).toBe(false);
      pressKey("KeyS", { ctrlKey: true });
      expect(revealed()).toBe(false);
    });

    it("hides when the reveal mode changes or the window loses focus", async () => {
      await loadOptions({ subtitlesEnabled: true, revealMode: "toggle", revealAutoHide: 0 });

      pressKey("KeyS");
      expect(revealed()).toBe(true);
      change('[name="revealMode"]', (control) => { control.value = "hold"; });
      expect(revealed()).toBe(false);

      pressKey("KeyS");
      expect(revealed()).toBe(true);
      window.dispatchEvent(new Event("blur"));
      expect(revealed()).toBe(false);
    });

    it("makes a click on the preview toggle in Toggle mode", async () => {
      await loadOptions({ subtitlesEnabled: true, revealMode: "toggle", revealAutoHide: 0 });
      const preview = document.querySelector("#subtitle-preview");

      preview.dispatchEvent(new Event("pointerdown"));
      preview.dispatchEvent(new Event("pointerup"));
      preview.dispatchEvent(new Event("pointerleave"));
      expect(revealed()).toBe(true);
      preview.dispatchEvent(new Event("pointerdown"));
      expect(revealed()).toBe(false);
    });
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

    const saved = await lastSaved(storage);
    expect(saved).toMatchObject({ subtitlesEnabled: true, revealMode: "toggle", revealAutoHide: 10 });
  });

  it("records a new reveal key from the next key press", async () => {
    const storage = await loadOptions({ subtitlesEnabled: true });

    keyButton().click();
    expect(keyButton().textContent).toBe("Press a key…");
    expect(pressKey("KeyJ").defaultPrevented).toBe(true);
    expect(keyButton().textContent).toBe("J");

    // Capture writes a hidden input, which fires no change event; it saves directly.
    expect((await lastSaved(storage)).revealKey).toBe("KeyJ");
  });

  it("keeps the current key when capture is cancelled or the key is not allowed", async () => {
    const storage = await loadOptions({ subtitlesEnabled: true, revealKey: "KeyD" });

    keyButton().click();
    pressKey("Escape");
    expect(keyButton().textContent).toBe("D");

    keyButton().click();
    pressKey("Space");
    expect(keyButton().textContent).toBe("D");
    expect(document.querySelector("#status")?.textContent).toContain("can't be used");
    expect(document.querySelector('[name="revealKey"]')?.value).toBe("KeyD");
    expect(storage.set).not.toHaveBeenCalled();
  });
});


describe("options page layout", () => {
  const FEATURE_CONTROLS = {
    "subtitles-feature": [
      '[name="subtitlesEnabled"]',
      "#subtitle-controls",
      '[name="subtitleStyle"]',
      '[name="revealMode"]',
      '[name="revealAutoHide"]',
      "#reveal-key-button",
      // Same structure as the real player: a block line inside the container,
      // so the line-level styles (including scale) apply as they do there.
      "#subtitle-preview .shaka-text-container > div > span",
      "#youtube-subtitle-preview .ytp-caption-window-container > .caption-window",
    ],
    "difficulty-feature": [
      '[name="difficultyEnabled"]',
      "#behavior-controls",
      "#appearance-controls",
      '[name="style"]',
      '[name="size"]',
      '[name="position"]',
      "#preview-badge",
      "#preview-disabled",
    ],
  };

  beforeEach(() => {
    document.body.innerHTML = realOptionsMarkup;
  });

  it("presents Subtitles first and Difficulty badges second, one card each", () => {
    const features = [...document.querySelectorAll("#settings-form > .feature")];

    expect(features.map((section) => section.id)).toEqual(["subtitles-feature", "difficulty-feature"]);
    expect(features.map((section) => section.querySelector("h2")?.textContent)).toEqual(["Subtitles", "Difficulty badges"]);
  });

  it("says what the extension is, and that it is independent, under the heading", () => {
    const tagline = document.querySelector("h1 + .tagline");

    expect(tagline?.textContent).toContain("not affiliated with Dreaming");
    expect(tagline?.nextElementSibling?.matches(".intro")).toBe(true);
  });

  it("puts the reload note at the bottom, after both feature cards", () => {
    const note = document.querySelector(".reload-note");
    const lastFeature = document.querySelector("#difficulty-feature");

    expect(note?.textContent).toContain("reload");
    expect(lastFeature.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("labels each subtitle preview with the player it imitates", () => {
    const labels = [...document.querySelectorAll("#subtitles-feature .preview-label")].map((label) => label.textContent);

    expect(labels).toEqual(["Dreaming player", "YouTube-served videos"]);
  });

  it("has no Save button, because changes save automatically", () => {
    expect(document.querySelector('#settings-form [type="submit"]')).toBeNull();
  });

  it("keeps each feature's controls inside its own card", () => {
    for (const [featureId, selectors] of Object.entries(FEATURE_CONTROLS)) {
      const feature = document.getElementById(featureId);
      for (const selector of selectors) {
        expect(feature.querySelector(selector), `${selector} in #${featureId}`).not.toBeNull();
      }
    }
  });

  it("puts each feature's enable switch before its subsections", () => {
    for (const featureId of Object.keys(FEATURE_CONTROLS)) {
      const feature = document.getElementById(featureId);
      const enableSwitch = feature.querySelector('input[type="checkbox"]');
      const firstSubsection = feature.querySelector(".subsection");

      expect(firstSubsection, `subsection in #${featureId}`).not.toBeNull();
      expect(enableSwitch.compareDocumentPosition(firstSubsection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("works with the options script", async () => {
    document.documentElement.className = "";
    await loadOptions({ subtitlesEnabled: true, difficultyEnabled: true, size: "large" }, realOptionsMarkup);

    expect(document.querySelector("#subtitle-controls")?.disabled).toBe(false);
    expect(document.querySelector("#appearance-controls")?.disabled).toBe(false);
    expect(document.querySelector("#preview-badge")?.className).toContain("--size-large");
    expect(document.documentElement.classList.contains("dt-subtitles--style-blur")).toBe(true);
  });

  it("reveals both subtitle previews while either is pressed", async () => {
    document.documentElement.className = "";
    await loadOptions({ subtitlesEnabled: true }, realOptionsMarkup);
    const root = document.documentElement;

    for (const id of ["#subtitle-preview", "#youtube-subtitle-preview"]) {
      const preview = document.querySelector(id);
      preview.dispatchEvent(new Event("pointerdown"));
      expect(root.classList.contains("dt-subtitles--revealed"), id).toBe(true);
      preview.dispatchEvent(new Event("pointerup"));
      expect(root.classList.contains("dt-subtitles--revealed"), id).toBe(false);
    }
  });
});
