// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/settings.js";
import "../src/subtitles-core.js";
import "../src/subtitles.js";

const { DEFAULT_SETTINGS } = globalThis.DreamingToolsSettings;
const { createSubtitlesFeature } = globalThis.DreamingSubtitlesFeature;

const ENABLED = { ...DEFAULT_SETTINGS, subtitlesEnabled: true };
const SUBTITLES_ON = `
  <div class="ds-shaka-player">
    <video></video>
    <div class="shaka-text-container"><div><span>Vamos a poner el litro de agua en la olla.</span></div></div>
  </div>
`;

const root = () => document.documentElement;
const revealed = () => root().classList.contains("dt-subtitles--revealed");

function press(type, init = {}, target = document.body) {
  const event = new KeyboardEvent(type, { code: "KeyS", bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

let feature;

beforeEach(() => {
  document.body.innerHTML = SUBTITLES_ON;
  feature = createSubtitlesFeature();
});

afterEach(async () => {
  await feature.update({ ...DEFAULT_SETTINGS, subtitlesEnabled: false });
  vi.useRealTimers();
});

describe("subtitles feature", () => {
  it("identifies itself for error reports", () => {
    expect(feature.name).toBe("subtitles");
  });

  it("is off by default and leaves the page and keys alone", async () => {
    await feature.update(DEFAULT_SETTINGS);

    expect([...root().classList].filter((name) => name.startsWith("dt-subtitles"))).toEqual([]);
    expect(press("keydown").defaultPrevented).toBe(false);
  });

  it("marks the page with the configured style and updates it on change", async () => {
    await feature.update(ENABLED);
    expect(root().classList.contains("dt-subtitles")).toBe(true);
    expect(root().classList.contains("dt-subtitles--style-blur")).toBe(true);

    await feature.update({ ...ENABLED, subtitleStyle: "hidden" });
    expect(root().classList.contains("dt-subtitles--style-blur")).toBe(false);
    expect(root().classList.contains("dt-subtitles--style-hidden")).toBe(true);
  });

  it("reveals while the key is held and keeps the key from reaching the player", async () => {
    await feature.update(ENABLED);
    const playerListener = vi.fn();
    document.body.addEventListener("keydown", playerListener);

    expect(press("keydown").defaultPrevented).toBe(true);
    expect(revealed()).toBe(true);
    expect(playerListener).not.toHaveBeenCalled();

    expect(press("keyup").defaultPrevented).toBe(true);
    expect(revealed()).toBe(false);
  });

  it("ignores the key when the player's subtitles are off", async () => {
    document.body.innerHTML = '<div class="ds-shaka-player"><video></video></div>';
    await feature.update(ENABLED);

    expect(press("keydown").defaultPrevented).toBe(false);
    expect(revealed()).toBe(false);
  });

  it("ignores the key while typing and with browser shortcut modifiers", async () => {
    await feature.update(ENABLED);
    document.body.insertAdjacentHTML("beforeend", "<textarea></textarea>");

    expect(press("keydown", {}, document.querySelector("textarea")).defaultPrevented).toBe(false);
    expect(press("keydown", { metaKey: true }).defaultPrevented).toBe(false);
    expect(press("keydown", { code: "KeyD" }).defaultPrevented).toBe(false);
    expect(revealed()).toBe(false);
  });

  it("lets the key release reach a text field but still hides", async () => {
    await feature.update(ENABLED);
    press("keydown");
    document.body.insertAdjacentHTML("beforeend", "<input>");

    expect(press("keyup", {}, document.querySelector("input")).defaultPrevented).toBe(false);
    expect(revealed()).toBe(false);
  });

  it("uses the configured reveal key", async () => {
    await feature.update({ ...ENABLED, revealKey: "KeyJ" });

    expect(press("keydown").defaultPrevented).toBe(false);
    press("keydown", { code: "KeyJ" });
    expect(revealed()).toBe(true);
  });

  it("hides on release even if the player's subtitles were turned off meanwhile", async () => {
    await feature.update(ENABLED);
    press("keydown");
    document.querySelector(".shaka-text-container").remove();

    press("keyup");
    expect(revealed()).toBe(false);
  });

  it("hides when the window loses focus mid-hold", async () => {
    await feature.update(ENABLED);
    press("keydown");

    window.dispatchEvent(new Event("blur"));
    expect(revealed()).toBe(false);
  });

  describe("toggle mode", () => {
    const TOGGLE = { ...ENABLED, revealMode: "toggle" };

    it("flips on each press and ignores held-key repeats", async () => {
      await feature.update({ ...TOGGLE, revealAutoHide: 0 });

      press("keydown");
      press("keyup");
      expect(revealed()).toBe(true);
      expect(press("keydown", { repeat: true }).defaultPrevented).toBe(true);
      expect(revealed()).toBe(true);
      press("keydown");
      expect(revealed()).toBe(false);
    });

    it("auto-hides after the configured delay", async () => {
      vi.useFakeTimers();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      press("keydown");
      vi.advanceTimersByTime(4999);
      expect(revealed()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(revealed()).toBe(false);
    });

    it("cancels the auto-hide timer when toggled off early", async () => {
      vi.useFakeTimers();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      press("keydown");
      press("keydown");
      press("keydown");
      vi.advanceTimersByTime(4000);
      expect(revealed()).toBe(true);
      vi.advanceTimersByTime(1000);
      expect(revealed()).toBe(false);
    });

    it("stays revealed with auto-hide off", async () => {
      vi.useFakeTimers();
      await feature.update({ ...TOGGLE, revealAutoHide: 0 });

      press("keydown");
      vi.advanceTimersByTime(60000);
      expect(revealed()).toBe(true);
    });
  });

  it("returns to hidden when the reveal settings change", async () => {
    await feature.update({ ...ENABLED, revealMode: "toggle", revealAutoHide: 0 });
    press("keydown");

    await feature.update({ ...ENABLED, revealMode: "hold" });
    expect(revealed()).toBe(false);
  });

  it("removes its classes, listeners, and timer when disabled", async () => {
    vi.useFakeTimers();
    await feature.update({ ...ENABLED, revealMode: "toggle", revealAutoHide: 5 });
    press("keydown");

    await feature.update({ ...ENABLED, subtitlesEnabled: false });

    expect([...root().classList].filter((name) => name.startsWith("dt-subtitles"))).toEqual([]);
    expect(press("keydown").defaultPrevented).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("registers its listeners only once across repeated updates", async () => {
    const addListener = vi.spyOn(window, "addEventListener");
    await feature.update(ENABLED);
    await feature.update({ ...ENABLED, subtitleStyle: "small-faint" });

    expect(addListener.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
  });
});

describe("YouTube-served videos on the Dreaming page", () => {
  const YOUTUBE_PLAYER = '<div class="ds-youtube-player"><iframe src="about:blank"></iframe></div>';
  let frameWindow;
  let topFeature;

  beforeEach(() => {
    document.body.innerHTML = YOUTUBE_PLAYER;
    frameWindow = document.querySelector("iframe").contentWindow;
    vi.spyOn(frameWindow, "postMessage");
    topFeature = createSubtitlesFeature({
      forwardTargets: () => [...document.querySelectorAll(".ds-youtube-player iframe")].map((frame) => frame.contentWindow),
      forwardOrigin: "https://www.youtube.com",
    });
  });

  afterEach(async () => {
    await topFeature.update({ ...DEFAULT_SETTINGS, subtitlesEnabled: false });
  });

  const message = (event) => ({ source: "dreaming-tools", type: "subtitles-reveal", event });

  it("forwards the reveal key to the YouTube frame and keeps it from the page", async () => {
    await topFeature.update(ENABLED);

    expect(press("keydown").defaultPrevented).toBe(true);
    expect(press("keydown", { repeat: true }).defaultPrevented).toBe(true);
    press("keyup");
    window.dispatchEvent(new Event("blur"));

    expect(frameWindow.postMessage.mock.calls).toEqual([
      [message("press"), "https://www.youtube.com"],
      [message("release"), "https://www.youtube.com"],
      [message("blur"), "https://www.youtube.com"],
    ]);
  });

  it("does not forward while typing, for other keys, or when disabled", async () => {
    await topFeature.update(ENABLED);
    document.body.insertAdjacentHTML("beforeend", "<input>");
    press("keydown", {}, document.querySelector("input"));
    press("keydown", { code: "KeyD" });
    await topFeature.update({ ...ENABLED, subtitlesEnabled: false });
    press("keydown");

    expect(frameWindow.postMessage).not.toHaveBeenCalled();
  });
});

describe("inside the YouTube frame", () => {
  const DREAMING_ORIGIN = "https://app.dreaming.com";
  const captions = (pressed) => `
    <div class="ytp-caption-window-container"><div class="caption-window">Hola</div></div>
    <button class="ytp-subtitles-button" aria-pressed="${pressed}"></button>
  `;
  let frameFeature;

  function receive(data, origin = DREAMING_ORIGIN) {
    window.dispatchEvent(new MessageEvent("message", { data, origin }));
  }

  beforeEach(() => {
    document.body.innerHTML = captions(true);
    frameFeature = createSubtitlesFeature({
      shownSelector: '.ytp-subtitles-button[aria-pressed="true"]',
      acceptOrigin: DREAMING_ORIGIN,
    });
  });

  afterEach(async () => {
    await frameFeature.update({ ...DEFAULT_SETTINGS, subtitlesEnabled: false });
  });

  it("handles the reveal key pressed inside the frame", async () => {
    await frameFeature.update(ENABLED);

    expect(press("keydown").defaultPrevented).toBe(true);
    expect(revealed()).toBe(true);
  });

  it("applies reveal events forwarded from the Dreaming page", async () => {
    await frameFeature.update(ENABLED);

    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" });
    expect(revealed()).toBe(true);
    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "release" });
    expect(revealed()).toBe(false);
  });

  it("ignores messages from other origins, other senders, and unknown events", async () => {
    await frameFeature.update(ENABLED);

    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" }, "https://example.com");
    receive({ source: "someone-else", type: "subtitles-reveal", event: "press" });
    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "explode" });
    receive("press");

    expect(revealed()).toBe(false);
  });

  it("ignores the key and forwarded presses while YouTube's CC is off", async () => {
    document.body.innerHTML = captions(false);
    await frameFeature.update(ENABLED);

    expect(press("keydown").defaultPrevented).toBe(false);
    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" });
    expect(revealed()).toBe(false);
  });

  it("stops listening for messages when disabled", async () => {
    await frameFeature.update(ENABLED);
    await frameFeature.update({ ...ENABLED, subtitlesEnabled: false });

    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" });
    expect(revealed()).toBe(false);
  });
});

