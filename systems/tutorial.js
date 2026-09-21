// The welcome tour: the regulars show you around their own café.
//
// Each beat pairs a line of dialogue with a camera move to the place being
// talked about, so "the study room is through there" actually shows you the
// study room. The speaker's portrait is the real character: a cutout rendered
// from assets/characters/runtime.js by qa/portraits.mjs, so it is the cast as
// the café renders them today, not an illustration of them. Re-run that
// script whenever the characters change.
//
// Who says what follows the cast: Mara runs the counter, Noah studies here
// most days, Claire is the one who will talk you into a game, Jules holds
// court in the lounge, and Maya opens and closes the tour.
import { cast } from '../characters.js';

const PORTRAIT = id => `/assets/ui/portraits/${id}.png`;

// Camera views reuse the fixed review framings in qa/expansion/views.mjs, so
// the tour shows each room from the angle the team already reviews it at.
export const BEATS = [
  {
    id: 'welcome', who: 'maya',
    view: { from: [3.2, 2.2, 11.5], at: [0, 1.5, 5.2] },
    title: 'Maple Bean',
    text: 'You made it! This is Maple Bean — three rooms, good coffee, and nobody in a hurry. Let me show you around before you settle in.',
  },
  {
    id: 'coffee', who: 'mara',
    view: { from: [1.2, 1.75, 1.2], at: [-3.6, 1.05, -5.2] },
    title: 'The coffee bar',
    text: 'I am behind this counter most days. Walk up and press E, and the board is right there — maple latte if you want it sweet, forest tea if you want it quiet, hot chocolate if it has been a day. Everything is priced in Maple Coins.',
  },
  {
    id: 'study', who: 'noah',
    view: { from: [16.6, 2.0, 1.8], at: [12.5, .8, -4.5] },
    title: 'The Study Room',
    text: 'This is where I am, basically always. Take a desk, start a focus session, pick your minutes. Finish what you planned and the café pays you for it — stop early and it does not. That is the whole trick.',
  },
  {
    id: 'games', who: 'claire',
    view: { from: [6.9, 2.1, -7.6], at: [1.5, .7, -12.5] },
    title: 'Games & Garden',
    text: 'Through here is my favourite corner. Chess, darts, Snake, and a garden that needs watering more than anyone admits. Sit down at a table and someone usually joins you.',
  },
  {
    id: 'lounge', who: 'jules',
    view: { from: [1.8, 1.85, 1.4], at: [7.5, .8, -4.5] },
    title: 'The living room',
    text: 'The sofas by the fire are for staying put. Anyone within a few metres hears you when you talk, so this is where you meet the other people who are actually here right now — not characters. Say hello.',
  },
  {
    id: 'wardrobe', who: 'maya',
    view: null,
    title: 'Your look is yours',
    text: 'Everything in the wardrobe we already had is yours from today — every hairstyle, every colour, every layer, no coins needed. New pieces show up over time and those you buy. Change your look any time from the menu.',
  },
];

const clamp = (a, b, v) => Math.min(b, Math.max(a, v));

