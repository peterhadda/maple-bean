// Phase 2 residents. Prototype looks for review, built only from the kit's
// construction (see docs/CHARACTER-DNA.md §10). Not part of the production cast.
export const PHASE2_RESIDENTS = Object.freeze({
  leo: Object.freeze({
    name: 'Leo', character: 'leo', body: 'masculine', phaseOffset: 1.1,
    colors: { skin: '#c4906a', hair: '#3b2519', top: '#ece2d2', denim: '#384560' },
    hair: { style: 'textured-quiff', shader: 'kk' },
    face: { iris: 'hazel', brow: 'dark', paint: 'auto', liner: 'thin', freckles: 12 },
    top: { style: 'knit', neckline: 'crew', motif: null, sleeves: 'knit' },
    bottom: { style: 'straight', fabric: 'denim', cuff: true },
    shoes: { style: 'sneakers', upper: '#f1ebe1', sole: '#e6dccd', line: '#b99a7c', contact: '#8f735e' },
    layers: ['overshirt'], layerColors: { overshirt: '#a65a40' },
    accessories: ['watch'], accessoryColors: { watch: '#3a3330' },
  }),
  noah: Object.freeze({
    name: 'Noah', character: 'noah', body: 'masculine', phaseOffset: 3.4,
    colors: { skin: '#5e3b2a', hair: '#17100c', top: '#3b4759', denim: '#b7a585' },
    hair: { style: 'short-curls', shader: 'kk' },
    face: { iris: 'darkBrown', brow: 'black', paint: 'auto', liner: 'thin', freckles: 0 },
    top: { style: 'sweater', neckline: 'crew', motif: null, sleeves: 'knit', collar: 'shirt' },
    bottom: { style: 'straight', fabric: 'chino', cuff: false },
    shoes: { style: 'boots', upper: '#4a3326', sole: '#2b2320', line: '#7a5a42', contact: '#1f1916' },
    layers: [],
    accessories: ['glasses', 'backpack'], accessoryColors: { glasses: '#8a6a3e', backpack: '#3f5a4c', straps: '#7d5436' },
  }),
});
