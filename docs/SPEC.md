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

## Options

Store synchronized settings with these defaults:

- Behavior: Enhanced everywhere
- Style: Enhanced
- Size: Small
- Position: Lower left

Enhanced-everywhere behavior hides native difficulty badges and inserts configured badges. Fill-missing behavior preserves native badges and inserts configured badges only where needed. Original behavior removes extension badges and restores native badges.

Styles are Enhanced and Dreaming. Sizes are Small, Medium, and Large. Positions are all four thumbnail corners. A restore-defaults action saves and displays the default settings. Changes apply to open Dreaming pages through storage change events when the current content script is active.

## Dynamic content

Process the initial document after downloading the catalog. Observe descendant additions and reprocess the document on the next animation frame. Badge insertion must be idempotent.

## Supported views

- Library video cards, including History and My list
- Library series cards
- Series catalog cards
- Series modal cover and episode cards
- Browse cards with native difficulty badges

## Failure behavior

If the catalog cannot be downloaded or parsed, leave the page unchanged and report one error in the browser console.
