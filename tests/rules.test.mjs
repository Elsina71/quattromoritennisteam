// Prove delle regole del database con l'emulatore Firebase.
// Avvio: npx firebase emulators:exec --only firestore "node tests/rules.test.mjs"
// (servono firebase-tools, @firebase/rules-unit-testing e firebase installati).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, collection, query, where } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-quattromori',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') }
});

const OWNER = { email: 'pierpaolomurgioni@gmail.com', email_verified: true };
const ctx = (uid, tok = {}) => env.authenticatedContext(uid, Object.assign({ email: uid + '@esempio.it', email_verified: true }, tok)).firestore();
const anon = () => env.unauthenticatedContext().firestore();

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, 'courts/c1'), { name: 'Centrale', type: 'tennis', from: '08:00', to: '23:00', active: true, order: 0 });
    for (const [uid, role] of [['seg', 'segreteria'], ['coach', 'allenatore'], ['anna', 'utente'], ['bruno', 'utente'], ['adm', 'admin']]) {
      await setDoc(doc(db, 'users', uid), { first: uid, last: 'X', phone: '', email: uid + '@esempio.it', role, lang: 'it' });
    }
  });
}

function booking(db, { id, uid, start = '17:30', dur = 90, slots, name = 'Anna X', by }) {
  const half = []; const [h, m] = start.split(':').map(Number);
  for (let x = h * 60 + m; x < h * 60 + m + dur; x += 30) half.push(String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'));
  const endM = h * 60 + m + dur; const end = String(Math.floor(endM / 60)).padStart(2, '0') + ':' + String(endM % 60).padStart(2, '0');
  const b = writeBatch(db);
  b.set(doc(db, 'bookings', id), { courtId: 'c1', date: '2026-11-12', start, end, last: half[half.length - 1], dur, uid, name, createdBy: by || uid });
  (slots || half).forEach(t => b.set(doc(db, 'slots', 'c1_2026-11-12_' + t.replace(':', '')), { courtId: 'c1', date: '2026-11-12', time: t, bookingId: id }));
  return b.commit();
}

let n = 0;
async function test(name, fn) { await seed(); try { await fn(); n++; } catch (e) { console.error('FALLITA:', name); throw e; } }

await test('registrazione: utente sì, admin no, titolare admin sì', async () => {
  const p = { first: 'Nuovo', last: 'Socio', phone: '', role: 'utente', lang: 'it' };
  await assertSucceeds(setDoc(doc(ctx('n1'), 'users/n1'), Object.assign({ email: 'n1@esempio.it' }, p)));
  await assertFails(setDoc(doc(ctx('n2'), 'users/n2'), Object.assign({ email: 'n2@esempio.it' }, p, { role: 'admin' })));
  await assertFails(setDoc(doc(ctx('n3'), 'users/n4'), Object.assign({ email: 'n3@esempio.it' }, p)));
  await assertSucceeds(setDoc(doc(ctx('own', OWNER), 'users/own'), Object.assign({ email: OWNER.email }, p, { role: 'admin' })));
  await assertFails(setDoc(doc(ctx('own2', { email: OWNER.email, email_verified: false }), 'users/own2'), Object.assign({ email: OWNER.email }, p, { role: 'admin' })));
});

await test('profili: privacy e ruoli', async () => {
  await assertSucceeds(getDoc(doc(ctx('anna'), 'users/anna')));
  await assertFails(getDoc(doc(ctx('anna'), 'users/bruno')));
  await assertFails(getDocs(collection(ctx('coach'), 'users')));
  await assertFails(getDocs(collection(anon(), 'users')));
  await assertSucceeds(getDocs(collection(ctx('seg'), 'users')));
  await assertSucceeds(updateDoc(doc(ctx('anna'), 'users/anna'), { phone: '333' }));
  await assertFails(updateDoc(doc(ctx('anna'), 'users/anna'), { role: 'admin' }));
  await assertSucceeds(updateDoc(doc(ctx('seg'), 'users/anna'), { first: 'Annalisa' }));
  await assertFails(updateDoc(doc(ctx('seg'), 'users/anna'), { role: 'allenatore' }));
  await assertFails(updateDoc(doc(ctx('seg'), 'users/adm'), { first: 'Y' }));
  await assertSucceeds(updateDoc(doc(ctx('adm'), 'users/anna'), { role: 'allenatore' }));
  await assertSucceeds(updateDoc(doc(ctx('own', OWNER), 'users/bruno'), { role: 'segreteria' }));
  await assertFails(deleteDoc(doc(ctx('seg'), 'users/adm')));
  await assertSucceeds(deleteDoc(doc(ctx('seg'), 'users/coach')));
  await assertFails(deleteDoc(doc(ctx('anna'), 'users/bruno')));
});

await test('campi: pubblici, li cambia solo l\'admin', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'courts/c1')));
  const c = { name: 'Padel 1', type: 'padel', from: '09:00', to: '22:00', active: true, order: 1 };
  await assertFails(setDoc(doc(ctx('seg'), 'courts/c2'), c));
  await assertSucceeds(setDoc(doc(ctx('adm'), 'courts/c2'), c));
  await assertFails(setDoc(doc(ctx('adm'), 'courts/c3'), Object.assign({}, c, { from: '22:00', to: '09:00' })));
  await assertFails(setDoc(doc(ctx('adm'), 'courts/c3'), Object.assign({}, c, { type: 'calcetto' })));
});

