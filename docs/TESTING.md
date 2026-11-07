# Testing and Browser Compatibility

## Support policy

Initial desktop support targets:

- Google Chrome: current and previous stable major versions
- Microsoft Edge: current stable major version
- Operating systems: current supported macOS, Windows, and mainstream Linux desktop environments
- Firefox: not currently supported
- Mobile browsers and ChromeOS: not currently validated

Browser support claims require both automated checks and the manual release matrix below. Record exact browser and operating-system versions in release notes.

## Test layers

### Unit and DOM tests

Vitest and jsdom cover score conversion, catalog indexing, settings, options behavior, selectors, badge insertion, dynamic updates, error handling, and privacy-relevant request behavior.

Run:

```bash
npm test
npm run test:coverage
```

Coverage thresholds are enforced in `vitest.config.js`. These tests do not prove that a real browser can load or render the packaged extension.

### Fixture-based browser tests — planned

Add browser tests that load the real unpacked extension against local HTML fixtures representing Browse, Library, Series, and dynamic modal states. This layer should verify:

- Manifest V3 extension loading
- Content-script injection
- Badge placement and styles
- All three behavior modes
- Settings persistence and live updates
- Dynamic cards and modals
- Absence of duplicate native badges
- No unexpected console errors or network destinations
- Subtitle layout: with fixtures that mirror Dreaming's Shaka subtitle container and YouTube's caption structure, each subtitle style keeps the caption on screen and above the progress bar at both a windowed and a fullscreen-sized viewport, and revealing restores the player's own position. jsdom has no layout engine, so the unit tests cannot cover this; a CSS bug that hid YouTube captions in windowed mode passed all unit tests before being found live.
- The options page renders and its subtitle preview applies each style

Use a lightweight runner that drives an already installed browser, evaluating `puppeteer-core` first; Playwright was considered too heavy for this project. Run it as a separate command (for example `npm run test:browser`) so `npm test` stays fast. Branded Chrome ignores `--load-extension` in recent versions, so extension-loading tests need Edge, Chrome for Testing, or Chromium; layout tests that only need `subtitles.css` and a fixture page do not load the extension at all. Use local fixtures so CI needs no Dreaming account. Fixtures encode our understanding of Dreaming's and YouTube's markup, so they guard against regressions in our code but do not replace the live-site smoke tests below.

### Live-site smoke tests

Live-site tests remain manual because Dreaming pages require account state and can change independently. Never place Dreaming credentials, session cookies, or browser profiles in source control or CI.

Test these views where available:

- Browse with no sort and with each non-difficulty sort (Random, Short, Long, Old, New): Dreaming shows only durations, so extension badges appear in both behaviors
- Browse sorted by Easy and by Hard: Dreaming's own difficulty badges remain in Fill missing only and are replaced by extension badges in Enhanced everywhere
- Library History
- My list videos
- My list series
- Series catalog at each level
- Series modal cover and episode cards
- Watch page video and series chips with Dreaming's player and YouTube, including sidebar navigation between videos
- Spanish and French routes
- First install (remove the extension, then load it again) opens the options page once; reloading or updating the extension does not
- With a Dreaming tab open and subtitles on, reload the extension in `chrome://extensions`: without reloading the tab, a settings change still applies, and the reveal key reveals once (not twice, which would show two copies running)
- Options page, subtitles on: holding the reveal key reveals both previews in Hold mode; in Toggle mode each press (or a click on a preview) toggles and auto-hide applies; after choosing a new key only the new key works, and pressing the current key while choosing records it without revealing
- Options page: each change saves without a Save button and updates an open Dreaming tab; Restore defaults
- Difficulty badges switched on and off
- Subtitles: with the player's Settings > Subtitles set to Off, nothing changes and the reveal key does nothing; with it set to Spanish (or French), each style (Blur, Small and faint, Hidden) applies, including in fullscreen
- Subtitles: Hold reveals only while the key is down; Toggle flips on each press and auto-hides after 3, 5, and 10 seconds, or stays with auto-hide off
- Subtitles: switching to another window while revealed hides the subtitles again; the reveal key does nothing while typing in a comment box
- Subtitles: changing the reveal key in options, including rejection of Space and Escape cancelling capture
- Subtitles on a YouTube-served video, in both windowed and fullscreen: with YouTube's CC on, captions follow the chosen style in their normal position above the progress bar; the reveal key works both after clicking inside the YouTube player and with focus on the Dreaming page; with CC off, nothing changes
- Subtitles in picture-in-picture: expected to show no subtitles on either player (known browser limitation)
- Difficulty badges and subtitles switched on together, separately, and both off on a watch page, for both a Dreaming-player video and a YouTube-served video
- Enhanced everywhere and Fill missing only
- Enhanced and Dreaming styles
- Small, Medium, and Large sizes
- All four positions
- Extension install/update followed by the required page refresh

Confirm that the extension never exposes premium video content or modifies playback access.

### Live-site browser automation — exploration in progress

Status as of 2026-11-07. This records a first attempt to automate the live-site smoke tests above, done while verifying the 0.10.1 beta, so the work can be picked up later. The likely next step is a Playwright suite, which needs an approved plan first.

