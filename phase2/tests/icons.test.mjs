import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_ICONS, SKIN_TONES, BARISTA_STEP_ICONS } from '../shared/icons.js';
import { GAMES } from '../../minigames.js';
import { cast } from '../../characters.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hex = n => '#' + n.toString(16).padStart(6, '0');

test('every icon in the manifest has an exported PNG', () => {
  for (const entry of ALL_ICONS) assert.ok(existsSync(root + entry.src.slice(1)), entry.src);
});

test('every barista step in minigames.js has an icon', () => {
  for (const step of GAMES['coffee-making'].steps) assert.ok(BARISTA_STEP_ICONS[step.id], step.id);
});

test('skin swatches marked for a canonical resident match characters.js', () => {
  for (const tone of SKIN_TONES.filter(t => cast[t.resident])) assert.equal(tone.hex, hex(cast[tone.resident].colors.skin), tone.id);
});
