# Quattro Mori Tennis Team

App del circolo Quattro Mori Tennis Team (Tennis & Padel · Quartu Sant'Elena · Sardegna). Indirizzo: https://quattromoritennisteam.web.app

L'app parte dal codice di Beach+ Arena (stessa grafica e stessi componenti), senza le parti che qui non servono
(tornei, classifiche, giochi, sfide, sondaggi, notifiche push).

## Cosa c'è
- **Prima pagina**: avvisi, prossime prenotazioni e allenamenti, notizie, collegamenti rapidi.
- **Prenota** (`#/book`): un riquadro per campo (badge Tennis o Padel, filtro Tutti/Tennis/Padel) con le mezz'ore;
  durate 1 h, 1 h 30 o 2 h; si prenota anche all'ultimo momento; telefono facoltativo (lo vedono solo admin e segreteria);
  gli altri vedono solo libero/occupato.
- **Campi** (`#/courts`, solo admin): campi in righe compatte (Modifica / Elimina), regole delle prenotazioni
  (giorni avanti, 0 = senza limite), blocchi ricorrenti, premi delle prenotazioni (chiusi, da attivare).
- **Allenamento personalizzato** (`#/ptreq`, anche per i visitatori): richiesta di lezione privata; admin e segreteria
  confermano (campo 1 → 2 → 3 scelto da solo, allenamento privato per il maestro, WhatsApp con il messaggio pronto) o rifiutano.
- **Il circolo** (`#/club`): chi siamo, team, calendario della scuola, valori, sponsor, dove siamo.
  **Iscrizione online dei minori** (`#/iscrizione`) e gestione in **Iscrizioni** (`#/iscrizioni`, staff).
- **Allenamenti** (`#/train`): tipi settimanale, recupero e privato; livelli da Minitennis a Tennis Adulti; presenze del giorno segnate dall'**allenatore** (o da admin e segreteria) con lo **scalo subito**
  del pacchetto; il corsista risponde solo «ci sarò / non ci sarò»; «Conferma la giornata» riallinea i pacchetti,
  in fondo alla giornata la **Scheda di valutazione dell'allenamento** (`#/eval/…`: 7 voci da 1 a 10, 6 = sufficienza, nota del giorno).
- **Corsisti** (`#/athletes`): schede **con account** o **senza account** (ragazzi non registrati, con genitore e telefono;
  si possono poi collegare all'account se il ragazzo si registra), filtro Tutte / Con account / Senza account,
  certificato agonistico/non agonistico con avvisi a 30 e 7 giorni, tesseramento FITP pagato/non pagato,
  quote (mensile, trimestrale, corso intero, pacchetti), medie delle valutazioni, «Ricalcola pacchetti».
- **Pagamenti** (`#/payments`), **Report** (`#/report`).
- **Cassa** (`#/cassa`): incassi, ricevute Q e C in PDF (anche con intestatario scritto a mano), «Invia ricevuta» su WhatsApp
  e «Invia per email», prospetto Excel.
- **Utenti** (`#/users`, admin e segreteria): «Crea utente» con il ruolo (Utente, Allenatore, Segreteria, Cassa, Admin),
  badge del ruolo, menu per cambiarlo (solo admin). **Messaggi** (`#/messages`, admin).
- Accesso con email e password oppure **Continua con Google**.
- **Profilo** (`#/me`) con il riepilogo del trimestre (`#/wrapped`), **Impostazioni** (design, colori, lingua: italiano,
  inglese, spagnolo). Design di serie: Erba.
- Privacy, cookie e termini (`#/privacy`, `#/cookie`, `#/termini`). Dati dell'associazione in `js/club.js`.

## Pubblicazione
Si pubblica da sola quando si unisce una modifica su `main` (workflow `.github/workflows/pubblica.yml`).
Serve il secret `FIREBASE_SA_QUATTROMORI` con la chiave JSON dell'account di servizio Firebase.

## Prove in locale
```
npm install
npm test                 # calcoli e traduzioni (it, en, es)
npm run test:rules       # regole del database (serve Java)
npm run check            # sintassi dei file JavaScript
npm run emulatori        # in un altro terminale: database e login finti
npm run dati-prova       # campi, utenti, allenamenti, prenotazioni e incassi di esempio (password: prova123)
python3 -m http.server 5173   # poi apri http://localhost:5173/?emu=1
```
Account di prova: admin.prova@esempio.it (admin), elena.sanna@esempio.it (segreteria), giulia.serra@esempio.it (cassa),
marco.pinna@esempio.it (allenatore), andrea.melis@esempio.it, sara.murru@esempio.it, luca.porcu@esempio.it,
chiara.loi@esempio.it, matteo.cocco@esempio.it (utenti e corsisti). In più due ragazzi senza account (Pietro Deiana con un
pacchetto di 4 lezioni, Giorgia Floris), con il genitore. Campi: Campo 1, 2, 3 (tennis), Padel 1 e 2; due richieste di
allenamento privato in attesa (Matteo e un esterno) e un'iscrizione online da gestire.
