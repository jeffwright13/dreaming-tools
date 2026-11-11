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
- Press a reveal key (S by default) to see them: while you hold the key, or as a toggle that can hide again after 3, 5, or 10 seconds.
- Works on Dreaming's own player and on videos Dreaming serves through YouTube, windowed and in fullscreen.
- The player's own subtitle setting stays in charge. With subtitles off, nothing changes.

DIFFICULTY BADGES
- Shows Dreaming's difficulty rating on video cards and a difficulty range on series cards, using Dreaming's public catalog.
- Covers Browse, Library, series pages and popups, and the watch page.
- Choose to fill in only the missing ratings or to show them everywhere, and pick the badge style, size, and corner.

PRIVACY
The extension collects no data. It does not read your Dreaming login, cookies, subtitle text, or viewing history, and it sends nothing to the developer. Your settings are stored in Chrome and sync through your Google account if Chrome sync is on. The source code is public.

LIMITATIONS
Desktop Chrome and other Chromium browsers only, not the Dreaming mobile app. In picture-in-picture, Dreaming's player shows normal subtitles; the extension does not reach that window.

Dreaming Tools is an independent, unofficial project. It is not affiliated with, endorsed by, or sponsored by Dreaming Languages.
```

**Icon:** `icons/icon-128.png` (from the package).

**Screenshots and promo tile:** not made yet. The options page uses the extension's own preview art and is the safest subject. Screenshots of Dreaming pages would show Dreaming's thumbnails and branding.

**Homepage URL:** https://github.com/jeffwright13/dreaming-tools

**Support URL:** https://github.com/jeffwright13/dreaming-tools/issues/new/choose

## Privacy practices tab

**Single purpose:**

```text
Study aids for Dreaming's language-learning website (app.dreaming.com): subtitle de-emphasis for listening practice, and video difficulty ratings from Dreaming's public catalog.
```

**Permission justifications:**

- `storage`: Saves the user's preferences (which tools are on, subtitle style, reveal key and mode, badge style, size, and position) with chrome.storage.sync.
- `scripting`: After an install or update, re-injects the extension's own packaged content scripts into Dreaming tabs that were already open, so they keep responding to settings changes without a reload. It injects only files from the package, never remote or generated code.
- Host `https://app.dreaming.com/*`: Adds difficulty badges and subtitle styling to Dreaming pages, and downloads Dreaming's public video catalog (without cookies or credentials) to look up difficulty ratings.
- Content script on `https://www.youtube.com/embed/*`: Dreaming plays some videos in an embedded YouTube player, whose captions are drawn inside that player. The script runs only when the player is embedded in a Dreaming page. It blurs, fades, or hides the captions and shows them when the reveal key is pressed. It does not read caption text, YouTube account data, or viewing activity, and makes no network requests.

**Remote code:** No. All code is in the package.

**Data usage:** None of the listed data categories are collected. Certify the three statements (no sale of data, no use unrelated to the single purpose, no use for creditworthiness or lending).

**Privacy policy URL:** https://github.com/jeffwright13/dreaming-tools/blob/main/PRIVACY.md

## Distribution

- **Package:** the published release ZIP, unchanged, with its SHA-256 matching the GitHub release.
- **Visibility:** Unlisted first. Install from the store on a clean Chrome profile and confirm an update goes through, then switch to Public.
- **Regions:** all.
