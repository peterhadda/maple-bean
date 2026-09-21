// Look at (and tidy) the local account store.
//
//   node tools/accounts.mjs              list every account
//   node tools/accounts.mjs show <email> everything kept about one account
//   node tools/accounts.mjs delete <email>
//   node tools/accounts.mjs reset        empty the store
//
// The store is a plain JSON file at .data/accounts.json, next to the café.
// Passwords are never in it — only scrypt hashes — so this can print freely.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = path.join(root, '.data/accounts.json');
const [command = 'list', argument] = process.argv.slice(2);

let db;
try { db = JSON.parse(await readFile(file, 'utf8')); }
catch { console.log(`No account store yet.\nIt appears at ${file} the first time somebody signs up.`); process.exit(0); }

const accounts = Object.values(db.accounts || {});
const when = ms => ms ? new Date(ms).toLocaleString() : '—';
const find = email => accounts.find(a => a.email.toLowerCase() === String(email || '').toLowerCase());
const save = () => writeFile(file, JSON.stringify(db, null, 2));
// The running server keeps the whole store in memory and rewrites this file on
// its next save, so an edit made while it is up gets silently undone.
const warnIfServing = () => console.log('\nStop the café server before editing the store — while it is running it holds\nthe accounts in memory and will write them back over this change.');

if (command === 'list') {
  console.log(`Account store: ${file}`);
  console.log(`${accounts.length} account${accounts.length === 1 ? '' : 's'}\n`);
  if (!accounts.length) process.exit(0);
  console.table(accounts.map(a => ({
    username: a.handle || '(not chosen yet)',
    email: a.email,
    character: a.avatar ? `${a.avatar.base} · ${a.avatar.hair} hair` : '—',
    owned: a.wardrobe?.owned?.length ?? 0,
    onboarded: !!a.onboarded,
    tour: !!a.tutorialDone,
    sessions: (a.sessions || []).length,
    joined: when(a.createdAt),
    'last seen': when(a.lastSeenAt),
  })));
} else if (command === 'show') {
  const account = find(argument);
  if (!account) { console.error(`No account for ${argument}.`); process.exit(1); }
  // Never print the hashes or the session material, even though they are hashed.
  const { password, salt, sessions, reset, ...rest } = account;
  console.log(JSON.stringify({ ...rest, sessions: (sessions || []).length, hasResetPending: !!reset }, null, 2));
} else if (command === 'delete') {
  const account = find(argument);
  if (!account) { console.error(`No account for ${argument}.`); process.exit(1); }
  delete db.accounts[account.id];
  for (const key of ['byEmail', 'byHandle']) {
    for (const [k, v] of Object.entries(db[key] || {})) if (v === account.id) delete db[key][k];
  }
  await save();
  console.log(`Deleted ${account.email}${account.handle ? ` (${account.handle})` : ''}.`);
  warnIfServing();
} else if (command === 'reset') {
  db = { version: 1, accounts: {}, byEmail: {}, byHandle: {} };
  await save();
  console.log('Account store emptied.');
  warnIfServing();
} else {
  console.error(`Unknown command "${command}". Try: list, show <email>, delete <email>, reset.`);
  process.exit(1);
}
