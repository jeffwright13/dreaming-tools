# Privacy Policy for Dreaming Tools

Effective date: 2026-10-13

Dreaming Tools is an independent browser extension that adds companion tools to Dreaming pages, currently difficulty badges and series difficulty ranges. It is not affiliated with or endorsed by Dreaming Languages.

## Data the extension does not collect

Dreaming Tools does not collect, read, store, or transmit:

- Dreaming usernames or passwords
- Authentication tokens, session cookies, or browser cookies
- Browsing history
- Video watch history or account lists
- Payment or premium-account information
- Analytics, advertising identifiers, or telemetry
- Page contents for transmission to the developer

The extension has no developer-operated server.

## Public catalog data

When a supported Dreaming page is open, the extension downloads the corresponding public video catalog directly from `https://app.dreaming.com`. The request uses `credentials: "omit"`, so the extension does not intentionally send Dreaming login cookies or authorization credentials with that request.

Catalog data is processed in memory to match video and series IDs and calculate displayed difficulty values. The extension does not send catalog data to the developer.

## Extension preferences

The extension stores only these preferences:

- Whether each tool (difficulty badges, subtitles) is switched on
- Badge behavior
- Badge style
- Badge size
- Badge position
- Subtitle style, reveal mode, reveal key, and auto-hide delay

The subtitles tool listens for its reveal key on Dreaming pages, and inside YouTube video players embedded in Dreaming pages, only to show or hide subtitles. It does not record, store, or transmit keystrokes or subtitle text.

Preferences are stored with `chrome.storage.sync`. Chrome may synchronize them through the user's Google account according to Google's Chrome Sync policies. The developer does not receive or control that synchronization. Users can restore defaults from the options page, clear extension data in Chrome, or uninstall the extension.

## Permissions

The `storage` permission saves and synchronizes the preferences listed above.

Access to `https://app.dreaming.com/*` lets the extension add badges to supported Dreaming pages and retrieve public language catalogs. The extension also runs a small script and stylesheet in YouTube embedded players (`https://www.youtube.com/embed/*`), because Dreaming serves many videos through YouTube and their captions are drawn inside YouTube's player. The script first checks that the player is embedded directly in a Dreaming page and does nothing otherwise. Inside Dreaming it only blurs, fades, or hides YouTube's captions and shows them when the reveal key is pressed; it does not read caption text, YouTube account data, or viewing activity. Chrome describes this access as reading and changing data on www.youtube.com.

The extension does not use cookie, history, tabs, web-request, or credential permissions.

## Data sharing and retention

The developer does not receive extension data and therefore does not sell, share, or retain personal data. Browser-managed synchronized preferences remain subject to the user's browser and Google account settings.

## Changes

Material privacy changes will be documented in the repository and reflected in the Chrome Web Store disclosure before release. The effective date above will be updated when this policy changes.

## Contact

For privacy questions, open an issue at https://github.com/jeffwright13/dreaming-tools/issues without including credentials, tokens, cookies, or other sensitive information. For security vulnerabilities, follow `SECURITY.md` instead of posting exploit details publicly.
