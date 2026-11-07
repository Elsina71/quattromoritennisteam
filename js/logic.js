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

  return { norm, nameKey };
})();
