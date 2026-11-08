// Spike, not a gate: shows how the pinned videos behave under automation, as
// groundwork for the logged-in subtitle tests. Each test records what it
// observed as annotations; it fails only if a step it depends on fails.
// Run with `npm run test:live:spike` (add HEADED=1 for a visible browser).
//
// Findings (2026-11-07, headless Chromium) are in docs/TESTING.md.
import { test, expect, LOGIN_GATE_TEXT } from "./fixtures.js";
import { DREAMING_PLAYER_VIDEO, YOUTUBE_SERVED_VIDEO } from "./videos.js";

const CAPTION_WAIT_MS = 6_000;
const GLIDE_SAMPLES = 20;
const GLIDE_SAMPLE_INTERVAL_MS = 25;
const headedLabel = process.env.HEADED ? "headed" : "headless";

test.beforeEach(async ({ setSettings }) => {
  await setSettings({ subtitlesEnabled: true, subtitleStyle: "blur", revealMode: "hold", revealKey: "KeyS" });
});

async function openWatchPage(context, video) {
  const page = await context.newPage();
  await page.goto(video.url);
  await page.waitForTimeout(5_000);
  if (await page.getByText(LOGIN_GATE_TEXT).count()) {
    test.skip(true, "The test profile is not logged in; run `npm run test:live:login`");
  }
  return page;
}

const record = (testInfo, type, value) => testInfo.annotations.push({
  type,
  description: typeof value === "string" ? value : JSON.stringify(value),
});

test(`@spike Dreaming player: play, choose Spanish subtitles, blur, reveal, glide (${headedLabel})`, async ({ context }, testInfo) => {
  const page = await openWatchPage(context, DREAMING_PLAYER_VIDEO);
  const video = page.locator("video").first();
  const box = await video.boundingBox();
  const state = () => page.evaluate(() => {
    const element = document.querySelector("video");
    const container = document.querySelector(".shaka-text-container");
    return {
      paused: element.paused,
      currentTime: Number(element.currentTime.toFixed(1)),
      revealed: document.documentElement.classList.contains("dt-subtitles--revealed"),
      captionText: container?.innerText.slice(0, 60) ?? null,
      filter: container ? getComputedStyle(container).filter : null,
      transition: container ? getComputedStyle(container).transition : null,
      bottom: container ? getComputedStyle(container).bottom : null,
    };
  });

  // Shaka's control overlay covers the video, so use its own buttons. The
  // subtitle choice is stored with the Dreaming account, not in the browser.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const play = page.getByRole("button", { name: "Play" });
  if (await play.count()) {
    await play.click({ force: true });
  }
  await page.getByRole("button", { name: "Video settings" }).click({ force: true });
  await page.locator(".ds-video-settings-menu__option", { hasText: "Spanish" }).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(CAPTION_WAIT_MS);

  const playing = await state();
  record(testInfo, "after Spanish", playing);
  expect(playing.paused).toBe(false);
  expect(playing.filter).toBe("blur(6px)");

  await page.keyboard.down("KeyS");
  await expect.poll(async () => (await state()).filter).toBe("none");
  record(testInfo, "S held", await state());
  await page.keyboard.up("KeyS");
  await expect.poll(async () => (await state()).filter).toBe("blur(6px)");

  // The controls appearing push the subtitle line up; with Dreaming's own
  // transition intact it passes through intermediate positions.
  const samples = [];
  for (let index = 0; index < GLIDE_SAMPLES; index += 1) {
    if (index === 3) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    }
    samples.push((await state()).bottom);
    await page.waitForTimeout(GLIDE_SAMPLE_INTERVAL_MS);
  }
  record(testInfo, "caption bottom while controls appear", samples.join(" "));
  expect(new Set(samples).size, "the line should pass through intermediate positions").toBeGreaterThan(2);
});

test(`@spike YouTube-served video: play, CC on with c, blur, reveal in frame (${headedLabel})`, async ({ context }, testInfo) => {
  const page = await openWatchPage(context, YOUTUBE_SERVED_VIDEO);
  const frameElement = page.locator('iframe[src*="youtube.com/embed"]');
  await expect(frameElement).toBeVisible();
  const frame = page.frames().find((candidate) => candidate.url().includes("youtube.com/embed"));
  const state = () => frame.evaluate(() => {
    const element = document.querySelector("video");
    const captions = document.querySelector(".ytp-caption-window-container");
    const ccButton = [...document.querySelectorAll("button")].find((button) => /subtitles\/cc/i.test(button.getAttribute("aria-label") ?? ""));
    return {
      paused: element?.paused,
      currentTime: Number(element?.currentTime.toFixed(1)),
      revealed: document.documentElement.classList.contains("dt-subtitles--revealed"),
      captionWindows: captions?.children.length ?? 0,
      captionText: captions?.innerText.slice(0, 60) ?? null,
      filter: captions?.firstElementChild ? getComputedStyle(captions.firstElementChild).filter : null,
      ccButton: ccButton?.getAttribute("aria-label") ?? null,
    };
  });
  record(testInfo, "on load", await state());

  // Dreaming autoplays the embed, and headless may pause it; a click in the
  // frame plays it and gives the frame keyboard focus. "c" is YouTube's own
  // captions shortcut.
  const box = await frameElement.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  if ((await state()).paused) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  if ((await state()).captionWindows === 0) {
    await page.keyboard.press("c");
  }
  await expect.poll(async () => (await state()).captionWindows, { timeout: CAPTION_WAIT_MS * 2 }).toBeGreaterThan(0);
  const captioned = await state();
  record(testInfo, "after CC on", captioned);
  expect(captioned.paused).toBe(false);
  expect(captioned.filter).toBe("blur(6px)");

  await page.keyboard.down("KeyS");
  await expect.poll(async () => (await state()).filter).toBe("none");
  record(testInfo, "S held in frame", await state());
  await page.keyboard.up("KeyS");
  await expect.poll(async () => (await state()).filter).toBe("blur(6px)");
});
