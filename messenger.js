// Text conversations: the one-to-one NPC chat box and the cozy group chat.
import { PERSONAS } from './npc-brain.js';
import { extractFacts } from './npc-brain.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

const CHIPS = {
  mara: ['What do you recommend?', 'How’s your day going?', 'Tell me about the café'],
  jules: ['Up for a game?', 'What’s your hot take today?', 'Any chess tips?'],
  claire: ['What are you drawing?', 'Any book recommendations?', 'What inspires you?'],
  noah: ['Want to study together?', 'What are you studying?', 'Any focus tips?'],
};

export function createNpcChat({ api, bonds, onMessage, onClose, context }) {
  const history = {};                  // npc -> [{role, content}]
  let npc = null, waiting = false;
  const log = $('chat-log');
  function line(text, cls, who) { const m = el('div', 'msg ' + (cls || '')); if (who) m.append(el('span', 'who', who)); m.append(document.createTextNode(text)); log.append(m); log.scrollTop = log.scrollHeight; return m; }
  function open(id) {
    npc = id; const p = PERSONAS[id], b = bonds.get(id);
    $('chat-name').textContent = p.name; $('chat-avatar').textContent = p.name[0]; $('chat-bond').textContent = bonds.label(id);
    log.replaceChildren(); history[id] = history[id] || [];
    if (!history[id].length) line(p.name + ' looks up from ' + ({ mara: 'the espresso machine', jules: 'a puzzle', claire: 'her sketchbook', noah: 'his notes' }[id] || 'their cup') + '.', 'sys');
    for (const m of history[id].slice(-12)) line(m.content, m.role === 'user' ? 'me' : '');
    const chips = $('chat-chips'); chips.replaceChildren();
    for (const c of CHIPS[id] || []) { const b = el('button', '', c); b.onclick = () => send(c, 'question'); chips.append(b); }
    $('chatbox').hidden = false; setTimeout(() => $('chat-text').focus(), 50);
    void b;
  }
  function close() { if (!npc) return; const id = npc; npc = null; $('chatbox').hidden = true; onClose?.(id); }
  async function send(text, kind = 'chat') {
    text = text.trim(); if (!text || !npc || waiting) return;
    const id = npc; waiting = true; line(text, 'me'); $('chat-text').value = '';
    const facts = extractFacts(text); for (const f of facts) bonds.remember(id, f);
    const typing = el('div', 'typing'); typing.append(el('i'), el('i'), el('i')); log.append(typing); log.scrollTop = log.scrollHeight;
    const started = performance.now();
    try {
      const recent = history[id].filter(m => m.role === 'assistant').slice(-4).map(m => m.content);
      const res = await api({ action: 'npc-chat', npc: id, text, history: history[id].slice(-10), context: { ...context(id), memory: bonds.get(id).memory, recent } });
      // A short, natural beat before the reply appears.
      const pause = Math.max(0, 650 + Math.min(1600, res.reply.length * 18) - (performance.now() - started));
      await new Promise(r => setTimeout(r, pause));
      typing.remove(); history[id].push({ role: 'user', content: text }, { role: 'assistant', content: res.reply });
      if (npc === id) line(res.reply, '', PERSONAS[id].name);
      onMessage?.(id, kind, res);
    } catch (e) { typing.remove(); line(e.message, 'sys'); }
    finally { waiting = false; }
  }
  $('chat-send').onsubmit = e => { e.preventDefault(); send($('chat-text').value); };
  $('chatbox-close').onclick = close;
  return { open, close, send, get npc() { return npc; } };
}

