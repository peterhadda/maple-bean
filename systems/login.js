// The sign-in journey: splash → account choice → create account / log in /
// forgot password. Screens and copy follow the Figma "Prototype · Full
// Journey" page (01–06b); this file only routes between them and talks to
// /account.
//
// Everything after the door — first-time welcome, the character creator and
// the guided tutorial — happens inside the café, where the three.js character
// runtime already lives and the preview can be the real avatar.
import { accountApi, writeSession, readSession, writeGuestPass, resumeAccount, logOut } from './account.js';

const $ = id => document.getElementById(id);
const screens = [...document.querySelectorAll('.screen')];
const status = $('status');
const artQuote = $('art-quote');
const DEFAULT_QUOTE = artQuote.textContent;

// ---------------------------------------------------------------- routing
let current = 'splash';
function show(name, { focus = true } = {}) {
  const screen = $('screen-' + name);
  if (!screen) return;
  current = name;
  for (const s of screens) s.hidden = s !== screen;
  document.body.dataset.layout = screen.dataset.layout || 'center';
  artQuote.textContent = screen.dataset.quote || DEFAULT_QUOTE;
  if (location.hash.slice(1) !== name && name !== 'splash') history.replaceState(null, '', '#' + name);
  // Re-run the entrance animation even when the same element comes back.
  screen.style.animation = 'none'; void screen.offsetWidth; screen.style.animation = '';
  if (focus) (screen.querySelector('input:not([type=checkbox]), button, a') || screen).focus({ preventScroll: true });
  status.textContent = (screen.querySelector('h1')?.textContent || name) + '.';
}
document.addEventListener('click', event => {
  const go = event.target.closest('[data-go]');
  if (go) { event.preventDefault(); show(go.dataset.go); }
});
addEventListener('hashchange', () => {
  const name = location.hash.slice(1);
  if (name && name !== current && $('screen-' + name)) show(name);
});

// ---------------------------------------------------------------- fields
function setError(fieldId, message) {
  const field = $(fieldId + '-field'), help = $(fieldId + '-help');
  if (!field) return;
  field.dataset.invalid = message ? 'true' : 'false';
  if (help) { help.textContent = message || help.dataset.rest || ''; }
  const input = $(fieldId);
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (message) { status.textContent = message; input?.focus(); }
}
// Remember each helper's resting copy so clearing an error restores the hint.
for (const help of document.querySelectorAll('.mb-field__help')) help.dataset.rest = help.textContent;
function clearErrors(form) {
  for (const field of form.querySelectorAll('.mb-field')) {
    field.dataset.invalid = 'false';
    const help = field.querySelector('.mb-field__help');
    if (help) help.textContent = help.dataset.rest || '';
  }
  form.querySelector('.form__error')?.remove();
}
function formError(form, message) {
  form.querySelector('.form__error')?.remove();
  const p = document.createElement('p');
  p.className = 'form__error'; p.setAttribute('role', 'alert'); p.textContent = message;
  form.querySelector('.form__actions').prepend(p);
  status.textContent = message;
}

for (const toggle of document.querySelectorAll('[data-reveal]')) {
  toggle.onclick = () => {
    const input = $(toggle.dataset.reveal), shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    toggle.textContent = shown ? 'Show' : 'Hide';
    input.focus();
  };
}

// "Brewing…" with three steam dots, per the Button component.
function busy(button, on) {
  if (!on) { button.dataset.loading = 'false'; button.disabled = false; clearInterval(button.dotTimer); return; }
  button.dataset.loading = 'true'; button.disabled = true;
  let n = 0;
  button.dataset.dots = '';
  button.dotTimer = setInterval(() => { n = (n + 1) % 4; button.dataset.dots = '.'.repeat(n); }, 320);
}

// ---------------------------------------------------------------- entering the café
function enter({ fresh = false } = {}) {
  status.textContent = 'Opening Maple Bean…';
  location.href = fresh ? '/cafe?welcome=1' : '/cafe';
}

