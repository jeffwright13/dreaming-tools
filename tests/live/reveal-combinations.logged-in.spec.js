// Every combination of Jump back and After releasing the reveal key, on
// Dreaming's own player, with real key events from the browser: a tap, a
// 1.5 s hold with key auto-repeat, and three quick taps. An in-page recorder
// logs each key event and each show or hide with the video's time, and the
// checks read that log. Opt-in, because it plays several minutes of video:
//   npm run test:live:reveal
import { test, expect } from "./fixtures.js";
import { dreamingPlayer, openWatchPage } from "./players.js";
import { DREAMING_PLAYER_VIDEO } from "./routes.js";

const JUMPS = [0, 1, 2, 3, 5, 10];
const AFTER_RELEASES = ["hide", "caught-up", 3, 5, 10];
const START_SECONDS = 60;
const HOLD_MS = 1500;
const KEY_REPEAT_MS = 50;
const QUICK_TAP_GAP_MS = 150;
const TAPS = 3;
// A timeupdate arrives every 250 ms or so; a hide lands within that of its
// point. The jump is checked against the time read just before the press.
const HIDE_EARLY_S = 0.15;
const HIDE_LATE_S = 0.6;
const JUMP_TOLERANCE_S = 0.35;
const RELEASE_HIDE_MS = 150;
const SETTLE_MS = 1_000;
const BASE_SETTINGS = { subtitlesEnabled: true, subtitleStyle: "blur", revealKey: "KeyS" };

test.skip(!process.env.LIVE_REVEAL_COMBINATIONS, "Opt-in: run with npm run test:live:reveal");

