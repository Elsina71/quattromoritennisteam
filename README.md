# Quattro Mori Tennis Team

App del circolo Quattro Mori Tennis Team (Tennis & Padel · Cagliari). Indirizzo: https://quattromoritennisteam.web.app

L'app parte dal codice di Beach+ Arena (stessa grafica e stessi componenti), senza le parti che qui non servono
(tornei, classifiche, giochi, sfide, sondaggi, notifiche push).

## Cosa c'è
- **Prima pagina**: avvisi, prossime prenotazioni e allenamenti, notizie, collegamenti rapidi.
- **Prenota** (`#/book`): un riquadro per campo con le mezz'ore; gli altri vedono solo libero/occupato.
- **Campi** (`#/courts`, admin): campi, orari, regole delle prenotazioni, blocchi ricorrenti, reward.
- **Allenamenti** (`#/train`), **Corsisti** (`#/athletes`), **Pagamenti** (`#/payments`), **Report** (`#/report`).
- **Cassa** (`#/cassa`): incassi, ricevute Q e C in PDF, prospetto Excel.
- **Utenti** (`#/users`, admin), **Messaggi** (`#/messages`, admin).
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
Account di prova: admin.prova@esempio.it (admin), giulia.serra@esempio.it (cassa), marco.pinna@esempio.it (coach),
andrea.melis@esempio.it, sara.murru@esempio.it, luca.porcu@esempio.it, chiara.loi@esempio.it (utenti).
