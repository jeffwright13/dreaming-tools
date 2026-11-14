# Dreaming Tools Specification

## Features

Dreaming Tools is one Manifest V3 extension made of independent features. Each feature has its own enable switch in the options page and keeps working whether the other features are on or off.

Content scripts load in this order, sharing state through `globalThis` namespaces because Manifest V3 content scripts cannot use ES module imports:

1. `settings.js` (`DreamingToolsSettings`): defaults, valid values, and normalization for every feature's settings.
2. Feature files, for example `difficulty-core.js` and `difficulty.js`.
3. `content.js` (`DreamingToolsContent`): reads settings, creates each feature, and passes it the full normalized settings object at startup and after every synchronized change.

A background service worker, `background.js`, opens the options page once, on first install (`chrome.runtime.onInstalled` with reason `install`), because every feature is off by default and a fresh install would otherwise change nothing visible. Updates, extension reloads, and Chrome updates do not open it. A failure to open the page is logged, not thrown. The worker registers its listener synchronously at startup, as Manifest V3 requires.

On install and on update (which includes reloading an unpacked extension), the worker also refreshes Dreaming tabs that were already open. Chrome does not inject a newly installed or updated extension's content scripts into open tabs, and the copy already running there is orphaned: its `chrome.storage` listener stops firing, but its key listeners and page observer keep acting on the old settings. The worker queries non-discarded tabs matching the manifest's Dreaming content script and injects that script's own CSS and JS files with `chrome.scripting` (the `scripting` permission). It injects only packaged files listed in the manifest, never code strings or functions. A tab that cannot be injected is logged and skipped; the others continue. Discarded tabs are skipped because they reload, with the manifest's scripts, when the user returns to them. YouTube embed frames are not refreshed: each new video loads a new frame with the current script, so only a YouTube video open at update time stays on the old copy until the next video. Chrome updates do not orphan scripts, so they trigger nothing.

Each `content.js` copy, before reading settings, dispatches a `dreaming-tools:replaced` DOM event on `document`, then listens for that event itself. DOM events reach every script in the page regardless of which extension context injected it, so a running copy that hears the event calls `update` on each of its features with every enable switch (`…Enabled` setting) off. Features stop synchronously, so the old copy has removed its classes, listeners, badges, and observer before the new copy reads settings and starts. A replaced copy ignores later storage changes, and a copy replaced while still reading settings never starts. The event is not a security boundary: a script on the Dreaming page can dispatch it and switch the features off in that tab, and no DOM event can be authenticated (`isTrusted` is false for every script-created event, and any token would be visible to the page). This is accepted because the page could undo the features itself anyway and the next injection restores them; the event must only ever shut features down. Copies from versions before 0.9.0 do not listen for the event, so tabs running one need a manual reload once. A copy does not stop itself merely because it is orphaned: if injection into a tab fails, the old copy keeps working with its last settings, which is better than nothing.

A feature exposes a `name` and one method, `update(settings)`. It starts itself when its switch is on, refreshes when other settings change, and stops and restores the page when its switch is off. `update` may be called again before an earlier call has resolved, for example while a feature is still downloading data; implementations must converge on the settings from the most recent call regardless of the order in which earlier calls finish. Errors thrown by one feature are logged as `Dreaming Tools NAME feature failed to update.` and do not prevent other features from updating.

`content.js` keeps the raw stored values, applies each synchronized change to them (a removed key returns to its default), and normalizes the result for every update, so legacy migrations see whether a key was actually stored. The change listener is registered before the first update so that changes made while a feature is still starting are applied. Features must touch only their own page elements and extension-owned class names so that enabled features do not interfere.

Current features:

