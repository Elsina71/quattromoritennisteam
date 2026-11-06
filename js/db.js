// Collegamento a Firebase: login, profili, campi, prenotazioni.
// Lo stato vive in S; ogni cambio avvisa la pagina con onChange().
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  getFirestore, connectFirestoreEmulator, doc, collection, query, where, onSnapshot,
  getDoc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, serverTimestamp
} from '../vendor/firebase/firebase-firestore.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, sendEmailVerification, signOut
} from '../vendor/firebase/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';
import { covered, endOf, slotId, isStaffRole, isoDate, fullName } from './logic.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Solo per le prove in locale con l'emulatore Firebase (indirizzo con ?emu=1).
const EMU = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emu=1/.test(location.search);
if (EMU) {
  connectFirestoreEmulator(db, location.hostname, 8080);
  connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
}

// Il titolare è admin per la sua email: nel codice pubblico c'è solo l'impronta SHA-256.
const OWNER_HASH = 'a2de6b81796442dad657da768dcb08f740fe60afdbdb368e2f9a1604238913c1';
async function isOwnerEmail(u) {
  if (!u || !u.email || !u.emailVerified || !crypto.subtle) return false;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u.email.toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('') === OWNER_HASH;
}

export const S = {
  authReady: false,     // si sa se c'è qualcuno collegato
  user: null,           // utente Firebase
  profile: null,        // users/{uid}
  owner: false,
  courts: [], courtsReady: false,
  date: isoDate(),
  slots: [], slotsReady: false, slotsError: null,
  dayBookings: [],      // staff: prenotazioni del giorno con i nomi
  myBookings: [],       // le mie prenotazioni
  users: [], usersReady: false
};

const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
let raf = 0;
function emit() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; listeners.forEach(f => f()); });
}

export const role = () => (S.owner ? 'admin' : (S.profile && S.profile.role) || (S.user ? 'utente' : ''));
export const isStaff = () => isStaffRole(role());
export const isAdmin = () => role() === 'admin';

// ---------- ascolti ----------
const subs = {};
function listen(key, ref, onData, onError) {
  if (subs[key]) subs[key]();
  subs[key] = onSnapshot(ref, snap => { onData(snap); emit(); }, err => {
    console.warn(key, err.code || err);
    if (onError) onError(err);
    emit();
  });
}
function stop(key) { if (subs[key]) { subs[key](); delete subs[key]; } }
const rows = snap => snap.docs.map(d => Object.assign({ id: d.id }, d.data()));

listen('courts', collection(db, 'courts'), snap => {
  S.courts = rows(snap)
    .map(c => Object.assign({ from: '08:00', to: '23:00', type: 'tennis', active: true, order: 0 }, c))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  S.courtsReady = true;
}, () => { S.courtsReady = true; });

function listenDay() {
  S.slotsReady = false; S.slotsError = null;
  listen('slots', query(collection(db, 'slots'), where('date', '==', S.date)), snap => {
    S.slots = rows(snap); S.slotsReady = true; S.slotsError = null;
  }, err => { S.slotsReady = true; S.slotsError = err.code || 'error'; });
  if (isStaff()) {
    listen('day', query(collection(db, 'bookings'), where('date', '==', S.date)), snap => { S.dayBookings = rows(snap); });
  } else { stop('day'); S.dayBookings = []; }
}

export function setDate(iso) {
  if (iso === S.date) return;
  S.date = iso; S.slots = []; S.dayBookings = [];
  listenDay(); emit();
}

function listenSignedIn() {
  const uid = S.user.uid;
  listen('mine', query(collection(db, 'bookings'), where('uid', '==', uid)), snap => { S.myBookings = rows(snap); });
  if (isStaff()) {
    listen('users', collection(db, 'users'), snap => {
      S.users = rows(snap).sort((a, b) => fullName(a).localeCompare(fullName(b), 'it'));
      S.usersReady = true;
    }, () => { S.usersReady = true; });
  } else { stop('users'); S.users = []; S.usersReady = false; }
  listenDay();
}

// Dati scritti nel modulo di registrazione, usati per il profilo appena l'account esiste
let pendingProfile = null;

