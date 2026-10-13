# Publishing and Maintenance Plan

This document is the launch and release checklist for Dreaming Difficulty. Complete each phase in order; unchecked items are planned work, not claims about the current release.

## 1. Community beta

- [x] Add final extension icons at 16, 32, 48, and 128 pixels.
- [x] Add a repeatable packaging command that creates `dist/dreaming-difficulty-VERSION.zip`.
- [x] Verify the ZIP contains only `manifest.json`, required icons, and `src/` runtime files.
- [ ] Recruit a small group of technically comfortable Dreaming users.
- [ ] Include Spanish and French users, free and premium accounts, and multiple desktop platforms where possible.
- [ ] Have testers follow `docs/TESTING.md` and report browser version, operating system, Dreaming route, and extension settings.
- [ ] Resolve release-blocking layout, catalog, and settings issues.

Unpacked beta distribution is appropriate only for trusted testers. Do not ask users to bypass browser security warnings or download builds from unofficial mirrors.

## 2. Dreaming Languages outreach

- [ ] Contact Dreaming Languages before broad promotion.
- [ ] Explain that the extension displays public difficulty data and does not unlock premium content.
- [ ] Ask about branding, catalog use, and a preferred support/contact channel.
- [ ] Record any constraints in `docs/DECISIONS.md` and update the store listing accordingly.

The extension must not imply affiliation or endorsement without explicit permission.

## 3. GitHub community setup

- [x] Enable GitHub Issues.
- [x] Add structured issue forms for general bugs, badge problems, layout problems, new languages, and feature requests.
- [ ] Add a pull request template with the test matrix and privacy/security checks.
- [x] Confirm GitHub secret scanning and push protection are enabled.
- [ ] Enable private vulnerability reporting.
- [x] Confirm GitHub Actions are enabled for the repository.
- [x] Add a GitHub Actions workflow for tests with coverage, dependency audit, syntax checks, and manifest validation.
- [x] Extend CI with package construction, allowlist verification, and artifact upload.
- [ ] Enable Dependabot security updates after reviewing its update policy.
- [ ] Protect `main` after CI exists: require a pull request and passing checks.
- [ ] Add a support link to the repository and Chrome Web Store listing.

Do not put Dreaming credentials, browser profiles, session cookies, or Chrome Web Store credentials in repository secrets. Current CI requires no secrets.

## 4. Chrome Web Store preparation

- [ ] Register and verify a Chrome Web Store developer account.
- [ ] Add icons, at least one compliant screenshot, a short description, a detailed description, and support information.
- [ ] Link to the repository `PRIVACY.md` using a stable public URL.
- [ ] Complete the privacy questionnaire consistently with `PRIVACY.md` and `SECURITY.md`.
- [ ] Justify the `storage` permission as synchronized user preferences.
- [ ] Justify host access to `https://app.dreaming.com/*` as page enhancement and public catalog retrieval.
- [ ] Confirm that no remote code, analytics, advertising, credential access, or premium-access bypass exists.
- [ ] Run the release checks in `docs/TESTING.md`.
- [ ] Inspect the final ZIP manually before upload.

Official developer dashboard: https://chrome.google.com/webstore/devconsole

## 5. Store package contents

The packaged ZIP should contain only runtime assets, for example:

```text
manifest.json
icons/
src/
  content.css
  content.js
  core.js
  options.css
  options.html
  options.js
```

It must exclude development and private material, including:

```text
.git/
.github/
node_modules/
coverage/
tests/
docs/
.env*
package.json
package-lock.json
vitest.config.js
```

The package process must fail if required files are missing, versions disagree, or unexpected files are present.

## 6. Submission and launch

- [ ] Upload the ZIP and complete all listing fields.
- [ ] Save the submitted ZIP and listing text with the release records.
- [ ] Address review feedback without weakening permissions, privacy, or security controls.
- [ ] Publish initially to a limited audience if the store supports the desired rollout.
- [ ] Verify installation from the store on a clean Chrome profile.
- [ ] Announce only after store installation and automatic updates are confirmed.

## 7. Release checklist

For every release:

1. Update implementation and living documentation.
2. Record non-obvious decisions in `docs/DECISIONS.md`.
3. Run:

   ```bash
   npm ci
   npm test
   npm run test:coverage
   npm audit
   ```

4. Complete the required manual matrix in `docs/TESTING.md`.
5. Verify `package.json` and `manifest.json` versions match.
6. Bump the version according to Semantic Versioning.
7. Build and inspect the store ZIP.
8. Merge through `main`, create the version tag, and push tags.
9. Create a GitHub Release with changes, known limitations, test results, and the exact ZIP.
10. Upload the same ZIP to the Chrome Web Store.
11. Verify the published update on a clean profile.

Prove the manual release process before automating publication. CI may build and validate artifacts, but store publishing should remain approval-gated.

## 8. Maintenance expectations

Likely maintenance triggers are Dreaming DOM changes, catalog schema or URL changes, native badge changes, new language routes, Chrome extension policy changes, and dependency advisories.

Maintenance practices:

- Triage confirmed user reports with browser, platform, route, and settings details.
- Keep stable selectors and avoid generated CSS-module names.
- Add a regression test before fixing a compatibility bug.
- Review dependencies periodically; runtime packages should remain unnecessary.
- Consider a scheduled unauthenticated check that `es.json` and `fr.json` respond and retain required fields.
- Never automate login or store Dreaming credentials for compatibility monitoring.
- Re-run the manual smoke matrix after meaningful Dreaming redesigns.

This should be occasional maintenance, but a Dreaming frontend redesign may require prompt selector updates.

## 9. Other browsers

Microsoft Edge is an initial compatibility target because it uses Chromium and can install Chrome Web Store extensions. A separate Edge Add-ons listing is optional and should be considered only after Chrome publication is stable.

Firefox is not currently supported. Treat Firefox as a separate feature requiring manifest/API review, automated testing, manual validation, packaging, and its own store/privacy submission. Do not claim Firefox compatibility before that work is complete.
