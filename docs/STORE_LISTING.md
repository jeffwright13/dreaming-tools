# Chrome Web Store Listing

The text and answers to submit in the Chrome Web Store developer dashboard, kept here so the submitted listing is versioned with the code (see `PUBLISHING.md`). Fields marked *from the package* come from `manifest.json` and change only with a new release. Check field limits and required images in the dashboard at submission time; they are not verified here.

## Store listing tab

**Name** (from the package): Dreaming Tools

**Summary** (from the package, 132 characters at most): Companion tools for Dreaming: video difficulty ratings and series ranges, plus subtitle de-emphasis for listen-only practice.

**Category:** Education

**Language:** English

**Detailed description** (plain text; the store does not render Markdown):

```text
Two optional study aids for Dreaming's website (app.dreaming.com), for Spanish and French. Both are off until you switch them on in the options page, which opens by itself after you install.

SUBTITLE DE-EMPHASIS, FOR LISTENING PRACTICE
With subtitles on, it is tempting to read along instead of listening. This tool keeps the subtitles unreadable until you choose to see them:
- Blur them, make them small and faint, or hide them.
- Hold a reveal key (S by default) to see them while you hold it.
- Optionally jump the video back 1 to 10 seconds each time you press the key, so you hear the line you missed while you read it; press a few times to go further back.
- Choose what happens when you let go: hide again, keep the subtitles up until the video catches up, or for 3, 5, or 10 seconds past where you pressed.
- Works on Dreaming's own player and on videos Dreaming serves through YouTube, windowed and in fullscreen.
- The player's own subtitle setting stays in charge. With subtitles off, nothing changes.

DIFFICULTY BADGES
- Shows Dreaming's difficulty rating on video cards and a difficulty range on series cards, using Dreaming's public catalog.
- Covers Browse, Library, series pages and popups, and the watch page.
- Choose to fill in only the missing ratings or to show them everywhere, and pick the badge style, size, and corner.

PRIVACY
The extension collects no data. It does not read your Dreaming login, cookies, subtitle text, or viewing history, and it sends nothing to the developer. Your settings are stored in Chrome and sync through your Google account if Chrome sync is on. The source code is public.

LIMITATIONS
Desktop Chrome, other Chromium browsers, and Firefox, not the Dreaming mobile app. In picture-in-picture, Dreaming's player shows normal subtitles; the extension does not reach that window.

Dreaming Tools is an independent, unofficial project. It is not affiliated with, endorsed by, or sponsored by Dreaming Languages.
```

**Icon:** `icons/icon-128.png` (from the package).

**Screenshots and promo tile:** generated from the packaged extension with `npm run store:screenshots` (which builds the test package in `dist/dev/` first), into `dist/store-assets/`: five 1280x800 options-page screenshots, the most Chrome accepts, and a 440x280 small promo tile. They show only the extension's own pages and preview art, not Dreaming's site, whose thumbnails and branding are Dreaming's. Each subtitle shot starts at "Subtitle appearance" so the Style menu and both player previews fit, and the Style menu shows the style the previews depict. The Chrome Web Store shows no captions; Firefox Add-ons takes these, one per screenshot:

| File | Caption |
|---|---|
| `1-subtitles-hidden.png` | Subtitles hidden: the Dreaming and YouTube player previews show no subtitle until you press the reveal key |
| `2-subtitles-blurred.png` | Subtitles blurred: a line is there but unreadable, in both player previews |
| `3-subtitles-small-and-faint.png` | Subtitles small and faint: readable only with deliberate effort |
| `4-subtitles-revealed.png` | Subtitles revealed while the reveal key is held |
| `5-difficulty-badges-dark.png` | Difficulty badges in the upper-right corner (the default): a rating on a video, a range on a series, in dark mode |

**Homepage URL:** https://github.com/jeffwright13/dreaming-tools

**Support URL:** https://github.com/jeffwright13/dreaming-tools/issues/new/choose

## Privacy practices tab

**Single purpose:**

```text
Study aids for Dreaming's language-learning website (app.dreaming.com): subtitle de-emphasis for listening practice, and video difficulty ratings from Dreaming's public catalog.
```

**Permission justifications:**

- `storage`: Saves the user's preferences (which tools are on, subtitle style, reveal key, after-release choice, jump back, badge style, size, and position) with chrome.storage.sync.
- `scripting`: After an install or update, re-injects the extension's own packaged content scripts into Dreaming tabs that were already open, so they keep responding to settings changes without a reload. It injects only files from the package, never remote or generated code.
- Host `https://app.dreaming.com/*`: Adds difficulty badges and subtitle styling to Dreaming pages, and downloads Dreaming's public video catalog (without cookies or credentials) to look up difficulty ratings.
- Content script on `https://www.youtube.com/embed/*`: Dreaming plays some videos in an embedded YouTube player, whose captions are drawn inside that player. The script runs only when the player is embedded in a Dreaming page. It blurs, fades, or hides the captions and shows them when the reveal key is pressed, and, if the user turns on Jump back, moves the video back a few seconds on that press. It does not read caption text, YouTube account data, or viewing activity, and makes no network requests.

**Remote code:** No. All code is in the package.

**Data usage:** None of the listed data categories are collected. Certify the three statements (no sale of data, no use unrelated to the single purpose, no use for creditworthiness or lending).

**Privacy policy URL:** https://github.com/jeffwright13/dreaming-tools/blob/main/PRIVACY.md

## Test instructions tab

The text submitted for reviewers (500 characters at most), copied from the dashboard on 2026-11-17. No reviewer credentials are given.

```text
No login needed for badges; subtitles need a free Dreaming account (app.dreaming.com).

1. In the options page that opens on install, switch on both tools.
2. Badges: open app.dreaming.com/spanish/browse. Videos show a difficulty number, series a range.
3. Subtitles: sign in, play a video, turn on Subtitles in the player settings. They are blurred; hold S to reveal.
4. The options page previews both tools; press S there too.
```

## Distribution

- **Package:** the published release ZIP, unchanged, with its SHA-256 matching the GitHub release.
- **Visibility:** Unlisted first. Install from the store on a clean Chrome profile and confirm an update goes through, then switch to Public.
- **Regions:** all.

## Firefox Add-ons (AMO)

Submitted from 1.2.0 with the same ZIP as the Chrome Web Store. Mozilla shows the name, version, icon, and add-on ID from the package.

**Distribution:** listed ("On this site").

**Summary** (250 characters at most): Companion tools for Dreaming: video difficulty ratings and series ranges, plus subtitle de-emphasis for listen-only practice. Unofficial and independent; collects no data.

**Category:** pick the closest education or language category the form offers.

**License:** MIT.

**Source code:** answer that the package contains no minified, concatenated, or machine-generated code; the files are the readable source from this repository, so no separate source upload is needed.

**Description:** the Chrome detailed description above, with these two paragraphs changed for Firefox:

```text
PRIVACY
The extension collects no data. It does not read your Dreaming login, cookies, subtitle text, or viewing history, and it sends nothing to the developer. Your settings are stored in the browser and sync through your Mozilla account if Firefox Sync is on. The source code is public.

LIMITATIONS
Desktop Firefox and Chrome, not the Dreaming mobile app or mobile browsers. In picture-in-picture, Dreaming's player shows normal subtitles; the extension does not reach that window.
```

**Data collection** (from the package): `browser_specific_settings.gecko.data_collection_permissions` declares `none`.

**Screenshots:** the same five 1280x800 images from `dist/store-assets/`, in order, each with its caption from the table above.

**Homepage, support, and privacy policy URLs:** the same as the Chrome listing.
