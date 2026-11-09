// After an extension update, an already-open Dreaming tab picks up the new
// copy of the extension without a reload, and the old copy stops. Logged out:
// the <html> subtitle classes and the difficulty badges show which copy runs.
//
// This test always runs in the installed Microsoft Edge. Playwright's own
// Chromium (Chrome for Testing) unloads an extension loaded from the command
// line when it calls chrome.runtime.reload() and never loads it again
// (its pages then fail with ERR_BLOCKED_BY_CLIENT), so it cannot model an update.
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect, launchWithExtension } from "./fixtures.js";
import { readVideoCards, settledBadgeCount } from "./catalog.js";
import { routes } from "./routes.js";

const isOurWorker = (worker) => worker.url().endsWith("/src/background.js");

test("an open Dreaming tab follows settings after the extension reloads, without a tab reload", async ({ extension }) => {
  const profile = mkdtempSync(path.join(os.tmpdir(), "dreaming-tools-profile-"));
  const context = await launchWithExtension(profile, extension.directory, { channel: "msedge" }).catch(() => null);
  test.skip(!context, "Microsoft Edge is not installed; this test needs it (see the comment at the top)");
  try {
    const worker = context.serviceWorkers().find(isOurWorker) ?? await context.waitForEvent("serviceworker", { predicate: isOurWorker });
    await worker.evaluate(() => chrome.storage.sync.set({
      subtitlesEnabled: true, subtitleStyle: "blur", difficultyEnabled: true, behavior: "enhanced-everywhere", size: "small",
    }));
    const page = await context.newPage();
    await page.goto(routes.browse("spanish"));
    await settledBadgeCount(page);
    await expect(page.locator("html")).toHaveClass(/dt-subtitles--style-blur/);
    const navigations = [];
    page.on("framenavigated", (frame) => frame === page.mainFrame() && navigations.push(frame.url()));

    // An unpacked extension's reload is an "update" to Chrome's onInstalled,
    // which re-injects the content script into open Dreaming tabs.
    const nextWorker = context.waitForEvent("serviceworker", { predicate: isOurWorker, timeout: 15_000 });
    await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
    const reloaded = await nextWorker;
    await page.waitForTimeout(2_000);
    await reloaded.evaluate(() => chrome.storage.sync.set({ subtitleStyle: "hidden", size: "large" }));

    // The new copy follows the change; the old copy no longer acts on storage.
    await expect(page.locator("html")).toHaveClass(/dt-subtitles--style-hidden/);
    await expect(page.locator("html")).not.toHaveClass(/dt-subtitles--style-blur/);
    await expect(page.locator(".ds-difficulty-extension-badge--size-large").first()).toBeVisible();
    await expect(page.locator(".ds-difficulty-extension-badge--size-small")).toHaveCount(0);
    // Two running copies would each add a badge.
    const cards = await readVideoCards(page);
    expect(Math.max(...cards.map((card) => card.extensionBadges))).toBe(1);
    expect(navigations, "the tab should not have been reloaded").toEqual([]);
  } finally {
    await context?.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
