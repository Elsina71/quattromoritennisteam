// Dati di prova per l'emulatore (solo in locale, mai sul database vero).
// Con gli emulatori accesi (npm run emulatori): node tests/seed-emulator.mjs
// Poi apri http://localhost:5173/?emu=1 — password di tutti gli account di prova: prova123
//   admin.prova@esempio.it (admin), elena.sanna@esempio.it (segreteria), giulia.serra@esempio.it (cassa),
//   marco.pinna@esempio.it (allenatore), andrea.melis@esempio.it, sara.murru@esempio.it, luca.porcu@esempio.it,
//   chiara.loi@esempio.it (utenti e corsisti); in più due ragazzi SENZA ACCOUNT (Pietro Deiana e Giorgia Floris,
//   schede k-… con il genitore), Pietro con un pacchetto di 4 lezioni
// Porte diverse da quelle di serie: EMU_FS=8180 EMU_AU=9199 node tests/seed-emulator.mjs (e nell'app ?emu=1&fs=8180&au=9199)
const PROJECT = 'quattromoritennisteam-d3258';
const FSP = process.env.EMU_FS || '8080', AUP = process.env.EMU_AU || '9099';
const FS = `http://127.0.0.1:${FSP}/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `http://127.0.0.1:${AUP}`;
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };   // "owner" salta le regole nell'emulatore

