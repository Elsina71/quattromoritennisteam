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
console.log('dati di prova pronti:', Object.keys(uids).length, 'utenti,', courts.length, 'campi,', k, 'prenotazioni');
