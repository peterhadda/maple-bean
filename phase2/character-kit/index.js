// Public entry point of the Phase 2 character kit. Pages and games import from
// here, never from generator.js directly, so the kit's internals can change
// while the parity check keeps the canonical residents identical.
import { cast } from '../../characters.js';
import { createMaya } from './generator.js';

// The production cast, read-only. Returned as fresh deep copies so no caller
// can mutate characters.js presets through the kit.
export function legacyLook(id) {
  const entry = cast[id];
  if (!entry) throw new Error('Unknown canonical resident: ' + id);
  return structuredClone(entry);
}
export const CANONICAL_IDS = Object.freeze(Object.keys(cast));

export function createResident(look) {
  return createMaya(look);
}
