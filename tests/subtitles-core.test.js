// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import "../src/subtitles-core.js";

const {
  formatKeyCode,
  isRevealKeyPress,
  isTypingTarget,
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
