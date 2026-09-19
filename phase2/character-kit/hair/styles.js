// Hair styles beyond the three canonical ones. Each style receives the
// generator's own hair toolkit (head surface, hairline, shell points, tapered
// ribbons, strand tangents) so new residents are built from exactly the same
// primitives as Maya's bun and Claire's waves: a scalp shell plus clumped,
// flattened ribbons with Kajiya-Kay strand tangents, never caps or fine strands.

// A scalp shell from the hairline to the crown. `volume(P)` lifts it off the
// skull, `flow(v, T)` writes the strand direction used by the hair highlight,
// `tint(v)` varies the vertex colour.
function scalpShell(k, { volume, flow, tint, rows = 70, cols = 110, tuck = -0.010 }) {
  const { V3, gridSurface, fillAttr, headBase, hairness, dirOf, hairlineElevation, lerp, prepHair } = k;
  const hairline = new Map(), d = new V3(), P = new V3();
  const g = gridSurface(rows, cols, (t, u, out) => {
    const psi = Math.PI * (2 * u - 1);
    let e0 = hairline.get(u); if (e0 === undefined) hairline.set(u, e0 = hairlineElevation(psi));
    dirOf(psi, lerp(e0, Math.PI / 2, t), d); headBase(d, P);
    const h = hairness(P), n = P.clone().normalize();
    return out.copy(P).addScaledVector(n, lerp(tuck, volume(P, n), Math.pow(h, 1.6)));
  });
  const p = g.attributes.position, nrm = g.attributes.normal, v = new V3(), n = new V3(), T = new V3();
  fillAttr(g, 'aStrand', 3, i => {
    v.fromBufferAttribute(p, i); n.fromBufferAttribute(nrm, i); flow(v, T);
    T.addScaledVector(n, -T.dot(n)); if (T.lengthSq() < 1e-10) T.set(0, 0, -1);
    T.normalize(); return [T.x, T.y, T.z];
  });
  fillAttr(g, 'color', 3, i => { const s = tint(v.fromBufferAttribute(p, i)); return [s, s * .97, s * .94]; });
  return prepHair(g);
}

// Clump ribbon between two head directions, following the skull like the
// canonical clumps do (interpolated directions, never through the pole).
function ribbon(k, d0, d1, { lift, radius, flatten = 0.4, steps = 10, segments = 26, tint }) {
  const { V3, shellPoint, taperedTube, prepHair } = k;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, dd = d0.clone().lerp(d1, u).normalize();
    pts.push(shellPoint(Math.atan2(dd.x, dd.z), Math.asin(Math.max(-1, Math.min(1, dd.y))), lift(u), new V3()));
  }
  return prepHair(taperedTube(pts, { segments, radial: 5, flatten, radius }), tint);
}

