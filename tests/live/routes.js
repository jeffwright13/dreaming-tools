// Pinned pages for the live suite. The free-tier videos still need a free
// account to play; logged out, Dreaming shows a sign-up prompt in place of the
// player. If a video is removed, pick another of the same player type and
// update docs/TESTING.md.
const BASE = "https://app.dreaming.com";
const watchUrl = (id) => `${BASE}/spanish/watch?id=${id}`;

export const DREAMING_PLAYER_VIDEO = Object.freeze({
  id: "5e4d121caac87f3820954cb5",
  url: watchUrl("5e4d121caac87f3820954cb5"),
  player: "dreaming",
});

// YouTube-served only for a free account: Dreaming gives premium accounts its
// own player for every video (docs/TESTING.md, "Which player a page uses").
// The test profile must therefore stay a free account.
export const YOUTUBE_SERVED_VIDEO = Object.freeze({
  id: "6ae0934444135614096a680f",
  url: watchUrl("6ae0934444135614096a680f"),
  player: "youtube",
});

export const routes = Object.freeze({
  browse: (language) => `${BASE}/${language}/browse`,
  browseEasy: (language) => `${BASE}/${language}/browse?sort=easy`,
  series: (language) => `${BASE}/${language}/series`,
  libraryHistory: `${BASE}/spanish/library/history`,
  myList: `${BASE}/spanish/library/my-list`,
});
