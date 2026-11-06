// Pagine dell'app. Tutto il testo passa da esc() prima di finire nella pagina.
import * as D from './db.js';
import { t, getLang, setLang, errText, fmtDay, fmtShort, fmtDate } from './i18n.js';
import {
  times, covered, endOf, durationsAt, isoDate, addDays, dateOf, isPast, nextFree, freeCount, span,
  toMin, ROLES, COURT_TYPES, HOUR_OPTIONS, fullName, isStaffRole,
  EVAL_AREAS, PASS, certStatus, weekStart, weekDays, weeklyDates, age, averages, fromMin
} from './logic.js';

const S = D.S;
const root = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- icone (contorno 1,5px) ----------
const P = {
  grid: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
  ticket: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M8 3v4M16 3v4M8 14l2.5 2.5L16 12"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5A6.5 6.5 0 0 1 21.5 20"/>',
  court: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 12h16M8 3v18M16 3v18M8 7.5h8M8 16.5h8"/>',
  login: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 16l4-4-4-4M19 12H9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M5.5 6.5a9 9 0 0 1 0 11M18.5 6.5a9 9 0 0 0 0 11"/>',
  card: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  back: '<path d="M10 6l-6 6 6 6M4 12h16"/>'
};
const ic = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;
// Il marchio del circolo, ridisegnato dal logo: cerchio blu, croce rossa, quattro palline nere
const MARK = `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#5b6f9b"/><circle cx="32" cy="32" r="22.5" fill="#f2f2f4" stroke="#d42a32" stroke-width="2.6"/><path d="M30.2 9.5h3.6v45h-3.6zM9.5 30.2h45v3.6h-45z" fill="#d42a32"/><g fill="#111"><circle cx="21.6" cy="21.6" r="6.2"/><circle cx="42.4" cy="21.6" r="6.2"/><circle cx="21.6" cy="42.4" r="6.2"/><circle cx="42.4" cy="42.4" r="6.2"/></g><g fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round"><path d="M18.4 16.3a7 7 0 0 1 8.4 8.4M39.2 16.3a7 7 0 0 1 8.4 8.4M18.4 37.1a7 7 0 0 1 8.4 8.4M39.2 37.1a7 7 0 0 1 8.4 8.4"/></g></svg>`;
const GOOGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>';

// ---------- stato della pagina ----------
const ui = { tab: 'all', mineTab: 'up', usersTab: 'all', q: '', authTab: 'login', menu: false, week: weekStart(isoDate()), athTab: 'all', aq: '' };

