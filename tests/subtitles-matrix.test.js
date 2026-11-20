// @vitest-environment jsdom

// Every combination of the reveal settings, driven by realistic key-tap
// sequences against a simulated playing video, some with slow seeks, pauses,
// seeks made with the player's own controls, a new episode, or a lost key
// release. Instead of a hand-written expected result per cell, each run is
// checked against rules that must hold in every cell. Set MATRIX_REPORT=<file>
// to also write a readable table of what each sequence does with a 3-second
// jump.

import { writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/settings.js";
import "../src/subtitles-core.js";
import "../src/subtitles.js";

const { DEFAULT_SETTINGS } = globalThis.DreamingToolsSettings;
const { createSubtitlesFeature } = globalThis.DreamingSubtitlesFeature;

const MODES = ["hold", "toggle"];
const JUMPS = [0, 1, 2, 3, 5, 10];
const AUTO_HIDES = [0, "caught-up", 3, 5, 10];
const TAP_COUNTS = [1, 2, 3, 5];
const TAP_INTERVALS_MS = [150, 400, 750, 1000];
const TAP_HOLD_MS = 80;
const RANDOM_SEQUENCES = 20;
const RANDOM_MIN_INTERVAL_MS = 50;
const RANDOM_MAX_INTERVAL_MS = 450;
const START_TIME_S = 40;
const NEAR_START_TIME_S = 4;
// Simulated player: plays at 1x, a seek takes SEEK_MS unless a sequence sets
// a slower one, timeupdate every TICK_MS.
const SEEK_MS = 120;
const TICK_MS = 250;
// After the last key, how long playback runs while waiting for an auto-hide:
// enough to replay five 10-second jumps plus the longest auto-hide.
const TAIL_MS = 60000;
const SAMPLE_MS = 50;
const KEY_REPEAT_MS = 33;
const TIME_EPSILON = 1e-6;

const SUBTITLES_ON = `
  <div class="ds-shaka-player">
    <video></video>
    <div class="shaka-text-container"><div><span>Vamos a poner el litro de agua en la olla.</span></div></div>
  </div>
`;

const revealed = () => document.documentElement.classList.contains("dt-subtitles--revealed");

function key(type, init = {}) {
  document.body.dispatchEvent(new KeyboardEvent(type, { code: "KeyS", bubbles: true, cancelable: true, ...init }));
}

// A video that plays while not paused or seeking. As in real media elements,
// a seek is asynchronous but currentTime reports its target at once, and a
// new seek replaces one in flight. Setting currentTime is the extension's
// seek (recorded); the player's own controls seek through seekTo.
function simulatedPlayer(video, start, seekMs) {
  let time = start;
  let seeking = false;
  let paused = false;
  let pendingSeek = null;
  const seeks = [];
  function seek(to) {
    time = to;
    seeking = true;
    video.dispatchEvent(new Event("seeking"));
    clearTimeout(pendingSeek);
    pendingSeek = setTimeout(() => {
      seeking = false;
      video.dispatchEvent(new Event("seeked"));
    }, seekMs);
  }
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => time,
    set: (value) => {
      seeks.push({ at: Date.now(), from: time, to: value });
      seek(value);
    },
  });
  Object.defineProperty(video, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(video, "seeking", { configurable: true, get: () => seeking });
  const ticker = setInterval(() => {
    if (!seeking && !paused) {
      time += TICK_MS / 1000;
      video.dispatchEvent(new Event("timeupdate"));
    }
  }, TICK_MS);
  return {
    get time() { return time; },
    seeks,
    seekTo: seek,
    pause() { paused = true; video.dispatchEvent(new Event("timeupdate")); },
    play() { paused = false; },
    // The next episode loads into the same element.
    newEpisode(at) {
      video.dispatchEvent(new Event("emptied"));
      time = at;
      video.dispatchEvent(new Event("timeupdate"));
    },
    stop() { clearInterval(ticker); clearTimeout(pendingSeek); },
  };
}

