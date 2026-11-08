// Pinned free-tier Spanish videos used by the live suite. A free account is
// still needed to play them; logged out, Dreaming shows a sign-up prompt in
// place of the player. If one is removed, pick another of the same player
// type and update docs/TESTING.md.
const watchUrl = (id) => `https://app.dreaming.com/spanish/watch?id=${id}`;

export const DREAMING_PLAYER_VIDEO = Object.freeze({
  id: "5e4d121caac87f3820954cb5",
  url: watchUrl("5e4d121caac87f3820954cb5"),
  player: "dreaming",
});

export const YOUTUBE_SERVED_VIDEO = Object.freeze({
  id: "6ae0934444135614096a680f",
  url: watchUrl("6ae0934444135614096a680f"),
  player: "youtube",
});

export const PINNED_VIDEOS = Object.freeze([DREAMING_PLAYER_VIDEO, YOUTUBE_SERVED_VIDEO]);
