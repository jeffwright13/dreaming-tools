# Dreaming Difficulty Specification

## Language selection

Map `/spanish/` pages to the `es` catalog and `/french/` pages to the `fr` catalog. Download `https://app.dreaming.com/videos/prod/{language}.json`. Unsupported paths remain unchanged.

## Video difficulty

Convert each catalog `difficultyScore` to Dreaming's displayed 0–100 value:

```text
round(clamp((difficultyScore - 200) / 24, 0, 100))
```

Match rendered videos by their `data-video-id` attribute.

## Series difficulty

Match a series using the 24-character ID in its image URL or `series` URL parameter. Collect rounded difficulties for all scored catalog videos with that `seriesId`.

Display the minimum and maximum as `minimum–maximum`. Display one number when both endpoints are equal. Omit the badge when no scored episodes exist.

## Watch page

On a watch page, read the video ID from the `id` URL parameter and insert chips at the start of the `[data-testid="video-badges"]` row, before Dreaming's level badge. Show `Difficulty N` for a scored video, followed by `Series minimum–maximum` when the video belongs to a series with scored episodes. Omit chips the catalog cannot support.

Watch-to-watch navigation is client-side and may reuse or replace the badge row, so chips are updated when the URL's video ID changes. Because the page observer reruns enhancement on every child-node change, chip updates must not modify child nodes when chips are already current.

Chips apply the configured style. Size and position apply only to thumbnail badges. Original behavior removes the chips. Both other behaviors insert them, because Dreaming shows no difficulty on the watch page.

## Options

Store synchronized settings with these defaults:

- Behavior: Fill missing difficulties only
- Style: Dreaming
- Size: Small
- Position: Upper right

Enhanced-everywhere behavior hides native difficulty badges and inserts configured badges. Fill-missing behavior preserves native badges and inserts configured badges only where needed. Original behavior removes extension badges and restores native badges.

Styles are Enhanced and Dreaming. Sizes are Small, Medium, and Large. Positions are Upper right, Upper left, and Lower left; Lower right is unavailable because Dreaming uses that corner for video duration. A restore-defaults action saves and displays the default settings. Changes apply to open Dreaming pages through storage change events when the current content script is active.

## Dynamic content

Process the initial document after downloading the catalog. Observe descendant additions and reprocess the document on the next animation frame. Badge insertion must be idempotent.

## Supported views

- Library video cards, including History and My list
- Library series cards
- Series catalog cards
- Series modal cover and episode cards
- Browse cards with native difficulty badges
- Watch page metadata for Dreaming's player and embedded YouTube videos

## Distribution package

Build `dist/dreaming-difficulty-VERSION.zip` with a cross-platform Node script. Require matching package and manifest versions, all manifest-referenced files, and an exact runtime allowlist containing only the manifest, four PNG icons, and six `src/` files. Use fixed ZIP metadata and stable file order so unchanged inputs produce byte-identical archives. CI must build, verify, and retain the package as a short-lived artifact.

## Browser compatibility

Support the current and previous stable desktop Chrome major versions on macOS, Windows, and mainstream Linux environments. Support current stable Microsoft Edge on Windows. Firefox, mobile browsers, and ChromeOS are not currently validated or supported.

Automated unit and DOM tests are required for every change. Fixture-based browser tests are planned for real extension loading without Dreaming credentials. Live Dreaming compatibility remains a manual release gate using the matrix in `docs/TESTING.md`.

## Security and privacy

Request only synchronized storage and Dreaming host access. Catalog requests must omit credentials. Store only normalized badge preferences. Do not add analytics, advertising, remote code, credential access, cookie access, account-data collection, or premium-access bypass. Public disclosures live in `PRIVACY.md` and `SECURITY.md`.

## Failure behavior

If the catalog cannot be downloaded or parsed, leave the page unchanged and report one error in the browser console.
