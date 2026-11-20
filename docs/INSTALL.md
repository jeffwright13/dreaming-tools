# Installing and Testing a Release

Most people should install Dreaming Tools from the [Chrome Web Store](https://chromewebstore.google.com/detail/dreaming-tools/pbjdmcekjgbjjiedeckkbppcchhfngdc), which keeps it up to date automatically. The listing is Unlisted for now, so it is reachable by that link but not through store search.

The rest of this page covers installing an unpacked build from an official GitHub release of this repository, for testing a release before it reaches the store. Remove the store version first, or use a separate Chrome profile, so the two copies do not both run on Dreaming pages.

## Firefox

From 1.2.0, Dreaming Tools also runs in desktop Firefox; the Firefox Add-ons listing will be linked here once it is published. To test a release build in Firefox before then, open `about:debugging`, select **This Firefox**, then **Load Temporary Add-on…**, and choose `manifest.json` in the extracted directory. Firefox removes a temporary add-on when it quits. The steps below are for Chrome.

## Before installing

Use a separate Chrome profile if you prefer to isolate unpacked extensions. The extension does not request Dreaming credentials, cookies, browsing history, or premium account data. Review the [privacy policy](../PRIVACY.md) and [security policy](../SECURITY.md) before installing.

Only use an archive downloaded from https://github.com/jeffwright13/dreaming-tools/releases. Do not install copies from file-sharing sites or unofficial mirrors.

## Install

1. Download `dreaming-tools-VERSION.zip` from the GitHub release.
2. Optionally compare its SHA-256 checksum with the checksum in the release notes.
3. Extract the ZIP into a permanent local directory. Do not delete that directory while testing.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Select **Load unpacked**.
7. Choose the extracted directory containing `manifest.json`, `icons/`, and `src/`.
8. The extension's options page opens by itself after a first install (otherwise use **Details** > **Extension options** in `chrome://extensions`). Switch on the tools you want to use; both are off after a fresh install.
9. Open or reload a supported Dreaming page.

Chrome loads an unpacked directory, not the ZIP itself. A Developer mode warning is expected for an unpacked extension; do not bypass any other browser or operating-system security warning.

## Update or remove

For a new version:

1. Download and extract the new official archive into a new directory.
2. Open `chrome://extensions`.
3. Remove the old version or select its reload control after replacing its files.
4. Load the new unpacked directory if needed.
5. Open Dreaming tabs refresh automatically from 0.9.0 on. When updating from a version before 0.9.0, reload existing Dreaming tabs once.

To uninstall, select **Remove** on the extension card in `chrome://extensions`, then delete the extracted directory.

## Test checklist

To help test, record the extension version, browser version, operating system, Dreaming language, account type, route, and extension settings. Exercise:

- Spanish and French routes where available
- Browse with no sort and with each non-difficulty sort (Random, Short, Long, Old, New): Dreaming shows only durations, so extension badges appear in both behaviors
- Browse sorted by Easy and by Hard: Dreaming's own difficulty badges remain in Fill missing only and are replaced by extension badges in Enhanced everywhere
- Library History
- My list videos and series
- Series catalogs and series modals
- Difficulty badges switched on and off
- Subtitles: with the player's Settings > Subtitles set to Off, nothing changes and the reveal key does nothing; with it set to Spanish (or French), each style (Blur, Small and faint, Hidden) applies, including in fullscreen
- Subtitles: the subtitles show while the key is down, whatever After releasing the reveal key says; on release they hide by default, and with After releasing set to 3, 5, or 10 seconds stay up until playback is that far past where you pressed (not while paused), after a quick press or a long hold alike
- Subtitles: with Jump back on reveal set, each press moves the video back by that amount, playing or paused, and the earlier line shows; releasing the key does not move it; tapping several times quickly moves back once per tap; with Show until caught up, a tap's subtitles hide once playback returns to where you first pressed
- Subtitles: switching to another window while revealed hides the subtitles again; the reveal key does nothing while typing in a comment box
- Subtitles: changing the reveal key in options, including rejection of Space and Escape cancelling capture
- Subtitles on a YouTube-served video (free accounts only; see [Which video player you'll see](#which-video-player-youll-see)), in both windowed and fullscreen: with YouTube's CC on, captions follow the chosen style in their normal position above the progress bar; the reveal key works both after clicking inside the YouTube player and with focus on the Dreaming page; with CC off, nothing changes
- Subtitles in picture-in-picture: on a Dreaming-player video with subtitles on, switching tabs opens picture-in-picture, and its subtitles appear at normal size and readable (known limitation; the tool does not reach that window). YouTube-served videos do not open picture-in-picture on a tab switch
- Difficulty badges and subtitles switched on together, separately, and both off on a watch page, for both a Dreaming-player video and a YouTube-served video
- Enhanced everywhere and Fill missing difficulties only
- Enhanced and Dreaming styles
- Small, Medium, and Large sizes
- All four badge positions
- Restore defaults
- Browser zoom and display scaling

Use the full matrix in [TESTING.md](TESTING.md) when assigned a platform/browser combination.

## Report a problem

Open an issue at https://github.com/jeffwright13/dreaming-tools/issues and include:

```text
Extension version:
Browser and exact version:
Operating system and version:
Dreaming language:
Free or premium account:
Page URL or route:
Behavior/style/size/position settings:
Steps to reproduce:
Expected result:
Actual result:
Screenshot, if useful:
Console error, if any:
```

Do not attach HAR files or include credentials, cookies, authorization headers, session tokens, downloaded premium content, or private account information. Follow the [security policy](../SECURITY.md) for vulnerabilities rather than posting exploit details publicly.

## Which video player you'll see

Dreaming plays videos in one of two players, and which one you get depends on your account, not on the video:

- **Premium accounts** always get Dreaming's own player: an orange progress bar, with a gear button for subtitles.
- **Free accounts** get YouTube's player (red progress bar, CC button) for videos that Dreaming also publishes on its YouTube channel, and Dreaming's player for the rest.

The extension works with both. In Dreaming's player, turn subtitles on with the gear menu; in YouTube's player, with the CC button or the `c` key. If you compare notes with someone else, the same video may look different for each of you. When reporting a problem, say which player the page showed.

## Known limitations

- The extension depends on Dreaming's current page structure and public catalog schema.
- A YouTube-served video open while the extension is updated keeps the previous settings until the next video or a tab reload.
- Firefox is supported from 1.2.0 and tested on macOS only. Mobile browsers and ChromeOS are not supported.
- Microsoft Edge is a compatibility target but must be tested separately on Windows.
- This project is independent and is not currently endorsed by Dreaming.
