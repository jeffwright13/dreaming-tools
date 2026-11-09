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
- Subtitles in picture-in-picture: on a Dreaming-player video with subtitles on, switching tabs opens picture-in-picture, and its subtitles appear at normal size and readable (known limitation; the tool does not reach that window). YouTube-served videos do not open picture-in-picture on a tab switch
- Difficulty badges and subtitles switched on together, separately, and both off on a watch page, for both a Dreaming-player video and a YouTube-served video
- Enhanced everywhere and Fill missing only
- Enhanced and Dreaming styles
- Small, Medium, and Large sizes
- All four positions
- Extension install/update followed by the required page refresh

Confirm that the extension never exposes premium video content or modifies playback access.

### Live-site browser tests (Playwright)

A Playwright suite in `tests/live/` automates most of the live-site smoke tests above. It loads the packaged extension (`dist/dreaming-tools-VERSION.zip`, checked against the runtime file list) into a real browser and visits `app.dreaming.com`. It runs locally only: it is excluded from `npm test` and from CI, because it depends on the live site and, for the logged-in tests, on a Dreaming login. The reasons for choosing Playwright, and the rules below for account state, extension reloads, and window blur, are in `DECISIONS.md`.

#### Run

Requires Node.js 22 or later, as declared in `engines` in `package.json`. The suite extracts the ZIP with the packaging script's own `extractZip`, so it needs no system `unzip`.

One-time setup:

```bash
npx playwright install chromium   # Playwright's own Chromium, about 100 MB
npm run test:live:login           # opens the test profile; log into Dreaming by hand, then close the window
```

Then:

```bash
npm run test:live                 # packages the extension, then runs every live test
```

A full run takes about 4 minutes.

Options:
- `LIVE_BROWSER=edge` runs the installed Microsoft Edge instead of Playwright's Chromium. The tab-refresh test always uses Edge (see below).
- `HEADED=1` shows the browser window.
- `DREAMING_TEST_PROFILE=<dir>` chooses the logged-in profile. The default is `~/.dreaming-tools-test-profile`.
- `--project=logged-out` or `--project=logged-in` runs one half.

The HTML report is written to `playwright-report/` and failure traces to `test-results/`. Both are git-ignored.

#### Profiles and accounts

Playwright projects:
- **`logged-out`:** a new, empty profile for every test, deleted afterwards. Every test is therefore a first install.
- **`logged-in`:** the persistent test profile. If the profile is missing, or no longer logged in, these tests skip with a message saying to run `npm run test:live:login`.
- **`logged-in-setup` and `logged-in-teardown`:** these run before and after `logged-in`. Driving Dreaming's player changes the account's subtitle language, which Dreaming stores server-side.
  - Setup records the current choice in `<profile>.subtitle-choice.json`.
  - Teardown sets it back and deletes the file, even when tests fail. A forced failure after a test switched the account to Off was restored to Spanish.
  - Setup never overwrites an existing record, so a run that crashed before restoring still holds the true original.

The login helper only opens a window. You log in by hand and the browser keeps the session in the profile. No script reads, types or stores credentials, which keeps to the rule in `PUBLISHING.md`. The profile stays outside the repository and is never copied into CI or shared. The current test profile uses a free account.

The tests are read-only toward the account in every other way:
- they never add to the Library or My list
- they never submit a comment: the comment check types one letter and clears it
- they skip a page with nothing to check

Each run loads the extension from a new temporary folder, so Chrome treats it as a first install and opens the options page. In the logged-in profile the fixture closes that tab before the test starts.

#### What the suite covers

Results on 0.10.2, Chromium, 2026-11-09: 43 passed and 2 skipped. On 0.10.1 the results held across two consecutive full runs, and the logged-out project also passed in Edge, 19 of 19.

**Logged out**
- **`options.spec.js` (9):**
  - the page opens by itself on first install
  - auto-save and reload
  - light and dark theme
  - Hold and Toggle previews by key and mouse
  - choosing a reveal key
  - ignored keys
  - the badge preview
  - Restore defaults
