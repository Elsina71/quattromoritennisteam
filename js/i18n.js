// Testi dell'app in italiano e inglese. t('chiave', { valori }) sceglie la lingua attiva.
const T = {
  it: {
    club: 'Quattro Mori', clubScope: 'Tennis Team · Cagliari',
    navBook: 'Prenota', navMine: 'Le mie prenotazioni', navUsers: 'Utenti', navCourts: 'Campi',
    navAccount: 'Account', navLogin: 'Accedi', groupClub: 'Circolo', menu: 'Menu', close: 'Chiudi',
    bookTitle: 'Prenota un campo',
    nextFree: 'Prossimo campo libero: {court} alle {time}',
    freeLeft: '{n} mezz\'ore libere su {courts} campi',
    noneFreeToday: 'Oggi non ci sono più campi liberi per un\'ora.',
    dayPast: 'Giorno passato: si può solo consultare.',
    prevDay: 'Giorno prima', nextDay: 'Giorno dopo', today: 'Oggi', pickDay: 'Giorno',
    all: 'Tutti', tennis: 'Tennis', padel: 'Padel',
    free: 'Libero', busy: 'Occupato', yours: 'Tua', training: 'Allenamento', closed: 'Chiuso',
    legend: 'Legenda',
    bookAt: 'Prenota {court} alle {time}',
    noCourts: 'Non ci sono ancora campi.',
    noCourtsAdmin: 'Aggiungi il primo campo per aprire le prenotazioni.',
    addCourt: 'Aggiungi campo',
    loadError: 'Non riesco a leggere le prenotazioni.', retry: 'Riprova',
    duration: 'Durata', h1: '1 ora', h1h30: '1 ora e 30', h2: '2 ore',
    forWhom: 'Per chi', registered: 'Utente registrato', notRegistered: 'Non registrato',
    chooseUser: 'Scegli un utente', guestName: 'Nome e cognome', me: 'Me',
    confirm: 'Prenota', cancel: 'Annulla', save: 'Salva', edit: 'Modifica', delete: 'Elimina',
    booked: 'Prenotato: {court}, {time}', bookFailed: 'Quella mezz\'ora è appena stata presa. Scegli un altro orario.',
    loginToBook: 'Per prenotare serve un account. È gratis e ci vuole un minuto.',
    bookingOf: 'Prenotazione di {name}', yourBooking: 'La tua prenotazione',
    notRegisteredTag: 'non registrato',
    cancelBooking: 'Cancella prenotazione', cancelled: 'Prenotazione cancellata',
    confirmCancel: 'Cancellare la prenotazione di {when}?',
    mineTitle: 'Le mie prenotazioni', upcoming: 'Prossime', past: 'Passate',
    noUpcoming: 'Nessuna prenotazione in arrivo.', noPast: 'Nessuna prenotazione passata.',
    bookNow: 'Prenota un campo', court: 'Campo', when: 'Quando', time: 'Orario', count: '{n} prenotazioni',
    count1: '1 prenotazione',
    usersTitle: 'Utenti', usersCount: '{n} utenti', usersCount1: '1 utente', search: 'Cerca per nome, email o telefono',
    name: 'Nome', firstName: 'Nome', lastName: 'Cognome', phone: 'Telefono', email: 'Email', roleCol: 'Ruolo',
    since: 'Iscritto il', noUsers: 'Nessun utente con questo nome.',
    role_admin: 'Admin', role_segreteria: 'Segreteria', role_allenatore: 'Allenatore', role_utente: 'Utente',
    roles_admin: 'Admin', roles_segreteria: 'Segreteria', roles_allenatore: 'Allenatori', roles_utente: 'Utenti',
    editUser: 'Modifica utente', roleOnlyAdmin: 'Solo l\'admin cambia i ruoli.',
    deleteUser: 'Elimina utente',
    confirmDeleteUser: 'Eliminare {name}? Il profilo e le sue prenotazioni future spariscono. L\'account di accesso va tolto da Firebase Authentication.',
    userDeleted: 'Utente eliminato', saved: 'Salvato',
    courtsTitle: 'Campi', courtsSub: 'Nome, tipo e orari di apertura dei campi prenotabili.',
    courtName: 'Nome del campo', courtType: 'Tipo', opens: 'Apre', closesAt: 'Chiude', bookable: 'Prenotabile',
    hours: '{from}–{to}', hidden: 'Nascosto', editCourt: 'Modifica campo', newCourt: 'Nuovo campo',
    confirmDeleteCourt: 'Eliminare {name}? Le prenotazioni già fatte restano nell\'elenco dello staff.',
    courtDeleted: 'Campo eliminato', hoursError: 'La chiusura deve venire dopo l\'apertura.',
    order: 'Posizione',
    accountTitle: 'Account', profile: 'Profilo', profileHelp: 'Nome e telefono li vedono solo admin e segreteria.',
    language: 'Lingua', languageHelp: 'Lingua dell\'app su questo dispositivo e nel tuo profilo.',
    session: 'Accesso', sessionHelp: 'Sei collegato come {email}.', logout: 'Esci',
    verifyEmail: 'Ti abbiamo mandato un\'email per confermare l\'indirizzo.',
    loginTitle: 'Accedi', registerTitle: 'Crea un account', password: 'Password',
    passwordHint: 'Almeno 6 caratteri.',
    loginBtn: 'Accedi', registerBtn: 'Crea account', google: 'Continua con Google', or: 'oppure',
    forgot: 'Password dimenticata?', resetSent: 'Ti abbiamo mandato un\'email per scegliere una nuova password.',
    phoneOptional: 'Telefono (facoltativo)',
    loginIntro: 'Prenota i campi da tennis e padel del circolo.',
    how1: 'Vedi subito cosa è libero', how1d: 'Il tabellone del giorno mostra tutti i campi, mezz\'ora per mezz\'ora.',
    how2: '1 ora, 1 ora e 30 o 2 ore', how2d: 'Scegli l\'orario d\'inizio e la durata: il campo è tuo.',
    how3: 'Cambi idea? Cancella', how3d: 'Da Le mie prenotazioni liberi il campo per gli altri soci.',
    err: 'Qualcosa è andato storto. Riprova.',
    'err:auth/invalid-credential': 'Email o password non corrette.',
    'err:auth/wrong-password': 'Email o password non corrette.',
    'err:auth/user-not-found': 'Email o password non corrette.',
    'err:auth/email-already-in-use': 'Questa email ha già un account: accedi.',
    'err:auth/weak-password': 'La password deve avere almeno 6 caratteri.',
    'err:auth/invalid-email': 'Email non valida.',
    'err:auth/too-many-requests': 'Troppi tentativi. Riprova fra qualche minuto.',
    'err:auth/popup-closed-by-user': 'Accesso con Google annullato.',
    'err:permission-denied': 'Non hai il permesso per questa operazione.',
    loading: 'Caricamento…', staffOnly: 'Questa pagina è riservata allo staff del circolo.',
    adminOnly: 'Questa pagina è riservata all\'admin.', signInFirst: 'Accedi per vedere questa pagina.',
    footer: 'Quattro Mori Tennis Team · Cagliari'
  },
  en: {
    club: 'Quattro Mori', clubScope: 'Tennis Team · Cagliari',
    navBook: 'Book', navMine: 'My bookings', navUsers: 'Users', navCourts: 'Courts',
    navAccount: 'Account', navLogin: 'Sign in', groupClub: 'Club', menu: 'Menu', close: 'Close',
    bookTitle: 'Book a court',
    nextFree: 'Next free court: {court} at {time}',
    freeLeft: '{n} free half-hours on {courts} courts',
    noneFreeToday: 'No court is free for an hour for the rest of today.',
    dayPast: 'This day has passed: view only.',
    prevDay: 'Previous day', nextDay: 'Next day', today: 'Today', pickDay: 'Day',
    all: 'All', tennis: 'Tennis', padel: 'Padel',
    free: 'Free', busy: 'Booked', yours: 'Yours', training: 'Training', closed: 'Closed',
    legend: 'Key',
    bookAt: 'Book {court} at {time}',
    noCourts: 'There are no courts yet.',
    noCourtsAdmin: 'Add the first court to open bookings.',
    addCourt: 'Add court',
    loadError: 'Couldn\'t load the bookings.', retry: 'Retry',
    duration: 'Length', h1: '1 hour', h1h30: '1 hour 30', h2: '2 hours',
    forWhom: 'For', registered: 'Registered user', notRegistered: 'Not registered',
    chooseUser: 'Choose a user', guestName: 'Full name', me: 'Me',
    confirm: 'Book', cancel: 'Cancel', save: 'Save', edit: 'Edit', delete: 'Delete',
    booked: 'Booked: {court}, {time}', bookFailed: 'That half-hour has just been taken. Pick another time.',
    loginToBook: 'You need an account to book. It\'s free and takes a minute.',
    bookingOf: 'Booking for {name}', yourBooking: 'Your booking',
    notRegisteredTag: 'not registered',
    cancelBooking: 'Cancel booking', cancelled: 'Booking cancelled',
    confirmCancel: 'Cancel the booking on {when}?',
    mineTitle: 'My bookings', upcoming: 'Upcoming', past: 'Past',
    noUpcoming: 'No upcoming bookings.', noPast: 'No past bookings.',
    bookNow: 'Book a court', court: 'Court', when: 'When', time: 'Time', count: '{n} bookings',
    count1: '1 booking',
    usersTitle: 'Users', usersCount: '{n} users', usersCount1: '1 user', search: 'Search by name, email or phone',
    name: 'Name', firstName: 'First name', lastName: 'Last name', phone: 'Phone', email: 'Email', roleCol: 'Role',
    since: 'Joined', noUsers: 'No user with this name.',
    role_admin: 'Admin', role_segreteria: 'Front desk', role_allenatore: 'Coach', role_utente: 'User',
    roles_admin: 'Admins', roles_segreteria: 'Front desk', roles_allenatore: 'Coaches', roles_utente: 'Users',
    editUser: 'Edit user', roleOnlyAdmin: 'Only an admin can change roles.',
    deleteUser: 'Delete user',
    confirmDeleteUser: 'Delete {name}? The profile and their upcoming bookings are removed. The sign-in account must be removed in Firebase Authentication.',
    userDeleted: 'User deleted', saved: 'Saved',
    courtsTitle: 'Courts', courtsSub: 'Name, type and opening hours of the bookable courts.',
    courtName: 'Court name', courtType: 'Type', opens: 'Opens', closesAt: 'Closes', bookable: 'Bookable',
    hours: '{from}–{to}', hidden: 'Hidden', editCourt: 'Edit court', newCourt: 'New court',
    confirmDeleteCourt: 'Delete {name}? Existing bookings stay in the staff list.',
    courtDeleted: 'Court deleted', hoursError: 'Closing time must be after opening time.',
    order: 'Position',
    accountTitle: 'Account', profile: 'Profile', profileHelp: 'Only admins and the front desk see your name and phone.',
    language: 'Language', languageHelp: 'App language on this device and in your profile.',
    session: 'Sign-in', sessionHelp: 'Signed in as {email}.', logout: 'Sign out',
    verifyEmail: 'We sent you an email to confirm your address.',
    loginTitle: 'Sign in', registerTitle: 'Create an account', password: 'Password',
    passwordHint: 'At least 6 characters.',
    loginBtn: 'Sign in', registerBtn: 'Create account', google: 'Continue with Google', or: 'or',
    forgot: 'Forgot your password?', resetSent: 'We sent you an email to choose a new password.',
    phoneOptional: 'Phone (optional)',
    loginIntro: 'Book the club\'s tennis and padel courts.',
    how1: 'See what\'s free at a glance', how1d: 'The day\'s board shows every court, half-hour by half-hour.',
    how2: '1 hour, 1 hour 30 or 2 hours', how2d: 'Pick the start time and the length: the court is yours.',
    how3: 'Changed your mind? Cancel', how3d: 'From My bookings you free the court for other members.',
    err: 'Something went wrong. Try again.',
    'err:auth/invalid-credential': 'Wrong email or password.',
    'err:auth/wrong-password': 'Wrong email or password.',
    'err:auth/user-not-found': 'Wrong email or password.',
    'err:auth/email-already-in-use': 'This email already has an account: sign in.',
    'err:auth/weak-password': 'The password needs at least 6 characters.',
    'err:auth/invalid-email': 'Invalid email.',
    'err:auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'err:auth/popup-closed-by-user': 'Google sign-in cancelled.',
    'err:permission-denied': 'You don\'t have permission to do this.',
    loading: 'Loading…', staffOnly: 'This page is for club staff only.',
    adminOnly: 'This page is for admins only.', signInFirst: 'Sign in to see this page.',
    footer: 'Quattro Mori Tennis Team · Cagliari'
  }
};

let lang = 'it';
// parte in italiano; l'inglese si sceglie col bottone e resta salvato su questo dispositivo
try { const s = localStorage.getItem('qm-lang'); if (s === 'it' || s === 'en') lang = s; } catch (e) { /* ignore */ }

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'it';
  try { localStorage.setItem('qm-lang', lang); } catch (e) { /* ignore */ }
  document.documentElement.lang = lang;
}
document.documentElement.lang = lang;

export function t(key, vars) {
  let s = (T[lang] && T[lang][key]) ?? T.it[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}
export const errText = e => {
  const code = (e && e.code) || '';
  return T[lang]['err:' + code] || T.it['err:' + code] ? t('err:' + code) : t('err');
};

// Date e ore nella lingua attiva
const loc = () => (lang === 'en' ? 'en-GB' : 'it-IT');
export const fmtDay = d => new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
export const fmtShort = d => new Intl.DateTimeFormat(loc(), { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
export const fmtDate = d => new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
