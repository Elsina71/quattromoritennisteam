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

console.log(`prove dei calcoli: ${n} superate`);