- **`badges.spec.js` (9), in Spanish and French.** Every card is checked against the language's public catalog: one badge showing the catalog's number when the video has a difficulty, none when it doesn't. Pages:
  - Browse
  - Browse sorted by Easy (Dreaming's own badges replaced)
  - Series, with the carousels scrolled so every card loads

  Also, in Spanish:
  - the login-gated watch page's sidebar
  - Fill missing only (Dreaming's badges kept, no duplicates)
  - badges switched off
- **`tab-refresh.spec.js` (1), in Edge:**
  1. Reload the extension with a Browse tab open.
  2. Change settings through the new service worker.
  3. Without a tab reload, the page's subtitle class and badge size follow the change, each card still has exactly one badge, and the tab never navigated.

**Logged in**
- **`subtitles-dreaming.logged-in.spec.js` (11, plus 1 skipped):**
  - each style (Blur, Small and faint, Hidden) applies, and holding `S` shows the player's own style
  - Hold with key repeat
  - Toggle with a 3 s auto-hide
  - the stranded Toggle reveal when the player's subtitles are turned off
  - nothing revealed with the player's subtitles off
  - window blur hides a reveal
  - the glide while the controls appear
  - fullscreen, which works headless: the subtitle line settles above the controls bar and keeps its style

  The comment-box check skips, because free accounts have no comment box.
- **`subtitles-youtube.logged-in.spec.js` (9):**
  - each style, with `S` held in the player
  - `S` held with focus on the Dreaming page (forwarded to the frame)
  - Toggle with auto-hide
  - nothing visible with CC off
  - window blur on the page hides a reveal in the frame
  - fullscreen
- **`badges.logged-in.spec.js` (4, plus 1 skipped):**
  - Library History
  - the series modal's episode cards and cover range
  - watch-page chips (`Difficulty N` and the series range) matching the catalog, and following client-side navigation to another free video

  My list skips because it is empty.

Two deliberate breaks were caught:
- With auto-save disabled, 5 options tests failed.
- With the reveal removed from `subtitles.css`, the 7 tests that check what is visible on both players failed.

**Still manual:**
- picture-in-picture
- switching to a real second window
- a comment box, which needs an account that can comment
- My list, which needs saved items
- platforms other than macOS
- browser zoom and display scaling

#### Findings

These come from the exploration on 2026-11-07 and from building the suite.

**Login and playback.**
- Logged out, no video plays, not even free-tier ones. Badge tests work logged out; subtitle tests need a login.
- Logged in, both pinned videos play in headless Chromium, including fullscreen.

**Driving the Dreaming player** (see `tests/live/players.js`).
- Shaka's control overlay intercepts clicks on the `<video>`, so use its "Play", "Video settings" and "Full screen" buttons with `force: true`.
- The settings menu (`[data-testid="video-settings-menu"]`) stays open after a choice, and its button toggles it. The active subtitle option has the class `ds-video-settings-menu__option--active`.
- Right after the page loads, the menu can briefly show "Off" before the player applies the account's choice. Read it only once it agrees with whether `.shaka-text-container` exists.
- The video resumes where the account last stopped, which may be a stretch with no speech. Seek to a spoken stretch (40 s in the pinned video) before measuring a subtitle line.
- Shaka's caption container covers the whole player, so layout checks measure the line itself.
- When the controls appear, Dreaming moves the line up after a 0.5 s delay and a 0.1 s transition. A check made immediately finds the line overlapping the controls bar.

**Driving the YouTube embed.**
- Dreaming autoplays the embed. A click in the frame plays or pauses it, and `c` (captions) and `f` (fullscreen) work once the frame has focus.
- The CC button's `aria-label` reads "Subtitles/CC turned on" or "turned off".
- With CC off, the frame may still consume `S` and set its revealed class, because YouTube keeps the caption container mounted. SPEC.md accepts this because nothing becomes visible, and the test checks just that.
- YouTube's "(auto-generated)" notice is a second caption window, and the extension blurs it too.

**Badges.**
- Series carousel cards have no image, and so no series ID, until scrolled into view.
- Dreaming's series modal now uses `.ds-series-modal__hero` instead of `.ds-series-modal__header`. The live suite caught this on 2026-11-09, when the modal cover lost its range badge; the extension now targets both classes.
- Some sidebar videos are premium-only; a free account cannot open them, so navigation tests pick a free one.

**Browsers and test setup.**
- Claude in Chrome cannot open `chrome-extension://` or `chrome://extensions` pages.
- Branded Google Chrome ignores `--load-extension`. Playwright's Chromium (Chrome for Testing) and installed Edge accept it, headless included.
- `chrome.runtime.reload()` unloads the extension for good in Chrome for Testing: its pages then fail with `ERR_BLOCKED_BY_CLIENT`. In Edge it reloads and a new service worker starts. Hence the tab-refresh test runs in Edge.
- The extension ID differs per unpacked folder, so the suite reads it from the service worker's URL.
- Playwright does not treat a disabled `<fieldset>` itself as disabled; check a control inside it.

**Verifying a build.** In the maintainer's Chrome, the first look during the 0.10.1 pass found a pre-0.10.1 copy still loaded. Confirm the loaded version before a manual pass.

#### Remaining work

- **Gaps that need a different account state:** My list and the comment box.
- **CI:** a logged-out CI job (options and badges) is deferred until the tests prove stable against the live site. A scheduled catalog check is already proposed in `PUBLISHING.md`.
- **Fixture-based layer:** it can share this runner. See above.

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
