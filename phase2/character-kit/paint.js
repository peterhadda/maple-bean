// Face paint parameters. LEGACY_PAINT holds the exact strings maya-character.js
// paints for every canonical resident (tuned for light skin, same for all body
// types). `paintFor` keeps those for legacy looks and, for looks that opt into
// `face.paint: 'auto'`, derives lips, blush, freckles, lid shading and brow
// strokes from the skin tone and body type so deep skin and masculine faces
// read naturally with the same painted construction.
export const LEGACY_PAINT = Object.freeze({
  blush: ['rgba(238,108,96,0.56)', 'rgba(238,114,98,0.32)', 'rgba(238,120,100,0)'],
  noseFlush: ['rgba(250,128,100,0.38)', 'rgba(250,128,100,0)'],
  freckles: 22, freckle: '185,95,65',
  nostril: 'rgba(170,80,62,0.28)',
  lipUpper: 'rgba(206,98,84,0.80)',
  lipLower: ['rgba(214,100,84,0.85)', 'rgba(232,118,96,0.82)', 'rgba(226,120,100,0.55)'],
  lipSeam: 'rgba(140,42,32,0.9)', lipCorner: 'rgba(150,60,45,0.45)', lipHighlight: 'rgba(255,228,212,0.30)',
  browStrokeA: '52,32,24', browStrokeB: '96,62,46', browArch: 0.0070, browThickness: 1,
  lidShade: 'rgba(196,110,86,0.20)', crease: 'rgba(150,80,60,0.38)', liner: 'wing',
});

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h, s, l) {
  if (!s) return [l, l, l];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
const rgb = (h, s, l) => hslToRgb(((h % 1) + 1) % 1, clamp(s, 0, 1), clamp(l, 0, 1)).map(v => Math.round(v * 255)).join(',');
const rgba = (h, s, l, a) => `rgba(${rgb(h, s, l)},${+a.toFixed(3)})`;
// Nudge a hue toward red (0) by k, taking the short way round the wheel.
const towardRed = (h, k) => h > .5 ? h + (1 - h) * k : h * (1 - k);

export function paintFor(look, skinHex, browColor) {
  if (look.face.paint !== 'auto') return LEGACY_PAINT;
  const [h, s, l] = rgbToHsl((skinHex >> 16 & 255) / 255, (skinHex >> 8 & 255) / 255, (skinHex & 255) / 255);
  const m = look.male, deep = 1 - clamp((l - .25) / .45, 0, 1); // 0 light … 1 deep
  const lipH = towardRed(h, .55), lipS = clamp(s * .85 + .12, .22, .55), lipL = l * (.70 - .06 * deep);
  const lipA = m ? .5 : .75;
  const blushA = (m ? .14 : .34) * (1 - .45 * deep);
  const bm = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(browColor || '') || [0, 50, 30, 22];
  const [bh, bs, bl] = rgbToHsl(bm[1] / 255, bm[2] / 255, bm[3] / 255);
  return {
    blush: [rgba(towardRed(h, .6), s + .12, l * .86, blushA), rgba(towardRed(h, .6), s + .1, l * .88, blushA * .55), rgba(towardRed(h, .6), s, l * .9, 0)],
    noseFlush: [rgba(towardRed(h, .5), s + .08, l * .88, blushA * .6), rgba(towardRed(h, .5), s, l * .9, 0)],
    freckles: look.face.freckles ?? 0, freckle: rgb(h, s + .05, l * .6),
    nostril: rgba(h, s, l * .45, .32),
    lipUpper: rgba(lipH, lipS, lipL * .92, lipA),
    lipLower: [rgba(lipH, lipS, lipL, lipA + .05), rgba(lipH, lipS + .03, lipL * 1.08, lipA), rgba(lipH, lipS, lipL * 1.1, lipA * .65)],
    lipSeam: rgba(lipH, lipS, l * .36, m ? .7 : .85), lipCorner: rgba(lipH, lipS, l * .45, .38),
    lipHighlight: rgba(h, s * .5, l + (1 - l) * .4, m ? .14 : .26),
    browStrokeA: rgb(bh, bs, bl * .9), browStrokeB: rgb(bh, bs, Math.min(.5, bl * 1.6 + .08)),
    browArch: m ? .0042 : .0070, browThickness: m ? 1.12 : 1,
    lidShade: rgba(h, s, l * .7, .2), crease: rgba(h, s, l * .52, .34),
    liner: look.face.liner ?? (m ? 'thin' : 'wing'),
  };
}
