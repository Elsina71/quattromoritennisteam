# Regole del progetto (Quattro Mori Tennis Team)

App del circolo Quattro Mori Tennis Team (Quartu Sant'Elena, Sardegna): prenotazione dei campi da tennis e padel, poi corsi, corsisti,
allenamenti, allenatori, cassa. Regole decise dal titolare: valgono per ogni modifica.

## Lingua e lavoro
- Rispondere sempre in italiano, in modo semplice.
- Pubblicare (PR + merge su `main`) solo quando l'utente scrive «pubblica». L'unione su `main` pubblica il sito da sola.
- Non toccare Beach+ Arena (repository Elsina71/Repository-principale), la Panhellenic (Elsina71/panhellenictour)
  né i record MX/mail su Aruba.

## Ruoli
- **Admin**: tutti i permessi (anche cambiare i ruoli e gestire i campi). Il titolare è admin per la sua email
  (nel codice e nelle regole c'è solo l'impronta SHA-256, mai l'email in chiaro).
- **Segreteria**: utenti (modifica e cancellazione di utenti e allenatori), prenotazioni di tutti, corsisti, allenamenti,
  certificati medici, tesseramento, pagamenti delle quote. Non cambia i ruoli.
- **Allenatore**: vede solo i propri allenamenti e i nomi dei propri corsisti, e compila la scheda di valutazione.
  Non vede certificati medici, contatti o note dei corsisti (solo admin e segreteria).
- **Utente**: chiunque si registra; prenota i campi per sé.

## Privacy e visibilità
- La lista completa degli utenti la vedono solo admin e segreteria. Un elenco a scelta dentro un modulo va bene.
- Le email non sono mai visibili agli altri utenti.
- Prenotazioni: i nomi li vedono solo admin, segreteria e chi ha prenotato; tutti gli altri vedono solo libero/occupato
  (collezione `busy` pubblica e senza nomi, `bookings` riservata).

## Prenotazioni
- Campi definiti dall'admin: nome, tipo (Tennis o Padel), orari di apertura.
- Griglia a mezz'ore; durate di 1 ora, 1 ora e 30, 2 ore. Nessun prezzo mostrato.
- Admin e segreteria possono prenotare anche per chi non è registrato (solo il nome).
- La segreteria nel codice c'è (vedi Tecnica): non gestisce i campi né le regole di prenotazione.

## Corsisti e allenamenti
- I corsisti sono schede gestite dalla segreteria: dati, genitore/contatto, note, certificato medico
  (agonistico / non agonistico, scadenza; avvisi a 30 e 7 giorni), FITP pagato/non pagato per l'anno in corso.
- La scheda può essere **con account** (utente registrato) o **senza account** (ragazzo non registrato: nome, cognome, sesso,
  nascita, genitore con telefono ed email facoltativa, note). Quella senza account si usa ovunque come le altre (gruppi,
  recuperi, presenze, piani e quote, pacchetti, valutazioni, cassa e ricevute con il genitore indicato, report).
  La vedono solo admin e segreteria; l'allenatore vede solo il nome. Se il ragazzo si registra, «Collega a un account».
- Le **presenze le segna l'allenatore** di quell'allenamento (o admin e segreteria). Il corsista con account risponde solo
  «ci sarò / non ci sarò» (serve per i posti spot) e non può cambiare una presenza già segnata.
- Allenamenti: titolo, giorno, ora, durata, campo, allenatore, corsisti; si possono ripetere ogni settimana.
  Occupano il campo nel tabellone (gli altri vedono "Allenamento"). Per cambiare giorno/ora/campo si ricrea.

## Scheda di valutazione (decisa dal titolare)
- In fondo all'allenamento c'è il bottone «Scheda di valutazione dell'allenamento».
- Per ogni corsista 7 voci, voto da 1 a 10, **6 è la sufficienza**; ogni voce ha sempre la sua legenda "cosa guardare":
  Tecnica (colpi eseguiti bene e costanti), Movimento (gambe attive, giusta distanza dalla palla),
  Controllo (precisione e profondità sui bersagli), Scelte di gioco (capisce e applica il tema dell'esercizio),
  Intensità (ritmo mantenuto fino alla fine), Atteggiamento (concentrazione, reazione agli errori, ascolto),
  Consistenza (regolarità: pochi errori a un buon ritmo).
- Nota del giorno di una riga: un punto forte + una cosa da migliorare.
- Non serve valutare tutte le voci: bastano le 2-3 lavorate quel giorno; la scheda completa una volta al mese.

## Cassa (prossimo passo)
- Quote: singolo allenamento, mensile, trimestrale, corso intero, pacchetto di lezioni. Il tesseramento è una quota a parte.
- Si incassa solo in sede (contanti, POS, bonifico); admin o segreteria segnano «pagato».
- Tesseramento FITP: gestito sulla piattaforma della federazione; qui solo pagato / non pagato.
- Certificato medico agonistico o non agonistico, con avvisi a 30 e a 7 giorni dalla scadenza.

## Grafica
- L'app deriva da Beach+ Arena (stessa grafica e stessi componenti): lo stile predefinito è il design **Quattro Mori**
  (Oswald + Source Sans 3, foto della bandiera, bordi rossi). Ognuno può scegliere un altro design e una tavolozza
  di colori in Impostazioni (scelta salvata solo su quel dispositivo, con il consenso alle preferenze).
- Gli stili delle feste (Halloween, Natale, Capodanno, Befana) si accendono da soli nei loro periodi (`js/boot.js`).
- Marchio: `img/mark.svg` (cerchio blu, croce rossa, quattro palline); icone PNG generate da quello.
- Lingue: italiano (predefinita) e inglese (`js/i18n.js`). I testi legali sono solo in italiano (`js/legal.js`).

## Tecnica
- JavaScript puro, nessun passaggio di compilazione. Firebase 10.12.2 in `vendor/firebase`; icone Tabler in `vendor/tabler`;
  jsPDF (ricevute) e JSZip (Excel e ZIP) in `vendor/jspdf` e `vendor/jszip`, caricati solo quando servono.
- File principali: `index.html`, `js/club.js` (dati dell'associazione: un solo posto), `js/app.js` (pagine e azioni),
  `js/cloud.js` (database e login), `js/store.js` (stato), `js/i18n.js`, `js/legal.js`, `js/boot.js`, `css/style.css`,
  `firestore.rules`.
- Indirizzo pubblico: https://quattromoritennisteam.web.app (sito Hosting `quattromoritennisteam`).
- Progetto Firebase `quattromoritennisteam-d3258`, database in `europe-west8`, piano Spark (niente Cloud Functions per ora):
  niente notifiche push; eliminando un utente l'account di accesso resta (si toglie dalla console); lo scalo dei
  pacchetti (`packuse`) lo fa l'app di admin e segreteria (vedi sotto).
- Ruoli nel codice e nelle regole: admin generale (titolare per impronta dell'email; altri nella raccolta `admins`,
  segnati anche con `roles/{uid}.general` solo come etichetta), **Admin** (`roles/{uid}.center`, in pagina "Admin"),
  **Segreteria** (`roles/{uid}.seg`), **Cassa** (`roles/{uid}.cash`), **Allenatore** (`coaches/{uid}`).
  In `js/app.js`: `admin()` = admin o segreteria (staff), `fullAdmin()` = solo admin (campi, regole di prenotazione,
  ruoli, listino, avvisi, articoli, messaggi), `segr()`, `coach()`, `cashier()`. In `firestore.rules`: `isAdmin()`,
  `isSeg()`, `isStaff()`, `isCash()`, `coachOfTr(tid)`; la segreteria modifica/elimina solo utenti e allenatori (`plainUser`).
- Pagina Utenti: «Crea utente» (seconda istanza Auth, funziona su Spark) con il ruolo nel modulo (la segreteria crea solo
  Utente e Allenatore); badge del ruolo e menu per cambiarlo (solo admin; un Admin lo nomina solo l'admin generale).
- Campi: tipo `tennis`/`padel` (badge e filtro in Prenota). Prenotazioni da 1 h a 2 h a mezz'ore: le regole controllano
  `minMinutes` (di serie 60) e `maxMinutes` (di serie 120) in `data/settings`.
- Scheda di valutazione: pagina `#/eval/{tid}/{data}`, raccolta `evals/{tid_data_uid}` (voti interi 1-10 sulle voci
  tec, mov, ctl, sce, int, att, con; nota ≤ 160 caratteri). Scrivono l'allenatore di quell'allenamento, admin e segreteria;
  leggono admin, segreteria e l'allenatore. Medie e ultime schede nella scheda del corsista (`#/athletes`).
- Certificato: `certType` (agon/nonagon) e `certExp`; avvisi entro 30 giorni (arancio) e 7 giorni o scaduto (rosso).
- Quote: mensile, trimestrale, corso intero (listino `c1`/`c2`, `courseFrom`/`courseTo`: copre tutti i mesi del corso),
  singolo allenamento (spot), pacchetto di lezioni; tesseramento FITP a parte (`athletes.fitp[stagione]`, categoria di cassa
  `q_fitp`). Modalità: contanti, POS, bonifico.
- Schede senza account: `athletes/k-…` (ID "k-" + codice casuale, mai uguale a un UID) con `noAccount: true`,
  `parent: { name, phone, email }`, `notes`, `gender`, `birthDate`; l'ID si usa come un UID in `groups.uids/names`, `att`, `plans`,
  `packs`, `packcount`, `packuse`, `evals`, `spots`, `receipts.uid`, `incassi.uid`, `tesserati` (con `parent` per la ricevuta).
  Regole: solo lo staff le crea e le legge (`kidId()`). Collegamento all'account: `Cloud.linkKid` sposta tutto sull'UID
  (le valutazioni con `movedFrom`, ammesso dalle regole solo per lo staff e con gli stessi voti).
- Pacchetti senza Cloud Functions: `packs` tiene prezzo e pagamento (solo staff e interessato); il contatore senza dati
  economici è in `packcount/{idPacchetto}` = { uid, n, used, from, created, coachUids }. `coachUids` (allenatori dei gruppi
  del corsista, mese scorso/corrente/prossimo) e i contatori dei pacchetti di prima li tiene aggiornati l'app di admin e
  segreteria (`schedulePcSync`). Quando l'allenatore segna «presente» (`Cloud.markAttendance`) scala **subito** in una
  transazione: `att` (forced) + `occ` + `packuse` + `packcount.used` +1 con `last` = id della presenza; togliendo la presenza
  -1 e packuse cancellato. Le regole ammettono solo ±1 con il packuse nella stessa scrittura, mai oltre `n`, solo per i suoi
  allenamenti, non se la giornata è annullata, prima di `from` o con il mese pagato (allora si salva solo la presenza).
  Scalano solo le presenze segnate (forced), non le risposte del corsista. Admin e segreteria: `syncPackUse`
  (subito), allineamento automatico, «Conferma la giornata» e «Ricalcola pacchetti» come rete di sicurezza.
- Login con Google: «Continua con Google» (`signInWithPopup`, `authDomain` di serie); al primo accesso si completa il profilo
  (nome e cognome da Google, sesso, informativa). CSP in `firebase.json` con apis.google.com e accounts.google.com.
- Prove: `npm test` (calcoli), `npm run test:rules` (regole, con l'emulatore), `npm run check` (sintassi). Le prime due
  girano anche su GitHub prima di pubblicare. In locale: `npm run emulatori`, `npm run dati-prova`, poi
  `python3 -m http.server 5173` e http://localhost:5173/?emu=1 (porte diverse: `EMU_FS=8180 EMU_AU=9199` per i dati di prova
  e `?emu=1&fs=8180&au=9199` nell'app).
