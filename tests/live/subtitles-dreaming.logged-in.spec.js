// Subtitle de-emphasis on Dreaming's own (Shaka) player, logged in. The
// player's subtitles are set to Spanish before each test; account.teardown.js
// restores the account's original choice afterwards.
import { test, expect } from "./fixtures.js";
import { dreamingPlayer, expectStyle, openWatchPage } from "./players.js";
import { DREAMING_PLAYER_VIDEO } from "./routes.js";

const AUTO_HIDE_SECONDS = 3;
// A stretch of the pinned video with steady speech, so a subtitle line is on
// screen (checked 2026-11-09).
const SPOKEN_SECONDS = 40;
const GLIDE_SAMPLES = 20;
const GLIDE_SAMPLE_INTERVAL_MS = 25;
const BASE_SETTINGS = { subtitlesEnabled: true, subtitleStyle: "blur", revealMode: "hold", revealKey: "KeyS", revealAutoHide: 5 };

let player;
test.beforeEach(async ({ context, setSettings }) => {
  await setSettings(BASE_SETTINGS);
  const page = await openWatchPage(context, DREAMING_PLAYER_VIDEO);
  player = dreamingPlayer(page);
  await player.play();
  await player.setSubtitles("Spanish");
});

const isRevealed = async () => (await player.state()).revealed;

for (const style of ["blur", "small-faint", "hidden"]) {
  test(`${style}: applies, and holding the reveal key shows the player's own style`, async ({ setSettings }) => {
    await setSettings({ subtitleStyle: style });
    await expectStyle(player.state, style);

    await player.page.keyboard.down("KeyS");
    await expectStyle(player.state, "none");
    await player.page.keyboard.up("KeyS");
    await expectStyle(player.state, style);
  });
}

test("Hold: revealed only while the key is down, and key repeat does not toggle", async () => {
  const { keyboard } = player.page;
  await keyboard.down("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await keyboard.down("KeyS"); // repeat
  await player.page.waitForTimeout(300);
  expect(await isRevealed()).toBe(true);
  await keyboard.up("KeyS");
  await expect.poll(isRevealed).toBe(false);
});

test(`Toggle: a press reveals, a second hides, and auto-hide hides after ${AUTO_HIDE_SECONDS} s`, async ({ setSettings }) => {
  // page.clock would also freeze the player's own timers, so wait in real time.
  await setSettings({ revealMode: "toggle", revealAutoHide: AUTO_HIDE_SECONDS });
  const { keyboard } = player.page;
  await keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(false);

  await keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await player.page.waitForTimeout(AUTO_HIDE_SECONDS * 1_000 - 800);
  expect(await isRevealed(), "still revealed just before auto-hide").toBe(true);
  await expect.poll(isRevealed, { timeout: 3_000 }).toBe(false);
});

test("a Toggle reveal does not stay stranded when the player's subtitles are turned off", async ({ setSettings }) => {
  await setSettings({ revealMode: "toggle", revealAutoHide: 0 });
  await player.page.keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(true);

  await player.setSubtitles("Off");
  await player.page.keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(false);

  await player.setSubtitles("Spanish");
  await expectStyle(player.state, "blur");
});

test("with the player's subtitles off, the reveal key reveals nothing", async () => {
  await player.setSubtitles("Off");
  await player.page.keyboard.down("KeyS");
  await player.page.waitForTimeout(500);
  expect(await isRevealed()).toBe(false);
  await player.page.keyboard.up("KeyS");
});

test("losing window focus hides a Toggle reveal", async ({ setSettings }) => {
  // Headless has no second window to switch to; dispatching the window's
  // blur event exercises the same listener a real window switch triggers.
  await setSettings({ revealMode: "toggle", revealAutoHide: 0 });
  await player.page.keyboard.press("KeyS");
  await expect.poll(isRevealed).toBe(true);
  await player.page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(isRevealed).toBe(false);
});

test("the reveal key is ignored while typing in a comment box", async () => {
  const comments = player.page.locator("text=View comments >> visible=true");
  if (await comments.count()) {
    await comments.first().click();
  }
  const box = player.page.locator("textarea:visible, [contenteditable=true]:visible").first();
  // Free accounts cannot comment, so there may be no box at all.
  test.skip(!(await box.count()), "No comment box for this account (free accounts cannot comment)");

  await box.click();
  await player.page.keyboard.type("s");
  await player.page.waitForTimeout(300);
  expect(await isRevealed()).toBe(false);
  // Clear what was typed; never submit.
  await player.page.keyboard.press("ControlOrMeta+A");
  await player.page.keyboard.press("Backspace");
});

test("the subtitle line glides with the player controls (Dreaming's transition is kept)", async () => {
  await player.hideControls();
  await player.page.waitForTimeout(3_000);
  const samples = [];
  for (let index = 0; index < GLIDE_SAMPLES; index += 1) {
    if (index === 3) {
      await player.showControls();
    }
    samples.push((await player.state()).caption.bottom);
    await player.page.waitForTimeout(GLIDE_SAMPLE_INTERVAL_MS);
  }
  test.info().annotations.push({ type: "caption bottom", description: samples.join(" ") });
  expect(new Set(samples).size, `positions sampled: ${samples.join(" ")}`).toBeGreaterThan(2);
});

test("fullscreen: subtitles stay on screen above the controls and keep their style", async () => {
  await player.showControls();
  await player.page.getByRole("button", { name: "Full screen" }).click({ force: true });
  const entered = await expect.poll(() => player.page.evaluate(() => Boolean(document.fullscreenElement)), { timeout: 3_000 })
    .toBe(true).then(() => true, () => false);
  test.skip(!entered, "This browser mode did not enter fullscreen; run with HEADED=1");

  // Shaka's container covers the whole player, so measure the subtitle line
  // itself, once one is on screen.
  await player.seek(SPOKEN_SECONDS);
  const line = player.page.locator(".shaka-text-container span").filter({ hasText: /\S/ }).last();
  await expect(line).toBeVisible({ timeout: 20_000 });
  await player.showControls();
  // Dreaming moves the line up when the controls appear, after a 0.5 s delay
  // and a 0.1 s transition, so wait for it to settle above the controls bar.
  const readLayout = () => line.evaluate((element) => {
    const controls = document.querySelector(".shaka-bottom-controls")?.getBoundingClientRect();
    return { caption: element.getBoundingClientRect().toJSON(), controlsTop: controls?.top ?? null, height: innerHeight };
  });
  await expect.poll(async () => {
    const { caption, controlsTop } = await readLayout();
    return controlsTop === null || caption.bottom <= controlsTop + 1;
  }, { timeout: 3_000, message: "the subtitle line should settle above the controls" }).toBe(true);
  const layout = await readLayout();
  test.info().annotations.push({ type: "fullscreen layout", description: JSON.stringify(layout) });
  expect(layout.caption.top).toBeGreaterThanOrEqual(0);
  expect(layout.caption.bottom).toBeLessThanOrEqual(layout.height);
  await expectStyle(player.state, "blur");
  await player.page.keyboard.press("Escape");
});