await test('prenotazione: l\'utente per sé, niente sovrapposizioni', async () => {
  await assertSucceeds(booking(ctx('anna'), { id: 'b1', uid: 'anna' }));
  await assertFails(booking(ctx('bruno'), { id: 'b2', uid: 'bruno', start: '18:00', dur: 60 }));     // tocca le 18:00 di Anna
  await assertSucceeds(booking(ctx('bruno'), { id: 'b3', uid: 'bruno', start: '19:00', dur: 60 }));  // subito dopo: va bene
  await assertFails(booking(ctx('bruno'), { id: 'b4', uid: 'anna', start: '10:00', dur: 60 }));      // non per un altro
  await assertFails(booking(ctx('bruno'), { id: 'b5', uid: 'bruno', start: '11:00', dur: 60, slots: [] }));  // senza mezz'ore
  await assertFails(booking(ctx('bruno'), { id: 'b6', uid: 'bruno', start: '12:00', dur: 45 }));     // durata non ammessa
  await assertFails(booking(anon(), { id: 'b7', uid: null, start: '13:00', dur: 60, by: 'x' }));
});

await test('prenotazione: lo staff per chi non è registrato', async () => {
  await assertSucceeds(booking(ctx('seg'), { id: 'g1', uid: null, name: 'Marco Pinna', start: '09:00', dur: 120, by: 'seg' }));
  await assertSucceeds(booking(ctx('seg'), { id: 'g2', uid: 'anna', start: '15:00', dur: 60, by: 'seg' }));
  await assertFails(booking(ctx('coach'), { id: 'g3', uid: null, name: 'Ospite', start: '20:00', dur: 60, by: 'coach' }));
});

await test('privacy: i nomi solo allo staff e a chi ha prenotato', async () => {
  await booking(ctx('anna'), { id: 'b1', uid: 'anna' });
  await assertSucceeds(getDocs(query(collection(anon(), 'slots'), where('date', '==', '2026-11-12'))));
  await assertFails(getDoc(doc(ctx('bruno'), 'bookings/b1')));
  await assertFails(getDocs(query(collection(ctx('bruno'), 'bookings'), where('date', '==', '2026-11-12'))));
  await assertSucceeds(getDocs(query(collection(ctx('anna'), 'bookings'), where('uid', '==', 'anna'))));
  await assertSucceeds(getDocs(query(collection(ctx('seg'), 'bookings'), where('date', '==', '2026-11-12'))));
  const s = await getDoc(doc(anon(), 'slots/c1_2026-11-12_1730'));
  assert.deepEqual(Object.keys(s.data()).sort(), ['bookingId', 'courtId', 'date', 'time']);
});

await test('cancellazione: chi ha prenotato o lo staff', async () => {
  await booking(ctx('anna'), { id: 'b1', uid: 'anna' });
  const del = db => { const b = writeBatch(db); ['1730', '1800', '1830'].forEach(t => b.delete(doc(db, 'slots', 'c1_2026-11-12_' + t))); b.delete(doc(db, 'bookings/b1')); return b.commit(); };
  await assertFails(del(ctx('bruno')));
  await assertFails(setDoc(doc(ctx('bruno'), 'slots/c1_2026-11-12_1730'), { courtId: 'c1', date: '2026-11-12', time: '17:30', bookingId: 'b1' }));
  await assertSucceeds(del(ctx('anna')));
  await booking(ctx('anna'), { id: 'b1', uid: 'anna' });
  await assertSucceeds(del(ctx('seg')));
});

