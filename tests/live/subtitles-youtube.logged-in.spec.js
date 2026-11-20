// Subtitle de-emphasis on a YouTube-served video, logged in. YouTube's
// captions are turned on with its own "c" shortcut before each test; that
// choice belongs to the embed, not the Dreaming account.
import { test, expect } from "./fixtures.js";
import { expectHidesAtPlaybackTime, expectStyle, openWatchPage, youtubePlayer } from "./players.js";
import { YOUTUBE_SERVED_VIDEO } from "./routes.js";

const AFTER_TAP_SECONDS = 3;
const JUMP_BACK_SECONDS = 3;
// Every reveal setting is spelled out: setSettings merges into the persistent
// profile's storage, so one left out keeps another test's value.
const BASE_SETTINGS = {
  subtitlesEnabled: true, subtitleStyle: "blur", revealKey: "KeyS", revealAfterTap: "hide", revealJumpBack: 0,
};

let player;
test.beforeEach(async ({ context, setSettings }) => {
  await setSettings(BASE_SETTINGS);
  const page = await openWatchPage(context, YOUTUBE_SERVED_VIDEO);
  player = youtubePlayer(page);
  await player.play();
  await player.setCaptions(true);
});

const isRevealed = async () => (await player.state()).revealed;

for (const style of ["blur", "small-faint", "hidden"]) {
  test(`${style}: applies, and holding the reveal key in the player shows YouTube's own style`, async ({ setSettings }) => {
    await setSettings({ subtitleStyle: style });
    await expectStyle(player.state, style);

    await player.focusFrame();
    await player.page.keyboard.down("KeyS");
    await expectStyle(player.state, "none");
    await player.page.keyboard.up("KeyS");
    await expectStyle(player.state, style);
  });
}

test("with focus on the Dreaming page, the reveal key still reveals the captions", async () => {
  await player.focusPage();
  await player.page.keyboard.down("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await expectStyle(player.state, "none");
  await player.page.keyboard.up("KeyS");
  await expect.poll(isRevealed).toBe(false);
});

test(`a tap in the player with Show ${AFTER_TAP_SECONDS} s keeps the captions up until that far past the press`, async ({ setSettings }) => {
  await setSettings({ revealAfterTap: AFTER_TAP_SECONDS });
  await player.focusFrame();
  const pressedAt = await player.currentTime();
  await player.page.keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await expectHidesAtPlaybackTime(player, isRevealed, pressedAt + AFTER_TAP_SECONDS);
});

// The release is forwarded with how long the key was down, so the frame
// keeps a tap's reveal; then focus moves into the player, as a click on the
// video to pause does. The page does not forward that blur.
test("a forwarded tap keeps the captions up when focus moves into the player", async ({ setSettings }) => {
  await setSettings({ revealAfterTap: 10 });
  await player.focusPage();
  await player.page.keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await player.focusFrame();
  await player.page.waitForTimeout(500);
  expect(await isRevealed()).toBe(true);
});

// The press is made with focus on the Dreaming page, so it is forwarded:
// the frame, which owns the video, does the jump.
test("jump back: a forwarded reveal moves the YouTube video back by the setting", async ({ setSettings }) => {
  await setSettings({ revealJumpBack: JUMP_BACK_SECONDS });
  await player.page.waitForTimeout(2_000);
  await player.pause();
  const before = await player.currentTime();

  await player.focusPage();
  await player.page.keyboard.down("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await expect.poll(() => player.currentTime()).toBeCloseTo(before - JUMP_BACK_SECONDS, 1);
  expect((await player.state()).paused).toBe(true);
  await player.page.keyboard.up("KeyS");
  await expect.poll(isRevealed).toBe(false);
});

test("with YouTube's captions off, the reveal key shows nothing", async () => {
  // YouTube keeps its caption container mounted with CC off, so the frame may
  // still consume the key and set its revealed class; that is accepted in
  // SPEC.md because nothing becomes visible. Assert what the viewer sees.
  await player.setCaptions(false);
  await player.focusFrame();
  await player.page.keyboard.down("KeyS");
  await player.page.waitForTimeout(500);
  const during = await player.state();
  test.info().annotations.push({ type: "revealed class with CC off", description: String(during.revealed) });
  expect(during.captionWindows).toBe(0);
  await player.page.keyboard.up("KeyS");
  await expect.poll(isRevealed).toBe(false);
});

test("losing window focus on the Dreaming page hides a reveal in the player", async ({ setSettings }) => {
  // The page forwards its window blur to the frame. Headless has no second
  // window, so dispatch the page's blur event directly.
  await setSettings({ revealAfterTap: 10 });
  await player.focusPage();
  await player.page.keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await player.page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(isRevealed).toBe(false);
});

test("fullscreen: captions stay on screen above the controls and keep their style", async () => {
  await player.focusFrame();
  await player.page.keyboard.press("f"); // YouTube's fullscreen shortcut
  const entered = await expect.poll(() => player.frame().evaluate(() => Boolean(document.fullscreenElement)), { timeout: 3_000 })
    .toBe(true).then(() => true, () => false);
  test.skip(!entered, "This browser mode did not enter fullscreen; run with HEADED=1");

  const readLayout = () => player.frame().evaluate(() => {
    const caption = document.querySelector(".ytp-caption-window-container > *")?.getBoundingClientRect();
    const controls = document.querySelector(".ytp-chrome-bottom")?.getBoundingClientRect();
    return { caption: caption?.toJSON() ?? null, controlsTop: controls?.top ?? null, height: innerHeight };
  });
  await expect.poll(async () => (await readLayout()).caption !== null, { timeout: 15_000 }).toBe(true);
  const layout = await readLayout();
  test.info().annotations.push({ type: "fullscreen layout", description: JSON.stringify(layout) });
  expect(layout.caption.top).toBeGreaterThanOrEqual(0);
  expect(layout.caption.bottom).toBeLessThanOrEqual(layout.height);
  if (layout.controlsTop !== null) {
    expect(layout.caption.bottom).toBeLessThanOrEqual(layout.controlsTop + 1);
  }
  await expectStyle(player.state, "blur");
  await player.page.keyboard.press("Escape");
});
