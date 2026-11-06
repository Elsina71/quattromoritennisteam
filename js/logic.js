// Calcoli senza Firebase e senza pagina: mezz'ore, durate, date, ruoli.
// Li usa l'app e li provano i test (tests/logic.test.mjs).

export const STEP = 30;                 // la griglia è a mezz'ore
export const DURATIONS = [60, 90, 120]; // durate prenotabili, in minuti
export const ROLES = ['admin', 'segreteria', 'allenatore', 'utente'];
export const COURT_TYPES = ['tennis', 'padel'];

export const isStaffRole = r => r === 'admin' || r === 'segreteria';

// '08:30' → 510 e ritorno
export function toMin(t) {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
}
export function fromMin(n) {
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

// Inizi di mezz'ora fra apertura e chiusura: 08:00–10:00 → 08:00, 08:30, 09:00, 09:30
export function times(from, to) {
  const out = [];
  for (let m = toMin(from); m + STEP <= toMin(to); m += STEP) out.push(fromMin(m));
  return out;
}

// Mezz'ore occupate da una prenotazione: 17:30 per 90 minuti → 17:30, 18:00, 18:30
export function covered(start, dur) {
  const out = [];
  for (let m = toMin(start); m < toMin(start) + dur; m += STEP) out.push(fromMin(m));
  return out;
}

export const endOf = (start, dur) => fromMin(toMin(start) + dur);

// Identificativo del documento di una mezz'ora: due prenotazioni sulla stessa mezz'ora
// scriverebbero lo stesso documento, e il database rifiuta la seconda.
export const slotId = (courtId, date, time) => `${courtId}_${date}_${time.replace(':', '')}`;

// La prenotazione sta dentro l'orario del campo e non tocca mezz'ore già prese?
// taken: Set di 'HH:MM' già occupate su quel campo in quel giorno.
export function fits(court, start, dur, taken) {
  if (toMin(start) < toMin(court.from)) return false;
  if (toMin(start) + dur > toMin(court.to)) return false;
  return covered(start, dur).every(t => !taken.has(t));
}

export const durationsAt = (court, start, taken) => DURATIONS.filter(d => fits(court, start, d, taken));

// Date come 'AAAA-MM-GG' nell'ora del dispositivo
export function isoDate(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}
export const dateOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

// Una mezz'ora è passata quando il suo inizio è già trascorso.
export function isPast(date, time, now = new Date()) {
  const today = isoDate(now);
  if (date !== today) return date < today;
  return toMin(time) < now.getHours() * 60 + now.getMinutes();
}

// Prima mezz'ora libera del giorno (non passata) dove ci sta almeno un'ora.
// takenByCourt: { courtId: Set di 'HH:MM' }
export function nextFree(courts, date, takenByCourt, now = new Date()) {
  let best = null;
  for (const c of courts) {
    const taken = takenByCourt[c.id] || new Set();
    const t = times(c.from, c.to).find(x => !isPast(date, x, now) && fits(c, x, 60, taken));
    if (t && (!best || toMin(t) < toMin(best.time))) best = { court: c, time: t };
  }
  return best;
}

// Mezz'ore libere e prenotabili rimaste nel giorno, su tutti i campi indicati
export function freeCount(courts, date, takenByCourt, now = new Date()) {
  let n = 0;
  for (const c of courts) {
    const taken = takenByCourt[c.id] || new Set();
    n += times(c.from, c.to).filter(t => !isPast(date, t, now) && !taken.has(t)).length;
  }
  return n;
}

// Orario della griglia: dal campo che apre prima a quello che chiude dopo
export function span(courts) {
  if (!courts.length) return { from: '08:00', to: '23:00' };
  const from = Math.min(...courts.map(c => toMin(c.from)));
  const to = Math.max(...courts.map(c => toMin(c.to)));
  return { from: fromMin(from), to: fromMin(to) };
}

// Orari selezionabili per apertura e chiusura di un campo
export const HOUR_OPTIONS = Array.from({ length: 49 }, (_, i) => fromMin(i * 30));

export function fullName(p) {
  return [p && p.first, p && p.last].filter(Boolean).join(' ').trim();
}
