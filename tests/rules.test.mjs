// Prove delle regole del database (emulatore Firestore).
// Si lancia con: npm run test:rules  (firebase emulators:exec ... "node tests/rules.test.mjs")
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';

// Il titolare è riconosciuto dall'impronta SHA-256 della sua email: per provarlo, nelle regole caricate qui
// l'impronta vera si sostituisce con quella di un'email di prova (il resto delle regole è identico).
const OWNER_HASH = 'a2de6b81796442dad657da768dcb08f740fe60afdbdb368e2f9a1604238913c1';
const rulesText = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
if (!rulesText.includes(OWNER_HASH)) throw new Error("manca l'impronta del titolare nelle regole");
const testHash = createHash('sha256').update('titolare@prova.it').digest('hex');
// indirizzo dell'emulatore: quello dato da "firebase emulators:exec" (FIRESTORE_EMULATOR_HOST), altrimenti 127.0.0.1:8080
const [emuHost, emuPort] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-quattromori',
  firestore: { rules: rulesText.split(OWNER_HASH).join(testHash), host: emuHost, port: Number(emuPort) }
});

let n = 0;
const test = async (name, fn) => {
  try { await fn(); n++; console.log('ok -', name); }
  catch (e) { console.error('FALLITA -', name, '\n', e); process.exitCode = 1; }
};

// utenti di prova: email confermata, salvo "nuovo"
const tok = (email, verified = true) => ({ email, email_verified: verified });
const db = (uid, email, verified) => env.authenticatedContext(uid, tok(email || `${uid}@prova.it`, verified)).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const prof = { first: 'Anna', last: 'Mura', gender: 'F', created: 1 };

// dati iniziali (senza regole): impostazioni, profili, ruoli, un admin nella raccolta "admins"
await env.withSecurityRulesDisabled(async c => {
  const f = c.firestore();
  await setDoc(doc(f, 'data/settings'), { json: '{}', minMinutes: 60 });
  for (const uid of ['mario', 'luca', 'cassiere', 'coach1', 'coach2', 'centro', 'capo', 'segr', 'sara']) await setDoc(doc(f, 'members', uid), Object.assign({}, prof, { first: uid }));
  await setDoc(doc(f, 'roles/segr'), { seg: true });
  await setDoc(doc(f, 'coaches/coach2'), { all: false, name: 'Coach Due' });
  await setDoc(doc(f, 'admins/capo'), { note: 'admin di prova' });
  await setDoc(doc(f, 'roles/cassiere'), { cash: true });
  await setDoc(doc(f, 'roles/centro'), { center: true });
  await setDoc(doc(f, 'coaches/coach1'), { all: false, name: 'Coach Uno' });
  await setDoc(doc(f, 'athletes/mario'), { first: 'Mario', cf: 'MRAMRA80A01B354X', certExp: '2027-01-01' });
  await setDoc(doc(f, 'accounts/mario'), { email: 'mario@prova.it', verified: true });
});

// ---------- registrazione ----------
await test('chi si registra crea il proprio profilo', async () => {
  await assertSucceeds(setDoc(doc(db('nuovo', 'nuovo@prova.it', false), 'members/nuovo'), prof));
});
await test('il profilo non accetta campi in più (es. un ruolo)', async () => {
  await assertFails(setDoc(doc(db('furbo'), 'members/furbo'), Object.assign({ role: 'admin' }, prof)));
});
await test('non si scrive il profilo di un altro', async () => {
  await assertFails(setDoc(doc(db('luca'), 'members/mario'), prof));
});
await test('la propria email si salva solo uguale a quella dell\'account', async () => {
  await assertSucceeds(setDoc(doc(db('luca', 'luca@prova.it'), 'accounts/luca'), { email: 'luca@prova.it', verified: true }));
  await assertFails(setDoc(doc(db('luca', 'luca@prova.it'), 'accounts/luca'), { email: 'altro@prova.it', verified: true }));
});

