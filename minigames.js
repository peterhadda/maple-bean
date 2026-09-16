// A small, reusable "click steps in order" engine, plus the registry of
// mini-games built on it. MiniGameManager, in spirit: new small activities
// register a step list here; this sequencing logic doesn't change per game.

export function createSequenceGame(steps) {
  return { steps, index: 0, mistakes: 0, done: false };
}
// Pure: given the current game state and the step the player just clicked,
// returns the next state. Wrong clicks don't lose progress - just a nudge,
// matching "very small relaxing puzzles," not a precision test.
export function attemptStep(game, stepId) {
  if (game.done) return game;
  const expected = game.steps[game.index];
  if (expected.id === stepId) {
    const index = game.index + 1;
    return { ...game, index, done: index >= game.steps.length };
  }
  return { ...game, mistakes: game.mistakes + 1 };
}

export const GAMES = {
  'coffee-making': {
    title: 'Make the drink',
    steps: [
      { id: 'cup', label: 'Cup', emoji: '☕' },
      { id: 'coffee', label: 'Coffee', emoji: '🫘' },
      { id: 'milk', label: 'Milk', emoji: '🥛' },
      { id: 'flavor', label: 'Flavor', emoji: '🍁' },
      { id: 'serve', label: 'Serve', emoji: '🛎️' },
    ],
  },
};