const ROUTES = ['book', 'mine', 'users', 'courts', 'account', 'trainings', 'training', 'athletes', 'athlete'];
function parts() { return location.hash.replace(/^#\/?/, '').split('?')[0].split('/'); }
function route() {
  const r = parts()[0] || 'book';
  return ROUTES.includes(r) ? r : 'book';
}
const routeId = () => decodeURIComponent(parts()[1] || '');
const routeSub = () => parts()[2] || '';
// voce di menu da evidenziare: le pagine di dettaglio stanno sotto la loro lista
const navOf = r => ({ training: 'trainings', athlete: 'athletes' }[r] || r);

const durLabel = d => t(d === 60 ? 'h1' : d === 90 ? 'h1h30' : 'h2');
const roleLabel = r => t('role_' + r);
const initials = p => ((p.first || '?')[0] + ((p.last || '')[0] || '')).toUpperCase();
const courtById = id => S.courts.find(c => c.id === id);

// ---------- guscio ----------
function navItem(r, icon, label) {
  return `<a class="nav-item" href="#/${r}" ${navOf(route()) === r ? 'aria-current="page"' : ''}>${ic(icon)}<span>${esc(label)}</span></a>`;
}

function sidebar() {
  const signed = !!S.user;
  const staff = D.isStaff(), admin = D.isAdmin();
  const p = S.profile || {};
  return `
  <aside class="sidebar${ui.menu ? ' open' : ''}" id="sidebar" aria-label="${esc(t('menu'))}">
    <button class="btn ghost icon close" data-action="menu" aria-label="${esc(t('close'))}">${ic('x')}</button>
    <a class="brand" href="#/book">${MARK}<span><b>${esc(t('club'))}</b><small>${esc(t('clubScope'))}</small></span></a>
    ${navItem('book', 'grid', t('navBook'))}
    ${signed ? navItem('mine', 'ticket', t('navMine')) : ''}
    ${D.seesTrainings() ? `<p class="group-label">${esc(t('groupClub'))}</p>${navItem('trainings', 'ball', t('navTrainings'))}` : ''}
    ${staff ? `${navItem('athletes', 'card', t('navAthletes'))}${navItem('users', 'users', t('navUsers'))}${admin ? navItem('courts', 'court', t('navCourts')) : ''}` : ''}
    <div class="bottom">
      ${signed
        ? `<a class="who" href="#/account" ${route() === 'account' ? 'aria-current="page"' : ''}><span class="initial">${esc(initials(p))}</span><span><b>${esc(fullName(p) || S.user.email)}</b><small>${esc(roleLabel(D.role()))}</small></span></a>`
        : navItem('account', 'login', t('navLogin'))}
      <div class="segmented small lang-switch" role="group" aria-label="${esc(t('language'))}">
        <button data-action="lang" data-lang="it" aria-pressed="${getLang() === 'it'}">IT</button>
        <button data-action="lang" data-lang="en" aria-pressed="${getLang() === 'en'}">EN</button>
      </div>
    </div>
  </aside>`;
}

const PAGE_TITLE = { book: 'bookTitle', mine: 'mineTitle', users: 'usersTitle', courts: 'courtsTitle', account: 'accountTitle',
  trainings: 'trainingsTitle', training: 'trainingsTitle', athletes: 'athletesTitle', athlete: 'athletesTitle' };

function shell(content) {
  return `
  <div class="app">
    <header class="topbar">
      ${MARK}<b>${esc(t(PAGE_TITLE[route()]))}</b>
      <button class="btn ghost icon" data-action="menu" aria-label="${esc(t('menu'))}" aria-expanded="${ui.menu}" aria-controls="sidebar">${ic('menu')}</button>
    </header>
    ${sidebar()}
    <main class="canvas" id="main">${content}<p class="footer">${esc(t('footer'))}</p></main>
  </div>`;
}

// ---------- prenota: il tabellone ----------
function dayData(courts) {
  const takenBy = {}, blocks = {};
  for (const s of S.slots) {
    (takenBy[s.courtId] = takenBy[s.courtId] || new Set()).add(s.time);
    const k = s.courtId + '|' + (s.bookingId || 'tr:' + s.trainingId);
    const b = blocks[k] || (blocks[k] = { courtId: s.courtId, bookingId: s.bookingId || null, trainingId: s.trainingId || null, times: [] });
    b.times.push(s.time);
  }
  Object.values(blocks).forEach(b => b.times.sort());
  return { takenBy, blocks: Object.values(blocks).filter(b => courts.some(c => c.id === b.courtId)) };
}

function pageBook() {
  if (!S.courtsReady) return `<div class="title-row"><div><h1>${esc(t('bookTitle'))}</h1><p class="sub"><span class="skeleton"></span></p></div></div>`;
  const active = S.courts.filter(c => c.active);
  const types = COURT_TYPES.filter(ty => active.some(c => c.type === ty));
  if (ui.tab !== 'all' && !types.includes(ui.tab)) ui.tab = 'all';
  const courts = active.filter(c => ui.tab === 'all' || c.type === ui.tab);
  const today = isoDate();
  const day = dateOf(S.date);
  const { takenBy, blocks } = dayData(courts);

  // la riga sotto il titolo: la cosa più utile da sapere adesso
  let sub;
  if (S.date < today) sub = esc(t('dayPast'));
  else if (!courts.length) sub = '';
  else {
    const nf = nextFree(courts, S.date, takenBy);
    const n = freeCount(courts, S.date, takenBy);
    sub = nf
      ? `${esc(S.date === today ? t('today') : fmtDay(day)).replace(/^./, c => c.toUpperCase())} · ${t('nextFree', { court: `<strong>${esc(nf.court.name)}</strong>`, time: `<strong class="num">${nf.time}</strong>` })} · ${esc(t('freeLeft', { n, courts: courts.length }))}`
      : esc(t('noneFreeToday'));
  }

  const head = `
  <div class="title-row">
    <div><h1>${esc(t('bookTitle'))}</h1><p class="sub">${sub}</p></div>
    <div class="daybar">
      <button class="btn icon" data-action="day" data-d="-1" aria-label="${esc(t('prevDay'))}">${ic('left')}</button>
      <input class="input num" type="date" id="day" value="${S.date}" aria-label="${esc(t('pickDay'))}">
      <button class="btn icon" data-action="day" data-d="1" aria-label="${esc(t('nextDay'))}">${ic('right')}</button>
      <button class="btn" data-action="today" ${S.date === today ? 'disabled' : ''}>${esc(t('today'))}</button>
    </div>
  </div>`;

  if (!active.length) {
    return head + `<div class="empty"><p>${esc(t('noCourts'))}${D.isAdmin() ? ' ' + esc(t('noCourtsAdmin')) : ''}</p>${D.isAdmin() ? `<a class="btn primary" href="#/courts">${ic('plus')}${esc(t('addCourt'))}</a>` : ''}</div>`;
  }

  const tabs = types.length > 1 ? `<div class="tabs" role="tablist">${['all', ...types].map(k =>
    `<button role="tab" data-action="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${esc(t(k))}<span class="n num">${k === 'all' ? active.length : active.filter(c => c.type === k).length}</span></button>`).join('')}</div>` : '<span></span>';
  const legend = `<div class="legend" aria-label="${esc(t('legend'))}">
    <span><i></i>${esc(t('free'))}</span><span><i class="k-busy"></i>${esc(t('busy'))}</span>
    ${S.user ? `<span><i class="k-mine"></i>${esc(t('yours'))}</span>` : ''}${S.slots.some(x => x.trainingId) ? `<span><i class="k-training"></i>${esc(t('training'))}</span>` : ''}<span><i class="k-closed"></i>${esc(t('closed'))}</span></div>`;

  if (S.slotsError) {
    return head + `<div class="board-head">${tabs}${legend}</div><div class="empty"><p>${esc(t('loadError'))}</p><button class="btn" data-action="retry">${esc(t('retry'))}</button></div>`;
  }

  const sp = span(courts);
  const rowsT = times(sp.from, sp.to);
  const rowOf = tm => rowsT.indexOf(tm) + 2;
  const mineIds = new Set(S.myBookings.map(b => b.id));
  const staff = D.isStaff();
  let cells = `<div class="corner" style="grid-column:1;grid-row:1"></div>`;
  rowsT.forEach((tm, i) => {
    const h = tm.endsWith(':00');
    cells += `<div class="tm num${h ? ' h' : ''}${i === 0 ? ' first' : ''}" style="grid-column:1;grid-row:${i + 2}">${h || i === 0 ? tm : ''}</div>`;
  });
  courts.forEach((c, ci) => {
    const col = ci + 2;
    cells += `<div class="court-h" style="grid-column:${col};grid-row:1"><b>${esc(c.name)}</b><small>${esc(t(c.type))} · <span class="num">${c.from}–${c.to}</span></small></div>`;
    const taken = takenBy[c.id] || new Set();
    rowsT.forEach(tm => {
      if (taken.has(tm)) return;
      const r = rowOf(tm), hr = tm.endsWith(':00') ? ' hr' : '';
      const pos = `style="grid-column:${col};grid-row:${r}"`;
      if (toMin(tm) < toMin(c.from) || toMin(tm) >= toMin(c.to)) cells += `<div class="cell closed${hr}" ${pos}></div>`;
      else if (isPast(S.date, tm)) cells += `<div class="cell past${hr}" ${pos}></div>`;
      else if (!durationsAt(c, tm, taken).length) cells += `<div class="cell short${hr}" ${pos}></div>`;   // non ci sta neanche un'ora
      else cells += `<button class="cell free${hr}" ${pos} data-action="pick" data-court="${c.id}" data-time="${tm}" aria-label="${esc(t('bookAt', { court: c.name, time: tm }))}">+ ${tm}</button>`;
    });
  });
  // le prenotazioni: un blocco per ogni gruppo di mezz'ore consecutive della stessa prenotazione
  for (const b of blocks) {
    const c = courtById(b.courtId); const col = courts.indexOf(c) + 2;
    let runs = [[b.times[0]]];
    for (let i = 1; i < b.times.length; i++) {
      const prev = runs[runs.length - 1];
      if (toMin(b.times[i]) - toMin(prev[prev.length - 1]) === 30) prev.push(b.times[i]); else runs.push([b.times[i]]);
    }
    const bk = b.bookingId ? D.bookingOf({ bookingId: b.bookingId }) : null;
    const tr = b.trainingId ? D.trainingOf(b.trainingId) : null;
    const mine = !!b.bookingId && mineIds.has(b.bookingId);
    for (const run of runs) {
      if (!rowsT.includes(run[0])) continue;
      const end = endOf(run[run.length - 1], 30);
      const range = `<span class="num">${run[0]}–${end}</span>`;
      const style = `style="grid-column:${col};grid-row:${rowOf(run[0])} / span ${run.length}"`;
      if (b.trainingId) {
        // allenamento: chi lo vede per intero (staff, il suo allenatore) apre la sua pagina
        const label = tr ? `<b>${esc(tr.title)}</b>${range}<span class="who-line">${esc(tr.coachName)}</span>` : `<b>${esc(t('training'))}</b>${range}`;
        cells += tr ? `<a class="slot training" ${style} href="#/training/${encodeURIComponent(b.trainingId)}">${label}</a>` : `<div class="slot training" ${style}>${label}</div>`;
        continue;
      }
      const label = mine ? `<b>${esc(t('yours'))}</b>${range}` : staff && bk ? `<b>${esc(bk.name)}</b>${range}` : `<b>${esc(t('busy'))}</b>${range}`;
      cells += (mine || (staff && bk))
        ? `<button class="slot${mine ? ' mine' : ''}" ${style} data-action="open-booking" data-id="${esc(b.bookingId)}">${label}</button>`
        : `<div class="slot" ${style}>${label}</div>`;
    }
  }
  // linea dell'ora attuale
  let nowLine = '';
  if (S.date === today) {
    const now = new Date(); const m = now.getHours() * 60 + now.getMinutes();
    if (m >= toMin(sp.from) && m < toMin(sp.to)) nowLine = `<div class="now-line" style="top:calc(52px + (var(--half) * ${((m - toMin(sp.from)) / 30).toFixed(3)}))"></div>`;
  }
  return head + `
  <div class="board-head">${tabs}${legend}</div>
  <div class="board-frame" id="boardFrame">
    <div class="board" style="--cols:${courts.length};--rows:${rowsT.length}" role="grid" aria-label="${esc(fmtDay(day))}">${cells}${nowLine}</div>
  </div>`;
}

// ---------- le mie prenotazioni ----------
function bookingRows(list, withCancel) {
  return list.map(b => {
    const c = courtById(b.courtId);
    const when = fmtShort(dateOf(b.date));
    return `<tr>
      <td class="main"><b>${esc(when)}</b><span class="sub num">${b.start}–${b.end} · ${esc(durLabel(b.dur))}</span></td>
      <td class="extra">${esc(c ? c.name : '—')}${c ? ` · ${esc(t(c.type))}` : ''}</td>
      <td class="act">${withCancel ? `<button class="link danger" data-action="cancel-booking" data-id="${esc(b.id)}">${esc(t('cancelBooking'))}</button>` : ''}</td>
    </tr>`;
  }).join('');
}

function pageMine() {
  if (!S.user) return signInFirst();
  const today = isoDate(); const now = new Date();
  const ended = b => b.date < today || (b.date === today && toMin(b.end) <= now.getHours() * 60 + now.getMinutes());
  const up = S.myBookings.filter(b => !ended(b)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const past = S.myBookings.filter(ended).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const list = ui.mineTab === 'up' ? up : past;
  const n = list.length;
  return `
  <div class="title-row">
    <div><h1>${esc(t('mineTitle'))}</h1><p class="sub">${esc(n === 1 ? t('count1') : t('count', { n }))}</p></div>
    <a class="btn primary" href="#/book">${ic('plus')}${esc(t('bookNow'))}</a>
  </div>
  <div class="tabs" role="tablist">
    <button role="tab" data-action="mine-tab" data-tab="up" aria-selected="${ui.mineTab === 'up'}">${esc(t('upcoming'))}<span class="n num">${up.length}</span></button>
    <button role="tab" data-action="mine-tab" data-tab="past" aria-selected="${ui.mineTab === 'past'}">${esc(t('past'))}<span class="n num">${past.length}</span></button>
  </div>
  ${n ? `<div class="table-wrap"><table class="stack">
    <thead><tr><th>${esc(t('when'))}</th><th>${esc(t('court'))}</th><th><span class="sr">${esc(t('cancelBooking'))}</span></th></tr></thead>
    <tbody>${bookingRows(list, ui.mineTab === 'up')}</tbody></table></div>`
    : `<div class="empty" style="margin-top:24px"><p>${esc(t(ui.mineTab === 'up' ? 'noUpcoming' : 'noPast'))}</p></div>`}`;
}

// ---------- utenti (staff) ----------
function pageUsers() {
  if (!S.user) return signInFirst();
  if (!D.isStaff()) return `<div class="empty">${esc(t('staffOnly'))}</div>`;
  const q = ui.q.trim().toLowerCase();
  const byTab = S.users.filter(u => ui.usersTab === 'all' || u.role === ui.usersTab);
  const list = byTab.filter(u => !q || [fullName(u), u.email, u.phone].join(' ').toLowerCase().includes(q));
  const count = r => S.users.filter(u => r === 'all' || u.role === r).length;
  const tabs = ['all', ...ROLES].map(r =>
    `<button role="tab" data-action="users-tab" data-tab="${r}" aria-selected="${ui.usersTab === r}">${esc(r === 'all' ? t('all') : t('roles_' + r))}<span class="n num">${S.usersReady ? count(r) : ''}</span></button>`).join('');
  const rowsHtml = list.map(u => {
    const since = u.createdAt && u.createdAt.toDate ? fmtDate(u.createdAt.toDate()) : '—';
    return `<tr>
      <td class="main"><div class="name-cell"><span class="initial">${esc(initials(u))}</span><span><b>${esc(fullName(u))}</b><span class="sub">${esc(u.email || '—')}</span></span></div></td>
      <td class="extra num">${esc(u.phone || '—')}</td>
      <td class="extra"><span class="pill${isStaffRole(u.role) ? ' accent' : ''}">${esc(roleLabel(u.role))}</span></td>
      <td class="extra num">${esc(since)}</td>
      <td class="act"><button class="link" data-action="edit-user" data-id="${esc(u.id)}">${esc(t('edit'))}</button></td>
      <td class="mline num">${esc([roleLabel(u.role), u.phone].filter(Boolean).join(' · '))}</td>
    </tr>`;
  }).join('');
  return `
  <div class="title-row"><div><h1>${esc(t('usersTitle'))}</h1><p class="sub">${S.usersReady ? esc(S.users.length === 1 ? t('usersCount1') : t('usersCount', { n: S.users.length })) : '<span class="skeleton"></span>'}</p></div></div>
  <div class="tabs" role="tablist">${tabs}</div>
  <div class="toolbar">
    <label class="search">${ic('search')}<span class="sr">${esc(t('search'))}</span><input class="input" id="q" type="search" placeholder="${esc(t('search'))}" value="${esc(ui.q)}" autocomplete="off"></label>
    <span class="meta num">${esc(list.length === 1 ? t('usersCount1') : t('usersCount', { n: list.length }))}</span>
  </div>
  ${!S.usersReady ? `<div class="empty">${esc(t('loading'))}</div>`
    : list.length ? `<div class="table-wrap"><table class="stack users">
      <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('phone'))}</th><th>${esc(t('roleCol'))}</th><th>${esc(t('since'))}</th><th><span class="sr">${esc(t('edit'))}</span></th><th class="mline"></th></tr></thead>
      <tbody>${rowsHtml}</tbody></table></div>`
    : `<div class="empty">${esc(t('noUsers'))}</div>`}`;
}

// ---------- campi (admin) ----------
function pageCourts() {
  if (!S.user) return signInFirst();
  if (!D.isAdmin()) return `<div class="empty">${esc(t('adminOnly'))}</div>`;
  const rowsHtml = S.courts.map(c => `
    <div class="court-row">
      <div><b>${esc(c.name)}</b><div class="sub num">${esc(t(c.type))} · ${c.from}–${c.to}${c.active ? '' : ' · ' + esc(t('hidden'))}</div></div>
      <span class="pill${c.active ? ' pos' : ''}">${esc(c.active ? t('bookable') : t('hidden'))}</span>
      <button class="link" data-action="edit-court" data-id="${esc(c.id)}">${esc(t('edit'))}</button>
    </div>`).join('');
  const byType = COURT_TYPES.map(ty => `${S.courts.filter(c => c.type === ty).length} ${t(ty).toLowerCase()}`).join(' · ');
  return `
  <div class="title-row">
    <div><h1>${esc(t('courtsTitle'))}</h1><p class="sub num">${esc(byType)}</p></div>
    <button class="btn primary" data-action="new-court">${ic('plus')}${esc(t('addCourt'))}</button>
  </div>
  <div class="settings">
    <section class="set-row">
      <div><h2>${esc(t('courtsTitle'))}</h2><p class="help">${esc(t('courtsSub'))}</p></div>
      <div class="set-panel">${S.courts.length ? `<div class="court-list">${rowsHtml}</div>` : `<div class="empty">${esc(t('noCourts'))}</div>`}</div>
    </section>
  </div>`;
}

// ---------- account ----------
function signInFirst() {
  return `<div class="empty"><p>${esc(t('signInFirst'))}</p><a class="btn primary" href="#/account">${ic('login')}${esc(t('loginBtn'))}</a></div>`;
}

function miniBoard() {
  // anteprima statica del tabellone: tre campi, un pomeriggio
  const rowsM = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30'];
  const cols = ['Centrale', 'Campo 2', 'Padel 1'];
  let h = `<div class="t" style="grid-column:1;grid-row:1"></div>`;
  cols.forEach((c, i) => { h += `<div class="h" style="grid-column:${i + 2};grid-row:1">${c}</div>`; });
  rowsM.forEach((r, j) => {
    h += `<div class="t num" style="grid-column:1;grid-row:${j + 2}">${r}</div>`;
    cols.forEach((_, i) => { h += `<div style="grid-column:${i + 2};grid-row:${j + 2}"></div>`; });
  });
  // [colonna, prima riga, mezz'ore, tua?]
  [[0, 1, 3, false], [1, 2, 3, true], [2, 0, 2, false], [2, 4, 2, false]].forEach(([c, r, n, y]) => {
    h += `<div class="${y ? 'y' : 'b'}" style="grid-column:${c + 2};grid-row:${r + 2} / span ${n}">${esc(t(y ? 'yours' : 'busy'))}</div>`;
  });
  return `<div class="mini" aria-hidden="true">${h}</div>`;
}

function pageAccount() {
  if (!S.authReady) return `<div class="empty">${esc(t('loading'))}</div>`;
  if (!S.user) {
    const reg = ui.authTab === 'register';
    return `
    <div class="auth">
      <div class="auth-intro"><h1>${esc(t(reg ? 'registerTitle' : 'loginTitle'))}</h1><p>${esc(t('loginIntro'))}</p><div class="preview">${miniBoard()}</div>
        <ul class="how"><li><b>${esc(t('how1'))}</b>${esc(t('how1d'))}</li><li><b>${esc(t('how2'))}</b>${esc(t('how2d'))}</li><li><b>${esc(t('how3'))}</b>${esc(t('how3d'))}</li></ul></div>
      <div class="auth-card">
        <div class="tabs" role="tablist">
          <button role="tab" data-action="auth-tab" data-tab="login" aria-selected="${!reg}">${esc(t('loginTitle'))}</button>
          <button role="tab" data-action="auth-tab" data-tab="register" aria-selected="${reg}">${esc(t('registerTitle'))}</button>
        </div>
        <form class="fields" id="authForm" novalidate>
          <button type="button" class="btn block gbtn" data-action="google">${GOOGLE}${esc(t('google'))}</button>
          <p class="or">${esc(t('or'))}</p>
          ${reg ? `<div class="fields two">
            <label class="field"><span>${esc(t('firstName'))}</span><input class="input" name="first" autocomplete="given-name" required maxlength="40"></label>
            <label class="field"><span>${esc(t('lastName'))}</span><input class="input" name="last" autocomplete="family-name" required maxlength="40"></label>
          </div>
          <label class="field"><span>${esc(t('phoneOptional'))}</span><input class="input" name="phone" type="tel" autocomplete="tel" maxlength="30"></label>` : ''}
          <label class="field"><span>${esc(t('email'))}</span><input class="input" name="email" type="email" autocomplete="email" required></label>
          <label class="field"><span>${esc(t('password'))}</span><input class="input" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="6" ${reg ? 'aria-describedby="pwHint"' : ''}>${reg ? `<small class="hint" id="pwHint">${esc(t('passwordHint'))}</small>` : ''}</label>
          <p class="form-msg" id="authMsg" role="status"></p>
          <button class="btn primary block" type="submit">${esc(t(reg ? 'registerBtn' : 'loginBtn'))}</button>
          ${reg ? '' : `<button type="button" class="link" data-action="forgot" style="justify-self:start">${esc(t('forgot'))}</button>`}
        </form>
      </div>
    </div>`;
  }
  const p = S.profile || {};
  return `
  <div class="title-row"><div><h1>${esc(t('accountTitle'))}</h1><p class="sub">${esc(fullName(p))} · ${esc(roleLabel(D.role()))}</p></div></div>
  <div class="settings">
    <section class="set-row">
      <div><h2>${esc(t('profile'))}</h2><p class="help">${esc(t('profileHelp'))}</p></div>
      <form class="set-panel" id="profileForm">
        <div class="fields">
          <div class="fields two">
            <label class="field"><span>${esc(t('firstName'))}</span><input class="input" name="first" value="${esc(p.first)}" required maxlength="40" autocomplete="given-name"></label>
            <label class="field"><span>${esc(t('lastName'))}</span><input class="input" name="last" value="${esc(p.last)}" maxlength="40" autocomplete="family-name"></label>
          </div>
          <label class="field"><span>${esc(t('phone'))}</span><input class="input" name="phone" type="tel" value="${esc(p.phone)}" maxlength="30" autocomplete="tel"></label>
          <label class="field"><span>${esc(t('email'))}</span><input class="input" value="${esc(S.user.email)}" disabled></label>
        </div>
        <p class="form-msg" id="profileMsg" role="status"></p>
        <div class="foot"><button class="btn primary" type="submit">${esc(t('save'))}</button></div>
      </form>
    </section>
    <section class="set-row">
      <div><h2>${esc(t('language'))}</h2><p class="help">${esc(t('languageHelp'))}</p></div>
      <div class="set-panel"><div class="segmented" role="group" aria-label="${esc(t('language'))}">
        <button data-action="lang" data-lang="it" aria-pressed="${getLang() === 'it'}">Italiano</button>
        <button data-action="lang" data-lang="en" aria-pressed="${getLang() === 'en'}">English</button>
      </div></div>
    </section>
    <section class="set-row">
      <div><h2>${esc(t('session'))}</h2><p class="help">${esc(t('sessionHelp', { email: S.user.email }))}</p>${S.user.emailVerified ? '' : `<p class="help">${esc(t('verifyEmail'))}</p>`}</div>
      <div class="set-panel"><button class="btn" data-action="logout">${ic('logout')}${esc(t('logout'))}</button></div>
    </section>
  </div>`;
}

// ---------- pezzo 2: allenamenti ----------
const coaches = () => S.users.filter(u => u.role === 'allenatore' || u.role === 'admin');
const athleteById = id => S.athletes.find(a => a.id === id);
const certPill = a => {
  const st = certStatus(a.certExpiry);
  const date = a.certExpiry ? fmtDate(dateOf(a.certExpiry)) : '';
  const txt = st.state === 'd7' ? (st.days === 0 ? t('cert_d7_0') : st.days === 1 ? t('cert_d7_1') : t('cert_d7', { n: st.days }))
    : t('cert_' + st.state, { n: st.days, date });
  const cls = { ok: '', d30: ' warn', d7: ' neg', expired: ' neg', missing: ' warn' }[st.state];
  return `<span class="pill${cls}">${esc(txt)}</span>`;
};
const fitpPill = a => (a.fitpPaid && a.fitpYear === new Date().getFullYear())
  ? `<span class="pill pos">${esc(t('fitpPaidYear', { y: a.fitpYear }))}</span>`
  : `<span class="pill">${esc(t('fitpUnpaid'))}</span>`;
const trWhen = tr => `${fmtDay(dateOf(tr.date)).replace(/^./, c => c.toUpperCase())} · ${tr.start}–${tr.end}`;

function weekTrainings() {
  const days = weekDays(ui.week);
  if (D.isStaff()) {
    if (ui.weekListened !== ui.week) { ui.weekListened = ui.week; D.listenWeek(days[0], days[6]); }
    return S.weekTrainings || null;
  }
  return S.myTrainingsReady ? S.myTrainings.filter(x => x.date >= days[0] && x.date <= days[6]) : null;
}

function pageTrainings() {
  if (!S.user) return signInFirst();
  if (!D.seesTrainings()) return `<div class="empty">${esc(t('staffOrCoach'))}</div>`;
  const days = weekDays(ui.week);
  const list = weekTrainings();
  const fmtD = d => new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'it-IT', { day: 'numeric', month: 'short' }).format(dateOf(d));
  const n = list ? list.length : 0;
  const pres = list ? list.reduce((a, x) => a + x.athleteIds.length, 0) : 0;
  const head = `
  <div class="title-row">
    <div><h1>${esc(t('trainingsTitle'))}</h1>
      <p class="sub num">${esc(t('weekOf', { from: fmtD(days[0]), to: fmtD(days[6]) }))}${list ? ` · ${esc(n === 1 ? t('trCount1') : t('trCount', { n }))} · ${esc(t('presences', { n: pres }))}` : ''}</p></div>
    <div class="actions">
      <div class="daybar">
        <button class="btn icon" data-action="week" data-d="-7" aria-label="${esc(t('prevWeek'))}">${ic('left')}</button>
        <button class="btn" data-action="week" data-d="0" ${ui.week === weekStart(isoDate()) ? 'disabled' : ''}>${esc(t('thisWeek'))}</button>
        <button class="btn icon" data-action="week" data-d="7" aria-label="${esc(t('nextWeek'))}">${ic('right')}</button>
      </div>
      ${D.isStaff() ? `<a class="btn primary" href="#/training/new">${ic('plus')}${esc(t('newTraining'))}</a>` : ''}
    </div>
  </div>`;
  if (!list) return head + `<div class="empty">${esc(t('loading'))}</div>`;
  if (!list.length) return head + `<div class="empty"><p>${esc(t('noTrainingsWeek'))}</p></div>`;
  const today = isoDate();
  const groups = days.map(d => [d, list.filter(x => x.date === d).sort((a, b) => a.start.localeCompare(b.start))]).filter(g => g[1].length);
  return head + groups.map(([d, items]) => `
    <section class="day-group${d === today ? ' today' : ''}">
      <h2>${esc(fmtDay(dateOf(d)).replace(/^./, c => c.toUpperCase()))}</h2>
      <div class="table-wrap"><table class="stack">
        <thead class="sr"><tr><th>${esc(t('time'))}</th><th>${esc(t('trTitle'))}</th><th>${esc(t('coach'))}</th><th>${esc(t('athletesIn'))}</th><th></th></tr></thead>
        <tbody>${items.map(x => {
          const c = courtById(x.courtId);
          const k = x.athleteIds.length;
          return `<tr>
            <td class="main tr-time num"><b>${x.start}–${x.end}</b><span class="sub">${esc(c ? c.name : '—')}</span></td>
            <td class="extra"><b class="ink">${esc(x.title)}</b></td>
            <td class="extra">${esc(x.coachName || '—')}</td>
            <td class="extra num">${esc(k === 1 ? t('athletesCount1') : t('athletesCount', { n: k }))}</td>
            <td class="act"><a class="link" href="#/training/${encodeURIComponent(x.id)}">${esc(t('open'))}</a></td>
          </tr>`;
        }).join('')}</tbody></table></div>
    </section>`).join('');
}

