# Dreaming Tools Decisions

## 2026-10-13: Use the public catalog without account authentication

The extension reads `https://app.dreaming.com/videos/prod/es.json`, which contains video IDs, series IDs, and raw difficulty scores. Account credentials and session data are unnecessary for enhancing cards already rendered by Dreaming.

## 2026-10-13: Reproduce Dreaming's score conversion

Dreaming's client converts raw ratings from the range 200–2600 to a rounded 0–100 value. Reproducing that calculation keeps extension badges consistent with native badges.

## 2026-10-13: Show series ranges

A series has no individual difficulty score. The extension displays the minimum and maximum rounded episode difficulties, or one value when all scored episodes round identically.

## 2026-10-13: Use a framework-free Manifest V3 content script

The feature requires only catalog indexing, DOM matching, badge insertion, and mutation observation. Plain JavaScript avoids a build step and keeps local installation transparent.

## 2026-10-13: Own extension badge styling

Stable data attributes and semantic Dreaming class names identify cards, while extension-specific classes style inserted badges. Generated CSS-module class names are intentionally avoided because they can change between deployments.

## 2026-10-13: Offer behavior and appearance presets

A synchronized options page offers Enhanced everywhere, Fill missing difficulties only, and Original Dreaming behavior. Appearance uses tested style, size, and position presets instead of arbitrary CSS controls to preserve readability and contrast.

## 2026-10-13: Select catalogs from language routes

The product is Dreaming rather than a Spanish-only service. The extension maps `/spanish/` to `es.json` and `/french/` to `fr.json`, uses language-neutral terminology, and keeps the route-to-catalog mapping easy to extend.

## 2026-10-13: Support desktop Chromium browsers first

The initial support policy covers the current and previous stable Chrome versions across macOS, Windows, and Linux, plus current Edge on Windows. Shared Chromium internals reduce implementation risk, but release claims still require a manual browser/platform matrix. Firefox and mobile support remain separate future features.

## 2026-10-13: Use layered compatibility testing

Vitest and jsdom remain the fast gate for logic and DOM behavior. Planned fixture-based browser tests will load the real extension without Dreaming credentials, while authenticated live-site smoke tests remain a manual release gate. CI must never store Dreaming credentials, cookies, or browser profiles.

## 2026-10-13: Keep permissions and data flow minimal

The extension stores only validated display preferences, fetches public catalogs with credentials omitted, and has no developer server or analytics. Chrome synchronized storage may pass preferences through the user's Google account, but the developer does not receive them. Any future permission, network destination, storage field, telemetry, or authentication change requires renewed security review and updated privacy disclosure.

## 2026-10-13: Use neutral original branding for beta icons

The icon combines a play symbol with ascending difficulty bars in the extension's charcoal and green palette. It does not copy Dreaming's logo or imply endorsement, reducing branding risk before outreach to Dreaming Languages.

## 2026-10-13: Package from an exact runtime allowlist

A dependency-free Node script creates a deterministic ZIP from the manifest, four PNG icons, and six runtime source files. It rejects version mismatches, missing manifest references, and unexpected archive contents. Development files, credentials, documentation, tests, and dependencies cannot enter the package through directory-wide copying.

## 2026-10-13: Protect main with mechanical gates

Changes to `main` require an up-to-date pull request, the `Test and audit` status check, linear history, and resolved conversations. Force pushes and branch deletion are blocked, and administrators are subject to the rule. No approving review is required while the project has a single maintainer, avoiding a self-review deadlock while retaining CI and pull-request history.

## 2026-10-13: Default to preserving Dreaming's presentation

Fresh installations preserve Dreaming's native badges and add small, upper-right badges in Dreaming style only where difficulty is missing, matching Dreaming's native placement. Enhanced-everywhere behavior and styling remain available as explicit options. Lower-right placement is excluded because Dreaming reserves that corner for video duration. This least-intervention default reduces visual disruption while retaining safe configurability; valid supported settings already stored by a user remain unchanged after an update.

## 2026-10-19: Show watch-page difficulty as metadata chips

Watch pages show video difficulty, plus the series range when applicable, as chips at the start of Dreaming's metadata badge row instead of overlaying the player. An overlay would compete with player controls and changing frames, disappear in fullscreen unless injected into the player, and cannot enter the cross-origin YouTube embed. The row has stable `data-testid` hooks shared by both player variants. The extension does not detect or defer to other extensions that add similar chips, because coupling to third-party markup is fragile; users running both may see duplicate information.

