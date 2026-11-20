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
  // On macOS a key released while Cmd is down sends no keyup, so Cmd's own
  // release stands in for the reveal key's.
  const META_KEY = "Meta";
  const REVEAL_SETTINGS = ["revealKey", "revealAfterRelease", "revealJumpBack"];

  const { normalizeSettings } = globalThis.DreamingToolsSettings;
  const {
    continuesSeries,
    hidePoint,
    isRevealKeyPress,
    isTypingTarget,
    jumpTarget,
    releaseKeepsShown,
  } = globalThis.DreamingSubtitlesCore;

  // The feature never edits the player. It only sets classes on <html>, and
  // subtitles.css styles the subtitle container through them, so a container
  // the player removes and re-creates is styled without observing the page.
  //
  // A press jumps the video back (when Jump back is on) and shows the
  // subtitles while the key is down; the release follows the After releasing
  // setting, however long the key was down. See docs/SPEC.md.
  //
  // YouTube-served videos draw captions inside a cross-origin YouTube frame,
  // where a second instance of this feature runs. Keys pressed while focus is
  // on the Dreaming page never reach that frame, so the Dreaming instance
  // forwards them (forwardTargets/forwardOrigin), with how long the key was
  // down, and the frame instance applies messages only from the Dreaming
  // origin (acceptOrigin).
  function createSubtitlesFeature({
    root = document.documentElement,
    target = window,
    // Matches only while the player's own subtitles are on. Styling always
    // comes from subtitles.css; this decides whether a key press is handled.
    shownSelector = SHAKA_CONTAINER_SELECTOR,
    // While a video's ancestor matches this (a YouTube ad), a press does not
    // move the video, which would then be the ad.
    jumpBlockedSelector = null,
    forwardTargets = () => [],
    forwardOrigin = null,
    acceptOrigin = null,
  } = {}) {
    let settings = null;
    let revealed = false;
    let listening = false;
    // While shown: the video watched for the hide point, the hide point (a
    // playback time, or null), and whether it applies yet. It applies only
    // after the release: while the key is down the text always shows.
    let watchedVideo = null;
    let hideAt = null;
    let hideArmed = false;
    // A timed After releasing with no video to watch falls back to this.
    let fallbackTimer = null;
    // The current series of presses ({ video, anchor, floor }), kept across
    // hides so a few taps back count as one; see continuesSeries.
    let series = null;
    // Whether a press (a local keydown or a forwarded press) is waiting for
    // its release. A keydown while one is pending is not a new press: some
    // keyboards send auto-repeat without the repeat flag. A release with
    // none pending does nothing.
    let pressPending = false;
    // A blur waits one task before deciding whether to forward; see onBlur.
    let blurCheck = null;

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
    // moved, or 0 when it could not or should not move. A seek still in
    // flight is no reason to skip: currentTime already reports its target,
    // so quick taps add up, and setting it again replaces the pending seek.
    function jumpBack(video) {
      if (settings.revealJumpBack === 0 || video.readyState < HAVE_METADATA
        || (jumpBlockedSelector && video.closest(jumpBlockedSelector))) {
        return 0;
      }
      const from = video.currentTime;
      const to = jumpTarget(from, settings.revealJumpBack);
      if (to >= from) {
        return 0;
      }
      video.currentTime = to;
      return from - to;
    }

    // A series is watched while it lasts, hidden or not, so it ends as soon
    // as playback catches up or leaves its range (a seek with the player's
    // own controls), or the element loads another video. Otherwise a later
    // press could pick up a stale anchor.
    function onSeriesTime() {
      if (!continuesSeries(series, series.video.currentTime)) {
        endSeries();
      }
    }

    function endSeries() {
      if (!series) {
        return;
      }
      for (const type of PLAYBACK_EVENTS) {
        series.video.removeEventListener(type, onSeriesTime);
      }
      for (const type of VIDEO_GONE_EVENTS) {
        series.video.removeEventListener(type, endSeries);
      }
      series = null;
    }

    // Starts a series at this press, or extends the current one when the
    // press falls inside it, and returns it.
    function seriesFor(video, pressTime, landed) {
      if (series?.video === video && continuesSeries(series, pressTime)) {
        series.floor = Math.min(series.floor, landed);
        return series;
      }
      endSeries();
      series = { video, anchor: pressTime, floor: landed };
      for (const type of PLAYBACK_EVENTS) {
        video.addEventListener(type, onSeriesTime);
      }
      for (const type of VIDEO_GONE_EVENTS) {
        video.addEventListener(type, endSeries);
      }
      return series;
    }

    function onPlaybackTime() {
      if (hideArmed && hideAt !== null && watchedVideo.currentTime >= hideAt) {
        hide();
      }
    }

    function watch(video) {
      watchedVideo = video;
      for (const type of PLAYBACK_EVENTS) {
        video.addEventListener(type, onPlaybackTime);
      }
      for (const type of VIDEO_GONE_EVENTS) {
        video.addEventListener(type, hide);
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
        watchedVideo.removeEventListener(type, hide);
      }
      watchedVideo = null;
    }

    function clearFallbackTimer() {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    // Shows the subtitles; with a video, watches it for the hide point
    // (pending until the release) and for the video ending.
    function show(video, point) {
      revealed = true;
      root.classList.add(REVEALED_CLASS);
      clearFallbackTimer();
      unwatch();
      hideAt = point;
      hideArmed = false;
      if (video) {
        watch(video);
      }
    }

    function hide() {
      revealed = false;
      root.classList.remove(REVEALED_CLASS);
      clearFallbackTimer();
      unwatch();
      hideAt = null;
      hideArmed = false;
    }

    // Every press jumps back and shows, including one while a release keeps the
    // text up; a press inside the current series keeps its hide point.
    function onPress() {
      const video = findVideo();
      if (!video) {
        show(null, null);
        return;
      }
      const pressTime = video.currentTime;
      const landed = pressTime - jumpBack(video);
      const { anchor } = seriesFor(video, pressTime, landed);
      show(video, hidePoint(settings, anchor, landed));
    }

    // With Hide on release, the text hides on release. Otherwise it stays
    // up until its hide point, and hides at once if that has already passed.
    // With no video, a timed choice uses a timer and Show until caught up has
    // nothing to catch up to.
    function onRelease() {
      if (!revealed) {
        return;
      }
      if (!releaseKeepsShown(settings)) {
        hide();
        return;
      }
      if (watchedVideo && hideAt !== null) {
        hideArmed = true;
        onPlaybackTime();
        return;
      }
      if (typeof settings.revealAfterRelease === "number") {
        fallbackTimer = setTimeout(hide, settings.revealAfterRelease * MILLISECONDS_PER_SECOND);
        return;
      }
      hide();
    }

    // A press while the player shows no subtitles belongs to the page: it
    // does not jump, it hides a shown reveal, and it ends the series, so a
    // reveal kept up after a release does not reappear when subtitles come back.
    function hideWithoutSubtitles() {
      if (revealed) {
        hide();
      }
      endSeries();
    }

    function frameTargets() {
      return forwardOrigin ? forwardTargets() : [];
    }

    function forward(frames, data) {
      for (const frame of frames) {
        frame.postMessage({ source: MESSAGE_SOURCE, type: MESSAGE_TYPE, ...data }, forwardOrigin);
      }
    }

    // A click on the YouTube video (to pause, say) moves focus into its
    // frame, which blurs this page; the key's release, if any, now reaches
    // the frame directly, so the frame need not hide.
    function focusMovedInto(frames) {
      const focused = root.ownerDocument.activeElement;
      return frames.some((frame) => focused?.contentWindow === frame);
    }

    function consume(event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Listeners run in the capture phase on window, before the player's own
    // handlers, so a handled reveal key can be kept from the player.
    function onKeyDown(event) {
      if (!isRevealKeyPress(event, settings.revealKey) || isTypingTarget(event.target)) {
        return;
      }
      const newPress = !event.repeat && !pressPending;
      if (newPress) {
        pressPending = true;
      }

      if (subtitlesShown()) {
        consume(event);
        if (newPress) {
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
        if (newPress) {
          forward(frames, { event: "press" });
        }
      }
    }

    function release(frames) {
      pressPending = false;
      forward(frames, { event: "release" });
      onRelease();
    }

    function onKeyUp(event) {
      const frames = frameTargets();
      if (event.key === META_KEY) {
        if (pressPending) {
          release(frames);
        }
        return;
      }
      if (event.code !== settings.revealKey) {
        return;
      }

      // Consume the release even if the player's subtitles were turned off
      // while held, but let a typed key's release reach a text field.
      if (!isTypingTarget(event.target) && (subtitlesShown() || frames.length > 0)) {
        consume(event);
      }
      if (pressPending) {
        release(frames);
      }
    }

    function clearBlurCheck() {
      clearTimeout(blurCheck);
      blurCheck = null;
    }

    // The release may never arrive once the window loses focus. Whether
    // focus moved into the YouTube frame is decided one task later: Firefox
    // fires this blur while activeElement is still <body> and reports the
    // iframe only by the next task, where Chromium already reports it here.
    // A real window blur therefore reaches the frame one task late, while
    // its window is in the background.
    function onBlur() {
      pressPending = false;
      if (revealed) {
        hide();
      }
      const frames = frameTargets();
      if (frames.length === 0) {
        return;
      }
      clearBlurCheck();
      blurCheck = setTimeout(() => {
        blurCheck = null;
        if (!focusMovedInto(frames)) {
          forward(frames, { event: "blur" });
        }
      });
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

      if (data.event === "press") {
        if (!subtitlesShown()) {
          hideWithoutSubtitles();
          return;
        }
        pressPending = true;
        onPress();
        return;
      }

      if (data.event === "release") {
        if (pressPending) {
          pressPending = false;
          onRelease();
        }
        return;
      }

      pressPending = false;
      if (revealed) {
        hide();
      }
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
      clearBlurCheck();
      hide();
      endSeries();
      pressPending = false;
      for (const name of [...root.classList]) {
        if (name.startsWith(ROOT_CLASS)) {
          root.classList.remove(name);
        }
      }
    }

    function revealSettingsChanged(previous, next) {
      return REVEAL_SETTINGS.some((key) => previous[key] !== next[key]);
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
        pressPending = false;
        endSeries();
        hide();
      }
    }

    return { name: "subtitles", update };
  }

  globalThis.DreamingSubtitlesFeature = { createSubtitlesFeature };
})();
