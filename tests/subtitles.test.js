// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/settings.js";
import "../src/subtitles-core.js";
import "../src/subtitles.js";

const { DEFAULT_SETTINGS } = globalThis.DreamingToolsSettings;
const { createSubtitlesFeature } = globalThis.DreamingSubtitlesFeature;

const ENABLED = { ...DEFAULT_SETTINGS, subtitlesEnabled: true };
const JUMP = { ...ENABLED, revealJumpBack: 3 };
const CAUGHT_UP = { ...JUMP, revealAfterRelease: "caught-up" };
const SUBTITLES_ON = `
  <div class="ds-shaka-player">
    <video></video>
    <div class="shaka-text-container"><div><span>Vamos a poner el litro de agua en la olla.</span></div></div>
  </div>
`;
const TAP_MS = 80;
const HOLD_MS = 1500;
const META = { code: "MetaLeft", key: "Meta" };

const root = () => document.documentElement;
const revealed = () => root().classList.contains("dt-subtitles--revealed");

function press(type, init = {}, target = document.body) {
  const event = new KeyboardEvent(type, { code: "KeyS", bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

// Fake timers run in every test, so key events' timeStamp follows the clock
// these helpers advance: tap and hold are told apart by it.
function tap() {
  press("keydown");
  vi.advanceTimersByTime(TAP_MS);
  press("keyup");
}

function hold(ms = HOLD_MS) {
  press("keydown");
  vi.advanceTimersByTime(ms);
  press("keyup");
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

let feature;

beforeEach(() => {
  vi.useFakeTimers();
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

  it("shows while the key is down and keeps the key from reaching the player", async () => {
    await feature.update(ENABLED);
    const playerListener = vi.fn();
    document.body.addEventListener("keydown", playerListener);

    expect(press("keydown").defaultPrevented).toBe(true);
    expect(revealed()).toBe(true);
    expect(playerListener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(HOLD_MS);
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

  it("returns to hidden when the reveal settings change", async () => {
    fakeVideo();
    for (const change of [{ revealKey: "KeyJ" }, { revealAfterRelease: 5 }, { revealJumpBack: 5 }]) {
      await feature.update(CAUGHT_UP);
      tap();
      expect(revealed()).toBe(true);

      await feature.update({ ...CAUGHT_UP, ...change });
      expect(revealed(), JSON.stringify(change)).toBe(false);
    }
  });

  it("removes its classes, listeners, and timer when disabled", async () => {
    document.querySelector("video").remove();
    await feature.update({ ...ENABLED, revealAfterRelease: 5 });
    tap();

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

describe("releasing the key", () => {
  // Every release follows the setting, however long the key was down, so
  // no timing decides what a press means.
  it("follows the setting after a hold just as after release", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    hold();
    expect(revealed()).toBe(true);
    video.advance(40);
    expect(revealed()).toBe(false);

    await feature.update(JUMP);
    hold();
    expect(revealed()).toBe(false);
  });

  it("hides on a tap's release with Hide on release", async () => {
    fakeVideo();
    await feature.update(JUMP);

    tap();
    expect(revealed()).toBe(false);
  });

  it("keeps the text up after release until playback catches up", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    tap();
    expect(revealed()).toBe(true);
    video.advance(39.9);
    expect(revealed()).toBe(true);
    video.advance(40);
    expect(revealed()).toBe(false);
  });

  it("keeps the text up after release for that many seconds past where the key was pressed", async () => {
    const video = fakeVideo();
    await feature.update({ ...JUMP, revealAfterRelease: 5 });

    tap();
    video.advance(44.9);
    expect(revealed()).toBe(true);
    video.advance(45);
    expect(revealed()).toBe(false);
  });

  // H1: the hide point is set at the press but applies only after release's
  // release; until then it is not known whether the press is a tap.
  it("keeps the text up while the key is down, even past the hide point", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    press("keydown");
    video.advance(37.5);
    video.advance(41);
    expect(revealed()).toBe(true);
    vi.advanceTimersByTime(HOLD_MS);
    press("keyup");
    expect(revealed()).toBe(false);
  });

  it("hides a tap released after its hide point has passed", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    press("keydown");
    video.advance(40.2);
    vi.advanceTimersByTime(TAP_MS);
    press("keyup");
    expect(revealed()).toBe(false);
  });

  it("keeps the text up while paused", async () => {
    fakeVideo();
    await feature.update(CAUGHT_UP);

    tap();
    vi.advanceTimersByTime(60_000);
    expect(revealed()).toBe(true);
  });

  it("hides on a seek past the hide point and not on one before it", async () => {
    const video = fakeVideo();
    await feature.update({ ...JUMP, revealAfterRelease: 5 });

    tap();
    video.seekTo(30);
    expect(revealed()).toBe(true);
    video.seekTo(60);
    expect(revealed()).toBe(false);
  });

  it("ignores held-key repeats, with or without the repeat flag", async () => {
    const video = fakeVideo();
    await feature.update(JUMP);

    press("keydown");
    expect(press("keydown", { repeat: true }).defaultPrevented).toBe(true);
    press("keydown");
    expect(video.time).toBe(37);
    expect(revealed()).toBe(true);
  });

  it("hides when the window loses focus, and counts the next press as new", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    tap();
    window.dispatchEvent(new Event("blur"));
    expect(revealed()).toBe(false);

    press("keydown");
    window.dispatchEvent(new Event("blur"));
    press("keydown");
    expect(video.time).toBe(31);
  });

  describe("without a video", () => {
    beforeEach(() => {
      document.querySelector("video").remove();
    });

    it("falls back to a timer for a timed choice", async () => {
      await feature.update({ ...JUMP, revealAfterRelease: 5 });

      tap();
      vi.advanceTimersByTime(4999);
      expect(revealed()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(revealed()).toBe(false);
    });

    it("hides on release with Show until caught up, which has nothing to catch up to", async () => {
      await feature.update(CAUGHT_UP);

      tap();
      expect(revealed()).toBe(false);
    });
  });

  // On macOS a key released while Cmd is down sends no keyup.
  describe("a release lost while Cmd is down", () => {
    it("takes Cmd's release as the key's release", async () => {
      fakeVideo();
      await feature.update(CAUGHT_UP);

      press("keydown");
      press("keydown", { ...META, metaKey: true });
      vi.advanceTimersByTime(HOLD_MS);
      press("keyup", META);
      expect(revealed()).toBe(true);

      await feature.update(JUMP);
      press("keydown");
      press("keyup", META);
      expect(revealed()).toBe(false);
    });

    it("counts the next press as new after Cmd's release", async () => {
      const video = fakeVideo();
      await feature.update(JUMP);

      press("keydown");
      press("keyup", META);
      press("keydown");
      expect(video.time).toBe(34);
    });

    // H2: Cmd+C with the key up, or the key's real release arriving after
    // Cmd's release already stood in for it.
    it("ignores a release with no press pending", async () => {
      fakeVideo();
      await feature.update(CAUGHT_UP);

      tap();
      press("keyup", META);
      expect(revealed()).toBe(true);

      press("keydown");
      vi.advanceTimersByTime(TAP_MS);
      press("keyup", META);
      vi.advanceTimersByTime(HOLD_MS);
      press("keyup");
      expect(revealed()).toBe(true);
    });
  });

  // H5: a press while the player's subtitles are off belongs to the page.
  describe("a press while the player's subtitles are off", () => {
    it("does not jump, reaches the page, hides, and ends the series", async () => {
      const video = fakeVideo();
      await feature.update(CAUGHT_UP);
      tap();
      expect(revealed()).toBe(true);

      document.querySelector(".shaka-text-container").remove();
      const event = press("keydown");
      press("keyup");
      expect(event.defaultPrevented).toBe(false);
      expect(revealed()).toBe(false);
      expect(video.time).toBe(37);

      document.querySelector(".ds-shaka-player").insertAdjacentHTML("beforeend", '<div class="shaka-text-container"></div>');
      expect(revealed()).toBe(false);
      video.advance(38);
      tap();
      video.advance(37.9);
      expect(revealed()).toBe(true);
      video.advance(38);
      expect(revealed()).toBe(false);
    });
  });
});

describe("jump back", () => {
  it("moves the video back on a press, and not on release", async () => {
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

  it("stops at the start of the video", async () => {
    const video = fakeVideo(undefined, { time: 1.5 });
    await feature.update(JUMP);

    press("keydown");
    expect(video.time).toBe(0);
  });

  it("jumps on every press, including one while a tap keeps the text up", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    tap();
    tap();
    tap();
    expect(revealed()).toBe(true);
    expect(video.time).toBe(31);
  });

  // While a seek is in flight, currentTime already reports its target, so a
  // jump from there adds to it.
  it("jumps from the pending target while the video is still seeking", async () => {
    const video = fakeVideo(undefined, { seeking: true });
    await feature.update(JUMP);

    press("keydown");
    expect(video.time).toBe(37);
  });

  it("still shows without jumping before the video is ready", async () => {
    const video = fakeVideo(undefined, { readyState: 0 });
    await feature.update(JUMP);

    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(40);
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

  it.each(["ended", "emptied"])("hides when the video fires %s", async (type) => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    tap();
    video.fire(type);
    expect(revealed()).toBe(false);
  });

  it("stops watching the video once disabled", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);
    tap();
    await feature.update({ ...ENABLED, subtitlesEnabled: false });
    await feature.update(CAUGHT_UP);

    video.advance(100);
    expect(revealed()).toBe(false);
  });
});

describe("a series of presses", () => {
  // Press at 40 (to 37); press at 37.5 (to 34.5): still hides at 40.
  it("hides where the first press of the series was", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

    tap();
    video.advance(37.5);
    tap();
    expect(video.time).toBe(34.5);
    video.advance(39.9);
    expect(revealed()).toBe(true);
    video.advance(40);
    expect(revealed()).toBe(false);
  });

  it("counts a timed choice from the first press of the series", async () => {
    const video = fakeVideo();
    await feature.update({ ...JUMP, revealAfterRelease: 3 });

    tap();
    tap();
    tap();
    expect(video.time).toBe(31);
    video.advance(42.9);
    expect(revealed()).toBe(true);
    video.advance(43);
    expect(revealed()).toBe(false);
  });

  // H3: the series ends at its first press even while a timed choice still
  // keeps the text up, so a later press starts a new one.
  it("starts a new series after catching up while a timed choice keeps the text up", async () => {
    const video = fakeVideo();
    await feature.update({ ...JUMP, revealAfterRelease: 10 });

    tap();
    video.advance(45);
    tap();
    expect(video.time).toBe(42);
    video.advance(54.9);
    expect(revealed()).toBe(true);
    video.advance(55);
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

  it("still hides at the first press when a later jump was skipped", async () => {
    const video = fakeVideo();
    await feature.update(CAUGHT_UP);

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

  it("starts a new series after a seek further back", async () => {
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
    delete document.activeElement;
  });

  const message = (event, extra = {}) => ({ source: "dreaming-tools", type: "subtitles-reveal", event, ...extra });
  const sent = () => frameWindow.postMessage.mock.calls.map(([data]) => data);

  it("forwards the press, the release, and a blur", async () => {
    await topFeature.update(ENABLED);

    expect(press("keydown").defaultPrevented).toBe(true);
    expect(press("keydown", { repeat: true }).defaultPrevented).toBe(true);
    vi.advanceTimersByTime(TAP_MS);
    press("keyup");
    window.dispatchEvent(new Event("blur"));
    vi.runAllTimers();

    expect(frameWindow.postMessage.mock.calls).toEqual([
      [message("press"), "https://www.youtube.com"],
      [message("release"), "https://www.youtube.com"],
      [message("blur"), "https://www.youtube.com"],
    ]);
  });

  it("forwards Cmd's release, standing in for a lost one", async () => {
    await topFeature.update(ENABLED);

    press("keydown");
    vi.advanceTimersByTime(TAP_MS);
    press("keyup", META);
    press("keyup");

    expect(sent()).toEqual([message("press"), message("release")]);
  });

  // H4: a click on the YouTube video (to pause, say) moves focus into the
  // frame, which blurs the page; the text must stay up.
  it("does not forward the blur when focus moves into the YouTube frame", async () => {
    await topFeature.update(ENABLED);
    Object.defineProperty(document, "activeElement", { configurable: true, get: () => document.querySelector("iframe") });

    window.dispatchEvent(new Event("blur"));
    expect(sent()).toEqual([]);
  });

  // Firefox fires the page's blur while activeElement is still <body> and
  // reports the iframe only by the next task (measured by Devin with
  // Playwright: Firefox 159; Chromium 158 reports it inside the handler).
  it("does not forward the blur when the frame takes focus just after it, as in Firefox", async () => {
    await topFeature.update(ENABLED);

    window.dispatchEvent(new Event("blur"));
    Object.defineProperty(document, "activeElement", { configurable: true, get: () => document.querySelector("iframe") });
    vi.runAllTimers();
    expect(sent()).toEqual([]);
  });

  it("still forwards the blur when focus leaves the browser window", async () => {
    await topFeature.update(ENABLED);

    window.dispatchEvent(new Event("blur"));
    vi.runAllTimers();
    expect(sent()).toEqual([message("blur")]);
  });

  it("drops a pending blur check when disabled", async () => {
    await topFeature.update(ENABLED);

    window.dispatchEvent(new Event("blur"));
    await topFeature.update({ ...ENABLED, subtitlesEnabled: false });
    expect(vi.getTimerCount()).toBe(0);
    expect(sent()).toEqual([]);
  });

  it("counts the next press as new after focus moved into the frame mid-press", async () => {
    await topFeature.update(ENABLED);
    press("keydown");
    Object.defineProperty(document, "activeElement", { configurable: true, get: () => document.querySelector("iframe") });
    window.dispatchEvent(new Event("blur"));
    delete document.activeElement;

    press("keydown");
    expect(sent()).toEqual([message("press"), message("press")]);
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

  const message = (event, extra = {}) => ({ source: "dreaming-tools", type: "subtitles-reveal", event, ...extra });

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

  it("jumps the frame's video back on a forwarded press", async () => {
    const video = fakeVideo();
    await frameFeature.update({ ...ENABLED, revealJumpBack: 5 });

    receive(message("press"));
    expect(revealed()).toBe(true);
    expect(video.time).toBe(35);
  });

  it("follows the setting on a forwarded release", async () => {
    fakeVideo();
    await frameFeature.update(CAUGHT_UP);

    receive(message("press"));
    vi.advanceTimersByTime(HOLD_MS);
    receive(message("release"));
    expect(revealed()).toBe(true);

    await frameFeature.update(JUMP);
    receive(message("press"));
    receive(message("release"));
    expect(revealed()).toBe(false);
  });

  // Focus moved into the frame mid-press: the key's release arrives here.
  it("takes a local release after a forwarded press", async () => {
    fakeVideo();
    await frameFeature.update(CAUGHT_UP);

    receive(message("press"));
    vi.advanceTimersByTime(TAP_MS);
    press("keyup");
    expect(revealed()).toBe(true);
  });

  it("hides on a forwarded blur", async () => {
    fakeVideo();
    await frameFeature.update(CAUGHT_UP);

    receive(message("press"));
    receive(message("release"));
    receive(message("blur"));
    expect(revealed()).toBe(false);
  });

  it("shows without jumping while YouTube plays an ad", async () => {
    const video = fakeVideo();
    document.querySelector("#movie_player").classList.add("ad-showing");
    await frameFeature.update({ ...ENABLED, revealJumpBack: 5 });

    press("keydown");
    expect(revealed()).toBe(true);
    expect(video.time).toBe(40);
  });

  it("ignores messages from other origins, other senders, and unknown events", async () => {
    await frameFeature.update(ENABLED);

    receive(message("press"), "https://example.com");
    receive({ source: "someone-else", type: "subtitles-reveal", event: "press" });
    receive(message("explode"));
    receive("press");

    expect(revealed()).toBe(false);
  });

  it("ignores the key and forwarded presses while YouTube shows no captions", async () => {
    document.body.innerHTML = '<div class="html5-video-player"></div>';
    await frameFeature.update(ENABLED);

    expect(press("keydown").defaultPrevented).toBe(false);
    receive(message("press"));
    expect(revealed()).toBe(false);
  });

  describe("after captions are turned off while a tap keeps the text up", () => {
    async function revealThenTurnCaptionsOff() {
      fakeVideo();
      await frameFeature.update(CAUGHT_UP);
      tap();
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

      receive(message("press"));
      expect(revealed()).toBe(false);
    });
  });

  it("stops listening for messages when disabled", async () => {
    await frameFeature.update(ENABLED);
    await frameFeature.update({ ...ENABLED, subtitlesEnabled: false });

    receive(message("press"));
    expect(revealed()).toBe(false);
  });
});