const pad = n => String(n).padStart(2, '0');
const ymd = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
const now = new Date();
const today = ymd(now);
const plus = n => { const x = new Date(now); x.setDate(x.getDate() + n); return ymd(x); };
const month = today.slice(0, 7);
const dowOf = d => { const x = new Date(d + 'T12:00').getDay(); return x === 0 ? 7 : x; };
const addMin = (hm, n) => { const [h, m] = hm.split(':').map(Number), x = h * 60 + m + n; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
const season = (() => { const y = +today.slice(0, 4), mo = +today.slice(5, 7), a = mo >= 9 ? y : y - 1; return `${a}/${pad((a + 1) % 100)}`; })();

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

await fetch(`http://127.0.0.1:${FSP}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

// account (email già confermata)
const people = [['Paolo', 'Atzeni', 'M', 'admin.prova'], ['Elena', 'Sanna', 'F'], ['Giulia', 'Serra', 'F'], ['Marco', 'Pinna', 'M'], ['Andrea', 'Melis', 'M'], ['Sara', 'Murru', 'F'],
  ['Luca', 'Porcu', 'M'], ['Chiara', 'Loi', 'F'], ['Matteo', 'Cocco', 'M']];
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
const nm = f => { const p = people.find(x => x[0] === f); return `${p[1]} ${p[0]}`; };
await put('dir/members', Object.fromEntries(people.map(([f, l, g]) => [uid[f], { f, l, g }])));
// ruoli: admin generale (raccolta admins), segreteria, cassa, allenatore
await put(`admins/${uid.Paolo}`, { note: 'admin di prova' });
await put(`roles/${uid.Elena}`, { seg: true, center: false, cash: false, name: nm('Elena') });
await put(`roles/${uid.Giulia}`, { cash: true, center: false, seg: false, name: nm('Giulia') });
await put(`coaches/${uid.Marco}`, { all: false, name: nm('Marco') });

// impostazioni: campi da tennis e da padel, regole di prenotazione (da 1 h a 2 h), listino, avviso
const hours = (from, to) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, { open: true, from, to }]));
const courts = [{ id: 'centrale', name: 'Centrale', type: 'tennis', visible: true, hours: hours('08:00', '23:00') }, { id: 'campo2', name: 'Campo 2', type: 'tennis', visible: true, hours: hours('08:00', '23:00') },
  { id: 'campo3', name: 'Campo 3', type: 'tennis', visible: true, hours: hours('08:00', '21:00') }, { id: 'padel1', name: 'Padel 1', type: 'padel', visible: true, hours: hours('09:00', '23:00') },
  { id: 'padel2', name: 'Padel 2', type: 'padel', visible: true, hours: hours('09:00', '23:00') }];
const settings = { notice: 'Sabato il Campo 3 è chiuso per manutenzione fino alle 12.', noticeUntil: plus(10), nicks: {}, courts,
  booking: { minHours: 1, maxHours: 2, maxPerDay: 1, daysAhead: 7 }, bookRewards: { star: 5, comet: 15, earth: 30 },
  prices: { w1: 50, w2: 80, w3: 100, w4: 120, q1: 140, q2: 220, spot: 15, c1: 380, c2: 600, courseFrom: `${today.slice(0, 4)}-09-15`, courseTo: `${+today.slice(0, 4) + 1}-06-15`, fitp: 30 } };
await put('data/settings', { json: JSON.stringify(settings), updated: Date.now(), minMinutes: 60, maxMinutes: 120 });

// allenamento settimanale del giorno di oggi (17:00–18:30, Centrale) con il suo blocco ricorrente; un allenamento di padel domani
const tr = { name: 'Agonisti Under 14', dow: dowOf(today), from: '17:00', to: '18:30', level: 'inter', max: 6, coachUid: uid.Marco, courts: ['centrale'], reason: 'Allenamenti · Agonisti Under 14 · Pinna Marco', created: Date.now(), sizes: { [month]: 6 } };
const tr2 = { name: 'Padel principianti', dow: dowOf(plus(1)), from: '19:00', to: '20:00', level: 'start', max: 4, coachUid: uid.Marco, courts: ['padel1'], reason: 'Allenamenti · Padel principianti · Pinna Marco', created: Date.now(), sizes: { [month]: 2 } };
for (const [id, t, c] of [['t1', tr, 'centrale'], ['t2', tr2, 'padel1']]) {
  await put(`trainings/${id}`, t);
  await put(`recurring/t_${id}_${c}`, { courtId: c, dow: t.dow, from: t.from, to: t.to, reason: t.reason, trid: id, created: Date.now() });
  for (let x = t.from; x < t.to; x = addMin(x, 30)) await put(`weekly/${c}_${t.dow}_${x}`, { courtId: c, dow: t.dow, start: x, from: t.from, to: t.to, rid: `t_${id}_${c}` });
}
const g1 = ['Andrea', 'Sara', 'Luca', 'Chiara'];
// ragazzi senza account (schede gestite dalla segreteria, ID "k-…"): stessi gruppi, piani, pacchetti e ricevute
const kids = [
  { id: 'k-PietroDeiana01', first: 'Pietro', last: 'Deiana', gender: 'M', birthDate: '2016-03-02', parent: { name: 'Anna Deiana', phone: '333 1234567', email: 'anna.deiana@esempio.it' }, notes: 'Allergico alle api', certType: 'nonagon', certExp: plus(90) },
  { id: 'k-GiorgiaFloris1', first: 'Giorgia', last: 'Floris', gender: 'F', birthDate: '2015-09-21', parent: { name: 'Paolo Floris', phone: '347 7654321', email: '' }, notes: '', certType: 'agon', certExp: plus(25) }];
const lastWeek = plus(-7), lwMonth = lastWeek.slice(0, 7);
for (const mo of [...new Set([month, lwMonth])]) {
  await put(`groups/t1_${mo}`, { tid: 't1', month: mo, uids: g1.map(n => uid[n]).concat(kids.map(k => k.id)),
    names: Object.assign(Object.fromEntries(g1.map(n => [uid[n], nm(n)])), Object.fromEntries(kids.map(k => [k.id, `${k.last} ${k.first}`]))), coachUid: uid.Marco, updated: Date.now() });
}
for (const k of kids) {
  const { id, ...data } = k;
  await put(`athletes/${id}`, Object.assign({ noAccount: true, tess: { [season]: id === kids[0].id }, created: Date.now() }, data,
    id === kids[0].id ? { birthPlace: 'Cagliari', city: 'Quartu Sant\'Elena', address: 'via Marconi 12', cf: 'DNEPTR16C02B354A' } : {}));
  await put(`plans/${id}_${month}`, { uid: id, month, tids: ['t1'], desc: ['Agonisti Under 14'], n: 1, price: 50, manual: false, updated: Date.now() });
}
// pacchetto di Pietro (4 lezioni) con il suo contatore senza prezzi, letto anche dall'allenatore
await put('packs/kpietro', { uid: kids[0].id, name: 'Deiana Pietro', n: 4, price: 70, used: 0, from: `${month}-01`, created: Date.now(), by: uid.Elena });
await put('packcount/kpietro', { uid: kids[0].id, n: 4, used: 0, from: `${month}-01`, created: Date.now(), coachUids: [uid.Marco] });
await put(`groups/t2_${month}`, { tid: 't2', month, uids: [uid.Matteo, uid.Chiara], names: { [uid.Matteo]: nm('Matteo'), [uid.Chiara]: nm('Chiara') }, coachUid: uid.Marco, updated: Date.now() });
// certificati: Andrea scade tra 20 giorni, Sara tra 5, Luca è scaduto, Chiara e Matteo validi
const certs = { Andrea: [plus(20), 'agon'], Sara: [plus(5), 'agon'], Luca: [plus(-10), 'nonagon'], Chiara: [plus(200), 'nonagon'], Matteo: [plus(120), 'nonagon'] };
const cfs = { Andrea: 'MLSNDR13D12B354X', Sara: 'MRRSRA13D52B354Y', Luca: 'PRCLCU12C10B354Z', Chiara: 'LOICHR12E41B354W', Matteo: 'CCCMTT90A01B354K' };
for (const n of Object.keys(certs)) {
  const p = people.find(x => x[0] === n);
  await put(`athletes/${uid[n]}`, { first: n, last: p[1], birthPlace: 'Cagliari', birthDate: n === 'Matteo' ? '1990-01-01' : '2013-04-12', city: 'Cagliari', address: 'via Roma 1', cf: cfs[n],
    tess: { [season]: n !== 'Luca' }, certExp: certs[n][0], certType: certs[n][1], created: Date.now() });
}
for (const n of g1.concat(['Matteo'])) {
  const tids = (g1.includes(n) ? ['t1'] : []).concat(['Matteo', 'Chiara'].includes(n) ? ['t2'] : []);
  await put(`plans/${uid[n]}_${month}`, { uid: uid[n], month, tids, desc: tids.map(x => (x === 't1' ? 'Agonisti Under 14' : 'Padel principianti')), n: tids.length, price: tids.length > 1 ? 80 : 50, manual: false, updated: Date.now() });
}
// pacchetto di 5 lezioni per Andrea (dal 1° del mese, non ancora usato)
await put('packs/kandrea', { uid: uid.Andrea, name: nm('Andrea'), n: 5, price: 90, used: 0, from: `${month}-01`, created: Date.now(), by: uid.Paolo });
await put('packcount/kandrea', { uid: uid.Andrea, n: 5, used: 0, from: `${month}-01`, created: Date.now(), coachUids: [uid.Marco] });
// risposte di oggi: Chiara «ci sarò», Luca «non ci sarò»; Andrea e Sara senza risposta (la presenza la segna l'allenatore)
await put(`occ/t1_${today}`, { tid: 't1', date: today, p: 1, a: 1, s: 0, cancelled: false });
await put(`att/t1_${today}_${uid.Chiara}`, { tid: 't1', date: today, uid: uid.Chiara, status: 'in', at: Date.now(), coachUid: uid.Marco });
await put(`att/t1_${today}_${uid.Luca}`, { tid: 't1', date: today, uid: uid.Luca, status: 'out', at: Date.now(), coachUid: uid.Marco });
// una scheda di valutazione della settimana scorsa (Chiara e Sara)
await put(`occ/t1_${lastWeek}`, { tid: 't1', date: lastWeek, p: 2, a: 0, s: 0, cancelled: false });
await put(`evals/t1_${lastWeek}_${uid.Chiara}`, { tid: 't1', date: lastWeek, uid: uid.Chiara, coachUid: uid.Marco, by: uid.Marco, v: { tec: 7, mov: 5, con: 6 }, note: 'Buon dritto in spinta / rovescio in ritardo sotto pressione', at: Date.now() });
await put(`evals/t1_${lastWeek}_${uid.Sara}`, { tid: 't1', date: lastWeek, uid: uid.Sara, coachUid: uid.Marco, by: uid.Marco, v: { tec: 6, sce: 8, att: 9 }, note: 'Ottima attenzione / servizio da sistemare', at: Date.now() });

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
console.log(JSON.stringify(uid));
