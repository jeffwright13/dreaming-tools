# Dreaming Tools

Dreaming Tools is a Chrome and Firefox extension of companion tools for Dreaming. Each tool is off until you switch it on in the extension options, which open by themselves the first time the extension is installed. Each tool can be switched on or off independently. It supports Dreaming's Spanish and French sections.

## Difficulty badges

Adds Dreaming difficulty ratings to video cards and watch pages, and difficulty ranges to series cards. It is off by default. It enhances:

- Library history and saved-video cards
- Library series cards
- Series catalog cards
- Series modal covers and episode cards
- Watch pages, with video difficulty and series range chips beside the level badge
- Native difficulty badges when enhanced-everywhere behavior is selected

The difficulty tool downloads the public catalog for the language in the current page URL. It does not read or store login credentials, cookies, browsing history, or account data. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for the complete policies.

## Subtitles

For listen-only practice: keeps the player's subtitles unreadable until you deliberately reveal them, for example to check an unfamiliar word. It is off by default.

The player's own subtitle control stays in charge: **Settings > Subtitles** on Dreaming's player, or the **CC** button on videos Dreaming serves through YouTube. With subtitles off, nothing changes. With them on, the extension blurs, shrinks and fades, or hides the subtitle line, and a reveal key (`S` by default) shows it while held. A quick tap can instead keep it up until playback catches up, or for a few seconds, and each press can first move the video back. The key is ignored while you type in a text field and when Ctrl, Alt, or Cmd is held. In picture-in-picture, which Dreaming's player opens when you switch tabs, its subtitles appear at normal size and readable: the tool does not reach that window. YouTube-served videos do not open picture-in-picture when you switch tabs. For YouTube-served videos the extension also runs inside YouTube's embedded player, only when it is embedded in Dreaming; see [PRIVACY.md](PRIVACY.md).

## Browser support

The target is desktop Chrome on macOS, Windows, and Linux, current Microsoft Edge on Windows, and current desktop Firefox (from 1.2.0). Mobile browsers are not supported. See [docs/TESTING.md](docs/TESTING.md) for the compatibility policy and release matrix.

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

Each tool is a self-contained feature module. `src/settings.js` defines every setting and its default, `src/content.js` reads settings and passes them to each feature, `src/background.js` opens the options page on first install and refreshes open Dreaming tabs after an install or update, and a feature such as `src/difficulty.js` starts, updates, or stops itself from those settings. See [docs/SPEC.md](docs/SPEC.md) for the feature contract.