function training(db, { id, coachId = 'coach', start = '16:00', dur = 90, athleteIds = ['a1', 'a2'], by = 'seg', slots }) {
  const half = []; const [h, m] = start.split(':').map(Number);
  for (let x = h * 60 + m; x < h * 60 + m + dur; x += 30) half.push(String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'));
  const endM = h * 60 + m + dur; const end = String(Math.floor(endM / 60)).padStart(2, '0') + ':' + String(endM % 60).padStart(2, '0');
  const b = writeBatch(db);
  b.set(doc(db, 'trainings', id), { title: 'Under 12', courtId: 'c1', date: '2026-11-12', start, end, last: half[half.length - 1], dur,
    coachId, coachName: 'Coach X', athleteIds, names: { a1: 'Anna', a2: 'Bea' }, series: '', notes: '', createdBy: by });
  (slots || half).forEach(t => b.set(doc(db, 'slots', 'c1_2026-11-12_' + t.replace(':', '')), { courtId: 'c1', date: '2026-11-12', time: t, trainingId: id }));
  return b.commit();
}
const evalDoc = (tid, aid, scores, by = 'coach') => ({ trainingId: tid, athleteId: aid, athleteName: 'Anna', date: '2026-11-12', title: 'Under 12', coachId: 'coach', scores, note: 'Buon dritto', by });

await test('corsisti: solo staff', async () => {
  const a = { first: 'Anna', last: 'Pala', birth: '2014-05-02', phone: '', email: '', parent: 'Mario Pala', notes: '',
    certType: 'agonistico', certExpiry: '2027-01-10', fitpPaid: true, fitpYear: 2026, active: true };
  await assertSucceeds(setDoc(doc(ctx('seg'), 'athletes/a1'), a));
  await assertFails(setDoc(doc(ctx('coach'), 'athletes/a2'), a));
  await assertFails(getDoc(doc(ctx('coach'), 'athletes/a1')));
  await assertFails(getDoc(doc(ctx('anna'), 'athletes/a1')));
  await assertFails(setDoc(doc(ctx('seg'), 'athletes/a3'), Object.assign({}, a, { certType: 'sì' })));
});

await test('allenamenti: lo staff li crea, occupano il campo, l\'allenatore vede i suoi', async () => {
  await assertSucceeds(training(ctx('seg'), { id: 't1' }));
  await assertFails(booking(ctx('anna'), { id: 'b1', uid: 'anna', start: '17:00', dur: 60 }));   // campo occupato dall'allenamento
  await assertFails(training(ctx('coach'), { id: 't2', start: '10:00', by: 'coach' }));
  await assertFails(training(ctx('seg'), { id: 't3', start: '11:00', slots: [] }));
  await assertSucceeds(getDoc(doc(ctx('coach'), 'trainings/t1')));
  await assertSucceeds(getDocs(query(collection(ctx('coach'), 'trainings'), where('coachId', '==', 'coach'))));
  await assertFails(getDoc(doc(ctx('anna'), 'trainings/t1')));
  await assertSucceeds(updateDoc(doc(ctx('seg'), 'trainings/t1'), { athleteIds: ['a1'], names: { a1: 'Anna' } }));
  await assertFails(updateDoc(doc(ctx('seg'), 'trainings/t1'), { start: '17:00' }));
  await assertFails(updateDoc(doc(ctx('coach'), 'trainings/t1'), { title: 'Altro' }));
  const s = await getDoc(doc(anon(), 'slots/c1_2026-11-12_1600'));
  assert.deepEqual(Object.keys(s.data()).sort(), ['courtId', 'date', 'time', 'trainingId']);
  await assertFails(deleteDoc(doc(ctx('anna'), 'slots/c1_2026-11-12_1600')));
});

await test('valutazioni: l\'allenatore del suo allenamento, voti da 1 a 10', async () => {
  await training(ctx('seg'), { id: 't1' });
  await assertSucceeds(setDoc(doc(ctx('coach'), 'evals/t1_a1'), evalDoc('t1', 'a1', { tecnica: 7, consistenza: 5 })));
  await assertFails(setDoc(doc(ctx('coach'), 'evals/t1_a1'), evalDoc('t1', 'a1', { tecnica: 11 })));
  await assertFails(setDoc(doc(ctx('coach'), 'evals/t1_a1'), evalDoc('t1', 'a1', { tecnica: 6.5 })));
  await assertFails(setDoc(doc(ctx('coach'), 'evals/t1_a1'), evalDoc('t1', 'a1', { velocita: 6 })));
  await assertFails(setDoc(doc(ctx('coach'), 'evals/t1_a9'), Object.assign(evalDoc('t1', 'a9', { tecnica: 6 }))));   // non iscritto
  await assertFails(setDoc(doc(ctx('anna'), 'evals/t1_a2'), evalDoc('t1', 'a2', { tecnica: 6 }, 'anna')));
  await assertSucceeds(setDoc(doc(ctx('seg'), 'evals/t1_a2'), evalDoc('t1', 'a2', { tecnica: 6 }, 'seg')));
  await assertSucceeds(getDocs(query(collection(ctx('coach'), 'evals'), where('trainingId', '==', 't1'), where('coachId', '==', 'coach'))));
  await assertFails(getDoc(doc(ctx('anna'), 'evals/t1_a1')));
});

await env.cleanup();
console.log(`ok, ${n} gruppi di prove sulle regole superati`);