## 2026-11-05: Grow into Dreaming Tools as one extension with feature switches

The repository will host more than the difficulty badges, starting with a subtitle de-emphasis tool for listen-only practice. The extension is renamed Dreaming Tools and stays a single extension, with an independent enable switch per feature, rather than becoming several extensions or repositories. All planned tools run on the same Dreaming pages with the same host permission, so separate extensions would add installs, release processes, and duplicated packaging without reducing permissions. The extension was unpublished at the time of the rename, so no store listing or users' installs are broken. Synchronized storage keys are unchanged, so beta testers keep their settings.

## 2026-11-05: Replace Original Dreaming mode with an enable switch

The difficulty feature's Original Dreaming behavior was already an off switch. Keeping it next to a per-feature enable switch would offer two controls for the same state, so it was removed. A stored `behavior: "original"` migrates to `difficultyEnabled: false` during normalization; an explicitly stored switch takes precedence. Settings are read by key list rather than with defaults, because Chrome fills defaults into the result and would otherwise hide the legacy value. A disabled difficulty feature no longer downloads the catalog, which also slightly reduces network use compared with the old Original mode.

## 2026-11-05: Isolate features behind a single update contract

Each feature exposes only `update(settings)` and receives the whole normalized settings object, and `content.js` calls every feature independently, logging rather than propagating a feature's error. This keeps features unaware of one another, lets any combination be enabled at once, and lets a broken feature fail without disabling the rest. Content scripts remain classic scripts sharing `globalThis` namespaces because Manifest V3 content scripts do not support ES module imports.

## 2026-11-05: Style subtitles through root classes, never the player

The subtitles feature sets classes on `<html>` and a static stylesheet targets Shaka Player's `.shaka-text-container`, instead of editing the player or observing subtitle mutations. The container exists only while the player's own Subtitles setting is on, so the player's choice remains the single source of truth and the extension never turns subtitles on. Styling through CSS survives the player re-creating the container, works in fullscreen, and needs no page observer. The class comes from the Shaka library rather than Dreaming's generated CSS-module names, consistent with the brief.

## 2026-11-05: Make subtitle de-emphasis opt-in with blur as the default

Subtitles default to off so the update changes nothing until a learner chooses it. Blur is the default style because it is unreadable at a glance yet still shows that a line is present; Small and faint keeps the learner's existing habit of tiny on-screen text, and Hidden removes even the blurred bar. All three are presets, matching the earlier decision to offer tested presets rather than arbitrary CSS.

## 2026-11-05: Reveal with a configurable physical key, hold or toggle

Learners differ, so reveal is configurable: Hold (default, because releasing the key always restores the listen-only state) or Toggle with auto-hide (default 5 seconds, so a toggle cannot be forgotten). The key is stored as `KeyboardEvent.code` so it is layout independent and limited to letter, digit, and punctuation keys; `S` was verified on a live watch page to trigger no player shortcut. Key handling runs in the capture phase and consumes the key only while subtitles are shown and the user is not typing, so other pages and the comment box behave normally. Losing window focus re-hides because the key release may never arrive. Replaying the previous line was considered and deferred to keep the first version small.

## 2026-11-05: Read options controls directly instead of FormData

Saving through `FormData` reset a switched-off feature's settings, because `FormData` omits controls inside a disabled fieldset; the difficulty options had this bug since the enable switch was added. The options page now reads every setting from its control, which also handles checkbox and numeric values explicitly.

## 2026-11-05: Extend subtitles into YouTube embeds with a guarded content script

Dreaming now serves many videos through a cross-origin YouTube embed, whose captions the Dreaming page cannot style or observe. A second content script runs in `https://www.youtube.com/embed/*` frames and acts only when its immediate and only ancestor is `https://app.dreaming.com`; the manifest cannot express that restriction, so the check runs first and exits otherwise. This adds www.youtube.com to Chrome's install warning, which was accepted because otherwise the feature would not work on most current videos; the privacy policy discloses the access. Reveal keys pressed on the Dreaming page are forwarded to the frame by `postMessage` with an exact target origin, and the frame accepts only Dreaming-origin messages of a fixed shape, so other pages cannot drive it. Drawing replacement captions from YouTube caption data was rejected as far more complex and as requiring the extension to handle subtitle text. YouTube's caption class names are not a public interface, a documented maintenance risk.

