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

Use the Playwright runner already set up for the live-site tests below (see `DECISIONS.md`), as a separate command (for example `npm run test:browser`) so `npm test` stays fast. Branded Chrome ignores `--load-extension` in recent versions, so extension-loading tests need Edge, Chrome for Testing, or Chromium; layout tests that only need `subtitles.css` and a fixture page do not load the extension at all. Use local fixtures so CI needs no Dreaming account. Fixtures encode our understanding of Dreaming's and YouTube's markup, so they guard against regressions in our code but do not replace the live-site smoke tests below.

### Live-site smoke tests

Live-site tests depend on account state and on pages that can change independently. Part of this list is automated by the Playwright suite in the next section; the rest remains manual. Never place Dreaming credentials, session cookies, or browser profiles in source control or CI.

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

### Live-site browser tests (Playwright)

A Playwright suite in `tests/live/` automates part of the live-site smoke tests above. It loads the packaged extension (`dist/dreaming-tools-VERSION.zip`, checked against the runtime file list) into a real browser and visits `app.dreaming.com`. It runs locally only: it is excluded from `npm test` and from CI, because it depends on the live site and, for the logged-in tests, on a Dreaming login. The reasons for choosing Playwright are in `DECISIONS.md`.

#### Run

Requires Node.js 22 or later, as declared in `engines` in `package.json`. The suite extracts the ZIP with the packaging script's own `extractZip`, so it needs no system `unzip` and runs the same way on Windows.

One-time setup:

```bash
npx playwright install chromium   # Playwright's own Chromium, about 100 MB
npm run test:live:login           # opens the test profile; log into Dreaming by hand, then close the window
```

Then:

```bash
npm run test:live                 # packages the extension, then runs every live test
npm run test:live:spike           # the playback spike only (logged in)
```

Options:
- `LIVE_BROWSER=edge` runs the installed Microsoft Edge instead of Playwright's Chromium.
- `HEADED=1` shows the browser window.
- `DREAMING_TEST_PROFILE=<dir>` chooses the logged-in profile. The default is `~/.dreaming-tools-test-profile`.

The HTML report is written to `playwright-report/` and failure traces to `test-results/`. Both are git-ignored.

#### Profiles and accounts

There are two Playwright projects:
- **`logged-out`:** a new, empty profile for every test, deleted afterwards. Every test is therefore a first install.
- **`logged-in`:** the persistent test profile. If the profile is missing, or no longer logged in, these tests skip with a message saying to run `npm run test:live:login`.

The login helper only opens a window. You log in by hand and the browser keeps the session in the profile. No script reads, types or stores credentials, which keeps to the rule in `PUBLISHING.md`. The profile stays outside the repository and is never copied into CI or shared.

Driving the Dreaming player changes the account's subtitle language, because Dreaming stores that choice with the account, not in the browser. The spike sets it to Spanish. Prefer a dedicated test account, or expect your own account's setting to change.

#### What the suite covers

All of the following passed on 0.10.1 in Playwright's Chromium and in Edge, logged out (15 tests, about 45 s).

**`options.spec.js`** has 9 tests, covering the same ground as the earlier 32-check script:
- the page opens by itself on first install, with both tools off and no Save button
- auto-save, and settings surviving a reload
- light and dark theme, with screenshots attached to the report
- Hold and Toggle previews by key and by mouse, with auto-hide timed by `page.clock`
- choosing a reveal key, including Space being rejected and Escape cancelling
- the key ignored with Ctrl held or while a control has focus
- the badge preview
- Restore defaults

A deliberate break (auto-save disabled) failed 5 of these tests.

**`badges.spec.js`** has 6 tests. Each video card is checked against Dreaming's public catalog: a card whose video has a difficulty gets exactly one badge, and one without gets none.

| Page | Result |
|---|---|
| Browse | 84 of 84 cards badged |
| Browse sorted by Easy | 80 of 80, with Dreaming's own badges hidden |
| Series | 361 of 361, after scrolling the carousels |
| The login-gated watch page's sidebar | 54 of 54 |

Two more tests check that Fill missing only keeps Dreaming's badges without duplicates, and that switching badges off leaves no extension badges.