// ---------- privacy ----------
await test('i profili e le email degli altri non si leggono', async () => {
  await assertFails(getDoc(doc(db('luca'), 'members/mario')));
  await assertFails(getDoc(doc(db('luca'), 'accounts/mario')));
  await assertFails(getDocs(collection(db('luca'), 'members')));
});
await test('l\'admin legge profili ed email', async () => {
  await assertSucceeds(getDoc(doc(db('capo'), 'members/mario')));
  await assertSucceeds(getDoc(doc(db('capo'), 'accounts/mario')));
});
await test('un\'email confermata qualsiasi non è admin', async () => {
  await assertFails(getDoc(doc(db('luca', 'luca@prova.it'), 'admins/probe')));
  await assertSucceeds(getDoc(doc(db('capo'), 'admins/probe')));
});
await test('il titolare è admin solo con l\'email confermata (anche scritta in maiuscolo)', async () => {
  await assertSucceeds(getDoc(doc(db('tit', 'Titolare@Prova.it'), 'admins/probe')));
  await assertFails(getDoc(doc(db('tit2', 'titolare@prova.it', false), 'admins/probe')));
  await assertSucceeds(setDoc(doc(db('tit', 'titolare@prova.it'), 'roles/luca'), { center: true, name: 'Luca' }));
  await assertSucceeds(deleteDoc(doc(db('tit', 'titolare@prova.it'), 'roles/luca')));
});
await test('le impostazioni le legge chiunque e le scrive solo l\'admin', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'data/settings')));
  await assertFails(setDoc(doc(db('mario'), 'data/settings'), { json: '{}' }));
  await assertSucceeds(setDoc(doc(db('capo'), 'data/settings'), { json: '{}', minMinutes: 60 }));
});

// ---------- prenotazioni ----------
const slot = (uid, start) => ({ courtId: 'c1', date: '2030-05-06', start, from: '18:00', to: '19:00', gid: 'g1', userId: uid, blocked: '', first: start === '18:00' });
const busyOf = s => ({ courtId: s.courtId, date: s.date, start: s.start, from: s.from, to: s.to, gid: s.gid });
async function book(f, uid) {
  const b = writeBatch(f);
  ['18:00', '18:30'].forEach(t => { const s = slot(uid, t), id = `2030-05-06_c1_${t}`; b.set(doc(f, 'bookings', id), s); b.set(doc(f, 'busy', id), busyOf(s)); });
  return b.commit();
}
await test('un utente confermato prenota (parte privata + parte pubblica insieme)', async () => {
  await assertSucceeds(book(db('mario'), 'mario'));
});
await test('chi non ha confermato l\'email non prenota', async () => {
  await assertFails(book(db('nuovo', 'nuovo@prova.it', false), 'nuovo'));
});
await test('la mezz\'ora già presa non si sovrascrive', async () => {
  await assertFails(book(db('luca'), 'luca'));
});
await test('libero/occupato è pubblico, il nome no', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'busy/2030-05-06_c1_18:00')));
  await assertFails(getDoc(doc(anon(), 'bookings/2030-05-06_c1_18:00')));
  await assertFails(getDoc(doc(db('luca'), 'bookings/2030-05-06_c1_18:00')));
  await assertSucceeds(getDoc(doc(db('mario'), 'bookings/2030-05-06_c1_18:00')));
  await assertSucceeds(getDoc(doc(db('capo'), 'bookings/2030-05-06_c1_18:00')));
  await assertSucceeds(getDoc(doc(db('cassiere'), 'bookings/2030-05-06_c1_18:00')));
});
await test('il busy pubblico non contiene nomi', async () => {
  await assertFails(setDoc(doc(db('luca'), 'busy/2030-05-07_c1_10:00'), Object.assign(busyOf(slot('luca', '10:00')), { name: 'Luca' })));
});
await test('si cancella solo la propria prenotazione', async () => {
  const del = f => { const b = writeBatch(f); ['18:00', '18:30'].forEach(t => { b.delete(doc(f, 'bookings', `2030-05-06_c1_${t}`)); b.delete(doc(f, 'busy', `2030-05-06_c1_${t}`)); }); return b.commit(); };
  await assertFails(del(db('luca')));
  await assertSucceeds(del(db('mario')));
});
await test('prenotazione più corta della durata minima: rifiutata', async () => {
  const f = db('mario'), b = writeBatch(f), s = Object.assign(slot('mario', '20:00'), { from: '20:00', to: '20:30' }), id = '2030-05-06_c1_20:00';
  b.set(doc(f, 'bookings', id), s); b.set(doc(f, 'busy', id), busyOf(s));
  await assertFails(b.commit());
});

