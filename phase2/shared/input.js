// Shared prototype input: keyboard (WASD/arrows + action keys), pointer and a
// touch joystick, reduced to one polled state per frame. Games read `axis()`
// and `pressed()/held()`; they never attach their own key listeners.
const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

export function createInput(target = window, { preventKeys = true } = {}) {
  const down = new Set(), justPressed = new Set(), justReleased = new Set();
  const pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false, buttons: 0, id: null };
  let touchAxis = null;
  const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const onKeyDown = e => {
    if (typing()) return;
    if (preventKeys && (MOVE[e.code] || e.code === 'Space')) e.preventDefault();
    if (!down.has(e.code)) justPressed.add(e.code);
    down.add(e.code);
  };
  const onKeyUp = e => { down.delete(e.code); justReleased.add(e.code); };
  const clear = () => { for (const c of down) justReleased.add(c); down.clear(); };
  const onPointer = e => {
    const r = (e.currentTarget === window ? document.documentElement : e.currentTarget).getBoundingClientRect?.() || { left: 0, top: 0 };
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.buttons = e.buttons;
    if (e.type === 'pointerdown') { pointer.down = true; pointer.justDown = true; pointer.id = e.pointerId; }
    if (e.type === 'pointerup' || e.type === 'pointercancel') { pointer.down = false; pointer.justUp = true; pointer.id = null; }
  };
  window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) target.addEventListener(type, onPointer);

  return {
    pointer,
    held: code => down.has(code),
    pressed: code => justPressed.has(code),
    released: code => justReleased.has(code),
    // Normalised movement vector in screen terms: x right, y down (forward = -y).
    axis() {
      if (touchAxis) return touchAxis;
      let x = 0, y = 0;
      for (const code of down) if (MOVE[code]) { x += MOVE[code][0]; y += MOVE[code][1]; }
      const len = Math.hypot(x, y);
      return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    setTouchAxis(v) { touchAxis = v && Math.hypot(v.x, v.y) > .05 ? v : null; },
    // Call once at the end of every frame.
    endFrame() { justPressed.clear(); justReleased.clear(); pointer.justDown = pointer.justUp = false; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear);
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) target.removeEventListener(type, onPointer);
    },
  };
}

// A minimal on-screen joystick for touch devices (scaffold look, plain DOM).
export function attachTouchJoystick(input, parent = document.body) {
  if (!matchMedia('(pointer: coarse)').matches) return null;
  const pad = document.createElement('div');
  pad.style.cssText = 'position:fixed;left:24px;bottom:24px;width:120px;height:120px;border:1px dashed #888;border-radius:50%;touch-action:none;z-index:20';
  parent.append(pad);
  const update = e => {
    const r = pad.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const len = Math.min(1, Math.hypot(dx, dy)) || 0, a = Math.atan2(dy, dx);
    input.setTouchAxis({ x: Math.cos(a) * len, y: Math.sin(a) * len });
  };
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); update(e); });
  pad.addEventListener('pointermove', e => { if (e.buttons) update(e); });
  pad.addEventListener('pointerup', () => input.setTouchAxis(null));
  pad.addEventListener('pointercancel', () => input.setTouchAxis(null));
  return pad;
}
