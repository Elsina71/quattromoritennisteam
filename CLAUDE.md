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
  Vede **tutte le schede di valutazione dei propri corsisti** (anche scritte da altri allenatori) nel cruscotto
  «I miei corsisti» (`#/valutazioni`): solo nome e voti, niente dati della scheda corsista, contatti, pacchetti o pagamenti.
  Non vede certificati medici, contatti o note dei corsisti (solo admin e segreteria).
- **Utente**: chiunque si registra; prenota i campi per sé.
- **Admin, segreteria e cassa possono essere anche allenatori** (es. Carlo Porqueddu, admin e allenatore): casella
  «Anche allenatore» nella scheda utente e in «Crea utente» (solo l'admin; crea/toglie `coaches/{uid}`), badge di entrambi i
  ruoli. Cambiando ruolo resta allenatore, tranne passando a «Utente». Chi è staff e allenatore compare tra gli allenatori
  dei moduli e in Allenamenti ha il filtro «Tutti gli allenamenti / I miei allenamenti» (`ui.trMine`, `staffCoach()`).

## Privacy e visibilità
- La lista completa degli utenti la vedono solo admin e segreteria. Un elenco a scelta dentro un modulo va bene.
- Le email non sono mai visibili agli altri utenti. Eccezione decisa dal titolare: la **cassa vede i contatti**
  (telefono ed email della persona o del genitore) per mandare le ricevute (raccolta `contatti`, vedi Tecnica).
- Prenotazioni: i nomi li vedono solo admin, segreteria e chi ha prenotato; tutti gli altri vedono solo libero/occupato
  (collezione `busy` pubblica e senza nomi, `bookings` riservata).

## Prenotazioni
- Campi definiti dall'admin: nome, tipo (Tennis o Padel), orari di apertura.
- Griglia a mezz'ore; durate di 1 ora, 1 ora e 30, 2 ore. Nessun prezzo mostrato.
- Admin e segreteria possono prenotare anche per chi non è registrato (solo il nome).
- Giorni avanti (`booking.daysAhead`, pagina Campi): fin quanti giorni dopo oggi si prenota; **0 = nessun limite**.
  Non c'è un preavviso minimo: si prenota anche all'ultimo momento, fino all'inizio della mezz'ora.
- Telefono facoltativo nella prenotazione (precompilato con l'ultimo usato): `bkphone/{gid}`, lo leggono solo
  admin, segreteria e chi ha prenotato (mai in `busy`); l'ultimo telefono lasciato finisce anche nei `contatti` della cassa.
- Pagina Campi: ogni campo è una riga compatta (nome, tipo, orari in breve) con «Modifica» ed «Elimina campo» (con conferma);
  una sola scheda aperta alla volta; «Nuovo campo» in fondo. I **premi delle prenotazioni** sono chiusi in un details e
  si mostrano agli utenti solo se l'admin li attiva (`bookRewards.on`, di serie spenti).
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
- **Allenamento su più giorni** (nuovo allenamento settimanale): nel modulo «Giorni e orari» si aggiungono più righe
  giorno + orario (es. lun 18–20, mer 15–17, ven 16–18). Si crea un allenamento per giorno, nello stesso invio
  (`Cloud.saveTrainingSeries`), con gli stessi nome, livello, allenatore e campi e lo stesso `series`; ognuno blocca i suoi
  campi nel suo orario. La scheda mostra «Anche: …» con gli altri giorni. «Aggiungi un corsista» lo mette di serie in tutti
  i giorni (casella), togliendolo esce da tutti i giorni del mese. Ogni giorno si modifica o si elimina da solo.
- Pagina «Allenamenti e gruppi»: **lista compatta** (`trBlocks`/`trCompact`), una riga per allenamento con nome,
  allenatore (o «Allenatore da scegliere»), giorni e orari e il numero di corsisti; si apre per vedere tutto. Un allenamento
  su più giorni è **una sola riga e una sola scheda** (`seriesCard`): un gruppo del mese (il corsista va in tutti i giorni;
  «solo lun, mer» se manca in qualche giorno), poi giorno per giorno prossima giornata, «Modifica questo giorno» ed
  «Elimina questo giorno». L'allenatore si vede sempre nelle informazioni.
- **Secondo allenatore** (facoltativo, `coach2Uid` sull'allenamento, diverso dal primo): nel nuovo allenamento su più giorni
  si sceglie riga per riga (es. lun Alessio + Marta, gio Alessio + Carlo); in «Modifica questo giorno» e nei recuperi/privati
  c'è il menu «Secondo allenatore». Ha gli stessi permessi del primo su quell'allenamento: vede gruppo e corsisti, segna le
  presenze (scala il pacchetto), compila la scheda di valutazione. `coach2Uid` si copia in `groups`, `att`, `spots`, `evals`
  (le regole controllano che sia quello dell'allenamento: `trCoach2`, `co2Ok`, `coachOfTr` accetta primo o secondo) ed entra
  in `packcount.coachUids` ed `evaccess.coachUids`. Nelle schede si vedono entrambi i nomi.
- **Visitatori (senza accesso)**: in Allenamenti il riquadro «I nostri allenamenti» (`publicTrainings`) mostra solo nome e
  categoria (livello), giorni e orari degli allenamenti settimanali (i giorni dello stesso allenamento insieme); niente
  allenatori, campi, corsisti o posti, niente recuperi né allenamenti privati.
- Tipi (badge nelle liste): **Allenamento settimanale**, **Recupero allenamento** (una data, `tr.date`),
  **Allenamento privato** (`type: 'private'`, una data, un allievo: utente, ragazzo senza account o esterno `x-…` con il solo nome, un maestro).
- Livelli, in quest'ordine: Minitennis 4-6 anni, Scuola Tennis Orange 6-8 anni, Scuola Tennis Green 8-10 anni,
  Bambini misti, Perfezionamento 10-13 anni, Preagonistica 11-14 anni, Agonistica 12-18 anni, Performance - Avanzato,
  Tennis Adulti (chiavi `mini, orange, green, kids, perf, preago, ago, adv, adult`; un livello vecchio si mostra com'è scritto).
- **Livelli modificabili dall'admin**: in «Allenamenti e gruppi» il riquadro «Livelli dei gruppi» (`levelsCard`) per
  rinominare, riordinare (frecce), aggiungere e togliere i livelli. Si salvano in `data/settings` → `levels: [{ key, name }]`
  (senza modifiche valgono quelli di serie `DEFAULT_LEVELS`; nome vuoto = nome di serie tradotto). Un livello nuovo ha una
  chiave ricavata dal nome (`lvSlug`, solo a-z0-9) e un colore del badge a rotazione (`lvl-c0…c7`); un livello usato da un
  allenamento non si toglie. I livelli valgono anche per richieste di allenamento privato e iscrizioni online: le regole
  controllano solo che la chiave sia `[a-z0-9]{1,20}`.

## Richieste di allenamento personalizzato (privato)
- Bottone «Richiedi un allenamento personalizzato» in Allenamenti (anche per i visitatori), pagina `#/ptreq`:
  giorno (fino a 60 giorni), ora a mezz'ore, durata 1 h / 1 h 30 / 2 h, maestro (team di `js/club.js` + allenatori con
  account, senza doppioni, oppure «indifferente»), livello, telefono obbligatorio, note. Il visitatore mette anche nome,
  cognome e la presa visione dell'informativa. Nessun accesso anonimo: le regole ammettono la sola creazione senza login
  con i campi previsti; ID = cifre del telefono + giorno + ora (niente doppioni); un invio ogni 3 minuti per dispositivo.
- Admin e segreteria (avviso in prima pagina e contatore): **Conferma** (maestro e campo: di serie il primo libero tra
  i primi tre campi da tennis della lista, Campo 1 → 2 → 3) o **Rifiuta**. La conferma, in un solo invio, crea
  l'allenamento privato, blocca il campo (come i recuperi), il gruppo con il nome (lo vede il maestro), `xmem` e
  un avviso nell'app per l'utente registrato; poi apre il WhatsApp di chi conferma con il messaggio pronto
  («Allenamento privato confermato per il giorno … alle ore … – Quattro Mori Tennis Team», link `wa.me`, 39 se manca il prefisso).
  Per l'esterno: «Chiama per confermare» con il link `tel:`. Il telefono lo vedono solo admin e segreteria.

## Il circolo e iscrizioni online
- Pagina pubblica «Il circolo» (`#/club`): chi siamo, il team (in `js/club.js`), calendario della scuola
  (15 settembre – 15 giugno, agonisti fino al 31 luglio: date di serie del «corso intero» nel listino), valori,
  diventa sponsor, dove siamo (campi in Via Soru e Mari 3, sede legale in via Marco Polo 12, link a Google Maps: `Club.courtsMap`).
- Iscrizione online dei minori (`#/iscrizione`, pubblica): genitore e allievo, livello, consenso alle immagini (facoltativo,
  separato), informativa. Raccolta `enroll` (solo creazione per tutti, lettura e gestione solo staff). In «Iscrizioni»
  (`#/iscrizioni`): «Crea scheda corsista» (scheda senza account con il genitore come contatto) o «Archivia».

## Scheda di valutazione (decisa dal titolare)
- In fondo all'allenamento c'è il bottone «Scheda di valutazione dell'allenamento».
- Per ogni corsista 7 voci, voto da 1 a 10, **6 è la sufficienza**; ogni voce ha sempre la sua legenda "cosa guardare":
  Tecnica (colpi eseguiti bene e costanti), Movimento (gambe attive, giusta distanza dalla palla),
  Controllo (precisione e profondità sui bersagli), Scelte di gioco (capisce e applica il tema dell'esercizio),
  Intensità (ritmo mantenuto fino alla fine), Atteggiamento (concentrazione, reazione agli errori, ascolto),
  Consistenza (regolarità: pochi errori a un buon ritmo).
- Nota del giorno di una riga: un punto forte + una cosa da migliorare.
- Non serve valutare tutte le voci: bastano le 2-3 lavorate quel giorno; la scheda completa una volta al mese.
- **Cruscotto delle valutazioni** (scheda del corsista per admin e segreteria; «I miei corsisti» per l'allenatore):
  periodo Settimana (lun–dom) · Mese · Trimestre (solare, come il Wrapped) · Semestre (della stagione: set–feb, mar–ago) · Tutto,
  con le frecce; voti per allenamento del periodo, media per voce (con il numero di voti) e media generale con la linea del 6;
  grafico a linee in SVG disegnato a mano (un punto per settimana ISO, o per scheda nella settimana o con poche schede;
  settimane senza voti = buchi), voci scelte una alla volta o tutte, più la linea «Media» tratteggiata. Calcoli in
  `js/logic.js` (provati in `tests/logic.test.mjs`). Lettura per l'allenatore: `evaccess/{uid corsista}.coachUids`
  (allenatori dei gruppi degli ultimi 12 mesi, aggiornato dall'app di admin e segreteria); le scritture restano
  all'allenatore di quell'allenamento, admin e segreteria.

## Cassa
- Quote: singolo allenamento, mensile, trimestrale, corso intero, pacchetto di lezioni. Il tesseramento è una quota a parte.
- Si incassa solo in sede (contanti, POS, bonifico); admin o segreteria segnano «pagato».
- Tesseramento FITP: gestito sulla piattaforma della federazione; qui solo pagato / non pagato.
- Certificato medico agonistico o non agonistico, con avvisi a 30 e a 7 giorni dalla scadenza.
- Intestatario della ricevuta: utente/scheda, nessuno, oppure **«Intestatario a mano (non registrato)»** (solo nome e cognome
  obbligatori; gli altri dati facoltativi; nel PDF i dati mancanti restano righe da compilare a penna). Si salva solo
  nella ricevuta (`person.manual`), letta solo da staff e cassa.
- **«Invia ricevuta»** (WhatsApp) e **«Invia per email»** (admin, segreteria, cassa): PDF `Ricevuta_<num>_<cognome>.pdf`;
  con la condivisione del dispositivo (`navigator.share` con il file) si sceglie WhatsApp o la posta con il PDF allegato;
  altrimenti si scarica il PDF e si apre `wa.me` (numero della scheda o del genitore, o quello scritto a mano) o `mailto:`
  (l'email si copia anche negli appunti), con la nota «Allega il PDF appena scaricato».
- «Invia ricevuta» apre prima il riquadro **Numero WhatsApp** (già scritto se la scheda lo ha, altrimenti lo scrive
  chi incassa, anche la cassa): con un numero si scarica il PDF e si apre la chat di quel numero (`wa.me`, 39 se manca
  il prefisso); lasciato vuoto si usa la condivisione del dispositivo. Il numero scritto a mano non si salva.
- Nella lista degli incassi, sotto il nome, telefono ed email della persona (per i ragazzi del genitore), cliccabili.

## Grafica
- L'app deriva da Beach+ Arena (stessa grafica e stessi componenti): lo stile predefinito è il design **Erba**
  (prato all'inglese a righe, viola e crema; `BpaSeason.design` in `js/boot.js`); il design Quattro Mori resta tra le scelte. Ognuno può scegliere un altro design e una tavolozza
  di colori in Impostazioni (scelta salvata solo su quel dispositivo, con il consenso alle preferenze).
- Gli stili delle feste (Halloween, Natale, Capodanno, Befana) si accendono da soli nei loro periodi (`js/boot.js`).
- Marchio: `img/mark.svg` (cerchio blu, croce rossa, quattro palline); icone PNG generate da quello.
- Lingue: italiano (predefinita), inglese e spagnolo (`js/i18n.js`, locale `es-ES`; pulsanti IT/EN/ES). I testi legali sono
  solo in italiano (`js/legal.js`): in inglese e spagnolo compare l'avviso tradotto. `npm test` controlla che le tre lingue
  abbiano le stesse chiavi e che ogni chiave usata nel codice esista (`tests/i18n.test.mjs`).

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
- Raccolte nuove: `contatti/{uid}` = { phone, email, parent: { name, phone, email } } (solo contatti, niente altro;
  la legge la cassa, la scrive l'app di admin e segreteria: telefono della scheda, altrimenti l'ultimo di prenotazioni
  e richieste, che resta finché non ne arriva uno nuovo; email dell'account o della scheda), `bkphone/{gid}` (telefono della prenotazione), `ptreq/{id}` (richieste di allenamento privato),
  `pub/coaches` (nomi degli allenatori con account, pubblico, aggiornato dall'app dello staff), `enroll/{id}` (iscrizioni
  online). Dati del circolo (indirizzi, email quattromoritennisteam@gmail.com, PEC, team, calendario) solo in `js/club.js`.
- Login con Google: «Continua con Google» (`signInWithPopup`, `authDomain` di serie); al primo accesso si completa il profilo
  (nome e cognome da Google, sesso, informativa). CSP in `firebase.json` con apis.google.com e accounts.google.com.
- Prove: `npm test` (calcoli e traduzioni), `npm run test:rules` (regole, con l'emulatore), `npm run check` (sintassi). Le prime due
  girano anche su GitHub prima di pubblicare. In locale: `npm run emulatori`, `npm run dati-prova`, poi
  `python3 -m http.server 5173` e http://localhost:5173/?emu=1 (porte diverse: `EMU_FS=8180 EMU_AU=9199` per i dati di prova
  e `?emu=1&fs=8180&au=9199` nell'app).
