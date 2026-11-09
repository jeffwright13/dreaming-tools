# To-Do

Open work items not yet designed or scheduled. When an item is decided, record the rationale in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it here.

- **Series modal cover badge (regression).** Dreaming replaced the series modal's `.ds-series-modal__header` with `.ds-series-modal__hero`, which `src/difficulty.js` does not target, so the modal cover no longer shows the series range. Episode cards inside the modal are unaffected. Found by the live suite on 2026-11-09. Fix: add `.ds-series-modal__hero` to `SERIES_CARD_SELECTOR` (its cover image still carries the series ID), then remove `test.fixme` from the cover test in `tests/live/badges.logged-in.spec.js`.
- **Live-suite gaps.** A few checks still need something the test account lacks: My list needs saved items, and the comment-box check needs an account that can comment (free accounts cannot). Picture-in-picture, platform, zoom, and display-scaling checks stay manual. A logged-out CI job is deferred until the suite proves stable against the live site. Details are in [TESTING.md](TESTING.md#live-site-browser-tests-playwright).
- **Fixture-based browser tests.** Goal: an automated layer that renders the extension's pages and styles in a real headless browser, starting with subtitle caption layout at windowed and fullscreen sizes. Scope, constraints, and tooling direction are in [TESTING.md](TESTING.md#fixture-based-browser-tests--planned). Until then, layout is verified manually with the live-site checklist.

## Options page and subtitle presentation

Ideas captured 2026-11-06 during PR #10 review. Choices are deferred until each item is planned.

- **Subtitles in picture-in-picture.** Dreaming's player opens picture-in-picture when you switch tabs, and its subtitles appear there at normal size and readable, so de-emphasis does not apply (see SPEC.md). First find out how that window draws them. If Shaka shows them as the video's native text track, a `::cue` style (for example `visibility: hidden` or transparent text) might reach them, but `::cue` supports only a few properties and no blur, and the reveal key would need to reach the window. If none of this works, document the limitation and leave it.
- **Configurable subtitle text size**, possibly Small/Medium/Large like the difficulty badges.
- **Subtitle size when windowed vs fullscreen.** On Dreaming/Shaka videos the text keeps the same absolute size; on YouTube it grows in fullscreen, because YouTube sizes captions from the player size and our styles only blur or scale what the player renders. A fixed mode on YouTube would mean overriding YouTube's caption font size; a follow-player mode on Dreaming would mean sizing relative to the player. Likely combined with the text-size option. Open decision.
