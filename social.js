// Social presence foundation: what a player's status looks like to OTHER
// players, and the small emote set. Pure and framework-free so it can be
// imported by both the browser client and the Node server (which validates
// incoming status/emote ids against the same list, rather than duplicating
// it) and unit tested without a browser or a network connection.

export const STATUS_META = {
  available: { emoji: '🟢', label: 'Available' },
  relaxing: { emoji: '🛋️', label: 'Relaxing' },
  drinking: { emoji: '☕', label: 'Drinking Coffee' },
  studying: { emoji: '📚', label: 'Studying' },
  focus: { emoji: '📚', label: 'Focusing' },
  music: { emoji: '🎵', label: 'Listening to Music' },
  playing: { emoji: '🎲', label: 'Playing a game' },
};
export const STATUS_IDS = Object.keys(STATUS_META);

// Priority order matters: a focused player is never shown as merely
// "drinking coffee" just because they're holding a cup at their desk.
export function deriveStatus({ seated, stationKind, focusActive, focusDetail, musicPlaying, hasDrink, playing }) {
  if (focusActive) return { id: 'focus', detail: focusDetail };
  if (playing) return { id: 'playing' };
  if (musicPlaying) return { id: 'music' };
  if (seated && stationKind === 'study') return { id: 'studying' };
  if (seated) return { id: 'relaxing' };
  if (hasDrink) return { id: 'drinking' };
  return { id: 'available' };
}
export function statusText(id, detail) {
  const meta = STATUS_META[id] || STATUS_META.available;
  return meta.emoji + ' ' + meta.label + (detail ? ' — ' + detail : '');
}

export const EMOTES = [
  { id: 'wave', emoji: '👋', label: 'Wave' },
  { id: 'heart', emoji: '❤️', label: 'Heart' },
  { id: 'laugh', emoji: '😂', label: 'Laugh' },
  { id: 'cheers', emoji: '☕', label: 'Cheers' },
  { id: 'like', emoji: '👍', label: 'Like' },
];
export const EMOTE_IDS = EMOTES.map(e => e.id);
export function emoteEmoji(id) { return EMOTES.find(e => e.id === id)?.emoji || '👋'; }
