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
- **Allenatore**: vede la composizione dei propri allenamenti (la valutazione dei corsisti si decide più avanti).
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

## Corsi e cassa (prossimi passi)
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
