# Dreaming Difficulty Decisions

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

Fresh installations preserve Dreaming's native badges and add small, lower-left badges in Dreaming style only where difficulty is missing. Enhanced-everywhere behavior and styling remain available as explicit options. This least-intervention default reduces visual disruption while retaining full configurability; valid settings already stored by a user remain unchanged after an update.
