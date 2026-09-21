// Maple Bean accounts: the small service the Figma sign-in journey needs
// ("Phase 3 · needs the account service" in 03 · Account choice).
//
// Deliberately boring and self-contained: a JSON file on disk, scrypt password
// hashing, opaque session tokens. No e-mail provider, so a password reset
// prints its link to the server console — enough for a local playtest, and a
// clean seam to replace with a real identity provider later.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomUUID, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';

const scrypt = promisify(scryptCb);
const SESSION_DAYS = 30, RESET_MINUTES = 30;
const SCRYPT_N = 16384, KEYLEN = 64;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9 _-]{0,22}[a-z0-9])$/i;

// Errors name the fix, never just "invalid" — the Input component in Figma
// documents that rule for every field on the sign-up screens.
export function checkEmail(value) {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!email) return { error: 'Add the e-mail you want to sign in with.' };
  if (email.length > 254) return { error: 'That e-mail is longer than 254 characters.' };
  if (!email.includes('@')) return { error: 'That e-mail is missing an @.' };
  if (!EMAIL_RE.test(email)) return { error: 'That e-mail is missing an ending like .com.' };
  return { email };
}
export function checkPassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8) return { error: 'Use at least 8 characters so your seat stays yours.' };
  if (password.length > 200) return { error: 'That password is longer than 200 characters.' };
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return { error: 'Mix in at least one letter and one number.' };
  return { password };
}
export function checkHandle(value) {
  const handle = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!handle) return { error: 'Pick the name the café will call you.' };
  if (handle.length < 2) return { error: 'Use at least 2 characters.' };
  if (handle.length > 24) return { error: 'Keep it to 24 characters or fewer.' };
  if (!HANDLE_RE.test(handle)) return { error: 'Letters, numbers, spaces, - and _ only.' };
  return { handle };
}

