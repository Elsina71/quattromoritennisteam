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
const env = await initializeTestEnvironment({
  projectId: 'demo-quattromori',
  firestore: { rules: rulesText.split(OWNER_HASH).join(testHash), host: '127.0.0.1', port: 8080 }
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
  for (const uid of ['mario', 'luca', 'cassiere', 'coach1', 'centro', 'capo']) await setDoc(doc(f, 'members', uid), Object.assign({}, prof, { first: uid }));
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

await env.cleanup();
console.log(`prove delle regole: ${n} superate`);
