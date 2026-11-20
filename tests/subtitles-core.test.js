// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import "../src/subtitles-core.js";

const {
  SERIES_SLACK_S,
  autoHidePoint,
  continuesSeries,
  formatKeyCode,
  isRevealKeyPress,
  isTypingTarget,
  jumpTarget,
  nextRevealState,
} = globalThis.DreamingSubtitlesCore;

describe("nextRevealState in hold mode", () => {
  const hold = { revealMode: "hold" };

  it("reveals while the key is down and hides on release", () => {
    expect(nextRevealState(false, "press", hold)).toBe(true);
    expect(nextRevealState(true, "release", hold)).toBe(false);
  });

  it("hides when the window loses focus", () => {
    expect(nextRevealState(true, "blur", hold)).toBe(false);
  });
});

describe("nextRevealState in toggle mode", () => {
  const toggle = { revealMode: "toggle" };

  it("flips on each press and ignores release", () => {
    expect(nextRevealState(false, "press", toggle)).toBe(true);
    expect(nextRevealState(true, "release", toggle)).toBe(true);
    expect(nextRevealState(true, "press", toggle)).toBe(false);
  });

  it("hides on auto-hide timeout and on window blur", () => {
    expect(nextRevealState(true, "timeout", toggle)).toBe(false);
    expect(nextRevealState(true, "blur", toggle)).toBe(false);
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

describe("autoHidePoint", () => {
  const toggle = (revealAutoHide) => ({ revealMode: "toggle", revealAutoHide });

  // The anchor is where the series of reveals started; landed is where the
  // video is after this reveal's jump.
  it("is a number of playback seconds after the anchor", () => {
    expect(autoHidePoint(toggle(5), 40, 37)).toBe(45);
    expect(autoHidePoint(toggle(5), 40, 40)).toBe(45);
  });

  it("is the anchor itself when caught up", () => {
    expect(autoHidePoint(toggle("caught-up"), 40, 37)).toBe(40);
  });

  // The jump was skipped (video not ready, an ad): hide where it would have
  // landed, so the reveal still ends.
  it("is the jump amount past the anchor when caught up but the video did not move back", () => {
    expect(autoHidePoint({ ...toggle("caught-up"), revealJumpBack: 3 }, 40, 40)).toBe(43);
  });

  // With jump back off, When caught up acts as Off.
  it("is none when caught up with jump back off", () => {
    expect(autoHidePoint({ ...toggle("caught-up"), revealJumpBack: 0 }, 40, 40)).toBeNull();
  });

  it("is none with auto-hide off or in hold mode", () => {
    expect(autoHidePoint(toggle(0), 40, 37)).toBeNull();
    expect(autoHidePoint({ revealMode: "hold", revealAutoHide: 5 }, 40, 37)).toBeNull();
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
