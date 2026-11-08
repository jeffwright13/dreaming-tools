// The options page in a real browser, with the packaged extension and a fresh
// profile, driven with trusted keyboard and mouse input.
import { test, expect } from "./fixtures.js";

const REVEALED = /dt-subtitles--revealed/;
const SHAKA_PREVIEW = "#subtitle-preview .shaka-text-container";
const YOUTUBE_PREVIEW = "#youtube-subtitle-preview .caption-window";

async function openOptions(context, optionsUrl, { clock = false } = {}) {
  const page = await context.newPage();
  if (clock) {
    await page.clock.install();
  }
  await page.goto(optionsUrl);
  return page;
}

// Switch subtitles on and move focus off the form, so the reveal key is not
// typed into a control.
async function enableSubtitles(page) {
  await page.getByLabel("Show difficulty badges").waitFor();
  await page.locator("[name=subtitlesEnabled]").check();
  await expect(page.locator("#status")).toHaveText("Saved.");
  await page.locator("h1").click();
}

// The YouTube preview fades over 120 ms, so poll until the filter settles.
const expectFilter = (page, selector, value) => expect.poll(
  () => page.locator(selector).evaluate((element) => getComputedStyle(element).filter),
).toBe(value);

test("opens by itself on first install with both tools off", async ({ context, optionsUrl, extension }) => {
  await expect.poll(() => context.pages().map((page) => page.url())).toContain(optionsUrl);
  const page = context.pages().find((candidate) => candidate.url() === optionsUrl);

  expect(await page.evaluate(() => chrome.runtime.getManifest().version)).toBe(extension.version);
  await expect(page.locator("[name=subtitlesEnabled]")).not.toBeChecked();
  await expect(page.locator("[name=difficultyEnabled]")).not.toBeChecked();
  // Playwright does not treat a disabled <fieldset> itself as disabled; check
  // a control inside it, which the fieldset disables.
  await expect(page.locator("[name=subtitleStyle]")).toBeDisabled();
  await expect(page.locator("button[type=submit]")).toHaveCount(0);
});

test("saves every change automatically and keeps it after a reload", async ({ context, optionsUrl, getSettings }) => {
  const page = await openOptions(context, optionsUrl);

  await page.locator("[name=subtitlesEnabled]").check();
  await expect(page.locator("#status")).toHaveText("Saved.");
  await page.locator("[name=difficultyEnabled]").check();
  await page.locator("[name=subtitleStyle]").selectOption("hidden");
  await expect.poll(getSettings).toMatchObject({ subtitlesEnabled: true, difficultyEnabled: true, subtitleStyle: "hidden" });

  await page.reload();
  await expect(page.locator("[name=subtitleStyle]")).toHaveValue("hidden");
  await expect(page.locator("[name=subtitlesEnabled]")).toBeChecked();
});

