// Collegamento a Firebase: database condiviso, login degli utenti e degli amministratori.
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, onSnapshot, writeBatch, getDoc, getDocs, setDoc, addDoc, deleteDoc, query, where, connectFirestoreEmulator, arrayUnion, getCountFromServer, updateDoc, runTransaction, deleteField
} from '../vendor/firebase/firebase-firestore.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, connectAuthEmulator,
  createUserWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup
} from '../vendor/firebase/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
let db;
try {
  // Cache locale: l'app funziona anche con connessione debole e invia le modifiche appena torna la rete.
  // Si salva nel browser solo con il consenso alle preferenze; altrimenti resta in memoria durante la visita.
  if (!(window.Consent && Consent.prefs())) throw new Error('no-consent');
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}
const auth = getAuth(app);
// Solo per le prove in locale con l'emulatore Firebase (localStorage "pcm-emulator" = "1";
// si accende aprendo l'app su localhost con ?emu=1 e si spegne con ?emu=0).
// Porte diverse da quelle di serie (8080 e 9099): ?emu=1&fs=8180&au=9199 (restano salvate finché non si apre ?emu=0).
const emuPort = (k, def) => { try { return Number(localStorage.getItem('pcm-emu-' + k)) || def; } catch (e) { return def; } };
try {
  const qs = new URLSearchParams(location.search), emu = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && qs.get('emu');
  if (emu === '1') {
    localStorage.setItem('pcm-emulator', '1');
    ['fs', 'au'].forEach(k => { if (/^\d{2,5}$/.test(qs.get(k) || '')) localStorage.setItem('pcm-emu-' + k, qs.get(k)); });
  } else if (emu === '0') ['pcm-emulator', 'pcm-emu-fs', 'pcm-emu-au'].forEach(k => localStorage.removeItem(k));
} catch (e) { /* ignore */ }
try {
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('pcm-emulator') === '1') {
    connectFirestoreEmulator(db, location.hostname, emuPort('fs', 8080));
    connectAuthEmulator(auth, `http://${location.hostname}:${emuPort('au', 9099)}`, { disableWarnings: true });
  }
} catch (e) { /* ignore */ }

// Ultimo contenuto noto delle impostazioni, per scrivere solo ciò che cambia.
const last = { settings: null };
let user = null, isGeneral = false, isAdmin = false, isSeg = false, member = null, coach = null, adminMember = null;
// Admin generale riconosciuto dall'email: nel codice pubblico c'è solo l'impronta SHA-256, non l'email.
// È il titolare dell'app (lo stesso controllo è nelle regole del database).
const GENERAL_HASHES = ['a2de6b81796442dad657da768dcb08f740fe60afdbdb368e2f9a1604238913c1'];
async function emailHash(e) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(e || '').trim().toLowerCase()));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (err) { return ''; }
}
let generalUids = [];
let roles = {};   // ruoli dati dagli admin: { center: Admin, seg: segreteria, cash: cassa }
// Admin (roles.center): per le regole del database è un admin (tutti i permessi tranne quelli riservati all'admin generale).
// In questo caso passa già da adminCheck, quindi isCenter() resta falso: serve solo per un ruolo non ancora caricato.
const isCenter = () => !isAdmin && !!roles.center;
// STAFF: admin e segreteria. La segreteria gestisce utenti, prenotazioni di tutti, corsisti, allenamenti, pagamenti e cassa;
// non cambia i ruoli e non gestisce i campi né le regole di prenotazione (solo l'admin).
const staff = () => isAdmin || isSeg;

const refresh = () => { if (window.App) window.App.refresh(); if (staff()) { schedulePackSync(); schedulePcSync(); } };

// L'app è pronta appena arrivano le impostazioni (campi, orari, listino).
function markLoaded() {
  Store.setReady();
  refresh();
}

function onError(err) {
  console.error(err);
  if (window.App) window.App.error(err.code || err.message);
}
onSnapshot(doc(db, 'data', 'settings'), snap => {
  if (snap.exists()) {
    const json = snap.data().json;
    if (json !== last.settings) {
      last.settings = json;
      Store.applyRemote('settings', JSON.parse(json));
    }
  }
  markLoaded();
}, onError);

// Spazi editoriali della prima pagina: data/editorial1 e data/editorial2 (foto, titolo, testo).
['editorial1', 'editorial2'].forEach((id, i) => onSnapshot(doc(db, 'data', id), snap => {
  Store.applyRemote('editorial', { i, data: snap.exists() ? snap.data() : null });
  refresh();
}, onError));

function saveEditorial(i, data) {
  const ref = doc(db, 'data', 'editorial' + (i + 1));
  return data ? setDoc(ref, Object.assign({}, data, { updated: Date.now() })) : deleteDoc(ref);
}
// Ruoli (admin): elenco di chi è Admin Centro o cassa; assegnazione e revoca.
let rolesUnsub = null;
function listenRoles() {
  if (rolesUnsub) { rolesUnsub(); rolesUnsub = null; }
  Store.applyRemote('roles', {});
  if (!staff()) return;
  rolesUnsub = onSnapshot(collection(db, 'roles'), snap => {
    Store.applyRemote('roles', Object.fromEntries(snap.docs.map(d => [d.id, d.data()])));
    refresh();
  }, onError);
}
function setRole(uid, role, on, name) {
  return setDoc(doc(db, 'roles', uid), { [role]: !!on, name: name || '', updated: Date.now(), by: user.uid }, { merge: true });
}
// Ruolo unico scelto dal menu della pagina Utenti: 'user', 'coach', 'seg', 'cash', 'admin' (= roles.center).
// L'allenatore è in coaches/{uid}; gli altri ruoli in roles/{uid}. Un invio solo, tutto o niente.
function roleFlags(role) { return { center: role === 'admin', seg: role === 'seg', cash: role === 'cash' }; }
function setUserRole(uid, role, name, wasCoach) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'roles', uid), Object.assign(roleFlags(role), { name: name || '', updated: Date.now(), by: user.uid }));
  if (role === 'coach' && !wasCoach) batch.set(doc(db, 'coaches', uid), { all: false, name: name || '' });
  if (role !== 'coach' && wasCoach) batch.delete(doc(db, 'coaches', uid));
  return batch.commit();
}

// Admin: solo le regole del database lo sanno (admins/probe è leggibile soltanto da un admin).
async function adminCheck() {
  try { await getDoc(doc(db, 'admins', 'probe')); return true; } catch (e) { return false; }
}
let authBusy = true;   // profilo e ruoli in caricamento dopo l'accesso
onAuthStateChanged(auth, async u => {
  authBusy = true;
  user = u;
  isAdmin = false;
  isSeg = false;
  roles = {};
  coach = null;
  adminMember = null;
  member = null;
  if (u) {
    // email appena confermata: il token di accesso può avere ancora "non confermata" (le regole leggono quello)
    try { if (u.emailVerified && !(await u.getIdTokenResult()).claims.email_verified) await u.getIdToken(true); } catch (e) { /* offline */ }
    isAdmin = await adminCheck();   // anche l'Admin Centro (roles/{uid}.center)
    // admin generale: il titolare (impronta dell'email confermata) o chi è nella raccolta "admins"; l'Admin Centro no
    isGeneral = false;
    if (isAdmin) {
      const h = await emailHash(u.email);
      if (u.emailVerified && GENERAL_HASHES.includes(h)) isGeneral = true;
      else { try { isGeneral = (await getDoc(doc(db, 'admins', u.uid))).exists(); } catch (e) { isGeneral = false; } }
      if (!isGeneral) { try { roles = (await getDoc(doc(db, 'roles', u.uid))).data() || {}; } catch (e) { roles = {}; } }
      // admin generale: lo si segna anche in roles (general) così la pagina Utenti lo mostra a tutto lo staff
      // (la raccolta "admins" non si può elencare). Serve solo come etichetta: i permessi li decidono le regole.
      else getDoc(doc(db, 'roles', u.uid)).then(r => { if (!(r.exists() && r.data().general)) return setDoc(doc(db, 'roles', u.uid), { general: true, updated: Date.now() }, { merge: true }); }).catch(() => {});
    }
    if (!isAdmin) { try { const r = await getDoc(doc(db, 'roles', u.uid)); roles = r.exists() ? r.data() : {}; } catch (e) { roles = {}; } }
    isSeg = !isAdmin && !!roles.seg;
    // Admin o segreteria che è anche corsista o coach: la sua scheda utente, se esiste.
    if (staff()) {
      try { const m = await getDoc(doc(db, 'members', u.uid)); adminMember = m.exists() ? Object.assign({ uid: u.uid, email: u.email || '' }, m.data()) : null; } catch (e) { adminMember = null; }
    } else {
      // Utente registrato: profilo in members/{uid}.
      try {
        const m = await getDoc(doc(db, 'members', u.uid));
        member = m.exists() ? Object.assign({ uid: u.uid, email: u.email || '' }, m.data()) : null;
        // Coach: utente registrato indicato dall'admin (coaches/{uid}: all = vede tutti gli allenamenti).
        if (member) { try { const c = await getDoc(doc(db, 'coaches', u.uid)); coach = c.exists() ? c.data() : null; } catch (e) { coach = null; } }
        // email dell'account (visibile solo all'utente e all'admin): si riscrive solo se cambia
        if (member && u.email) {
          const v = `${u.uid}|${u.email.toLowerCase()}|${!!u.emailVerified}`;
          let prev = '';
          try { prev = localStorage.getItem('qm-acc') || ''; } catch (e) { /* ignore */ }
          if (prev !== v) setDoc(doc(db, 'accounts', u.uid), { email: u.email.toLowerCase(), verified: !!u.emailVerified })
            .then(() => { try { localStorage.setItem('qm-acc', v); } catch (e) { /* ignore */ } }).catch(() => {});
        }
      } catch (e) { member = null; }
    }
  }
  listenRoles();
  listenAccount();
  listenBookings();
  listenVerified();
  listenTraining();
  listenAttendance();
  listenOccFree();
  listenBkPlayers();
  listenReceipts();
  authBusy = false;
  refresh();
});

// ---------- utenti registrati e messaggi ----------
// members/{uid}: nome, cognome, sesso (lo legge solo l'admin; gli altri usano l'elenco ridotto dir/members).
// messages/{id}: messaggi dell'admin; ognuno legge solo quelli a lui destinati (regole del database).
// inbox/{uid}: messaggi già letti dall'utente.
let memUnsub = null, accUnsub = null, msgUnsubs = [], inboxUnsub = null, banUnsub = null, noteUnsubs = [];
const msgParts = {};
function listenAccount() {
  if (memUnsub) { memUnsub(); memUnsub = null; }
  if (accUnsub) { accUnsub(); accUnsub = null; }
  Store.applyRemote('accounts', {});
  msgUnsubs.forEach(f => f()); msgUnsubs = [];
  if (inboxUnsub) { inboxUnsub(); inboxUnsub = null; }
  if (banUnsub) { banUnsub(); banUnsub = null; }
  noteUnsubs.forEach(f => f()); noteUnsubs = [];
  Store.applyRemote('bans', {});
  Store.applyRemote('notices', []);
  Object.keys(msgParts).forEach(k => delete msgParts[k]);
  Store.applyRemote('members', []);
  Store.applyRemote('messages', []);
  Store.applyRemote('inbox', []);
  if (!user || !(staff() || member || adminMember)) return;
  if (staff()) {
    memUnsub = onSnapshot(collection(db, 'members'), snap => {
      Store.applyRemote('members', snap.docs.map(d => Object.assign({ uid: d.id }, d.data())));
      syncDir();
      refresh();
    }, onError);
  } else {
    memUnsub = onSnapshot(doc(db, 'dir', 'members'), snap => {
      dirData = snap.exists() ? snap.data() : {};
      Store.applyRemote('members', Object.entries(dirData).map(([uid, e]) => ({ uid, first: e.f, last: e.l, gender: e.g })));
      syncMyDir();
      refresh();
    }, onError);
  }
  // Solo l'admin e la segreteria vedono le email di tutti gli account.
  if (staff()) {
    accUnsub = onSnapshot(collection(db, 'accounts'), snap => {
      const map = {}, ver = {};
      snap.docs.forEach(d => { map[d.id] = d.data().email || ''; ver[d.id] = !!d.data().verified; });
      // admin generali tra gli account (confronto per impronta dell'email)
      Promise.all(Object.entries(map).map(async ([id, e]) => (GENERAL_HASHES.includes(await emailHash(e)) ? id : null)))
        .then(ids => { generalUids = ids.filter(Boolean); refresh(); });
      Store.applyRemote('accounts', map);
      Store.applyRemote('emailVerified', ver);
      refresh();
    }, onError);
  }
  const merge = () => {
    const all = {};
    Object.values(msgParts).forEach(list => list.forEach(m => { all[m.id] = m; }));
    Store.applyRemote('messages', Object.values(all).sort((a, b) => b.created - a.created));
    refresh();
  };
  const sources = isAdmin ? { all: collection(db, 'messages') }
    : { mine: query(collection(db, 'messages'), where('to', 'array-contains', user.uid)), every: query(collection(db, 'messages'), where('all', '==', true)) };
  Object.entries(sources).forEach(([k, src]) => msgUnsubs.push(onSnapshot(src, snap => {
    msgParts[k] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    merge();
  }, onError)));
  if (member || staff()) {
    inboxUnsub = onSnapshot(doc(db, 'inbox', user.uid), snap => {
      Store.applyRemote('inbox', snap.exists() ? snap.data().read || [] : []);
      refresh();
    }, onError);
  }
  // Lista nera: l'admin (e la segreteria) vede tutti i blocchi, l'utente solo il proprio.
  const banSrc = staff() ? collection(db, 'bans') : doc(db, 'bans', user.uid);
  banUnsub = onSnapshot(banSrc, snap => {
    const map = {};
    if (staff()) snap.docs.forEach(d => { map[d.id] = d.data(); });
    else if (snap.exists()) map[user.uid] = snap.data();
    Store.applyRemote('bans', map);
    refresh();
  }, onError);
  // Avvisi delle prenotazioni (modificate o cancellate): all'utente i suoi, all'admin quelli per "admins".
  const noteParts = {};
  // l'admin vede sia gli avvisi per gli admin sia i propri (es. se gioca anche lui)
  const notes = Object.assign(staff() ? { a: query(collection(db, 'notices'), where('to', '==', 'admins')) } : {}, { u: query(collection(db, 'notices'), where('to', '==', user.uid)) });
  Object.entries(notes).forEach(([k, src]) => noteUnsubs.push(onSnapshot(src, snap => {
    noteParts[k] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    Store.applyRemote('notices', Object.values(noteParts).flat().sort((a, b) => (b.at || 0) - (a.at || 0)));
    refresh();
  }, onError)));
}

