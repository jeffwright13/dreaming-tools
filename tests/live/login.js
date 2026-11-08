// Opens the logged-in test profile in a visible browser so the maintainer can
// log into Dreaming by hand. The script never reads, types, or stores
// credentials: the browser keeps the session in the profile, which the
// logged-in tests then reuse. Close the window when done.
//
//   npm run test:live:login
//
// The profile lives at DREAMING_TEST_PROFILE (default ~/.dreaming-tools-test-profile),
// outside the repository. Never commit it, copy it into CI, or share it.
import { rmSync } from "node:fs";
import { extractPackage, launchWithExtension, LOGGED_IN_PROFILE } from "./fixtures.js";

const extension = extractPackage();
console.log(`Opening the test profile at ${LOGGED_IN_PROFILE}`);
console.log("Log into Dreaming in the window that opens, then close the window.");

const context = await launchWithExtension(LOGGED_IN_PROFILE, extension.directory, { headless: false });
const page = context.pages()[0] ?? await context.newPage();
await page.goto("https://app.dreaming.com/spanish/");
await new Promise((resolve) => context.on("close", resolve));
rmSync(extension.directory, { recursive: true, force: true });
console.log("Profile saved. Run `npm run test:live` to include the logged-in tests.");