- Difficulty badges (`difficultyEnabled`), described below.
- Subtitle de-emphasis (`subtitlesEnabled`), described in [Subtitles](#subtitles).

## Language selection

Map `/spanish/` pages to the `es` catalog and `/french/` pages to the `fr` catalog. Download `https://app.dreaming.com/videos/prod/{language}.json`. Unsupported paths remain unchanged.

## Video difficulty

Convert each catalog `difficultyScore` to Dreaming's displayed 0–100 value:

```text
round(clamp((difficultyScore - 200) / 24, 0, 100))
```

Match rendered videos by their `data-video-id` attribute.

### Dreaming's native behavior

Dreaming shows a difficulty badge on Browse thumbnails only when the list is sorted by difficulty. With no sort (`/spanish/browse`) or with a non-difficulty sort (`?sort=random`, `short`, `long`, `old`, or `new`), thumbnails show only the video duration. With `?sort=easy` or `?sort=hard`, thumbnails also show Dreaming's own difficulty badge (`.ds-video-thumbnail__badge--vocab-range`). Other views, such as Library and series cards, do not show native difficulty.

The extension never reads the `sort` parameter. It decides per thumbnail by checking whether the native badge is present, so it keeps working if Dreaming changes which sorts or views show difficulty. As a result, Fill missing and Enhanced everywhere look different only where native badges exist, which on Browse means the Easy and Hard sorts.

## Series difficulty

Match a series using the 24-character ID in its image URL or `series` URL parameter. Collect rounded difficulties for all scored catalog videos with that `seriesId`.

Display the minimum and maximum as `minimum–maximum`. Display one number when both endpoints are equal. Omit the badge when no scored episodes exist.

## Watch page

On a watch page, read the video ID from the `id` URL parameter and insert chips at the start of the `[data-testid="video-badges"]` row, before Dreaming's level badge. Show `Difficulty N` for a scored video, followed by `Series minimum–maximum` when the video belongs to a series with scored episodes. Omit chips the catalog cannot support.

Watch-to-watch navigation is client-side and may reuse or replace the badge row, so chips are updated when the URL's video ID changes. Because the page observer reruns enhancement on every child-node change, chip updates must not modify child nodes when chips are already current.

Chips apply the configured style. Size and position apply only to thumbnail badges. Disabling the feature removes the chips. Both behaviors insert them, because Dreaming shows no difficulty on the watch page.

## Options

The options page has one card per feature, Subtitles first and Difficulty badges second. Each card starts with the feature's enable switch, followed by subsections with smaller headings: Subtitle appearance, Reveal, and Preview for subtitles; Badge behavior, Badge appearance, and Preview for difficulty. A switched-off feature's controls stay visible but disabled. Under the heading are a plain tagline saying what the extension is and that it is independent of Dreaming, then an info line (icon and muted text) saying every tool starts off and changes save automatically. A quieter note at the bottom, below Restore defaults, says open tabs update automatically and to reload a tab that doesn't respond to changes, for the cases tab refresh does not cover (a failed injection, a YouTube video open during an update, or a copy older than 0.9.0).

The Subtitles card previews both players side by side (stacked on narrow windows), labelled "Dreaming player" and "YouTube player (free accounts)" (premium accounts always get Dreaming's player; see [Which player a video uses](#which-player-a-video-uses)). Each preview draws its player's controls as they look while showing, in original simplified icons with no logos: Dreaming's thin orange progress bar with play, volume, and time at the left, next, settings, and fullscreen at the right, and a round back button at the top left; YouTube's volume, CC, and settings at the top right, time and fullscreen above a red progress bar with a round playhead. The controls are decorative (`aria-hidden`, no pointer events), and each caption sits just above them, where the player puts it while its controls show. Each uses that player's real container class (`.shaka-text-container`, and `.ytp-caption-window-container > .caption-window`), so `subtitles.css` styles it exactly as on the site; the Dreaming preview draws a solid black box behind the line, the YouTube preview a translucent box per line in YouTube's caption font. The configured reveal key works page-wide on the options page, following the chosen mode exactly as on Dreaming (Hold; Toggle with auto-hide; repeats ignored; window blur, switching subtitles off, or changing the mode, key, or auto-hide hides), and pressing a preview acts like the key, so in Toggle mode a click toggles. Either reveals both previews. The key is ignored while a new key is being chosen, in text fields, and with Ctrl, Alt, or Cmd held. Unlike on Dreaming, a focused select does not take the key: it previews, and the key never reaches the select, so it cannot change a setting through type-to-select. The page uses the shared logic in `subtitles-core.js` rather than the content script's subtitles feature, whose capture-phase key listener on `window` would swallow the key press while a new reveal key is being chosen and which offers no way for a mouse press to share its reveal state. The two subtitle previews and the video badge preview show `preview-scene.svg`, an original flat illustration of a kitchen with a pot of water on the stove (matching the sample line), blurred on a pseudo-element so the subtitles and badge on top stay sharp; it contains no Dreaming frames or branding.

The Difficulty badges card previews two cards side by side at the same height, labelled "Video" and "Series": a 16:9 video thumbnail with a single rating (`42`), and a 2:3 series cover, like Dreaming's series catalog cards, with a range (`41–44`) on an original blurred coastline illustration, `preview-series.svg`. Both badges use the same classes as on Dreaming, `--video` and `--series`, and follow the style, size, and position settings. While the feature is off, both badges are hidden and each card shows an off notice.

The page follows the browser's light or dark preference. Every color is a token on `:root`, each redefined under `prefers-color-scheme: dark`; `color-scheme: light dark` lets native controls follow. The previews' caption colors imitate the players and are the same in both themes. Text sizes are in `rem`, so the page scales with the browser's default font size. A stylesheet test checks that every token has a dark value, that no literal colors appear outside the token blocks, that no font size is in pixels, and that every `url()` refers to a packaged file. Every feature is off by default, so a fresh install changes nothing on Dreaming until a feature is switched on; the options page opens by itself on first install for that reason (see [Features](#features)).

Store synchronized settings in one flat object. Subtitle settings are listed under [Subtitles](#subtitles). Difficulty defaults:

- Difficulty badges enabled: off
- Behavior: Fill missing difficulties only
- Style: Dreaming
- Size: Small
- Position: Upper right

Enhanced-everywhere behavior hides native difficulty badges and inserts configured badges. Fill-missing behavior preserves native badges and inserts configured badges only where needed. Disabling the feature removes extension badges, restores native badges, stops observing the page, and skips the catalog download.

Styles are Enhanced and Dreaming. Sizes are Small, Medium, and Large. Positions are Upper right, Upper left, and Lower left; Lower right is unavailable because Dreaming uses that corner for video duration. Every change saves immediately; there is no Save button, so nothing can be left unsaved. Choosing a new reveal key saves too, although it sets a hidden input that fires no change event. A failed write, including Restore defaults, is shown in the page's status line. A restore-defaults action saves the default settings for every feature and displays them once the write succeeds; if it fails, the form keeps the current settings. Saving reads each control directly, not through `FormData`, because `FormData` omits controls inside a disabled fieldset and would reset a switched-off feature's settings to defaults. Changes apply to open Dreaming pages through storage change events when the current content script is active.

Read stored settings by key list (`SETTING_KEYS`), not by passing defaults to `chrome.storage.sync.get`, so that missing keys stay distinguishable from stored ones. A legacy stored `behavior: "original"` from versions before the enable switch migrates to `difficultyEnabled: false` with the default behavior, unless `difficultyEnabled` is stored explicitly.

## Subtitles

Dreaming's player is built on Shaka Player. While the player's **Settings > Subtitles** is set to a language, Shaka renders the current line inside `.shaka-text-container`; with Subtitles set to Off the container is removed from the page. The extension never changes that player setting, and none of its subtitle behavior applies while the container is absent.

The feature does not modify the player. When enabled it sets classes on `<html>` (`dt-subtitles`, `dt-subtitles--style-STYLE`, and `dt-subtitles--revealed` while revealed), and `subtitles.css` styles `.shaka-text-container` through them. A container the player removes and re-creates is therefore styled without observing the page, and fullscreen keeps the styling because the player stays in the document.

Styles:

- **Blur** (default): `filter: blur(6px)`. Unreadable, but shows that a line is present.
- **Small and faint**: scaled to 60% from the bottom center at 40% opacity. Readable with deliberate effort, for learners who prefer a light de-emphasis.
- **Hidden**: fully transparent until revealed.

On Dreaming's player the styles go on `.shaka-text-container` without a transition: Dreaming animates that container's position with its own `transition: bottom 0.1s` (verified live), which any transition from the extension would replace, and the styles cannot move to the subtitle lines because Shaka sets an inline `opacity: 1` on each line, which would defeat the opacity-based styles. So on Dreaming's player the effects switch instantly, while YouTube-served captions fade over 120 ms. Every style applies only while not revealed (`:not(.dt-subtitles--revealed)`), so revealing hands control back to the player's own styles rather than resetting them, and shrinking uses the standalone `scale` property so it composes with any `transform` the player sets. The reveal key is a physical key code (`KeyboardEvent.code`, default `KeyS`), so it is layout independent, and is limited to letter, digit, and punctuation keys; Space, arrows, Enter, Escape, Tab, function keys, and modifiers are rejected because the player or browser uses them. Pressing `S` was verified on a live watch page to trigger no player action.

- **Hold** (default): revealed while the key is down; held-key repeats are ignored.
- **Toggle**: each press flips the state. Auto-hide (Off, 3, 5 default, or 10 seconds) hides again after the delay; each reveal restarts the timer, and toggling off cancels it.

Key listeners run in the capture phase on `window`, before the player's handlers. A matching key press is handled, and kept from the page with `preventDefault` and `stopPropagation`, only when subtitles are shown, the event target is not a text field, select, or editable element, and Ctrl, Alt, and Cmd are not held; Shift is allowed. Otherwise the key reaches the page unchanged. A press while the player shows no subtitles still hides a reveal, without consuming the key, so a Toggle reveal made before the player's subtitles were turned off does not reappear when they are turned back on. A release always hides in Hold mode, even if the player's subtitles were turned off or focus moved into a text field while the key was held; a release in a text field is not consumed. Losing window focus hides the subtitles, because the release may never arrive. Changing the reveal mode, key, or auto-hide returns to hidden. Disabling the feature removes its classes, listeners, and timer.

### YouTube-served videos

Many Dreaming videos are served through YouTube for accounts without premium (see [Which player a video uses](#which-player-a-video-uses)): the watch page shows `div.ds-youtube-player` containing a cross-origin `https://www.youtube.com/embed/...` iframe, there is no Dreaming settings menu, and captions are switched with YouTube's own CC control. Page scripts and stylesheets cannot reach into that frame, so a second content script runs in YouTube embed frames (`all_frames`) with `settings.js`, `subtitles-core.js`, `subtitles.js`, `content.js`, and `subtitles.css`.

`content.js` chooses features from its location: on `app.dreaming.com` it runs difficulty and subtitles; in `www.youtube.com` it runs subtitles only when `location.ancestorOrigins` is exactly `["https://app.dreaming.com"]`, so YouTube embeds on other sites, nested embeds, and directly opened embeds run nothing and read no settings. The stylesheet is inert elsewhere because its rules require the `<html>` classes. Inside the frame, the same styles apply to the children of `.ytp-caption-window-container` (YouTube's caption windows), never to the container itself: YouTube positions each caption window absolutely against the player, and a `filter` or `transform` on the container would become their containing block and move the captions out of view in windowed mode. This was observed live before the fix: captions vanished in windowed mode and appeared below the progress bar in fullscreen. The frame treats captions as on while that container is present; when it is absent the reveal key reaches YouTube unchanged and a local or forwarded press only hides a reveal, while releases and blurs always apply. YouTube's embed now uses a newer control layout (CC and settings in the top-right corner), so the classic `.ytp-subtitles-button` state is not relied on. If YouTube keeps the container mounted with CC off, the reveal key is consumed inside the frame with no visible effect; `S` has no known YouTube shortcut, so this is accepted. YouTube's class names are not a public interface and may change.

#### Which player a video uses

The same video can play in either player, depending on the account. This is observed behavior, not documented by Dreaming, and may change.

| Account | Video also published on Dreaming's YouTube channel | Video not on YouTube |
|---|---|---|
| Premium | Dreaming's player | Dreaming's player |
| Free | YouTube embed | Dreaming's player |
| Logged out | Sign-up prompt, no player | Sign-up prompt, no player |

Evidence, 2026-11-13: watch page `6aec7f74a1ddb669a07fb7e5` played in Dreaming's player for the maintainer's premium account, and as an embed of YouTube video `ZxeljjcqOUE` (the same video on Dreaming's public channel) for the free test account. The maintainer also saw it switch from Dreaming's player to the YouTube embed after signing out and refreshing; a browser that had never signed in showed the sign-up prompt for it and for both pinned live-suite videos. `6ae0934444135614096a680f`, the live suite's YouTube-served video, is YouTube only for free accounts; `5e4d121caac87f3820954cb5`, its Dreaming-player video, uses Dreaming's player for both.

Consequences: a video ID alone does not say which player a page will use, and "YouTube-served" means "YouTube-served for this account". Both players need support, because free accounts see YouTube embeds wherever a YouTube copy exists. See [TESTING.md](TESTING.md#which-player-a-page-uses) for how this affects testing.

Keys go to whichever frame has focus. Inside the YouTube frame, the feature handles the reveal key itself. On the Dreaming page, when Dreaming's own subtitle container is absent but a YouTube player is present, the feature consumes the reveal key (it cannot see whether YouTube captions are on) and forwards `press` (not repeats), `release`, and window `blur` with `postMessage({ source: "dreaming-tools", type: "subtitles-reveal", event }, "https://www.youtube.com")`. The frame applies only messages whose origin is `https://app.dreaming.com` and whose fields match exactly. It deliberately does not check `event.source`: any Dreaming-origin sender may send these messages, which can only show or hide captions. Focus moving between the page and the frame blurs one of them, which re-hides the captions.

Picture-in-picture is outside this feature's reach. Dreaming's player enters picture-in-picture when the viewer switches to another tab, and, with the player's subtitles on, the subtitles appear in that window at normal size and fully readable. The styles act on the page's caption elements, which that window does not use. With the player's subtitles off, none appear there either. YouTube-served videos do not enter picture-in-picture on a tab switch; that is Dreaming's choice, not the extension's. Observed by the maintainer in Chrome on 2026-11-08. This corrects an earlier note that picture-in-picture showed no subtitles on either player. Whether the extension could reach those subtitles is an open TODO item.

The options page reuses `subtitles.css` for a preview by setting the same `<html>` classes, and pressing and holding the preview reveals it. The reveal key is chosen by clicking the key button and pressing a key; Escape cancels and disallowed keys are rejected with a message. Auto-hide is shown only in Toggle mode.

Subtitle settings and defaults: `subtitlesEnabled` off; `subtitleStyle` Blur; `revealMode` Hold; `revealKey` `KeyS`; `revealAutoHide` 5 seconds.

## Dynamic content

When the difficulty feature is enabled, process the initial document after downloading the catalog. Observe descendant additions and reprocess the document on the next animation frame. Badge insertion must be idempotent. A series card nested inside another series card gets no badge of its own; only the outer card is badged.

## Supported views

- Library video cards, including History and My list
- Library series cards
- Series catalog cards
- Continue watching series cards on the Series page (`[data-testid="series-card"]`)
- Series modal cover and episode cards
- Browse cards, with or without native difficulty badges depending on sort order
- Watch page metadata for Dreaming's player and embedded YouTube videos

## Distribution package

Build `dist/dreaming-tools-VERSION.zip` with a cross-platform Node script. Require matching package and manifest versions, all manifest-referenced files, and an exact runtime allowlist containing only the manifest, four PNG icons, and twelve `src/` files. Use fixed ZIP metadata and stable file order so unchanged inputs produce byte-identical archives. Never silently replace a release archive: the release build refuses to overwrite an existing `dist/dreaming-tools-VERSION.zip` whose contents differ unless forced. Test builds (`--dev`) go to `dist/dev/` and may be replaced freely. CI must build, verify, and retain the package as a short-lived artifact.

## Browser compatibility

Support the current and previous stable desktop Chrome major versions on macOS, Windows, and mainstream Linux environments. Support current stable Microsoft Edge on Windows. Firefox, mobile browsers, and ChromeOS are not currently validated or supported.

Automated unit and DOM tests are required for every change. Fixture-based browser tests, including subtitle layout at windowed and fullscreen sizes, are planned for real extension loading without Dreaming credentials. Live Dreaming compatibility remains a manual release gate using the matrix in `docs/TESTING.md`.

## Security and privacy

Request only synchronized storage, Dreaming host access, and a content script for YouTube embedded players that acts only when embedded directly in Dreaming. Catalog requests must omit credentials. Store only normalized display and keyboard preferences. Do not add analytics, advertising, remote code, credential access, cookie access, account-data collection, or premium-access bypass. Public disclosures live in `PRIVACY.md` and `SECURITY.md`.

## Failure behavior

If the catalog cannot be downloaded or parsed, leave the page unchanged and report one error in the browser console. The next settings update retries the download.
