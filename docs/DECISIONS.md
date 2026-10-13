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
