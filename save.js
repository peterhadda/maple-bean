// SaveSystem: a thin, consistent wrapper around localStorage for the small
// bits of local player data this game persists (settings, focus stats,
// notes, the guest wallet...). No backend - a local browser playtest
// doesn't need one yet - but funnelling every read/write through one place
// means an eventual account-backed store only has to change this file.
export function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function save(key, value, onError) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { onError?.(e); }
}
export const KEYS = {
  wallet: 'maple-bean-wallet',
  notes: 'maple-bean-notes',
  name: 'maple-bean-name',
  focusStats: 'maple-bean-focus-stats',
  settings: 'maple-bean-settings',
};
export function defaultSettings() { return { volume: 55, lighting: 'afternoon' }; }
