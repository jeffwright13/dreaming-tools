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
  // Players may land a little short of a seek target, so a series of reveals
  // continues slightly below its lowest jump.
  const SERIES_SLACK_S = 0.5;
  const CAUGHT_UP = "caught-up";
  const HIDE_ON_RELEASE = "hide";
  const MILLISECONDS_PER_SECOND = 1000;
  const TYPING_INPUT_TYPES = new Set([
    "email", "number", "password", "search", "tel", "text", "url",
  ]);

  // Whether the text stays up after the key's release. Show until caught up
  // needs a jump: with jump back off it acts as Hide on release.
  function releaseKeepsShown({ revealAfterRelease, revealJumpBack }) {
    if (revealAfterRelease === HIDE_ON_RELEASE) {
      return false;
    }
    return revealAfterRelease !== CAUGHT_UP || revealJumpBack > 0;
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

  // A series is the run of reveals that starts at one press (anchor, the
  // playback time before its jump) and lasts while playback stays between the
  // lowest point the jumps reached (floor) and the anchor. Tapping the key a
  // few times to go further back is one series; a manual seek outside it, or
  // playback reaching the anchor, ends it.
  function continuesSeries(series, time) {
    return series !== null && time >= series.floor - SERIES_SLACK_S && time < series.anchor;
  }

  // The playback time at which a released reveal hides, or null for none.
  // Measured in playback time from the series anchor, so a paused video
  // keeps its text, slower speeds take longer, and several taps back still
  // show the text up to where the learner started. Show until caught up hides
  // at the anchor; when the video is not behind it (landed, where this press
  // left the video) because the jump was skipped, it hides where the jump
  // would have landed back to.
  function hidePoint(settings, anchor, landed) {
    if (!releaseKeepsShown(settings)) {
      return null;
    }
    if (settings.revealAfterRelease === CAUGHT_UP) {
      return landed < anchor ? anchor : anchor + settings.revealJumpBack;
    }
    return anchor + settings.revealAfterRelease;
  }

  // How long a release keeps the options preview revealed, or null for not at
  // all. The preview has no video, so this is how long the text would stay
  // up on a playing video after a full jump: to the anchor, or past it.
  function previewShowMs(settings) {
    if (!releaseKeepsShown(settings)) {
      return null;
    }
    const extra = settings.revealAfterRelease === CAUGHT_UP ? 0 : settings.revealAfterRelease;
    return (settings.revealJumpBack + extra) * MILLISECONDS_PER_SECOND;
  }

  function formatKeyCode(code) {
    return KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, "");
  }

  globalThis.DreamingSubtitlesCore = {
    CAUGHT_UP,
    SERIES_SLACK_S,
    continuesSeries,
    formatKeyCode,
    hidePoint,
    isRevealKeyPress,
    isTypingTarget,
    jumpTarget,
    previewShowMs,
    releaseKeepsShown,
  };
})();
