// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import "../src/subtitles-core.js";

const {
  SERIES_SLACK_S,
  TAP_MAX_MS,
  continuesSeries,
  formatKeyCode,
  hidePoint,
  isRevealKeyPress,
  isTap,
  isTypingTarget,
  jumpTarget,
  previewTapMs,
  tapKeepsShown,
} = globalThis.DreamingSubtitlesCore;

describe("isTap", () => {
  it("is a press released within the tap time", () => {
    expect(isTap(0)).toBe(true);
    expect(isTap(TAP_MAX_MS - 1)).toBe(true);
  });

  it("is not a hold of the tap time or longer", () => {
    expect(isTap(TAP_MAX_MS)).toBe(false);
    expect(isTap(2000)).toBe(false);
  });

  // A forwarded release with no valid hold time counts as a hold.
  it.each([undefined, null, -1, Number.NaN, Number.POSITIVE_INFINITY, "50"])("is not a tap for a held time of %s", (heldMs) => {
    expect(isTap(heldMs)).toBe(false);
  });
});

describe("tapKeepsShown", () => {
  const settings = (revealAfterTap, revealJumpBack = 3) => ({ revealAfterTap, revealJumpBack });

  it("keeps the text up after a tap for every choice but Hide on release", () => {
    expect(tapKeepsShown(settings("hide"))).toBe(false);
    expect(tapKeepsShown(settings("caught-up"))).toBe(true);
    expect(tapKeepsShown(settings(5))).toBe(true);
    expect(tapKeepsShown(settings(5, 0))).toBe(true);
  });

  // With nothing to catch up to, Show until caught up acts as Hide on release.
  it("treats Show until caught up as Hide on release with jump back off", () => {
    expect(tapKeepsShown(settings("caught-up", 0))).toBe(false);
  });
});

describe("isRevealKeyPress", () => {
  const key = (init) => new KeyboardEvent("keydown", { code: "KeyS", ...init });

  it("matches the configured physical key", () => {
    expect(isRevealKeyPress(key(), "KeyS")).toBe(true);
    expect(isRevealKeyPress(key({ shiftKey: true }), "KeyS")).toBe(true);
  });

  it("rejects other keys and browser shortcut modifiers", () => {
    expect(isRevealKeyPress(key({ code: "KeyD" }), "KeyS")).toBe(false);
    expect(isRevealKeyPress(key({ metaKey: true }), "KeyS")).toBe(false);
    expect(isRevealKeyPress(key({ ctrlKey: true }), "KeyS")).toBe(false);
    expect(isRevealKeyPress(key({ altKey: true }), "KeyS")).toBe(false);
  });
});

describe("isTypingTarget", () => {
  it.each([
    ["<input>", true],
    ['<input type="checkbox">', false],
    ["<textarea></textarea>", true],
    ["<select></select>", true],
    ['<div contenteditable="true"></div>', true],
    ["<button></button>", false],
    ["<div></div>", false],
  ])("treats %s as typing: %s", (markup, expected) => {
    document.body.innerHTML = markup;
    expect(isTypingTarget(document.body.firstElementChild)).toBe(expected);
  });

  it("treats a non-element target as not typing", () => {
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("formatKeyCode", () => {
  it.each([
    ["KeyS", "S"],
    ["Digit7", "7"],
    ["Backquote", "`"],
    ["BracketLeft", "["],
  ])("formats %s as %s", (code, label) => {
    expect(formatKeyCode(code)).toBe(label);
  });
});

describe("jumpTarget", () => {
  it("moves back by the jump", () => {
    expect(jumpTarget(42.5, 3)).toBe(39.5);
  });

  it("stops at the start of the video", () => {
    expect(jumpTarget(1.2, 5)).toBe(0);
  });

  it("stays put with jump back off", () => {
    expect(jumpTarget(42.5, 0)).toBe(42.5);
  });
});

describe("hidePoint", () => {
  const settings = (revealAfterTap, revealJumpBack = 3) => ({ revealAfterTap, revealJumpBack });

  // The anchor is where the series of presses started; landed is where the
  // video is after this press's jump.
  it("is that many playback seconds past the anchor for a timed choice", () => {
    expect(hidePoint(settings(5), 40, 37)).toBe(45);
    expect(hidePoint(settings(5, 0), 40, 40)).toBe(45);
  });

  it("is the anchor itself for Show until caught up", () => {
    expect(hidePoint(settings("caught-up"), 40, 37)).toBe(40);
  });

  // The jump was skipped (video not ready, an ad): hide where it would have
  // landed back to, so the reveal still ends.
  it("is the jump amount past the anchor when the video did not move back", () => {
    expect(hidePoint(settings("caught-up"), 40, 40)).toBe(43);
  });

  it("is none for Hide on release, or Show until caught up with jump back off", () => {
    expect(hidePoint(settings("hide"), 40, 37)).toBeNull();
    expect(hidePoint(settings("caught-up", 0), 40, 40)).toBeNull();
  });
});

// The options preview has no video: a tap there lasts as long as it would on
// a playing video, measured from the press.
describe("previewTapMs", () => {
  const settings = (revealAfterTap, revealJumpBack = 3) => ({ revealAfterTap, revealJumpBack });

  it("is the jump amount for Show until caught up", () => {
    expect(previewTapMs(settings("caught-up"))).toBe(3000);
  });

  it("is the jump amount plus the seconds for a timed choice", () => {
    expect(previewTapMs(settings(5))).toBe(8000);
    expect(previewTapMs(settings(5, 0))).toBe(5000);
  });

  it("is none when a tap hides on release", () => {
    expect(previewTapMs(settings("hide"))).toBeNull();
    expect(previewTapMs(settings("caught-up", 0))).toBeNull();
  });
});

describe("continuesSeries", () => {
  const series = { anchor: 40, floor: 34 };

  it("continues while playback is between the lowest jump and the anchor", () => {
    expect(continuesSeries(series, 34)).toBe(true);
    expect(continuesSeries(series, 39.9)).toBe(true);
  });

  it("ends once playback reaches the anchor", () => {
    expect(continuesSeries(series, 40)).toBe(false);
    expect(continuesSeries(series, 55)).toBe(false);
  });

  // Players may land a little short of a seek target.
  it("allows a little slack below the lowest jump, but not a seek further back", () => {
    expect(continuesSeries(series, 34 - SERIES_SLACK_S)).toBe(true);
    expect(continuesSeries(series, 20)).toBe(false);
  });

  it("is false with no series", () => {
    expect(continuesSeries(null, 40)).toBe(false);
  });
});
