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

// ---------- pezzo 2: corsisti, allenamenti, valutazioni ----------

// Le voci della scheda di valutazione (voto da 1 a 10, 6 è la sufficienza).
export const EVAL_AREAS = ['tecnica', 'movimento', 'controllo', 'scelte', 'intensita', 'atteggiamento', 'consistenza'];
export const PASS = 6;

// Giorni fra due date 'AAAA-MM-GG' (b - a)
export function daysBetween(a, b) {
  return Math.round((dateOf(b) - dateOf(a)) / 86400000);
}

// Stato del certificato medico: mancante, scaduto, scade entro 7 o 30 giorni, valido.
export function certStatus(expiry, today = isoDate()) {
  if (!expiry) return { state: 'missing', days: null };
  const days = daysBetween(today, expiry);
  if (days < 0) return { state: 'expired', days };
  if (days <= 7) return { state: 'd7', days };
  if (days <= 30) return { state: 'd30', days };
  return { state: 'ok', days };
}

// Lunedì della settimana di una data, e i sette giorni
export function weekStart(iso) {
  const wd = (dateOf(iso).getDay() + 6) % 7;   // lunedì = 0
  return addDays(iso, -wd);
}
export const weekDays = monday => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

// Date di una serie settimanale, dalla prima fino a "until" compreso (al massimo 52)
export function weeklyDates(first, until) {
  const out = [];
  for (let d = first; d <= until && out.length < 52; d = addDays(d, 7)) out.push(d);
  return out;
}

export function age(birth, today = isoDate()) {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

// Media per voce su più schede (solo i voti dati), con il numero di voti
export function averages(evals) {
  const out = {};
  for (const k of EVAL_AREAS) {
    const v = evals.map(e => e.scores && e.scores[k]).filter(x => Number.isInteger(x));
    out[k] = v.length ? { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10, n: v.length } : { avg: null, n: 0 };
  }
  return out;
}

// Un voto è valido se è un intero da 1 a 10
export const validScore = v => Number.isInteger(v) && v >= 1 && v <= 10;