**`playback-spike.logged-in.spec.js`** has 2 tests, tagged `@spike` and excluded from `test:live`. They passed headless, logged in, on 2026-11-07:
- **Dreaming player:** plays, Video settings → Spanish turns captions on, Blur applies, and holding `S` reveals. The caption container's `bottom` passes through intermediate positions (24 → 31.7 → 48.4 → 56 px) while the controls appear, which confirms the 0.10.1 transition fix by measurement.
- **YouTube-served video:** plays, YouTube's `c` shortcut turns captions on, Blur applies, and holding `S` with focus in the frame reveals.

#### Findings

These come from the first exploration on 2026-11-07, during the 0.10.1 beta pass, and from building the suite.

**Login and playback.**
- Logged out, no video plays, not even free-tier ones. The page shows "Create a free account to watch", with no `<video>`, Shaka container or YouTube iframe. Badge tests work logged out; subtitle tests need a login.
- Logged in, both pinned videos play in headless Chromium, so codecs and autoplay are not a problem.

**Driving the Dreaming player.**
- Shaka's control overlay intercepts clicks on the `<video>`, so use its buttons: "Play" and "Video settings" (use `force: true`, since the controls fade out).
- Subtitle options are `.ds-video-settings-menu__option` ("Off", "Spanish").
- The choice persists on the account. After a reload only a `token` is in localStorage, and the container is still present.

**Driving the YouTube embed.**
- Dreaming autoplays the embed. A click in the frame plays or pauses it and gives the frame keyboard focus, and `c` toggles captions.
- The CC button's `aria-label` reads "Subtitles/CC turned on" or "turned off".
- YouTube's "(auto-generated)" notice is a second caption window, and the extension blurs it too. That is expected, since the styles apply to every caption window.

**Badges.**
- Series carousel cards have no image, and so no series ID, until scrolled into view. The earlier "40 badges" on Series was this lazy loading, not a bug.
- The earlier "53 of 54" on the watch sidebar came from comparing every `watch?id=` link on the page with the badges. The suite counts thumbnails instead, and finds 54 of 54.

**Browsers and test setup.**
- Claude in Chrome cannot open `chrome-extension://` or `chrome://extensions` pages. It can inspect live Dreaming pages, but cannot change the extension's settings or load or reload it.
- Branded Google Chrome ignores `--load-extension`. Playwright's Chromium (Chrome for Testing) and installed Edge both accept it, headless included.
- The extension ID differs per unpacked folder, so the suite reads it from the service worker's URL.
- Tests arrange settings through `chrome.storage.sync` in the service worker, but the options tests drive the real controls with trusted input.
- Playwright does not treat a disabled `<fieldset>` itself as disabled; check a control inside it.

**Verifying a build.** In the maintainer's Chrome, the first look found a pre-0.10.1 copy still loaded. Confirm the loaded version before a manual pass.

#### Remaining work and open questions

- **PR 2, logged-in subtitle tests**, built on the spike's steps:
  - each style (Blur, Small and faint, Hidden) on both players
  - Hold and Toggle with auto-hide
  - the stranded Toggle reveal (player subtitles turned off while revealed)
  - window blur
  - the key ignored while typing in a comment box
  - the reveal key with focus on the Dreaming page while a YouTube video plays
  - tab refresh after an update (`chrome.runtime.reload()` from the service worker)
- **Logged-in badge pages:** Library History, My list, series modals, and watch-page chips.
- **French routes:** pin French free videos and run the badge tests on French pages.
- **Headed-only checks:** fullscreen and picture-in-picture probably need `HEADED=1`. This hasn't been tried yet.
- **Free and premium accounts:** whether a free account plays both pinned videos depends on the account used in the profile. Record which kind the profile uses.
- **CI:** a logged-out CI job (options and badges) is deferred until the tests prove stable against the live site. A scheduled catalog check is already proposed in `PUBLISHING.md`.
- **Fixture-based layer:** it can share this runner. See above.

#### Pending from the 0.10.1 beta

The v0.10.1-beta.1 release notes still lack a manual-testing line under Verification. What is verified so far:
- the options page: the 9 tests above
- logged-out badges
- logged in, the tab refresh on install
- logged in, both players: Blur, the Hold reveal and the glide fix

Add the line with `gh release edit v0.10.1-beta.1 --notes-file …`, listing only what was verified, after PR 2's checks run or as it stands.

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
