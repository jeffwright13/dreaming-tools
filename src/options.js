(() => {
  const {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    STORED_KEYS,
    isRevealKeyCode,
    normalizeSettings,
  } = globalThis.DreamingToolsSettings;
  const {
    formatKeyCode,
    isRevealKeyPress,
    isTypingTarget,
    previewShowMs,
  } = globalThis.DreamingSubtitlesCore;
  const form = document.querySelector("#settings-form");
  const behaviorControls = document.querySelector("#behavior-controls");
  const appearanceControls = document.querySelector("#appearance-controls");
  // Each preview badge with its card type, as difficulty.js labels them.
  const previewBadges = [
    [document.querySelector("#preview-badge"), "video"],
    [document.querySelector("#preview-series-badge"), "series"],
  ];
  const previewDisabledNotices = document.querySelectorAll(".preview-disabled");
  const subtitleControls = document.querySelector("#subtitle-controls");
  const caughtUpOption = document.querySelector("#caught-up-option");
  const afterReleaseHint = document.querySelector("#after-release-hint");
  const revealKeyButton = document.querySelector("#reveal-key-button");
  const revealKeyInput = form.elements.namedItem("revealKey");
  const subtitlePreviews = document.querySelectorAll("#subtitle-preview, #youtube-subtitle-preview");
  const resetButton = document.querySelector("#reset-options");
  const status = document.querySelector("#status");
  const root = document.documentElement;
  const CAPTURE_PROMPT = "Press a key…";
  // Menus whose values are numbers, apart from named choices such as "hide"
  // and "caught-up" in After releasing.
  const NUMERIC_SETTINGS = new Set(["revealAfterRelease", "revealJumpBack"]);
  const NUMBER_PATTERN = /^\d+$/;
  const REVEALED_CLASS = "dt-subtitles--revealed";
  const REVEAL_SETTINGS = ["revealKey", "revealAfterRelease", "revealJumpBack"];
  // macOS sends no keyup for a key released while Cmd is down; Cmd's own
  // release stands in for it, as on Dreaming.
  const META_KEY = "Meta";

  // The previews can be revealed with the configured key, page-wide, or by
  // pressing a preview, as on Dreaming. This uses the
  // shared reveal logic in subtitles-core.js rather than the content
  // script's feature: that feature listens in the capture phase on window,
  // which would swallow the key press while a new reveal key is being
  // chosen, and it offers no way for a mouse press to share its state.
  let previewSettings = null;
  let previewRevealed = false;
  let previewTimer = null;
  // Whether a key or pointer press is waiting for its release.
  let previewPressPending = false;

  // Read each control directly rather than through FormData: FormData skips
  // controls inside a disabled fieldset, which would reset a switched-off
  // feature's settings to defaults on save. It also reports checkboxes as
  // "on" and numbers as strings.
  function readForm() {
    return normalizeSettings(Object.fromEntries(SETTING_KEYS.map((key) => {
      const control = form.elements.namedItem(key);
      if (control?.type === "checkbox") {
        return [key, control.checked];
      }
      const value = control?.value;
      return [key, NUMERIC_SETTINGS.has(key) && NUMBER_PATTERN.test(value) ? Number(value) : value];
    })));
  }

  function renderDifficultyPreview(settings) {
    const disabled = !settings.difficultyEnabled;
    behaviorControls.disabled = disabled;
    appearanceControls.disabled = disabled;
    for (const notice of previewDisabledNotices) {
      notice.hidden = !disabled;
    }
    for (const [badge, cardType] of previewBadges) {
      badge.hidden = disabled;
      badge.className = [
        "ds-difficulty-extension-badge",
        `ds-difficulty-extension-badge--${cardType}`,
        `ds-difficulty-extension-badge--style-${settings.style}`,
        `ds-difficulty-extension-badge--size-${settings.size}`,
        `ds-difficulty-extension-badge--position-${settings.position}`,
      ].join(" ");
    }
  }

  // The preview reuses subtitles.css, which keys off classes on <html>, so the
  // options page sets the same classes the content script would.
  function renderSubtitlePreview(settings) {
    subtitleControls.disabled = !settings.subtitlesEnabled;
    // A disabled option still shows when it is the stored choice; the content
    // script treats Show until caught up as Hide on release while jump back
    // is off.
    caughtUpOption.disabled = settings.revealJumpBack === 0;
    afterReleaseHint.hidden = !(settings.revealJumpBack > 0 && settings.revealAfterRelease === "hide");
    if (revealKeyButton.textContent !== CAPTURE_PROMPT) {
      revealKeyButton.textContent = formatKeyCode(settings.revealKey);
    }
    const previous = previewSettings;
    previewSettings = settings;
    if (!settings.subtitlesEnabled || REVEAL_SETTINGS.some((key) => previous && previous[key] !== settings[key])) {
      previewPressPending = false;
      setPreviewRevealed(false);
    }
    for (const name of [...root.classList]) {
      if (name.startsWith("dt-subtitles")) {
        root.classList.remove(name);
      }
    }
    if (settings.subtitlesEnabled) {
      root.classList.add("dt-subtitles", `dt-subtitles--style-${settings.subtitleStyle}`);
      root.classList.toggle(REVEALED_CLASS, previewRevealed);
    }
  }

  function setPreviewRevealed(next) {
    previewRevealed = next;
    root.classList.toggle(REVEALED_CLASS, previewRevealed);
    clearTimeout(previewTimer);
    previewTimer = null;
  }

  function previewPress() {
    if (!previewSettings?.subtitlesEnabled || previewPressPending) {
      return;
    }
    previewPressPending = true;
    setPreviewRevealed(true);
  }

  // The preview has no video to jump back or to catch up with, so after a
  // release it stays up on a timer for as long as it would on a playing
  // video (previewShowMs), or hides at once with Hide on release.
  function previewRelease() {
    if (!previewPressPending) {
      return;
    }
    previewPressPending = false;
    const showMs = previewShowMs(previewSettings);
    if (showMs === null) {
      setPreviewRevealed(false);
      return;
    }
    previewTimer = setTimeout(() => setPreviewRevealed(false), showMs);
  }

  function previewBlur() {
    previewPressPending = false;
    setPreviewRevealed(false);
  }

  // Unlike on Dreaming, a select here does not take the reveal key: a select
  // keeps focus after each change, so standing aside let the key reach its
  // type-to-select, which changed the setting instead of previewing it.
  // preventDefault below keeps the key from reaching the select.
  function isTextEntryTarget(target) {
    return !(target instanceof HTMLSelectElement) && isTypingTarget(target);
  }

  // Bubble-phase listeners: while a new key is being chosen, the capture
  // listener (onCaptureKey) stops the event before it gets here.
  function onPreviewKeyDown(event) {
    if (!previewSettings?.subtitlesEnabled || revealKeyButton.textContent === CAPTURE_PROMPT
      || !isRevealKeyPress(event, previewSettings.revealKey) || isTextEntryTarget(event.target)) {
      return;
    }

    event.preventDefault();
    if (!event.repeat) {
      previewPress();
    }
  }

  function onPreviewKeyUp(event) {
    if (event.code === previewSettings?.revealKey || event.key === META_KEY) {
      previewRelease();
    }
  }

  function renderPreview() {
    const settings = readForm();
    renderDifficultyPreview(settings);
    renderSubtitlePreview(settings);
  }

  function populateForm(settings) {
    for (const [key, value] of Object.entries(settings)) {
      const control = form.elements.namedItem(key);
      if (control?.type === "checkbox") {
        control.checked = value;
      } else if (control) {
        control.value = String(value);
      }
    }
    renderPreview();
  }

  // Every change saves at once; there is no Save button. Each write carries the
  // whole form, and chrome.storage applies writes in order, so the last change
  // wins even if several are in flight.
  // Every storage write goes through here, so the status line is the one
  // place a failed write is reported. Returns whether the write succeeded.
  async function writeSettings(settings, successMessage) {
    try {
      await chrome.storage.sync.set(settings);
      status.textContent = successMessage;
      return true;
    } catch (error) {
      console.error("Dreaming Tools options couldn't be saved.", error);
      status.textContent = `Options couldn't be saved: ${error.message}`;
      return false;
    }
  }

  function saveForm() {
    return writeSettings(readForm(), "Saved.");
  }

  function onCaptureKey(event) {
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener("keydown", onCaptureKey, true);
    revealKeyButton.textContent = "";
    if (event.code === "Escape") {
      renderPreview();
      return;
    }

    if (!isRevealKeyCode(event.code)) {
      status.textContent = `${event.code} can't be used as the reveal key. Choose a letter, digit, or punctuation key.`;
      renderPreview();
      return;
    }

    revealKeyInput.value = event.code;
    status.textContent = "";
    renderPreview();
    // Setting a hidden input fires no change event, so save here.
    saveForm();
  }

  revealKeyButton.addEventListener("click", () => {
    revealKeyButton.textContent = CAPTURE_PROMPT;
    document.addEventListener("keydown", onCaptureKey, true);
  });

  // One preview per player. The reveal class is on <html>, so pressing
  // either preview reveals both. A press acts like the reveal key, and
  // leaving the preview ends the press.
  for (const preview of subtitlePreviews) {
    preview.addEventListener("pointerdown", previewPress);
    for (const type of ["pointerup", "pointerleave"]) {
      preview.addEventListener(type, previewRelease);
    }
  }

  document.addEventListener("keydown", onPreviewKeyDown);
  document.addEventListener("keyup", onPreviewKeyUp);
  window.addEventListener("blur", previewBlur);

  form.addEventListener("change", () => {
    status.textContent = "";
    renderPreview();
    saveForm();
  });

  // Show the defaults only once they are stored, so the form never displays
  // settings that were not saved.
  resetButton.addEventListener("click", async () => {
    if (await writeSettings(DEFAULT_SETTINGS, "Defaults restored.")) {
      populateForm(DEFAULT_SETTINGS);
    }
  });

  chrome.storage.sync.get(STORED_KEYS).then((stored) => {
    populateForm(normalizeSettings(stored));
  });
})();
