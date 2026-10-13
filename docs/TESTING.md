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

Playwright with Chromium is appropriate for this layer even though unit tests remain the default for pure logic. Use local fixtures so CI needs no Dreaming account. Test Chrome stable and beta channels where practical; Chromium testing alone does not fully substitute for release smoke tests in branded Chrome and Edge.

### Live-site smoke tests

Live-site tests remain manual because Dreaming pages require account state and can change independently. Never place Dreaming credentials, session cookies, or browser profiles in source control or CI.

Test these views where available:

- Browse with native difficulty badges
- Library History
- My list videos
- My list series
- Series catalog at each level
- Series modal cover and episode cards
- Spanish and French routes
- Options page and Restore defaults
- Enhanced everywhere, Fill missing only, and Original Dreaming
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
- Inspect the package for `.env` files, keys, tokens, browser profiles, cookies, and unrelated files.
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
