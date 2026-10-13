# Community Beta Guide

Dreaming Difficulty is not yet published in the Chrome Web Store. Beta testers install an unpacked build from an official GitHub prerelease distributed by this repository.

## Before testing

Use a separate Chrome profile if you prefer to isolate beta extensions. The extension does not request Dreaming credentials, cookies, browsing history, or premium account data. Review the [privacy policy](../PRIVACY.md) and [security policy](../SECURITY.md) before installing.

Only use an archive downloaded from https://github.com/jeffwright13/dreaming-tools/releases. Do not install copies from file-sharing sites or unofficial mirrors.

## Install the beta

1. Download `dreaming-difficulty-VERSION.zip` from the GitHub prerelease.
2. Optionally compare its SHA-256 checksum with the checksum in the release notes.
3. Extract the ZIP into a permanent local directory. Do not delete that directory while testing.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Select **Load unpacked**.
7. Choose the extracted directory containing `manifest.json`, `icons/`, and `src/`.
8. Open or reload a supported Dreaming page.

Chrome loads an unpacked directory, not the ZIP itself. A Developer mode warning is expected for an unpacked beta; do not bypass any other browser or operating-system security warning.

## Update or remove the beta

For a new beta version:

1. Download and extract the new official archive into a new directory.
2. Open `chrome://extensions`.
3. Remove the old beta or select its reload control after replacing its files.
4. Load the new unpacked directory if needed.
5. Reload existing Dreaming tabs once.

To uninstall, select **Remove** on the extension card in `chrome://extensions`, then delete the extracted directory.

## Test checklist

Record the extension version, browser version, operating system, Dreaming language, account type, route, and extension settings. Exercise:

- Spanish and French routes where available
- Browse with native difficulty badges
- Library History
- My list videos and series
- Series catalogs and series modals
- Enhanced everywhere, Fill missing difficulties only, and Original Dreaming
- Enhanced and Dreaming styles
- Small, Medium, and Large sizes
- All four badge positions
- Restore defaults
- Browser zoom and display scaling

Use the full matrix in [TESTING.md](TESTING.md) when assigned a platform/browser combination.

## Report a problem

Open an issue at https://github.com/jeffwright13/dreaming-tools/issues and include:

```text
Extension version:
Browser and exact version:
Operating system and version:
Dreaming language:
Free or premium account:
Page URL or route:
Behavior/style/size/position settings:
Steps to reproduce:
Expected result:
Actual result:
Screenshot, if useful:
Console error, if any:
```

Do not attach HAR files or include credentials, cookies, authorization headers, session tokens, downloaded premium content, or private account information. Follow the [security policy](../SECURITY.md) for vulnerabilities rather than posting exploit details publicly.

## Known beta limitations

- The extension depends on Dreaming's current page structure and public catalog schema.
- Existing Dreaming tabs must be reloaded once after installing or updating the extension.
- Firefox, mobile browsers, and ChromeOS are not currently supported.
- Microsoft Edge is a compatibility target but must be tested separately on Windows.
- This project is independent and is not currently endorsed by Dreaming Languages.
