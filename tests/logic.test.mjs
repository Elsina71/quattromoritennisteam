// Prove dei calcoli: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import {
  toMin, fromMin, times, covered, endOf, slotId, fits, durationsAt, isoDate, addDays,
  isPast, nextFree, freeCount, span, isStaffRole, fullName,
  certStatus, weekStart, weekDays, weeklyDates, age, averages, validScore, daysBetween, EVAL_AREAS
} from '../js/logic.js';

let n = 0;
const test = (name, fn) => { fn(); n++; };

test('ore e minuti', () => {
  assert.equal(toMin('08:30'), 510);
  assert.equal(fromMin(510), '08:30');
  assert.equal(fromMin(24 * 60), '24:00');
});

test('mezz\'ore fra apertura e chiusura', () => {
  assert.deepEqual(times('08:00', '10:00'), ['08:00', '08:30', '09:00', '09:30']);
  assert.equal(times('08:00', '23:00').length, 30);
});

test('mezz\'ore coperte e fine', () => {
  assert.deepEqual(covered('17:30', 90), ['17:30', '18:00', '18:30']);
  assert.equal(covered('09:00', 120).length, 4);
  assert.equal(endOf('22:00', 120), '24:00');
});

test('identificativo della mezz\'ora', () => {
  assert.equal(slotId('c1', '2026-11-12', '17:30'), 'c1_2026-11-12_1730');
});

test('ci sta o non ci sta', () => {
  const c = { id: 'c1', from: '08:00', to: '23:00' };
  const taken = new Set(['18:00']);
  assert.equal(fits(c, '16:00', 120, taken), true);
  assert.equal(fits(c, '17:00', 120, taken), false);   // tocca le 18:00
  assert.equal(fits(c, '22:00', 90, taken), false);    // finisce dopo la chiusura
  assert.equal(fits(c, '07:30', 60, taken), false);    // prima dell'apertura
  assert.deepEqual(durationsAt(c, '17:00', taken), [60]);
  assert.deepEqual(durationsAt(c, '17:30', taken), []);
  assert.deepEqual(durationsAt(c, '21:30', taken), [60, 90]);
});

test('date', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(isoDate(new Date(2026, 10, 6)), '2026-11-06');
});

test('passato', () => {
  const now = new Date(2026, 10, 6, 17, 10);
  assert.equal(isPast('2026-11-06', '17:00', now), true);
  assert.equal(isPast('2026-11-06', '17:30', now), false);
  assert.equal(isPast('2026-11-05', '22:00', now), true);
  assert.equal(isPast('2026-11-07', '08:00', now), false);
});

test('prossimo libero e mezz\'ore libere', () => {
  const now = new Date(2026, 10, 6, 17, 10);
  const courts = [{ id: 'a', from: '08:00', to: '20:00' }, { id: 'b', from: '08:00', to: '20:00' }];
  const taken = { a: new Set(['17:30', '18:00']), b: new Set(['17:30', '18:30']) };
  const nf = nextFree(courts, '2026-11-06', taken, now);
  assert.deepEqual([nf.court.id, nf.time], ['a', '18:30']);   // b alle 18:00 ha solo mezz'ora
  // da 17:30 a 19:30 sono 5 mezz'ore per campo, meno quelle prese
  assert.equal(freeCount(courts, '2026-11-06', taken, now), 5 - 2 + 5 - 2);
  assert.equal(nextFree(courts, '2026-11-05', taken, now), null);
});

test('orario della griglia', () => {
  assert.deepEqual(span([{ from: '09:00', to: '21:00' }, { from: '08:00', to: '20:00' }]), { from: '08:00', to: '21:00' });
});

test('ruoli e nomi', () => {
  assert.equal(isStaffRole('segreteria'), true);
  assert.equal(isStaffRole('allenatore'), false);
  assert.equal(fullName({ first: 'Giulia', last: 'Serra' }), 'Giulia Serra');
});

test('certificato medico', () => {
  const today = '2026-11-06';
  assert.equal(certStatus('', today).state, 'missing');
  assert.deepEqual(certStatus('2026-11-05', today), { state: 'expired', days: -1 });
  assert.deepEqual(certStatus('2026-11-13', today), { state: 'd7', days: 7 });
  assert.deepEqual(certStatus('2026-11-14', today), { state: 'd30', days: 8 });
  assert.deepEqual(certStatus('2026-12-06', today), { state: 'd30', days: 30 });
  assert.equal(certStatus('2026-12-07', today).state, 'ok');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);   // passaggio all'ora legale
});

test('settimane e serie', () => {
  assert.equal(weekStart('2026-11-06'), '2026-11-02');   // venerdì → lunedì
  assert.equal(weekStart('2026-11-08'), '2026-11-02');   // domenica → stesso lunedì
  assert.equal(weekDays('2026-11-02')[6], '2026-11-08');
  assert.deepEqual(weeklyDates('2026-11-03', '2026-11-24'), ['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24']);
  assert.equal(weeklyDates('2026-01-01', '2028-01-01').length, 52);
});

test('età', () => {
  assert.equal(age('2014-11-07', '2026-11-06'), 11);
  assert.equal(age('2014-11-06', '2026-11-06'), 12);
  assert.equal(age('', '2026-11-06'), null);
});

test('medie delle valutazioni', () => {
  const a = averages([{ scores: { tecnica: 6, movimento: 8 } }, { scores: { tecnica: 7 } }, { scores: {} }]);
  assert.deepEqual(a.tecnica, { avg: 6.5, n: 2 });
  assert.deepEqual(a.movimento, { avg: 8, n: 1 });
  assert.deepEqual(a.consistenza, { avg: null, n: 0 });
  assert.equal(EVAL_AREAS.length, 7);
  assert.equal(validScore(10), true); assert.equal(validScore(0), false); assert.equal(validScore(6.5), false);
});

console.log(`ok, ${n} prove superate`);
