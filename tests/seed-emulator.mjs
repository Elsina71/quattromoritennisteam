// Dati di prova per l'emulatore (solo in locale, mai sul database vero).
// Con gli emulatori accesi (npm run emulatori): node tests/seed-emulator.mjs
// Poi apri http://localhost:5173/?emu=1 — password di tutti gli account di prova: prova123
//   admin.prova@esempio.it (admin), giulia.serra@esempio.it (cassa), marco.pinna@esempio.it (coach),
//   andrea.melis@esempio.it, sara.murru@esempio.it, luca.porcu@esempio.it (utenti)
const PROJECT = 'quattromoritennisteam-d3258';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099';
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };   // "owner" salta le regole nell'emulatore

const pad = n => String(n).padStart(2, '0');
const ymd = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const now = new Date();
const today = ymd(now);
const plus = n => { const x = new Date(now); x.setDate(x.getDate() + n); return ymd(x); };
const month = today.slice(0, 7);
const dowOf = d => { const x = new Date(d + 'T12:00').getDay(); return x === 0 ? 7 : x; };
const addMin = (hm, n) => { const [h, m] = hm.split(':').map(Number), x = h * 60 + m + n; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };

function val(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number') return { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(val) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
  return { stringValue: String(v) };
}
const fields = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
async function put(path, data) {
  const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: H, body: JSON.stringify(fields(data)) });
  if (!r.ok) throw new Error(path + ' ' + (await r.text()));
}

await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

// account (email già confermata)
const people = [['Paolo', 'Atzeni', 'M', 'admin.prova'], ['Giulia', 'Serra', 'F'], ['Marco', 'Pinna', 'M'], ['Andrea', 'Melis', 'M'], ['Sara', 'Murru', 'F'], ['Luca', 'Porcu', 'M'], ['Chiara', 'Loi', 'F']];
const uid = {};
for (const [first, last, gender, user] of people) {
  const email = `${user || `${first}.${last}`}@esempio.it`.toLowerCase();
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'prova123' }) });
  const { localId } = await r.json();
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { method: 'POST', headers: H, body: JSON.stringify({ localId, emailVerified: true }) });
  uid[first] = localId;
  await put(`members/${localId}`, { first, last, gender, created: Date.now(), privacyAt: Date.now(), privacyVer: '2026-11-06' });
  await put(`accounts/${localId}`, { email, verified: true });
}
await put('dir/members', Object.fromEntries(people.map(([f, l, g]) => [uid[f], { f, l, g }])));
await put(`admins/${uid.Paolo}`, { note: 'admin di prova' });
await put(`roles/${uid.Giulia}`, { cash: true, name: 'Serra Giulia' });
await put(`coaches/${uid.Marco}`, { all: false, name: 'Pinna Marco' });

// impostazioni: campi, regole di prenotazione, listino, avviso
const hours = (from, to) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, { open: true, from, to }]));
const courts = [{ id: 'centrale', name: 'Centrale', visible: true, hours: hours('08:00', '23:00') }, { id: 'campo2', name: 'Campo 2', visible: true, hours: hours('08:00', '23:00') },
  { id: 'campo3', name: 'Campo 3', visible: true, hours: hours('08:00', '21:00') }, { id: 'padel1', name: 'Padel 1', visible: true, hours: hours('09:00', '23:00') }];
const settings = { notice: 'Sabato il Campo 3 è chiuso per manutenzione fino alle 12.', noticeUntil: plus(10), nicks: {}, courts,
  booking: { minHours: 1, maxHours: 2, maxPerDay: 1, daysAhead: 7 }, bookRewards: { star: 5, comet: 15, earth: 30 }, prices: { w1: 50, w2: 80, w3: 100, w4: 120, q1: 140, q2: 220, spot: 15 } };
await put('data/settings', { json: JSON.stringify(settings), updated: Date.now(), minMinutes: 60 });