## 2026-11-06: Lead with subtitles and make difficulty badges opt-in

The options page now has one card per feature, Subtitles first and Difficulty badges second, each with its enable switch followed by subsections. Previously difficulty filled four panels and subtitles one, so the page did not read as two features. Subtitles is the extension's main draw, and a separate difficulty extension already exists in the Chrome Web Store; this one should not compete with it by default. Reordering alone would still show badges on a fresh install, so `difficultyEnabled` now defaults to off, matching subtitles. The cost is that a fresh install does nothing visible until the options page is opened; opening it automatically on install is recorded in TODO.md. Users who never saved options run on the defaults, so changing a default would normally switch the feature off for them on update; that was acceptable here because the extension had no users besides its author.

## 2026-11-06: Save options automatically

Leaving the options page with unsaved changes silently discarded them. A leave-page warning (`beforeunload`) was considered, but Chrome shows only a fixed generic message and it treats the symptom. Saving every change immediately removes the unsaved state altogether, matches Chrome's own settings pages and most extension options pages, and fits the existing behavior of open Dreaming tabs updating live through storage change events. The cost is that a set of trial changes cannot be abandoned as a group; Restore defaults remains. Each write is one `chrome.storage.sync.set` per user action, far below sync's write-rate limits, and a failed write is reported on the page.

## 2026-11-06: Open the options page on first install

With every tool off by default, a fresh install looked like it did nothing. A background service worker now opens the options page on `onInstalled` with reason `install` only; opening it on updates or reloads would interrupt existing users for no reason. This adds the extension's first service worker but no permission. The same worker is the planned home for injecting the current content script into Dreaming tabs that were open during an install or update, which is kept as a separate change because it needs the `scripting` permission and a handover between old and new script copies.

## 2026-11-06: Refresh open Dreaming tabs with the scripting permission

After an install or update, Dreaming tabs that were already open kept the orphaned previous content script, which ignores settings changes while its key listeners and page observer keep running; users had to know to reload. The background worker now injects the manifest's own content-script files into open, non-discarded Dreaming tabs on `install` and `update`. This adds the `scripting` permission, which Chrome shows no install warning for; it is limited to packaged files (never code strings or functions), and a test now pins the manifest's permission list so future changes are deliberate. Reloading the tabs was rejected because it would interrupt a playing video. Two copies would otherwise run in the page, so each copy announces itself with a `dreaming-tools:replaced` DOM event, which reaches scripts from every extension context; a running copy that hears it switches all features off, synchronously, before the new copy starts. Verified in headless Edge on a live Dreaming page: after an extension reload the old copy cleared its classes, the new copy restored them, and a later settings change applied without a tab reload. An orphaned copy is not made to stop itself when it detects that it is orphaned, because if injection fails the stale copy with its last settings is better than none. YouTube embed frames are not refreshed, since each new video loads a new frame.

## 2026-11-06: Theme the options page with tokens and original preview art

The options page gained dark mode, so every color became a `:root` token with a dark-mode value, and a stylesheet test enforces that (every token redefined, no literal colors outside token blocks), so a later change cannot silently add a color that only works in one theme. Preview caption colors are fixed tokens because they imitate the players, which do not follow the page theme. Text moved to `rem` after the page was seen at a smaller-than-default browser font size, where fixed pixel sizes made headings and body text disagree. The blank preview blocks became a blurred, original kitchen illustration (`preview-scene.svg`) rather than a frame from Dreaming, to avoid copyright and branding concerns; the kitchen matches the sample subtitle line. Subtitles get one preview per player, because the Dreaming and YouTube players draw captions differently and a single preview misrepresented one of them; each uses the player's real container class so the shipped stylesheet is what is previewed. The reload note moved from the header to the bottom of the page once open tabs began refreshing themselves, since it is now a fallback rather than a required step.

## 2026-11-06: Leave Dreaming's subtitle transition alone

