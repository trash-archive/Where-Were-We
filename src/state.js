/**
 * state.js
 * Central game state — single source of truth.
 */

export const state = {
  /** @type {Array<{id:string, file:File|null, url:string, lat:number|null, lng:number|null, name:string}>} */
  images: [],

  /** Shuffled subset used for the current game */
  gameImages: [],

  currentRound: 0,
  totalScore: 0,

  /** @type {Array<{img, guess, distKm, score}>} */
  roundResults: [],

  /** Currently placed guess {lat, lng} or null */
  currentGuess: null,
};

export function resetGame() {
  state.gameImages = [...state.images.filter((i) => i.lat !== null)].sort(
    () => Math.random() - 0.5
  );
  state.currentRound = 0;
  state.totalScore = 0;
  state.roundResults = [];
  state.currentGuess = null;
}