Live-site browser tests (Playwright, local only) load the packaged extension into a real browser and visit Dreaming. They need a one-time browser download and, for the logged-in tests, a hand login into a dedicated test profile. See [docs/TESTING.md](docs/TESTING.md#live-site-browser-tests-playwright).

```bash
npx playwright install chromium
npm run test:live:login
npm run test:live
```

Generate the V8 coverage report and build the extension package with:

```bash
npm run test:coverage
npm run package
npm run package:verify
```

The package is written to `dist/dreaming-tools-VERSION.zip` and contains only allowlisted runtime files. The build is reproducible, and `npm run package` refuses to replace an existing ZIP of the same version with different contents, because that file may be a released package: bump the version for a new release, or pass `--force` (`npm run package -- --force`). Test builds go to `dist/dev/` instead (`npm run package:dev`); the live suite and `npm run store:screenshots` build and use that copy.

## Load the extension locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the directory that matches how you are running the extension:
   - **Development:** this repository directory—not `src/`. Reloading the extension then picks up your working-tree edits.
   - **Released build:** the directory you extracted from a `dreaming-tools-VERSION.zip` archive (see [docs/INSTALL.md](docs/INSTALL.md)).
5. Open or reload a Dreaming page.

Chrome reloads an unpacked extension from the directory it was originally loaded from. If code changes do not appear after reloading, open the extension's **Details** page and check **Source**; an extracted release archive will not reflect repository edits. Remove it and load the repository directory instead.

After changing extension code, return to `chrome://extensions`, click the extension's reload button, and then reload the Dreaming tab.

## Options

The options page opens automatically after a first install. To open it later, go to the extension's **Details** page in `chrome://extensions` and select **Extension options**. Settings synchronize through Chrome when browser sync is enabled.

The page has one section per tool, Subtitles first and Difficulty badges second, and follows the browser's light or dark setting. Both tools are off by default. The subtitle preview shows how each player's subtitles look: Dreaming's own player and YouTube-served videos.

**De-emphasize subtitles** switches the subtitles tool on or off. Choose **Blur** (default), **Small and faint**, or **Hidden**. Holding the reveal key shows the subtitles until you let go. **Jump back on reveal** (Off by default, or 1, 2, 3, 5, or 10 seconds) moves the video back each time you press the key, so you hear the line you missed while you read it; tap a few times to go further back. **After tapping the reveal key** (a press of under 0.3 seconds) chooses what a tap does: **Hide on release** (default, like a hold), **Show until caught up** (until playback returns to where you first pressed; requires Jump back), or **Show 3, 5, or 10 s past where you pressed**, counted in playback time. To change the reveal key, click the key button and press a letter, digit, or punctuation key. Press the reveal key, or press a preview, to see a reveal on the options page, with tap and hold as on Dreaming.

**Show difficulty badges** switches the difficulty tool on or off. When it is off, the extension makes no badge changes and does not download the catalog.

Behavior choices:

- **Enhanced everywhere** replaces native badges and adds missing video and series badges.
- **Fill missing difficulties only** preserves native badges and adds badges where Dreaming omits them.

Dreaming shows its own difficulty badges only on Browse sorted by Easy or Hard. With no sort or any other sort (Random, Short, Long, Old, New) it shows only durations, so both behaviors add badges there; the two behaviors differ only where native badges are present.

Configured badges can use Enhanced or Dreaming style, three sizes, and the upper-right, upper-left, or lower-left corner of the thumbnail. By default, the extension preserves native badges and fills missing difficulties with small, upper-right badges using Dreaming style. Lower-right placement is excluded because Dreaming uses that corner for video duration. Select **Restore defaults** to reset all settings, which also switches both tools off.

Changes save as soon as you make them; there is no Save button. Open Dreaming tabs update without reloading where the current extension content script is active. Dreaming tabs that were already open when the extension was installed, updated, or reloaded are refreshed automatically. A YouTube-served video open at that moment keeps the previous settings until the next video; reload the tab if anything doesn't respond to changes.

## Manual test checklist

The complete browser/platform matrix and security checks are in [docs/TESTING.md](docs/TESTING.md). At minimum, test both `/spanish/` and `/french/` where content is available and verify badges in:

- Library History
- Library My list videos
- Library My list series
- Series catalog cards
- Series popup cover and individual episodes
- Browse cards with no sort, a non-difficulty sort, and the Easy and Hard sorts

Switch the difficulty tool off and on and change each behavior mode in Extension options, then verify that an open Dreaming tab updates without reloading. If a badge is missing, open DevTools and check the Console for a message beginning with `Dreaming Tools`.

## Installing

Install Dreaming Tools from the [Chrome Web Store](https://chromewebstore.google.com/detail/dreaming-tools/pbjdmcekjgbjjiedeckkbppcchhfngdc). The listing is Unlisted for now: anyone with the link can install it, but it does not appear in store search. Chrome keeps a store install up to date.

To test a release before it reaches the store, install the unpacked build from this repository's official GitHub releases; see [docs/INSTALL.md](docs/INSTALL.md) for installation, update, test, and reporting instructions.

## Support and security reports

Use the [GitHub issue chooser](https://github.com/jeffwright13/dreaming-tools/issues/new/choose) for non-sensitive bugs, badge or layout problems, language requests, and feature requests. Follow [SECURITY.md](SECURITY.md) for vulnerabilities; do not post credentials, cookies, tokens, authorization headers, HAR files, premium content, or private account information.

## Publishing and maintenance

Dreaming outreach, GitHub community setup, Chrome Web Store submission, release checklist, package allowlist, and maintenance plan are in [docs/PUBLISHING.md](docs/PUBLISHING.md). That checklist is the source of truth for publication readiness. The extension is published in the Chrome Web Store as an Unlisted item.
