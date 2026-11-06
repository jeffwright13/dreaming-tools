(() => {
  const DREAMING_ORIGIN = "https://app.dreaming.com";
  // Updates and reloads of the extension orphan the content scripts already
  // running in open tabs; Chrome updates do not.
  const REFRESH_REASONS = new Set(["install", "update"]);

  // Every tool is off by default, so a fresh install changes nothing on
  // Dreaming until the user opens the options page. Open it once, on first
  // install only.
  async function openOptionsOnFirstInstall() {
    try {
      await chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error("Dreaming Tools could not open its options page.", error);
    }
  }

  // The manifest's content script for Dreaming pages, so the files injected
  // here are always the ones Chrome would inject on a fresh page load.
  function dreamingContentScript() {
    return chrome.runtime.getManifest().content_scripts
      .find((script) => script.matches.every((match) => match.startsWith(`${DREAMING_ORIGIN}/`)));
  }

  // Only the extension's own packaged files are injected, never code strings
  // or functions. The new copy tells any old copy in the page to stop first
  // (see content.js).
  async function refreshTab(tabId, script) {
    await chrome.scripting.insertCSS({ target: { tabId }, files: script.css });
    await chrome.scripting.executeScript({ target: { tabId }, files: script.js });
  }

  // Chrome does not inject an installed or updated extension's content
  // scripts into tabs that are already open, and the old copy there stops
  // receiving settings changes. Discarded tabs are skipped: they reload, and
  // get the manifest's scripts, when the user returns to them. YouTube embed
  // frames are not refreshed; each new video loads a new frame.
  async function refreshOpenTabs() {
    try {
      const script = dreamingContentScript();
      const tabs = await chrome.tabs.query({ url: script.matches, discarded: false });
      await Promise.all(tabs.map(async ({ id }) => {
        try {
          await refreshTab(id, script);
        } catch (error) {
          console.warn(`Dreaming Tools could not refresh tab ${id}.`, error);
        }
      }));
    } catch (error) {
      console.error("Dreaming Tools could not refresh open Dreaming tabs.", error);
    }
  }

  async function onInstalled({ reason }) {
    const tasks = [];
    if (reason === "install") {
      tasks.push(openOptionsOnFirstInstall());
    }
    if (REFRESH_REASONS.has(reason)) {
      tasks.push(refreshOpenTabs());
    }
    await Promise.all(tasks);
  }

  // A service worker must register its listeners synchronously when it
  // starts, or Chrome may not deliver the event that woke it.
  chrome.runtime.onInstalled.addListener(onInstalled);
})();