// A sequence is a list of steps at { at } ms from the start: a tap, held for
// holdMs, or a player action. "fresh repeats" models keyboards that
// auto-repeat without the repeat flag; lostKeyup models S released while Cmd
// is down on macOS, which sends no keyup until Cmd is released. Each entry
// names the reveal its auto-hide should count from: the furthest press (taps
// back from one point) or the last one (after leaving the earlier range).
function taps(count, intervalMs) {
  return Array.from({ length: count }, (_, index) => ({ at: index * intervalMs, holdMs: Math.min(TAP_HOLD_MS, intervalMs / 2) }));
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomSequences() {
  const random = seededRandom(20261120);
  return Array.from({ length: RANDOM_SEQUENCES }, (_, index) => {
    const count = 2 + Math.floor(random() * 5);
    let at = 0;
    const sequence = [];
    for (let tap = 0; tap < count; tap += 1) {
      const interval = RANDOM_MIN_INTERVAL_MS + Math.floor(random() * (RANDOM_MAX_INTERVAL_MS - RANDOM_MIN_INTERVAL_MS));
      sequence.push({ at, holdMs: Math.min(TAP_HOLD_MS, interval / 2) });
      at += interval;
    }
    return { name: `random #${index + 1} (${count} taps)`, sequence, start: index % 2 ? NEAR_START_TIME_S : START_TIME_S };
  });
}

const tapAt = (at) => ({ at, holdMs: TAP_HOLD_MS });
const CATCH_UP_MS = 13000;

const SEQUENCES = [
  ...TAP_COUNTS.flatMap((count) => TAP_INTERVALS_MS.map((interval) => ({
    name: count === 1 ? "1 tap" : `${count} taps, ${interval} ms apart`,
    sequence: taps(count, interval),
  }))).filter((entry, index, all) => all.findIndex((other) => other.name === entry.name) === index),
  { name: "held 2 s (auto-repeat)", sequence: [{ at: 0, holdMs: 2000, repeat: true }] },
  { name: "held 2 s (fresh repeats)", sequence: [{ at: 0, holdMs: 2000, freshRepeat: true }] },
  { name: "3 taps 100 ms apart, slow seeks (600 ms)", sequence: taps(3, 100), seekMs: 600 },
  { name: "5 taps 150 ms apart, slow seeks (800 ms)", sequence: taps(5, 150), seekMs: 800 },
  { name: "held 2 s, then 2 quick taps", sequence: [{ at: 0, holdMs: 2000, repeat: true }, tapAt(2200), tapAt(2400)] },
  { name: "tap, pause 2 s, 2 taps", sequence: [tapAt(0), { at: 200, action: "pause" }, { at: 2200, action: "play" }, tapAt(2300), tapAt(2500)] },
  { name: "player rewinds 5 s, tap during its seek", sequence: [{ at: 0, action: "seekBy", by: -5 }, tapAt(50)], anchor: "last" },
  { name: "tap, catch up, player rewinds into the old range, tap", sequence: [tapAt(0), { at: CATCH_UP_MS, action: "seekTo", to: START_TIME_S - 2 }, tapAt(CATCH_UP_MS + 100)], anchor: "last" },
  { name: "tap, next episode loads, tap in the old range", sequence: [tapAt(0), { at: 500, action: "newEpisode", to: START_TIME_S - 2 }, tapAt(600)], anchor: "last" },
  { name: "S released while Cmd is down, then a tap", sequence: [{ at: 0, holdMs: TAP_HOLD_MS, lostKeyup: true }, tapAt(300)] },
  ...randomSequences(),
].map((entry) => ({ start: START_TIME_S, seekMs: SEEK_MS, anchor: "furthest", ...entry }));

function runAction(player, step) {
  switch (step.action) {
    case "pause":
      player.pause();
      break;
    case "play":
      player.play();
      break;
    case "seekBy":
      player.seekTo(player.time + step.by);
      break;
    case "seekTo":
      player.seekTo(step.to);
      break;
    case "newEpisode":
      player.newEpisode(step.to);
      break;
    default:
      throw new Error(`unknown action ${step.action}`);
  }
}

function run(settings, { sequence, start, seekMs }) {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  document.body.innerHTML = SUBTITLES_ON;
  const player = simulatedPlayer(document.querySelector("video"), start, seekMs);
  const feature = createSubtitlesFeature();
  feature.update({ ...DEFAULT_SETTINGS, subtitlesEnabled: true, ...settings });
  const presses = [];
  const releases = [];
  let elapsed = 0;
  for (const tap of sequence) {
    vi.advanceTimersByTime(tap.at - elapsed);
    if (tap.action) {
      runAction(player, tap);
      elapsed = tap.at;
      continue;
    }
    const before = revealed();
    const time = player.time;
    key("keydown");
    presses.push({ at: Date.now(), time, before, after: revealed() });
    if (tap.repeat || tap.freshRepeat) {
      for (let held = KEY_REPEAT_MS; held < tap.holdMs; held += KEY_REPEAT_MS) {
        vi.advanceTimersByTime(KEY_REPEAT_MS);
        key("keydown", { repeat: Boolean(tap.repeat) });
      }
      vi.advanceTimersByTime(tap.holdMs % KEY_REPEAT_MS || KEY_REPEAT_MS);
    } else {
      vi.advanceTimersByTime(tap.holdMs);
    }
    if (tap.lostKeyup) {
      key("keydown", { code: "MetaLeft", key: "Meta", metaKey: true });
      key("keyup", { code: "MetaLeft", key: "Meta" });
    } else {
      key("keyup");
      releases.push({ after: revealed() });
    }
    elapsed = tap.at + tap.holdMs;
  }
  const revealedAtEnd = revealed();
  let hiddenAfterMs = revealedAtEnd ? null : 0;
  let timeWhenHidden = revealedAtEnd ? null : player.time;
  for (let waited = SAMPLE_MS; revealedAtEnd && waited <= TAIL_MS; waited += SAMPLE_MS) {
    vi.advanceTimersByTime(SAMPLE_MS);
    if (!revealed()) {
      hiddenAfterMs = waited;
      timeWhenHidden = player.time;
      break;
    }
  }
  feature.update({ ...DEFAULT_SETTINGS, subtitlesEnabled: false });
  player.stop();
  vi.useRealTimers();
  return { presses, releases, seeks: player.seeks, revealedAtEnd, hiddenAfterMs, timeWhenHidden };
}

const CONFIGS = MODES.flatMap((revealMode) => JUMPS.flatMap((revealJumpBack) => AUTO_HIDES.map((revealAutoHide) => (
  { revealMode, revealJumpBack, revealAutoHide }
))));

const label = ({ revealMode, revealJumpBack, revealAutoHide }) =>
  `${revealMode}, jump ${revealJumpBack || "off"}, auto-hide ${revealAutoHide || "off"}`;

afterEach(() => {
  vi.useRealTimers();
});

describe.each(CONFIGS)("reveal matrix: %s", (config) => {
  const name = label(config);
  const results = SEQUENCES.map((entry) => ({ entry, result: run(config, entry) }));

  it(`${name}: the video only ever moves back, by the jump amount, once per reveal`, () => {
    for (const { entry, result } of results) {
      if (config.revealJumpBack === 0) {
        expect(result.seeks, entry.name).toEqual([]);
        continue;
      }
      for (const seek of result.seeks) {
        expect(seek.to, entry.name).toBeLessThan(seek.from);
        expect(seek.from - seek.to, entry.name).toBeCloseTo(Math.min(config.revealJumpBack, seek.from), 6);
      }
      const reveals = result.presses.filter((press) => !press.before && press.after);
      expect(result.seeks.length, entry.name).toBeLessThanOrEqual(reveals.length);
    }
  });

  // Tap speed never decides the distance, even with seeks still in flight.
  it(`${name}: every reveal jumps unless the video is at 0`, () => {
    for (const { entry, result } of results) {
      if (config.revealJumpBack === 0) {
        continue;
      }
      for (const press of result.presses.filter((candidate) => !candidate.before && candidate.after)) {
        if (press.time > 0) {
          expect(result.seeks.some((seek) => seek.at === press.at), `${entry.name} at ${press.at} ms`).toBe(true);
        }
      }
    }
  });

  if (config.revealMode === "hold") {
    it(`${name}: shows while the key is held and hides on release`, () => {
      for (const { entry, result } of results) {
        result.presses.forEach((press) => expect(press.after, entry.name).toBe(true));
        result.releases.forEach((release) => expect(release.after, entry.name).toBe(false));
        expect(result.revealedAtEnd, entry.name).toBe(false);
      }
    });

    it(`${name}: behaves the same whatever the auto-hide setting`, () => {
      const offResults = SEQUENCES.map((entry) => run({ ...config, revealAutoHide: 0 }, entry));
      results.forEach(({ entry, result }, index) => {
        expect(result, entry.name).toEqual(offResults[index]);
      });
    });
  } else {
    it(`${name}: each separate press flips the subtitles`, () => {
      for (const { entry, result } of results) {
        result.presses.forEach((press) => expect(press.after, entry.name).toBe(!press.before));
      }
    });

    const autoHideActive = config.revealAutoHide !== 0
      && !(config.revealAutoHide === "caught-up" && config.revealJumpBack === 0);
    if (autoHideActive) {
      it(`${name}: a reveal left on screen hides by itself as playback continues`, () => {
        const stuck = results.filter(({ result }) => result.revealedAtEnd && result.hiddenAfterMs === null);
        expect(stuck.map(({ entry }) => entry.name)).toEqual([]);
      });

      // Several taps back are one series, so the text stays up past the
      // furthest point any reveal was pressed at (where the learner started),
      // not just the last reveal; after leaving that range (a new episode, a
      // rewind after catching up), the last reveal starts afresh. It hides
      // within a tick of that point.
      it(`${name}: hides once playback passes where the taps started, not before`, () => {
        for (const { entry, result } of results) {
          if (!result.revealedAtEnd || result.hiddenAfterMs === null) {
            continue;
          }
          const reveals = result.presses.filter((press) => !press.before && press.after).map((press) => press.time);
          const anchor = entry.anchor === "last" ? reveals.at(-1) : Math.max(...reveals);
          const extra = config.revealAutoHide === "caught-up" ? 0 : config.revealAutoHide;
          expect(result.timeWhenHidden + TIME_EPSILON, entry.name).toBeGreaterThanOrEqual(anchor + extra);
          expect(result.timeWhenHidden, entry.name).toBeLessThan(anchor + extra + TICK_MS / 1000 + TIME_EPSILON);
        }
      });
    } else {
      it(`${name}: a reveal left on screen stays until the next press`, () => {
        for (const { entry, result } of results) {
          if (result.revealedAtEnd) {
            expect(result.hiddenAfterMs, entry.name).toBeNull();
          }
        }
      });
    }
  }
});

const REPORT_PATH = process.env.MATRIX_REPORT;
describe.runIf(REPORT_PATH)("reveal matrix report", () => {
  it("writes what each tap sequence does with a 3-second jump", () => {
    const lines = ["# Reveal matrix, jump back 3 s", "",
      `Simulated video playing from ${START_TIME_S} s (random sequences alternate with ${NEAR_START_TIME_S} s); a seek takes ${SEEK_MS} ms unless the sequence says otherwise; taps are held ${TAP_HOLD_MS} ms.`, ""];
    for (const revealMode of MODES) {
      for (const revealAutoHide of revealMode === "hold" ? [0] : AUTO_HIDES) {
        const config = { revealMode, revealJumpBack: 3, revealAutoHide };
        lines.push(`## ${revealMode}${revealMode === "toggle" ? `, auto-hide ${revealAutoHide || "off"}` : ""}`, "",
          "| Sequence | Jumps | Moved back | Starts at | Shown after last key | Hides after |",
          "|---|---|---|---|---|---|");
        for (const entry of SEQUENCES) {
          const result = run(config, entry);
          const moved = result.seeks.reduce((sum, seek) => sum + seek.from - seek.to, 0);
          const hides = !result.revealedAtEnd ? "–" : result.hiddenAfterMs === null ? "**never**" : `${(result.hiddenAfterMs / 1000).toFixed(2)} s, at ${result.timeWhenHidden.toFixed(2)} s`;
          lines.push(`| ${entry.name} | ${result.seeks.length} | ${moved.toFixed(1)} s | from ${entry.start} s | ${result.revealedAtEnd ? "yes" : "no"} | ${hides} |`);
        }
        lines.push("");
      }
    }
    writeFileSync(REPORT_PATH, lines.join("\n"));
  });
});