#### What was tried

Three ways of driving a browser were used during the 0.10.1 beta pass:

1. **Claude in Chrome** (the Claude browser extension acting in the maintainer's real, logged-in Chrome). It works on `app.dreaming.com` pages: it read computed styles, clicked and inspected the player. It **cannot open `chrome-extension://` pages**, so it cannot drive the options page, and therefore cannot change the extension's settings. Every settings change would have to be made by hand. It also cannot load or reload an unpacked extension, because `chrome://extensions` is off-limits to it.
2. **Headless Edge over the Chrome DevTools Protocol (CDP)**, launched with `--headless=new --user-data-dir=<throwaway profile> --load-extension=<extracted release ZIP> --remote-debugging-port=<port>`. A small Node script (built-in `WebSocket`, no dependencies) attached to targets with `Target.attachToTarget` (flatten mode). It drove pages with trusted input from `Input.dispatchKeyEvent` and `Input.dispatchMouseEvent`. It changed settings by evaluating `chrome.storage.sync` in the extension's service worker. It emulated dark mode with `Emulation.setEmulatedMedia`. This worked well, including on the options page. Branded Google Chrome ignores `--load-extension` in recent versions, which is why Edge was used.
3. **Headless Edge, logged out, against two free-tier videos**: a Dreaming-player video (`watch?id=5e4d121caac87f3820954cb5`) and a YouTube-served video (`watch?id=6ae0934444135614096a680f`).

The scripts lived in a session scratch directory and were not committed. Their approach is described here; the code is about 250 lines and easy to recreate.

#### Results for 0.10.1 (published ZIP, SHA-256 verified)

**Options page, headless Edge, fresh profile: 32 of 32 checks passed.**
- **Install:** the options page opened by itself on first install, version 0.10.1, both tools off with their controls disabled, no Save button.
- **Saving:** auto-save worked for checkboxes and selects and survived a page reload. Restore defaults rewrote storage and the form.
- **Theme:** light and dark change the page, card and text colors. Screenshots of both were reviewed and are readable.
- **Previews, Hold:** the `S` key anywhere on the page reveals both previews, key release hides them, and key repeat is ignored. Pressing and releasing on a preview reveals and hides.
- **Previews, Toggle:** a press reveals, a second press hides, and auto-hide at 3 seconds works. A click on a preview toggles, and leaving the preview does not hide. Changing the reveal mode while revealed hides.
- **Choosing a key:** pressing `S` while choosing a key records it without revealing, and after re-binding only `J` works. Space is rejected with a message and Escape cancels capture. The key is ignored with Ctrl held and while a select is focused.
- **Badge preview:** it follows style, size and position, and switching badges off shows the "disabled" pill.

**Dreaming, logged out (headless Edge), Enhanced everywhere:**
- Browse: 92 of 92 video cards badged.
- Series: 40 badges.
- The gated watch page's sidebar: 53 of 54 cards badged. The one unbadged card was not investigated. It may be the current video's own entry; see the open questions below.

**Dreaming, logged in (maintainer's Chrome, via Claude in Chrome):**
- The first look found the old pre-0.10.1 copy still loaded: the Shaka container still had the extension's removed `filter/opacity/scale` transition. Lesson: confirm the loaded version before a pass. A content-script page cannot read the extension's version, so checking the computed styles was the tell.
- After the published ZIP was installed in place of the old copy, an already-open watch tab picked up the new install without a reload. The old classes were cleared, because both tools start off, and the container's transition was Dreaming's own `bottom 0.1s cubic-bezier(0.4, 0, 0.6, 1)`. Together these confirm the tab refresh on install and the 0.10.1 transition fix.

**Not yet verified on 0.10.1:** the subtitle checks on both players:
- each style
- Hold and Toggle
- the glide while the controls show
- the stranded Toggle reveal
- window blur
- the reveal key inside the YouTube frame
- fullscreen

Also not yet verified: Library and My list, Fill missing only, and the rest of the badge matrix while logged in.

#### Findings that shape the automated suite

- **Logged out, no video plays, even free-tier ones.** Both free videos show "Create a free account to watch" with no `<video>`, Shaka container or YouTube iframe. So subtitle tests always need a logged-in (free) account. Badge tests on Browse, Series and watch-page sidebars work logged out.
- **Free and premium accounts are a separate question** from logged in and logged out. Whether a free account can play the two videos above has not been checked.
- **A dedicated test profile is the safe way to log in.** The maintainer logs in by hand, once, in a browser profile used only for testing; automation reuses that profile's session. This keeps to the rule in `PUBLISHING.md` that automation never logs in or stores Dreaming credentials. The profile directory must stay outside the repository and out of CI.
- **Use the extension's own pages and service worker for setup.** Writing settings through `chrome.storage.sync` in the service worker is fast and reliable for arranging a test. The options-page checks should still drive the real controls with trusted input, as above.
- **Trusted input matters.** The reveal key must come from real browser input events (CDP `Input.*`, or Playwright's keyboard, which uses them), not synthetic `dispatchEvent` calls, to match how Dreaming and YouTube receive keys. Inside the cross-origin YouTube frame the test has to target that frame.
- **The extension ID changes per unpacked folder** (for example `okdlgbpcoccnaiabnkfibamoknhlmbnc` in the headless run, `bmefdflimlhbkanigomkpcnedcodelif` in the maintainer's Chrome). A suite should read it from the service worker target's URL, not hard-code it.
- **Install and update checks need control of the extension.** Use the service worker's `chrome.runtime.reload()` to simulate an update, and a fresh profile for a first install.

#### Open questions

1. **Playwright or a small CDP harness?** The fixture-based plan above prefers `puppeteer-core` because Playwright was considered too heavy, and the global guidance discourages Playwright for simple browser apps. Against that, the live suite has to:
   - log in through a persistent profile (`launchPersistentContext`)
   - reach cross-origin frames
   - send trusted keys
   - load extensions in Playwright's bundled Chromium, which still supports `--load-extension`

   Decide and record the choice in `DECISIONS.md`.
2. **Which browser binary?**
   - Playwright's bundled Chromium: reproducible, but not what testers run.
   - Installed Edge: close to a real browser.
   - Chrome for Testing: branded Chrome behavior with extension loading.

   Can one suite run against more than one?
3. **Headless or headed?** Headless Edge played no video in this pass only because of the login gate. Unknown: whether Shaka and the YouTube embed play, and show captions, in headless mode (codecs, autoplay policy). Fullscreen and picture-in-picture probably need a headed run.
4. **How to make captions appear on demand?** Dreaming's player needs Settings > Subtitles set to a language and YouTube needs CC on. Is that a persistent per-account setting, a per-video one, or a player-local one, and can a test set it without clicking through menus?
5. **How to measure "the line glides"?** For example, sample the container's `bottom` across the controls' show and hide, or check that `transitionstart` fires.
6. **Which free videos to pin?** Choose stable free videos with Spanish captions for both players, and French equivalents. Record them in this file. Watch for removal.
7. **Logged-out runs?** Are they worth keeping as a separate, credential-free job, possibly in CI? It would only cover badges. A scheduled catalog check is already proposed in `PUBLISHING.md`.
8. **The 53 of 54 sidebar card:** is the unbadged card expected (the current video, an item with no catalog difficulty), or a bug?
9. **Where does the suite live?** For example, `tests/live/` with `npm run test:live`, excluded from `npm test` and from CI. Where does the test profile live: a path in an environment variable, outside the repo?

#### Pending from the 0.10.1 beta

The v0.10.1-beta.1 release notes still lack a manual-testing line under Verification. Add one (`gh release edit v0.10.1-beta.1 --notes-file …`) after the logged-in subtitle checks above are run, listing only what was actually verified.

## Release browser matrix

| Browser | macOS | Windows | Linux |
|---|---|---|---|
| Chrome current stable | Required | Required | Required |
| Chrome previous stable | Required on the primary development platform | Risk-based | Risk-based |
| Chrome Beta | Pre-release smoke on the primary platform | Optional | Optional |
| Edge current stable | Optional | Required | Optional |

`Required` coverage may come from physical machines, virtual machines, trusted beta testers, or a reputable browser-testing service. For each required cell, record:

- Browser name and exact version
- Operating system and exact version/distribution
- Extension version and installation source
- Dreaming language and account type
- Checklist result and linked issues

Do not block emergency compatibility fixes on every optional cell, but document skipped tests and risk.

## Platform-specific checks

Across platforms, inspect:

- Font rendering and badge dimensions
- Display scaling and browser zoom at 80%, 100%, 125%, and 150%
- Narrow and wide desktop windows
- Light/dark operating-system settings
- Keyboard access and visible focus on the options page
- Screen-reader names for inserted badges
- High-DPI/Retina displays where available

The extension does not use native binaries or platform APIs, so behavioral differences should be limited mainly to rendering, scaling, and browser policy.

## Security and privacy checks

Before release:

- Run `npm audit` and review rather than blindly forcing dependency upgrades.
- Confirm the manifest requests only the `storage` and `scripting` permissions, Dreaming host access, and the YouTube embed content-script match (pinned by `tests/package.test.js`).
- Confirm catalog fetches use `credentials: "omit"`.
- Confirm no analytics, trackers, remote code, `eval`, HTML injection, cookies, history, or credential APIs were added.
- Run `npm run package` and `npm run package:verify`; independently inspect the ZIP entry list and SHA-256 checksum.
- Inspect the package for `.env` files, keys, tokens, browser profiles, cookies, documentation, tests, dependencies, and unrelated files.
- Verify options contain only the settings documented in `src/settings.js` (`DEFAULT_SETTINGS`).
- Verify network activity is limited to Dreaming catalog requests and browser-managed settings sync.

See `SECURITY.md` and `PRIVACY.md` for the public policies.

## Compatibility incident process

When Dreaming changes:

1. Capture the affected route, card HTML, browser/platform, and extension settings without credentials or private account data.
2. Reproduce with a local fixture when possible.
3. Add a failing regression test.
4. Fix using stable attributes or semantic classes.
5. Run automated coverage and the affected manual matrix rows.
6. Publish a patch release and document the compatibility change.