// ---------- ruoli ----------
await test('l\'admin generale nomina un Admin Centro', async () => {
  await assertSucceeds(setDoc(doc(db('capo'), 'roles/luca'), { center: true, name: 'Luca' }));
  await assertSucceeds(deleteDoc(doc(db('capo'), 'roles/luca')));
});
await test('l\'Admin Centro dà la cassa ma non nomina Admin Centro', async () => {
  await assertSucceeds(setDoc(doc(db('centro'), 'roles/luca'), { cash: true, name: 'Luca' }));
  await assertFails(setDoc(doc(db('centro'), 'roles/mario'), { center: true, name: 'Mario' }));
});
await test('l\'Admin Centro non elimina un admin generale', async () => {
  await assertFails(deleteDoc(doc(db('centro'), 'members/capo')));
});
await test('un utente non si dà un ruolo da solo', async () => {
  await assertFails(setDoc(doc(db('mario'), 'roles/mario'), { cash: true }));
});

// ---------- cassa ----------
const inc = by => ({ date: '2030-05-06', method: 'cash', lines: [], total: 10, by, void: false });
await test('la cassa registra un incasso e una ricevuta', async () => {
  await assertSucceeds(setDoc(doc(db('cassiere'), 'incassi/i1'), inc('cassiere')));
  await assertSucceeds(setDoc(doc(db('cassiere'), 'receipts/r1'), { series: 'Q', by: 'cassiere', void: false, uid: 'mario', amount: 10 }));
});
await test('un utente non vede gli incassi e non registra incassi', async () => {
  await assertFails(getDoc(doc(db('mario'), 'incassi/i1')));
  await assertFails(setDoc(doc(db('mario'), 'incassi/i2'), inc('mario')));
});
await test('l\'utente vede solo le proprie ricevute', async () => {
  await assertSucceeds(getDoc(doc(db('mario'), 'receipts/r1')));
  await assertFails(getDoc(doc(db('coach1'), 'receipts/r1')));
});
await test('annullare una ricevuta spetta all\'admin, non alla cassa', async () => {
  await assertFails(updateDoc(doc(db('cassiere'), 'receipts/r1'), { void: true }));
  await assertSucceeds(updateDoc(doc(db('capo'), 'receipts/r1'), { void: true }));
});

// ---------- corsisti e allenamenti ----------
await test('la scheda del corsista la vedono solo l\'interessato e l\'admin', async () => {
  await assertSucceeds(getDoc(doc(db('mario'), 'athletes/mario')));
  await assertSucceeds(getDoc(doc(db('capo'), 'athletes/mario')));
  await assertFails(getDoc(doc(db('luca'), 'athletes/mario')));
  await assertFails(getDoc(doc(db('coach1'), 'athletes/mario')));
});
await test('gli allenamenti sono pubblici e li crea l\'admin', async () => {
  await assertSucceeds(getDocs(collection(anon(), 'trainings')));
  await assertFails(setDoc(doc(db('mario'), 'trainings/t1'), { name: 'Corso' }));
  await assertSucceeds(setDoc(doc(db('capo'), 'trainings/t1'), { name: 'Corso', dow: 1, from: '17:00', to: '18:00', coachUid: 'coach1' }));
});
await test('il coach vede i gruppi dei propri allenamenti, gli altri utenti no', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'groups/t1_2030-05'), { tid: 't1', month: '2030-05', uids: ['mario'], names: { mario: 'Mura Mario' }, coachUid: 'coach1' }));
  await assertSucceeds(getDocs(query(collection(db('coach1'), 'groups'), where('coachUid', '==', 'coach1'))));
  await assertFails(getDoc(doc(db('luca'), 'groups/t1_2030-05')));
});


