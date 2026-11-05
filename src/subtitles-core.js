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

  function formatKeyCode(code) {
    return KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, "");
  }

  globalThis.DreamingSubtitlesCore = {
    formatKeyCode,
    isRevealKeyPress,
    isTypingTarget,
    nextRevealState,
  };
})();
