# Privacy Policy for Dreaming Difficulty

Effective date: 2026-10-13

Dreaming Difficulty is an independent browser extension that adds difficulty badges and series difficulty ranges to Dreaming pages. It is not affiliated with or endorsed by Dreaming Languages.

## Data the extension does not collect

Dreaming Difficulty does not collect, read, store, or transmit:

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

- Badge behavior
- Badge style
- Badge size
- Badge position

Preferences are stored with `chrome.storage.sync`. Chrome may synchronize them through the user's Google account according to Google's Chrome Sync policies. The developer does not receive or control that synchronization. Users can restore defaults from the options page, clear extension data in Chrome, or uninstall the extension.

## Permissions

The `storage` permission saves and synchronizes the preferences listed above.

Access to `https://app.dreaming.com/*` lets the extension add badges to supported Dreaming pages and retrieve public language catalogs. The extension does not use cookie, history, tabs, web-request, or credential permissions.

## Data sharing and retention

The developer does not receive extension data and therefore does not sell, share, or retain personal data. Browser-managed synchronized preferences remain subject to the user's browser and Google account settings.

## Changes

Material privacy changes will be documented in the repository and reflected in the Chrome Web Store disclosure before release. The effective date above will be updated when this policy changes.

## Contact

For privacy questions, open an issue at https://github.com/jeffwright13/dreaming-tools/issues without including credentials, tokens, cookies, or other sensitive information. For security vulnerabilities, follow `SECURITY.md` instead of posting exploit details publicly.
