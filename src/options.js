(() => {
  const { DEFAULT_SETTINGS, normalizeSettings } = globalThis.DreamingDifficultyCore;
  const form = document.querySelector("#settings-form");
  const appearanceControls = document.querySelector("#appearance-controls");
  const previewBadge = document.querySelector("#preview-badge");
  const previewOriginal = document.querySelector("#preview-original");
  const status = document.querySelector("#status");

  function readForm() {
    return normalizeSettings(Object.fromEntries(new FormData(form)));
  }

  function renderPreview() {
    const settings = readForm();
    const original = settings.behavior === "original";
    appearanceControls.disabled = original;
    previewBadge.hidden = original;
    previewOriginal.hidden = !original;
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
      if (control instanceof RadioNodeList) {
        control.value = value;
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

  chrome.storage.sync.get(DEFAULT_SETTINGS).then((stored) => {
    populateForm(normalizeSettings(stored));
  });
})();
