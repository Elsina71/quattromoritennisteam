// Dati di prova per l'emulatore (solo in locale, mai sul database vero).
// Con gli emulatori accesi: node tests/seed-emulator.mjs
// Poi apri http://localhost:5173/?emu=1 — password di tutti gli account di prova: prova123
const PROJECT = 'quattromoritennisteam-d3258';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099';
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };   // "owner" salta le regole nell'emulatore

const pad = n => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tomorrow = (() => { const x = new Date(d); x.setDate(x.getDate() + 1); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; })();

function val(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { stringValue: String(v) };
}
const fields = o => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
async function put(path, data) {
  const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: H, body: JSON.stringify(fields(data)) });
  if (!r.ok) throw new Error(path + ' ' + (await r.text()));
}

await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

const people = [
  ['Giulia', 'Serra', 'segreteria', '+39 347 218 4401'],
  ['Marco', 'Pinna', 'allenatore', '+39 340 991 2075'],
  ['Elena', 'Cossu', 'allenatore', '+39 349 553 1180'],
  ['Andrea', 'Melis', 'utente', '+39 333 610 7724'],
  ['Francesca', 'Deiana', 'utente', ''],
  ['Luca', 'Porcu', 'utente', '+39 328 404 9136'],
  ['Sara', 'Murru', 'utente', '+39 345 772 0581'],
  ['Davide', 'Sanna', 'utente', ''],
  ['Chiara', 'Loi', 'utente', '+39 339 118 6629'],
  ['Paolo', 'Atzeni', 'admin', '+39 335 240 8817']
];
const uids = {};
for (const [first, last, role, phone] of people) {
  const email = `${first}.${last}@esempio.it`.toLowerCase();
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'prova123', displayName: `${first} ${last}` })
  });
  const { localId } = await r.json();
  uids[first] = localId;
  const joined = new Date(2026, 8 + (first.length % 3), 3 + first.length * 2);
  await put(`users/${localId}`, { first, last, phone, email, role, lang: 'it', createdAt: joined });
}

const courts = [
  ['centrale', 'Centrale', 'tennis', '08:00', '23:00', 0],
  ['campo2', 'Campo 2', 'tennis', '08:00', '23:00', 1],
  ['campo3', 'Campo 3', 'tennis', '08:00', '21:00', 2],
  ['padel1', 'Padel 1', 'padel', '09:00', '23:00', 3],
  ['padel2', 'Padel 2', 'padel', '09:00', '23:00', 4]
];
for (const [id, name, type, from, to, order] of courts) await put(`courts/${id}`, { name, type, from, to, active: true, order });

