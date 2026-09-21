// Client side of the Maple Bean account service. Shared by the sign-in site
// (login.html) and the café itself (app.js) so both read the same session.
//
// "Remember me" decides the shelf, not the format: localStorage survives the
// browser closing, sessionStorage lasts as long as the tab. Everything else
// about a session is identical.
export const SESSION_KEY = 'maple-bean-account';
export const GUEST_KEY = 'maple-bean-guest-pass';
export const LOGIN_URL = '/';
export const CAFE_URL = '/cafe';

const stores = () => {
  const out = [];
  try { out.push(window.localStorage); } catch { /* blocked */ }
  try { out.push(window.sessionStorage); } catch { /* blocked */ }
  return out;
};

export function readSession() {
  for (const store of stores()) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      const value = JSON.parse(raw);
      if (value && typeof value.id === 'string' && typeof value.token === 'string') return value;
    } catch { /* corrupt entry: fall through to the next shelf */ }
  }
  return null;
}
export function writeSession(session, remember = true) {
  clearSession();
  try {
    const store = remember ? window.localStorage : window.sessionStorage;
    store.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch { return false; }
}
export function clearSession() {
  for (const store of stores()) { try { store.removeItem(SESSION_KEY); } catch { /* blocked */ } }
}

// A guest pass is deliberately tab-scoped and holds no identity — it only
// records that someone chose "Continue as guest" so the café does not bounce
// them straight back to the door.
export function readGuestPass() {
  try { return window.sessionStorage.getItem(GUEST_KEY) === 'yes'; } catch { return false; }
}
export function writeGuestPass(on = true) {
  try { on ? window.sessionStorage.setItem(GUEST_KEY, 'yes') : window.sessionStorage.removeItem(GUEST_KEY); } catch { /* blocked */ }
}

export class AccountError extends Error {
  constructor(message, { field = null, status = 0 } = {}) { super(message); this.name = 'AccountError'; this.field = field; this.status = status; }
}

export async function accountApi(action, data = {}) {
  let response;
  try {
    response = await fetch('/account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
  } catch {
    throw new AccountError('The café could not be reached. Check that the server is running and try again.');
  }
  let result = {};
  try { result = await response.json(); } catch { /* an empty or non-JSON body */ }
  if (!response.ok) throw new AccountError(result.error || 'Something went wrong at the counter. Try again.', { field: result.field, status: response.status });
  return result;
}

// Returns the signed-in account, or null when there is no session at all.
//
// A session the server rejects is cleared — that one really is over. Anything
// else (the café is down, the network blinked) is thrown, because the session
// is still perfectly good and throwing away a valid sign-in over a failed
// request is how people end up typing their password every time.
export async function resumeAccount() {
  const session = readSession();
  if (!session) return null;
  try {
    const { account } = await accountApi('resume', { id: session.id, token: session.token });
    return account;
  } catch (error) {
    if (error.status === 401 || error.status === 404) { clearSession(); return null; }
    throw error;
  }
}

export async function saveAccountProfile(patch) {
  const session = readSession();
  if (!session) return null;
  const { account } = await accountApi('profile', { id: session.id, token: session.token, ...patch });
  return account;
}

export async function logOut() {
  const session = readSession();
  clearSession();
  writeGuestPass(false);
  if (session) { try { await accountApi('log-out', { id: session.id, token: session.token }); } catch { /* already gone */ } }
}