// nuovo allenamento (staff)
function pageTrainingNew() {
  if (!S.user) return signInFirst();
  if (!D.isStaff()) return `<div class="empty">${esc(t('staffOnly'))}</div>`;
  const courts = S.courts.filter(c => c.active);
  const f = ui.nt || (ui.nt = { title: '', courtId: (courts[0] || {}).id || '', date: S.date < isoDate() ? isoDate() : S.date, start: '17:00', dur: 90, coachId: '', athleteIds: [], repeat: false, until: addDays(S.date < isoDate() ? isoDate() : S.date, 7 * 12), notes: '', q: '' });
  const court = courtById(f.courtId) || courts[0];
  const starts = court ? times(court.from, court.to).filter(x => toMin(x) + 60 <= toMin(court.to)) : [];
  if (court && !starts.includes(f.start)) f.start = starts[0];
  const maxDur = court && f.start ? toMin(court.to) - toMin(f.start) : 120;
  if (f.dur > maxDur) f.dur = maxDur >= 120 ? 120 : maxDur >= 90 ? 90 : 60;
  const dates = f.repeat ? weeklyDates(f.date, f.until || f.date) : [f.date];
  const q = f.q.trim().toLowerCase();
  const active = S.athletes.filter(a => a.active !== false);
  const shown = active.filter(a => !q || fullName(a).toLowerCase().includes(q) || f.athleteIds.includes(a.id));
  const cs = coaches();
  return `
  <div class="title-row"><div><a class="back" href="#/trainings">${ic('back')}${esc(t('trainingsTitle'))}</a><h1>${esc(t('newTraining'))}</h1></div></div>
  <form class="settings" id="trForm" novalidate>
    <section class="set-row">
      <div><h2>${esc(t('trWhen'))}</h2><p class="help">${esc(t('trWhenHelp'))}</p></div>
      <div class="set-panel fields">
        <label class="field"><span>${esc(t('trTitle'))}</span><input class="input" name="title" data-nt="title" value="${esc(f.title)}" placeholder="${esc(t('trTitlePh'))}" maxlength="60" required></label>
        <div class="fields two">
          <label class="field"><span>${esc(t('court'))}</span><select class="input" data-nt="courtId">${courts.map(c => `<option value="${esc(c.id)}" ${c.id === f.courtId ? 'selected' : ''}>${esc(c.name)} · ${esc(t(c.type))}</option>`).join('')}</select></label>
          <label class="field"><span>${esc(t('date'))}</span><input class="input num" type="date" data-nt="date" value="${f.date}" min="${isoDate()}"></label>
        </div>
        <div class="fields two">
          <label class="field"><span>${esc(t('start'))}</span><select class="input num" data-nt="start">${starts.map(x => `<option ${x === f.start ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <div class="field"><span>${esc(t('duration'))}</span><div class="segmented" role="group" aria-label="${esc(t('duration'))}">
            ${[60, 90, 120].map(d => `<button type="button" data-action="nt-dur" data-dur="${d}" aria-pressed="${d === f.dur}" ${d <= maxDur ? '' : 'disabled'}>${esc(durLabel(d))}</button>`).join('')}</div></div>
        </div>
        <label class="field check"><input class="switch" type="checkbox" data-nt="repeat" ${f.repeat ? 'checked' : ''}><span>${esc(t('repeatWeekly'))}</span></label>
        ${f.repeat ? `<label class="field"><span>${esc(t('until'))}</span><input class="input num" type="date" data-nt="until" value="${f.until}" min="${f.date}"><small class="hint num">${esc(dates.length === 1 ? t('trCount1') : t('trCount', { n: dates.length }))}${dates.length >= 52 ? ' (max 52)' : ''}</small></label>` : ''}
      </div>
    </section>
    <section class="set-row">
      <div><h2>${esc(t('trWho'))}</h2><p class="help">${esc(t('trWhoHelp'))}</p></div>
      <div class="set-panel fields">
        <label class="field"><span>${esc(t('coach'))}</span>
          <select class="input" data-nt="coachId" ${cs.length ? '' : 'disabled aria-describedby="noCoach"'}><option value="">${esc(t('chooseCoach'))}</option>${cs.map(u => `<option value="${esc(u.id)}" ${u.id === f.coachId ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select>
          ${cs.length ? '' : `<small class="hint" id="noCoach">${esc(t('noCoaches'))}</small>`}</label>
        <div class="field"><span>${esc(t('athletesIn'))} <span class="meta num">· ${f.athleteIds.length}</span></span>
          ${active.length ? `<label class="search wide">${ic('search')}<span class="sr">${esc(t('searchAthletes'))}</span><input class="input" id="ntq" type="search" placeholder="${esc(t('searchAthletes'))}" value="${esc(f.q)}" autocomplete="off"></label>
          <div class="pick-list">${shown.map(a => `<label class="pick"><input type="checkbox" data-nt-athlete="${esc(a.id)}" ${f.athleteIds.includes(a.id) ? 'checked' : ''}><span>${esc(fullName(a))}</span><small class="num">${a.birth ? esc(t('yearsOld', { n: age(a.birth) })) : ''}</small></label>`).join('')}</div>`
          : `<div class="empty"><p>${esc(t('noAthletesYet'))}</p><a class="btn" href="#/athlete/new">${ic('plus')}${esc(t('addAthletesFirst'))}</a></div>`}
        </div>
        <label class="field"><span>${esc(t('notes'))}</span><input class="input" data-nt="notes" value="${esc(f.notes)}" maxlength="500"></label>
      </div>
    </section>
    <p class="form-msg" id="trMsg" role="status"></p>
    <div class="form-foot"><a class="btn" href="#/trainings">${esc(t('cancel'))}</a><button class="btn primary" type="submit">${esc(dates.length > 1 ? t('createTrN', { n: dates.length }) : t('createTr'))}</button></div>
  </form>`;
}

// il dettaglio di un allenamento
function loadTraining(id) {
  if (ui.trId === id) return;
  ui.trId = id; ui.tr = undefined; ui.trEvals = null;
  D.listenTraining(id, tr => { ui.tr = tr; });
  D.listenEvals({ trainingId: id }, list => { ui.trEvals = list; });
}

function pageTraining() {
  if (!S.user) return signInFirst();
  if (!D.seesTrainings()) return `<div class="empty">${esc(t('staffOrCoach'))}</div>`;
  const id = routeId();
  if (id === 'new') return pageTrainingNew();
  loadTraining(id);
  const tr = ui.tr;
  if (tr === undefined) return `<div class="empty">${esc(t('loading'))}</div>`;
  if (!tr) return `<div class="empty"><p>${esc(t('trNotFound'))}</p><a class="btn" href="#/trainings">${esc(t('trainingsTitle'))}</a></div>`;
  if (routeSub() === 'eval') return pageEval(tr);
  const staff = D.isStaff();
  const c = courtById(tr.courtId);
  const evals = Object.fromEntries((ui.trEvals || []).map(e => [e.athleteId, e]));
  const others = staff ? S.athletes.filter(a => a.active !== false && !tr.athleteIds.includes(a.id)) : [];
  const rowsHtml = tr.athleteIds.map(aid => {
    const a = staff ? athleteById(aid) : null;
    const e = evals[aid];
    const given = e ? Object.keys(e.scores || {}).length : 0;
    return `<tr>
      <td class="main"><div class="name-cell"><span class="initial">${esc(initials({ first: (tr.names[aid] || '?'), last: (tr.names[aid] || '').split(' ')[1] || '' }))}</span><span><b>${esc(tr.names[aid] || '—')}</b>${a && a.birth ? `<span class="sub num">${esc(t('yearsOld', { n: age(a.birth) }))}</span>` : ''}</span></div></td>
      ${staff ? `<td class="extra">${a ? certPill(a) : ''}</td>` : ''}
      <td class="extra">${e ? `<span class="pill accent">${esc(t('evaluated'))} · ${esc(t('givenScores', { n: given }))}</span>` : `<span class="meta">${esc(t('notEvaluated'))}</span>`}</td>
      <td class="act">${staff ? `${a ? `<a class="link" href="#/athlete/${encodeURIComponent(aid)}">${esc(t('open'))}</a>` : ''}<button class="link danger" data-action="tr-remove" data-id="${esc(aid)}">${esc(t('remove'))}</button>` : ''}</td>
    </tr>`;
  }).join('');
  const k = tr.athleteIds.length;
  return `
  <div class="title-row">
    <div><a class="back" href="#/trainings">${ic('back')}${esc(t('trainingsTitle'))}</a><h1>${esc(tr.title)}</h1>
      <p class="sub num">${esc(trWhen(tr))} · ${esc(c ? c.name : '—')} · ${esc(tr.coachName || '—')}</p></div>
    ${staff ? `<div class="actions"><button class="btn" data-action="tr-edit">${esc(t('edit'))}</button><button class="btn danger" data-action="tr-delete">${esc(t('delete'))}</button></div>` : ''}
  </div>
  ${tr.notes ? `<p class="tr-notes">${esc(tr.notes)}</p>` : ''}
  <div class="toolbar">
    <h2 class="section-h">${esc(t('athletesIn'))} <span class="meta num">${esc(k === 1 ? t('athletesCount1') : t('athletesCount', { n: k }))}</span></h2>
    ${staff && others.length ? `<label class="add-athlete"><span class="sr">${esc(t('addAthlete'))}</span><select class="input" id="trAdd"><option value="">+ ${esc(t('addAthlete'))}</option>${others.map(a => `<option value="${esc(a.id)}">${esc(fullName(a))}</option>`).join('')}</select></label>` : ''}
  </div>
  ${k ? `<div class="table-wrap"><table class="stack"><thead class="sr"><tr><th>${esc(t('name'))}</th>${staff ? `<th>${esc(t('cert'))}</th>` : ''}<th>${esc(t('evalsTitle'))}</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`
    : `<div class="empty">${esc(t('noAthletesInTr'))}</div>`}
  ${k ? `<div class="eval-cta"><a class="btn primary big" href="#/training/${encodeURIComponent(tr.id)}/eval">${ic('card')}${esc(t('evalButton'))}</a></div>` : ''}`;
}

// la scheda di valutazione: 7 voci da 1 a 10 per ogni corsista
function pageEval(tr) {
  const d = ui.draft && ui.draft.trainingId === tr.id ? ui.draft : (ui.draft = { trainingId: tr.id, cur: tr.athleteIds[0], data: {}, dirty: new Set(), seeded: false });
  if (!d.seeded && ui.trEvals !== null) {
    for (const e of ui.trEvals) if (!d.data[e.athleteId]) d.data[e.athleteId] = { scores: Object.assign({}, e.scores), note: e.note || '' };
    d.seeded = true;
  }
  if (!tr.athleteIds.includes(d.cur)) d.cur = tr.athleteIds[0];
  const cur = d.cur;
  const entry = d.data[cur] || (d.data[cur] = { scores: {}, note: '' });
  const chips = tr.athleteIds.map(aid => {
    const n = Object.keys((d.data[aid] || {}).scores || {}).length;
    return `<button type="button" role="tab" class="chip${aid === cur ? ' on' : ''}" data-action="ev-athlete" data-id="${esc(aid)}" aria-selected="${aid === cur}">
      <b>${esc(tr.names[aid] || '—')}</b><small class="num">${n ? esc(t('givenScores', { n })) : esc(t('noScores'))}</small></button>`;
  }).join('');
  const rowsHtml = EVAL_AREAS.map(k => {
    const v = entry.scores[k];
    return `<div class="ev-row">
      <div class="ev-label"><b>${esc(t('area_' + k))}</b><span>${esc(t('look_' + k))}</span></div>
      <div class="scale" role="radiogroup" aria-label="${esc(t('area_' + k))}">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<button type="button" role="radio" class="sc${n === PASS ? ' pass' : ''}${v === n ? (n < PASS ? ' on low' : ' on') : ''}" data-action="ev-score" data-k="${k}" data-n="${n}" aria-checked="${v === n}" aria-label="${esc(t('scoreOf', { area: t('area_' + k), n }))}">${n}</button>`).join('')}
      </div>
    </div>`;
  }).join('');
  const idx = tr.athleteIds.indexOf(cur);
  const dirty = d.dirty.size;
  return `
  <div class="title-row">
    <div><a class="back" href="#/training/${encodeURIComponent(tr.id)}">${ic('back')}${esc(tr.title)}</a><h1>${esc(t('evalTitle'))}</h1>
      <p class="sub num">${esc(trWhen(tr))} · ${esc(tr.coachName || '—')}</p></div>
  </div>
  <p class="ev-help">${esc(t('evalHelp'))}</p>
  <div class="ev">
    <div class="ev-people" role="tablist" aria-label="${esc(t('athletesIn'))}">${chips}</div>
    <section class="ev-sheet" aria-label="${esc(tr.names[cur] || '')}">
      <header class="ev-head"><h2>${esc(tr.names[cur] || '—')}</h2><span class="meta num">${idx + 1} / ${tr.athleteIds.length}</span></header>
      <div class="ev-cols" aria-hidden="true"><span>${esc(t('area'))} · ${esc(t('look'))}</span><span>${esc(t('score'))} <span class="pass-key">6 = ${esc(t('pass'))}</span></span></div>
      ${rowsHtml}
      <label class="field ev-note"><span>${esc(t('noteDay'))}</span><input class="input" id="evNote" maxlength="300" value="${esc(entry.note)}" placeholder="${esc(t('noteDayPh'))}" aria-describedby="evNoteHint"><small class="hint" id="evNoteHint">${esc(t('noteDayHint'))}</small></label>
      <div class="form-foot">
        ${idx < tr.athleteIds.length - 1 ? `<button type="button" class="btn" data-action="ev-next">${esc(t('nextAthlete'))}${ic('right')}</button>` : ''}
        <button type="button" class="btn primary" data-action="ev-save" ${dirty ? '' : 'disabled'}>${esc(dirty > 1 ? t('saveEvalN', { n: dirty }) : t('saveEval'))}</button>
      </div>
      <p class="form-msg" id="evMsg" role="status"></p>
    </section>
  </div>`;
}

// ---------- corsisti (staff) ----------
function pageAthletes() {
  if (!S.user) return signInFirst();
  if (!D.isStaff()) return `<div class="empty">${esc(t('staffOnly'))}</div>`;
  const all = S.athletes;
  const year = new Date().getFullYear();
  const st = a => certStatus(a.certExpiry).state;
  const bad7 = all.filter(a => a.active !== false && ['expired', 'd7'].includes(st(a))).length;
  const bad30 = all.filter(a => a.active !== false && st(a) === 'd30').length;
  const filters = {
    all: a => a.active !== false,
    cert: a => a.active !== false && st(a) !== 'ok',
    fitp: a => a.active !== false && !(a.fitpPaid && a.fitpYear === year),
    inactive: a => a.active === false
  };
  const tab = ui.athTab || 'all';
  const q = (ui.aq || '').trim().toLowerCase();
  const list = all.filter(filters[tab]).filter(a => !q || [fullName(a), a.parent, a.phone, a.email].join(' ').toLowerCase().includes(q));
  const count = k => all.filter(filters[k]).length;
  const nAct = count('all');
  return `
  <div class="title-row">
    <div><h1>${esc(t('athletesTitle'))}</h1><p class="sub num">${S.athletesReady ? esc(nAct === 1 ? '1 ' + t('navAthletes').toLowerCase() : t('athletesCount', { n: nAct })) : '<span class="skeleton"></span>'}</p></div>
    <a class="btn primary" href="#/athlete/new">${ic('plus')}${esc(t('newAthlete'))}</a>
  </div>
  ${S.athletesReady && (bad7 || bad30) ? `<p class="notice${bad7 ? ' strong' : ''}">${esc(t('certAlert', { n7: bad7, n30: bad30 }))} <button class="link" data-action="ath-tab" data-tab="cert">${esc(t('tabCert'))}</button></p>` : ''}
  <div class="tabs" role="tablist">${['all', 'cert', 'fitp', 'inactive'].map(k => `<button role="tab" data-action="ath-tab" data-tab="${k}" aria-selected="${tab === k}">${esc(t({ all: 'tabAll', cert: 'tabCert', fitp: 'tabFitp', inactive: 'tabInactive' }[k]))}<span class="n num">${S.athletesReady ? count(k) : ''}</span></button>`).join('')}</div>
  <div class="toolbar">
    <label class="search">${ic('search')}<span class="sr">${esc(t('search'))}</span><input class="input" id="aq" type="search" placeholder="${esc(t('search'))}" value="${esc(ui.aq || '')}" autocomplete="off"></label>
    <span class="meta num">${esc(list.length === 1 ? t('athletesCount1') : t('athletesCount', { n: list.length }))}</span>
  </div>
  ${!S.athletesReady ? `<div class="empty">${esc(t('loading'))}</div>` : list.length ? `<div class="table-wrap"><table class="stack athletes">
    <thead><tr><th>${esc(t('name'))}</th><th>${esc(t('cert'))}</th><th>${esc(t('fitp'))}</th><th>${esc(t('parent'))}</th><th><span class="sr">${esc(t('open'))}</span></th></tr></thead>
    <tbody>${list.map(a => `<tr>
      <td class="main"><div class="name-cell"><span class="initial">${esc(initials(a))}</span><span><b>${esc(fullName(a))}</b><span class="sub num">${a.birth ? esc(t('yearsOld', { n: age(a.birth) })) : '—'}${a.certType ? ' · ' + esc(a.certType === 'agonistico' ? t('certAgon') : t('certNonAgon')) : ''}</span></span></div></td>
      <td class="extra">${certPill(a)}</td>
      <td class="extra">${fitpPill(a)}</td>
      <td class="extra">${esc(a.parent || '—')}${a.phone ? `<span class="sub num">${esc(a.phone)}</span>` : ''}</td>
      <td class="act"><a class="link" href="#/athlete/${encodeURIComponent(a.id)}">${esc(t('open'))}</a></td>
    </tr>`).join('')}</tbody></table></div>` : `<div class="empty">${esc(t('noAthletes'))}</div>`}`;
}

function pageAthlete() {
  if (!S.user) return signInFirst();
  if (!D.isStaff()) return `<div class="empty">${esc(t('staffOnly'))}</div>`;
  const id = routeId();
  const isNew = id === 'new';
  if (!isNew && !S.athletesReady) return `<div class="empty">${esc(t('loading'))}</div>`;
  const a = isNew ? { first: '', last: '', birth: '', phone: '', email: '', parent: '', notes: '', certType: '', certExpiry: '', fitpPaid: false, fitpYear: 0, active: true } : athleteById(id);
  if (!a) return `<div class="empty"><p>${esc(t('athleteNotFound'))}</p><a class="btn" href="#/athletes">${esc(t('athletesTitle'))}</a></div>`;
  if (!isNew && ui.evAthlete !== id) { ui.evAthlete = id; ui.athEvals = null; D.listenEvals({ athleteId: id }, list => { ui.athEvals = list; }); }
  const year = new Date().getFullYear();
  const certType = ui.certTypeFor === id ? ui.certType : (ui.certTypeFor = id, ui.certType = a.certType || '');
  const evals = (ui.athEvals || []).slice().sort((x, y) => y.date.localeCompare(x.date));
  const av = averages(evals);
  const evalBlock = isNew ? '' : `
    <section class="set-row">
      <div><h2>${esc(t('evalsTitle'))}</h2><p class="help">${esc(t('evalsHelp'))}</p></div>
      <div class="set-panel">
        ${ui.athEvals === null ? esc(t('loading')) : !evals.length ? `<p class="meta">${esc(t('noEvals'))}</p>` : `
        <div class="avg-list">${EVAL_AREAS.map(k => {
          const x = av[k];
          const w = x.avg == null ? 0 : x.avg * 10;
          return `<div class="avg-row"><span class="avg-name">${esc(t('area_' + k))}</span>
            <span class="bar" aria-hidden="true"><i class="${x.avg != null && x.avg < PASS ? 'low' : ''}" style="width:${w}%"></i><em style="left:${PASS * 10}%"></em></span>
            <span class="avg-val num">${x.avg == null ? '<span class="meta">—</span>' : x.avg.toFixed(1).replace('.', getLang() === 'it' ? ',' : '.')}</span>
            <span class="meta num avg-n">${x.n ? esc(x.n === 1 ? t('avgOn1') : t('avgOn', { n: x.n })) : ''}</span></div>`;
        }).join('')}</div>
        <h3 class="sub-h">${esc(t('lastEvals'))}</h3>
        <div class="rows">${evals.slice(0, 6).map(e => `<div class="row ev-hist"><span><b>${esc(fmtShort(dateOf(e.date)))}</b> · ${esc(e.title)}</span><span class="meta">${esc(e.note || '')}</span>
          <span class="num ev-mini">${EVAL_AREAS.filter(k => e.scores && e.scores[k]).map(k => `<span class="${e.scores[k] < PASS ? 'low' : ''}" >${esc(t('area_' + k))} ${e.scores[k]}</span>`).join('')}</span></div>`).join('')}</div>`}
      </div>
    </section>`;
  return `
  <div class="title-row">
    <div><a class="back" href="#/athletes">${ic('back')}${esc(t('athletesTitle'))}</a><h1>${esc(isNew ? t('newAthlete') : fullName(a))}</h1>
      ${isNew ? '' : `<p class="sub">${certPill(a)} ${fitpPill(a)}</p>`}</div>
  </div>
  <form class="settings" id="athForm" novalidate>
    <section class="set-row">
      <div><h2>${esc(t('athleteData'))}</h2><p class="help">${esc(t('athleteDataHelp'))}</p></div>
      <div class="set-panel fields">
        <div class="fields two">
          <label class="field"><span>${esc(t('firstName'))}</span><input class="input" name="first" value="${esc(a.first)}" required maxlength="40"></label>
          <label class="field"><span>${esc(t('lastName'))}</span><input class="input" name="last" value="${esc(a.last)}" maxlength="40"></label>
        </div>
        <div class="fields two">
          <label class="field"><span>${esc(t('birth'))}</span><input class="input num" type="date" name="birth" value="${esc(a.birth)}"></label>
          <label class="field"><span>${esc(t('parent'))}</span><input class="input" name="parent" value="${esc(a.parent)}" maxlength="80"></label>
        </div>
        <div class="fields two">
          <label class="field"><span>${esc(t('phone'))}</span><input class="input" type="tel" name="phone" value="${esc(a.phone)}" maxlength="30"></label>
          <label class="field"><span>${esc(t('email'))}</span><input class="input" type="email" name="email" value="${esc(a.email)}" maxlength="120"></label>
        </div>
        <label class="field check"><input class="switch" type="checkbox" name="active" ${a.active !== false ? 'checked' : ''}><span>${esc(t('athleteActive'))}</span></label>
      </div>
    </section>
    <section class="set-row">
      <div><h2>${esc(t('cert'))}</h2><p class="help">${esc(t('certHelp'))}</p></div>
      <div class="set-panel fields">
        <div class="field"><span>${esc(t('certType'))}</span><div class="segmented" role="group" aria-label="${esc(t('certType'))}">
          ${[['agonistico', 'certAgon'], ['non agonistico', 'certNonAgon'], ['', 'certNone']].map(([v, k]) => `<button type="button" data-action="cert-type" data-v="${esc(v)}" aria-pressed="${certType === v}">${esc(t(k))}</button>`).join('')}</div></div>
        <label class="field"><span>${esc(t('certExpiry'))}</span><input class="input num" type="date" name="certExpiry" value="${esc(a.certExpiry)}"></label>
      </div>
    </section>
    <section class="set-row">
      <div><h2>${esc(t('fitp'))}</h2><p class="help">${esc(t('fitpHelp'))}</p></div>
      <div class="set-panel"><label class="field check"><input class="switch" type="checkbox" name="fitpPaid" ${a.fitpPaid && a.fitpYear === year ? 'checked' : ''}><span>${esc(t('fitpToggle', { y: year }))}</span></label></div>
    </section>
    <section class="set-row">
      <div><h2>${esc(t('athleteNotes'))}</h2><p class="help">${esc(t('athleteNotesHelp'))}</p></div>
      <div class="set-panel"><textarea class="input area" name="notes" maxlength="500" rows="3">${esc(a.notes)}</textarea></div>
    </section>
    <p class="form-msg" id="athMsg" role="status"></p>
    <div class="form-foot">
      ${isNew ? '' : `<button type="button" class="btn danger left" data-action="ath-delete">${esc(t('deleteAthlete'))}</button>`}
      <a class="btn" href="#/athletes">${esc(t('cancel'))}</a><button class="btn primary" type="submit">${esc(t('save'))}</button>
    </div>
  </form>
  <div class="settings">${evalBlock}</div>`;
}

// ---------- disegno ----------
function render() {
  // la pagina si ridisegna a ogni cambio di dati: si conservano focus, testo e scorrimento
  const a = document.activeElement;
  const keep = a && a.id && root.contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  const frame = document.getElementById('boardFrame');
  const scroll = frame ? [frame.scrollLeft, frame.scrollTop] : null;
  const r = route();
  const pages = { mine: pageMine, users: pageUsers, courts: pageCourts, account: pageAccount, trainings: pageTrainings, training: pageTraining, athletes: pageAthletes, athlete: pageAthlete };
  const page = (pages[r] || pageBook)();
  root.innerHTML = shell(page);
  document.title = t(PAGE_TITLE[r]) + ' · Quattro Mori Tennis Team';
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.focus(); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (e) { /* ignore */ } }
  }
  const f2 = document.getElementById('boardFrame');
  if (f2 && scroll) { f2.scrollLeft = scroll[0]; f2.scrollTop = scroll[1]; }
  else if (f2 && !scrolledOnce && S.slotsReady) { scrolledOnce = true; scrollToNow(f2); }
}
let scrolledOnce = false;
function scrollToNow(frame) {
  if (S.date !== isoDate()) return;
  const line = frame.querySelector('.now-line');
  if (line) frame.scrollTop = Math.max(0, line.offsetTop - 120);
}

// ---------- finestre ----------
const dlg = document.getElementById('dlg');
function openDialog(html, onSubmit) {
  dlg.innerHTML = html;
  dlg.showModal();
  const form = dlg.querySelector('form');
  if (form && onSubmit) form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
    try { await onSubmit(new FormData(form), form); }
    catch (err) { console.warn(err); const m = form.querySelector('.form-msg'); if (m) m.textContent = errText(err); }
    finally { if (btn) btn.disabled = false; }
  });
}
const closeDialog = () => { if (dlg.open) dlg.close(); };
dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(); });

let toastTimer = 0;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// prenotare una mezz'ora libera
function pick(courtId, time) {
  const court = courtById(courtId);
  if (!court) return;
  const when = `${court.name} · ${fmtShort(dateOf(S.date))} · ${time}`;
  if (!S.user) {
    openDialog(`<div class="dlg"><div><h2>${esc(when)}</h2><p class="lead">${esc(t('loginToBook'))}</p></div>
      <div class="foot"><button class="btn" data-action="close">${esc(t('cancel'))}</button><a class="btn primary" href="#/account" data-action="close">${ic('login')}${esc(t('loginBtn'))}</a></div></div>`);
    return;
  }
  const taken = dayData([court]).takenBy[court.id] || new Set();
  const durs = durationsAt(court, time, taken);
  const staff = D.isStaff();
  let dur = durs.includes(90) ? 90 : durs[0];
  const others = S.users.filter(u => u.id !== S.user.uid);
  openDialog(`<form class="dlg" id="bookForm">
    <div><h2>${esc(when)}</h2><p class="lead num" id="bkRange">${time}–${endOf(time, dur)}</p></div>
    <div class="field"><span>${esc(t('duration'))}</span>
      <div class="segmented" role="group" aria-label="${esc(t('duration'))}">
        ${[60, 90, 120].map(d => `<button type="button" data-dur="${d}" aria-pressed="${d === dur}" ${durs.includes(d) ? '' : 'disabled'}>${esc(durLabel(d))}</button>`).join('')}
      </div></div>
    ${staff ? `<div class="field"><span>${esc(t('forWhom'))}</span>
      <div class="segmented" role="group" aria-label="${esc(t('forWhom'))}">
        <button type="button" data-who="me" aria-pressed="true">${esc(t('me'))}</button>
        <button type="button" data-who="user" aria-pressed="false">${esc(t('registered'))}</button>
        <button type="button" data-who="guest" aria-pressed="false">${esc(t('notRegistered'))}</button>
      </div></div>
      <label class="field" data-show="user" hidden><span>${esc(t('chooseUser'))}</span>
        <select class="input" name="uid"><option value="">—</option>${others.map(u => `<option value="${esc(u.id)}">${esc(fullName(u))}</option>`).join('')}</select></label>
      <label class="field" data-show="guest" hidden><span>${esc(t('guestName'))}</span><input class="input" name="guest" maxlength="80" autocomplete="off"></label>` : ''}
    <p class="form-msg" role="status"></p>
    <div class="foot"><button type="button" class="btn" data-action="close">${esc(t('cancel'))}</button><button class="btn primary" type="submit">${esc(t('confirm'))}</button></div>
  </form>`, async (fd, form) => {
    const who = (form.querySelector('[data-who][aria-pressed="true"]') || {}).dataset?.who || 'me';
    let uid = S.user.uid, name = fullName(S.profile) || S.user.email;
    if (who === 'user') { uid = fd.get('uid'); const u = S.users.find(x => x.id === uid); if (!u) { form.querySelector('.form-msg').textContent = t('chooseUser'); return; } name = fullName(u); }
    if (who === 'guest') { uid = null; name = String(fd.get('guest') || '').trim(); if (!name) { form.querySelector('.form-msg').textContent = t('guestName'); return; } }
    try { await D.book({ court, date: S.date, start: time, dur, uid, name }); }
    catch (e) { form.querySelector('.form-msg').textContent = e.code === 'permission-denied' ? t('bookFailed') : errText(e); return; }
    closeDialog(); toast(t('booked', { court: court.name, time: `${time}–${endOf(time, dur)}` }));
  });
  dlg.querySelectorAll('[data-dur]').forEach(b => b.addEventListener('click', () => {
    dur = +b.dataset.dur;
    dlg.querySelectorAll('[data-dur]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    dlg.querySelector('#bkRange').textContent = `${time}–${endOf(time, dur)}`;
  }));
  dlg.querySelectorAll('[data-who]').forEach(b => b.addEventListener('click', () => {
    dlg.querySelectorAll('[data-who]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    dlg.querySelectorAll('[data-show]').forEach(x => { x.hidden = x.dataset.show !== b.dataset.who; });
  }));
}

function openBooking(id) {
  const bk = S.dayBookings.find(b => b.id === id) || S.myBookings.find(b => b.id === id);
  if (!bk) return;
  const court = courtById(bk.courtId);
  const mine = bk.uid && S.user && bk.uid === S.user.uid;
  const title = mine ? t('yourBooking') : t('bookingOf', { name: bk.name });
  openDialog(`<div class="dlg">
    <div><h2>${esc(title)}</h2>${!bk.uid ? `<p class="lead">${esc(t('notRegisteredTag'))}</p>` : ''}</div>
    <dl class="facts">
      <dt>${esc(t('court'))}</dt><dd>${esc(court ? court.name : '—')}</dd>
      <dt>${esc(t('when'))}</dt><dd>${esc(fmtDay(dateOf(bk.date)))}</dd>
      <dt>${esc(t('time'))}</dt><dd class="num">${bk.start}–${bk.end} · ${esc(durLabel(bk.dur))}</dd>
    </dl>
    <p class="form-msg" role="status"></p>
    <div class="foot"><button class="btn danger left" data-action="do-cancel" data-id="${esc(bk.id)}">${esc(t('cancelBooking'))}</button><button class="btn" data-action="close">${esc(t('close'))}</button></div>
  </div>`);
}

async function doCancel(id, msgEl) {
  const bk = S.dayBookings.find(b => b.id === id) || S.myBookings.find(b => b.id === id);
  if (!bk) return;
  try { await D.cancelBooking(bk); closeDialog(); toast(t('cancelled')); }
  catch (e) { if (msgEl) msgEl.textContent = errText(e); else toast(errText(e)); }
}

function editUser(id) {
  const u = S.users.find(x => x.id === id);
  if (!u) return;
  const admin = D.isAdmin();
  const canEdit = admin || ['utente', 'allenatore'].includes(u.role);
  openDialog(`<form class="dlg">
    <div><h2>${esc(t('editUser'))}</h2><p class="lead">${esc(u.email)}</p></div>
    <div class="fields">
      <div class="fields two">
        <label class="field"><span>${esc(t('firstName'))}</span><input class="input" name="first" value="${esc(u.first)}" required maxlength="40" ${canEdit ? '' : 'disabled'}></label>
        <label class="field"><span>${esc(t('lastName'))}</span><input class="input" name="last" value="${esc(u.last)}" maxlength="40" ${canEdit ? '' : 'disabled'}></label>
      </div>
      <label class="field"><span>${esc(t('phone'))}</span><input class="input" name="phone" type="tel" value="${esc(u.phone)}" maxlength="30" ${canEdit ? '' : 'disabled'}></label>
      <label class="field"><span>${esc(t('roleCol'))}</span>
        <select class="input" name="role" ${admin ? '' : 'disabled aria-describedby="roleHint"'}>${ROLES.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('')}</select>
        ${admin ? '' : `<small class="hint" id="roleHint">${esc(t('roleOnlyAdmin'))}</small>`}</label>
    </div>
    <p class="form-msg" role="status"></p>
    <div class="foot">
      ${canEdit && u.id !== S.user.uid ? `<button type="button" class="btn danger left" data-action="delete-user" data-id="${esc(u.id)}">${esc(t('delete'))}</button>` : ''}
      <button type="button" class="btn" data-action="close">${esc(t('cancel'))}</button>
      ${canEdit ? `<button class="btn primary" type="submit">${esc(t('save'))}</button>` : ''}
    </div>
  </form>`, async fd => {
    const d = { first: String(fd.get('first')).trim(), last: String(fd.get('last')).trim(), phone: String(fd.get('phone')).trim() };
    if (!d.first) return;
    if (admin) d.role = fd.get('role');
    await D.saveUser(u.id, d); closeDialog(); toast(t('saved'));
  });
}

function editCourt(id) {
  const c = id ? courtById(id) : { name: '', type: 'tennis', from: '08:00', to: '23:00', active: true, order: S.courts.length };
  if (!c) return;
  let type = c.type;
  const opts = sel => HOUR_OPTIONS.map(h => `<option ${h === sel ? 'selected' : ''}>${h}</option>`).join('');
  openDialog(`<form class="dlg">
    <h2>${esc(t(id ? 'editCourt' : 'newCourt'))}</h2>
    <div class="fields">
      <label class="field"><span>${esc(t('courtName'))}</span><input class="input" name="name" value="${esc(c.name)}" required maxlength="40" placeholder="Campo 1"></label>
      <div class="field"><span>${esc(t('courtType'))}</span><div class="segmented" role="group" aria-label="${esc(t('courtType'))}">
        ${COURT_TYPES.map(ty => `<button type="button" data-type="${ty}" aria-pressed="${ty === type}">${esc(t(ty))}</button>`).join('')}</div></div>
      <div class="fields two">
        <label class="field"><span>${esc(t('opens'))}</span><select class="input num" name="from">${opts(c.from)}</select></label>
        <label class="field"><span>${esc(t('closesAt'))}</span><select class="input num" name="to">${opts(c.to)}</select></label>
      </div>
      <label class="field" style="grid-template-columns:auto 1fr;align-items:center;gap:12px"><input class="switch" type="checkbox" name="active" ${c.active ? 'checked' : ''}><span>${esc(t('bookable'))}</span></label>
    </div>
    <p class="form-msg" role="status"></p>
    <div class="foot">
      ${id ? `<button type="button" class="btn danger left" data-action="delete-court" data-id="${esc(id)}">${esc(t('delete'))}</button>` : ''}
      <button type="button" class="btn" data-action="close">${esc(t('cancel'))}</button>
      <button class="btn primary" type="submit">${esc(t('save'))}</button>
    </div>
  </form>`, async (fd, form) => {
    const d = { name: String(fd.get('name')).trim(), type, from: fd.get('from'), to: fd.get('to'), active: fd.get('active') === 'on', order: c.order | 0 };
    if (!d.name) return;
    if (toMin(d.to) <= toMin(d.from)) { form.querySelector('.form-msg').textContent = t('hoursError'); return; }
    await D.saveCourt(id, d); closeDialog(); toast(t('saved'));
  });
  dlg.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => {
    type = b.dataset.type;
    dlg.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
}

function editTraining(tr) {
  const cs = coaches();
  openDialog(`<form class="dlg">
    <h2>${esc(t('editTraining'))}</h2>
    <div class="fields">
      <label class="field"><span>${esc(t('trTitle'))}</span><input class="input" name="title" value="${esc(tr.title)}" required maxlength="60"></label>
      <label class="field"><span>${esc(t('coach'))}</span><select class="input" name="coachId">${cs.map(u => `<option value="${esc(u.id)}" ${u.id === tr.coachId ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}${cs.some(u => u.id === tr.coachId) ? '' : `<option value="${esc(tr.coachId)}" selected>${esc(tr.coachName)}</option>`}</select></label>
      <label class="field"><span>${esc(t('notes'))}</span><input class="input" name="notes" value="${esc(tr.notes || '')}" maxlength="500"></label>
    </div>
    <p class="form-msg" role="status"></p>
    <div class="foot"><button type="button" class="btn" data-action="close">${esc(t('cancel'))}</button><button class="btn primary" type="submit">${esc(t('save'))}</button></div>
  </form>`, async fd => {
    const coach = S.users.find(u => u.id === fd.get('coachId'));
    const d = { title: String(fd.get('title')).trim(), notes: String(fd.get('notes')).trim() };
    if (!d.title) return;
    if (coach) { d.coachId = coach.id; d.coachName = fullName(coach); }
    await D.updateTraining(tr.id, d); closeDialog(); toast(t('saved'));
  });
}

function deleteTrainingDlg(tr) {
  const when = `${fmtShort(dateOf(tr.date))} ${tr.start}`;
  const done = n => { closeDialog(); toast(n > 1 ? t('trDeletedN', { n }) : t('trDeleted')); location.hash = '#/trainings'; };
  openDialog(`<div class="dlg"><div><h2>${esc(t('deleteTraining'))}</h2><p class="lead">${esc(t('confirmDeleteTr', { when }))}${tr.series ? ' ' + esc(t('confirmDeleteSeries')) : ''}</p></div>
    <p class="form-msg" role="status"></p>
    <div class="foot"><button class="btn left" data-action="close">${esc(t('cancel'))}</button>
      ${tr.series ? `<button class="btn" data-del="series">${esc(t('thisAndNext'))}</button>` : ''}
      <button class="btn primary" data-del="one">${esc(tr.series ? t('onlyThis') : t('delete'))}</button></div></div>`);
  dlg.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { done(b.dataset.del === 'series' ? await D.deleteSeriesFrom(tr) : (await D.deleteTraining(tr), 1)); }
    catch (err) { dlg.querySelector('.form-msg').textContent = errText(err); b.disabled = false; }
  }));
}

function confirmBox(text, label, run) {
  openDialog(`<div class="dlg"><p>${esc(text)}</p><p class="form-msg" role="status"></p>
    <div class="foot"><button class="btn" data-action="close">${esc(t('cancel'))}</button><button class="btn primary" data-action="confirm-yes">${esc(label)}</button></div></div>`);
  dlg.querySelector('[data-action="confirm-yes"]').addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    try { await run(); closeDialog(); }
    catch (err) { dlg.querySelector('.form-msg').textContent = errText(err); e.currentTarget.disabled = false; }
  });
}

