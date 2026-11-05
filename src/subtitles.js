(() => {
  // Shaka Player, which Dreaming uses, renders the current subtitle line in
  // this container only while the player's Settings > Subtitles is set to a
  // language; with Subtitles off the container is removed from the page. The
  // class comes from the Shaka library, not from Dreaming's generated names.
  const SUBTITLE_CONTAINER_SELECTOR = ".shaka-text-container";
  const ROOT_CLASS = "dt-subtitles";
  const REVEALED_CLASS = "dt-subtitles--revealed";
  const STYLE_CLASS_PREFIX = "dt-subtitles--style-";
  const MILLISECONDS_PER_SECOND = 1000;

  const { normalizeSettings } = globalThis.DreamingToolsSettings;
  const {
    isRevealKeyPress,
    isTypingTarget,
    nextRevealState,
  } = globalThis.DreamingSubtitlesCore;

  // The feature never edits the player. It only sets classes on <html>, and
  // subtitles.css styles the subtitle container through them, so a container
  // the player removes and re-creates is styled without observing the page.
  function createSubtitlesFeature({ root = document.documentElement, target = window } = {}) {
    let settings = null;
    let revealed = false;
    let autoHideTimer = null;
    let listening = false;

    function subtitlesShown() {
      return root.ownerDocument.querySelector(SUBTITLE_CONTAINER_SELECTOR) !== null;
    }

    function clearAutoHide() {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }

    function setRevealed(next) {
      revealed = next;
      root.classList.toggle(REVEALED_CLASS, revealed);
      clearAutoHide();
      if (revealed && settings.revealMode === "toggle" && settings.revealAutoHide > 0) {
        autoHideTimer = setTimeout(
          () => setRevealed(nextRevealState(revealed, "timeout", settings)),
          settings.revealAutoHide * MILLISECONDS_PER_SECOND,
        );
      }
    }

    // Listeners run in the capture phase on window, before the player's own
    // handlers, so a handled reveal key can be kept from the player.
    function onKeyDown(event) {
      if (!isRevealKeyPress(event, settings.revealKey) || isTypingTarget(event.target) || !subtitlesShown()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        setRevealed(nextRevealState(revealed, "press", settings));
      }
    }

    function onKeyUp(event) {
      if (event.code !== settings.revealKey) {
        return;
      }

      // Release even if the player's subtitles were turned off while held.
      if (subtitlesShown()) {
        event.preventDefault();
        event.stopPropagation();
      }
      setRevealed(nextRevealState(revealed, "release", settings));
    }

    function onBlur() {
      setRevealed(nextRevealState(revealed, "blur", settings));
    }

    function setStyleClass(style) {
      for (const name of [...root.classList]) {
        if (name.startsWith(STYLE_CLASS_PREFIX)) {
          root.classList.remove(name);
        }
      }
      root.classList.add(`${STYLE_CLASS_PREFIX}${style}`);
    }

    function start() {
      root.classList.add(ROOT_CLASS);
      target.addEventListener("keydown", onKeyDown, true);
      target.addEventListener("keyup", onKeyUp, true);
      target.addEventListener("blur", onBlur);
      listening = true;
    }

    function stop() {
      target.removeEventListener("keydown", onKeyDown, true);
      target.removeEventListener("keyup", onKeyUp, true);
      target.removeEventListener("blur", onBlur);
      listening = false;
      clearAutoHide();
      revealed = false;
      for (const name of [...root.classList]) {
        if (name.startsWith(ROOT_CLASS)) {
          root.classList.remove(name);
        }
      }
    }

    function revealSettingsChanged(previous, next) {
      return ["revealMode", "revealKey", "revealAutoHide"].some((key) => previous[key] !== next[key]);
    }

    function update(nextSettings) {
      const previous = settings;
      settings = normalizeSettings(nextSettings);
      if (!settings.subtitlesEnabled) {
        stop();
        return;
      }

      if (!listening) {
        start();
      }
      setStyleClass(settings.subtitleStyle);
      if (previous && revealSettingsChanged(previous, settings)) {
        setRevealed(false);
      }
    }

    return { name: "subtitles", update };
  }

  globalThis.DreamingSubtitlesFeature = { createSubtitlesFeature };
})();
