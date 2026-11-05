# Dreaming Tools Brief

## Purpose

Provide small, independent companion tools for Dreaming that support comprehensible-input learning without changing what Dreaming offers. The difficulty tool shows Dreaming's existing relative difficulty information consistently wherever users encounter videos or series. The subtitles tool supports listen-only practice by keeping subtitles unreadable until the learner deliberately reveals them to check a word.

## Users

Dreaming language learners, for example those who use difficulty to choose appropriate videos from Library history and series views.

## Constraints

- Do not collect credentials, cookies, tokens, or account data.
- Select the public language catalog from the current Dreaming URL.
- Support Spanish and French while keeping language selection extensible.
- Target desktop Chromium browsers first; do not claim Firefox or mobile support without separate validation.
- Ship as one extension in which every tool can be enabled or disabled independently, and any combination of enabled tools works together on the same page.
- A disabled tool makes no page changes and starts no network requests.
- Let users enhance all difficulty badges or fill only missing badges.
- Support dynamically rendered cards and modals.
- Avoid dependencies on generated CSS-module class names.
- Never turn the player's subtitles on or off; the player's own Settings > Subtitles choice always decides whether subtitles exist.
- Keyboard handling must not capture keys while the user is typing, and must not take keys the player or browser relies on.