// allenamento settimanale del giorno di oggi (17:00–18:30, Centrale) con il suo blocco ricorrente
const tr = { name: 'Agonisti Under 14', dow: dowOf(today), from: '17:00', to: '18:30', level: 'inter', max: 6, coachUid: uid.Marco, courts: ['centrale'], reason: 'Allenamenti · Agonisti Under 14 · Pinna Marco', created: Date.now(), sizes: { [month]: 2 } };
await put('trainings/t1', tr);
await put('recurring/t_t1_centrale', { courtId: 'centrale', dow: tr.dow, from: tr.from, to: tr.to, reason: tr.reason, trid: 't1', created: Date.now() });
for (let t = tr.from; t < tr.to; t = addMin(t, 30)) await put(`weekly/centrale_${tr.dow}_${t}`, { courtId: 'centrale', dow: tr.dow, start: t, from: tr.from, to: tr.to, rid: 't_t1_centrale' });
await put(`groups/t1_${month}`, { tid: 't1', month, uids: [uid.Andrea, uid.Sara], names: { [uid.Andrea]: 'Melis Andrea', [uid.Sara]: 'Murru Sara' }, coachUid: uid.Marco, updated: Date.now() });
for (const n of ['Andrea', 'Sara']) {
  await put(`plans/${uid[n]}_${month}`, { uid: uid[n], month, tids: ['t1'], desc: ['Agonisti Under 14'], n: 1, price: 50, manual: false, updated: Date.now() });
  await put(`athletes/${uid[n]}`, { first: n, last: n === 'Andrea' ? 'Melis' : 'Murru', birthPlace: 'Cagliari', birthDate: '2013-04-12', city: 'Cagliari', address: 'via Roma 1', cf: n === 'Andrea' ? 'MLSNDR13D12B354X' : 'MRRSRA13D52B354Y',
    tess: { '2026/27': true }, certExp: n === 'Andrea' ? plus(20) : plus(200), created: Date.now() });
}

// prenotazioni: Luca domani 18:00–19:00 (Campo 2), Andrea dopodomani 10:00–11:30 (Padel 1); blocco dell'admin
async function booking(gid, courtId, date, from, to, userId, blocked = '') {
  for (let t = from; t < to; t = addMin(t, 30)) {
    const id = `${date}_${courtId}_${t}`;
    await put(`bookings/${id}`, { courtId, date, start: t, from, to, gid, userId, blocked, first: t === from });
    await put(`busy/${id}`, { courtId, date, start: t, from, to, gid });
  }
}
await booking('gluca1', 'campo2', plus(1), '18:00', '19:00', uid.Luca);
await put('bkplayers/gluca1', { gid: 'gluca1', by: uid.Luca, ownerName: 'Porcu Luca', date: plus(1), from: '18:00', to: '19:00', courtId: 'campo2', courtName: 'Campo 2', uids: [uid.Chiara], guests: {}, names: { [uid.Chiara]: 'Loi Chiara' }, remind: 60, updated: Date.now() });
await booking('gandrea1', 'padel1', plus(2), '10:00', '11:30', uid.Andrea);
await booking('gblock1', 'campo3', plus(3), '08:00', '12:00', null, 'Manutenzione');

// cassa: un incasso con ricevuta
await put(`counters/receipts-${today.slice(0, 4)}`, { last: 1, updated: Date.now() });
await put('receipts/r1', { year: +today.slice(0, 4), n: 1, series: 'Q', issued: today, payDate: today, amount: 50, method: 'cash', kind: 'cassa', ref: 'i1', incasso: 'i1', uid: uid.Andrea,
  person: { name: 'Andrea Melis', gender: 'M', birthPlace: 'Cagliari', birthDate: '2013-04-12', city: 'Cagliari', address: 'via Roma 1', cf: 'MLSNDR13D12B354X' }, causale: `Quota sociale allenamenti ${month}`,
  lines: [{ cat: 'q_train', desc: 'Corso di allenamento', amount: 50 }], void: false, created: Date.now(), by: uid.Giulia });
await put('incassi/i1', { date: today, method: 'cash', lines: [{ cat: 'q_train', series: 'Q', desc: 'Corso di allenamento', amount: 50 }], totQ: 50, totC: 0, total: 50,
  receipts: { Q: { id: 'r1', rn: `1/Q/${today.slice(0, 4)}` } }, uid: uid.Andrea, name: 'Andrea Melis', void: false, at: Date.now(), by: uid.Giulia });

// un messaggio dell'admin a tutti
await put('messages/m1', { title: 'Benvenuti', text: 'La nuova app del circolo è attiva: prenotate i campi da qui.', all: true, to: [], created: Date.now(), by: uid.Paolo });

console.log('Dati di prova pronti. Account (password prova123):', people.map(([f, l, , u]) => `${u || `${f}.${l}`}@esempio.it`.toLowerCase()).join(', '));