test("follows the system light and dark theme", async ({ context, optionsUrl }, testInfo) => {
  const page = await openOptions(context, optionsUrl);
  const colors = () => page.evaluate(() => ({
    page: getComputedStyle(document.body).backgroundColor,
    card: getComputedStyle(document.querySelector(".panel")).backgroundColor,
    text: getComputedStyle(document.body).color,
  }));

  await page.emulateMedia({ colorScheme: "light" });
  const light = await colors();
  await testInfo.attach("options-light", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await colors();
  await testInfo.attach("options-dark", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

  expect(dark.page).not.toBe(light.page);
  expect(dark.card).not.toBe(light.card);
  expect(dark.text).not.toBe(light.text);
});

test("Hold: the reveal key and a pressed preview reveal both previews", async ({ context, optionsUrl }) => {
  const page = await openOptions(context, optionsUrl);
  const html = page.locator("html");
  await enableSubtitles(page);

  await expectFilter(page, SHAKA_PREVIEW, "blur(6px)");
  await expectFilter(page, YOUTUBE_PREVIEW, "blur(6px)");

  await page.keyboard.down("KeyS");
  await expect(html).toHaveClass(REVEALED);
  await expectFilter(page, SHAKA_PREVIEW, "none");
  await expectFilter(page, YOUTUBE_PREVIEW, "none");
  await page.keyboard.down("KeyS"); // auto-repeat must not toggle
  await expect(html).toHaveClass(REVEALED);
  await page.keyboard.up("KeyS");
  await expect(html).not.toHaveClass(REVEALED);

  await page.locator("#youtube-subtitle-preview").hover();
  await page.mouse.down();
  await expect(html).toHaveClass(REVEALED);
  await page.mouse.up();
  await expect(html).not.toHaveClass(REVEALED);
});

test("Toggle: presses and clicks toggle, and auto-hide applies", async ({ context, optionsUrl }) => {
  const page = await openOptions(context, optionsUrl, { clock: true });
  const html = page.locator("html");
  await enableSubtitles(page);
  await page.locator("[name=revealMode]").selectOption("toggle");
  await page.locator("[name=revealAutoHide]").selectOption("3");
  await page.locator("h1").click();

  await page.keyboard.press("KeyS");
  await expect(html).toHaveClass(REVEALED);
  await page.keyboard.press("KeyS");
  await expect(html).not.toHaveClass(REVEALED);

  await page.keyboard.press("KeyS");
  await page.clock.runFor(2_900);
  await expect(html).toHaveClass(REVEALED);
  await page.clock.runFor(200);
  await expect(html).not.toHaveClass(REVEALED);

  await page.locator("#subtitle-preview").click();
  await expect(html).toHaveClass(REVEALED);
  await page.mouse.move(5, 5); // leaving the preview does not hide in Toggle
  await expect(html).toHaveClass(REVEALED);

  await page.locator("[name=revealMode]").selectOption("hold");
  await expect(html).not.toHaveClass(REVEALED);
});

test("choosing a reveal key records it, and only the new key reveals", async ({ context, optionsUrl, getSettings }) => {
  const page = await openOptions(context, optionsUrl);
  const html = page.locator("html");
  const keyButton = page.locator("#reveal-key-button");
  await enableSubtitles(page);

  await keyButton.click();
  await expect(keyButton).toHaveText("Press a key…");
  await page.keyboard.down("KeyS"); // the current key is recorded, not used to reveal
  await expect(html).not.toHaveClass(REVEALED);
  await page.keyboard.up("KeyS");

  await keyButton.click();
  await page.keyboard.press("KeyJ");
  await expect(keyButton).toHaveText("J");
  await expect.poll(getSettings).toMatchObject({ revealKey: "KeyJ" });
  await page.locator("h1").click();

  await page.keyboard.down("KeyS");
  await expect(html).not.toHaveClass(REVEALED);
  await page.keyboard.up("KeyS");
  await page.keyboard.down("KeyJ");
  await expect(html).toHaveClass(REVEALED);
  await page.keyboard.up("KeyJ");

  await keyButton.click();
  await page.keyboard.press("Space");
  await expect(page.locator("#status")).toContainText("can't be used as the reveal key");
  await page.keyboard.press("Escape");
  await expect(keyButton).toHaveText("J");
  await expect.poll(getSettings).toMatchObject({ revealKey: "KeyJ" });
});

test("ignores the reveal key with Ctrl held or while a control has focus", async ({ context, optionsUrl }) => {
  const page = await openOptions(context, optionsUrl);
  const html = page.locator("html");
  await enableSubtitles(page);

  await page.keyboard.down("Control");
  await page.keyboard.down("KeyS");
  await expect(html).not.toHaveClass(REVEALED);
  await page.keyboard.up("KeyS");
  await page.keyboard.up("Control");

  await page.locator("[name=subtitleStyle]").focus();
  await page.keyboard.down("KeyS");
  await expect(html).not.toHaveClass(REVEALED);
  await page.keyboard.up("KeyS");
});

test("the badge preview follows style, size, position, and the on switch", async ({ context, optionsUrl }) => {
  const page = await openOptions(context, optionsUrl);
  const badge = page.locator("#preview-badge");
  const disabledPill = page.locator("#preview-disabled");

  await expect(badge).toBeHidden();
  await expect(disabledPill).toBeVisible();

  await page.locator("[name=difficultyEnabled]").check();
  await expect(badge).toBeVisible();
  await expect(disabledPill).toBeHidden();
  await page.locator("[name=style]").selectOption("enhanced");
  await page.locator("[name=size]").selectOption("large");
  await page.locator("[name=position]").selectOption("lower-left");
  await expect(badge).toHaveClass(/--style-enhanced/);
  await expect(badge).toHaveClass(/--size-large/);
  await expect(badge).toHaveClass(/--position-lower-left/);
});

test("Restore defaults resets storage and the form", async ({ context, optionsUrl, getSettings }) => {
  const page = await openOptions(context, optionsUrl);
  await page.locator("[name=subtitlesEnabled]").check();
  await page.locator("[name=subtitleStyle]").selectOption("hidden");
  await page.locator("[name=difficultyEnabled]").check();
  await page.locator("[name=size]").selectOption("large");
  await expect.poll(getSettings).toMatchObject({ subtitlesEnabled: true, subtitleStyle: "hidden", difficultyEnabled: true, size: "large" });

  await page.locator("#reset-options").click();

  const defaults = await page.evaluate(() => ({ ...DreamingToolsSettings.DEFAULT_SETTINGS }));
  await expect.poll(getSettings).toEqual(defaults);
  await expect(page.locator("[name=subtitlesEnabled]")).not.toBeChecked();
  await expect(page.locator("[name=subtitleStyle]")).toHaveValue(defaults.subtitleStyle);
  await expect(page.locator("#reveal-key-button")).toHaveText("S");
});