export function createTutorial({ look, onFinish, onSkip, reduced = false } = {}) {
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = '/systems/tutorial.css';
  document.head.append(style);

  const root = document.createElement('div');
  root.className = 'tour';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'false');
  root.setAttribute('aria-labelledby', 'tour-name');
  root.innerHTML = `
    <div class="tour__card">
      <div class="tour__stage"></div>
      <div class="tour__body">
        <p class="mb-eyebrow tour__place"></p>
        <p class="tour__name mb-heading-m" id="tour-name"></p>
        <p class="tour__text mb-body-l" aria-live="polite"></p>
        <div class="tour__foot">
          <div class="tour__dots" role="tablist" aria-label="Tour steps"></div>
          <div class="tour__actions">
            <button class="mb-btn mb-btn--ghost" data-skip>Skip the tour</button>
            <button class="mb-btn mb-btn--secondary" data-back>← Back</button>
            <button class="mb-btn mb-btn--primary mb-btn--wide" data-next>Next →</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.append(root);

  const q = s => root.querySelector(s);
  const stage = q('.tour__stage'), placeEl = q('.tour__place'), nameEl = q('.tour__name');
  const textEl = q('.tour__text'), dotsEl = q('.tour__dots');
  const nextBtn = q('[data-next]'), backBtn = q('[data-back]'), skipBtn = q('[data-skip]');

  // Portraits are plain images, so every one of them is decoded once up front
  // and then swapping speakers is instant.
  const portraits = new Map();
  function portraitFor(id) {
    if (!portraits.has(id)) {
      const img = new Image();
      img.src = PORTRAIT(id);
      img.alt = cast[id]?.name || id;
      img.className = 'tour__portrait';
      img.decoding = 'async';
      portraits.set(id, img);
    }
    return portraits.get(id);
  }
  for (const beat of BEATS) portraitFor(beat.who);

  let index = 0, typing = null, showing = null, done = false;

  function stopTyping({ complete = false } = {}) {
    if (!typing) return;
    clearInterval(typing.timer);
    if (complete) textEl.textContent = typing.full;
    stage.dataset.talking = 'false';
    typing = null;
  }

  function type(beat) {
    stopTyping();
    if (reduced) { textEl.textContent = beat.text; return; }
    textEl.textContent = '';
    stage.dataset.talking = 'true';
    let i = 0;
    const timer = setInterval(() => {
      // A few characters per tick keeps a long line from outlasting its welcome.
      i = Math.min(beat.text.length, i + 2);
      textEl.textContent = beat.text.slice(0, i);
      if (i >= beat.text.length) { clearInterval(timer); stage.dataset.talking = 'false'; typing = null; }
    }, 16);
    typing = { timer, full: beat.text, who: beat.who };
  }

  function paint() {
    const beat = BEATS[index];
    const portrait = portraitFor(beat.who);
    if (showing !== portrait) { stage.replaceChildren(portrait); showing = portrait; }
    stage.dataset.who = beat.who;
    placeEl.textContent = beat.title;
    nameEl.textContent = cast[beat.who]?.name || beat.who;
    type(beat);

    dotsEl.replaceChildren(...BEATS.map((b, i) => {
      const dot = document.createElement('button');
      dot.type = 'button'; dot.className = 'tour__dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', String(i === index));
      dot.setAttribute('aria-label', `${i + 1}. ${b.title}`);
      dot.title = b.title;
      dot.onclick = () => go(i);
      return dot;
    }));
    backBtn.disabled = index === 0;
    nextBtn.textContent = index === BEATS.length - 1 ? 'Start playing →' : 'Next →';
    if (beat.view) look?.(beat.view);
  }

  function go(next) {
    index = clamp(0, BEATS.length - 1, next);
    paint();
  }

  nextBtn.onclick = () => {
    // A first click finishes the line, a second moves on — nobody has to wait
    // for the typing to catch up with them.
    if (typing) return stopTyping({ complete: true });
    if (index === BEATS.length - 1) return finish();
    go(index + 1);
  };
  backBtn.onclick = () => { stopTyping(); go(index - 1); };
  skipBtn.onclick = () => finish({ skipped: true });
  textEl.onclick = () => stopTyping({ complete: true });

  function onKey(event) {
    if (root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); finish({ skipped: true }); }
    else if (['Enter', ' ', 'ArrowRight'].includes(event.key)) { event.preventDefault(); nextBtn.click(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); if (!backBtn.disabled) backBtn.click(); }
  }

  function finish({ skipped = false } = {}) {
    if (done) return;
    done = true;
    close();
    (skipped ? onSkip || onFinish : onFinish)?.({ skipped });
  }

  function close() {
    stopTyping();
    root.hidden = true;
    removeEventListener('keydown', onKey, true);
    stage.replaceChildren(); showing = null;      // the images stay cached for a replay
  }

  return {
    get isOpen() { return !root.hidden; },
    get step() { return BEATS[index]?.id; },
    start() {
      if (!root.hidden) return;
      done = false; index = 0; root.hidden = false;
      addEventListener('keydown', onKey, true);
      paint();
      nextBtn.focus({ preventScroll: true });
    },
    close,
  };
}