// Registrazione di un nuovo utente.
async function register(data) {
  const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
  // accettazione dell'informativa privacy e dei termini (versione dei testi)
  const prof = { first: data.first, last: data.last, gender: data.gender, created: Date.now(), privacyAt: Date.now(), privacyVer: data.privacyVer || '' };
  await setDoc(doc(db, 'members', cred.user.uid), prof);
  await setDoc(doc(db, 'accounts', cred.user.uid), { email: (cred.user.email || '').toLowerCase(), verified: false });
  member = Object.assign({ uid: cred.user.uid, email: cred.user.email || '' }, prof);
  // Email di conferma: senza conferma non si prenotano i campi.
  let mailErr = '';
  try { await sendVerifyMail(cred.user); } catch (e) { console.error(e); mailErr = e.code || e.message || 'error'; }
  listenAccount();
  listenBookings();
  listenVerified();
  listenTraining();
  listenAttendance();
  listenBkPlayers();
  listenReceipts();
  refresh();
  return { mailErr };
}

// Accesso con Google (finestra di Google, dall'indirizzo di serie del progetto: authDomain in firebase-config.js).
// Al primo accesso il profilo non c'è ancora: l'app chiede di completarlo (nome e cognome già presi da Google).
async function loginGoogle() {
  const prov = new GoogleAuthProvider();
  prov.setCustomParameters({ prompt: 'select_account' });
  auth.languageCode = (window.I18n && I18n.lang) || 'it';
  const cred = await signInWithPopup(auth, prov);
  const parts = String(cred.user.displayName || '').trim().split(/\s+/).filter(Boolean);
  return { uid: cred.user.uid, first: parts[0] || '', last: parts.slice(1).join(' ') };
}
// Primo accesso con Google (o account senza profilo): profilo come nella registrazione; l'email Google è già confermata.
async function completeProfile(data) {
  if (!user) throw Object.assign(new Error('auth'), { code: 'permission-denied' });
  const prof = { first: data.first, last: data.last, gender: data.gender, created: Date.now(), privacyAt: Date.now(), privacyVer: data.privacyVer || '' };
  await setDoc(doc(db, 'members', user.uid), prof);
  if (user.email) await setDoc(doc(db, 'accounts', user.uid), { email: user.email.toLowerCase(), verified: !!user.emailVerified }).catch(() => {});
  member = Object.assign({ uid: user.uid, email: user.email || '' }, prof);
  try { const c = await getDoc(doc(db, 'coaches', user.uid)); coach = c.exists() ? c.data() : null; } catch (e) { coach = null; }
  listenAccount();
  listenBookings();
  listenVerified();
  listenTraining();
  listenAttendance();
  listenBkPlayers();
  listenReceipts();
  refresh();
}
// Email di conferma nella lingua dell'app, con il pulsante
// "Continua" che riporta al profilo nell'app. Se l'indirizzo di ritorno non fosse autorizzato, si invia senza.
async function sendVerifyMail(u) {
  const l = (window.I18n && I18n.lang) || 'it';
  auth.languageCode = l;
  try { await sendEmailVerification(u, { url: location.origin + location.pathname + '#/me' }); }
  catch (e) {
    if (e && /continue-uri|invalid-continue|missing-continue/.test(e.code || '')) await sendEmailVerification(u);
    else throw e;
  }
}
async function resendVerification() {
  if (user) await sendVerifyMail(user);
}

// Dopo aver aperto il link ricevuto: si aggiorna lo stato dell'account e il permesso nel database.
async function checkVerified() {
  if (!user) return false;
  await user.reload();
  if (user.emailVerified) {
    await user.getIdToken(true);
    if (member && user.email) setDoc(doc(db, 'accounts', user.uid), { email: user.email.toLowerCase(), verified: true }).catch(() => {});
  }
  refresh();
  return user.emailVerified || manualOk;
}

// ---------- conferma a mano da parte dell'admin ----------
// verified/{uid}: l'admin conferma un utente che non riceve l'email (vale come email confermata, anche nelle regole).
let manualOk = false, verUnsub = null;
function listenVerified() {
  if (verUnsub) { verUnsub(); verUnsub = null; }
  manualOk = false;
  Store.applyRemote('manualVerified', {});
  if (!user || !(staff() || member)) return;
  verUnsub = staff()
    ? onSnapshot(collection(db, 'verified'), snap => { const m = {}; snap.docs.forEach(d => { m[d.id] = d.data(); }); Store.applyRemote('manualVerified', m); refresh(); }, onError)
    : onSnapshot(doc(db, 'verified', user.uid), snap => { manualOk = snap.exists(); refresh(); }, onError);
}
function setManualVerified(uid, on) {
  if (!staff()) return Promise.resolve();
  return on ? setDoc(doc(db, 'verified', uid), { by: user.uid, at: Date.now() }) : deleteDoc(doc(db, 'verified', uid));
}