A reported font and size mismatch on Dreaming's player turned out to be Dreaming's own caption font, which differs from YouTube's; Dreaming shows it the same with no extension installed, and with de-emphasis revealed the measured styles and screen captures matched having it off exactly. The investigation did find that the extension's `transition` on `.shaka-text-container` replaced Dreaming's own `transition: bottom 0.1s`, so the subtitle line jumped instead of gliding when it moved. Moving the styles to the subtitle lines, as for YouTube, was tried and rejected: verified live, Shaka sets an inline `opacity: 1` on each line, which defeats the Hidden and Small and faint styles. Overriding it with `!important` would break the rule that the extension never overrides the player's own styles, and copying Dreaming's exact transition value would drift when Dreaming changes it. The extension now sets no transition on Dreaming's player, so its effects switch instantly there; YouTube's captions keep their 120 ms fade. The options-page Dreaming preview now mirrors the real line structure (a block line inside the container).


## 2026-11-07: Use Playwright for live-site browser tests

The live-site smoke tests were manual, and a first automation pass showed what an automated suite needs. It has to log in through a persistent browser profile, load the unpacked extension, drive the extension's own options page and service worker, send trusted keyboard input, and reach into the cross-origin YouTube frame. Claude in Chrome cannot open extension pages, and a hand-written CDP script worked but would have grown into a homemade test runner. Playwright (`@playwright/test`) covers all of these directly: persistent contexts, frames, trusted input, its own Chromium with extension loading, an installed-Edge channel, and traces and reports. That reverses the earlier view, for the fixture layer, that Playwright was too heavy: the cost is one dev dependency and a separate browser download. Nothing ships in the extension, and `npm ci` downloads no browser. The suite runs the packaged ZIP, not the working tree, so it tests what users install. It runs locally only, outside `npm test` and CI, because it depends on the live site and on a login. Logins happen by hand in a dedicated profile outside the repository, and no script handles credentials. A logged-out CI job is deferred until the tests prove stable against the live site.

## 2026-11-09: Live-suite rules for account state, extension reloads, and window blur

Three choices in the logged-in Playwright tests are not obvious from the code.

**Account state.** Driving Dreaming's player changes the account's subtitle language, which Dreaming stores server-side, so the logged-in project runs between a setup project that records the choice and a teardown project that restores it. A worker-scoped fixture was rejected because Playwright restarts its worker after a failed test, and the new worker would record the already-changed value as the original. The record is a file next to the test profile, and setup never overwrites one, so an interrupted run that never restored still remembers the true original. Tests never add to the Library or My list and never submit a comment; a page with nothing to check is skipped.

**Extension reloads.** The tab-refresh test runs in the installed Edge even when the rest of the suite runs in Playwright's Chromium. Chrome for Testing unloads an extension loaded from the command line when it calls `chrome.runtime.reload()`, and never loads it again, so that browser cannot model an update. Edge reloads it, as Chrome does for users. Calling the refresh code directly was rejected because it would skip the `onInstalled` path the test exists to cover.

**Window blur.** Headless browsers have no second window to switch to, so the window-blur tests dispatch the window's `blur` event. That exercises the same listener a real window switch triggers, but not the browser deciding to send it, which stays on the manual checklist.

## 2026-11-09: Series modal badges target both the old and new cover classes

Dreaming renamed the series modal's `.ds-series-modal__header` to `.ds-series-modal__hero`, which removed the cover's range badge. The extension now targets both classes in `SERIES_CARD_SELECTOR` and in the `position: relative` rule that anchors the badge. Replacing the old class was rejected: keeping it costs one selector and leaves the badge working if Dreaming rolls the change back or serves the two layouts side by side. Dreaming's own stylesheet already positions the hero, so the badge lands correctly without our CSS line today (checked by removing it and re-running the live test). The line stays as a safeguard against Dreaming dropping that positioning, and it matches the other card types.

## 2026-11-09: Drop the community beta label; publish ordinary releases

The publishing plan called for a recruited community beta before the store: Spanish and French testers, free and premium accounts, several desktop platforms. Nobody signed up, so the beta label only marked GitHub releases as prereleases without producing any outside testing. Coverage now comes from the maintainer's manual passes and the live-site Playwright suite (Spanish and French, Chromium and Edge). Releases from 0.10.2 on are therefore ordinary GitHub releases, and `docs/BETA.md` became `docs/INSTALL.md`. The gaps a beta would have covered (Windows and Linux, premium accounts, display scaling, French by hand) are listed in each release's limitations rather than implied by a label. The `0.x` version still signals a young project, and the Chrome Web Store launch is a natural point for `1.0.0`. Separately, Dreaming Languages approved the extension in reply to the maintainer's outreach, so the contact item in phase 2 of `docs/PUBLISHING.md` is checked; its branding and support-channel questions stay open.