// ---------- azioni ----------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'close') { closeDialog(); if (el.tagName !== 'A') e.preventDefault(); return; }
  if (a === 'menu') { ui.menu = !ui.menu; render(); if (ui.menu) document.querySelector('.sidebar .close')?.focus(); return; }
  if (a === 'lang') { setLang(el.dataset.lang); if (S.user && S.profile) D.saveMyProfile({ lang: getLang() }).catch(() => {}); render(); return; }
  if (a === 'day') { D.setDate(addDays(S.date, +el.dataset.d)); scrolledOnce = false; return; }
  if (a === 'today') { D.setDate(isoDate()); scrolledOnce = false; return; }
  if (a === 'retry') { const d = S.date; D.setDate(addDays(d, 1)); D.setDate(d); return; }
  if (a === 'tab') { ui.tab = el.dataset.tab; render(); return; }
  if (a === 'mine-tab') { ui.mineTab = el.dataset.tab; render(); return; }
  if (a === 'users-tab') { ui.usersTab = el.dataset.tab; render(); return; }
  if (a === 'auth-tab') { ui.authTab = el.dataset.tab; render(); return; }
  if (a === 'pick') { pick(el.dataset.court, el.dataset.time); return; }
  if (a === 'open-booking') { openBooking(el.dataset.id); return; }
  if (a === 'do-cancel') { doCancel(el.dataset.id, dlg.querySelector('.form-msg')); return; }
  if (a === 'cancel-booking') {
    const bk = S.myBookings.find(b => b.id === el.dataset.id); if (!bk) return;
    confirmBox(t('confirmCancel', { when: `${fmtShort(dateOf(bk.date))} ${bk.start}` }), t('cancelBooking'), () => D.cancelBooking(bk).then(() => toast(t('cancelled'))));
    return;
  }
  if (a === 'edit-user') { editUser(el.dataset.id); return; }
  if (a === 'delete-user') {
    const u = S.users.find(x => x.id === el.dataset.id); if (!u) return;
    confirmBox(t('confirmDeleteUser', { name: fullName(u) }), t('deleteUser'), () => D.deleteUser(u.id).then(() => toast(t('userDeleted'))));
    return;
  }
  if (a === 'new-court') { editCourt(null); return; }
  if (a === 'edit-court') { editCourt(el.dataset.id); return; }
  if (a === 'delete-court') {
    const c = courtById(el.dataset.id); if (!c) return;
    confirmBox(t('confirmDeleteCourt', { name: c.name }), t('delete'), () => D.deleteCourt(c.id).then(() => toast(t('courtDeleted'))));
    return;
  }
  // allenamenti
  if (a === 'week') { ui.week = +el.dataset.d === 0 ? weekStart(isoDate()) : addDays(ui.week, +el.dataset.d); render(); return; }
  if (a === 'nt-dur') { ui.nt.dur = +el.dataset.dur; render(); return; }
  if (a === 'tr-remove' && ui.tr) {
    const tr = ui.tr; const ids = tr.athleteIds.filter(x => x !== el.dataset.id);
    const names = Object.fromEntries(ids.map(x => [x, tr.names[x]]));
    D.updateTraining(tr.id, { athleteIds: ids, names }).catch(err => toast(errText(err)));
    return;
  }
  if (a === 'tr-edit' && ui.tr) { editTraining(ui.tr); return; }
  if (a === 'tr-delete' && ui.tr) { deleteTrainingDlg(ui.tr); return; }
  if (a === 'ev-athlete') { ui.draft.cur = el.dataset.id; render(); document.querySelector('.ev-sheet')?.scrollIntoView({ block: 'nearest' }); return; }
  if (a === 'ev-next' && ui.tr) {
    const ids = ui.tr.athleteIds; ui.draft.cur = ids[Math.min(ids.indexOf(ui.draft.cur) + 1, ids.length - 1)]; render();
    document.querySelector('.ev-sheet')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return;
  }
  if (a === 'ev-score') {
    const d = ui.draft; const e = d.data[d.cur] || (d.data[d.cur] = { scores: {}, note: '' });
    const n = +el.dataset.n, k = el.dataset.k;
    if (e.scores[k] === n) delete e.scores[k]; else e.scores[k] = n;   // un secondo tocco toglie il voto
    d.dirty.add(d.cur); render(); return;
  }
  if (a === 'ev-save' && ui.tr) {
    const tr = ui.tr, d = ui.draft;
    const list = [...d.dirty].filter(aid => tr.athleteIds.includes(aid)).map(aid => ({ athleteId: aid, athleteName: tr.names[aid] || '', scores: d.data[aid].scores, note: d.data[aid].note }));
    el.disabled = true;
    try { await D.saveEvals(tr, list); d.dirty.clear(); toast(t('evalSaved')); location.hash = '#/training/' + encodeURIComponent(tr.id); }
    catch (err) { el.disabled = false; const m = document.getElementById('evMsg'); if (m) m.textContent = errText(err); }
    return;
  }
  // corsisti
  if (a === 'ath-tab') { ui.athTab = el.dataset.tab; render(); return; }
  if (a === 'cert-type') { ui.certType = el.dataset.v; document.querySelectorAll('[data-action="cert-type"]').forEach(x => x.setAttribute('aria-pressed', String(x === el))); return; }
  if (a === 'ath-delete') {
    const at = athleteById(routeId()); if (!at) return;
    confirmBox(t('confirmDeleteAthlete', { name: fullName(at) }), t('deleteAthlete'), () => D.deleteAthlete(at.id).then(() => { toast(t('athleteDeleted')); location.hash = '#/athletes'; }));
    return;
  }
  if (a === 'logout') { await D.logout(); location.hash = '#/book'; return; }
  if (a === 'google') {
    const msg = document.getElementById('authMsg');
    try { await D.loginGoogle(); location.hash = '#/book'; } catch (err) { if (msg) msg.textContent = errText(err); }
    return;
  }
  if (a === 'forgot') {
    const form = document.getElementById('authForm'); const msg = document.getElementById('authMsg');
    const email = form.elements.email.value;
    if (!email) { form.elements.email.focus(); return; }
    try { await D.resetPassword(email); msg.className = 'form-msg ok'; msg.textContent = t('resetSent'); }
    catch (err) { msg.className = 'form-msg'; msg.textContent = errText(err); }
  }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'q') { ui.q = el.value; render(); }
  if (el.id === 'aq') { ui.aq = el.value; render(); }
  if (el.id === 'ntq') { ui.nt.q = el.value; render(); }
  if (el.id === 'evNote' && ui.draft) { const d = ui.draft; (d.data[d.cur] || (d.data[d.cur] = { scores: {}, note: '' })).note = el.value; d.dirty.add(d.cur); const b = document.querySelector('[data-action="ev-save"]'); if (b) b.disabled = false; }
  if (el.dataset.nt && el.type !== 'checkbox' && el.tagName === 'INPUT' && el.type !== 'date') ui.nt[el.dataset.nt] = el.value;
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'day' && el.value) { D.setDate(el.value); scrolledOnce = false; }
  if (el.dataset.nt) { ui.nt[el.dataset.nt] = el.type === 'checkbox' ? el.checked : el.value; render(); }
  if (el.dataset.ntAthlete) {
    const ids = ui.nt.athleteIds, id = el.dataset.ntAthlete;
    ui.nt.athleteIds = el.checked ? [...new Set([...ids, id])] : ids.filter(x => x !== id);
    render();
  }
  if (el.id === 'trAdd' && el.value && ui.tr) {
    const at = athleteById(el.value); const tr = ui.tr;
    if (at) D.updateTraining(tr.id, { athleteIds: [...tr.athleteIds, at.id], names: Object.assign({}, tr.names, { [at.id]: fullName(at) }) }).catch(err => toast(errText(err)));
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.menu) { ui.menu = false; render(); } });