// ---------------------------------------------------------------- create account
// Usernames are one shared pool, so say whether this one is free while it is
// still being typed rather than at the end of the form.
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9 _-]{0,22}[a-z0-9])$/i;
function handleProblem(value) {
  if (!value) return 'Pick the name the café will call you.';
  if (value.length < 2) return 'Use at least 2 characters.';
  if (value.length > 24) return 'Keep it to 24 characters or fewer.';
  if (!HANDLE_RE.test(value)) return 'Letters, numbers, spaces, - and _ only.';
  return null;
}
let handleCheck = 0;
$('signup-handle').oninput = () => {
  const state = $('signup-handle-state'), value = $('signup-handle').value.trim();
  setError('signup-handle', '');
  state.textContent = '';
  const problem = handleProblem(value);
  if (problem) return;
  const run = ++handleCheck;
  state.textContent = 'checking…';
  clearTimeout($('signup-handle').timer);
  $('signup-handle').timer = setTimeout(async () => {
    try {
      const result = await accountApi('check-name', { handle: value });
      if (run !== handleCheck) return;                  // a newer keystroke won
      state.textContent = result.ok ? 'free ✓' : 'taken';
      state.style.color = result.ok ? 'var(--mb-state-success)' : 'var(--mb-state-error)';
      if (!result.ok) setError('signup-handle', result.error);
    } catch { if (run === handleCheck) state.textContent = ''; }
  }, 350);
};

$('signup-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.target, button = $('signup-submit');
  clearErrors(form);
  const handle = $('signup-handle').value.trim();
  const email = $('signup-email').value.trim();
  const password = $('signup-password').value;
  const confirm = $('signup-confirm').value;
  const handleIssue = handleProblem(handle);
  if (handleIssue) return setError('signup-handle', handleIssue);
  if (!email) return setError('signup-email', 'Add the e-mail you want to sign in with.');
  if (!email.includes('@')) return setError('signup-email', 'That e-mail is missing an @.');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return setError('signup-email', 'That e-mail is missing an ending like .com.');
  if (password.length < 8) return setError('signup-password', 'Use at least 8 characters so your seat stays yours.');
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return setError('signup-password', 'Mix in at least one letter and one number.');
  if (confirm !== password) return setError('signup-confirm', 'These two do not match yet.');
  if (!$('signup-terms').checked) {
    $('signup-terms-help').textContent = 'Tick this and we’ll open the door.';
    $('signup-terms-help').style.color = 'var(--mb-state-error)';
    status.textContent = 'Please agree to be kind to the other guests.';
    return $('signup-terms').focus();
  }
  busy(button, true);
  try {
    const { account, token } = await accountApi('sign-up', { email, password, handle });
    writeSession({ id: account.id, token, handle: account.handle }, true);
    writeGuestPass(false);
    enter({ fresh: true });
  } catch (error) {
    busy(button, false);
    if (error.field === 'handle') setError('signup-handle', error.message);
    else if (error.field === 'email') setError('signup-email', error.message);
    else if (error.field === 'password') setError('signup-password', error.message);
    else formError(form, error.message);
  }
};

// ---------------------------------------------------------------- log in
$('login-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.target, button = $('login-submit');
  clearErrors(form);
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  if (!email) return setError('login-email', 'Add the e-mail on your account.');
  if (!password) return setError('login-password', 'Add your password.');
  busy(button, true);
  try {
    const { account, token } = await accountApi('log-in', { email, password });
    writeSession({ id: account.id, token, handle: account.handle }, $('login-remember').checked);
    writeGuestPass(false);
    enter({ fresh: !account.onboarded });
  } catch (error) {
    busy(button, false);
    if (error.field === 'email') setError('login-email', error.message);
    else if (error.field === 'password') setError('login-password', error.message);
    else formError(form, error.message);
  }
};

