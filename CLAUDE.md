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
  (collezione `slots` pubblica e senza nomi, `bookings` riservata).

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
- Colori dal logo: blu del cerchio come unico colore (pieno solo sui segni piccoli, tinte chiare sulle superfici),
  rosso della croce solo come segnale (marchio, linea dell'ora attuale). Carattere DM Sans. Niente ombre a riposo,
  niente gradienti. Deve restare diversa dalle altre app del titolare.

## Tecnica
- JavaScript puro, nessun passaggio di compilazione. Firebase 10.12.2 in `vendor/firebase`.
- Progetto Firebase `quattromoritennisteam-d3258`, database in `europe-west8`, piano Spark (niente Cloud Functions per ora).
- Prove: `npm test` (calcoli) e `npm run test:rules` (regole, con l'emulatore). Girano anche su GitHub prima di pubblicare.
