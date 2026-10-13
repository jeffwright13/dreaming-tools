# Security Policy

## Supported versions

Until the first Chrome Web Store release, security fixes are applied to the latest code on `main`. After publication, this section should list actively supported store versions.

## Reporting a vulnerability

Do not include exploit details, credentials, tokens, cookies, or private account information in a public issue.

Before public launch, enable GitHub private vulnerability reporting for this repository. Once enabled, use the repository's **Report a vulnerability** link. Until then, open a minimal issue requesting a private contact channel without disclosing sensitive details.

Non-sensitive bugs and compatibility problems may be reported at https://github.com/jeffwright13/dreaming-tools/issues.

## Security posture

The extension:

- Requests only `storage` and access to `https://app.dreaming.com/*`
- Runs content scripts only on supported Spanish and French Dreaming routes
- Fetches public catalogs with `credentials: "omit"`
- Stores only validated behavior, style, size, and position enums
- Does not request cookie, history, tabs, scripting, web-request, identity, or credential permissions
- Does not use remote code, dynamic evaluation, HTML injection, analytics, advertising, or a developer server
- Creates badge content with `textContent` and fixed CSS classes
- Has no runtime npm dependencies in the packaged extension

## Review record

A source and dependency review on 2026-10-13 found no embedded credentials, secret-like values, credential storage, credential-bearing requests, unsafe HTML insertion, remote code execution mechanism, analytics, or known npm vulnerabilities.

The review also confirmed that catalog requests omit credentials and that synchronized storage is limited to normalized enum preferences. Repository history was scanned for common private-key and token patterns without a finding.

This review is point-in-time, not a guarantee. Repeat the checks in `docs/TESTING.md` before each store release and whenever permissions, network destinations, storage, or dependencies change.
