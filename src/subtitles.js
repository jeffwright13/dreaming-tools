(() => {
  // Shaka Player, which Dreaming uses, renders the current subtitle line in
  // this container only while the player's Settings > Subtitles is set to a
  // language; with Subtitles off the container is removed from the page. The
  // class comes from the Shaka library, not from Dreaming's generated names.
  const SHAKA_CONTAINER_SELECTOR = ".shaka-text-container";
  const MESSAGE_SOURCE = "dreaming-tools";
  const MESSAGE_TYPE = "subtitles-reveal";
  const REMOTE_EVENTS = new Set(["press", "release", "blur"]);
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
  //
  // YouTube-served videos draw captions inside a cross-origin YouTube frame,
  // where a second instance of this feature runs. Keys pressed while focus is
  // on the Dreaming page never reach that frame, so the Dreaming instance
  // forwards them (forwardTargets/forwardOrigin) and the frame instance
  // applies messages only from the Dreaming origin (acceptOrigin).
  function createSubtitlesFeature({
    root = document.documentElement,
    target = window,
    // Matches only while the player's own subtitles are on. Styling always
    // comes from subtitles.css; this decides whether a key press is handled.
    shownSelector = SHAKA_CONTAINER_SELECTOR,
    forwardTargets = () => [],
    forwardOrigin = null,
    acceptOrigin = null,
  } = {}) {
    let settings = null;
    let revealed = false;
    let autoHideTimer = null;
    let listening = false;

    function subtitlesShown() {
      return root.ownerDocument.querySelector(shownSelector) !== null;
    }

    function frameTargets() {
      return forwardOrigin ? forwardTargets() : [];
    }

    function forward(frames, event) {
      for (const frame of frames) {
        frame.postMessage({ source: MESSAGE_SOURCE, type: MESSAGE_TYPE, event }, forwardOrigin);
      }
    }

    function consume(event) {
      event.preventDefault();
      event.stopPropagation();
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

    // A press while the player shows no subtitles would flip the state
    // invisibly, so it only hides. Otherwise a Toggle reveal made before the
    // player's subtitles were turned off would still be in effect when they
    // are turned back on.
    function hideWithoutSubtitles() {
      if (revealed) {
        setRevealed(false);
      }
    }

    // Listeners run in the capture phase on window, before the player's own
    // handlers, so a handled reveal key can be kept from the player.
    function onKeyDown(event) {
      if (!isRevealKeyPress(event, settings.revealKey) || isTypingTarget(event.target)) {
        return;
      }

      if (subtitlesShown()) {
        consume(event);
        if (!event.repeat) {
          setRevealed(nextRevealState(revealed, "press", settings));
        }
        return;
      }

      // The key is not consumed here: with no subtitles on screen it belongs
      // to the page.
      hideWithoutSubtitles();

      // The caption state inside a YouTube frame is not visible from here, so
      // the key is forwarded whenever a YouTube player is present.
      const frames = frameTargets();
      if (frames.length > 0) {
        consume(event);
        if (!event.repeat) {
          forward(frames, "press");
        }
      }
    }

    function onKeyUp(event) {
      if (event.code !== settings.revealKey) {
        return;
      }

      // Release even if the player's subtitles were turned off while held,
      // or focus moved into a text field, but let a typed key's release
      // reach that field.
      const frames = frameTargets();
      if (!isTypingTarget(event.target) && (subtitlesShown() || frames.length > 0)) {
        consume(event);
      }
      forward(frames, "release");
      setRevealed(nextRevealState(revealed, "release", settings));
    }

    function onBlur() {
      forward(frameTargets(), "blur");
      setRevealed(nextRevealState(revealed, "blur", settings));
    }

    // Accepts any sender with the Dreaming origin, not only the parent window
    // (event.source is not checked). This is deliberate: a message can only
    // show or hide captions, and pinning the source would add frame-identity
    // bookkeeping for no meaningful protection.
    function onMessage(event) {
      const { data } = event;
      if (event.origin !== acceptOrigin || data?.source !== MESSAGE_SOURCE || data.type !== MESSAGE_TYPE
        || !REMOTE_EVENTS.has(data.event)) {
        return;
      }

      // Releases and blurs always apply so nothing stays revealed.
      if (data.event === "press" && !subtitlesShown()) {
        hideWithoutSubtitles();
        return;
      }

      setRevealed(nextRevealState(revealed, data.event, settings));
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
      if (acceptOrigin) {
        target.addEventListener("message", onMessage);
      }
      listening = true;
    }

    function stop() {
      target.removeEventListener("keydown", onKeyDown, true);
      target.removeEventListener("keyup", onKeyUp, true);
      target.removeEventListener("blur", onBlur);
      target.removeEventListener("message", onMessage);
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
