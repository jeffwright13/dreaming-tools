(() => {
  const {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    isRevealKeyCode,
    normalizeSettings,
  } = globalThis.DreamingToolsSettings;
  const { formatKeyCode } = globalThis.DreamingSubtitlesCore;
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
    for (const name of [...root.classList]) {
      if (name.startsWith("dt-subtitles")) {
        root.classList.remove(name);
      }
    }
    if (settings.subtitlesEnabled) {
      root.classList.add("dt-subtitles", `dt-subtitles--style-${settings.subtitleStyle}`);
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
  // either preview reveals both.
  for (const preview of subtitlePreviews) {
    preview.addEventListener("pointerdown", () => root.classList.add("dt-subtitles--revealed"));
    for (const type of ["pointerup", "pointerleave"]) {
      preview.addEventListener(type, () => root.classList.remove("dt-subtitles--revealed"));
    }
  }

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
