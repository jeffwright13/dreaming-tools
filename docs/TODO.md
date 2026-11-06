# To-Do

Open work items not yet designed or scheduled. When an item is decided, record the rationale in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it here.

- **Fixture-based browser tests.** Goal: an automated layer that renders the extension's pages and styles in a real headless browser, starting with subtitle caption layout at windowed and fullscreen sizes. Scope, constraints, and tooling direction are in [TESTING.md](TESTING.md#fixture-based-browser-tests--planned). Until then, layout is verified manually with the live-site checklist.

## Options page and subtitle presentation

Ideas captured 2026-11-06 during PR #10 review. Choices are deferred until each item is planned.

- **Subtitle text should look the same with de-emphasis on and off.** Observed 2026-11-06, on Dreaming's own (Shaka) player only; YouTube-served videos look the same either way. With De-emphasize subtitles enabled, the subtitle text differs in font and size from the player's own text with the feature disabled. Goal: by default the feature changes only legibility (blur, fade, or hide), not the font or size, so it stays transparent. Lead: on Shaka the rules target `.shaka-text-container` itself, while on YouTube they target the caption windows inside the container, so start with what the container rules (`filter`, `scale`, `transform-origin`, `transition`) do to Shaka's text layout and rendering; check which styles show it and whether it persists while revealed. Small and faint shrinks the text on purpose (`scale: 0.6`). Related to the text-size items below.
- **Configurable subtitle text size**, possibly Small/Medium/Large like the difficulty badges.
- **Subtitle size when windowed vs fullscreen.** On Dreaming/Shaka videos the text keeps the same absolute size; on YouTube it grows in fullscreen, because YouTube sizes captions from the player size and our styles only blur or scale what the player renders. A fixed mode on YouTube would mean overriding YouTube's caption font size; a follow-player mode on Dreaming would mean sizing relative to the player. Likely combined with the text-size option. Open decision.