// ---------- segreteria ----------
await test('la segreteria legge profili ed email, non è admin', async () => {
  await assertSucceeds(getDoc(doc(db('segr'), 'members/mario')));
  await assertSucceeds(getDoc(doc(db('segr'), 'accounts/mario')));
  await assertSucceeds(getDocs(collection(db('segr'), 'roles')));
  await assertFails(getDoc(doc(db('segr'), 'admins/probe')));
});
await test('la segreteria non cambia i ruoli né i campi', async () => {
  await assertFails(setDoc(doc(db('segr'), 'roles/luca'), { cash: true }));
  await assertFails(setDoc(doc(db('segr'), 'roles/segr'), { seg: true, center: true }));
  await assertFails(setDoc(doc(db('segr'), 'data/settings'), { json: '{}', minMinutes: 30 }));
});
await test('la segreteria crea un utente e un allenatore', async () => {
  const f = db('segr'), b = writeBatch(f);
  b.set(doc(f, 'members/nuovo2'), prof); b.set(doc(f, 'accounts/nuovo2'), { email: 'n2@prova.it', verified: false });
  b.set(doc(f, 'verified/nuovo2'), { by: 'segr', at: 1 }); b.set(doc(f, 'coaches/nuovo2'), { all: false, name: 'Nuovo' });
  await assertSucceeds(b.commit());
});
await test('la segreteria modifica ed elimina utenti e allenatori, non admin e cassa', async () => {
  await assertSucceeds(setDoc(doc(db('segr'), 'members/sara'), Object.assign({}, prof, { first: 'Sarina' })));
  await assertFails(setDoc(doc(db('segr'), 'members/luca'), Object.assign({}, prof, { first: 'Luchino' })));   // luca ora è cassa
  await assertFails(setDoc(doc(db('segr'), 'members/cassiere'), Object.assign({}, prof, { first: 'X' })));
  await assertFails(deleteDoc(doc(db('segr'), 'members/capo')));
  await assertFails(deleteDoc(doc(db('segr'), 'members/centro')));
  await assertFails(deleteDoc(doc(db('segr'), 'members/cassiere')));
  await assertSucceeds(deleteDoc(doc(db('segr'), 'members/nuovo2')));
});
await test('la segreteria gestisce corsisti, cassa e prenotazioni di tutti', async () => {
  await assertSucceeds(getDoc(doc(db('segr'), 'athletes/mario')));
  await assertSucceeds(setDoc(doc(db('segr'), 'athletes/mario'), { certExp: '2027-02-01', certType: 'agon' }, { merge: true }));
  await assertSucceeds(setDoc(doc(db('segr'), 'incassi/i9'), inc('segr')));
  await assertSucceeds(updateDoc(doc(db('segr'), 'receipts/r1'), { void: false }));
  const f = db('segr'), b = writeBatch(f);
  ['09:00', '09:30'].forEach(t => { const x = { courtId: 'c1', date: '2030-05-08', start: t, from: '09:00', to: '10:00', gid: 'gs', userId: 'segr', blocked: '', first: t === '09:00', guest: 'Ospite' }; b.set(doc(f, 'bookings', `2030-05-08_c1_${t}`), x); b.set(doc(f, 'busy', `2030-05-08_c1_${t}`), busyOf(x)); });
  await assertSucceeds(b.commit());
});
await test('la cassa non legge le schede dei corsisti', async () => {
  await assertFails(getDoc(doc(db('cassiere'), 'athletes/mario')));
});

