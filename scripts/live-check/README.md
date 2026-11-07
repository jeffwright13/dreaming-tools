# Live-check scripts

Exploratory scripts from the 0.10.1 beta pass, kept as a reference for the planned live-site browser suite. They are not part of `npm test`, CI, or the package. Findings, results, and open questions are in [docs/TESTING.md](../../docs/TESTING.md#live-site-browser-automation--exploration-in-progress).

They drive headless Microsoft Edge over the Chrome DevTools Protocol using Node's built-in `WebSocket` (Node 22 or later), with no dependencies. Branded Chrome ignores `--load-extension`, so Edge is used.

## Run

Use a new, empty profile directory outside the repository for each run of `options.mjs`, because it checks first-install behavior. Never use, or commit, a profile that holds a Dreaming login.

```bash
npm run package
EXT=$(mktemp -d) PROFILE=$(mktemp -d)
unzip -q dist/dreaming-tools-$(node -p "require('./package.json').version").zip -d "$EXT"
"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --headless=new \
  --user-data-dir="$PROFILE" --load-extension="$EXT" \
  --remote-debugging-port=9334 --no-first-run --window-size=1280,900 about:blank &
sleep 4
node scripts/live-check/options.mjs
node scripts/live-check/badges.mjs https://app.dreaming.com/spanish/browse https://app.dreaming.com/spanish/series
node scripts/live-check/probe.mjs "https://app.dreaming.com/spanish/watch?id=5e4d121caac87f3820954cb5" dreaming
pkill -f remote-debugging-port=9334
```

`CDP_PORT` overrides the debugging port (default 9334). Screenshots go to `OUT_DIR`, default the system temp directory.

## Scripts

- `lib.mjs`: a minimal CDP client. It attaches to targets, evaluates expressions, sends trusted key and mouse input, finds the extension's service worker, and prints PASS or FAIL lines.
- `options.mjs`: options-page checks: opens on first install, auto-save, theme, preview reveal in both modes, key capture, badge preview, Restore defaults. Exits non-zero on any failure.
- `badges.mjs`: switches badges on and counts badges on each URL given. Works logged out.
- `probe.mjs`: switches subtitles on, opens a watch page, and reports what the player exposes, with a screenshot. Logged out, Dreaming shows a sign-up prompt instead of any player.
