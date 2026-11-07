// Calcoli senza pagina e senza database: testi per la ricerca e chiavi dei nomi (omonimi).
// Li usa l'app (Logic) e li provano i test (tests/logic.test.mjs).
const Logic = (() => {
  // testo per la ricerca: senza accenti, minuscolo, spazi singoli
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Chiave di un nome: le grafie più comuni vengono uniformate (doppie, accenti, simboli),
  // così "Pòrcu" e "Porcu" o "Mura Anna" e "MURA  Anna" risultano la stessa persona.
  const RULES = [[/[^a-z]/g, ''], [/(.)\1+/g, '$1']];
  function nameSkeleton(s) {
    let x = norm(s);
    RULES.forEach(([re, r]) => { x = x.replace(re, r); });
    return x;
  }
  const nameKey = (last, first) => nameSkeleton(last) + '|' + nameSkeleton(first);

  // ---------- valutazioni: periodi, medie e serie per il grafico (date "AAAA-MM-GG", calcoli in UTC) ----------
  const D = d => new Date(d + 'T00:00:00Z');
  const S = x => x.toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = D(d); x.setUTCDate(x.getUTCDate() + n); return S(x); };
  const addMonths = (d, n) => { const x = D(d.slice(0, 7) + '-01'); x.setUTCMonth(x.getUTCMonth() + n); return S(x); };
  const monthEnd = d => addDays(addMonths(d, 1), -1);
  // lunedì della settimana ISO
  const weekStart = d => { const w = D(d).getUTCDay(); return addDays(d, -((w + 6) % 7)); };
  // settimana ISO (anno e numero), per raggruppare le schede
  function isoWeek(d) {
    const x = D(addDays(weekStart(d), 3));   // il giovedì decide l'anno
    const y = x.getUTCFullYear(), first = D(`${y}-01-04`);
    const n = 1 + Math.round((x - D(weekStart(S(first)))) / 604800000);
    return `${y}-W${String(n).padStart(2, '0')}`;
  }
  // Periodi: settimana (lun–dom), mese, trimestre solare (gen–mar, apr–giu, lug–set, ott–dic, come il Wrapped),
  // semestre della stagione sportiva (set–feb, mar–ago: la scuola parte a settembre), tutto.
  function periodRange(kind, ref) {
    if (kind === 'week') { const a = weekStart(ref); return { from: a, to: addDays(a, 6) }; }
    if (kind === 'month') { const a = ref.slice(0, 7) + '-01'; return { from: a, to: monthEnd(a) }; }
    if (kind === 'quarter') { const m = +ref.slice(5, 7), q = Math.floor((m - 1) / 3) * 3 + 1; const a = `${ref.slice(0, 4)}-${String(q).padStart(2, '0')}-01`; return { from: a, to: monthEnd(addMonths(a, 2)) }; }
    if (kind === 'semester') { const y = +ref.slice(0, 4), m = +ref.slice(5, 7); const a = m >= 9 ? `${y}-09-01` : m <= 2 ? `${y - 1}-09-01` : `${y}-03-01`; return { from: a, to: monthEnd(addMonths(a, 5)) }; }
    return { from: '0000-01-01', to: '9999-12-31' };
  }
  function shiftPeriod(kind, ref, n) {
    const r = periodRange(kind, ref);
    if (kind === 'week') return addDays(r.from, 7 * n);
    if (kind === 'month') return addMonths(r.from, n);
    if (kind === 'quarter') return addMonths(r.from, 3 * n);
    if (kind === 'semester') return addMonths(r.from, 6 * n);
    return ref;
  }
  const inRange = (list, r) => list.filter(e => e.date >= r.from && e.date <= r.to);
  const mean = vs => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);
  // media per voce (con il numero di voti) e media generale (di tutti i voti delle voci scelte)
  function evAverages(list, keys) {
    const per = {}, all = [];
    keys.forEach(k => { const vs = list.map(e => (e.v || {})[k]).filter(x => typeof x === 'number'); per[k] = { avg: mean(vs), n: vs.length }; all.push(...vs); });
    return { per, overall: { avg: mean(all), n: all.length } };
  }
  // Serie per il grafico: un punto per scheda (settimana, o poche schede) oppure per settimana ISO.
  // Ogni punto ha la media di ogni voce (null = nessun voto: buco, non zero) e la media delle voci scelte.
  // until (facoltativo): le settimane dopo quel giorno (il futuro) non si mostrano
  function evSeries(list, keys, kind, range, few, until) {
    const items = inRange(list, range).slice().sort((a, b) => a.date.localeCompare(b.date));
    const bySheet = kind === 'week' || items.length <= (few == null ? 4 : few);
    let buckets;
    if (bySheet) buckets = items.map(e => ({ key: e.date + '|' + (e.tid || ''), date: e.date, items: [e] }));
    else {
      buckets = [];
      const first = items.length ? items[0].date : range.from, last = items.length ? items[items.length - 1].date : range.to;
      const a = kind === 'all' ? weekStart(first) : weekStart(range.from), z = kind === 'all' ? last : range.to;
      for (let w = a; w <= z && (!until || w <= until); w = addDays(w, 7)) buckets.push({ key: isoWeek(w), date: w, items: items.filter(e => weekStart(e.date) === w) });
    }
    return buckets.map(b => {
      const vals = {};
      keys.forEach(k => { vals[k] = mean(b.items.map(e => (e.v || {})[k]).filter(x => typeof x === 'number')); });
      const got = keys.map(k => vals[k]).filter(x => x != null);
      return { key: b.key, date: b.date, n: b.items.length, vals, avg: mean(got) };
    }).map(p => Object.assign(p, { bySheet }));
  }

  return { norm, nameKey, weekStart, isoWeek, periodRange, shiftPeriod, evAverages, evSeries, inRange };
})();