// ---------- durata delle prenotazioni: da 1 h a 2 h, a mezz'ore ----------
async function bookRange(uid, date, from, to) {
  const f = db(uid), b = writeBatch(f), gid = 'g' + from.replace(':', '');
  const mm = hm => +hm.slice(0, 2) * 60 + +hm.slice(3), hm = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  for (let x = mm(from); x < mm(to); x += 30) { const t = hm(x), s = { courtId: 'c2', date, start: t, from, to, gid, userId: uid, blocked: '', first: t === from }; b.set(doc(f, 'bookings', `${date}_c2_${t}`), s); b.set(doc(f, 'busy', `${date}_c2_${t}`), busyOf(s)); }
  return b.commit();
}
await test('prenotazione di 1 h 30: ammessa', async () => { await assertSucceeds(bookRange('luca', '2030-05-09', '10:00', '11:30')); });
await test('prenotazione di 2 h: ammessa', async () => { await assertSucceeds(bookRange('mario', '2030-05-10', '10:00', '12:00')); });
await test('prenotazione di 2 h 30: rifiutata', async () => { await assertFails(bookRange('mario', '2030-05-11', '10:00', '12:30')); });
await test('senza minMinutes nelle impostazioni la durata minima è 60 minuti', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'data/settings'), { json: '{}' }));
  await assertFails(bookRange('luca', '2030-05-12', '10:00', '10:30'));
  await assertSucceeds(bookRange('luca', '2030-05-12', '11:00', '12:00'));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'data/settings'), { json: '{}', minMinutes: 60, maxMinutes: 120 }));
});