// ---------------------------------------------------------------- group chat
export function createMessenger({ api, me, guests, bonds, onInvite, notify }) {
  let groups = [], openId = null, unread = new Set();
  const body = $('messenger-body');
  function setGroups(list) { groups = list; render(); }
  function upsert(g) {
    const i = groups.findIndex(x => x.id === g.id), prev = groups[i];
    if (i >= 0) groups[i] = g; else groups.push(g);
    const last = g.messages[g.messages.length - 1];
    if (last && (!prev || prev.messages.length < g.messages.length) && last.from !== me().id && !last.system) {
      if ($('messenger').hidden || openId !== g.id) { unread.add(g.id); notify?.(last.name + ' in ' + g.name + ': ' + last.text, 'message'); }
    }
    badge(); if (!$('messenger').hidden) render();
  }
  function remove(id) { groups = groups.filter(g => g.id !== id); if (openId === id) openId = null; unread.delete(id); badge(); render(); }
  function badge() { $('messages-badge').hidden = !unread.size; }
  function render() {
    body.replaceChildren();
    if (!openId || !groups.find(g => g.id === openId)) return renderList();
    renderGroup(groups.find(g => g.id === openId));
  }
  function renderList() {
    $('messenger-title').textContent = 'Your circles';
    body.append(el('p', 'muted', 'Group chats for your café friends. Invite other guests or the regulars, then plan a study session or a game.'));
    const list = el('div', 'group-list');
    for (const g of groups) {
      const b = el('button'); const last = g.messages[g.messages.length - 1];
      b.append(el('span', 'avatar', g.name[0].toUpperCase()));
      const t = el('span'); t.append(el('b', '', g.name + (unread.has(g.id) ? ' •' : '')), el('small', '', (last?.name ? last.name + ': ' : '') + (last?.text || ''))); b.append(t);
      b.onclick = () => { openId = g.id; unread.delete(g.id); badge(); render(); }; list.append(b);
    }
    if (!groups.length) list.append(el('p', 'muted', 'No groups yet.'));
    body.append(list);
    const form = el('form', 'group-send'); const input = el('input'); input.placeholder = 'New group name (e.g. Study Buddies)'; input.maxLength = 32; const go = el('button', 'primary', 'Create'); form.append(input, go);
    form.onsubmit = async e => { e.preventDefault(); if (!input.value.trim()) return; try { const r = await api({ action: 'group-create', name: input.value }); openId = r.group.id; upsert(r.group); } catch (err) { notify?.(err.message); } };
    body.append(form);
  }
  function renderGroup(g) {
    $('messenger-title').textContent = g.name;
    const back = el('button', 'secondary', '← All groups'); back.style.width = 'auto'; back.onclick = () => { openId = null; render(); }; body.append(back);
    const chips = el('div', 'chips');
    for (const m of g.members) chips.append(el('span', 'chip', m.id === me().id ? m.name + ' (you)' : m.name));
    for (const n of g.npcs) chips.append(el('span', 'chip npc', n.name));
    body.append(chips);
    const actions = el('div', 'row-actions');
    const inviteBtn = el('button', '', '+ Invite'); inviteBtn.onclick = () => showInvite(g); actions.append(inviteBtn);
    for (const [kind, label] of [['study', '📚 Study together'], ['play', '🎲 Play a game'], ['hangout', '☕ Hang out']]) { const b = el('button', '', label); b.onclick = () => sendMsg(g, { study: 'Who wants to study in the Study Room? 📚', play: 'Game at the Games & Garden room? 🎲', hangout: 'Coffee in the living room? ☕' }[kind], { kind, place: { study: 'study-table-0', play: 'game-chess', hangout: 'sofa' }[kind], label }); actions.append(b); }
    const leave = el('button', '', 'Leave'); leave.onclick = async () => { await api({ action: 'group-leave', groupId: g.id }).catch(() => {}); remove(g.id); }; actions.append(leave);
    body.append(actions);
    const log = el('div', 'group-log');
    for (const m of g.messages) {
      if (m.system) { log.append(el('div', 'msg sys', m.text)); continue; }
      const mine = m.from === me().id, d = el('div', 'msg ' + (mine ? 'me' : '')); if (!mine) d.append(el('span', 'who', m.name)); d.append(document.createTextNode(m.text));
      if (m.invite) { const card = el('div', 'invite-card', m.invite.label || 'Join'); if (!mine) { const j = el('button', '', 'Join'); j.onclick = () => onInvite?.(m.invite); card.append(j); } d.append(card); }
      log.append(d);
    }
    body.append(log); setTimeout(() => log.scrollTop = log.scrollHeight);
    const form = el('form', 'group-send'); const input = el('input'); input.placeholder = 'Message ' + g.name + '…'; input.maxLength = 280; form.append(input, el('button', 'primary', 'Send'));
    form.onsubmit = e => { e.preventDefault(); if (input.value.trim()) sendMsg(g, input.value); input.value = ''; };
    body.append(form); setTimeout(() => input.focus());
  }
  async function sendMsg(g, text, invite) { try { await api({ action: 'group-message', groupId: g.id, text, invite, levels: Object.fromEntries(g.npcs.map(n => [n.id, bonds.label(n.id)])) }); } catch (e) { notify?.(e.message); } }
  function showInvite(g) {
    body.replaceChildren(); $('messenger-title').textContent = 'Invite to ' + g.name;
    const back = el('button', 'secondary', '← Back'); back.style.width = 'auto'; back.onclick = () => render(); body.append(back);
    body.append(el('div', 'eyebrow', 'GUESTS IN THE CAFÉ'));
    const others = guests().filter(x => x.id !== me().id && !g.members.some(m => m.id === x.id));
    if (!others.length) body.append(el('p', 'muted', 'No other guests right now. Open the café in a second window to invite a friend.'));
    for (const o of others) { const b = el('button', 'secondary', '+ ' + o.name); b.style.margin = '4px 0'; b.onclick = async () => { await api({ action: 'group-invite', groupId: g.id, guest: o.id }).catch(e => notify?.(e.message)); render(); }; body.append(b); }
    body.append(el('div', 'eyebrow', 'REGULARS'));
    for (const [id, p] of Object.entries(PERSONAS)) {
      if (g.npcs.some(n => n.id === id)) continue;
      const ok = bonds.points(id) >= 20, b = el('button', 'secondary', '+ ' + p.name + (ok ? '' : ' — become acquaintances first')); b.disabled = !ok; b.style.margin = '4px 0';
      b.onclick = async () => { await api({ action: 'group-invite', groupId: g.id, npc: id }).catch(e => notify?.(e.message)); render(); }; body.append(b);
    }
  }
  $('messenger-close').onclick = () => { $('messenger').hidden = true; };
  return { setGroups, upsert, remove, open() { $('messenger').hidden = false; if (openId) unread.delete(openId); badge(); render(); }, get unread() { return unread.size; } };
}
