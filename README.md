# Dreaming Tools

Dreaming Tools is a Chrome extension of companion tools for Dreaming. Each tool is off until you switch it on in the extension options, which open by themselves the first time the extension is installed. Each tool can be switched on or off independently. It supports Dreaming's Spanish and French sections.

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

The player's own subtitle control stays in charge: **Settings > Subtitles** on Dreaming's player, or the **CC** button on videos Dreaming serves through YouTube. With subtitles off, nothing changes. With them on, the extension blurs, shrinks and fades, or hides the subtitle line, and a reveal key (`S` by default) shows it, either while held or as a toggle with optional auto-hide. The key is ignored while you type in a text field and when Ctrl, Alt, or Cmd is held. In the floating picture-in-picture window, Chrome shows only the video, without Dreaming's or YouTube's subtitles, so the tool has nothing to act on there; use the normal player when you want subtitles. For YouTube-served videos the extension also runs inside YouTube's embedded player, only when it is embedded in Dreaming; see [PRIVACY.md](PRIVACY.md).

## Browser support

The initial target is desktop Chrome on macOS, Windows, and Linux, plus current Microsoft Edge on Windows. Firefox and mobile browsers are not currently supported. See [docs/TESTING.md](docs/TESTING.md) for the compatibility policy and release matrix.

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

Each tool is a self-contained feature module. `src/settings.js` defines every setting and its default, `src/content.js` reads settings and passes them to each feature, `src/background.js` opens the options page on first install, and a feature such as `src/difficulty.js` starts, updates, or stops itself from those settings. See [docs/SPEC.md](docs/SPEC.md) for the feature contract.

Generate the V8 coverage report and build the extension package with:

```bash
npm run test:coverage
npm run package
npm run package:verify
```

The package is written to `dist/dreaming-tools-VERSION.zip` and contains only allowlisted runtime files.

## Load the extension locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the directory that matches how you are running the extension:
   - **Development:** this repository directory—not `src/`. Reloading the extension then picks up your working-tree edits.
   - **Released build:** the directory you extracted from a `dreaming-tools-VERSION.zip` archive (see [docs/BETA.md](docs/BETA.md)).
5. Open or reload a Dreaming page.

Chrome reloads an unpacked extension from the directory it was originally loaded from. If code changes do not appear after reloading, open the extension's **Details** page and check **Source**; an extracted release archive will not reflect repository edits. Remove it and load the repository directory instead.

After changing extension code, return to `chrome://extensions`, click the extension's reload button, and then reload the Dreaming tab.

## Options

The options page opens automatically after a first install. To open it later, go to the extension's **Details** page in `chrome://extensions` and select **Extension options**. Settings synchronize through Chrome when browser sync is enabled.

The page has one section per tool, Subtitles first and Difficulty badges second. Both tools are off by default.

**De-emphasize subtitles** switches the subtitles tool on or off. Choose **Blur** (default), **Small and faint**, or **Hidden**; reveal **While holding the key** (default) or **Toggle on each press** with auto-hide after 3, 5 (default), or 10 seconds, or never. To change the reveal key, click the key button and press a letter, digit, or punctuation key. Press and hold the preview to see a reveal.

**Show difficulty badges** switches the difficulty tool on or off. When it is off, the extension makes no badge changes and does not download the catalog.

Behavior choices:

- **Enhanced everywhere** replaces native badges and adds missing video and series badges.
- **Fill missing difficulties only** preserves native badges and adds badges where Dreaming omits them.

Dreaming shows its own difficulty badges only on Browse sorted by Easy or Hard. With no sort or any other sort (Random, Short, Long, Old, New) it shows only durations, so both behaviors add badges there; the two behaviors differ only where native badges are present.

Configured badges can use Enhanced or Dreaming style, three sizes, and the upper-right, upper-left, or lower-left corner of the thumbnail. By default, the extension preserves native badges and fills missing difficulties with small, upper-right badges using Dreaming style. Lower-right placement is excluded because Dreaming uses that corner for video duration. Select **Restore defaults** to reset all settings, which also switches both tools off.

Changes save as soon as you make them; there is no Save button. Open Dreaming tabs update without reloading where the current extension content script is active. After installing, updating, or manually reloading the extension itself, reload any Dreaming tabs that were already open so Chrome can inject the new content script.

## Manual test checklist

The complete browser/platform matrix and security checks are in [docs/TESTING.md](docs/TESTING.md). At minimum, test both `/spanish/` and `/french/` where content is available and verify badges in:

- Library History
- Library My list videos
- Library My list series
- Series catalog cards
- Series popup cover and individual episodes
- Browse cards with no sort, a non-difficulty sort, and the Easy and Hard sorts

Switch the difficulty tool off and on and change each behavior mode in Extension options, then verify that an open Dreaming tab updates without reloading. If a badge is missing, open DevTools and check the Console for a message beginning with `Dreaming Tools`.

## Community beta

Beta installation, update, test, and reporting instructions are in [docs/BETA.md](docs/BETA.md). Install only archives attached to this repository's official GitHub prereleases.

## Support and security reports

Use the [GitHub issue chooser](https://github.com/jeffwright13/dreaming-tools/issues/new/choose) for non-sensitive bugs, badge or layout problems, language requests, and feature requests. Follow [SECURITY.md](SECURITY.md) for vulnerabilities; do not post credentials, cookies, tokens, authorization headers, HAR files, premium content, or private account information.

## Publishing and maintenance

The staged beta, GitHub community setup, Chrome Web Store submission, release checklist, package allowlist, and maintenance plan are in [docs/PUBLISHING.md](docs/PUBLISHING.md). That checklist is the source of truth for publication readiness; the repository is not yet claiming Chrome Web Store availability.
