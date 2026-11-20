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
  // HTMLMediaElement.HAVE_METADATA: before this, the video has no duration
  // and a seek may be overridden by the player's start position.
  const HAVE_METADATA = 1;
  const PLAYBACK_EVENTS = ["timeupdate", "seeked"];
  const VIDEO_GONE_EVENTS = ["ended", "emptied"];

  const { normalizeSettings } = globalThis.DreamingToolsSettings;
  const {
    autoHidePoint,
    isJumpGuarded,
    isRevealKeyPress,
    isTypingTarget,
    jumpTarget,
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
    // While a video's ancestor matches this (a YouTube ad), a reveal does not
    // move the video, which would then be the ad.
    jumpBlockedSelector = null,
    forwardTargets = () => [],
    forwardOrigin = null,
    acceptOrigin = null,
  } = {}) {
    let settings = null;
    let revealed = false;
    let autoHideTimer = null;
    let listening = false;
    // While revealed: the video being watched, and the playback time at
    // which a toggle reveal hides again (null for none).
    let watchedVideo = null;
    let hideAt = null;
    let lastJumpAt = null;

    function subtitlesShown() {
      return root.ownerDocument.querySelector(shownSelector) !== null;
    }

    // The video of the player whose subtitles are shown: the nearest one
    // around the subtitle container, so another video on the page is never
    // moved. Looked up on each press, because players replace the element.
    function findVideo() {
      for (let node = root.ownerDocument.querySelector(shownSelector)?.parentElement; node; node = node.parentElement) {
        const video = node.querySelector("video");
        if (video) {
          return video;
        }
      }
      return null;
    }

    // Moves the video back by the jump-back setting and returns how far it
    // moved, or 0 when it could not or should not move.
    function jumpBack(video) {
      const now = Date.now();
      if (settings.revealJumpBack === 0 || video.readyState < HAVE_METADATA || video.seeking
        || (jumpBlockedSelector && video.closest(jumpBlockedSelector)) || isJumpGuarded(lastJumpAt, now)) {
        return 0;
      }
      const from = video.currentTime;
      const to = jumpTarget(from, settings.revealJumpBack);
      if (to >= from) {
        return 0;
      }
      video.currentTime = to;
      lastJumpAt = now;
      return from - to;
    }

    function onPlaybackTime() {
      if (hideAt !== null && watchedVideo.currentTime >= hideAt) {
        applyEvent("timeout");
      }
    }

    function onVideoGone() {
      setRevealed(false);
    }

    function watch(video, point) {
      watchedVideo = video;
      hideAt = point;
      for (const type of PLAYBACK_EVENTS) {
        video.addEventListener(type, onPlaybackTime);
      }
      for (const type of VIDEO_GONE_EVENTS) {
        video.addEventListener(type, onVideoGone);
      }
    }

    function unwatch() {
      if (!watchedVideo) {
        return;
      }
      for (const type of PLAYBACK_EVENTS) {
        watchedVideo.removeEventListener(type, onPlaybackTime);
      }
      for (const type of VIDEO_GONE_EVENTS) {
        watchedVideo.removeEventListener(type, onVideoGone);
      }
      watchedVideo = null;
      hideAt = null;
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

    // A reveal with a video watches it: auto-hide follows playback time,
    // and the video ending or being replaced hides. Without a video, a
    // numeric auto-hide falls back to a timer.
    function setRevealed(next, { video = null, pressTime = 0, jumped = 0 } = {}) {
      revealed = next;
      root.classList.toggle(REVEALED_CLASS, revealed);
      clearAutoHide();
      unwatch();
      if (!revealed) {
        return;
      }
      if (video) {
        watch(video, autoHidePoint(settings, pressTime, jumped));
      } else if (settings.revealMode === "toggle" && typeof settings.revealAutoHide === "number"
        && settings.revealAutoHide > 0) {
        autoHideTimer = setTimeout(
          () => applyEvent("timeout"),
          settings.revealAutoHide * MILLISECONDS_PER_SECOND,
        );
      }
    }

    // Only a press that reveals moves the video back; a press that hides,
    // a release, a timeout, or a blur never does.
    function onPress() {
      const next = nextRevealState(revealed, "press", settings);
      if (next === revealed) {
        return;
      }
      const video = next ? findVideo() : null;
      if (!video) {
        setRevealed(next);
        return;
      }
      const pressTime = video.currentTime;
      const jumped = jumpBack(video);
      setRevealed(true, { video, pressTime, jumped });
    }

    // Releases, blurs, and timeouts change the state only when it changes:
    // a Toggle release leaves the reveal, and its auto-hide, as they are.
    function applyEvent(event) {
      const next = nextRevealState(revealed, event, settings);
      if (next !== revealed) {
        setRevealed(next);
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
          onPress();
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
      applyEvent("release");
    }

    function onBlur() {
      forward(frameTargets(), "blur");
      applyEvent("blur");
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

      if (data.event === "press") {
        onPress();
        return;
      }
      applyEvent(data.event);
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
      unwatch();
      revealed = false;
      for (const name of [...root.classList]) {
        if (name.startsWith(ROOT_CLASS)) {
          root.classList.remove(name);
        }
      }
    }

    function revealSettingsChanged(previous, next) {
      return ["revealMode", "revealKey", "revealAutoHide", "revealJumpBack"].some((key) => previous[key] !== next[key]);
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