// Registrazione di un utente fatta dall'admin o dalla segreteria: account creato con un'app Firebase separata
// (chi lo crea resta collegato), profilo, email, conferma a mano e ruolo scelto nel modulo (d.role).
// La segreteria crea solo utenti e allenatori (lo controllano anche le regole del database).
async function adminCreateUser(d) {
  if (!staff()) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  const role = d.role || 'user';
  if (!isAdmin && !['user', 'coach'].includes(role)) throw Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  const auth2 = secondAuth();
  const cred = await createUserWithEmailAndPassword(auth2, d.email.trim(), d.password);
  const uid = cred.user.uid, email = (cred.user.email || d.email).toLowerCase();
  await signOut(auth2);
  const name = `${d.last} ${d.first}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'members', uid), { first: d.first, last: d.last, gender: d.gender, created: Date.now() });
  batch.set(doc(db, 'accounts', uid), { email, verified: false });
  batch.set(doc(db, 'verified', uid), { by: user.uid, at: Date.now() });
  if (role === 'coach') batch.set(doc(db, 'coaches', uid), { all: false, name });
  else if (role !== 'user') batch.set(doc(db, 'roles', uid), Object.assign(roleFlags(role), { name, updated: Date.now(), by: user.uid }));
  await batch.commit();
  return uid;
}

function updateProfile(data) {
  if (!member) return Promise.resolve();
  const prof = { first: data.first, last: data.last, gender: data.gender, created: member.created || Date.now() };
  ['privacyAt', 'privacyVer', 'deleteReq'].forEach(k => { if (member[k] != null) prof[k] = member[k]; });
  Object.assign(member, prof);
  return setDoc(doc(db, 'members', member.uid), prof).then(() => { syncMyDir(); });
}
// Elenco dei nomi (dir/members): ognuno tiene aggiornata la propria voce; l'admin quelle di tutti.
let dirData = null, dirTimer = null;
const dirEntry = m => ({ f: m.first, l: m.last, g: m.gender });
function syncMyDir() {
  if (!member || !dirData) return;
  const want = dirEntry(member), have = dirData[member.uid];
  if (have && have.f === want.f && have.l === want.l && have.g === want.g) return;
  setDoc(doc(db, 'dir', 'members'), { [member.uid]: want }, { merge: true }).catch(onError);
}
function syncDir() {
  clearTimeout(dirTimer);
  dirTimer = setTimeout(async () => {
    if (!staff()) return;
    const snap = await getDoc(doc(db, 'dir', 'members')).catch(() => null);
    if (!snap) return;
    const have = snap.exists() ? snap.data() : {}, want = {};
    (Store.state.members || []).forEach(m => { if (m.first && m.last && m.gender) want[m.uid] = dirEntry(m); });
    const same = Object.keys(want).length === Object.keys(have).length
      && Object.entries(want).every(([u, e]) => have[u] && have[u].f === e.f && have[u].l === e.l && have[u].g === e.g);
    if (!same) setDoc(doc(db, 'dir', 'members'), want).catch(onError);
  }, 3000);
}
// L'admin corregge nome e cognome di un utente registrato.
function renameMember(uid, first, last) { return updateDoc(doc(db, 'members', uid), { first, last }); }
// Presa visione dell'informativa e accettazione dei termini (versione dei testi).
function acceptPrivacy(ver) {
  if (!member) return Promise.resolve();
  const d = { privacyAt: Date.now(), privacyVer: ver };
  Object.assign(member, d);
  return updateDoc(doc(db, 'members', member.uid), d).then(() => refresh());
}
// Richiesta di cancellazione dell'account (art. 17 GDPR): avviso agli admin e data della richiesta nel profilo.
async function requestDeletion(text) {
  if (!member) return;
  member.deleteReq = Date.now();
  await updateDoc(doc(db, 'members', member.uid), { deleteReq: member.deleteReq });
  await addDoc(collection(db, 'notices'), { to: 'admins', text: String(text).slice(0, 400), at: Date.now(), by: user.uid });
  refresh();
}
function sendMessage(msg) {
  if (!isAdmin) return Promise.reject(Object.assign(new Error('permission-denied'), { code: 'permission-denied' }));
  // chi scrive: uid, mai l'email (i messaggi "a tutti" li leggono i soci)
  return addDoc(collection(db, 'messages'), Object.assign({}, msg, { created: Date.now(), by: user.uid }));
}
function deleteMessage(id) { return isAdmin ? deleteDoc(doc(db, 'messages', id)) : Promise.resolve(); }
function markRead(id) {
  if (!member) return Promise.resolve();
  return setDoc(doc(db, 'inbox', user.uid), { read: arrayUnion(id) }, { merge: true });
}

// ---------- lista nera (solo admin) ----------
function setBan(uid, data) {
  if (!staff()) return Promise.resolve();
  const ref = doc(db, 'bans', uid);
  return data.book ? setDoc(ref, { book: true, updated: Date.now() }) : deleteDoc(ref);
}

// ---------- prenotazione dei campi ----------
// Per la privacy ogni mezz'ora prenotata ha due documenti con lo stesso ID (giorno_campo_ora):
//   busy/{id}      pubblico: solo "occupato" (campo, giorno, orari, gid = prenotazione di appartenenza);
//   bookings/{id}  privato: chi ha prenotato o il motivo del blocco (lo leggono solo il titolare e l'admin).
// Blocchi ricorrenti (allenamenti fissi): recurring/{rid} con il motivo (solo admin) e
// weekly/{campo_giorno_ora} pubblico, una mezz'ora della settimana occupata (giorno 1 = lunedì … 7 = domenica).
const addMin = (hm, n) => { const [h, m] = hm.split(':').map(Number), x = h * 60 + m + n; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
const slotId = (date, courtId, start) => `${date}_${courtId}_${start}`;
const weeklyId = (courtId, dow, start) => `${courtId}_${dow}_${start}`;
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('sv'); };

// Riunisce le mezz'ore della stessa prenotazione (gid) in un'unica prenotazione dalle "from" alle "to".
function groupSlots(docs) {
  const groups = {};
  docs.forEach(d => {
    const b = d.data(), gid = b.gid || d.id;
    groups[gid] = groups[gid] || { id: gid, courtId: b.courtId, date: b.date, from: b.from || b.start, to: b.to || addMin(b.start, 30), userId: b.userId || null, blocked: b.blocked || '', guest: b.guest || '' };
  });
  return groups;
}

const bk = { busy: {}, full: {}, mine: {}, busyIds: new Set(), fullIds: new Set() };
function mergeBookings() {
  // pubblico (solo occupato) + dettagli visibili (proprie prenotazioni, oppure tutte per l'admin)
  const all = Object.assign({}, bk.busy, bk.mine, bk.full);
  Store.applyRemote('bookings', Object.values(all).filter(b => b.date >= yesterday()));
  Store.applyRemote('bookingsMine', Object.values(bk.mine));
  if (isAdmin) repairBusy();
  refresh();
}
// admin: prenotazioni di un giorno passato (prima di ieri), caricate solo quando apre quel giorno
let bkPast = {}, bkPastPl = {};
function loadBookingsDay(date) {
  if (!staff() || !date || date >= yesterday() || bkPast[date]) return;
  bkPast[date] = [];
  Promise.all([getDocs(query(collection(db, 'bookings'), where('date', '==', date))), getDocs(query(collection(db, 'bkplayers'), where('date', '==', date)))]).then(([snap, pl]) => {
    bkPast[date] = Object.values(groupSlots(snap.docs));
    bkPastPl[date] = pl.docs.map(d => Object.assign({ id: d.id }, d.data()));
    Store.applyRemote('bookingsPast', [].concat(...Object.values(bkPast)));
    Store.applyRemote('bkplayersPast', [].concat(...Object.values(bkPastPl)));
    refresh();
  }, e => { delete bkPast[date]; onError(e); });
}
onSnapshot(query(collection(db, 'busy'), where('date', '>=', yesterday())), snap => {
  bk.busy = groupSlots(snap.docs);
  bk.busyIds = new Set(snap.docs.map(d => d.id));
  bk.busyLoaded = true;
  mergeBookings();
}, onError);
onSnapshot(collection(db, 'weekly'), snap => {
  Store.applyRemote('weekly', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
  refresh();
}, onError);

let bkUnsubs = [];
function listenBookings() {
  bkUnsubs.forEach(f => f()); bkUnsubs = [];
  bk.full = {}; bk.mine = {}; bk.fullIds = new Set(); bk.fullLoaded = false;
  bkPast = {}; bkPastPl = {}; Store.applyRemote('bookingsPast', []); Store.applyRemote('bkplayersPast', []);
  Store.applyRemote('recurring', []);
  mergeBookings();
  if (!user) return;
  if (!staff() && roles.cash) {
    // cassa: le prenotazioni (da ieri) servono per incassare le quote dei campi
    bkUnsubs.push(onSnapshot(query(collection(db, 'bookings'), where('date', '>=', yesterday())), snap => { bk.full = groupSlots(snap.docs); mergeBookings(); }, onError));
  }
  // admin centro: i blocchi ricorrenti dei campi (per i controlli quando crea o sposta un allenamento)
  if (isCenter()) bkUnsubs.push(onSnapshot(collection(db, 'recurring'), snap => { Store.applyRemote('recurring', snap.docs.map(d => Object.assign({ id: d.id }, d.data()))); refresh(); }, onError));
  if (staff()) {
    bkUnsubs.push(onSnapshot(query(collection(db, 'bookings'), where('date', '>=', yesterday())), snap => {
      bk.full = groupSlots(snap.docs);
      bk.fullIds = new Set(snap.docs.map(d => d.id));
      bk.fullLoaded = true;
      mergeBookings();
    }, onError));
    bkUnsubs.push(onSnapshot(collection(db, 'recurring'), snap => {
      Store.applyRemote('recurring', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
      refresh();
    }, onError));
  } else if (member) {
    // solo le proprie prenotazioni (tutte: servono anche per il profilo)
    bkUnsubs.push(onSnapshot(query(collection(db, 'bookings'), where('userId', '==', user.uid)), snap => {
      bk.mine = groupSlots(snap.docs);
      mergeBookings();
    }, onError));
  }
}

// Prenotazioni fatte prima della separazione pubblico/privato: l'admin crea una volta per sessione le "busy"
// mancanti, ricontrollando ogni slot sul server (così una prenotazione appena fatta o cancellata non si tocca).
let repaired = false;
function repairBusy() {
  if (repaired || !bk.fullLoaded || !bk.busyLoaded) return;
  repaired = true;
  setTimeout(async () => {
    const cand = [...bk.fullIds].filter(id => !bk.busyIds.has(id)).slice(0, 200);
    if (!cand.length) return;
    const batch = writeBatch(db);
    let n = 0;
    for (const id of cand) {
      try {
        const [p, q] = await Promise.all([getDoc(doc(db, 'bookings', id)), getDoc(doc(db, 'busy', id))]);
        if (p.exists() && !q.exists()) { const x = p.data(); batch.set(doc(db, 'busy', id), { courtId: x.courtId, date: x.date, start: x.start, from: x.from, to: x.to, gid: x.gid }); n++; }
      } catch (e) { /* riprova alla prossima sessione */ }
    }
    if (n) batch.commit().catch(onError);
  }, 4000);
}

function slotDocs(b) {
  const out = {};
  for (let t = b.from; t < b.to; t = addMin(t, 30)) {
    out[slotId(b.date, b.courtId, t)] = Object.assign({ courtId: b.courtId, date: b.date, start: t, from: b.from, to: b.to, gid: b.id, userId: b.userId || null, blocked: b.blocked || '', first: t === b.from }, b.guest ? { guest: b.guest } : {});
  }
  return out;
}
const busyOf = x => ({ courtId: x.courtId, date: x.date, start: x.start, from: x.from, to: x.to, gid: x.gid });

// Nuova prenotazione o modifica (prev = com'era prima): un solo invio, tutto o niente.
function saveBooking(b, prev) {
  if (!user) return Promise.reject(Object.assign(new Error('auth'), { code: 'permission-denied' }));
  const next = slotDocs(b), old = prev ? slotDocs(prev) : {};
  const batch = writeBatch(db);
  Object.keys(old).forEach(id => { if (!(id in next)) { batch.delete(doc(db, 'bookings', id)); batch.delete(doc(db, 'busy', id)); } });
  Object.entries(next).forEach(([id, data]) => { batch.set(doc(db, 'bookings', id), data); batch.set(doc(db, 'busy', id), busyOf(data)); });
  return batch.commit();
}

function deleteBooking(b) {
  const batch = writeBatch(db);
  Object.keys(slotDocs(b)).forEach(id => { batch.delete(doc(db, 'bookings', id)); batch.delete(doc(db, 'busy', id)); });
  return batch.commit().then(() => deleteDoc(doc(db, 'bkplayers', b.id)).catch(() => {}));
}
// Giocatori della prenotazione e reminder (bkplayers/{gid}); senza giocatori il documento resta per il reminder.
function saveBkPlayers(d) { return setDoc(doc(db, 'bkplayers', d.gid), Object.assign({}, d, { updated: Date.now() })); }
// prenotazione spostata (giorno, orario, campo): i giocatori restano quelli già indicati
function moveBkPlayers(gid, f) { return updateDoc(doc(db, 'bkplayers', gid), Object.assign({}, f, { updated: Date.now() })).catch(() => {}); }
// Ascolto: le prenotazioni in cui gioco (invitato) e le mie (per il reminder di chi ha prenotato).
let bpUnsubs = [];
function listenBkPlayers() {
  bpUnsubs.forEach(f => f()); bpUnsubs = [];
  Store.applyRemote('bkplayers', []); Store.applyRemote('bkpReady', false);
  if (!user || !(staff() || member || adminMember)) return;
  const parts = {};
  const merge = () => { const all = {}; Object.values(parts).forEach(l => l.forEach(x => { all[x.id] = x; })); Store.applyRemote('bkplayers', Object.values(all)); refresh(); };
  // pronti solo con i dati del server (non la copia salvata sul telefono, che può essere vecchia)
  const need = staff() ? ['all', 'by', 'in'] : ['by', 'in'], ok = new Set();
  const on = (k, q) => bpUnsubs.push(onSnapshot(q, { includeMetadataChanges: true }, snap => {
    parts[k] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    if (!snap.metadata.fromCache) ok.add(k);
    Store.applyRemote('bkpReady', need.every(x => ok.has(x)));
    merge();
  }, onError));
  // l'admin vede (e può modificare) i giocatori di tutte le prenotazioni, da ieri in poi
  if (staff()) on('all', query(collection(db, 'bkplayers'), where('date', '>=', yesterday())));
  on('by', query(collection(db, 'bkplayers'), where('by', '==', user.uid)));
  on('in', query(collection(db, 'bkplayers'), where('uids', 'array-contains', user.uid)));
}

// admin: dettaglio di una prenotazione (giocatori indicati da chi ha prenotato)
async function bookingInfo(gid) {
  if (!staff()) return null;
  const out = { players: [] };
  const p = await getDoc(doc(db, 'bkplayers', gid));
  if (p.exists()) {
    const x = p.data();
    out.doc = x;
    out.players.push({ uid: x.by, name: x.ownerName || '', role: 'bk' });
    (x.uids || []).forEach(u => out.players.push({ uid: u, name: (x.names || {})[u] || '' }));
    Object.entries(x.guests || {}).forEach(([k, n]) => out.players.push({ uid: k, name: n, guest: true }));
  }
  return out;
}

// Blocco ricorrente (solo admin): ogni settimana, quel giorno, dalle "from" alle "to".
function addRecurring(r) {
  if (!isAdmin) return Promise.resolve();
  const rid = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const batch = writeBatch(db);
  batch.set(doc(db, 'recurring', rid), { courtId: r.courtId, dow: r.dow, from: r.from, to: r.to, reason: r.reason || '', created: Date.now() });
  for (let t = r.from; t < r.to; t = addMin(t, 30)) batch.set(doc(db, 'weekly', weeklyId(r.courtId, r.dow, t)), { courtId: r.courtId, dow: r.dow, start: t, from: r.from, to: r.to, rid });
  return batch.commit();
}
function deleteRecurring(r) {
  if (!isAdmin) return Promise.resolve();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'recurring', r.id));
  for (let t = r.from; t < r.to; t = addMin(t, 30)) batch.delete(doc(db, 'weekly', weeklyId(r.courtId, r.dow, t)));
  return batch.commit();
}

// ---------- allenamenti ----------
// trainings/{id}: allenamento settimanale (pubblico): giorno (dow 1 = lunedì), orari, coach, livello, massimo, campi.
//   I campi si bloccano con i blocchi ricorrenti (recurring con trid + weekly), come gli allenamenti fissi.
// coaches/{uid}: coach (utente registrato) con all = vede tutti gli allenamenti, altrimenti solo i suoi.
// athletes/{uid}: scheda corsista (anagrafica, tesseramento, certificato): la leggono solo l'admin e l'interessato.
// groups/{tid_YYYY-MM}: gruppo del mese di un allenamento (nomi): solo admin e coach.
// plans/{uid_YYYY-MM}: piano del mese del corsista (allenamenti, quanti a settimana, prezzo): solo admin e interessato.
let trLoaded = false;
onSnapshot(collection(db, 'trainings'), snap => {
  Store.applyRemote('trainings', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
  trLoaded = true;
  refresh();
}, onError);
let trUnsubs = [];
function listenTraining() {
  trUnsubs.forEach(f => f()); trUnsubs = [];
  ['coaches', 'athletes', 'groups', 'plans', 'packs', 'packcount', 'packuse', 'xmem'].forEach(k => Store.applyRemote(k, []));
  pcLoaded.clear();
  if (!user) return;
  const on = (src, kind) => trUnsubs.push(onSnapshot(src, snap => {
    Store.applyRemote(kind, snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
    pcLoaded.add(kind);
    refresh();
  }, onError));
  if (staff() || roles.cash) {
    // elenco dei tesserati (solo i dati per la ricevuta): lo leggono admin e cassa, lo aggiorna l'admin
    trUnsubs.push(onSnapshot(collection(db, 'tesserati'), snap => {
      tessDocs = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
      Store.applyRemote('tesserati', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
      syncTess(); refresh();
    }, onError));
  }
  if (staff()) {
    ['coaches', 'groups', 'plans', 'packs', 'packcount', 'packuse'].forEach(k => on(collection(db, k), k));
    trUnsubs.push(onSnapshot(collection(db, 'athletes'), snap => {
      Store.applyRemote('athletes', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
      athLoaded = true; syncTess(); refresh();
    }, onError));
    return;
  }
  if (!member) return;
  trUnsubs.push(onSnapshot(doc(db, 'athletes', user.uid), d => {
    Store.applyRemote('athletes', d.exists() ? [Object.assign({ id: d.id }, d.data())] : []);
    refresh();
  }, onError));
  if (!isCenter()) on(query(collection(db, 'plans'), where('uid', '==', user.uid)), 'plans');
  on(query(collection(db, 'packs'), where('uid', '==', user.uid)), 'packs');
  on(query(collection(db, 'packuse'), where('uid', '==', user.uid)), 'packuse');
  // contatori dei pacchetti (senza prezzi): i propri e, per l'allenatore, quelli dei corsisti dei suoi allenamenti
  const pcParts = {};
  const pcAdd = (key, src) => trUnsubs.push(onSnapshot(src, snap => {
    pcParts[key] = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    const all = {}; Object.values(pcParts).forEach(l => l.forEach(x => { all[x.id] = x; }));
    Store.applyRemote('packcount', Object.values(all)); refresh();
  }, onError));
  pcAdd('m', query(collection(db, 'packcount'), where('uid', '==', user.uid)));
  if (coach) pcAdd('c', query(collection(db, 'packcount'), where('coachUids', 'array-contains', user.uid)));
  on(query(collection(db, 'xmem'), where('uid', '==', user.uid)), 'xmem');
  if (isCenter()) { on(collection(db, 'groups'), 'groups'); on(collection(db, 'plans'), 'plans'); on(collection(db, 'coaches'), 'coaches'); }
  else if (coach) on(coach.all ? collection(db, 'groups') : query(collection(db, 'groups'), where('coachUid', '==', user.uid)), 'groups');
}
// Tesserati: copia ridotta delle schede (nome, sesso, nascita, residenza, codice fiscale, stagioni di tesseramento),
// senza certificato né pagamenti, per gli intestatari delle ricevute. L'admin la tiene allineata alle schede.
let tessDocs = null, athLoaded = false, tessSyncing = false;
function tessMirror(a) {
  const m = (Store.state.members || []).find(x => x.uid === a.id);
  const seasons = Object.keys(a.tess || {}).filter(k => a.tess[k]).sort();
  if (!seasons.length) return null;
  const x = { name: m ? `${m.first} ${m.last}` : `${a.first || ''} ${a.last || ''}`.trim(), gender: (m && m.gender) || a.gender || 'M', birthPlace: a.birthPlace || '', birthDate: a.birthDate || '',
    city: a.city || '', address: a.address || '', cf: a.cf || '', seasons };
  // ragazzo senza account: il genitore compare nella ricevuta
  if (a.parent && a.parent.name) x.parent = a.parent.name;
  return x;
}
function syncTess() {
  if (!staff() || !athLoaded || !tessDocs || tessSyncing) return;
  const want = {};
  (Store.state.athletes || []).forEach(a => { const x = tessMirror(a); if (x) want[a.id] = x; });
  const batch = writeBatch(db);
  let n = 0;
  const same = (x, y) => !!y && Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => JSON.stringify(x[k]) === JSON.stringify(y[k]));
  Object.entries(want).forEach(([id, x]) => { if (!same(x, tessDocs[id])) { batch.set(doc(db, 'tesserati', id), x); n++; } });
  Object.keys(tessDocs).forEach(id => { if (!want[id]) { batch.delete(doc(db, 'tesserati', id)); n++; } });
  if (!n) return;
  tessSyncing = true;
  batch.commit().catch(onError).finally(() => { tessSyncing = false; });
}

// Blocchi dei campi di un allenamento: un blocco ricorrente per campo (motivo = nome dell'allenamento).
// Recupero allenamento (tr.date): i campi si bloccano solo quel giorno, con slot "bloccati" come quelli dell'admin.
// Mezz'ore della griglia che toccano l'orario (es. 19:15–20:30 → 19:00–20:30).
function extraTrainingSlots(tr, courtId) {
  const toM = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const fromHM = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const a = fromHM(Math.floor(toM(tr.from) / 30) * 30), b = fromHM(Math.ceil(toM(tr.to) / 30) * 30);
  return slotDocs({ id: `trx_${tr.id}_${courtId}`, courtId, date: tr.date, from: a, to: b, userId: null, blocked: tr.reason || 'Recupero allenamento' });
}
function trainingBlocks(batch, tr, del) {
  if (tr.date) {
    (tr.courts || []).forEach(courtId => Object.entries(extraTrainingSlots(tr, courtId)).forEach(([id, data]) => {
      if (del) { batch.delete(doc(db, 'bookings', id)); batch.delete(doc(db, 'busy', id)); }
      else { batch.set(doc(db, 'bookings', id), data); batch.set(doc(db, 'busy', id), busyOf(data)); }
    }));
    return;
  }
  (tr.courts || []).forEach(courtId => {
    const rid = `t_${tr.id}_${courtId}`;
    if (del) batch.delete(doc(db, 'recurring', rid));
    else batch.set(doc(db, 'recurring', rid), { courtId, dow: tr.dow, from: tr.from, to: tr.to, reason: tr.reason, trid: tr.id, created: Date.now() });
    for (let t = tr.from; t < tr.to; t = addMin(t, 30)) {
      const ref = doc(db, 'weekly', weeklyId(courtId, tr.dow, t));
      if (del) batch.delete(ref); else batch.set(ref, { courtId, dow: tr.dow, start: t, from: tr.from, to: tr.to, rid });
    }
  });
}
// Crea o modifica un allenamento; groups = gruppi dell'allenamento (se cambia il coach si aggiorna coachUid).
function saveTraining(old, d, groups) {
  const ref = old ? doc(db, 'trainings', old.id) : doc(collection(db, 'trainings'));
  const batch = writeBatch(db);
  if (old) trainingBlocks(batch, old, true);
  trainingBlocks(batch, Object.assign({ id: ref.id }, d), false);
  if (old) batch.update(ref, d); else batch.set(ref, Object.assign({}, d, { created: Date.now() }));
  if (old && old.coachUid !== d.coachUid) (groups || []).forEach(g => batch.update(doc(db, 'groups', g.id), { coachUid: d.coachUid || '' }));
  return batch.commit().then(() => ref.id);
}
// 5° allenamento del mese: corsisti del gruppo copiati nella giornata (possono dare la presenza)
function setOccMembers(tid, date, members) {
  const oref = doc(db, 'occ', `${tid}_${date}`);
  return runTransaction(db, async tr => {
    const os = await tr.get(oref);
    if (os.exists()) tr.update(oref, { members }); else tr.set(oref, Object.assign(occBase(tid, date), { members }));
  });
}
// Allenamento singolo (recupero) annullato o ripristinato: i suoi campi di quel giorno si liberano o si bloccano di nuovo.
function extraTrainingBlocks(tr, del) {
  if (!staff() || !tr.date) return Promise.resolve();
  const batch = writeBatch(db);
  trainingBlocks(batch, tr, del);
  return batch.commit();
}
// Elimina un allenamento: campi liberati, gruppi tolti, piani ricalcolati (plans = piani aggiornati da scrivere).
function deleteTraining(tr, groups, plans) {
  const batch = writeBatch(db);
  if (tr.date) groups.forEach(g => (g.uids || []).forEach(u => batch.delete(doc(db, 'xmem', `${tr.id}_${u}`))));
  trainingBlocks(batch, tr, true);
  groups.forEach(g => batch.delete(doc(db, 'groups', g.id)));
  plans.forEach(p => batch.set(doc(db, 'plans', p.id), stripId(p)));
  batch.delete(doc(db, 'trainings', tr.id));
  return batch.commit();
}
const stripId = o => { const c = Object.assign({}, o); delete c.id; return c; };
// Salva gruppi del mese e piani dei corsisti coinvolti in un unico invio; athletes = schede da creare o aggiornare.
// xm: corsisti dei recuperi allenamento (xmem/{tid_uid}, letto dal corsista per la richiesta di presenza): [{ tid, date, uid, on }]
function saveGroups(groups, plans, athletes, xm) {
  const batch = writeBatch(db);
  (xm || []).forEach(x => { const r = doc(db, 'xmem', `${x.tid}_${x.uid}`); if (x.on) batch.set(r, { tid: x.tid, date: x.date, uid: x.uid }); else batch.delete(r); });
  (groups || []).forEach(g => {
    batch.set(doc(db, 'groups', g.id), stripId(g));
    // numero di persone del gruppo nel mese, pubblico (serve per calcolare i posti spot)
    batch.update(doc(db, 'trainings', g.tid), { ['sizes.' + g.month]: (g.uids || []).length });
  });
  (plans || []).forEach(p => p.del ? batch.delete(doc(db, 'plans', p.id)) : batch.set(doc(db, 'plans', p.id), stripId(p)));
  (athletes || []).forEach(a => batch.set(doc(db, 'athletes', a.id), stripId(a), { merge: true }));
  return batch.commit();
}
// ---------- presenze e spot ----------
// occ/{tid_data}: allenamento di un giorno (pubblico): p = presenti, a = assenti, s = spot confermati, cancelled.
// att/{tid_data_uid}: risposta del corsista (in/out, forced se l'ha messa l'admin): admin, interessato e coach.
// spots/{tid_data_uid}: candidatura spot o recupero (pending/ok/no, prezzo): admin, interessato e coach.
// I contatori di occ cambiano nello stesso invio della risposta (regole del database).
let ocUnsubs = [];
onSnapshot(query(collection(db, 'occ'), where('date', '>=', yesterday())), snap => {
  Store.applyRemote('occ', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
  refresh();
}, onError);
// numero dei posti spot liberi (solo admin)
let freeUnsub = null;
function listenOccFree() {
  if (freeUnsub) { freeUnsub(); freeUnsub = null; }
  Store.applyRemote('occfree', {});
  if (!staff()) return;
  freeUnsub = onSnapshot(query(collection(db, 'occfree'), where('date', '>=', yesterday())), snap => {
    Store.applyRemote('occfree', Object.fromEntries(snap.docs.map(d => [d.id, d.data().free])));
    refresh();
  }, onError);
}
function listenAttendance() {
  ocUnsubs.forEach(f => f()); ocUnsubs = [];
  Store.applyRemote('att', []); Store.applyRemote('spots', []); Store.applyRemote('evals', []);
  if (!user || !(staff() || member)) return;
  const on = (src, kind) => ocUnsubs.push(onSnapshot(src, snap => {
    Store.applyRemote(kind, snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
    refresh();
  }, onError));
  // schede di valutazione: admin e segreteria tutte, l'allenatore quelle dei suoi allenamenti (il corsista nessuna)
  if (staff()) on(collection(db, 'evals'), 'evals');
  else if (coach) on(query(collection(db, 'evals'), where('coachUid', '==', user.uid)), 'evals');
  ['att', 'spots'].forEach(k => {
    if (staff()) return on(query(collection(db, k), where('date', '>=', monthAgo())), k);
    if (coach || isCenter()) {
      // il coach vede le risposte e gli spot dei suoi allenamenti (o di tutti); più le proprie candidature
      // (l'admin centro li vede tutti)
      const parts = {};
      const merge = () => { const all = {}; Object.values(parts).forEach(l => l.forEach(x => { all[x.id] = x; })); Store.applyRemote(k, Object.values(all)); refresh(); };
      const add = (key, src) => ocUnsubs.push(onSnapshot(src, snap => { parts[key] = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); merge(); }, onError));
      add('c', isCenter() || coach.all ? query(collection(db, k), where('date', '>=', monthAgo())) : query(collection(db, k), where('coachUid', '==', user.uid)));
      add('m', query(collection(db, k), where('uid', '==', user.uid)));
      return;
    }
    on(query(collection(db, k), where('uid', '==', user.uid)), k);
  });
}
// Report e backup (admin): presenze, spot e giornate di un periodo qualsiasi, letti una volta dal database.
async function loadTrainingRange(from, to) {
  const get = k => getDocs(query(collection(db, k), where('date', '>=', from), where('date', '<=', to))).then(s => s.docs.map(d => Object.assign({ id: d.id }, d.data())));
  const [att, spots, occ] = await Promise.all(['att', 'spots', 'occ'].map(get));
  return { att, spots, occ };
}
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 31); return d.toLocaleDateString('sv'); };
const occBase = (tid, date) => ({ tid, date, p: 0, a: 0, s: 0, cancelled: false });
// Risposta presente/assente (status 'in'/'out', null = togli la risposta: solo admin). by = admin che la forza.
// Se il database rifiuta per un token di accesso non aggiornato, si rinnova e si riprova una volta.
async function withFreshToken(fn) {
  try { return await fn(); }
  catch (e) {
    if (e && e.code === 'permission-denied' && user) { await user.reload().catch(() => {}); await user.getIdToken(true); return fn(); }
    throw e;
  }
}
function setAttendance(tid, date, uid, status, extra) {
  return withFreshToken(() => setAttendanceTx(tid, date, uid, status, extra));
}
function setAttendanceTx(tid, date, uid, status, extra) {
  return runTransaction(db, async tr => {
    const oid = `${tid}_${date}`, oref = doc(db, 'occ', oid), aref = doc(db, 'att', `${oid}_${uid}`);
    const [os, as] = await Promise.all([tr.get(oref), tr.get(aref)]);
    const o = os.exists() ? os.data() : occBase(tid, date), before = as.exists() ? as.data().status : 'none';
    if (before === (status || 'none') && !(extra && extra.forced)) return;
    const after = status || 'none';
    const p = (o.p || 0) + (after === 'in' ? 1 : 0) - (before === 'in' ? 1 : 0);
    const a = (o.a || 0) + (after === 'out' ? 1 : 0) - (before === 'out' ? 1 : 0);
    if (os.exists()) tr.update(oref, { p, a }); else tr.set(oref, Object.assign(occBase(tid, date), { p, a }));
    if (status) tr.set(aref, Object.assign({ tid, date, uid, status, at: Date.now(), coachUid: (extra && extra.coachUid) || '' }, extra && extra.forced ? { forced: true, by: user.uid } : {}));
    else tr.delete(aref);
  });
}
// Presenza segnata (presente / assente / niente) dall'allenatore di quell'allenamento o da admin e segreteria.
// Il pacchetto del corsista si scala SUBITO: admin e segreteria con syncPackUse; l'allenatore (che non vede prezzi né
// piani) in un'unica transazione con presenza, packuse e contatore (packcount, senza dati economici).
// Se le regole rifiutano lo scalo (es. mese già pagato con il piano) si salva solo la presenza.
async function markAttendance(tid, date, uid, status, coachUid) {
  if (staff()) {
    await setAttendance(tid, date, uid, status, { coachUid: coachUid || '', forced: true });
    return syncPackUse(tid, date, uid);
  }
  try { return await withFreshToken(() => coachMarkTx(tid, date, uid, status, coachUid, true)); }
  catch (e) {
    if (e && e.code === 'permission-denied') return coachMarkTx(tid, date, uid, status, coachUid, false);
    throw e;
  }
}
function coachMarkTx(tid, date, uid, status, coachUid, withPack) {
  return runTransaction(db, async tx => {
    const oid = `${tid}_${date}`, attId = `${oid}_${uid}`;
    const oref = doc(db, 'occ', oid), aref = doc(db, 'att', attId), uref = doc(db, 'packuse', attId);
    const [os, as] = await Promise.all([tx.get(oref), tx.get(aref)]);
    const us = withPack ? await tx.get(uref) : null;
    const has = us && us.exists() ? us.data() : null;
    // contatori leggibili dall'allenatore (quelli dei corsisti dei suoi allenamenti)
    const pcs = {};
    if (withPack) {
      const ids = (Store.state.packcount || []).filter(c => c.uid === uid).map(c => c.id);
      for (const id of ids) { const s = await tx.get(doc(db, 'packcount', id)); if (s.exists()) pcs[id] = s.data(); }
    }
    const o = os.exists() ? os.data() : occBase(tid, date), a = as.exists() ? as.data() : null;
    const before = a ? a.status : 'none', after = status || 'none';
    let wrote = false;
    if (before !== after || (status && !a.forced)) {
      const p = (o.p || 0) + (after === 'in' ? 1 : 0) - (before === 'in' ? 1 : 0);
      const ab = (o.a || 0) + (after === 'out' ? 1 : 0) - (before === 'out' ? 1 : 0);
      if (os.exists()) tx.update(oref, { p, a: ab }); else tx.set(oref, Object.assign(occBase(tid, date), { p, a: ab }));
      if (status) tx.set(aref, { tid, date, uid, status, at: Date.now(), coachUid: coachUid || '', forced: true, by: user.uid });
      else tx.delete(aref);
      wrote = true;
    }
    if (!withPack) return 'none';
    const want = after === 'in' && !o.cancelled;
    if (has && !want && pcs[has.pack]) {
      tx.delete(uref);
      tx.update(doc(db, 'packcount', has.pack), { used: Math.max(0, (pcs[has.pack].used || 0) - 1), last: attId });
      return 'released';
    }
    if (!has && want) {
      const pick = Object.entries(pcs).filter(([, c]) => (c.from || '') <= date && (c.used || 0) < (c.n || 0))
        .sort(([, x], [, y]) => (x.from || '').localeCompare(y.from || '') || (x.created || 0) - (y.created || 0))[0];
      if (!pick) return wrote ? 'nopack' : 'none';
      if (!os.exists() && !wrote) tx.set(oref, occBase(tid, date));
      tx.set(uref, { pack: pick[0], uid, tid, date, at: Date.now(), by: user.uid });
      tx.update(doc(db, 'packcount', pick[0]), { used: (pick[1].used || 0) + 1, last: attId });
      return 'used';
    }
    return 'none';
  });
}
// Scheda di valutazione: list = [{ tid, date, uid, coachUid, v: { tec: 7, … }, note }]; senza voti né nota si elimina.
function saveEvals(list) {
  const batch = writeBatch(db);
  list.forEach(e => {
    const ref = doc(db, 'evals', `${e.tid}_${e.date}_${e.uid}`);
    if (!Object.keys(e.v || {}).length && !e.note) batch.delete(ref);
    else batch.set(ref, { tid: e.tid, date: e.date, uid: e.uid, coachUid: e.coachUid || '', by: user.uid, v: e.v, note: e.note || '', at: Date.now() });
  });
  return batch.commit();
}
// Candidatura a un posto spot (utente registrato).
function applySpot(d) { return withFreshToken(() => applySpotNow(d)); }
function applySpotNow(d) { return setDoc(doc(db, 'spots', `${d.tid}_${d.date}_${user.uid}`), Object.assign({ uid: user.uid, status: 'pending', at: Date.now(), seen: false }, d)); }
function withdrawSpot(id) { return deleteDoc(doc(db, 'spots', id)); }
function seeSpot(id) { return updateDoc(doc(db, 'spots', id), { seen: true }); }
// Admin: conferma o rifiuta (aggiorna il contatore degli spot confermati), oppure assegna un recupero.
// packId: lo spot confermato si scala dal pacchetto (prezzo 0); se lo spot torna rifiutato, l'allenamento si restituisce.
function decideSpot(sp, ok, price, packId) {
  return runTransaction(db, async tr => {
    const oref = doc(db, 'occ', `${sp.tid}_${sp.date}`), sref = doc(db, 'spots', sp.id), fref = doc(db, 'occfree', `${sp.tid}_${sp.date}`);
    const [os, ss, fs] = await Promise.all([tr.get(oref), tr.get(sref), tr.get(fref)]);
    const prev = ss.exists() ? ss.data() : {};
    const was = prev.status === 'ok';
    const use = ok && packId ? packId : null, back = was && prev.pack && !prev.packBack ? prev.pack : null;
    const pks = {};
    for (const id of new Set([use, back].filter(Boolean))) pks[id] = await pcRead(tr, id);
    if (use) {
      const pk = pks[use];
      const left = pk ? pk.n - (pk.used || 0) + (back === use ? 1 : 0) : 0;
      if (left <= 0) throw Object.assign(new Error('pack-empty'), { code: 'pack-empty' });
    }
    const o = os.exists() ? os.data() : occBase(sp.tid, sp.date);
    const s = (o.s || 0) + (ok ? 1 : 0) - (was ? 1 : 0);
    const open = (fs.exists() ? Number(fs.data().free) || 0 : 0) - s > 0;   // ci sono ancora posti spot (senza il numero)
    if (os.exists()) tr.update(oref, { s, open }); else tr.set(oref, Object.assign(occBase(sp.tid, sp.date), { s, open }));
    const delta = {};
    if (use) delta[use] = (delta[use] || 0) + 1;
    if (back) delta[back] = (delta[back] || 0) - 1;
    Object.entries(delta).forEach(([id, d]) => { if (d && pks[id]) pcWrite(tr, pks[id], Math.max(0, (pks[id].used || 0) + d)); });
    const data = { status: ok ? 'ok' : 'no', decidedAt: Date.now(), seen: false };
    if (ok) data.price = use ? 0 : price;
    if (use) data.pack = use;
    if (ss.exists()) tr.update(sref, Object.assign({ pack: deleteField(), packBack: deleteField() }, data));
    else tr.set(sref, Object.assign(stripId(sp), data));
  });
}
// Posti spot liberi del giorno, decisi dall'admin (null = nessuno). Il numero sta in occfree/{tid_data}, leggibile
// solo dall'admin; nella giornata pubblica (occ) resta solo "open": ci sono ancora posti spot sì/no.
function setOccFree(tid, date, free) {
  return runTransaction(db, async tr => {
    const id = `${tid}_${date}`, oref = doc(db, 'occ', id), fref = doc(db, 'occfree', id);
    const os = await tr.get(oref);
    const open = free != null && free - ((os.exists() && os.data().s) || 0) > 0;
    if (free == null) tr.delete(fref); else tr.set(fref, { tid, date, free, updated: Date.now() });
    if (os.exists()) tr.update(oref, { open }); else tr.set(oref, Object.assign(occBase(tid, date), { open }));
  });
}
// Annulla o ripristina un allenamento del giorno. packSpots = spot confermati scalati da un pacchetto:
// con l'annullamento l'allenamento torna nel pacchetto (packBack), con il ripristino si scala di nuovo.
// removed = eliminato solo per quel giorno (non compare più); anche questo libera i campi e rende i pacchetti
function setOccCancelled(tid, date, cancelled, note, packSpots, removed) {
  return runTransaction(db, async tr => {
    const oref = doc(db, 'occ', `${tid}_${date}`), os = await tr.get(oref);
    const list = (packSpots || []).filter(sp => sp.pack && !!sp.packBack !== cancelled);
    const ids = [...new Set(list.map(sp => sp.pack))];
    const pks = {};
    for (const id of ids) pks[id] = await pcRead(tr, id);
    const st = { cancelled, note: note || '', removed: !!(cancelled && removed) };
    if (os.exists()) tr.update(oref, st);
    else tr.set(oref, Object.assign(occBase(tid, date), st));
    ids.forEach(id => {
      if (!pks[id]) return;
      const k = list.filter(sp => sp.pack === id).length;
      pcWrite(tr, pks[id], Math.max(0, (pks[id].used || 0) + (cancelled ? -k : k)));
    });
    list.forEach(sp => tr.update(doc(db, 'spots', sp.id), { packBack: cancelled ? true : deleteField() }));
  });
}

// ---------- pagamenti e ricevute ----------
// receipts/{id}: ricevuta (numero progressivo per anno, dati del socio, importo, modalità, causale): admin e interessato.
// counters/receipts-AAAA: ultimo numero usato nell'anno (solo admin).
let rcUnsub = null;
function listenReceipts() {
  if (rcUnsub) { rcUnsub(); rcUnsub = null; }
  Store.applyRemote('receipts', []);
  if (caUnsubs.length) { caUnsubs.forEach(f => f()); caUnsubs = []; }
  Store.applyRemote('incassi', []); Store.applyRemote('bkpaid', {});
  const cash = staff() || !!roles.cash;
  if (!user || !(cash || member)) return;
  rcUnsub = onSnapshot(cash ? collection(db, 'receipts') : query(collection(db, 'receipts'), where('uid', '==', user.uid)), snap => {
    Store.applyRemote('receipts', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
    refresh();
  }, onError);
  if (!cash) return;
  caUnsubs.push(onSnapshot(collection(db, 'incassi'), snap => {
    Store.applyRemote('incassi', snap.docs.map(d => Object.assign({ id: d.id }, d.data())));
    refresh();
  }, onError));
  caUnsubs.push(onSnapshot(collection(db, 'bkpaid'), snap => {
    Store.applyRemote('bkpaid', Object.fromEntries(snap.docs.map(d => [d.id, d.data()])));
    refresh();
  }, onError));
}
let caUnsubs = [];

// ---------- CASSA: incassi e ricevute Q (quote sociali) / C (commerciali) ----------
// incassi/{id}: ogni incasso (data, modalità, righe con categoria e importo, ricevute emesse): cassa e admin.
// Ricevute: serie Q e C con numerazione autonoma per anno (counters/receipts-AAAA per Q, receiptsC-AAAA per C).
// bkpaid/{gid}: prenotazione di un campo pagata (incasso, numero di ricevuta).
const ctrRef = (series, year) => doc(db, 'counters', (series === 'C' ? 'receiptsC-' : 'receipts-') + year);
const rnOf = (series, n, year) => `${n}/${series}/${year}`;
// p = { date, method, lines: [{ cat, series, desc, amount, ref? }], receipt: { Q, C } (quali ricevute emettere),
//   uid, person (intestatario, può mancare), causale: { Q, C } }
const cleanPerson = x => (x ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v == null ? '' : v])) : null);
function recordIncasso(p) {
  p = Object.assign({}, p, { person: cleanPerson(p.person) });
  const year = p.date.slice(0, 4);
  return runTransaction(db, async tr => {
    const want = ['Q', 'C'].filter(s => p.receipt[s] && p.lines.some(l => l.series === s));
    const ctr = {};
    for (const s of want) { const cs = await tr.get(ctrRef(s, year)); ctr[s] = cs.exists() ? cs.data().last || 0 : 0; }
    const iref = doc(collection(db, 'incassi'));
    const rec = {};
    want.forEach(s => {
      const lines = p.lines.filter(l => l.series === s), amount = Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;
      const n = ctr[s] + 1, rref = doc(collection(db, 'receipts'));
      tr.set(ctrRef(s, year), { last: n, updated: Date.now() });
      tr.set(rref, { year: +year, n, series: s, issued: p.date, payDate: p.date, amount, method: p.method, kind: 'cassa', ref: iref.id, incasso: iref.id,
        uid: p.uid || '', person: p.person || null, causale: p.causale[s], lines: lines.map(l => ({ cat: l.cat, desc: l.desc, amount: l.amount })), void: false, created: Date.now(), by: user.uid });
      rec[s] = { id: rref.id, rn: rnOf(s, n, year) };
    });
    tr.set(iref, incassoDoc(p, rec));
    p.lines.filter(l => l.ref && l.ref.kind === 'booking').forEach(l => tr.set(doc(db, 'bkpaid', l.ref.id), { incasso: iref.id, date: p.date, method: p.method, amount: l.amount, rn: rec.Q ? rec.Q.rn : '', at: Date.now() }));
  });
}
const sumOf = (lines, s) => Math.round(lines.filter(l => !s || l.series === s).reduce((a, l) => a + l.amount, 0) * 100) / 100;
const incassoDoc = (p, rec) => ({ date: p.date, method: p.method, lines: p.lines.map(l => Object.assign({ cat: l.cat, series: l.series, desc: l.desc, amount: l.amount }, l.ref ? { ref: l.ref } : {})),
  totQ: sumOf(p.lines, 'Q'), totC: sumOf(p.lines, 'C'), total: sumOf(p.lines), receipts: rec, uid: p.uid || '', name: (p.person && p.person.name) || '', void: false, at: Date.now(), by: user.uid });
// Inserimento di una ricevuta con numero e data scelti (admin): le ricevute della stessa serie e anno con numero
// uguale o maggiore scalano di uno (shifts = [{ id, n, links }]), il contatore va all'ultimo numero.
function insertIncasso(p, series, n, shifts, last) {
  p = Object.assign({}, p, { person: cleanPerson(p.person) });
  const year = p.date.slice(0, 4), batch = writeBatch(db);
  shifts.forEach(x => {
    batch.update(doc(db, 'receipts', x.id), { n: x.n, renumbered: Date.now() });
    (x.links || []).forEach(l => batch.update(doc(db, l.col, l.id), { [l.field]: l.rn }));
  });
  const iref = doc(collection(db, 'incassi')), rref = doc(collection(db, 'receipts'));
  const lines = p.lines.filter(l => l.series === series);
  batch.set(rref, { year: +year, n, series, issued: p.date, payDate: p.date, amount: sumOf(lines), method: p.method, kind: 'cassa', ref: iref.id, incasso: iref.id,
    uid: p.uid || '', person: p.person || null, causale: p.causale[series], lines: lines.map(l => ({ cat: l.cat, desc: l.desc, amount: l.amount })), void: false, created: Date.now(), by: user.uid, inserted: true });
  const rec = { [series]: { id: rref.id, rn: rnOf(series, n, year) } };
  batch.set(iref, incassoDoc(p, rec));
  p.lines.filter(l => l.ref && l.ref.kind === 'booking').forEach(l => batch.set(doc(db, 'bkpaid', l.ref.id), { incasso: iref.id, date: p.date, method: p.method, amount: l.amount, rn: rec.Q ? rec.Q.rn : '', at: Date.now() }));
  batch.set(ctrRef(series, year), { last, updated: Date.now() });
  return batch.commit();
}
// Annulla un incasso: le sue ricevute restano come ANNULLATE; prenotazioni, piani, spot e pacchetti tornano da pagare.
function voidIncasso(inc) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'incassi', inc.id), { void: true, voidAt: Date.now(), voidBy: user.uid });
  Object.values(inc.receipts || {}).forEach(r => batch.update(doc(db, 'receipts', r.id), { void: true, voidAt: Date.now() }));
  (inc.lines || []).forEach(l => {
    if (!l.ref) return;
    if (l.ref.kind === 'booking') batch.delete(doc(db, 'bkpaid', l.ref.id));
    else if (l.ref.kind === 'quarter') {
      (l.ref.planIds || []).forEach(id => batch.update(doc(db, 'plans', id), { paid: deleteField() }));
      batch.update(doc(db, 'athletes', l.ref.uid), Object.fromEntries((l.ref.months || []).map(m => [`prepaid.${m}`, deleteField()])));
    } else clearPaid(batch, l.ref.kind, l.ref.id);
  });
  return batch.commit();
}
// Intestatario della ricevuta (anche dopo l'emissione): si registra chi l'ha cambiato e quando.
function setReceiptHolder(r, uid, person) {
  person = cleanPerson(person);
  const log = (r.holderLog || []).concat([{ at: Date.now(), by: user.uid, from: (r.person && r.person.name) || '', to: (person && person.name) || '' }]);
  const batch = writeBatch(db);
  batch.update(doc(db, 'receipts', r.id), { uid: uid || '', person: person || null, holderLog: log });
  if (r.incasso) batch.update(doc(db, 'incassi', r.incasso), { uid: uid || '', name: (person && person.name) || '' });
  return batch.commit();
}
// Registra un pagamento: ricevuta numerata (se importo > 0), "paid" sul piano o sullo spot, scheda aggiornata.
// p = { kind: 'month'|'spot'|'pack', ref (id piano o spot), uid, amount, method, payDate, issued, causale, month|spotDate, person, athlete }
function recordPayment(p) {
  const year = p.issued.slice(0, 4);
  return runTransaction(db, async tr => {
    const cref = ctrRef('Q', year);
    const cs = await tr.get(cref);
    const paid = { date: p.payDate, method: p.method, amount: p.amount, at: Date.now() };
    // ogni pagamento è anche un incasso della cassa (quote sociali – corsi di allenamento)
    const iref = doc(collection(db, 'incassi')), rec = {};
    if (p.amount > 0 && p.receipt !== false) {
      const n = (cs.exists() ? cs.data().last || 0 : 0) + 1;
      const rref = doc(collection(db, 'receipts'));
      tr.set(cref, { last: n, updated: Date.now() });
      tr.set(rref, { year: +year, n, series: 'Q', issued: p.issued, payDate: p.payDate, amount: p.amount, method: p.method, kind: p.kind, ref: p.ref, incasso: iref.id,
        uid: p.uid, person: p.person, causale: p.causale, month: p.month || '', months: p.months || [], quarter: !!p.quarter, course: !!p.course, spotDate: p.spotDate || '', void: false, created: Date.now(), by: user.uid });
      Object.assign(paid, { rid: rref.id, rn: rnOf('Q', n, year) });
      rec.Q = { id: rref.id, rn: paid.rn };
    }
    if (p.amount > 0) {
      paid.iid = iref.id;
      const ref = p.quarter ? { kind: 'quarter', planIds: p.planIds || [], uid: p.uid, months: p.months } : { kind: p.kind, id: p.ref };
      tr.set(iref, incassoDoc({ date: p.payDate, method: p.method, uid: p.uid, person: p.person, lines: [{ cat: p.kind === 'fitp' ? 'q_fitp' : 'q_train', series: 'Q', desc: p.causale, amount: p.amount, ref }] }, rec));
    }
    if (p.kind === 'fitp') {
      // tesseramento FITP della stagione: pagato (e quindi tesserato) nella scheda del corsista
      tr.set(doc(db, 'athletes', p.uid), Object.assign({}, p.athlete || {}, { tess: { [p.season]: true }, fitp: { [p.season]: paid } }), { merge: true });
      return;
    }
    if (p.quarter) {
      // trimestrale (o corso intero): pagati il mese e i successivi; i piani già creati si segnano subito,
      // per gli altri mesi resta il "prepagato" nella scheda (vale quando si compone il gruppo)
      Object.assign(paid, { quarter: true, months: p.months }, p.course ? { course: true } : {});
      (p.planIds || []).forEach(id => tr.update(doc(db, 'plans', id), { paid }));
      const athlete = Object.assign({}, p.athlete || {}, { prepaid: Object.fromEntries(p.months.map(m => [m, paid])) });
      tr.set(doc(db, 'athletes', p.uid), athlete, { merge: true });
      return;
    }
    tr.update(doc(db, payCol(p.kind), p.ref), { paid });
    if (p.athlete) tr.set(doc(db, 'athletes', p.uid), p.athlete, { merge: true });
  });
}
// Annulla una ricevuta (resta in archivio come ANNULLATA; il piano o lo spot torna da pagare).
// planIds = piani esistenti dei mesi coperti (per il trimestrale).
function voidReceipt(r, planIds) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'receipts', r.id), { void: true, voidAt: Date.now() });
  if (r.incasso) batch.update(doc(db, 'incassi', r.incasso), { void: true, voidAt: Date.now(), voidBy: user.uid });
  if (r.quarter) {
    (planIds || []).forEach(id => batch.update(doc(db, 'plans', id), { paid: deleteField() }));
    batch.update(doc(db, 'athletes', r.uid), Object.fromEntries((r.months || []).map(m => [`prepaid.${m}`, deleteField()])));
  } else clearPaid(batch, r.kind, r.ref);
  return batch.commit();
}
// Rinumera le ricevute (admin): nuovi numeri, numero mostrato su piani/spot/prepagati, ultimo numero dell'anno.
function renumberReceipts(changes, links, year, last, series) {
  const batch = writeBatch(db);
  changes.forEach(c => batch.update(doc(db, 'receipts', c.id), { n: c.n, renumbered: Date.now() }));
  links.forEach(l => batch.update(doc(db, l.col, l.id), { [l.field]: l.rn }));
  batch.set(ctrRef(series || 'Q', year), { last, updated: Date.now() });
  return batch.commit();
}
// Toglie un pagamento registrato senza ricevuta (l'incasso collegato si annulla).
function unpay(kind, ref, iid) {
  const batch = writeBatch(db);
  clearPaid(batch, kind, ref);
  if (iid) batch.update(doc(db, 'incassi', iid), { void: true, voidAt: Date.now(), voidBy: user.uid });
  return batch.commit();
}
const payCol = kind => ({ month: 'plans', spot: 'spots', pack: 'packs' })[kind];
// toglie il "pagato": per il tesseramento FITP (ref = "uid|stagione") la stagione torna non pagata
function clearPaid(batch, kind, ref) {
  if (kind === 'fitp') { const [uid, s] = String(ref).split('|'); batch.update(doc(db, 'athletes', uid), { [`fitp.${s}`]: deleteField(), [`tess.${s}`]: false }); }
  else batch.update(doc(db, payCol(kind), ref), { paid: deleteField() });
}
// ---------- pacchetti: ogni presenza scala un allenamento dal pacchetto (senza Cloud Functions) ----------
// packs/{id}: pacchetto con prezzo e pagamento (solo staff e interessato).
// packcount/{id}: contatore senza dati economici { uid, n, used, from, created, coachUids } che legge anche
// l'allenatore dei corsisti (coachUids, tenuto aggiornato da admin e segreteria): è lui a scalare subito
// quando segna «presente» (markAttendance). Regole dello scalo (come in Beach+):
// - vale per le presenze SEGNATE (dall'allenatore, da admin o segreteria) dal giorno di inizio del pacchetto;
//   la risposta del corsista («ci sarò») non scala nulla;
// - non si scala se l'allenamento è annullato o se il mese è coperto dal piano pagato (mensile, trimestrale, corso intero);
// - packuse/{id della presenza} ricorda quale pacchetto è stato usato: presenza tolta, allenamento annullato o
//   pacchetto spostato più avanti → l'allenamento torna nel pacchetto.
// Admin e segreteria allineano da soli presenze e contatori quando aprono l'app, e con «Ricalcola pacchetti».
const packStart = k => k.from || new Date(k.created || 0).toLocaleDateString('sv');
// allenatori degli allenamenti in cui il corsista è nel gruppo (mese scorso, questo e il prossimo)
function coachUidsFor(uid) {
  const s = Store.state, now = new Date().toLocaleDateString('sv').slice(0, 7);
  const sh = n => { const d = new Date(now + '-15T12:00'); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('sv').slice(0, 7); };
  const months = [sh(-1), now, sh(1)];
  const out = new Set();
  (s.groups || []).filter(g => months.includes(g.month) && (g.uids || []).includes(uid)).forEach(g => {
    const tr = (s.trainings || []).find(x => x.id === g.tid);
    if (tr && tr.coachUid) out.add(tr.coachUid);
  });
  return [...out].sort();
}
// allenamenti già usati di un pacchetto senza contatore: il "used" di prima, o di più se ci sono più scali registrati
// (packuse e spot confermati con quel pacchetto)
function usedGuess(id, k) {
  const s = Store.state;
  const n = (s.packuse || []).filter(u => u.pack === id).length + (s.spots || []).filter(sp => sp.pack === id && sp.status === 'ok' && !sp.packBack).length;
  return Math.min(Math.max(k.used || 0, n), k.n || 0);
}
// contatore di un pacchetto in una transazione; se manca (pacchetti di prima) si prepara dai dati del pacchetto
async function pcRead(tx, id) {
  const s = await tx.get(doc(db, 'packcount', id));
  if (s.exists()) return Object.assign({ id, exists: true }, s.data());
  const k = await tx.get(doc(db, 'packs', id));
  if (!k.exists()) return null;
  const d = k.data();
  return { id, exists: false, uid: d.uid, n: d.n || 0, used: usedGuess(id, d), from: packStart(d), created: d.created || 0, coachUids: coachUidsFor(d.uid) };
}
function pcWrite(tx, c, used) {
  const ref = doc(db, 'packcount', c.id);
  if (c.exists) tx.update(ref, { used });
  else { tx.set(ref, { uid: c.uid, n: c.n, used, from: c.from, created: c.created, coachUids: c.coachUids || [] }); c.exists = true; }
  c.used = used;
}
function syncPackUse(tid, date, uid) {
  if (!staff()) return Promise.resolve('none');
  const attId = `${tid}_${date}_${uid}`, m = date.slice(0, 7);
  const ids = new Set((Store.state.packs || []).filter(k => k.uid === uid).map(k => k.id));
  (Store.state.packcount || []).filter(k => k.uid === uid).forEach(k => ids.add(k.id));
  const used = (Store.state.packuse || []).find(u => u.id === attId);
  if (used && used.pack) ids.add(used.pack);
  return runTransaction(db, async tx => {
    const refs = { a: doc(db, 'att', attId), u: doc(db, 'packuse', attId), o: doc(db, 'occ', `${tid}_${date}`), p: doc(db, 'plans', `${uid}_${m}`), ath: doc(db, 'athletes', uid), tr: doc(db, 'trainings', tid) };
    const keys = Object.keys(refs), snaps = await Promise.all(keys.map(k => tx.get(refs[k])));
    const g = Object.fromEntries(keys.map((k, i) => [k, snaps[i].exists() ? snaps[i].data() : null]));
    const ks = [];
    for (const id of ids) { const c = await pcRead(tx, id); if (c) ks.push(c); }
    const a = g.a, has = g.u;
    // presenza segnata (forced); una risposta del corsista già scalata con le regole di prima resta scalata
    let want = !!(a && a.status === 'in' && (a.forced || has));
    if (want && g.o && g.o.cancelled) want = false;
    if (want) {
      const pre = g.ath && (g.ath.prepaid || {})[m], extra = !!(g.tr && g.tr.date);
      if (g.p && (extra || (g.p.tids || []).includes(tid)) && (g.p.paid || pre)) want = false;
    }
    const cur = has ? ks.find(k => k.id === has.pack) : null;
    if (has && want && cur && cur.from <= date) return 'kept';
    if (!has && !want) return 'none';
    const delta = {};
    if (has && cur) delta[cur.id] = -1;
    let pick = null;
    if (want) {
      pick = ks.filter(k => k.from <= date && (k.n || 0) - (k.used || 0) + (has && cur && cur.id === k.id ? 1 : 0) > 0)
        .sort((x, y) => x.from.localeCompare(y.from) || (x.created || 0) - (y.created || 0))[0] || null;
      if (pick) delta[pick.id] = (delta[pick.id] || 0) + 1;
    }
    Object.entries(delta).forEach(([id, d]) => { if (d) { const k = ks.find(x => x.id === id); pcWrite(tx, k, Math.max(0, (k.used || 0) + d)); } });
    if (pick) tx.set(refs.u, { pack: pick.id, uid, tid, date, at: Date.now(), by: user.uid });
    else if (has) tx.delete(refs.u);
    return pick ? 'used' : has ? 'released' : 'nopack';
  });
}
// Ricalcola: tutte le presenze (anche vecchie) dei corsisti indicati, o di tutti quelli con un pacchetto.
async function recalcPacks(uids) {
  if (!staff()) return 0;
  const list = uids || [...new Set((Store.state.packs || []).map(k => k.uid).filter(Boolean))];
  let n = 0;
  for (const uid of list) {
    const [att, pu] = await Promise.all([getDocs(query(collection(db, 'att'), where('uid', '==', uid))), getDocs(query(collection(db, 'packuse'), where('uid', '==', uid)))]);
    const all = new Map();
    att.docs.forEach(d => all.set(d.id, d.data()));
    pu.docs.forEach(d => { if (!all.has(d.id)) all.set(d.id, d.data()); });
    const items = [...all.values()].filter(x => x.tid && x.date).sort((x, y) => x.date.localeCompare(y.date));
    for (const x of items) { const r = await syncPackUse(x.tid, x.date, uid); if (r === 'used' || r === 'released') n++; }
  }
  return n;
}
// Allineamento automatico (admin e segreteria): presenze dell'ultimo mese che non corrispondono a packuse.
let packTimer = null, packBusy = false;
const packTried = new Map();
const pcOf = id => (Store.state.packcount || []).find(c => c.id === id);
const pcUsed = k => { const c = pcOf(k.id); return c ? c.used || 0 : k.used || 0; };
function packWantLocal(a, has) {
  const s = Store.state, m = a.date.slice(0, 7);
  if (a.status !== 'in' || !(a.forced || has)) return false;
  const o = (s.occ || []).find(x => x.tid === a.tid && x.date === a.date);
  if (o && o.cancelled) return false;
  const p = (s.plans || []).find(x => x.uid === a.uid && x.month === m), ath = (s.athletes || []).find(x => x.id === a.uid);
  const tr = (s.trainings || []).find(x => x.id === a.tid), pre = ath && (ath.prepaid || {})[m];
  if (p && ((tr && tr.date) || (p.tids || []).includes(a.tid)) && (p.paid || pre)) return false;
  return (s.packs || []).some(k => k.uid === a.uid && packStart(k) <= a.date && ((k.n || 0) - pcUsed(k) > 0 || (s.packuse || []).some(u => u.pack === k.id && u.id === `${a.tid}_${a.date}_${a.uid}`)));
}
function schedulePackSync() {
  if (packTimer || packBusy) return;
  packTimer = setTimeout(async () => {
    packTimer = null;
    const s = Store.state;
    if (!staff() || !(s.packs || []).length) return;
    const withPack = new Set((s.packs || []).map(k => k.uid));
    const used = new Map((s.packuse || []).map(u => [u.id, u]));
    const todo = [];
    (s.att || []).filter(a => withPack.has(a.uid) && a.tid && a.date).forEach(a => {
      const id = `${a.tid}_${a.date}_${a.uid}`, has = used.has(id), want = packWantLocal(a, has);
      if (want !== has) todo.push({ id, tid: a.tid, date: a.date, uid: a.uid, sig: `${want}|${has}|${a.status}` });
    });
    // packuse senza presenza (presenza tolta) dell'ultimo mese
    const attIds = new Set((s.att || []).map(a => `${a.tid}_${a.date}_${a.uid}`));
    const since = new Date(); since.setDate(since.getDate() - 31);
    (s.packuse || []).filter(u => !attIds.has(u.id) && u.date >= since.toLocaleDateString('sv')).forEach(u => todo.push({ id: u.id, tid: u.tid, date: u.date, uid: u.uid, sig: 'orphan' }));
    const go = todo.filter(x => packTried.get(x.id) !== x.sig).slice(0, 20);
    if (!go.length) return;
    packBusy = true;
    try {
      for (const x of go) { packTried.set(x.id, x.sig); await syncPackUse(x.tid, x.date, x.uid).catch(e => console.warn('pacchetti', e)); }
    } finally { packBusy = false; }
  }, 3000);
}
// Contatori dei pacchetti (admin e segreteria): uno per pacchetto, creati per i pacchetti di prima (con gli
// allenamenti già usati), con gli allenatori aggiornati quando cambiano gruppi o allenatori; tolti con il pacchetto.
const pcLoaded = new Set();
let pcTimer = null, pcBusy = false;
function schedulePcSync() {
  if (pcTimer || pcBusy) return;
  pcTimer = setTimeout(() => {
    pcTimer = null;
    if (!staff() || !trLoaded || !['packs', 'packcount', 'groups'].every(k => pcLoaded.has(k))) return;
    const s = Store.state, have = new Map((s.packcount || []).map(c => [c.id, c]));
    const batch = writeBatch(db);
    let n = 0;
    (s.packs || []).forEach(k => {
      const want = { uid: k.uid, n: k.n || 0, from: packStart(k), created: k.created || 0, coachUids: coachUidsFor(k.uid) };
      const c = have.get(k.id);
      if (!c) { batch.set(doc(db, 'packcount', k.id), Object.assign({ used: usedGuess(k.id, k) }, want)); n++; return; }
      const diff = Object.keys(want).filter(f => JSON.stringify(want[f]) !== JSON.stringify(c[f] == null ? (f === 'coachUids' ? [] : c[f]) : c[f]));
      if (diff.length) { batch.update(doc(db, 'packcount', k.id), Object.fromEntries(diff.map(f => [f, want[f]]))); n++; }
    });
    const ids = new Set((s.packs || []).map(k => k.id));
    (s.packcount || []).forEach(c => { if (!ids.has(c.id)) { batch.delete(doc(db, 'packcount', c.id)); n++; } });
    if (!n) return;
    pcBusy = true;
    batch.commit().catch(onError).finally(() => { pcBusy = false; });
  }, 1500);
}
// Pacchetti (admin e segreteria): crea (con il suo contatore), modifica l'inizio, elimina (solo se non usato e non pagato).
function savePack(id, data) {
  const batch = writeBatch(db);
  if (id) {
    batch.update(doc(db, 'packs', id), data);
    const pc = {};
    if (data.from) pc.from = data.from;
    if (data.n) pc.n = data.n;
    if (Object.keys(pc).length && pcOf(id)) batch.update(doc(db, 'packcount', id), pc);
    return batch.commit();
  }
  const ref = doc(collection(db, 'packs')), created = Date.now();
  const d = Object.assign({ used: 0, created, by: user.uid }, data);
  batch.set(ref, d);
  batch.set(doc(db, 'packcount', ref.id), { uid: d.uid, n: d.n, used: 0, from: packStart(d), created, coachUids: coachUidsFor(d.uid) });
  return batch.commit().then(() => ref);
}
function deletePack(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'packs', id)); batch.delete(doc(db, 'packcount', id));
  return batch.commit();
}

// Scheda di un ragazzo SENZA ACCOUNT: ID "k-" + codice casuale (mai uguale all'UID di un account), usato come un UID
// in gruppi, presenze, piani, pacchetti, valutazioni e ricevute. La creano e la vedono solo admin e segreteria.
const newKidId = () => 'k-' + doc(collection(db, 'athletes')).id;
// Elimina la scheda senza account: tolta dai gruppi, piani (da questo mese) e pacchetti non usati cancellati.
// Ricevute, incassi, presenze e valutazioni passate restano (storico e obbligo fiscale).
function deleteKid(uid, groups, planIds, packIds) {
  if (!/^k-/.test(uid)) return Promise.reject(new Error('not-kid'));
  const batch = writeBatch(db);
  groups.forEach(g => batch.set(doc(db, 'groups', g.id), g.data));
  groups.filter(g => g.tr).forEach(g => batch.update(doc(db, 'trainings', g.data.tid), { ['sizes.' + g.data.month]: (g.data.uids || []).length }));
  planIds.forEach(id => batch.delete(doc(db, 'plans', id)));
  packIds.forEach(id => { batch.delete(doc(db, 'packs', id)); batch.delete(doc(db, 'packcount', id)); });
  batch.delete(doc(db, 'athletes', uid)); batch.delete(doc(db, 'tesserati', uid));
  return batch.commit();
}
// Collega la scheda senza account (from = "k-…") all'account del ragazzo che si è registrato (to = UID):
// tutto ciò che usava l'ID della scheda passa all'UID (gruppi, giornate, presenze, packuse, valutazioni, piani,
// pacchetti e contatori, spot, recuperi, ricevute, incassi), poi la scheda senza account si chiude.
// Prima gruppi e giornate (le regole delle valutazioni controllano il gruppo), poi il resto a blocchi di 400.
async function linkKid(from, to, toName) {
  if (!staff() || !/^k-/.test(from) || !to || /^k-/.test(to)) throw new Error('link');
  const q = (c, ...w) => getDocs(query(collection(db, c), ...w)).then(x => x.docs);
  const byUid = c => q(c, where('uid', '==', from));
  const [ath, groups, occs, plans, packs, pcs, pus, atts, evs, spots, xm, rcs, incs] = await Promise.all([
    getDoc(doc(db, 'athletes', from)), q('groups', where('uids', 'array-contains', from)), q('occ', where('members', 'array-contains', from)),
    ...['plans', 'packs', 'packcount', 'packuse', 'att', 'evals', 'spots', 'xmem', 'receipts', 'incassi'].map(byUid)]);
  if (!ath.exists()) throw new Error('no-sheet');
  const swap = l => (l || []).map(u => (u === from ? to : u));
  const ops = [];
  let b1 = writeBatch(db);
  groups.forEach(d => { const g = d.data(), names = Object.assign({}, g.names || {}); names[to] = toName || names[from] || ''; delete names[from];
    b1.update(d.ref, { uids: [...new Set(swap(g.uids))], names, updated: Date.now() }); });
  occs.forEach(d => b1.update(d.ref, { members: [...new Set(swap(d.data().members))] }));
  await b1.commit();
  const moveId = (col, d, newId, extra) => { ops.push(['set', doc(db, col, newId), Object.assign({}, d.data(), { uid: to }, extra || {})]); ops.push(['del', d.ref]); };
  // prima pacchetti e contatori (le regole di packuse controllano che il contatore sia dello stesso corsista)
  [packs, pcs].forEach(l => l.forEach(d => ops.push(['upd', d.ref, { uid: to }])));
  plans.forEach(d => moveId('plans', d, `${to}_${d.data().month}`));
  pus.forEach(d => { const x = d.data(); moveId('packuse', d, `${x.tid}_${x.date}_${to}`, { by: user.uid }); });
  atts.forEach(d => { const x = d.data(); moveId('att', d, `${x.tid}_${x.date}_${to}`); });
  spots.forEach(d => { const x = d.data(); moveId('spots', d, `${x.tid}_${x.date}_${to}`); });
  xm.forEach(d => { const x = d.data(); moveId('xmem', d, `${x.tid}_${to}`); });
  // valutazioni: nuova copia (movedFrom = scheda di origine, controllata dalle regole), poi la vecchia si cancella
  evs.forEach(d => { const x = d.data(); ops.push(['set', doc(db, 'evals', `${x.tid}_${x.date}_${to}`), Object.assign({}, x, { uid: to, movedFrom: from })]); });
  [rcs, incs].forEach(l => l.forEach(d => ops.push(['upd', d.ref, { uid: to }])));
  const a = Object.assign({}, ath.data());
  delete a.noAccount;
  ops.push(['set', doc(db, 'athletes', to), Object.assign(a, { linkedFrom: from, updated: Date.now() })]);
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([k, ref, data]) => { if (k === 'set') b.set(ref, data); else if (k === 'upd') b.update(ref, data); else b.delete(ref); });
    await b.commit();
  }
  // vecchie valutazioni e scheda senza account: solo dopo che le copie sono salvate
  const b2 = writeBatch(db);
  evs.forEach(d => b2.delete(d.ref));
  b2.delete(doc(db, 'athletes', from)); b2.delete(doc(db, 'tesserati', from));
  await b2.commit();
  return groups.length + occs.length + [plans, packs, pcs, pus, atts, evs, spots, xm, rcs, incs].reduce((n, l) => n + l.length, 0) + 1;
}

function saveAthlete(uid, data) { return setDoc(doc(db, 'athletes', uid), data, { merge: true }); }
function savePlan(p) { return setDoc(doc(db, 'plans', p.id), stripId(p)); }
// L'admin registra il proprio nome da giocatore (per essere inserito nei gruppi o come coach).
async function saveSelfProfile(d) {
  const prof = { first: d.first, last: d.last, gender: d.gender, created: Date.now() };
  await setDoc(doc(db, 'members', user.uid), prof);
  adminMember = Object.assign({ uid: user.uid, email: user.email || '' }, prof);
  refresh();
}
// Elimina un utente dall'app (admin): gruppi degli allenamenti, piani, scheda e profilo.
// Le ricevute restano (obbligo fiscale). Sul piano Spark non c'è il motore (Cloud Functions): l'account di accesso
// (Authentication) e le prenotazioni restano e vanno tolti a mano dalla console Firebase se serve.
function deleteUser(uid, groups, planIds, packIds) {
  const batch = writeBatch(db);
  groups.forEach(g => batch.set(doc(db, 'groups', g.id), g.data));
  groups.filter(g => g.tr).forEach(g => batch.update(doc(db, 'trainings', g.data.tid), { ['sizes.' + g.data.month]: (g.data.uids || []).length }));
  planIds.forEach(id => batch.delete(doc(db, 'plans', id)));
  (packIds || []).forEach(id => { batch.delete(doc(db, 'packs', id)); batch.delete(doc(db, 'packcount', id)); });
  ['members', 'accounts', 'athletes', 'tesserati', 'verified', 'bans', 'coaches'].forEach(c => batch.delete(doc(db, c, uid)));
  return batch.commit();
}
function setCoach(uid, data) { return data ? setDoc(doc(db, 'coaches', uid), data) : deleteDoc(doc(db, 'coaches', uid)); }
async function countBookings(uid) {
  const snap = await getCountFromServer(query(collection(db, 'bookings'), where('userId', '==', uid), where('first', '==', true)));
  return snap.data().count;
}

// Avviso per un utente (solo l'admin) o per gli amministratori ("admins").
function notify(to, text) {
  if (!user || !to) return;
  addDoc(collection(db, 'notices'), { to, text: String(text).slice(0, 400), at: Date.now(), by: user.uid }).catch(onError);
}
// "Ho letto": gli avvisi per tutti gli admin restano agli altri (si aggiunge solo il proprio uid a readBy).
function dismissNotice(id, shared) {
  return (shared ? updateDoc(doc(db, 'notices', id), { readBy: arrayUnion(user.uid) }) : deleteDoc(doc(db, 'notices', id))).catch(onError);
}

// Attività dell'utente per il Wrapped: presenze e spot (solo i propri dati).
async function loadMyActivity(uid) {
  const none = { docs: [] }, q = (c, ...w) => getDocs(query(collection(db, c), ...w)).catch(() => none);
  const [att, spots] = await Promise.all([q('att', where('uid', '==', uid)), q('spots', where('uid', '==', uid))]);
  return { att: att.docs.map(d => d.data()), spots: spots.docs.map(d => d.data()) };
}

// Scrive nel database solo le impostazioni modificate (campi, orari, regole di prenotazione, listino, avviso):
// le scrive l'admin (anche l'Admin Centro).
function push(state) {
  if (!isAdmin) return;
  const settings = JSON.stringify({ notice: state.notice || '', noticeUntil: state.noticeUntil || '', nicks: state.nicks || {}, courts: state.courts || [], booking: state.booking || null, bookRewards: state.bookRewards || null, prices: state.prices || null });
  if (settings === last.settings) return;
  last.settings = settings;
  // minMinutes e maxMinutes: durata minima e massima di una prenotazione (di serie 1 ora e 2 ore), lette dalle regole del database.
  const bkc = state.booking || {};
  const minMinutes = Math.max(30, Math.round(Number(bkc.minHours || 1) * 60)), maxMinutes = Math.max(minMinutes, Math.round(Number(bkc.maxHours || 2) * 60));
  setDoc(doc(db, 'data', 'settings'), { json: settings, updated: Date.now(), minMinutes, maxMinutes }).catch(onError);
}

// L'utente si crea con un'app Firebase separata, così l'admin resta collegato.
let second = null;
function secondAuth() {
  if (!second) {
    const app2 = initializeApp(firebaseConfig, 'admin-create');
    second = getAuth(app2);
    try {
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('pcm-emulator') === '1') connectAuthEmulator(second, `http://${location.hostname}:${emuPort('au', 9099)}`, { disableWarnings: true });
    } catch (e) { /* ignore */ }
  }
  return second;
}
window.Cloud = {
  saveEditorial,
  register,
  updateProfile,
  sendMessage,
  deleteMessage,
  markRead,
  setBan,
  saveBooking,
  deleteBooking,
  addRecurring,
  deleteRecurring,
  loadBookingsDay, bookingInfo,
  countBookings,
  loadMyActivity,
  notify,
  dismissNotice,
  resendVerification,
  checkVerified,
  get verified() { return !!(user && (user.emailVerified || manualOk)); },
  setManualVerified,
  adminCreateUser,
  get member() { return member; },
  get coach() { return coach; },
  acceptPrivacy,
  requestDeletion,
  get adminMember() { return adminMember; },
  saveSelfProfile,
  renameMember,
  deleteUser,
  saveTraining,
  deleteTraining,
  saveGroups,
  saveAthlete,
  savePlan,
  setAttendance,
  markAttendance,
  newKidId,
  deleteKid,
  linkKid,
  saveEvals,
  syncPackUse,
  recalcPacks,
  applySpot,
  withdrawSpot,
  seeSpot,
  decideSpot,
  setOccCancelled,
  setOccFree,
  saveBkPlayers, moveBkPlayers, extraTrainingBlocks, setOccMembers,
  recordPayment,
  voidReceipt,
  renumberReceipts,
  unpay,
  savePack,
  recordIncasso,
  insertIncasso,
  voidIncasso,
  setReceiptHolder,
  loadTrainingRange,
  deletePack,
  setCoach,
  get user() { return user; },
  get isAdmin() { return isAdmin; },
  get roles() { return roles; },
  get general() { return isGeneral; },
  get generalUids() { return generalUids; },
  get center() { return staff() || !!roles.center; },
  get cashier() { return staff() || !!roles.cash; },
  get seg() { return isSeg; },
  get staff() { return staff(); },
  setRole,
  setUserRole,
  push,
  login: (email, password) => signInWithEmailAndPassword(auth, email, password),
  loginGoogle,
  completeProfile,
  get authBusy() { return authBusy; },
  get googleUser() { return !!(user && (user.providerData || []).some(p => p.providerId === 'google.com')); },
  logout: () => { member = null; return signOut(auth); },
  resetPassword: email => sendPasswordResetEmail(auth, email)
};
refresh();