document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id === 'authForm') {
    e.preventDefault();
    const msg = document.getElementById('authMsg'); msg.className = 'form-msg'; msg.textContent = '';
    const d = Object.fromEntries(new FormData(f));
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (ui.authTab === 'register') {
        if (!d.first.trim() || !d.last.trim()) { msg.textContent = t('firstName') + ', ' + t('lastName').toLowerCase(); return; }
        await D.register(Object.assign(d, { lang: getLang() }));
      } else await D.login(d.email, d.password);
      location.hash = '#/book';
    } catch (err) { msg.textContent = errText(err); }
    finally { btn.disabled = false; }
  }
  if (f.id === 'trForm') {
    e.preventDefault();
    const nt = ui.nt, msg = document.getElementById('trMsg');
    const coach = S.users.find(u => u.id === nt.coachId);
    if (!nt.title.trim()) { msg.textContent = t('trTitle'); f.elements.title.focus(); return; }
    if (!coach) { msg.textContent = t('chooseCoach'); return; }
    const dates = nt.repeat ? weeklyDates(nt.date, nt.until || nt.date) : [nt.date];
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const names = Object.fromEntries(nt.athleteIds.map(id => [id, fullName(athleteById(id) || {})]));
      const res = await D.createTrainings(dates, { title: nt.title, courtId: nt.courtId, start: nt.start, dur: nt.dur, coachId: coach.id, coachName: fullName(coach), athleteIds: nt.athleteIds, names, notes: nt.notes });
      const n = res.done.length;
      if (res.skipped.length) {
        openDialog(`<div class="dlg"><div><h2>${esc(n === 1 ? t('trCreated1') : t('trCreated', { n }))}</h2><p class="lead">${esc(t('trSkipped', { dates: res.skipped.map(d => fmtShort(dateOf(d))).join(', ') }))}</p></div><div class="foot"><button class="btn primary" data-action="close">OK</button></div></div>`);
      } else toast(n === 1 ? t('trCreated1') : t('trCreated', { n }));
      ui.week = weekStart(nt.date); ui.nt = null;
      location.hash = '#/trainings';
    } catch (err) { msg.textContent = errText(err); }
    finally { btn.disabled = false; }
  }
  if (f.id === 'athForm') {
    e.preventDefault();
    const msg = document.getElementById('athMsg');
    const d = Object.fromEntries(new FormData(f));
    if (!String(d.first || '').trim()) { msg.textContent = t('firstName'); f.elements.first.focus(); return; }
    const id = routeId() === 'new' ? null : routeId();
    const paid = d.fitpPaid === 'on';
    const prev = id ? athleteById(id) : null;
    const year = new Date().getFullYear();
    const data = Object.assign(d, { certType: ui.certType || '', active: d.active === 'on', fitpPaid: paid,
      fitpYear: paid ? year : (prev && prev.fitpYear < year ? prev.fitpYear : 0) });
    try { const nid = await D.saveAthlete(id, data); toast(t('athleteSaved')); if (!id) location.hash = '#/athlete/' + encodeURIComponent(nid); }
    catch (err) { msg.textContent = errText(err); }
  }
  if (f.id === 'profileForm') {
    e.preventDefault();
    const msg = document.getElementById('profileMsg');
    const d = Object.fromEntries(new FormData(f));
    const data = { first: d.first.trim(), last: d.last.trim(), phone: d.phone.trim() };
    if (!data.first) return;
    try { await D.saveMyProfile(data); msg.className = 'form-msg ok'; msg.textContent = t('saved'); }
    catch (err) { msg.className = 'form-msg'; msg.textContent = errText(err); }
  }
});

window.addEventListener('hashchange', () => { ui.menu = false; closeDialog(); render(); window.scrollTo(0, 0); });

// la lingua del profilo vale anche su un nuovo dispositivo
let langSynced = false;
D.onChange(() => {
  if (!langSynced && S.profile && S.profile.lang && S.profile.lang !== getLang()) { langSynced = true; setLang(S.profile.lang); }
  if (S.profile) langSynced = true;
  if (dlg.open) return render();   // la finestra aperta resta com'è
  render();
});
// la linea dell'ora si sposta ogni minuto
setInterval(() => { if (route() === 'book' && S.date === isoDate() && !dlg.open) render(); }, 60000);
render();
