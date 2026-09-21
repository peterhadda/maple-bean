// Physical choreography for the player and for regulars under a script:
// walking routes, stepping beside a chair and sitting, standing up, and
// event-driven activities (reach, study, play, water...). Scripts are plain
// async functions awaiting `wait()` and actor promises, and can be cancelled.
import { findPath, followRoute, moveOnFloor, clearOfPeople } from './navigation.js';
import { entryPoint, advanceSeatTransition, SIT_SECONDS, STAND_SECONDS } from './cafe-life.js';

// ---------------------------------------------------------------- time
const timers = new Set();
export function wait(seconds) { return new Promise(resolve => timers.add({ t: seconds, resolve })); }
export function tickTimers(dt) { for (const w of [...timers]) { w.t -= dt; if (w.t <= 0) { timers.delete(w); w.resolve(); } } }

// A cancellable script: `ok()` is false once cancelled or superseded.
export class Script {
  constructor(name) { this.name = name; this.cancelled = false; this.cleanups = []; }
  ok() { return !this.cancelled; }
  onCancel(fn) { this.cleanups.push(fn); }
  cancel() { if (this.cancelled) return; this.cancelled = true; for (const fn of this.cleanups.reverse()) { try { fn(); } catch (e) { console.error(e); } } }
}

// ---------------------------------------------------------------- actor
const angleTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export class Actor {
  // `body` holds x, z, angle (a resident life record or the player's own object).
  constructor(body, layout, { speed = 1.75 } = {}) {
    this.body = body; this.layout = layout; this.speed = speed;
    this.route = []; this.arrive = null; this.walking = false;
    this.posture = 'stand'; this.sit = 0; this.seat = null; this.entry = null; this.t = 0; this.done = null; this.from = null; this.to = null;
    this.activity = null; this.reach = null; this.headphones = false; this.lookTarget = null; this.face = null; this.expression = null;
    this.stick = null; this.snapSit = false;
  }
  get x() { return this.body.x; } get z() { return this.body.z; }
  get busy() { return this.posture !== 'stand' && this.posture !== 'seated'; }
  stop() { this.stalledFor = 0; this.route = []; const a = this.arrive; this.arrive = null; a?.(false); }
  // Walk along a found path; resolves true on arrival, false if interrupted.
  goTo(x, z) {
    if (this.posture !== 'stand') return Promise.resolve(false);
    this.stop();
    return new Promise(resolve => {
      if (Math.hypot(this.x - x, this.z - z) < .05) return resolve(true);
      const path = findPath(this.body, { x, z }, this.layout);
      if (!path.length) return resolve(false);
      this.route = path; this.arrive = resolve;
    });
  }
  // Straight choreographed step (ignores collision; only used for the last few
  // centimetres beside a chair or at a counter).
  stepTo(x, z, speed = .8) {
    if (this.posture !== 'stand') return Promise.resolve(false);
    this.stop();
    return new Promise(resolve => { this.route = [{ x, z, direct: true }]; this.arrive = resolve; this.stepSpeed = speed; });
  }
  turnTo(angle) { this.face = angle; return wait(.35); }
  lookAt(point) { this.lookTarget = point; }
  async sitOn(seat, { occupied = new Set(), seats = [], script } = {}) {
    if (this.posture !== 'stand' && this.posture !== 'seated') return false;
    if (this.posture === 'seated' && this.seat?.id === seat.id) return true;
    if (this.posture === 'seated' && !(await this.standUp())) return false;
    this.reservedSeat = seat;
    if (!(await this.goTo(seat.approach[0], seat.approach[1])) || script?.cancelled) { this.reservedSeat = null; return false; }
    const entry = entryPoint(seat, seats, occupied);
    if (!entry.front) { if (!(await this.stepTo(entry.x, entry.z)) || script?.cancelled) { this.reservedSeat = null; return false; } }
    else this.face = seat.angle;
    delete this.seatMotion; this.seat = seat; this.entry = entry; this.posture = 'sitting'; this.t = 0; this.from = { x: this.x, z: this.z }; this.to = { x: seat.x, z: seat.z };
    await new Promise(r => { this.done = r; });
    return this.posture === 'seated';
  }
  standUp() {
    // Finish the current lowering motion before rising; restarting at sit=1 snaps.
    if (this.posture === 'sitting') return new Promise(resolve => {
      const seated = this.done;
      this.done = completed => { seated?.(completed); this.standUp().then(resolve); };
    });
    if (this.posture !== 'seated') return Promise.resolve(this.posture === 'stand');
    this.activity = null; this.reach = null;
    const interruptedSit = this.done; this.done = null;
    delete this.seatMotion; this.posture = 'rising'; interruptedSit?.(); this.t = 0; this.from = { x: this.x, z: this.z };
    const e = this.entry || { x: this.seat.approach[0], z: this.seat.approach[1] };
    this.to = { x: e.x, z: e.z };
    return new Promise(r => { this.done = async (completed = true) => {
      if (!completed) { r(false); return; }
      const seat = this.seat; this.seat = null; this.reservedSeat = null; this.entry = null;
      if (seat && !e.front) await this.stepTo(seat.approach[0], seat.approach[1]);
      r(true);
    }; });
  }
  // Reach one hand to a world point for `seconds`, resolving at the moment of
  // contact (so the caller can place a piece exactly when the hand arrives).
  async reachTo(localPoint, { side = -1, shape = 'pinch', seconds = .75, contact = .45 } = {}) {
    this.activity = 'reach'; this.reach = { ...localPoint, side, shape };
    await wait(seconds * contact);
    const back = async () => { await wait(seconds * (1 - contact)); if (this.activity === 'reach' && this.reach?.x === localPoint.x) { this.activity = null; this.reach = null; } };
    back();
  }
  update(dt, layout = this.layout) {
    this.walking = false;
    if (this.posture === 'sitting' || this.posture === 'rising') {
      const total = this.posture === 'sitting' ? SIT_SECONDS : STAND_SECONDS;
      const { k, done, cancelled } = advanceSeatTransition(this, this.body, dt, this.from, this.to, total, layout);
      this.body.angle += wrap(this.seat.angle - this.body.angle) * Math.min(1, dt * 10);
      this.sit = this.posture === 'sitting' ? k : 1 - k;
      if (done) {
        if (cancelled) {
          if (this.posture === 'sitting') { this.posture = 'stand'; this.sit = 0; this.seat = null; this.reservedSeat = null; this.entry = null; }
          else { this.posture = 'seated'; this.sit = 1; }
        } else if (this.posture === 'sitting') { this.posture = 'seated'; this.sit = 1; this.body.angle = this.seat.angle; }
        else { this.posture = 'stand'; this.sit = 0; }
        const d = this.done; this.done = null; d?.(!cancelled);
      }
      return;
    }
    if (this.route.length) {
      const before = { x: this.x, z: this.z }, p = this.route[0];
      if (p.direct) {
        const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz), step = Math.min(d, (this.stepSpeed || .8) * dt);
        if (d < .02) { this.route.shift(); } else if (clearOfPeople(this.body, this.x + dx / d * step, this.z + dz / d * step, layout)) { this.body.x += dx / d * step; this.body.z += dz / d * step; }
      } else followRoute(this.body, this.route, dt, this.speed, layout);
      const moved = Math.hypot(this.x - before.x, this.z - before.z);
      this.walking = moved > .0005;
      this.stalledFor = moved > .00001 || this.route[0] !== p ? 0 : (this.stalledFor || 0) + dt;
      if (this.stalledFor > 8) { this.stop(); return; }
      if (this.walking) this.body.angle += wrap(angleTo(before, this.body) - this.body.angle) * Math.min(1, dt * 12);
      if (!this.route.length) { const a = this.arrive; this.arrive = null; a?.(true); }
      return;
    }
    if (this.face !== null) { this.body.angle += wrap(this.face - this.body.angle) * Math.min(1, dt * 9); if (Math.abs(wrap(this.face - this.body.angle)) < .01) this.face = null; }
  }
  // Free movement from keys (player only). The turn is eased by elapsed time so
  // it reads the same on a 144 Hz screen as on a 60 Hz one.
  push(dx, dz, dt = 1 / 60) { if (this.posture !== 'stand') return; this.stop(); const b = { x: this.x, z: this.z }; moveOnFloor(this.body, dx, dz, this.layout); const m = Math.hypot(this.x - b.x, this.z - b.z); if (m > .0001) { this.walking = true; this.body.angle += wrap(Math.atan2(dx, dz) - this.body.angle) * Math.min(1, dt * 21); } }
  visual() {
    return { walking: this.walking, sitAmount: this.sit, seatHeight: this.seat?.seatHeight ?? .54, activity: this.activity, reach: this.reach, headphones: this.headphones || undefined, deskHeight: this.seat?.deskHeight, lookTarget: this.lookTarget, stick: this.stick, panelHeight: this.panelHeight };
  }
}