// ---------- allenatore: presenze e scheda di valutazione ----------
await env.withSecurityRulesDisabled(async c => {
  const f = c.firestore();
  await setDoc(doc(f, 'trainings/t2'), { name: 'Padel', dow: 2, from: '18:00', to: '19:00', coachUid: 'coach2' });
  await setDoc(doc(f, 'groups/t1_2030-05'), { tid: 't1', month: '2030-05', uids: ['mario', 'sara'], names: {}, coachUid: 'coach1' });
});
const att = (uid, st) => ({ tid: 't1', date: '2030-05-06', uid, status: st, at: 1, coachUid: 'coach1', forced: true, by: 'coach1' });
await test('l\'allenatore segna le presenze del suo allenamento', async () => {
  const f = db('coach1'), b = writeBatch(f);
  b.set(doc(f, 'att/t1_2030-05-06_mario'), att('mario', 'in'));
  b.set(doc(f, 'occ/t1_2030-05-06'), { tid: 't1', date: '2030-05-06', p: 1, a: 0, s: 0, cancelled: false });
  await assertSucceeds(b.commit());
});
await test('l\'allenatore non segna presenze di altri allenamenti o di chi non è nel gruppo', async () => {
  await assertFails(setDoc(doc(db('coach2'), 'att/t1_2030-05-06_sara'), Object.assign(att('sara', 'in'), { by: 'coach2' })));
  await assertFails(setDoc(doc(db('coach1'), 'att/t1_2030-05-06_luca'), att('luca', 'in')));
  await assertFails(updateDoc(doc(db('coach1'), 'occ/t1_2030-05-06'), { cancelled: true }));
});
await test('l\'allenatore non vede schede, certificati e pacchetti dei corsisti', async () => {
  await assertFails(getDoc(doc(db('coach1'), 'athletes/mario')));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'packs/k1'), { uid: 'mario', n: 2, used: 0, price: 40, from: '2030-01-01' }));
  await assertFails(getDoc(doc(db('coach1'), 'packs/k1')));
});
const ev = (by, v, extra) => Object.assign({ tid: 't1', date: '2030-05-06', uid: 'mario', coachUid: 'coach1', by, v, note: 'Buon dritto / rovescio in ritardo', at: 1 }, extra || {});
await test('scheda di valutazione: l\'allenatore la scrive con voti interi da 1 a 10', async () => {
  await assertSucceeds(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario'), ev('coach1', { tec: 7, mov: 5, con: 10 })));
  await assertSucceeds(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario'), ev('coach1', {})));   // tutti i voti sono facoltativi
});
await test('scheda di valutazione: voti fuori scala, decimali o voci in più rifiutati', async () => {
  await assertFails(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario'), ev('coach1', { tec: 11 })));
  await assertFails(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario'), ev('coach1', { tec: 0 })));
  await assertFails(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario'), ev('coach1', { tec: 6.5 })));
  await assertFails(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario'), ev('coach1', { servizio: 7 })));
  await assertFails(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario'), ev('coach1', { tec: 7 }, { note: 'x'.repeat(161) })));
});
await test('scheda di valutazione: solo corsisti del gruppo e solo l\'allenatore di quell\'allenamento', async () => {
  await assertFails(setDoc(doc(db('coach1'), 'evals/t1_2030-05-06_luca'), ev('coach1', { tec: 7 }, { uid: 'luca' })));
  await assertFails(setDoc(doc(db('coach2'), 'evals/t1_2030-05-06_sara'), ev('coach2', { tec: 7 }, { uid: 'sara' })));
  await assertFails(setDoc(doc(db('mario'), 'evals/t1_2030-05-06_sara'), ev('mario', { tec: 7 }, { uid: 'sara' })));
  await assertSucceeds(setDoc(doc(db('segr'), 'evals/t1_2030-05-06_sara'), ev('segr', { att: 4 }, { uid: 'sara' })));
});
await test('scheda di valutazione: la leggono admin, segreteria e l\'allenatore, non il corsista', async () => {
  await assertSucceeds(getDoc(doc(db('coach1'), 'evals/t1_2030-05-06_mario')));
  await assertSucceeds(getDocs(query(collection(db('coach1'), 'evals'), where('coachUid', '==', 'coach1'))));
  await assertSucceeds(getDoc(doc(db('capo'), 'evals/t1_2030-05-06_mario')));
  await assertSucceeds(getDoc(doc(db('segr'), 'evals/t1_2030-05-06_mario')));
  await assertFails(getDoc(doc(db('mario'), 'evals/t1_2030-05-06_mario')));
  await assertFails(getDoc(doc(db('coach2'), 'evals/t1_2030-05-06_mario')));
});

// ---------- pacchetti: scalo nell'app (niente Cloud Functions) ----------
const use = by => ({ pack: 'k1', uid: 'mario', tid: 't1', date: '2030-05-06', at: 1, by });
await test('la segreteria scala un pacchetto: packuse e used insieme', async () => {
  const f = db('segr'), b = writeBatch(f);
  b.set(doc(f, 'packuse/t1_2030-05-06_mario'), use('segr')); b.update(doc(f, 'packs/k1'), { used: 1 });
  await assertSucceeds(b.commit());
});
await test('il pacchetto non scende sotto zero lezioni rimaste', async () => {
  await assertFails(updateDoc(doc(db('capo'), 'packs/k1'), { used: 3 }));
  await assertFails(updateDoc(doc(db('capo'), 'packs/k1'), { used: -1 }));
});
await test('allenatore e corsista non scalano i pacchetti', async () => {
  await assertFails(setDoc(doc(db('coach1'), 'packuse/t1_2030-05-07_mario'), Object.assign(use('coach1'), { date: '2030-05-07' })));
  await assertFails(updateDoc(doc(db('mario'), 'packs/k1'), { used: 0 }));
  await assertFails(setDoc(doc(db('mario'), 'packuse/t1_2030-05-07_mario'), Object.assign(use('mario'), { date: '2030-05-07' })));
});
await test('il corsista vede il proprio pacchetto e le lezioni scalate', async () => {
  await assertSucceeds(getDoc(doc(db('mario'), 'packs/k1')));
  await assertSucceeds(getDoc(doc(db('mario'), 'packuse/t1_2030-05-06_mario')));
  await assertFails(getDoc(doc(db('luca'), 'packuse/t1_2030-05-06_mario')));
});

await env.cleanup();
console.log(`prove delle regole: ${n} superate`);
