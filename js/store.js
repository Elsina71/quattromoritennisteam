// Stato dell'app. I dati arrivano dal database online (cloud.js) e le modifiche vi vengono inviate.
const Store = (() => {
  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function empty() {
    return { notice: '', noticeUntil: '', editorial: [null, null], members: [], messages: [], inbox: [], nicks: {}, accounts: {}, courts: [], booking: null, bookRewards: null,
      bookings: [], bookingsMine: [], bookingsPast: [], bkplayersPast: [], bkpReady: false, weekly: [], recurring: [], manualVerified: {}, emailVerified: {},
      trainings: [], coaches: [], athletes: [], groups: [], plans: [], packs: [], packcount: [], packuse: [], xmem: [], occ: [], att: [], spots: [], receipts: [],
      roles: {}, incassi: [], bkpaid: {}, tesserati: [], occfree: {}, bkplayers: [], prices: null, bans: {}, notices: [], evals: [], bkphones: [], ptreqs: [], pubCoaches: {} };
  }

  // Campo: nome, tipo (tennis o padel), visibile (prenotabile) e orari di apertura per giorno della settimana (1 = lunedì … 7 = domenica).
  function defaultHours() {
    return Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(d => [d, { open: true, from: '08:00', to: '23:00' }]));
  }
  function normCourt(c) {
    const hours = defaultHours();
    Object.keys(c.hours || {}).forEach(d => { hours[d] = Object.assign(hours[d], c.hours[d]); });
    return { id: c.id, name: c.name || 'Campo', type: c.type === 'padel' ? 'padel' : 'tennis', visible: c.visible !== false, hours };
  }

  let state = empty();
  let ready = false;

  function save() {
    if (window.Cloud) window.Cloud.push(state);
  }

  // Dati arrivati dal database: le impostazioni hanno una forma propria, il resto si copia così com'è.
  const PLAIN = ['roles', 'incassi', 'tesserati', 'occfree', 'bkplayers', 'bkpaid', 'bookings', 'bookingsMine', 'bookingsPast', 'bkplayersPast', 'bkpReady',
    'weekly', 'recurring', 'manualVerified', 'emailVerified', 'trainings', 'coaches', 'athletes', 'groups', 'plans', 'packs', 'packcount', 'packuse', 'xmem', 'occ', 'att',
    'spots', 'receipts', 'bans', 'notices', 'members', 'messages', 'inbox', 'accounts', 'evals', 'bkphones', 'ptreqs', 'pubCoaches'];
  function applyRemote(kind, value) {
    if (kind === 'settings') {
      state.notice = value.notice || ''; state.noticeUntil = value.noticeUntil || '';
      state.nicks = value.nicks || {};
      state.courts = (value.courts || []).map(normCourt);
      state.booking = value.booking || null;
      state.bookRewards = value.bookRewards || null;
      state.prices = value.prices || null;
    } else if (kind === 'editorial') {
      state.editorial = (state.editorial || [null, null]).slice();
      state.editorial[value.i] = value.data;
    } else if (PLAIN.includes(kind)) state[kind] = value;
  }

  return {
    get state() { return state; },
    get ready() { return ready; },
    setReady() { ready = true; },
    save,
    uid,
    empty,
    applyRemote,
    normCourt
  };
})();
