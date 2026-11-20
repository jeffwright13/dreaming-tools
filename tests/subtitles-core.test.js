// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import "../src/subtitles-core.js";

const {
  JUMP_GUARD_MS,
  autoHidePoint,
  formatKeyCode,
  isJumpGuarded,
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

  it("is a number of playback seconds after the press", () => {
    expect(autoHidePoint(toggle(5), 40, 3)).toBe(45);
    expect(autoHidePoint(toggle(5), 40, 0)).toBe(45);
  });

  it("is the press point itself when caught up", () => {
    expect(autoHidePoint(toggle("caught-up"), 40, 3)).toBe(40);
  });

  // Nothing to catch up to: the reveal stays until the next press.
  it("is none when caught up but the video did not move back", () => {
    expect(autoHidePoint(toggle("caught-up"), 40, 0)).toBeNull();
  });

  it("is none with auto-hide off or in hold mode", () => {
    expect(autoHidePoint(toggle(0), 40, 3)).toBeNull();
    expect(autoHidePoint({ revealMode: "hold", revealAutoHide: 5 }, 40, 3)).toBeNull();
  });
});

describe("isJumpGuarded", () => {
  it("blocks a second jump within the guard time", () => {
    expect(isJumpGuarded(10_000, 10_000 + JUMP_GUARD_MS - 1)).toBe(true);
  });

  it("allows a jump once the guard time has passed", () => {
    expect(isJumpGuarded(10_000, 10_000 + JUMP_GUARD_MS)).toBe(false);
  });

  it("allows the first jump", () => {
    expect(isJumpGuarded(null, 10_000)).toBe(false);
  });
});
