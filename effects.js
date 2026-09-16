import * as THREE from 'three';

// A small canvas-generated soft puff texture, shared by every steam sprite.
// No image asset needed, matching the rest of the project's zero-asset approach.
function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Rising, fading steam puffs above any character currently holding a hot drink.
// Kept cheap: a fixed sprite pool, no per-frame allocation, no vertex work.
export function createSteam(scene, maxPuffs = 18) {
  const texture = puffTexture();
  const puffs = [];
  for (let i = 0; i < maxPuffs; i++) {
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false; sprite.scale.setScalar(.001);
    scene.add(sprite);
    puffs.push({ sprite, age: 0, life: 1 });
  }
  let cursor = 0, spawnClock = 0;
  const jitter = new THREE.Vector3();
  function spawn(position) {
    const p = puffs[cursor]; cursor = (cursor + 1) % puffs.length;
    p.age = 0; p.life = 1.1 + Math.random() * .6;
    jitter.set((Math.random() - .5) * .03, 0, (Math.random() - .5) * .03);
    p.sprite.position.copy(position).add(jitter);
    p.sprite.visible = true;
  }
  return {
    update(dt, sources) {
      spawnClock -= dt;
      if (spawnClock <= 0) { spawnClock = .4; for (const s of sources) if (s.active) spawn(s.position); }
      for (const p of puffs) {
        if (!p.sprite.visible) continue;
        p.age += dt;
        const k = p.age / p.life;
        if (k >= 1) { p.sprite.visible = false; continue; }
        p.sprite.position.y += dt * .17;
        p.sprite.position.x += Math.sin(p.age * 3 + p.sprite.id) * .0016;
        p.sprite.scale.setScalar(.05 + k * .17);
        p.sprite.material.opacity = Math.sin(Math.PI * k) * .32;
      }
    }
  };
}

// A character's approximate held-cup position in world space, given their base
// position/facing. Decorative only, so an exact rig lookup isn't needed.
export function cupWorldPosition(x, z, rotationY, out = new THREE.Vector3()) {
  return out.set(x + Math.sin(rotationY) * .18, 1.15, z + Math.cos(rotationY) * .18);
}
