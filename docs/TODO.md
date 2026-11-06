# To-Do

Open work items not yet designed or scheduled. When an item is decided, record the rationale in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it here.

- **Fixture-based browser tests.** Goal: an automated layer that renders the extension's pages and styles in a real headless browser, starting with subtitle caption layout at windowed and fullscreen sizes. Scope, constraints, and tooling direction are in [TESTING.md](TESTING.md#fixture-based-browser-tests--planned). Until then, layout is verified manually with the live-site checklist.

## Options page and subtitle presentation

Ideas captured 2026-11-06 during PR #10 review. Choices are deferred until each item is planned.

- **Mock video image in the previews** instead of the blank dark-gray blocks, blurred to signal that the content doesn't matter. Must be original artwork (for example a simple SVG scene in the repo), not Dreaming frames; add it to the package allowlist if it is a separate file.
- **Two subtitle previews, one per player** (Dreaming/Shaka and YouTube), since the players render captions differently (Shaka draws a black box behind the line; YouTube uses its own caption style). Difficulty needs only one preview. The previews can double as fixtures for the browser tests above.
- **Configurable subtitle text size**, possibly Small/Medium/Large like the difficulty badges.
- **Options page follows the browser's dark mode** (`prefers-color-scheme`).
- **Subtitle size when windowed vs fullscreen.** On Dreaming/Shaka videos the text keeps the same absolute size; on YouTube it grows in fullscreen, because YouTube sizes captions from the player size and our styles only blur or scale what the player renders. A fixed mode on YouTube would mean overriding YouTube's caption font size; a follow-player mode on Dreaming would mean sizing relative to the player. Likely combined with the text-size option. Open decision.
- **Open the options page on first install.** With both features off by default, a fresh install shows nothing until options are opened. A background service worker with an `onInstalled` handler (`reason === "install"`) could open the options page.

## Subtitles

- **Stranded reveal in Toggle mode on YouTube.** Toggle-reveal inside the YouTube frame, turn CC off, press the reveal key (ignored because there is no caption container), turn CC back on: captions stay revealed until the next reveal-key press, blur, or settings change. Applies to local presses in the frame and to forwarded presses. Suggested fix: a press while no captions are present hides instead of being ignored (`setRevealed(false)`), with a test.
