# Quattro Mori Tennis Team

App del circolo Quattro Mori Tennis Team (Tennis & Padel · Cagliari). Indirizzo: https://quattromoritennisteam.web.app

L'app parte dal codice di Beach+ Arena (stessa grafica e stessi componenti), senza le parti che qui non servono
(tornei, classifiche, giochi, sfide, sondaggi, notifiche push).

## Cosa c'è
- **Prima pagina**: avvisi, prossime prenotazioni e allenamenti, notizie, collegamenti rapidi.
- **Prenota** (`#/book`): un riquadro per campo (badge Tennis o Padel, filtro Tutti/Tennis/Padel) con le mezz'ore;
  durate 1 h, 1 h 30 o 2 h; gli altri vedono solo libero/occupato.
- **Campi** (`#/courts`, solo admin): campi con il tipo, orari, regole delle prenotazioni, blocchi ricorrenti, reward.
- **Allenamenti** (`#/train`): presenze del giorno (le segna anche l'allenatore), «Conferma la giornata» che scala i pacchetti,
  in fondo alla giornata la **Scheda di valutazione dell'allenamento** (`#/eval/…`: 7 voci da 1 a 10, 6 = sufficienza, nota del giorno).
- **Corsisti** (`#/athletes`): certificato agonistico/non agonistico con avvisi a 30 e 7 giorni, tesseramento FITP pagato/non pagato,
  quote (mensile, trimestrale, corso intero, pacchetti), medie delle valutazioni, «Ricalcola pacchetti».
- **Pagamenti** (`#/payments`), **Report** (`#/report`).
- **Cassa** (`#/cassa`): incassi, ricevute Q e C in PDF, prospetto Excel.
- **Utenti** (`#/users`, admin e segreteria): «Crea utente» con il ruolo (Utente, Allenatore, Segreteria, Cassa, Admin),
  badge del ruolo, menu per cambiarlo (solo admin). **Messaggi** (`#/messages`, admin).
- Accesso con email e password oppure **Continua con Google**.
- **Profilo** (`#/me`) con il riepilogo del trimestre (`#/wrapped`), **Impostazioni** (design, colori, lingua).
- Privacy, cookie e termini (`#/privacy`, `#/cookie`, `#/termini`). Dati dell'associazione in `js/club.js`.

## Pubblicazione
Si pubblica da sola quando si unisce una modifica su `main` (workflow `.github/workflows/pubblica.yml`).
Serve il secret `FIREBASE_SA_QUATTROMORI` con la chiave JSON dell'account di servizio Firebase.

## Prove in locale
```
npm install
npm test                 # calcoli
npm run test:rules       # regole del database (serve Java)
npm run check            # sintassi dei file JavaScript
npm run emulatori        # in un altro terminale: database e login finti
npm run dati-prova       # campi, utenti, allenamenti, prenotazioni e incassi di esempio (password: prova123)
python3 -m http.server 5173   # poi apri http://localhost:5173/?emu=1
```
Account di prova: admin.prova@esempio.it (admin), elena.sanna@esempio.it (segreteria), giulia.serra@esempio.it (cassa),
marco.pinna@esempio.it (allenatore), andrea.melis@esempio.it, sara.murru@esempio.it, luca.porcu@esempio.it,
chiara.loi@esempio.it, matteo.cocco@esempio.it (utenti e corsisti).
