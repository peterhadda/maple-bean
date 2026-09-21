// The Maple Bean wardrobe: catalog, ownership and equipping. Items only change
// the player's own avatar; the regulars keep their established looks.
//
// Tints recolour a region of the existing outfit while keeping its knit and
// denim texture. Hairstyles reuse the cast's authored hair meshes; accessories
// are small props worn on the head or neck.
//
// Two tiers:
//   starter — everything the café already has. Owned from the moment you sign
//             up, so the character creator never gates a look behind coins.
//   premium — pieces added after launch. These cost Maple Coins, which is what
//             the shop is for once the starter set is free.
export const SLOTS = [
  { id: 'top', label: 'Tops' }, { id: 'bottom', label: 'Bottoms' }, { id: 'shoes', label: 'Shoes' },
  { id: 'hair', label: 'Hairstyles' }, { id: 'hairColor', label: 'Hair colour' },
  { id: 'eyes', label: 'Glasses' }, { id: 'head', label: 'Hats & clips' }, { id: 'neck', label: 'Scarves' },
];
export const PREMIUM_PRICE = 50;
export const CATALOG = [
  // ---------------------------------------------------------------- starter (free with your account)
  { id: 'top-cream', slot: 'top', tier: 'starter', name: 'Cream Heart Knit', price: 0, tint: null },
  { id: 'top-maple', slot: 'top', tier: 'starter', name: 'Maple Red Knit', price: 0, tint: '#b8503c' },
  { id: 'top-matcha', slot: 'top', tier: 'starter', name: 'Matcha Knit', price: 0, tint: '#8fae6e' },
  { id: 'top-latte', slot: 'top', tier: 'starter', name: 'Latte Knit', price: 0, tint: '#c79b74' },
  { id: 'top-lavender', slot: 'top', tier: 'starter', name: 'Lavender Knit', price: 0, tint: '#a898c8' },
  { id: 'top-sky', slot: 'top', tier: 'starter', name: 'Morning Sky Knit', price: 0, tint: '#8fb1d4' },
  { id: 'bottom-denim', slot: 'bottom', tier: 'starter', name: 'Classic Wide Denim', price: 0, tint: null },
  { id: 'bottom-dark', slot: 'bottom', tier: 'starter', name: 'Dark Wash Denim', price: 0, tint: '#3d4d6b' },
  { id: 'bottom-cream', slot: 'bottom', tier: 'starter', name: 'Cream Trousers', price: 0, tint: '#e6dac4' },
  { id: 'bottom-espresso', slot: 'bottom', tier: 'starter', name: 'Espresso Trousers', price: 0, tint: '#5a4436' },
  { id: 'bottom-olive', slot: 'bottom', tier: 'starter', name: 'Olive Trousers', price: 0, tint: '#6d7552' },
  { id: 'shoes-cream', slot: 'shoes', tier: 'starter', name: 'Cream Sneakers', price: 0, tint: null },
  { id: 'shoes-espresso', slot: 'shoes', tier: 'starter', name: 'Espresso Loafers', price: 0, tint: '#4a342a' },
  { id: 'shoes-sage', slot: 'shoes', tier: 'starter', name: 'Sage Sneakers', price: 0, tint: '#93a585' },
  { id: 'shoes-cherry', slot: 'shoes', tier: 'starter', name: 'Cherry Canvas', price: 0, tint: '#b44a45' },
  // Every authored hair mesh in the café, free. `source` names the cast member
  // whose Hair_geometry the runtime swaps in (assets/characters/runtime.js).
  { id: 'hair-bun', slot: 'hair', tier: 'starter', name: 'Messy Bun', price: 0, source: 'maya' },
  { id: 'hair-waves', slot: 'hair', tier: 'starter', name: 'Long Waves', price: 0, source: 'claire' },
  { id: 'hair-lowbun', slot: 'hair', tier: 'starter', name: 'Low Bun', price: 0, source: 'mara' },
  { id: 'hair-crop', slot: 'hair', tier: 'starter', name: 'Short Crop', price: 0, source: 'jules' },
  { id: 'hair-tousled', slot: 'hair', tier: 'starter', name: 'Tousled', price: 0, source: 'noah' },
  { id: 'haircolor-natural', slot: 'hairColor', tier: 'starter', name: 'Natural Espresso', price: 0, tint: null },
  { id: 'haircolor-honey', slot: 'hairColor', tier: 'starter', name: 'Honey Blonde', price: 0, tint: '#c9a46c' },
  { id: 'haircolor-auburn', slot: 'hairColor', tier: 'starter', name: 'Maple Auburn', price: 0, tint: '#8a4028' },
  { id: 'haircolor-ink', slot: 'hairColor', tier: 'starter', name: 'Ink Black', price: 0, tint: '#1a1614' },
  { id: 'eyes-none', slot: 'eyes', tier: 'starter', name: 'No glasses', price: 0, prop: null },
  { id: 'eyes-round', slot: 'eyes', tier: 'starter', name: 'Round Study Glasses', price: 0, prop: 'glasses' },
  { id: 'head-none', slot: 'head', tier: 'starter', name: 'Nothing', price: 0, prop: null },
  { id: 'head-leaf', slot: 'head', tier: 'starter', name: 'Maple Leaf Clip', price: 0, prop: 'leaf-clip' },
  { id: 'head-beret', slot: 'head', tier: 'starter', name: 'Café Beret', price: 0, prop: 'beret' },
  { id: 'neck-none', slot: 'neck', tier: 'starter', name: 'Nothing', price: 0, prop: null },
  { id: 'neck-scarf', slot: 'neck', tier: 'starter', name: 'Cinnamon Scarf', price: 0, prop: 'scarf', color: '#b0654a' },

  // ---------------------------------------------------------------- premium (this season, 50 Maple Coins)
  { id: 'top-plum', slot: 'top', tier: 'premium', name: 'Plum Knit', price: PREMIUM_PRICE, tint: '#7d4f6b' },
  { id: 'top-ink', slot: 'top', tier: 'premium', name: 'Ink Knit', price: PREMIUM_PRICE, tint: '#3a3f4a' },
  { id: 'top-butter', slot: 'top', tier: 'premium', name: 'Butter Knit', price: PREMIUM_PRICE, tint: '#e3c674' },
  { id: 'bottom-slate', slot: 'bottom', tier: 'premium', name: 'Slate Trousers', price: PREMIUM_PRICE, tint: '#4d5560' },
  { id: 'bottom-sand', slot: 'bottom', tier: 'premium', name: 'Sand Trousers', price: PREMIUM_PRICE, tint: '#c8ab84' },
  { id: 'shoes-ink', slot: 'shoes', tier: 'premium', name: 'Ink Sneakers', price: PREMIUM_PRICE, tint: '#2f333b' },
  { id: 'shoes-honey', slot: 'shoes', tier: 'premium', name: 'Honey Loafers', price: PREMIUM_PRICE, tint: '#c98a54' },
  { id: 'haircolor-rosewood', slot: 'hairColor', tier: 'premium', name: 'Rosewood', price: PREMIUM_PRICE, tint: '#7a3b3b' },
  { id: 'haircolor-birch', slot: 'hairColor', tier: 'premium', name: 'Silver Birch', price: PREMIUM_PRICE, tint: '#b4b0a8' },
  { id: 'haircolor-cocoa', slot: 'hairColor', tier: 'premium', name: 'Cocoa', price: PREMIUM_PRICE, tint: '#5c3a26' },
  { id: 'neck-pine', slot: 'neck', tier: 'premium', name: 'Pine Scarf', price: PREMIUM_PRICE, prop: 'scarf', color: '#304c40' },
  { id: 'neck-berry', slot: 'neck', tier: 'premium', name: 'Berry Scarf', price: PREMIUM_PRICE, prop: 'scarf', color: '#a83b2a' },

  // ---------------------------------------------------------------- earned
  { id: 'study-scarf', slot: 'neck', tier: 'earned', name: 'Scholar’s Scarf', price: null, prop: 'scarf', color: '#304c40', reward: '5-day study streak' },
];
export const itemById = id => CATALOG.find(i => i.id === id);
export const isStarter = item => (item && item.tier) === 'starter';
export const starterItems = () => CATALOG.filter(isStarter);
export function defaultWardrobe() {
  const owned = starterItems().map(i => i.id);
  return { owned, equipped: Object.fromEntries(SLOTS.map(s => [s.id, starterItems().find(i => i.slot === s.id).id])) };
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