// Leo: short textured sides, a lifted front quiff swept to his left.
function texturedQuiff(k) {
  const { V3, rand, ss, lerp, dirOf, hairlineElevation } = k;
  const parts = [];
  parts.push(scalpShell(k, {
    volume: P => 0.0025 + 0.0085 * ss(0.0, 0.12, P.y) + 0.004 * ss(0.02, 0.11, P.z) * ss(0.02, 0.12, P.y),
    flow: (v, T) => T.set(0.3 * ss(0.02, 0.12, v.y), -0.45 * (1 - ss(0.0, 0.09, v.y)), -1),
    tint: v => 0.8 + 0.1 * Math.sin(v.x * 170 + v.z * 90) * Math.sin(v.y * 150 + v.x * 40),
  }));
  const SWEEP = 0.26;
  // Quiff and top: rows of ribbons from the front hairline back over the crown.
  for (let row = 0; row < 4; row++) for (let c = 0; c < 13; c++) {
    const psi0 = lerp(-0.9, 0.9, c / 12) + (rand() - 0.5) * 0.07;
    const el0 = hairlineElevation(psi0) + 0.03 + row * 0.17;
    const front = 1 - row / 4, edge = Math.abs(psi0) / 0.9;
    const d0 = dirOf(psi0, el0, new V3());
    const d1 = new V3(d0.x * 0.85 + SWEEP * (0.5 + 0.5 * front), lerp(0.62, 0.42, row / 3), -0.72 - 0.1 * front).normalize();
    const peak = (0.028 * front + 0.006) * (1 - 0.45 * edge) + 0.004 * rand();
    const R = (0.0115 - 0.0022 * row / 3) * (0.9 + 0.2 * rand());
    parts.push(ribbon(k, d0, d1, {
      lift: u => 0.0015 + peak * Math.sin(Math.PI * Math.min(1, u * 1.35)) * (1 - 0.55 * u) + 0.004 * u,
      radius: t => R * Math.min(1, t * 5 + 0.35) * Math.pow(1 - t, 0.65),
      flatten: 0.42, tint: 0.84 + rand() * 0.3,
    }));
  }
  // A few loose pieces breaking the quiff silhouette.
  for (let c = 0; c < 5; c++) {
    const psi0 = lerp(-0.45, 0.55, c / 4), d0 = dirOf(psi0, hairlineElevation(psi0) + 0.08, new V3());
    const d1 = new V3(d0.x + 0.35, 0.95, -0.25).normalize(), peak = 0.03 + 0.008 * rand();
    parts.push(ribbon(k, d0, d1, {
      lift: u => 0.003 + peak * Math.sin(Math.PI * Math.min(1, u * 1.1)), steps: 8, segments: 20,
      radius: t => 0.0055 * Math.min(1, t * 6 + 0.35) * Math.pow(1 - t, 0.6), flatten: 0.5, tint: 0.95 + rand() * 0.2,
    }));
  }
  // Short textured sides and back: flat clumps combed back and down.
  for (let c = 0; c < 34; c++) {
    const sidePsi = (c % 2 ? 1 : -1) * lerp(1.05, 3.05, ((c >> 1) % 17) / 16) + (rand() - 0.5) * 0.08;
    const e0 = hairlineElevation(sidePsi), el = e0 + 0.06 + rand() * 0.42;
    if (el > 1.25) continue;
    const d0 = dirOf(sidePsi, el, new V3()), d1 = d0.clone().add(new V3(0, -0.13, -0.16)).normalize();
    parts.push(ribbon(k, d0, d1, {
      lift: u => 0.001 + 0.002 * Math.sin(Math.PI * u), steps: 6, segments: 12,
      radius: t => 0.0065 * Math.min(1, t * 5 + 0.4) * Math.pow(1 - t, 0.8), flatten: 0.3, tint: 0.8 + rand() * 0.25,
    }));
  }
  return parts;
}

// Noah: dense short coils on a close, rounded shell with a clean hairline.
function shortCurls(k) {
  const { V3, rand, ss, lerp, headBase, dirOf, hairness, taperedTube, prepHair, hairlineElevation } = k;
  const bump = v => Math.sin(v.x * 260 + 1.3) * Math.sin(v.y * 240 + 0.7) * Math.sin(v.z * 250 + 2.1);
  const parts = [scalpShell(k, {
    volume: P => 0.004 + 0.011 * ss(-0.05, 0.12, P.y) + 0.0022 * bump(P),
    flow: (v, T) => T.set(Math.sin(v.y * 310 + v.z * 90), Math.cos(v.x * 290), Math.sin(v.z * 330 + v.x * 70)),
    tint: v => 0.7 + 0.18 * (0.5 + 0.5 * bump(v)),
    rows: 80, cols: 120, tuck: -0.008,
  })];
  const P = new V3(), d = new V3(), up = new V3(0.3, 0.9, 0.2).normalize();
  for (let tries = 0, placed = 0; tries < 1600 && placed < 280; tries++) {
    const psi = (rand() * 2 - 1) * Math.PI, e0 = hairlineElevation(psi);
    // Uniform-ish over the scalp area (sin-weighted toward the hairline, where there is more surface).
    const el = Math.asin(lerp(Math.sin(e0 + 0.05), 1, rand()));
    dirOf(psi, el, d); headBase(d, P);
    if (hairness(P) < 0.75) continue;
    const n = P.clone().normalize(), top = ss(-0.05, 0.1, P.y);
    const center = P.clone().addScaledVector(n, 0.011 + 0.004 + 0.009 * top);
    const a = new V3().crossVectors(n, up).normalize(), b = new V3().crossVectors(n, a);
    const turns = 1.4 + rand(), r = (0.0042 + 0.0022 * rand()) * (0.75 + 0.35 * top), h = 0.005 + 0.007 * top, phase = rand() * Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, ang = phase + u * turns * Math.PI * 2;
      pts.push(center.clone().addScaledVector(a, Math.cos(ang) * r).addScaledVector(b, Math.sin(ang) * r).addScaledVector(n, (u - 0.5) * h));
    }
    const tube = 0.0023 + 0.0009 * top;
    parts.push(prepHair(taperedTube(pts, { segments: 18, radial: 4, radius: t => tube * Math.min(1, t * 6 + 0.5) * Math.min(1, (1 - t) * 6 + 0.5) }), 0.78 + rand() * 0.34));
    placed++;
  }
  return parts;
}

export const HAIR_STYLES = { 'textured-quiff': texturedQuiff, 'short-curls': shortCurls };
