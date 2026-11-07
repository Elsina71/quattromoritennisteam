// Consenso per la memoria del browser (art. 122 Codice privacy, Linee guida Garante 2021).
// "Necessari": accesso all'account e la scelta stessa sui cookie (sempre attivi).
// "Preferenze": lingua, tema, colori e copia offline del database: salvati solo con il consenso.
// Senza consenso le funzioni si possono usare durante la visita, ma non resta salvato nulla.
window.Consent = (function () {
  var K = 'qm-consent', PREF_KEYS = ['pcm-lang', 'pcm-theme', 'pcm-design', 'pcm-design-hw', 'pcm-design-prev', 'qm-cookie-ok'];
  function get() { try { return JSON.parse(localStorage.getItem(K)) || null; } catch (e) { return null; } }
  function clearPrefs() {
    try {
      PREF_KEYS.forEach(function (k) { localStorage.removeItem(k); });
      // chiavi tecniche della copia offline del database
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('firestore_') === 0) localStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
    // copia offline del database (Firestore): si elimina, l'app la ricrea solo con il consenso
    try {
      if (indexedDB.databases) indexedDB.databases().then(function (l) { l.forEach(function (d) { if (d.name && d.name.indexOf('firestore/') === 0) indexedDB.deleteDatabase(d.name); }); });
    } catch (e) { /* ignore */ }
  }
  return {
    get: get,
    decided: function () { return !!get(); },
    prefs: function () { var c = get(); return !!(c && c.prefs); },
    set: function (prefs) {
      try { localStorage.setItem(K, JSON.stringify({ prefs: !!prefs, at: Date.now(), v: 1 })); } catch (e) { /* ignore */ }
      if (!prefs) clearPrefs();
    },
    // lettura/scrittura delle preferenze: solo con il consenso
    read: function (k) { if (!this.prefs()) return null; try { return localStorage.getItem(k); } catch (e) { return null; } },
    write: function (k, v) { if (!this.prefs()) return; try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    clearPrefs: clearPrefs
  };
})();
if (!Consent.prefs()) Consent.clearPrefs();

// Periodi a tema (ora del dispositivo): Halloween 29 ottobre – 3 novembre, Natale 8 – 26 dicembre,
// Capodanno 27 dicembre – 2 gennaio, Befana 5 – 7 gennaio.
// Lo stile del periodo si accende per tutti, finché in quel periodo non se ne sceglie un altro
// (la scelta vale fino alla fine del periodo).
window.BpaSeason = {
  // [stile, mese inizio (0 = gennaio), giorno inizio, mese fine, giorno fine]
  list: [['halloween', 9, 29, 10, 3], ['natale', 11, 8, 11, 26], ['capodanno', 11, 27, 0, 2], ['befana', 0, 5, 0, 7]],
  find: function (d) {
    d = d || new Date(); var n = d.getMonth() * 100 + d.getDate(), L = window.BpaSeason.list;
    for (var i = 0; i < L.length; i++) {
      var a = L[i][1] * 100 + L[i][2], b = L[i][3] * 100 + L[i][4];
      if (a <= b ? (n >= a && n <= b) : (n >= a || n <= b)) return L[i];
    }
    return null;
  },
  halloween: function (d) { return window.BpaSeason.current(d) === 'halloween'; },
  natale: function (d) { return window.BpaSeason.current(d) === 'natale'; },
  current: function (d) { var s = window.BpaSeason.find(d); return s ? s[0] : null; },
  // segno della scelta fatta durante il periodo: anno per Halloween (come prima), "stile-anno di inizio" per gli altri
  key: function (d) {
    d = d || new Date(); var s = window.BpaSeason.find(d), y = d.getFullYear();
    if (!s || s[0] === 'halloween') return String(y);
    if (s[1] > s[3] && d.getMonth() <= s[3]) y--;   // periodo a cavallo d'anno (Capodanno): conta l'anno di inizio
    return s[0] + '-' + y;
  },
  // stile a tema scelto DURANTE il suo periodo: vale solo fino alla fine del periodo, poi si torna allo stile di prima
  chosenInSeason: function (stored, picked) {
    var ids = window.BpaSeason.list.map(function (x) { return x[0]; });
    if (!stored || ids.indexOf(stored) < 0 || !picked) return false;
    return stored === 'halloween' ? /^\d{4}$/.test(picked) : picked.indexOf(stored + '-') === 0;
  },
  design: function (stored, picked, prev) {
    var s = window.BpaSeason.current();
    if (s && picked !== window.BpaSeason.key()) return s;
    if (stored && stored !== s && window.BpaSeason.chosenInSeason(stored, picked)) return prev || 'quattromori';
    return stored || 'quattromori';
  }
};
// Stile grafico scelto su questo dispositivo (applicato subito, prima del caricamento dell'app).
(function () {
  var th = Consent.read('pcm-theme'); if (th && th !== 'logo') document.documentElement.setAttribute('data-theme', th);
  var ds = BpaSeason.design(Consent.read('pcm-design'), Consent.read('pcm-design-hw'), Consent.read('pcm-design-prev')); if (ds !== 'classico') document.documentElement.setAttribute('data-design', ds);
})();

// Barra in basso sul telefono: nei browser interni delle app (Facebook, Instagram) su iPhone, mentre si scorre
// l'area visibile cambia altezza e gli elementi fissi restano indietro. Qui la barra segue il fondo visibile.
(function () {
  var vv = window.visualViewport, raf = 0, last = null;
  if (!vv) return;
  function upd() {
    raf = 0;
    var dy = vv.scale > 1.01 ? 0 : Math.round(vv.height + vv.offsetTop - window.innerHeight);
    if (Math.abs(dy) > 300) dy = 0;
    if (dy === last) return;   // si aggiorna solo se cambia (niente ridisegni a ogni scorrimento)
    last = dy;
    document.documentElement.style.setProperty('--nav-dy', dy + 'px');
  }
  function later() { if (!raf) raf = requestAnimationFrame(upd); }
  vv.addEventListener('resize', later); vv.addEventListener('scroll', later);
  window.addEventListener('scroll', later, { passive: true });
  upd();
})();
