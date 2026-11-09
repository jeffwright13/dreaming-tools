# To-Do

Open work items not yet designed or scheduled. When an item is decided, record the rationale in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it here.

- **Live-site Playwright suite, part 2.** The suite (`tests/live/`, `npm run test:live`) covers the options page and logged-out badges, and a spike showed how to drive both players while logged in. Next: the logged-in subtitle tests, logged-in badge pages, French routes, and headed-only checks (fullscreen, picture-in-picture). Details are in [TESTING.md](TESTING.md#live-site-browser-tests-playwright).
- **Fixture-based browser tests.** Goal: an automated layer that renders the extension's pages and styles in a real headless browser, starting with subtitle caption layout at windowed and fullscreen sizes. Scope, constraints, and tooling direction are in [TESTING.md](TESTING.md#fixture-based-browser-tests--planned). Until then, layout is verified manually with the live-site checklist.

## Options page and subtitle presentation

Ideas captured 2026-11-06 during PR #10 review. Choices are deferred until each item is planned.

- **Subtitles in picture-in-picture.** Dreaming's player opens picture-in-picture when you switch tabs, and its subtitles appear there at normal size and readable, so de-emphasis does not apply (see SPEC.md). First find out how that window draws them. If Shaka shows them as the video's native text track, a `::cue` style (for example `visibility: hidden` or transparent text) might reach them, but `::cue` supports only a few properties and no blur, and the reveal key would need to reach the window. If none of this works, document the limitation and leave it.
- **Configurable subtitle text size**, possibly Small/Medium/Large like the difficulty badges.
- **Subtitle size when windowed vs fullscreen.** On Dreaming/Shaka videos the text keeps the same absolute size; on YouTube it grows in fullscreen, because YouTube sizes captions from the player size and our styles only blur or scale what the player renders. A fixed mode on YouTube would mean overriding YouTube's caption font size; a follow-player mode on Dreaming would mean sizing relative to the player. Likely combined with the text-size option. Open decision.
