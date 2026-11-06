# Quattro Mori Tennis Team

App del circolo per prenotare i campi da tennis e padel. Indirizzo: https://quattromoritennisteam.web.app

## Cosa c'è
- **Prenota**: il tabellone del giorno, campi in colonna e mezz'ore in riga. Prenotazioni da 1 ora, 1 ora e 30 o 2 ore.
- **Le mie prenotazioni**: prossime e passate, con la cancellazione.
- **Utenti** (admin e segreteria): elenco, ricerca, modifica, ruoli (solo admin), eliminazione.
- **Campi** (admin): nome, tipo, orari, prenotabile sì/no.
- **Account**: accesso con email o Google, registrazione, profilo, lingua (italiano/inglese).

## Pubblicazione
Si pubblica da sola quando si unisce una modifica su `main` (workflow `.github/workflows/pubblica.yml`).
Serve il secret `FIREBASE_SA_QUATTROMORI` con la chiave JSON dell'account di servizio Firebase.

## Prove in locale
```
npm install
npm test                 # calcoli
npm run test:rules       # regole del database (serve Java)
npm run emulatori        # in un altro terminale: database e login finti
npm run dati-prova       # campi, utenti e prenotazioni di esempio (password: prova123)
python3 -m http.server 5173   # poi apri http://localhost:5173/?emu=1
```
