// Prove dei calcoli: node tests/logic.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// logic.js è uno script per il browser (crea "Logic"): si carica in un contesto a parte
const ctx = {};
vm.runInNewContext(readFileSync(new URL('../js/logic.js', import.meta.url), 'utf8') + '\nthis.Logic = Logic;', ctx);
const Logic = ctx.Logic;

let n = 0;
const test = (name, fn) => { fn(); n++; };

test('ricerca senza accenti e maiuscole', () => {
  assert.equal(Logic.norm('  Pòrcu   ANNA '), 'porcu anna');
  assert.equal(Logic.norm(null), '');
});

test('chiave dei nomi per gli omonimi', () => {
  assert.equal(Logic.nameKey('Pòrcu', 'Anna'), Logic.nameKey('PORCU', 'anna'));
  assert.equal(Logic.nameKey('Mura', 'Paolo'), Logic.nameKey('Murra', 'Paolo'));
  assert.notEqual(Logic.nameKey('Mura', 'Paolo'), Logic.nameKey('Mura', 'Paola'));
});

test('settimana ISO e lunedì', () => {
  assert.equal(Logic.weekStart('2026-11-07'), '2026-11-02');   // sabato → lunedì
  assert.equal(Logic.weekStart('2026-11-02'), '2026-11-02');
  assert.equal(Logic.weekStart('2026-11-08'), '2026-11-02');   // domenica
  assert.equal(Logic.isoWeek('2026-01-01'), '2026-W01');
  assert.equal(Logic.isoWeek('2027-01-01'), '2026-W53');
  assert.equal(Logic.isoWeek('2026-11-07'), '2026-W45');
});

test('periodi: settimana, mese, trimestre solare, semestre della stagione', () => {
  const r = (k, d) => { const x = Logic.periodRange(k, d); return x.from + '..' + x.to; };
  assert.equal(r('week', '2026-11-07'), '2026-11-02..2026-11-08');
  assert.equal(r('month', '2026-02-10'), '2026-02-01..2026-02-28');
  assert.equal(r('quarter', '2026-11-07'), '2026-10-01..2026-12-31');
  assert.equal(r('semester', '2026-11-07'), '2026-09-01..2027-02-28');
  assert.equal(r('semester', '2027-01-15'), '2026-09-01..2027-02-28');
  assert.equal(r('semester', '2027-04-01'), '2027-03-01..2027-08-31');
  assert.equal(Logic.shiftPeriod('month', '2026-12-15', 1), '2027-01-01');
  assert.equal(Logic.shiftPeriod('week', '2026-11-07', -1), '2026-10-26');
  assert.equal(Logic.shiftPeriod('quarter', '2026-11-07', 1), '2027-01-01');
  assert.equal(Logic.shiftPeriod('semester', '2026-11-07', -1), '2026-03-01');
});

const EV = [
  { date: '2026-11-02', tid: 't1', v: { tec: 7, mov: 5 } },
  { date: '2026-11-05', tid: 't2', v: { tec: 8, con: 6 } },
  { date: '2026-11-19', tid: 't1', v: { mov: 9 } },
  { date: '2026-10-30', tid: 't1', v: { tec: 4 } }
];
test('medie per voce e media generale del periodo', () => {
  const r = Logic.periodRange('month', '2026-11-10');
  const a = Logic.evAverages(Logic.inRange(EV, r), ['tec', 'mov', 'con', 'att']);
  assert.equal(a.per.tec.avg, 7.5); assert.equal(a.per.tec.n, 2);
  assert.equal(a.per.mov.avg, 7); assert.equal(a.per.con.avg, 6);
  assert.equal(a.per.att.avg, null); assert.equal(a.per.att.n, 0);
  assert.equal(a.overall.n, 5); assert.equal(a.overall.avg, (7 + 8 + 5 + 9 + 6) / 5);
});
test('serie per settimana con i buchi (null, non zero) e la media delle voci scelte', () => {
  const r = Logic.periodRange('month', '2026-11-10');
  const s = Logic.evSeries(EV, ['tec', 'mov'], 'month', r, 2);
  assert.equal(JSON.stringify(s.map(p => p.date)), JSON.stringify(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']));
  assert.equal(s[0].n, 0); assert.equal(s[0].vals.tec, null);   // la scheda del 30 ottobre è fuori dal mese
  assert.equal(s[1].vals.tec, 7.5); assert.equal(s[1].vals.mov, 5); assert.equal(s[1].avg, 6.25);
  assert.equal(s[2].vals.tec, null); assert.equal(s[2].avg, null);
  assert.equal(s[3].vals.mov, 9); assert.equal(s[3].vals.tec, null); assert.equal(s[3].avg, 9);
});
test('serie: le settimane future non si mostrano', () => {
  const s = Logic.evSeries(EV, ['tec', 'mov'], 'month', Logic.periodRange('month', '2026-11-10'), 2, '2026-11-12');
  assert.equal(s[s.length - 1].date, '2026-11-09');
});
test('serie per scheda nella settimana (o con poche schede)', () => {
  const s = Logic.evSeries(EV, ['tec'], 'week', Logic.periodRange('week', '2026-11-03'));
  assert.equal(s.length, 2); assert.ok(s[0].bySheet);
  assert.equal(JSON.stringify(s.map(p => p.vals.tec)), '[7,8]');
  const few = Logic.evSeries(EV, ['tec'], 'month', Logic.periodRange('month', '2026-11-10'));
  assert.equal(few.length, 3); assert.ok(few[0].bySheet);
});

console.log(`prove dei calcoli: ${n} superate`);
