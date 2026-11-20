// Drive Dreaming's two players in the live suite. Worked out in the part 1
// spike; see docs/TESTING.md.
import { test, expect, LOGIN_GATE_TEXT } from "./fixtures.js";

// Computed values for each subtitle style, from src/subtitles.css. Revealed
// (or no extension style) means the player's own values.
export const STYLE_VALUES = Object.freeze({
  blur: { filter: "blur(6px)" },
  "small-faint": { opacity: "0.4", scale: "0.6" },
  hidden: { opacity: "0" },
  none: { filter: "none", opacity: "1", scale: "none" },
});

const DREAMING_SUBTITLE_OPTION = ".ds-video-settings-menu__option";
const ACTIVE_OPTION_CLASS = "ds-video-settings-menu__option--active";
const SUBTITLE_CHOICES = ["Off", "Spanish", "French", "English"];

export async function openWatchPage(context, video) {
  const page = await context.newPage();
  await page.goto(video.url);
  await page.waitForTimeout(4_000);
  if (await page.getByText(LOGIN_GATE_TEXT).count()) {
    test.skip(true, "The test profile is not logged in; run `npm run test:live:login`");
  }
  return page;
}

// Auto-hide counts playback time, so check it against the video's own clock
// on both sides: a buffering stall under load would fail a wall-clock wait.
// Expects the text still up just short of hideAt and gone just past it.
const BEFORE_HIDE_MARGIN_S = 0.8;
const AFTER_HIDE_MARGIN_S = 1;
const PLAYBACK_WAIT_MS = 30_000;
const HIDE_WAIT_MS = 1_000;
const CLOCK_POLL_MS = 100;

async function waitForPlayback(player, time) {
  await expect.poll(() => player.currentTime(), {
    timeout: PLAYBACK_WAIT_MS, intervals: [CLOCK_POLL_MS], message: `playback should reach ${time.toFixed(2)} s`,
  }).toBeGreaterThanOrEqual(time);
}

export async function expectHidesAtPlaybackTime(player, isRevealed, hideAt) {
  await waitForPlayback(player, hideAt - BEFORE_HIDE_MARGIN_S);
  expect(await isRevealed(), `still revealed just before the hide point (${hideAt.toFixed(2)} s)`).toBe(true);
  await waitForPlayback(player, hideAt + AFTER_HIDE_MARGIN_S);
  const passedAt = await player.currentTime();
  await expect.poll(isRevealed, {
    timeout: HIDE_WAIT_MS, message: `hidden once playback passed the hide point (${hideAt.toFixed(2)} s; at ${passedAt.toFixed(2)} s)`,
  }).toBe(false);
}

// Wait until the caption element's computed style settles on a style's values.
export async function expectStyle(readState, style) {
  await expect.poll(async () => {
    const caption = (await readState()).caption;
    return caption && Object.fromEntries(Object.keys(STYLE_VALUES[style]).map((key) => [key, caption[key]]));
  }, { message: `caption style should be ${style}` }).toEqual(STYLE_VALUES[style]);
}

