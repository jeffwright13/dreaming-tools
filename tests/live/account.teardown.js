// Runs after the logged-in tests, whether or not they passed: put the
// account's Dreaming subtitle choice back to what account.setup.js recorded.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { test, SUBTITLE_CHOICE_RECORD } from "./fixtures.js";
import { dreamingPlayer, openWatchPage } from "./players.js";
import { DREAMING_PLAYER_VIDEO } from "./routes.js";

test("restore the account's Dreaming subtitle choice", async ({ context }) => {
  if (!existsSync(SUBTITLE_CHOICE_RECORD)) {
    return;
  }
  const { choice } = JSON.parse(readFileSync(SUBTITLE_CHOICE_RECORD, "utf8"));
  try {
    const page = await openWatchPage(context, DREAMING_PLAYER_VIDEO);
    const player = dreamingPlayer(page);
    if (await player.currentSubtitleChoice() !== choice) {
      await player.setSubtitles(choice);
    }
  } catch (error) {
    throw new Error(`Could not restore the account's Dreaming subtitle choice to "${choice}". Set it by hand in the player's Video settings. ${error.message}`);
  }
  rmSync(SUBTITLE_CHOICE_RECORD);
});
