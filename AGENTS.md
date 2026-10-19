# Project Instructions

Run automated tests and coverage with:

```bash
npm test
npm run test:coverage
npm run package
npm run package:verify
```

Load the repository root as an unpacked Manifest V3 extension in Chrome for manual verification—not a directory extracted from a release ZIP, which will not reflect working-tree edits. After code changes, reload the extension and then reload the Dreaming tab.
