// A small declarative registry: what a station *kind* offers the player,
// separate from *how* the game responds (that stays in app.js, which owns
// the wallet/session/NPC state these actions need). New interactable kinds
// (a study desk, a music corner...) start here as data, not new branching.
export const VERBS = {
  seat: { prompt: 'Sit and relax', action: 'Sit' },
  read: { prompt: 'Read by the window', action: 'Sit' },
  coffee: { prompt: 'Order a drink', action: 'Order' },
  study: { prompt: 'Sit and focus', action: 'Sit' },
  talk: { prompt: null, action: 'Talk' }, // per-NPC prompt text is supplied by the caller
};
export function verbFor(kind) { return VERBS[kind] || VERBS.talk; }

// A light "browse the shelf" flavor activity for the reading nook, seated-only.
// No new geometry needed - it reuses the nook's existing book dressing.
export const BROWSE_LINES = [
  '“A dog-eared novel, half-finished by someone else. You pick up where they left off.”',
  '“A slim poetry collection falls open to a page someone once folded a corner on.”',
  '“A guide to Maple Hollow’s walking trails, with a coffee ring on the cover.”',
  '“Someone’s left a postcard as a bookmark. You don’t peek at what it says.”',
  '“A recipe clipped from a newspaper is tucked between the pages. Maple syrup shortbread.”',
];
export function randomBrowseLine(rng = Math.random) {
  return BROWSE_LINES[Math.floor(rng() * BROWSE_LINES.length)];
}
