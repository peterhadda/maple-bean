# Maple Bean · Phase 2 prototype layer

Isolated prototypes for the brand, cast expansion (Leo, Noah), living homepage, study mode, character
creator and mini-games. Production (`../index.html`, `../server.mjs`, :4321) is **not modified**.

```powershell
node phase2/server.mjs          # http://localhost:4322/phase2
node --test phase2/tests/*.test.mjs
node --test tests/*.test.mjs    # existing suite; needs `node server.mjs` running on :4321
```

## Rules

1. Files outside `phase2/` and `design-assets/` stay byte-identical to tag `pre-phase-2`
   (`phase2/tests/isolation.test.mjs` fails otherwise).
2. Production modules are imported read-only, never patched.
3. `character-kit/` is a fork of `maya-character.js` + `animation.js`. It must rebuild Maya, Mara, Jules
   and Claire identically (`/phase2/parity`, `phase2/qa/parity.mjs`) before it is trusted.
4. UX/UI is designed in Figma. Pages here only carry plain scaffold controls.
5. Three.js characters are canonical. `design-assets/` holds exported renders for Figma/Canva and is
   never read back into code.

Plan: [docs/PHASE2-PLAN.md](docs/PHASE2-PLAN.md) · DNA: [docs/CHARACTER-DNA.md](docs/CHARACTER-DNA.md)