export function dreamingPlayer(page) {
  const video = page.locator("video").first();
  const center = async () => {
    const box = await video.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  // Shaka's control overlay covers the video and hides after a moment, so
  // hover to show it and click its buttons with force.
  async function showControls() {
    const { x, y } = await center();
    await page.mouse.move(x, y);
    await page.mouse.move(x + 5, y + 5);
  }
  async function hideControls() {
    await page.mouse.move(0, 0);
  }

  const settingsMenu = page.locator('[data-testid="video-settings-menu"]');

  // The menu stays open after a choice, and the button toggles it, so check
  // its state before clicking.
  async function openSettings() {
    await showControls();
    if (!(await settingsMenu.isVisible())) {
      await page.getByRole("button", { name: "Video settings" }).click({ force: true });
    }
    await expect(settingsMenu.locator(DREAMING_SUBTITLE_OPTION).first()).toBeVisible();
  }

  async function closeSettings() {
    if (await settingsMenu.isVisible()) {
      await showControls();
      await page.getByRole("button", { name: "Video settings" }).click({ force: true });
    }
    await expect(settingsMenu).toBeHidden();
    await hideControls();
  }

  return {
    page,
    showControls,
    hideControls,

    async play() {
      await showControls();
      if (await video.evaluate((element) => element.paused)) {
        await page.getByRole("button", { name: "Play" }).click({ force: true });
      }
      await expect.poll(() => video.evaluate((element) => !element.paused)).toBe(true);
      await hideControls();
    },

    // Dreaming stores this choice with the account, not in the browser.
    async setSubtitles(choice) {
      await openSettings();
      await settingsMenu.locator(DREAMING_SUBTITLE_OPTION, { hasText: new RegExp(`^${choice}$`) }).click();
      await page.waitForTimeout(500);
      await closeSettings();
      if (choice === "Off") {
        await expect(page.locator(".shaka-text-container")).toHaveCount(0);
      } else {
        await expect(page.locator(".shaka-text-container")).toHaveCount(1);
      }
    },

    // Right after the page loads, the menu can briefly show the default
    // ("Off") before the player applies the account's choice. Read it only
    // once it agrees with whether the caption container exists.
    async currentSubtitleChoice() {
      let choice = null;
      await expect.poll(async () => {
        await openSettings();
        const active = await settingsMenu.locator(DREAMING_SUBTITLE_OPTION).evaluateAll((options, [activeClass, choices]) => options
          .filter((option) => option.classList.contains(activeClass) && choices.includes(option.textContent.trim()))
          .map((option) => option.textContent.trim()), [ACTIVE_OPTION_CLASS, SUBTITLE_CHOICES]);
        choice = active[0] ?? null;
        const containerShown = (await page.locator(".shaka-text-container").count()) > 0;
        return choice !== null && (choice !== "Off") === containerShown;
      }, { timeout: 15_000, message: "the subtitle menu should agree with the caption container" }).toBe(true);
      await closeSettings();
      return choice;
    },

    // Waits for the seek to finish: a reveal pressed mid-seek does not jump.
    async seek(seconds) {
      await video.evaluate((element, time) => { element.currentTime = time; }, seconds);
      await expect.poll(() => video.evaluate((element) => !element.seeking && element.readyState >= 1)).toBe(true);
    },

    currentTime() {
      return video.evaluate((element) => element.currentTime);
    },

    async pause() {
      await video.evaluate((element) => element.pause());
      await expect.poll(() => video.evaluate((element) => element.paused)).toBe(true);
    },

    state() {
      // Inlined rather than passed in: page scripts may not be allowed eval.
      return page.evaluate(() => {
        const readStyle = (element) => {
          if (!element) return null;
          const style = getComputedStyle(element);
          return { filter: style.filter, opacity: style.opacity, scale: style.scale, bottom: style.bottom };
        };
        const container = document.querySelector(".shaka-text-container");
        return {
          paused: document.querySelector("video")?.paused,
          revealed: document.documentElement.classList.contains("dt-subtitles--revealed"),
          caption: readStyle(container),
          rect: container ? container.getBoundingClientRect().toJSON() : null,
        };
      });
    },
  };
}

export function youtubePlayer(page) {
  const frameElement = page.locator('iframe[src*="youtube.com/embed"]');
  const frame = () => page.frames().find((candidate) => candidate.url().includes("youtube.com/embed"));

  async function frameCenter() {
    const box = await frameElement.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  const player = {
    page,
    frame,

    state() {
      return frame().evaluate(() => {
        const readStyle = (element) => {
          if (!element) return null;
          const style = getComputedStyle(element);
          return { filter: style.filter, opacity: style.opacity, scale: style.scale, bottom: style.bottom };
        };
        const captions = document.querySelector(".ytp-caption-window-container");
        const ccButton = [...document.querySelectorAll("button")]
          .find((button) => /subtitles\/cc/i.test(button.getAttribute("aria-label") ?? ""));
        return {
          paused: document.querySelector("video")?.paused,
          revealed: document.documentElement.classList.contains("dt-subtitles--revealed"),
          captionWindows: captions?.children.length ?? 0,
          caption: readStyle(captions?.firstElementChild),
          rect: captions?.firstElementChild ? captions.firstElementChild.getBoundingClientRect().toJSON() : null,
          ccOn: ccButton?.getAttribute("aria-label")?.includes("turned on") ?? null,
        };
      });
    },

    // Dreaming autoplays the embed; a click in the frame plays or pauses it
    // and gives the frame keyboard focus.
    async play() {
      await expect(frameElement).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => Boolean(frame())).toBe(true);
      const { x, y } = await frameCenter();
      await page.mouse.click(x, y);
      if ((await player.state()).paused) {
        await page.mouse.click(x, y);
      }
      await expect.poll(async () => (await player.state()).paused).toBe(false);
    },

    currentTime() {
      return frame().evaluate(() => document.querySelector("video.html5-main-video").currentTime);
    },

    async pause() {
      await frame().evaluate(() => document.querySelector("video.html5-main-video").pause());
      await expect.poll(async () => (await player.state()).paused).toBe(true);
    },

    // "c" is YouTube's own captions shortcut; it needs focus in the frame.
    async setCaptions(on) {
      if ((await player.state()).ccOn !== on) {
        await player.focusFrame();
        await page.keyboard.press("c");
      }
      await expect.poll(async () => (await player.state()).ccOn, { timeout: 15_000 }).toBe(on);
      if (on) {
        await expect.poll(async () => (await player.state()).captionWindows, { timeout: 15_000 }).toBeGreaterThan(0);
      }
    },

    // Focus moves into the frame on a click; the second click restores
    // playback if the first one paused it.
    async focusFrame() {
      await page.evaluate(() => document.querySelector('iframe[src*="youtube.com/embed"]').focus());
      await expect.poll(() => frame().evaluate(() => document.hasFocus())).toBe(true);
    },

    async focusPage() {
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.focus();
      });
      await page.locator("h1, h2").first().click({ force: true }).catch(() => {});
      await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
    },
  };
  return player;
}
