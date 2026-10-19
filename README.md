# Dreaming Difficulty

Dreaming Difficulty is a Chrome extension that adds Dreaming difficulty ratings to video cards and watch pages, and difficulty ranges to series cards. It supports Dreaming's Spanish and French sections.

It enhances:

- Library history and saved-video cards
- Library series cards
- Series catalog cards
- Series modal covers and episode cards
- Watch pages, with video difficulty and series range chips beside the level badge
- Native difficulty badges when enhanced-everywhere behavior is selected

The extension downloads the public catalog for the language in the current page URL. It does not read or store login credentials, cookies, browsing history, or account data. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) for the complete policies.

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

Generate the V8 coverage report and build the extension package with:

```bash
npm run test:coverage
npm run package
npm run package:verify
```

The package is written to `dist/dreaming-difficulty-VERSION.zip` and contains only allowlisted runtime files.

## Load the extension locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the directory that matches how you are running the extension:
   - **Development:** this repository directory—not `src/`. Reloading the extension then picks up your working-tree edits.
   - **Released build:** the directory you extracted from a `dreaming-difficulty-VERSION.zip` archive (see [docs/BETA.md](docs/BETA.md)).
5. Open or reload a Dreaming page.

Chrome reloads an unpacked extension from the directory it was originally loaded from. If code changes do not appear after reloading, open the extension's **Details** page and check **Source**; an extracted release archive will not reflect repository edits. Remove it and load the repository directory instead.

After changing extension code, return to `chrome://extensions`, click the extension's reload button, and then reload the Dreaming tab.

## Options

Open the extension's **Details** page in `chrome://extensions` and select **Extension options**. Settings synchronize through Chrome when browser sync is enabled.

Behavior choices:

- **Enhanced everywhere** replaces native badges and adds missing video and series badges.
- **Fill missing difficulties only** preserves native badges and adds badges where Dreaming omits them.
- **Original Dreaming** makes no badge changes.

Configured badges can use Enhanced or Dreaming style, three sizes, and the upper-right, upper-left, or lower-left corner of the thumbnail. By default, the extension preserves native badges and fills missing difficulties with small, upper-right badges using Dreaming style. Lower-right placement is excluded because Dreaming uses that corner for video duration. Select **Restore defaults** to reset all settings.

Saving options updates Dreaming tabs where the current extension content script is active. After installing, updating, or manually reloading the extension itself, reload any Dreaming tabs that were already open so Chrome can inject the new content script.

## Manual test checklist

The complete browser/platform matrix and security checks are in [docs/TESTING.md](docs/TESTING.md). At minimum, test both `/spanish/` and `/french/` where content is available and verify badges in:

- Library History
- Library My list videos
- Library My list series
- Series catalog cards
- Series popup cover and individual episodes
- Browse cards with native difficulty badges

Change each behavior mode in Extension options and verify that an open Dreaming tab updates without reloading. If a badge is missing, open DevTools and check the Console for a message beginning with `Dreaming Difficulty`.

## Community beta

Beta installation, update, test, and reporting instructions are in [docs/BETA.md](docs/BETA.md). Install only archives attached to this repository's official GitHub prereleases.

## Support and security reports

Use the [GitHub issue chooser](https://github.com/jeffwright13/dreaming-tools/issues/new/choose) for non-sensitive bugs, badge or layout problems, language requests, and feature requests. Follow [SECURITY.md](SECURITY.md) for vulnerabilities; do not post credentials, cookies, tokens, authorization headers, HAR files, premium content, or private account information.

## Publishing and maintenance

The staged beta, GitHub community setup, Chrome Web Store submission, release checklist, package allowlist, and maintenance plan are in [docs/PUBLISHING.md](docs/PUBLISHING.md). That checklist is the source of truth for publication readiness; the repository is not yet claiming Chrome Web Store availability.
