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

