(() => {
  const {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    isRevealKeyCode,
    normalizeSettings,
  } = globalThis.DreamingToolsSettings;
  const {
    formatKeyCode,
    isRevealKeyPress,
    isTypingTarget,
    nextRevealState,
  } = globalThis.DreamingSubtitlesCore;
  const form = document.querySelector("#settings-form");
  const behaviorControls = document.querySelector("#behavior-controls");
  const appearanceControls = document.querySelector("#appearance-controls");
  const previewBadge = document.querySelector("#preview-badge");
  const previewDisabled = document.querySelector("#preview-disabled");
  const subtitleControls = document.querySelector("#subtitle-controls");
  const autoHideControl = document.querySelector("#auto-hide-control");
  const revealKeyButton = document.querySelector("#reveal-key-button");
  const revealKeyInput = form.elements.namedItem("revealKey");
  const subtitlePreviews = document.querySelectorAll("#subtitle-preview, #youtube-subtitle-preview");
  const resetButton = document.querySelector("#reset-options");
  const status = document.querySelector("#status");
  const root = document.documentElement;
  const CAPTURE_PROMPT = "Press a key…";
  const NUMERIC_SETTINGS = new Set(["revealAutoHide"]);
  const REVEALED_CLASS = "dt-subtitles--revealed";
  const REVEAL_SETTINGS = ["revealMode", "revealKey", "revealAutoHide"];
  const MILLISECONDS_PER_SECOND = 1000;

  // The previews can be revealed with the configured key, page-wide, or by
  // pressing a preview, following the chosen mode as on Dreaming. This uses
  // the shared reveal logic in subtitles-core.js rather than the content
  // script's feature: that feature listens in the capture phase on window,
  // which would swallow the key press while a new reveal key is being
  // chosen, and it offers no way for a mouse press to share its state.
  let previewSettings = null;
  let previewRevealed = false;
  let autoHideTimer = null;

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
      return [key, NUMERIC_SETTINGS.has(key) ? Number(value) : value];
    })));
  }

  function renderDifficultyPreview(settings) {
    const disabled = !settings.difficultyEnabled;
    behaviorControls.disabled = disabled;
    appearanceControls.disabled = disabled;
    previewBadge.hidden = disabled;
    previewDisabled.hidden = !disabled;
    previewBadge.className = [
      "ds-difficulty-extension-badge",
      "ds-difficulty-extension-badge--video",
      `ds-difficulty-extension-badge--style-${settings.style}`,
      `ds-difficulty-extension-badge--size-${settings.size}`,
      `ds-difficulty-extension-badge--position-${settings.position}`,
    ].join(" ");
  }

  // The preview reuses subtitles.css, which keys off classes on <html>, so the
  // options page sets the same classes the content script would.
  function renderSubtitlePreview(settings) {
    subtitleControls.disabled = !settings.subtitlesEnabled;
    autoHideControl.hidden = settings.revealMode !== "toggle";
    if (revealKeyButton.textContent !== CAPTURE_PROMPT) {
      revealKeyButton.textContent = formatKeyCode(settings.revealKey);
    }
    const previous = previewSettings;
    previewSettings = settings;
    if (!settings.subtitlesEnabled || REVEAL_SETTINGS.some((key) => previous && previous[key] !== settings[key])) {
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
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
    const { revealMode, revealAutoHide } = previewSettings ?? {};
    if (previewRevealed && revealMode === "toggle" && revealAutoHide > 0) {
      autoHideTimer = setTimeout(
        () => setPreviewRevealed(nextRevealState(previewRevealed, "timeout", previewSettings)),
        revealAutoHide * MILLISECONDS_PER_SECOND,
      );
    }
  }

  function applyRevealEvent(event) {
    if (previewSettings?.subtitlesEnabled) {
      setPreviewRevealed(nextRevealState(previewRevealed, event, previewSettings));
    }
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
      applyRevealEvent("press");
    }
  }

  function onPreviewKeyUp(event) {
    if (event.code === previewSettings?.revealKey) {
      applyRevealEvent("release");
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
  // either preview reveals both. A press acts like the reveal key, so in
  // Toggle mode a click toggles and leaving the preview does not hide.
  for (const preview of subtitlePreviews) {
    preview.addEventListener("pointerdown", () => applyRevealEvent("press"));
    for (const type of ["pointerup", "pointerleave"]) {
      preview.addEventListener(type, () => applyRevealEvent("release"));
    }
  }

  document.addEventListener("keydown", onPreviewKeyDown);
  document.addEventListener("keyup", onPreviewKeyUp);
  window.addEventListener("blur", () => applyRevealEvent("blur"));

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

  chrome.storage.sync.get(SETTING_KEYS).then((stored) => {
    populateForm(normalizeSettings(stored));
  });
})();