onAuthStateChanged(auth, async u => {
  ['me', 'mine', 'users', 'day'].forEach(stop);
  S.user = u; S.profile = null; S.myBookings = []; S.users = []; S.dayBookings = [];
  S.owner = await isOwnerEmail(u);
  if (!u) { S.authReady = true; listenDay(); emit(); return; }
  const ref = doc(db, 'users', u.uid);
  let first = true;
  listen('me', ref, async snap => {
    if (!snap.exists()) {
      if (!first) { S.profile = null; return; }   // profilo cancellato dallo staff mentre si è collegati
      first = false;
      await createProfile(u);
      return;
    }
    first = false;
    const before = role();
    S.profile = Object.assign({ id: snap.id }, snap.data());
    S.authReady = true;
    if (role() !== before || !subs.mine) listenSignedIn();
  }, () => { S.authReady = true; });
});

async function createProfile(u) {
  const p = pendingProfile || {};
  const parts = (u.displayName || '').trim().split(/\s+/);
  const data = {
    first: (p.first || parts[0] || (u.email || '').split('@')[0] || 'Utente').slice(0, 40),
    last: (p.last || parts.slice(1).join(' ') || '').slice(0, 40),
    phone: (p.phone || '').slice(0, 30),
    email: u.email || '',
    role: S.owner ? 'admin' : 'utente',
    lang: p.lang === 'en' ? 'en' : 'it',
    createdAt: serverTimestamp()
  };
  pendingProfile = null;
  try { await setDoc(doc(db, 'users', u.uid), data); }
  catch (e) { console.warn('profilo', e.code || e); S.authReady = true; emit(); }
}

// ---------- accesso ----------
export const login = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);
export async function register(d) {
  pendingProfile = { first: d.first.trim(), last: d.last.trim(), phone: (d.phone || '').trim(), lang: d.lang };
  const cred = await createUserWithEmailAndPassword(auth, d.email.trim(), d.password);
  try { await sendEmailVerification(cred.user); } catch (e) { /* non blocca la registrazione */ }
  return cred;
}
export const loginGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const resetPassword = email => sendPasswordResetEmail(auth, email.trim());
export const logout = () => signOut(auth);

// ---------- profilo e utenti ----------
export const saveMyProfile = d => updateDoc(doc(db, 'users', S.user.uid), d);
export const saveUser = (uid, d) => updateDoc(doc(db, 'users', uid), d);

// Cancella il profilo e le sue prenotazioni future. L'account di accesso resta in Firebase Authentication.
export async function deleteUser(uid) {
  const today = isoDate();
  const snap = await getDocs(query(collection(db, 'bookings'), where('uid', '==', uid)));
  for (const d of snap.docs) if (d.data().date >= today) await cancelBooking(Object.assign({ id: d.id }, d.data()));
  await deleteDoc(doc(db, 'users', uid));
}

// ---------- campi ----------
export function saveCourt(id, d) {
  const data = { name: d.name.trim(), type: d.type, from: d.from, to: d.to, active: !!d.active, order: d.order | 0 };
  return setDoc(id ? doc(db, 'courts', id) : doc(collection(db, 'courts')), data);
}
export const deleteCourt = id => deleteDoc(doc(db, 'courts', id));

// ---------- prenotazioni ----------
// Una sola scrittura: la prenotazione e le sue mezz'ore. Se una mezz'ora è già presa, fallisce tutto.
export async function book({ court, date, start, dur, uid, name }) {
  const ref = doc(collection(db, 'bookings'));
  const half = covered(start, dur);
  const b = writeBatch(db);
  b.set(ref, {
    courtId: court.id, date, start, end: endOf(start, dur), last: half[half.length - 1], dur,
    uid: uid || null, name: name.trim().slice(0, 80), createdBy: S.user.uid, createdAt: serverTimestamp()
  });
  half.forEach(t => b.set(doc(db, 'slots', slotId(court.id, date, t)), { courtId: court.id, date, time: t, bookingId: ref.id }));
  await b.commit();
  return ref.id;
}

export async function cancelBooking(bk) {
  const b = writeBatch(db);
  covered(bk.start, bk.dur).forEach(t => b.delete(doc(db, 'slots', slotId(bk.courtId, bk.date, t))));
  b.delete(doc(db, 'bookings', bk.id));
  await b.commit();
}

// Prenotazione di una mezz'ora (staff: dal giorno; utente: le sue)
export function bookingOf(slot) {
  if (!slot) return null;
  return S.dayBookings.find(b => b.id === slot.bookingId) || S.myBookings.find(b => b.id === slot.bookingId) || null;
}

export const getProfile = async uid => { const s = await getDoc(doc(db, 'users', uid)); return s.exists() ? s.data() : null; };
export const emulator = EMU;
