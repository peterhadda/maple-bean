// Look descriptors: everything the generator needs to know about a resident,
// as data. `resolveLook` accepts either a full look or a legacy cast entry from
// characters.js ({name, character, male, colors}) and derives exactly the values
// maya-character.js hard-codes for Maya, Mara, Jules and Claire, so the parity
// check can prove the refactor changed nothing.

// Iris gradient stops (pupil edge → limbus) and the lighter lower-iris tint.
export const IRIS = {
  brown: { stops: ['#2e1408', '#874526', '#6a3419', '#4a210d', '#1c0b04'], lower: '210,130,70' },
  blue: { stops: ['#15314c', '#739fc6', '#5481ad', '#355879', '#172e48'], lower: '160,201,232' },
  darkBrown: { stops: ['#170a05', '#5a2e17', '#472311', '#2f1609', '#100603'], lower: '150,92,52' },
  hazel: { stops: ['#241508', '#8a6a2c', '#6f5323', '#4b3717', '#1a1106'], lower: '196,160,90' },
};
export const BROW = { dark: 'rgba(50,30,22,.96)', honey: 'rgba(128,85,52,.96)', black: 'rgba(28,18,14,.97)' };

export const LEGACY_HAIR = ['messy-bun', 'long-waves', 'slick-short'];

const hex = v => typeof v === 'string' ? parseInt(v.replace('#', ''), 16) : v;

export function resolveLook(o = {}) {
  const claire = o.character === 'claire', mara = o.character === 'mara';
  const male = o.body ? o.body === 'masculine' : !!o.male;
  const colors = {};
  for (const [k, v] of Object.entries(o.colors || {})) colors[k] = hex(v);
  return {
    name: o.name, character: o.character, male,
    phaseOffset: o.phaseOffset || 0, nohair: !!o.nohair,
    // GPU skinning is the kit default (~25× cheaper per pose update, verified by
    // /phase2/lab/gpu-skin). 'cpu' reproduces maya-character.js exactly for parity.
    skinning: o.skinning === 'cpu' ? 'cpu' : 'gpu',
    colors,
    hair: {
      style: o.hair?.style ?? (claire ? 'long-waves' : male ? 'slick-short' : 'messy-bun'),
      shader: o.hair?.shader ?? (claire ? 'plain' : 'kk'),
    },
    face: {
      iris: o.face?.iris ?? (claire ? 'blue' : 'brown'),
      brow: o.face?.brow ?? (claire ? 'honey' : 'dark'),
      paint: o.face?.paint === 'auto' ? 'auto' : 'legacy',
      freckles: o.face?.freckles,
      liner: o.face?.liner,
    },
    top: {
      style: o.top?.style ?? 'knit',
      neckline: o.top?.neckline ?? (claire ? 'cami' : 'crew'),
      motif: o.top !== undefined ? (o.top.motif ?? null) : (!o.character || o.character === 'maya') ? 'heart' : null,
      sleeves: o.top?.sleeves ?? (claire ? 'bare' : 'knit'),
      collar: o.top?.collar ?? null,
    },
    bottom: {
      style: o.bottom?.style ?? 'wide-leg',
      fabric: o.bottom?.fabric ?? 'denim',
      cuff: !!o.bottom?.cuff,
    },
    shoes: {
      style: o.shoes?.style ?? 'sneakers',
      upper: hex(o.shoes?.upper ?? 0xf3e7dc), sole: hex(o.shoes?.sole ?? 0xeee0d3),
      line: hex(o.shoes?.line ?? 0xc8a88e), contact: hex(o.shoes?.contact ?? 0xb1876e),
    },
    layers: o.layers ?? (claire ? ['cardigan'] : mara ? ['apron'] : []),
    layerColors: Object.fromEntries(Object.entries(o.layerColors || {}).map(([k, v]) => [k, hex(v)])),
    accessories: o.accessories ?? [],
    accessoryColors: Object.fromEntries(Object.entries(o.accessoryColors || {}).map(([k, v]) => [k, hex(v)])),
  };
}
