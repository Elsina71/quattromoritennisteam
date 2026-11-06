# Regole del progetto (Quattro Mori Tennis Team)

App del circolo Quattro Mori Tennis Team (Cagliari): prenotazione dei campi da tennis e padel, poi corsi, corsisti,
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

## Corsisti e allenamenti
- I corsisti sono schede gestite dalla segreteria (non account dell'app): dati, genitore/contatto, certificato medico
  (agonistico / non agonistico, scadenza; avvisi a 30 e 7 giorni), FITP pagato/non pagato per l'anno in corso.
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
  niente notifiche push; eliminando un utente l'account di accesso resta (si toglie dalla console); lo scalo automatico
  dei pacchetti di allenamenti (`packuse`) è da rifare (TODO passo 2).
- Ruoli oggi: admin generale (titolare, per impronta dell'email; altri nella raccolta `admins`), Admin Centro
  (`roles/{uid}.center`), cassa (`roles/{uid}.cash`), coach (`coaches/{uid}`). La segreteria arriva nel passo 2.
- Prove: `npm test` (calcoli), `npm run test:rules` (regole, con l'emulatore), `npm run check` (sintassi). Le prime due
  girano anche su GitHub prima di pubblicare. In locale: `npm run emulatori`, `npm run dati-prova`, poi
  `python3 -m http.server 5173` e http://localhost:5173/?emu=1.