const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const fromMin = n => pad(Math.floor(n / 60)) + ':' + pad(n % 60);
let k = 0;
async function book(date, courtId, start, dur, who) {
  const id = 'bk' + (++k);
  const p = people.find(x => x[0] === who);
  const half = []; for (let m = toMin(start); m < toMin(start) + dur; m += 30) half.push(fromMin(m));
  await put(`bookings/${id}`, {
    courtId, date, start, end: fromMin(toMin(start) + dur), last: half[half.length - 1], dur,
    uid: p ? uids[who] : null, name: p ? `${p[0]} ${p[1]}` : who, createdBy: uids.Giulia, createdAt: new Date()
  });
  for (const t of half) await put(`slots/${courtId}_${date}_${t.replace(':', '')}`, { courtId, date, time: t, bookingId: id });
}
for (const date of [today, tomorrow]) {
  await book(date, 'centrale', '09:00', 90, 'Luca');
  await book(date, 'centrale', '17:30', 90, 'Andrea');
  await book(date, 'centrale', '19:00', 120, 'Sara');
  await book(date, 'campo2', '10:00', 60, 'Chiara');
  await book(date, 'campo2', '18:00', 120, 'Francesca');
  await book(date, 'campo3', '16:00', 60, 'Roberto Usai');
  await book(date, 'campo3', '18:30', 90, 'Davide');
  await book(date, 'padel1', '18:00', 90, 'Luca');
  await book(date, 'padel1', '20:00', 90, 'Simona Floris');
  await book(date, 'padel2', '19:30', 120, 'Chiara');
}
// corsisti: certificati in tutte le situazioni (valido, in scadenza, scaduto, mancante)
const plus = n => { const x = new Date(d); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const kids = [
  ['Alice', 'Mura', '2014-03-12', 'Roberta Mura', 'agonistico', plus(120), true],
  ['Tommaso', 'Piras', '2013-07-30', 'Gianni Piras', 'agonistico', plus(5), true],
  ['Giorgia', 'Lai', '2015-01-18', 'Marta Lai', 'non agonistico', plus(22), false],
  ['Matteo', 'Fadda', '2012-11-02', 'Stefano Fadda', 'agonistico', plus(-3), true],
  ['Sofia', 'Cocco', '2014-09-09', 'Laura Cocco', 'non agonistico', plus(200), true],
  ['Riccardo', 'Orrù', '2013-04-25', 'Pietro Orrù', '', '', false],
  ['Emma', 'Usai', '2015-06-14', 'Valeria Usai', 'non agonistico', plus(90), true],
  ['Nicola', 'Serra', '2012-02-08', 'Franco Serra', 'agonistico', plus(310), true],
  ['Martina', 'Pisano', '2014-12-01', 'Anna Pisano', 'agonistico', plus(28), true],
  ['Gabriele', 'Contu', '2013-10-19', 'Ivo Contu', 'non agonistico', plus(160), false]
];
const ath = {};
let ai = 0;
for (const [first, last, birth, parent, certType, certExpiry, paid] of kids) {
  const id = 'ath' + (++ai); ath[first] = id;
  await put(`athletes/${id}`, { first, last, birth, phone: '+39 3' + (40 + ai) + ' ' + (100 + ai * 7) + ' ' + (2000 + ai * 31), email: '', parent, notes: '',
    certType, certExpiry, fitpPaid: paid, fitpYear: paid ? d.getFullYear() : 0, active: true, createdAt: new Date() });
}

// allenamenti di questa settimana (lunedì-domenica)
const monday = (() => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; })();
const dayOfWeek = i => { const x = new Date(monday); x.setDate(x.getDate() + i); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
let ti = 0;
async function training(date, courtId, start, dur, title, coach, kidsIn) {
  const id = 'tr' + (++ti);
  const half = []; for (let m = toMin(start); m < toMin(start) + dur; m += 30) half.push(fromMin(m));
  const p = people.find(x => x[0] === coach);
  await put(`trainings/${id}`, { title, courtId, date, start, end: fromMin(toMin(start) + dur), last: half[half.length - 1], dur,
    coachId: uids[coach], coachName: `${p[0]} ${p[1]}`, series: 'serie-' + title, notes: '', createdBy: uids.Giulia, createdAt: new Date() });
  // liste e mappe con la REST: scritte a parte
  const r = await fetch(`${FS}/trainings/${id}?updateMask.fieldPaths=athleteIds&updateMask.fieldPaths=names`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: {
    athleteIds: { arrayValue: { values: kidsIn.map(n => ({ stringValue: ath[n] })) } },
    names: { mapValue: { fields: Object.fromEntries(kidsIn.map(n => [ath[n], { stringValue: n + ' ' + kids.find(x => x[0] === n)[1] }])) } }
  } }) });
  if (!r.ok) throw new Error(await r.text());
  for (const t of half) await put(`slots/${courtId}_${date}_${t.replace(':', '')}`, { courtId, date, time: t, trainingId: id });
  return id;
}
const u12 = ['Alice', 'Giorgia', 'Sofia', 'Emma', 'Martina'];
const ago = ['Tommaso', 'Matteo', 'Nicola', 'Riccardo', 'Gabriele'];
const trToday = [];
for (const i of [0, 2, 4]) {
  const id = await training(dayOfWeek(i), 'campo2', '15:00', 90, 'Under 12', 'Marco', u12);
  if (dayOfWeek(i) === today) trToday.push(id);
}
for (const i of [1, 3, 4]) {
  const id = await training(dayOfWeek(i), 'centrale', '14:00', 90, 'Agonisti', 'Elena', ago);
  if (dayOfWeek(i) === today) trToday.push(id);
}
// valutazioni già date per il primo allenamento Under 12 della settimana
async function evalOf(tid, kid, scores, note, coach) {
  await fetch(`${FS}/evals/${tid}_${ath[kid]}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: {
    trainingId: { stringValue: tid }, athleteId: { stringValue: ath[kid] }, athleteName: { stringValue: kid + ' ' + kids.find(x => x[0] === kid)[1] },
    date: { stringValue: dayOfWeek(0) }, title: { stringValue: 'Under 12' }, coachId: { stringValue: uids[coach] }, note: { stringValue: note },
    by: { stringValue: uids[coach] }, updatedAt: { timestampValue: new Date().toISOString() },
    scores: { mapValue: { fields: Object.fromEntries(Object.entries(scores).map(([k2, v]) => [k2, { integerValue: String(v) }])) } }
  } }) });
}
await evalOf('tr1', 'Alice', { tecnica: 7, movimento: 6, consistenza: 7 }, 'Buon dritto in spinta / rovescio in ritardo sotto pressione', 'Marco');
await evalOf('tr1', 'Giorgia', { tecnica: 5, scelte: 6, atteggiamento: 8 }, 'Ascolta molto / servizio da sistemare', 'Marco');
await evalOf('tr1', 'Sofia', { movimento: 8, intensita: 7, consistenza: 5 }, 'Gambe sempre attive / troppi errori quando accelera', 'Marco');

console.log('dati di prova pronti:', Object.keys(uids).length, 'utenti,', courts.length, 'campi,', k, 'prenotazioni,', kids.length, 'corsisti,', ti, 'allenamenti');
