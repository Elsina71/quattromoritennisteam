// Dati dell'associazione: UN solo posto da cui li leggono intestazione, piè di pagina, ricevute, pagina «Il circolo»
// e testi legali. Per cambiare un dato dell'associazione basta modificarlo qui.
window.Club = Object.freeze({
  name: 'Quattro Mori Tennis Team',              // nome mostrato nell'app
  short: 'Quattro Mori',                         // nome corto (anteprime, icona)
  subtitle: "Tennis & Padel · Quartu Sant'Elena · Sardegna",
  legalName: 'ASD Quattro Mori Tennis Team',     // ragione sociale (ricevute, privacy)
  address: 'via Marco Polo 12',                  // sede legale
  city: "09045 Quartu Sant'Elena (CA)",
  courtsAddress: 'Via Soru e Mari 3',            // dove si gioca (i campi)
  courtsMap: 'https://maps.app.goo.gl/ydzCj8Vnf3VbUggA6',   // posizione dei campi su Google Maps
  courtsCity: "09045 Quartu Sant'Elena (CA)",
  cf: '92179440927',                             // codice fiscale
  vat: '03994320921',                            // partita IVA
  pec: 'quattromoritennisteam@pec.it',           // contatto per privacy e ricevute
  email: 'quattromoritennisteam@gmail.com',      // contatto per tutto il resto
  phone: '338 569 6568',
  president: 'Carlo Porqueddu',                  // presidente / legale rappresentante
  site: 'quattromoritennisteam.web.app',
  since: 2011,                                   // scuola di tennis dal
  // calendario della scuola tennis (mese-giorno): dal 15 settembre al 15 giugno; gruppi agonistici fino al 31 luglio
  school: { from: '09-15', to: '06-15', agoTo: '07-31' },
  // il team (pagina «Il circolo» e maestri selezionabili nella richiesta di allenamento privato)
  team: Object.freeze([
    { name: 'Carlo Porqueddu', role: 'Maestro Nazionale' },
    { name: 'Mattia Secci', role: 'Istruttore 1° grado' },
    { name: 'Giulia Astero', role: 'Istruttrice 1° grado' },
    { name: 'Alberto Ambu', role: 'Istruttore 1° grado' },
    { name: 'Alessio Puddu', role: 'Istruttore 1° grado' }
  ])
});
