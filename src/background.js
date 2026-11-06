(() => {
  // Every tool is off by default, so a fresh install changes nothing on
  // Dreaming until the user opens the options page. Open it once, on first
  // install only: updates, extension reloads, and Chrome updates leave the
  // user where they are.
  async function onInstalled({ reason }) {
    if (reason !== "install") {
      return;
    }

    try {
      await chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error("Dreaming Tools could not open its options page.", error);
    }
  }

  // A service worker must register its listeners synchronously when it
  // starts, or Chrome may not deliver the event that woke it.
  chrome.runtime.onInstalled.addListener(onInstalled);
})();
