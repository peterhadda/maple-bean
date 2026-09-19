// Fixed-timestep simulation with variable-rate rendering. Game rules step at
// `hz` regardless of frame rate, so logic stays deterministic and testable;
// render(alpha) may interpolate between steps.
export function createLoop({ step, render, hz = 60, maxSteps = 5 }) {
  const dt = 1 / hz;
  let acc = 0, last = 0, running = false, handle = 0, paused = false;
  function frame(ms) {
    if (!running) return;
    const now = ms / 1000, elapsed = last ? Math.min(.25, now - last) : 0; last = now;
    if (!paused) {
      acc += elapsed; let n = 0;
      while (acc >= dt && n < maxSteps) { step(dt); acc -= dt; n++; }
      if (n === maxSteps) acc = 0;
    }
    render?.(acc / dt, elapsed);
    handle = requestAnimationFrame(frame);
  }
  return {
    dt,
    start() { if (running) return; running = true; last = 0; handle = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(handle); },
    get paused() { return paused; },
    setPaused(v) { paused = v; if (!v) last = 0; },
  };
}