// ---------------------------------------------------------------- forgot / reset
$('forgot-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.target, button = $('forgot-submit');
  clearErrors(form);
  const email = $('forgot-email').value.trim();
  if (!email.includes('@')) return setError('forgot-email', 'That e-mail is missing an @.');
  busy(button, true);
  try {
    const result = await accountApi('forgot', { email });
    $('sent-email').textContent = email;
    // With no mail provider the server hands the link back for a local
    // playtest; in any real deployment `link` is simply absent.
    const dev = $('sent-dev');
    dev.hidden = !result.link;
    if (result.link) $('sent-link').href = result.link;
    show('sent');
  } catch (error) {
    formError(form, error.message);
  } finally { busy(button, false); }
};

$('reset-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.target, button = $('reset-submit');
  clearErrors(form);
  const password = $('reset-password').value, confirm = $('reset-confirm').value;
  if (password.length < 8) return setError('reset-password', 'Use at least 8 characters so your seat stays yours.');
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return setError('reset-password', 'Mix in at least one letter and one number.');
  if (confirm !== password) return setError('reset-confirm', 'These two do not match yet.');
  const params = new URLSearchParams(location.search);
  busy(button, true);
  try {
    const { account, token } = await accountApi('reset', { id: params.get('account'), reset: params.get('reset'), password });
    writeSession({ id: account.id, token, handle: account.handle }, true);
    enter({ fresh: !account.onboarded });
  } catch (error) {
    busy(button, false);
    formError(form, error.message);
  }
};

// ---------------------------------------------------------------- guest
$('guest-enter').onclick = () => {
  writeGuestPass(true);
  enter({ fresh: true });
};

// ---------------------------------------------------------------- first paint
(async () => {
  const params = new URLSearchParams(location.search);
  if (params.get('reset') && params.get('account')) return show('reset');
  if (params.get('screen') && $('screen-' + params.get('screen'))) return show(params.get('screen'));
  if (location.hash.slice(1) && $('screen-' + location.hash.slice(1))) return show(location.hash.slice(1));

  // The front door always shows the front door. Somebody who is already
  // signed in is not asked for a password again — they get a "welcome back"
  // card and one click — but they are never silently teleported past it.
  if (readSession()) {
    try {
      const account = await resumeAccount();
      if (account) {
        $('resume-name').textContent = account.handle || 'friend';
        $('resume-note').textContent = account.onboarded
          ? 'Your character and your usual table are where you left them.'
          : 'You have not made your character yet — that is the next step.';
        $('resume-card').hidden = false;
        $('signup-card').hidden = true;
        $('resume-enter').onclick = () => enter({ fresh: !account.onboarded });
        $('resume-signout').onclick = async () => { await logOut(); location.reload(); };
        show('choice');
        return $('resume-enter').focus({ preventScroll: true });
      }
    } catch (error) {
      // The café did not answer. The sign-in is still saved, so say that
      // plainly and offer to try again — do not ask for a password.
      show('choice');
      return unreachable(error.message);
    }
  }
  show('choice');
})().catch(error => {
  console.warn('Maple Bean sign-in:', error);
  show('choice');
});

// A banner for "you are still signed in, we just cannot reach the server".
function unreachable(message) {
  const screen = $('screen-choice');
  screen.querySelector('.choice__offline')?.remove();
  const banner = document.createElement('div');
  banner.className = 'choice__offline';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = `<p class="mb-label-l">You’re still signed in.</p><p class="mb-body-s"></p>`;
  banner.querySelector('.mb-body-s').textContent = message;
  const retry = document.createElement('button');
  retry.className = 'mb-btn mb-btn--primary';
  retry.textContent = 'Try again';
  retry.onclick = () => location.reload();
  banner.append(retry);
  screen.querySelector('.choice__heading').after(banner);
  status.textContent = 'Still signed in, but the café could not be reached.';
}
