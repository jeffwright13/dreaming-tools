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
- Options page and Restore defaults
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
- Confirm the manifest requests only `storage` and Dreaming host access.
- Confirm catalog fetches use `credentials: "omit"`.
- Confirm no analytics, trackers, remote code, `eval`, HTML injection, cookies, history, or credential APIs were added.
- Run `npm run package` and `npm run package:verify`; independently inspect the ZIP entry list and SHA-256 checksum.
- Inspect the package for `.env` files, keys, tokens, browser profiles, cookies, documentation, tests, dependencies, and unrelated files.
- Verify options contain only the four documented enum settings.
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
