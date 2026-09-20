// The Maple Bean wardrobe: catalog, ownership and equipping. Items only change
// the player's own avatar; the regulars keep their established looks.
//
// Tints recolour a region of the existing outfit while keeping its knit and
// denim texture. Hairstyles reuse the cast's authored hair meshes; accessories
// are small props worn on the head or neck.
export const SLOTS = [
  { id: 'top', label: 'Tops' }, { id: 'bottom', label: 'Bottoms' }, { id: 'shoes', label: 'Shoes' },
  { id: 'hair', label: 'Hairstyles' }, { id: 'hairColor', label: 'Hair colour' },
  { id: 'eyes', label: 'Glasses' }, { id: 'head', label: 'Hats & clips' }, { id: 'neck', label: 'Scarves' },
];
export const CATALOG = [
  { id: 'top-cream', slot: 'top', name: 'Cream Heart Knit', price: 0, tint: null },
  { id: 'top-maple', slot: 'top', name: 'Maple Red Knit', price: 60, tint: '#b8503c' },
  { id: 'top-matcha', slot: 'top', name: 'Matcha Knit', price: 70, tint: '#8fae6e' },
  { id: 'top-latte', slot: 'top', name: 'Latte Knit', price: 60, tint: '#c79b74' },
  { id: 'top-lavender', slot: 'top', name: 'Lavender Knit', price: 80, tint: '#a898c8' },
  { id: 'top-sky', slot: 'top', name: 'Morning Sky Knit', price: 80, tint: '#8fb1d4' },
  { id: 'bottom-denim', slot: 'bottom', name: 'Classic Wide Denim', price: 0, tint: null },
  { id: 'bottom-dark', slot: 'bottom', name: 'Dark Wash Denim', price: 70, tint: '#3d4d6b' },
  { id: 'bottom-cream', slot: 'bottom', name: 'Cream Trousers', price: 90, tint: '#e6dac4' },
  { id: 'bottom-espresso', slot: 'bottom', name: 'Espresso Trousers', price: 90, tint: '#5a4436' },
  { id: 'bottom-olive', slot: 'bottom', name: 'Olive Trousers', price: 90, tint: '#6d7552' },
  { id: 'shoes-cream', slot: 'shoes', name: 'Cream Sneakers', price: 0, tint: null },
  { id: 'shoes-espresso', slot: 'shoes', name: 'Espresso Loafers', price: 50, tint: '#4a342a' },
  { id: 'shoes-sage', slot: 'shoes', name: 'Sage Sneakers', price: 50, tint: '#93a585' },
  { id: 'shoes-cherry', slot: 'shoes', name: 'Cherry Canvas', price: 50, tint: '#b44a45' },
  { id: 'hair-bun', slot: 'hair', name: 'Messy Bun', price: 0, source: 'maya' },
  { id: 'hair-waves', slot: 'hair', name: 'Long Waves', price: 150, source: 'claire' },
  { id: 'hair-lowbun', slot: 'hair', name: 'Low Bun', price: 120, source: 'mara' },
  { id: 'haircolor-natural', slot: 'hairColor', name: 'Natural Espresso', price: 0, tint: null },
  { id: 'haircolor-honey', slot: 'hairColor', name: 'Honey Blonde', price: 90, tint: '#c9a46c' },
  { id: 'haircolor-auburn', slot: 'hairColor', name: 'Maple Auburn', price: 90, tint: '#8a4028' },
  { id: 'haircolor-ink', slot: 'hairColor', name: 'Ink Black', price: 70, tint: '#1a1614' },
  { id: 'eyes-none', slot: 'eyes', name: 'No glasses', price: 0, prop: null },
  { id: 'eyes-round', slot: 'eyes', name: 'Round Study Glasses', price: 80, prop: 'glasses' },
  { id: 'head-none', slot: 'head', name: 'Nothing', price: 0, prop: null },
  { id: 'head-leaf', slot: 'head', name: 'Maple Leaf Clip', price: 40, prop: 'leaf-clip' },
  { id: 'head-beret', slot: 'head', name: 'Café Beret', price: 110, prop: 'beret' },
  { id: 'neck-none', slot: 'neck', name: 'Nothing', price: 0, prop: null },
  { id: 'neck-scarf', slot: 'neck', name: 'Cinnamon Scarf', price: 90, prop: 'scarf', color: '#b0654a' },
  { id: 'study-scarf', slot: 'neck', name: 'Scholar’s Scarf', price: null, prop: 'scarf', color: '#304c40', reward: '5-day study streak' },
];
export const itemById = id => CATALOG.find(i => i.id === id);
export function defaultWardrobe() {
  const owned = CATALOG.filter(i => i.price === 0).map(i => i.id);
  return { owned, equipped: Object.fromEntries(SLOTS.map(s => [s.id, CATALOG.find(i => i.slot === s.id && i.price === 0).id])) };
}
export function buy(wardrobe, economy, id) {
  const item = itemById(id);
  if (!item) throw new Error('That item is not in the shop.');
  if (wardrobe.owned.includes(id)) throw new Error('You already own this.');
  if (item.price === null) throw new Error('Earned through ' + item.reward + '.');
  if (economy.coins < item.price) throw new Error('Not enough Maple Coins yet.');
  return { wardrobe: { ...wardrobe, owned: [...wardrobe.owned, id] }, economy: { ...economy, coins: economy.coins - item.price } };
}
export function equip(wardrobe, id, unlocked = []) {
  const item = itemById(id);
  if (!item) throw new Error('Unknown item.');
  if (!wardrobe.owned.includes(id) && !unlocked.includes(id)) throw new Error('Buy it first.');
  return { ...wardrobe, equipped: { ...wardrobe.equipped, [item.slot]: id } };
}
export function validWardrobe(w) {
  return w && Array.isArray(w.owned) && w.owned.every(id => itemById(id)) && w.equipped && Object.entries(w.equipped).every(([slot, id]) => itemById(id)?.slot === slot);
}
// Everything the renderer needs to dress the avatar.
export function lookFor(wardrobe) {
  const e = id => itemById(wardrobe.equipped[id]) || {};
  return { top: e('top').tint || null, bottom: e('bottom').tint || null, shoes: e('shoes').tint || null, hair: e('hair').source || 'maya', hairColor: e('hairColor').tint || null, props: ['eyes', 'head', 'neck'].map(s => e(s)).filter(i => i.prop).map(i => ({ prop: i.prop, color: i.color })) };
}
