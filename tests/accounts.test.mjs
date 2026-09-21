import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStore, checkEmail, checkPassword, checkHandle } from '../accounts.mjs';

async function freshStore() {
  const dir = await mkdtemp(path.join(tmpdir(), 'maple-accounts-'));
  const file = path.join(dir, 'accounts.json');
  return { store: await createStore(file), file, dispose: () => rm(dir, { recursive: true, force: true }) };
}
const GOOD = { email: 'alex@maplebean.ca', password: 'latte2024' };

test('field checks name the fix rather than saying "invalid"', () => {
  assert.match(checkEmail('alex').error, /missing an @/);
  assert.match(checkEmail('alex@maplebean').error, /ending like \.com/);
  assert.equal(checkEmail('  Alex@MapleBean.ca ').email, 'Alex@MapleBean.ca');
  assert.match(checkPassword('short1').error, /at least 8/);
  assert.match(checkPassword('allletters').error, /letter and one number/);
  assert.equal(checkPassword('latte2024').password, 'latte2024');
  assert.match(checkHandle('a').error, /at least 2/);
  assert.match(checkHandle('nope!').error, /Letters, numbers/);
  assert.equal(checkHandle('  Maple   Bean  ').handle, 'Maple Bean');
});

test('sign up, resume and log out', async () => {
  const { store, dispose } = await freshStore();
  try {
    const { account, token } = await store.signUp(GOOD);
    assert.equal(account.email, GOOD.email);
    assert.equal(account.handle, null, 'the café name is chosen later, in the creator');
    assert.equal(account.onboarded, false);
    assert.ok(await store.resume(account.id, token), 'a fresh token resumes');
    assert.equal(await store.resume(account.id, 'not-the-token'), null);
    await store.logOut(account.id, token);
    assert.equal(await store.resume(account.id, token), null, 'logging out ends that session');
  } finally { await dispose(); }
});

test('passwords are never stored in the clear', async () => {
  const { store, file, dispose } = await freshStore();
  try {
    await store.signUp(GOOD);
    const raw = await readFile(file, 'utf8');
    assert.ok(!raw.includes(GOOD.password), 'the password does not appear on disk');
    assert.ok(raw.includes(GOOD.email), 'the e-mail does');
  } finally { await dispose(); }
});

test('log in rejects a wrong password and a missing account with the same message', async () => {
  const { store, dispose } = await freshStore();
  try {
    await store.signUp(GOOD);
    const wrong = await store.logIn({ ...GOOD, password: 'espresso99' }).catch(e => e);
    const missing = await store.logIn({ email: 'nobody@maplebean.ca', password: 'latte2024' }).catch(e => e);
    assert.equal(wrong.message, missing.message, 'the reply never reveals which e-mails exist');
    assert.equal(wrong.status, 401);
    const ok = await store.logIn(GOOD);
    assert.ok(ok.token);
  } finally { await dispose(); }
});

test('one e-mail, one seat', async () => {
  const { store, dispose } = await freshStore();
  try {
    await store.signUp(GOOD);
    const again = await store.signUp({ ...GOOD, password: 'other1234' }).catch(e => e);
    assert.equal(again.status, 409);
    assert.equal(again.field, 'email');
  } finally { await dispose(); }
});

test('the creator claims a café name, and names stay unique', async () => {
  const { store, dispose } = await freshStore();
  try {
    const a = await store.signUp(GOOD);
    const b = await store.signUp({ email: 'sam@maplebean.ca', password: 'matcha123' });
    const saved = await store.saveProfile(a.account.id, { handle: 'Maple', onboarded: true });
    assert.equal(saved.handle, 'Maple');
    assert.equal(saved.onboarded, true);
    assert.equal(store.handleTaken('maple'), true, 'the check is case-insensitive');
    assert.equal(store.handleTaken('Maple', a.account.id), false, 'your own name is not taken from you');
    const clash = await store.saveProfile(b.account.id, { handle: 'maple' }).catch(e => e);
    assert.equal(clash.status, 409);
    // Renaming frees the old name.
    await store.saveProfile(a.account.id, { handle: 'Maple Two' });
    assert.equal(store.handleTaken('Maple'), false);
  } finally { await dispose(); }
});

test('the character and wardrobe come back with the account', async () => {
  const { store, file, dispose } = await freshStore();
  try {
    const { account } = await store.signUp(GOOD);
    const avatar = { base: 'claire', hair: 'mara', skin: '#c88d68', top: '#8fae6e' };
    const wardrobe = { owned: ['top-cream'], equipped: { top: 'top-cream' } };
    await store.saveProfile(account.id, { avatar, wardrobe, tutorialDone: true });
    const reopened = await createStore(file);            // as if the server restarted
    const { account: back } = await reopened.logIn(GOOD);
    assert.deepEqual(back.avatar, avatar);
    assert.deepEqual(back.wardrobe, wardrobe);
    assert.equal(back.tutorialDone, true);
  } finally { await dispose(); }
});

test('a password reset works once and signs other devices out', async () => {
  const { store, dispose } = await freshStore();
  try {
    const { account, token } = await store.signUp(GOOD);
    assert.equal(await store.startReset('nobody@maplebean.ca'), null, 'unknown e-mails get no token');
    const reset = await store.startReset(GOOD.email);
    assert.equal(reset.accountId, account.id);
    await store.finishReset(account.id, reset.token, 'newpass123');
    assert.equal(await store.resume(account.id, token), null, 'the old session is gone');
    await assert.rejects(() => store.logIn(GOOD), /do not match/);
    assert.ok((await store.logIn({ ...GOOD, password: 'newpass123' })).token);
    await assert.rejects(() => store.finishReset(account.id, reset.token, 'again12345'), /expired/, 'a reset link is single use');
  } finally { await dispose(); }
});