// Installed in the page: logs key events and reveal changes with the video's
// current time, so the checks see what the learner would have seen.
function installRecorder() {
  const video = document.querySelector("video");
  const log = [];
  const now = () => performance.now();
  const revealed = () => document.documentElement.classList.contains("dt-subtitles--revealed");
  window.__revealLog = log;
  for (const type of ["keydown", "keyup"]) {
    window.addEventListener(type, (event) => {
      if (event.code === "KeyS") {
        log.push({ type, repeat: event.repeat, at: now(), time: video.currentTime });
      }
    }, true);
  }
  let last = revealed();
  new MutationObserver(() => {
    if (revealed() !== last) {
      last = revealed();
      log.push({ type: last ? "shown" : "hidden", at: now(), time: video.currentTime });
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

const keepsShown = (afterRelease, jump) => afterRelease !== "hide" && !(afterRelease === "caught-up" && jump === 0);
const extraSeconds = (afterRelease) => (typeof afterRelease === "number" ? afterRelease : 0);

for (const revealJumpBack of JUMPS) {
  for (const revealAfterRelease of AFTER_RELEASES) {
    test(`jump ${revealJumpBack || "off"}, after release ${revealAfterRelease}`, async ({ context, setSettings }) => {
      test.setTimeout(180_000);
      await setSettings({ ...BASE_SETTINGS, revealJumpBack, revealAfterRelease });
      const page = await openWatchPage(context, DREAMING_PLAYER_VIDEO);
      const player = dreamingPlayer(page);
      await player.play();
      await player.setSubtitles("Spanish");
      await page.evaluate(installRecorder);
      const readLog = () => page.evaluate(() => window.__revealLog.splice(0));
      const isRevealed = () => page.evaluate(() => document.documentElement.classList.contains("dt-subtitles--revealed"));
      const keeps = keepsShown(revealAfterRelease, revealJumpBack);
      const extra = extraSeconds(revealAfterRelease);
      const hideWaitMs = (TAPS * revealJumpBack + extra + 5) * 1_000;

      async function startAt(seconds) {
        await player.seek(seconds);
        await page.waitForTimeout(SETTLE_MS);
        await readLog();
      }

      // After the release, either hidden at once or kept until the hide
      // point, measured in playback time from the first press. A release
      // made after the point has passed (a long hold with a short jump)
      // hides at once.
      async function expectReleaseOutcome(log, anchor, label) {
        const lastUp = log.findLast((entry) => entry.type === "keyup");
        if (!keeps || lastUp.time >= anchor + extra) {
          await expect.poll(isRevealed, { message: `${label}: hidden on release` }).toBe(false);
          return;
        }
        expect(log.findLast((entry) => entry.type === "hidden" && entry.at > lastUp.at), `${label}: still shown after release`).toBeUndefined();
        await expect.poll(isRevealed, { timeout: hideWaitMs, message: `${label}: hides by itself` }).toBe(false);
        const hidden = (await readLog()).find((entry) => entry.type === "hidden");
        const hidePoint = anchor + extra;
        test.info().annotations.push({ type: label, description: `hid at ${hidden.time.toFixed(2)} s, point ${hidePoint.toFixed(2)} s` });
        expect(hidden.time, `${label}: not before the hide point`).toBeGreaterThanOrEqual(hidePoint - HIDE_EARLY_S);
        expect(hidden.time, `${label}: soon after the hide point`).toBeLessThanOrEqual(hidePoint + HIDE_LATE_S);
      }

      // A tap.
      await startAt(START_SECONDS);
      let before = await player.currentTime();
      await page.keyboard.press("KeyS");
      let log = await readLog();
      expect(log.some((entry) => entry.type === "shown"), "tap: shown").toBe(true);
      const tapUp = log.find((entry) => entry.type === "keyup");
      expect(Math.abs(tapUp.time - (before - revealJumpBack)), "tap: jump amount").toBeLessThanOrEqual(JUMP_TOLERANCE_S);
      await expectReleaseOutcome(log, before, "tap");

      // A hold: shown the whole time it is held, whatever the setting, then
      // the release follows the setting, as after a tap.
      await startAt(START_SECONDS);
      before = await player.currentTime();
      await page.keyboard.down("KeyS");
      for (let held = 0; held < HOLD_MS; held += KEY_REPEAT_MS) {
        await page.waitForTimeout(KEY_REPEAT_MS);
        await page.keyboard.down("KeyS"); // auto-repeat
      }
      expect(await isRevealed(), "hold: shown while held").toBe(true);
      await page.keyboard.up("KeyS");
      await page.waitForTimeout(RELEASE_HIDE_MS);
      log = await readLog();
      const holdDown = log.find((entry) => entry.type === "keydown" && !entry.repeat);
      const holdUp = log.find((entry) => entry.type === "keyup");
      expect(log.filter((entry) => entry.type === "hidden" && entry.at < holdUp.at), "hold: never hidden while held").toEqual([]);
      expect(Math.abs(holdDown.time - (before - revealJumpBack)), "hold: moved back once by the jump").toBeLessThanOrEqual(JUMP_TOLERANCE_S);
      expect(holdUp.at - holdDown.at, "hold: held long enough").toBeGreaterThanOrEqual(HOLD_MS);
      await expectReleaseOutcome(log, before, "hold");

      // Three quick taps: each moves back, and a kept reveal hides at the
      // first press's hide point.
      if (revealJumpBack > 0) {
        await startAt(START_SECONDS);
        before = await player.currentTime();
        for (let tap = 0; tap < TAPS; tap += 1) {
          await page.keyboard.press("KeyS");
          await page.waitForTimeout(QUICK_TAP_GAP_MS);
        }
        log = await readLog();
        const lastUp = log.findLast((entry) => entry.type === "keyup");
        const elapsedS = (lastUp.at - log.find((entry) => entry.type === "keydown").at) / 1000;
        expect(Math.abs(lastUp.time - (before - TAPS * revealJumpBack)), "taps: moved back once per tap")
          .toBeLessThanOrEqual(JUMP_TOLERANCE_S + elapsedS);
        await expectReleaseOutcome(log, before, "taps");
      }
    });
  }
}
