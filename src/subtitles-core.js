(() => {
  // Pure helpers for the subtitles feature, kept free of page state so they
  // can be unit-tested and shared with the options page.

  const KEY_LABELS = {
    Backquote: "`",
    Backslash: "\\",
    BracketLeft: "[",
    BracketRight: "]",
    Comma: ",",
    Equal: "=",
    Minus: "-",
    Period: ".",
    Quote: "'",
    Semicolon: ";",
    Slash: "/",
  };
  // Some keyboards send auto-repeat as fresh key presses without the repeat
  // flag; this keeps a held key from rewinding the video many times a second.
  const JUMP_GUARD_MS = 500;
  const CAUGHT_UP = "caught-up";
  const TYPING_INPUT_TYPES = new Set([
    "email", "number", "password", "search", "tel", "text", "url",
  ]);

  // Events are "press", "release", "timeout" (toggle auto-hide), and "blur"
  // (window lost focus, so a release may never arrive). Returns whether the
  // subtitles should now be readable.
  function nextRevealState(revealed, event, { revealMode }) {
    switch (event) {
      case "press":
        return revealMode === "hold" ? true : !revealed;
      case "release":
        return revealMode === "hold" ? false : revealed;
      default:
        return false;
    }
  }

  // Shift is allowed; Ctrl, Alt, and Cmd combinations are browser shortcuts.
  function isRevealKeyPress(event, revealKey) {
    return event.code === revealKey && !event.ctrlKey && !event.altKey && !event.metaKey;
  }

  function isTypingTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    if (target.isContentEditable || target.closest("[contenteditable='true'], [contenteditable='']")) {
      return true;
    }

    if (target instanceof HTMLInputElement) {
      return TYPING_INPUT_TYPES.has(target.type);
    }

    return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }

  function jumpTarget(currentTime, jumpBack) {
    return Math.max(0, currentTime - jumpBack);
  }

  function isJumpGuarded(lastJumpAt, now) {
    return lastJumpAt !== null && now - lastJumpAt < JUMP_GUARD_MS;
  }

  // The playback time at which a toggle reveal hides again, or null for
  // none. Measured in playback time from the press (pressTime, before any
  // jump), so a paused video keeps its text and slower speeds take longer.
  // "Caught up" hides once playback returns to the press; when the video did
  // not move back (jumped is 0) there is nothing to catch up to.
  function autoHidePoint({ revealMode, revealAutoHide }, pressTime, jumped) {
    if (revealMode !== "toggle" || revealAutoHide === 0) {
      return null;
    }
    if (revealAutoHide === CAUGHT_UP) {
      return jumped > 0 ? pressTime : null;
    }
    return pressTime + revealAutoHide;
  }

  function formatKeyCode(code) {
    return KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, "");
  }

  globalThis.DreamingSubtitlesCore = {
    CAUGHT_UP,
    JUMP_GUARD_MS,
    autoHidePoint,
    formatKeyCode,
    isJumpGuarded,
    jumpTarget,
    isRevealKeyPress,
    isTypingTarget,
    nextRevealState,
  };
})();
