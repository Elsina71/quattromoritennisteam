// Controllo delle traduzioni: italiano, inglese e spagnolo hanno le stesse chiavi, con gli stessi segnaposto {x},
// e ogni chiave scritta nel codice (t('chiave'), data-i18n="chiave") esiste in tutte e tre le lingue.
import { readFileSync, readdirSync } from 'node:fs';
const src = readFileSync(new URL('../js/i18n.js', import.meta.url), 'utf8');
const m = src.match(/const dict = (\{[\s\S]*?\n  \});\n/);
if (!m) throw new Error('dizionario non trovato');
const dict = (0, eval)('(' + m[1] + ')');
const langs = ['it', 'en', 'es'];
let errors = 0;
const fail = msg => { errors++; console.error('ERRORE -', msg); };
for (const l of langs) if (!dict[l]) fail(`manca la lingua ${l}`);
const all = new Set(langs.flatMap(l => Object.keys(dict[l] || {})));
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort().join(',');
for (const k of all) {
  for (const l of langs) if (!(k in dict[l])) fail(`chiave «${k}» mancante in ${l}`);
  if (dict.it[k] && dict.en[k] && dict.es[k] && (ph(dict.it[k]) !== ph(dict.en[k]) || ph(dict.it[k]) !== ph(dict.es[k]))) fail(`segnaposto diversi in «${k}»`);
}
// chiavi usate nel codice
const used = new Set();
const dir = new URL('../js/', import.meta.url);
for (const f of readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'i18n.js')) {
  const code = readFileSync(new URL(f, dir), 'utf8');
  for (const x of code.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*[,)]/g)) used.add(x[1]);
  // t(condizione ? 'a' : 'b') e simili
  for (const x of code.matchAll(/\bt\(\s*[^()'`]*?\?\s*'([A-Za-z0-9_]+)'\s*:\s*'([A-Za-z0-9_]+)'\s*[,)]/g)) { used.add(x[1]); used.add(x[2]); }
}
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
for (const x of html.matchAll(/data-i18n(?:-aria)?="([A-Za-z0-9_]+)"/g)) used.add(x[1]);
for (const k of used) for (const l of langs) if (!(k in (dict[l] || {}))) fail(`«${k}» usata nel codice ma mancante in ${l}`);
// i livelli nuovi
for (const lv of ['mini', 'orange', 'green', 'kids', 'perf', 'preago', 'ago', 'adv', 'adult']) for (const l of langs) if (!dict[l]['fpLevel_' + lv]) fail(`livello ${lv} mancante in ${l}`);
if (errors) { console.error(`traduzioni: ${errors} errori`); process.exit(1); }
console.log(`traduzioni: ${all.size} chiavi in ${langs.join(', ')}, ${used.size} usate nel codice: tutto a posto`);