const hash = async (password, salt) => (await scrypt(password, salt, KEYLEN, { N: SCRYPT_N })).toString('hex');
function sameHash(a, b) {
  const left = Buffer.from(String(a), 'hex'), right = Buffer.from(String(b), 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createStore(file) {
  let db = { version: 1, accounts: {}, byEmail: {}, byHandle: {} };
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    if (raw && raw.accounts) db = { byEmail: {}, byHandle: {}, ...raw };
  } catch { /* first run: an empty café */ }
  await mkdir(path.dirname(file), { recursive: true });

  let writing = null, dirty = false;
  async function flush() {
    if (writing) { dirty = true; return writing; }
    writing = (async () => {
      do {
        dirty = false;
        const tmp = file + '.' + randomUUID().slice(0, 8) + '.tmp';
        await writeFile(tmp, JSON.stringify(db, null, 2));
        await rename(tmp, file);       // atomic: a crash mid-write cannot truncate the store
      } while (dirty);
      writing = null;
    })();
    return writing;
  }

  const keyOf = email => email.trim().toLowerCase();
  const handleKey = handle => handle.trim().toLowerCase();
  const pruneSessions = account => {
    account.sessions = (account.sessions || []).filter(s => s.expires > Date.now());
  };
  // What the browser is allowed to see about itself.
  const view = account => ({
    id: account.id, email: account.email, handle: account.handle,
    createdAt: account.createdAt, lastSeenAt: account.lastSeenAt || account.createdAt,
    avatar: account.avatar || null, wardrobe: account.wardrobe || null,
    onboarded: !!account.onboarded, tutorialDone: !!account.tutorialDone,
  });

  const store = {
    get size() { return Object.keys(db.accounts).length; },
    emailTaken: email => !!db.byEmail[keyOf(email)],
    handleTaken: (handle, exceptId) => {
      const id = db.byHandle[handleKey(handle)];
      return !!id && id !== exceptId;
    },
    view,

    // `handle` is optional: the Figma journey collects the café name later, on
    // "12 · Character name", so a fresh account has none until the creator saves.
    async signUp({ email, password, handle = null }) {
      if (db.byEmail[keyOf(email)]) throw Object.assign(new Error('That e-mail already has a seat here. Log in instead.'), { status: 409, field: 'email' });
      if (handle && db.byHandle[handleKey(handle)]) throw Object.assign(new Error('Someone already goes by that name. Try another.'), { status: 409, field: 'handle' });
      const salt = randomBytes(16).toString('hex');
      const account = {
        id: randomUUID(), email: email.trim(), handle: handle ? handle.trim() : null,
        salt, password: await hash(password, salt),
        createdAt: Date.now(), lastSeenAt: Date.now(),
        avatar: null, wardrobe: null, onboarded: false, tutorialDone: false, sessions: [],
      };
      db.accounts[account.id] = account;
      db.byEmail[keyOf(account.email)] = account.id;
      if (account.handle) db.byHandle[handleKey(account.handle)] = account.id;
      const token = await store.startSession(account.id);
      await flush();
      return { account: view(account), token };
    },

    async logIn({ email, password }) {
      const id = db.byEmail[keyOf(email)], account = id ? db.accounts[id] : null;
      // Same message and a comparable amount of work either way, so the reply
      // never reveals which e-mails have an account here.
      const salt = account ? account.salt : 'maple-bean-no-such-account';
      const attempt = await hash(password, salt);
      if (!account || !sameHash(attempt, account.password)) {
        throw Object.assign(new Error('That e-mail and password do not match. Check them and try again.'), { status: 401, field: 'password' });
      }
      account.lastSeenAt = Date.now();
      const token = await store.startSession(account.id);
      await flush();
      return { account: view(account), token };
    },

    async startSession(accountId) {
      const account = db.accounts[accountId];
      if (!account) throw Object.assign(new Error('That account is gone.'), { status: 404 });
      pruneSessions(account);
      const token = randomBytes(32).toString('base64url');
      const salt = randomBytes(8).toString('hex');
      account.sessions.push({ hash: await hash(token, salt), salt, expires: Date.now() + SESSION_DAYS * 86400000 });
      if (account.sessions.length > 8) account.sessions.splice(0, account.sessions.length - 8);
      await flush();
      return token;
    },

    async resume(accountId, token) {
      const account = db.accounts[accountId];
      if (!account || !token) return null;
      pruneSessions(account);
      for (const s of account.sessions) {
        if (sameHash(await hash(token, s.salt), s.hash)) {
          account.lastSeenAt = Date.now();
          // Touching "last seen" must never be able to take the server down:
          // an unhandled rejection here would kill the process and log
          // everybody out of a session that was perfectly valid.
          flush().catch(error => console.warn('Could not record last seen:', error.message));
          return account;
        }
      }
      return null;
    },

    async logOut(accountId, token) {
      const account = db.accounts[accountId];
      if (!account) return;
      const keep = [];
      for (const s of account.sessions || []) if (!sameHash(await hash(token, s.salt), s.hash)) keep.push(s);
      account.sessions = keep;
      await flush();
    },

    // Saves the character the creator produced, and the display name with it.
    async saveProfile(accountId, { handle, avatar, wardrobe, onboarded, tutorialDone }) {
      const account = db.accounts[accountId];
      if (!account) throw Object.assign(new Error('That account is gone.'), { status: 404 });
      if (handle && (!account.handle || handleKey(handle) !== handleKey(account.handle))) {
        const taken = db.byHandle[handleKey(handle)];
        if (taken && taken !== account.id) throw Object.assign(new Error('Someone already goes by that name. Try another.'), { status: 409, field: 'handle' });
        if (account.handle) delete db.byHandle[handleKey(account.handle)];
        account.handle = handle.trim();
        db.byHandle[handleKey(account.handle)] = account.id;
      }
      if (avatar !== undefined) account.avatar = avatar;
      if (wardrobe !== undefined) account.wardrobe = wardrobe;
      if (onboarded !== undefined) account.onboarded = !!onboarded;
      if (tutorialDone !== undefined) account.tutorialDone = !!tutorialDone;
      await flush();
      return view(account);
    },

    // No mail provider in a local playtest: the caller prints the link.
    async startReset(email) {
      const id = db.byEmail[keyOf(email)], account = id ? db.accounts[id] : null;
      if (!account) return null;              // same answer to the browser either way
      const token = randomBytes(24).toString('base64url');
      const salt = randomBytes(8).toString('hex');
      account.reset = { hash: await hash(token, salt), salt, expires: Date.now() + RESET_MINUTES * 60000 };
      await flush();
      return { accountId: account.id, token };
    },
    async finishReset(accountId, token, password) {
      const account = db.accounts[accountId];
      const reset = account ? account.reset : null;
      if (!reset || reset.expires < Date.now() || !sameHash(await hash(token, reset.salt), reset.hash)) {
        throw Object.assign(new Error('That reset link has expired. Ask for a fresh one.'), { status: 400 });
      }
      account.salt = randomBytes(16).toString('hex');
      account.password = await hash(password, account.salt);
      account.sessions = [];                  // a reset signs every other device out
      delete account.reset;
      await flush();
      return view(account);
    },
  };
  return store;
}
