# Dreaming Difficulty

Dreaming Difficulty is a Chrome extension that adds Dreaming difficulty ratings to video cards and difficulty ranges to series cards. It supports Dreaming's Spanish and French sections.

It enhances:

- Library history and saved-video cards
- Library series cards
- Series catalog cards
- Series modal covers and episode cards
- Native difficulty badges when enhanced-everywhere behavior is selected

The extension downloads the public catalog for the language in the current page URL. It does not read or store login credentials, cookies, browsing history, or account data.

## Development

Requirements:

- Node.js 22 or later
- npm
- Google Chrome

Install dependencies and run the tests:

```bash
npm install
npm test
```

## Load the extension locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select this repository directory—not `src/`.
5. Open or reload a Dreaming page.

After changing extension code, return to `chrome://extensions`, click the extension's reload button, and then reload the Dreaming tab.

## Options

Open the extension's **Details** page in `chrome://extensions` and select **Extension options**. Settings synchronize through Chrome when browser sync is enabled.

Behavior choices:

- **Enhanced everywhere** replaces native badges and adds missing video and series badges.
- **Fill missing difficulties only** preserves native badges and adds badges where Dreaming omits them.
- **Original Dreaming** makes no badge changes.

Configured badges can use Enhanced or Dreaming style, three sizes, and any corner of the thumbnail. Defaults are Enhanced style, small size, and lower-left placement. Select **Restore defaults** to reset all settings.

Saving options updates Dreaming tabs where the current extension content script is active. After installing, updating, or manually reloading the extension itself, reload any Dreaming tabs that were already open so Chrome can inject the new content script.

## Manual test checklist

Test both `/spanish/` and `/french/` where content is available. Verify badges in:

- Library History
- Library My list videos
- Library My list series
- Series catalog cards
- Series popup cover and individual episodes
- Browse cards with native difficulty badges

Change each behavior mode in Extension options and verify that an open Dreaming tab updates without reloading. If a badge is missing, open DevTools and check the Console for a message beginning with `Dreaming Difficulty`.

## Chrome Web Store deployment

Before publishing, add store-ready extension icons and screenshots, prepare a privacy-policy statement, and create a ZIP containing `manifest.json` and `src/`. Upload that ZIP in the Chrome Web Store Developer Dashboard. Do not include `node_modules/`, tests, or development documentation in the ZIP.
