# To-Do

Open work items not yet designed or scheduled. When an item is decided, record the rationale in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it here.

- **Fixture-based browser tests.** Goal: an automated layer that renders the extension's pages and styles in a real headless browser, starting with subtitle caption layout at windowed and fullscreen sizes. Scope, constraints, and tooling direction are in [TESTING.md](TESTING.md#fixture-based-browser-tests--planned). Until then, layout is verified manually with the live-site checklist.

## Options page and subtitle presentation

Ideas captured 2026-11-06 during PR #10 review. Choices are deferred until each item is planned.

- **Mock video image in the previews** instead of the blank dark-gray blocks, blurred to signal that the content doesn't matter. Must be original artwork (for example a simple SVG scene in the repo), not Dreaming frames; add it to the package allowlist if it is a separate file.
- **Two subtitle previews, one per player** (Dreaming/Shaka and YouTube), since the players render captions differently (Shaka draws a black box behind the line; YouTube uses its own caption style). Difficulty needs only one preview. The previews can double as fixtures for the browser tests above.
- **Configurable subtitle text size**, possibly Small/Medium/Large like the difficulty badges.
- **Options page follows the browser's dark mode** (`prefers-color-scheme`). In the same pass over `options.css`:
  - Convert fixed pixel sizes (headings, badge text, selects) to relative units, so the page scales consistently with the browser's default font size.
  - Rework the header into three levels. A plain-text tagline under "Dreaming Tools" says what the extension is, for example "A collection of tools that enhance the video experience on Dreaming. An independent extension, not affiliated with Dreaming." The current "Choose which tools run…" line becomes a light info style (icon and muted text, no bordered box). The amber reload warning stays as it is and remains the strongest element.
- **Refresh open Dreaming tabs after install or update.** Chrome does not inject an installed or updated extension's content script into tabs that were already open, and the old copy stops receiving settings changes, so the options page tells users to reload those tabs. The background worker could instead inject the current scripts into open Dreaming tabs on `onInstalled` (needs the `scripting` permission, which shows no install warning). The old copy's key listeners and page observer keep running, so a new copy must first signal the old one to stop (a DOM event both can see), and a copy should stop itself when `chrome.runtime.id` becomes undefined. Scripts from versions without that handover need one last manual reload. YouTube embed frames refresh on the next video anyway. Keep the reload note as a fallback.
- **Subtitle size when windowed vs fullscreen.** On Dreaming/Shaka videos the text keeps the same absolute size; on YouTube it grows in fullscreen, because YouTube sizes captions from the player size and our styles only blur or scale what the player renders. A fixed mode on YouTube would mean overriding YouTube's caption font size; a follow-player mode on Dreaming would mean sizing relative to the player. Likely combined with the text-size option. Open decision.
