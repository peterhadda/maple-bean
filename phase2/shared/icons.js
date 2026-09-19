// Icon manifest for Canva-made icons exported to /design-assets/canva/icons/.
// Source designs live in Canva: "Maple Bean · Icons & Logos" (subfolders per group).
// Re-export from Canva rather than editing the PNGs here.

const BASE = '/design-assets/canva/icons/';
const icon = (group, id, label, extra = {}) => Object.freeze({ id, label, group, src: BASE + group + '/' + id + '.png', ...extra });

export const MINIGAME_ICONS = Object.freeze([
  icon('minigames', 'barista-rush', 'Barista Rush'),
  icon('minigames', 'bean-run', 'Bean Run'),
  icon('minigames', 'latte-art', 'Latte Art'),
  icon('minigames', 'table-dash', 'Table Dash'),
]);

// Creator categories. Order matches the creator steps (Skin → Hair → Clothing).
export const WARDROBE_ICONS = Object.freeze([
  icon('wardrobe', 'skin-tone', 'Skin tone'),
  icon('wardrobe', 'hair', 'Hair'),
  icon('wardrobe', 'tops', 'Tops'),
  icon('wardrobe', 'bottoms', 'Bottoms'),
  icon('wardrobe', 'shoes', 'Shoes'),
  icon('wardrobe', 'accessories', 'Accessories'),
]);

// One swatch per skin tone, light → deep. `hex` is the exact colour drawn in Canva;
// `resident` marks the tone a canonical or Phase 2 resident already uses.
export const SKIN_TONES = Object.freeze([
  ['skin-01-porcelain', 'Porcelain', '#f6d7c3'],
  ['skin-02-ivory', 'Ivory', '#f1c7a5'],
  ['skin-03-peach', 'Peach', '#eeb092', 'maya'],
  ['skin-04-rose', 'Rose', '#eaaf8e', 'claire'],
  ['skin-05-light-olive', 'Light olive', '#e0b58c'],
  ['skin-06-honey', 'Honey', '#d6a07d', 'mara'],
  ['skin-07-golden', 'Golden', '#c4906a', 'leo'],
  ['skin-08-olive-tan', 'Olive tan', '#b8875c'],
  ['skin-09-amber', 'Amber', '#a4724f'],
  ['skin-10-warm-brown', 'Warm brown', '#895d43', 'jules'],
  ['skin-11-chestnut', 'Chestnut', '#7a4e36'],
  ['skin-12-cocoa', 'Cocoa', '#5e3b2a', 'noah'],
  ['skin-13-deep', 'Deep', '#4a2d20'],
  ['skin-14-ebony', 'Ebony', '#3a231a'],
].map(([id, label, hex, resident]) => icon('skins', id, label, { hex, resident: resident ?? null })));

export const MENU_ICONS = Object.freeze([
  icon('menu', 'latte', 'Latte'),
  icon('menu', 'espresso', 'Espresso'),
  icon('menu', 'iced-coffee', 'Iced coffee'),
  icon('menu', 'tea', 'Tea'),
  icon('menu', 'hot-chocolate', 'Hot chocolate'),
  icon('menu', 'croissant', 'Croissant'),
  icon('menu', 'maple-cookie', 'Maple cookie'),
  icon('menu', 'bean-card', 'Bean Card'),
]);

// Keyed by the step ids in minigames.js (cup, coffee, milk, flavor, serve) so they can replace the emoji.
export const BARISTA_STEP_ICONS = Object.freeze(Object.fromEntries([
  icon('barista', 'cup', 'Cup'),
  icon('barista', 'coffee', 'Coffee'),
  icon('barista', 'milk', 'Milk'),
  icon('barista', 'flavor', 'Flavour'),
  icon('barista', 'serve', 'Serve'),
].map(entry => [entry.id, entry])));

export const ALL_ICONS = Object.freeze([
  ...MINIGAME_ICONS, ...WARDROBE_ICONS, ...SKIN_TONES, ...MENU_ICONS, ...Object.values(BARISTA_STEP_ICONS),
]);
