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

// jsdom's video never plays, so give it a controllable clock. advance()
// moves playback forward and fires timeupdate, as a playing video would.
function fakeVideo(video = document.querySelector("video"), { time = 40, readyState = 4, seeking = false } = {}) {
  let currentTime = time;
  const state = { readyState, seeking };
  Object.defineProperty(video, "currentTime", { configurable: true, get: () => currentTime, set: (value) => { currentTime = value; } });
  Object.defineProperty(video, "readyState", { configurable: true, get: () => state.readyState });
  Object.defineProperty(video, "seeking", { configurable: true, get: () => state.seeking });
  return {
    get time() { return currentTime; },
    state,
    advance(to) {
      currentTime = to;
      video.dispatchEvent(new Event("timeupdate"));
    },
    seekTo(to) {
      currentTime = to;
      video.dispatchEvent(new Event("seeked"));
    },
    fire(type) {
      video.dispatchEvent(new Event(type));
    },
  };
}

// A quick press and release of the reveal key.
function tap() {
  press("keydown");
  press("keyup");
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

    it("hides on a press after the player's subtitles were turned off while revealed", async () => {
      await feature.update({ ...TOGGLE, revealAutoHide: 0 });
      press("keydown");
      press("keyup");
      expect(revealed()).toBe(true);

      document.querySelector(".shaka-text-container").remove();
      const event = press("keydown");

      expect(revealed()).toBe(false);
      // With no subtitles on screen the key still belongs to the page.
      expect(event.defaultPrevented).toBe(false);

      document.querySelector(".ds-shaka-player").insertAdjacentHTML("beforeend", '<div class="shaka-text-container"></div>');
      expect(revealed()).toBe(false);
    });

    it("flips on each press and ignores held-key repeats", async () => {
      await feature.update({ ...TOGGLE, revealAutoHide: 0 });

      press("keydown");
      expect(revealed()).toBe(true);
      expect(press("keydown", { repeat: true }).defaultPrevented).toBe(true);
      expect(revealed()).toBe(true);
      press("keyup");
      expect(revealed()).toBe(true);
      press("keydown");
      expect(revealed()).toBe(false);
    });

    it("auto-hides after the configured seconds of playback", async () => {
      const video = fakeVideo();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      press("keydown");
      video.advance(44.9);
      expect(revealed()).toBe(true);
      video.advance(45);
      expect(revealed()).toBe(false);
    });

    // A real key press ends with a release, which must not restart or drop
    // the playback-time auto-hide.
    it("still auto-hides by playback after the key is released", async () => {
      vi.useFakeTimers();
      const video = fakeVideo();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      press("keydown");
      press("keyup");
      vi.advanceTimersByTime(60_000);
      expect(revealed()).toBe(true);
      video.advance(45);
      expect(revealed()).toBe(false);
    });

    it("keeps the text up while the video is paused", async () => {
      vi.useFakeTimers();
      fakeVideo();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      press("keydown");
      vi.advanceTimersByTime(60_000);
      expect(revealed()).toBe(true);
    });

    it("restarts the auto-hide point on a new reveal after an early toggle off", async () => {
      const video = fakeVideo();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      tap();
      tap();
      video.advance(42);
      tap();
      video.advance(46.9);
      expect(revealed()).toBe(true);
      video.advance(47);
      expect(revealed()).toBe(false);
    });

    it("hides on a manual seek past the auto-hide point and not on one before it", async () => {
      const video = fakeVideo();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      press("keydown");
      video.seekTo(30);
      expect(revealed()).toBe(true);
      video.seekTo(60);
      expect(revealed()).toBe(false);
    });

    it("falls back to a timer when no video is found", async () => {
      vi.useFakeTimers();
      document.querySelector("video").remove();
      await feature.update({ ...TOGGLE, revealAutoHide: 5 });

      press("keydown");
      vi.advanceTimersByTime(4999);
      expect(revealed()).toBe(true);
      vi.advanceTimersByTime(1);
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

  it("returns to hidden when the jump back changes", async () => {
    await feature.update({ ...ENABLED, revealMode: "toggle", revealAutoHide: 0 });
    press("keydown");

    await feature.update({ ...ENABLED, revealMode: "toggle", revealAutoHide: 0, revealJumpBack: 3 });
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

describe("jump back on reveal", () => {
  const JUMP = { ...ENABLED, revealJumpBack: 3 };
  const TOGGLE_JUMP = { ...JUMP, revealMode: "toggle", revealAutoHide: 0 };

  it("moves the video back when a press reveals, and not on release", async () => {
    const video = fakeVideo();
    await feature.update(JUMP);

    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(37);
    press("keyup");
    expect(video.time).toBe(37);
  });

  it("leaves the video alone with jump back off", async () => {
    const video = fakeVideo();
    await feature.update(ENABLED);

    press("keydown");
    expect(video.time).toBe(40);
  });

  it("does not jump on held-key repeats", async () => {
    const video = fakeVideo();
    await feature.update(JUMP);

    press("keydown");
    press("keydown", { repeat: true });
    expect(video.time).toBe(37);
  });

  it("stops at the start of the video", async () => {
    const video = fakeVideo(undefined, { time: 1.5 });
    await feature.update(JUMP);

    press("keydown");
    expect(video.time).toBe(0);
  });

  it("does not jump on the press that hides in toggle mode", async () => {
    vi.useFakeTimers();
    const video = fakeVideo();
    await feature.update(TOGGLE_JUMP);

    tap();
    vi.advanceTimersByTime(1000);
    tap();
    expect(revealed()).toBe(false);
    expect(video.time).toBe(37);
  });

  it("jumps again on each later reveal", async () => {
    vi.useFakeTimers();
    const video = fakeVideo();
    await feature.update(JUMP);

    press("keydown");
    press("keyup");
    vi.advanceTimersByTime(1000);
    press("keydown");
    expect(video.time).toBe(34);
  });

  it("jumps on every separate tap, however quick", async () => {
    vi.useFakeTimers();
    const video = fakeVideo();
    await feature.update(JUMP);

    press("keydown");
    press("keyup");
    vi.advanceTimersByTime(100);
    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(34);
  });

  // Some keyboards send auto-repeat as fresh presses without the repeat flag.
  it.each(["hold", "toggle"])("treats fresh key presses before the release as one press in %s mode", async (revealMode) => {
    const video = fakeVideo();
    await feature.update({ ...JUMP, revealMode, revealAutoHide: 0 });

    press("keydown");
    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(37);
  });

  it("counts a press again after a window blur stood in for the release", async () => {
    const video = fakeVideo();
    await feature.update(TOGGLE_JUMP);

    press("keydown");
    window.dispatchEvent(new Event("blur"));
    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(34);
  });

  it("still reveals without jumping before the video is ready", async () => {
    const video = fakeVideo(undefined, { readyState: 0 });
    await feature.update(JUMP);

    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(40);
  });

  // While a seek is in flight, currentTime already reports its target, so
  // a jump from there adds to it.
  it("jumps from the pending target while the video is still seeking", async () => {
    const video = fakeVideo(undefined, { seeking: true });
    await feature.update(JUMP);

    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(37);
  });

  it("adds up quick taps even when each seek is still in flight", async () => {
    const video = fakeVideo();
    await feature.update(JUMP);

    tap();
    video.state.seeking = true;
    tap();
    tap();
    expect(video.time).toBe(31);
  });

  // On macOS a key released while Cmd is down sends no keyup.
  it("counts the next press after Cmd is released over a lost key release", async () => {
    await feature.update({ ...ENABLED, revealMode: "toggle", revealAutoHide: 0 });

    press("keydown");
    press("keydown", { code: "MetaLeft", key: "Meta", metaKey: true });
    press("keyup", { code: "MetaLeft", key: "Meta" });
    press("keydown");
    expect(revealed()).toBe(false);
  });

  it("uses the video in the player whose subtitles are shown", async () => {
    document.body.insertAdjacentHTML("afterbegin", "<video id='other'></video>");
    const other = fakeVideo(document.querySelector("#other"));
    const player = fakeVideo(document.querySelector(".ds-shaka-player video"));
    await feature.update(JUMP);

    press("keydown");
    expect(player.time).toBe(37);
    expect(other.time).toBe(40);
  });

  describe("when caught up", () => {
    const CAUGHT_UP = { ...JUMP, revealMode: "toggle", revealAutoHide: "caught-up" };

    it("hides once playback returns to where the key was pressed", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      press("keydown");
      video.advance(39.9);
      expect(revealed()).toBe(true);
      video.advance(40);
      expect(revealed()).toBe(false);
    });

    it("still catches up after the key is released", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      press("keydown");
      press("keyup");
      video.advance(40);
      expect(revealed()).toBe(false);
    });

    it("acts as off with jump back off", async () => {
      const video = fakeVideo();
      await feature.update({ ...CAUGHT_UP, revealJumpBack: 0 });

      press("keydown");
      video.advance(100);
      expect(revealed()).toBe(true);
    });

    // Reveal at 40 (to 37), hide, reveal at 37.5 (to 34.5): still hides at 40.
    it("hides where the first press of a series was", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      tap();
      video.advance(37.2);
      tap();
      video.advance(37.5);
      tap();
      expect(video.time).toBe(34.5);
      video.advance(39.9);
      expect(revealed()).toBe(true);
      video.advance(40);
      expect(revealed()).toBe(false);
    });

    it("still hides when a reveal in the series could not jump", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      tap();
      tap();
      video.state.readyState = 0;
      tap();
      expect(video.time).toBe(37);
      video.state.readyState = 4;
      video.advance(39.9);
      expect(revealed()).toBe(true);
      video.advance(40);
      expect(revealed()).toBe(false);
    });

    it("starts a new series once playback has caught up", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      tap();
      video.advance(40);
      video.advance(50);
      tap();
      expect(video.time).toBe(47);
      video.advance(49.9);
      expect(revealed()).toBe(true);
      video.advance(50);
      expect(revealed()).toBe(false);
    });

    it("hides where the jump would have landed when the first jump was skipped", async () => {
      const video = fakeVideo(undefined, { readyState: 0 });
      await feature.update(CAUGHT_UP);

      tap();
      expect(video.time).toBe(40);
      video.state.readyState = 4;
      video.advance(42.9);
      expect(revealed()).toBe(true);
      video.advance(43);
      expect(revealed()).toBe(false);
    });

    it("starts a new series when another video loads into the same element", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      tap();
      video.fire("emptied");
      video.advance(38);
      tap();
      expect(video.time).toBe(35);
      video.advance(38);
      expect(revealed()).toBe(false);
    });

    it("starts a new series after catching up, even if the player rewinds into the old range", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      tap();
      video.advance(40);
      video.advance(60);
      video.seekTo(38);
      tap();
      expect(video.time).toBe(35);
      video.advance(38);
      expect(revealed()).toBe(false);
    });

    it("starts a new series after a manual seek further back", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);

      tap();
      tap();
      video.seekTo(10);
      tap();
      expect(video.time).toBe(7);
      video.advance(10);
      expect(revealed()).toBe(false);
    });
  });

  it("counts a numeric auto-hide from the first press of a series", async () => {
    const video = fakeVideo();
    await feature.update({ ...TOGGLE_JUMP, revealAutoHide: 3 });

    tap();
    tap();
    tap();
    expect(video.time).toBe(34);
    video.advance(42.9);
    expect(revealed()).toBe(true);
    video.advance(43);
    expect(revealed()).toBe(false);
  });

  it.each(["ended", "emptied"])("hides when the video fires %s", async (type) => {
    const video = fakeVideo();
    await feature.update(TOGGLE_JUMP);

    press("keydown");
    video.fire(type);
    expect(revealed()).toBe(false);
  });

  it("stops watching the video once hidden or disabled", async () => {
    const video = fakeVideo();
    await feature.update({ ...TOGGLE_JUMP, revealAutoHide: 5 });
    tap();
    tap();
    tap();
    await feature.update({ ...ENABLED, subtitlesEnabled: false });
    await feature.update({ ...TOGGLE_JUMP, revealAutoHide: 5 });

    video.advance(100);
    expect(revealed()).toBe(false);
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
  const CAPTIONS_ON = `
    <div id="movie_player" class="html5-video-player">
      <video class="html5-main-video"></video>
      <div class="ytp-caption-window-container"><div class="caption-window">Hola</div></div>
    </div>
  `;
  let frameFeature;

  function receive(data, origin = DREAMING_ORIGIN) {
    window.dispatchEvent(new MessageEvent("message", { data, origin }));
  }

  beforeEach(() => {
    document.body.innerHTML = CAPTIONS_ON;
    frameFeature = createSubtitlesFeature({
      shownSelector: ".ytp-caption-window-container",
      jumpBlockedSelector: ".ad-showing",
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

  it("jumps the frame's video back on a press forwarded from the Dreaming page", async () => {
    const video = fakeVideo();
    await frameFeature.update({ ...ENABLED, revealJumpBack: 5 });

    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" });
    expect(revealed()).toBe(true);
    expect(video.time).toBe(35);
  });

  it("reveals without jumping while YouTube plays an ad", async () => {
    const video = fakeVideo();
    document.querySelector("#movie_player").classList.add("ad-showing");
    await frameFeature.update({ ...ENABLED, revealJumpBack: 5 });

    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(40);
  });

  it("ignores messages from other origins, other senders, and unknown events", async () => {
    await frameFeature.update(ENABLED);

    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" }, "https://example.com");
    receive({ source: "someone-else", type: "subtitles-reveal", event: "press" });
    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "explode" });
    receive("press");

    expect(revealed()).toBe(false);
  });

  it("ignores the key and forwarded presses while YouTube shows no captions", async () => {
    document.body.innerHTML = '<div class="html5-video-player"></div>';
    await frameFeature.update(ENABLED);

    expect(press("keydown").defaultPrevented).toBe(false);
    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" });
    expect(revealed()).toBe(false);
  });

  describe("after captions are turned off while revealed in toggle mode", () => {
    const TOGGLE = { ...ENABLED, revealMode: "toggle", revealAutoHide: 0 };

    async function revealThenTurnCaptionsOff() {
      await frameFeature.update(TOGGLE);
      press("keydown");
      press("keyup");
      expect(revealed()).toBe(true);
      document.querySelector(".ytp-caption-window-container").remove();
    }

    it("hides on a key press inside the frame", async () => {
      await revealThenTurnCaptionsOff();

      expect(press("keydown").defaultPrevented).toBe(false);
      expect(revealed()).toBe(false);
    });

    it("hides on a press forwarded from the Dreaming page", async () => {
      await revealThenTurnCaptionsOff();

      receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" });
      expect(revealed()).toBe(false);
    });
  });

  it("stops listening for messages when disabled", async () => {
    await frameFeature.update(ENABLED);
    await frameFeature.update({ ...ENABLED, subtitlesEnabled: false });

    receive({ source: "dreaming-tools", type: "subtitles-reveal", event: "press" });
    expect(revealed()).toBe(false);
  });
});

