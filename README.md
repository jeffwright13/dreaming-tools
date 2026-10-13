# Dreaming Difficulty

Dreaming Difficulty is a Chrome extension that adds Dreaming Spanish difficulty ratings to video cards and difficulty ranges to series cards.

It enhances:

- Library history and saved-video cards
- Library series cards
- Series catalog cards
- Series modal covers and episode cards

The extension downloads Dreaming's public Spanish video catalog. It does not read or store login credentials, cookies, browsing history, or account data.

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
5. Open or reload a Dreaming Spanish page.

After changing extension code, return to `chrome://extensions`, click the extension's reload button, and then reload the Dreaming Spanish tab.

## Manual test checklist

Verify that a green difficulty badge appears in each location:

- `/spanish/library`: History videos
- `/spanish/library`: My list videos
- `/spanish/library`: My list series ranges
- `/spanish/series`: Series-card ranges
- Series popup: Cover range and individual episode scores

On `/spanish/browse`, verify that cards with Dreaming's native difficulty badge do not receive a duplicate badge.

If a badge is missing, open DevTools and check the Console for a message beginning with `Dreaming Difficulty`.

## Chrome Web Store deployment

Before publishing, add store-ready extension icons and screenshots, prepare a privacy-policy statement, and create a ZIP containing `manifest.json` and `src/`. Upload that ZIP in the Chrome Web Store Developer Dashboard. Do not include `node_modules/`, tests, or development documentation in the ZIP.
