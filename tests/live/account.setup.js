// Runs before the logged-in tests: record the account's Dreaming subtitle
// choice, which those tests change, so account.teardown.js can restore it.
// An existing record is kept: it means an earlier run never restored, and it
// holds the true original.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test, expect, SUBTITLE_CHOICE_RECORD } from "./fixtures.js";
import { dreamingPlayer, openWatchPage } from "./players.js";
import { DREAMING_PLAYER_VIDEO } from "./routes.js";

test("record the account's Dreaming subtitle choice", async ({ context }) => {
  if (existsSync(SUBTITLE_CHOICE_RECORD)) {
    const { choice } = JSON.parse(readFileSync(SUBTITLE_CHOICE_RECORD, "utf8"));
    console.warn(`Keeping the subtitle choice "${choice}" recorded by an earlier run that did not restore it.`);
    return;
  }
  const page = await openWatchPage(context, DREAMING_PLAYER_VIDEO);
  const choice = await dreamingPlayer(page).currentSubtitleChoice();
  expect(choice, "the Video settings menu should show the current subtitle choice").not.toBeNull();
  writeFileSync(SUBTITLE_CHOICE_RECORD, JSON.stringify({ choice, recorded: new Date().toISOString() }));
});
