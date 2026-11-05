(() => {
  const { DEFAULT_SETTINGS, SETTING_KEYS, normalizeSettings } = globalThis.DreamingToolsSettings;
  const form = document.querySelector("#settings-form");
  const difficultyToggle = form.elements.namedItem("difficultyEnabled");
  const behaviorControls = document.querySelector("#behavior-controls");
  const appearanceControls = document.querySelector("#appearance-controls");
  const previewBadge = document.querySelector("#preview-badge");
  const previewDisabled = document.querySelector("#preview-disabled");
  const resetButton = document.querySelector("#reset-options");
  const status = document.querySelector("#status");

  // FormData omits unchecked checkboxes and reports checked ones as "on", so
  // the enable switch is read from the element itself.
  function readForm() {
    return normalizeSettings({
      ...Object.fromEntries(new FormData(form)),
      difficultyEnabled: difficultyToggle.checked,
    });
  }

  function renderPreview() {
    const settings = readForm();
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

  function populateForm(settings) {
    for (const [key, value] of Object.entries(settings)) {
      const control = form.elements.namedItem(key);
      if (control?.type === "checkbox") {
        control.checked = value;
      } else if (control) {
        control.value = value;
      }
    }
    renderPreview();
  }

  form.addEventListener("change", () => {
    status.textContent = "";
    renderPreview();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await chrome.storage.sync.set(readForm());
    status.textContent = "Options saved.";
  });

  resetButton.addEventListener("click", async () => {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    populateForm(DEFAULT_SETTINGS);
    status.textContent = "Defaults restored.";
  });

  chrome.storage.sync.get(SETTING_KEYS).then((stored) => {
    populateForm(normalizeSettings(stored));
  });
})();
