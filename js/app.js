// Interfaccia: routing, viste ed eventi.
(function () {
  'use strict';

  const S = () => Store.state;
  const t = (k, p) => I18n.t(k, p);
  const L = Logic;
  const $app = document.getElementById('app');
  const $dialog = document.getElementById('matchDialog');

  const ui = { flash: null, busy: false };
  // STAFF (admin e segreteria): vedono e gestiscono utenti, prenotazioni di tutti, corsisti, allenamenti, pagamenti.
  const admin = () => !!(window.Cloud && window.Cloud.staff);
  // solo ADMIN (admin generale e Admin): campi e regole di prenotazione, ruoli, listino, avvisi, articoli, messaggi
  const fullAdmin = () => !!(window.Cloud && window.Cloud.isAdmin);
  // SEGRETERIA
  const segr = () => !!(window.Cloud && window.Cloud.seg);
  // cassa (o admin e segreteria): incassi e ricevute
  const cashier = () => !!(window.Cloud && window.Cloud.cashier);
  // avviso della prima pagina: admin
  const canNotice = () => fullAdmin();
  let pendingRender = false;

  // ---------- helper ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sel = (a, b) => (String(a) === String(b) ? 'selected' : '');

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d.slice(0, 10) + 'T12:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString(I18n.locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function commit(msg) {
    Store.save();
    if (msg) ui.flash = typeof msg === 'string' ? { text: msg } : msg;
    render();
  }

  function warn(key, params) {
    ui.flash = { type: 'warn', text: t(key, params) };
    render();
  }

  // Il messaggio resta qualche secondo sulla pagina in cui compare, anche se nel frattempo arrivano
  // aggiornamenti dal database che la ridisegnano; cambiando pagina sparisce.
  function flashHtml() {
    const f = ui.flash;
    if (!f) return '';
    if (!f.shownAt) { f.shownAt = Date.now(); f.hash = location.hash; }
    else if (f.hash !== location.hash || Date.now() - f.shownAt > 5000) { ui.flash = null; return ''; }
    return `<div class="flash ${f.type || 'ok'}" role="status">${esc(f.text)}</div>`;
  }

  // ---------- routing ----------
  function route() {
    return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  }

  function render() {
    pendingRender = false;
    if (!Store.ready) {
      $app.innerHTML = flashHtml() + `<div class="empty"><i class="ti ti-loader-2" aria-hidden="true"></i> ${esc(t('loading'))}</div>`;
      updateChrome('home');
      return;
    }
    const r = route();
    const adminOnly = r[0] === 'messages' || r[0] === 'users' || r[0] === 'courts' || r[0] === 'athletes' || r[0] === 'payments' || r[0] === 'report';
    if (adminOnly && !admin()) { location.hash = '#/'; return; }
    // campi e messaggi: solo l'admin (la segreteria no)
    if ((r[0] === 'courts' || r[0] === 'messages') && !fullAdmin()) { location.hash = '#/'; return; }
    let nav = 'home', html;
    if (r[0] === 'settings') { nav = 'settings'; html = viewSettings(); }
    else if (r[0] === 'me') { nav = 'me'; html = viewProfile(); }
    else if (r[0] === 'wrapped') { nav = 'me'; html = viewWrapped(r[1]); }
    else if (r[0] === 'book') { nav = 'book'; html = viewBook(); }
    else if (r[0] === 'train') { nav = 'train'; html = viewTraining(); }
    else if (r[0] === 'eval') { nav = 'train'; html = viewEval(r[1], r[2]); }
    else if (r[0] === 'privacy' || r[0] === 'cookie' || r[0] === 'termini') { nav = 'settings'; html = viewLegal(r[0]); }
    else if (r[0] === 'athletes' && admin()) { nav = 'train'; html = viewAthletes(r[1] === 'cert'); }
    else if (r[0] === 'payments' && admin()) { nav = 'settings'; html = viewPayments(); }
    else if (r[0] === 'report' && admin()) { nav = 'train'; html = viewReport(); }
    else if (r[0] === 'cassa' && cashier()) { nav = 'cassa'; html = viewCassa(); }
    else if (r[0] === 'courts' && admin()) { nav = 'book'; html = viewCourts(); }
    else if (r[0] === 'messages' && admin()) { nav = 'settings'; html = viewMessages(); }
    else if (r[0] === 'users' && admin()) { nav = 'settings'; html = viewUsers(); }
    else if (r[0] === 'a' && (r[1] === '1' || r[1] === '2')) { html = viewArticle(+r[1] - 1); }
    else { html = viewFeatured(); }
    $app.innerHTML = flashHtml() + html;
    updateChrome(nav);
    fitEditorial();
  }
  function updateChrome(nav) {
    document.documentElement.lang = I18n.lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
    // telefono: la voce attiva sempre visibile nella barra scorrevole
    { const act = document.querySelector('.mainnav a.active'), nb = document.querySelector('.mainnav');
      if (act && nb && nb.scrollWidth > nb.clientWidth) { const l = act.offsetLeft, r = l + act.offsetWidth; if (l < nb.scrollLeft || r > nb.scrollLeft + nb.clientWidth) nb.scrollLeft = l - (nb.clientWidth - act.offsetWidth) / 2; } }
    document.querySelectorAll('.langs [data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === I18n.lang));
    document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = !admin(); });
    document.querySelectorAll('[data-cash-only]').forEach(el => { el.hidden = !cashier(); });
    document.querySelectorAll('[data-staff-badge]').forEach(el => { el.hidden = !(admin() || cashier()); const l = el.querySelector('.lbl'); if (l) l.textContent = ' ' + (fullAdmin() ? 'Admin' : segr() ? t('role_seg') : t('roleCashShort')); });
    document.querySelectorAll('[data-guest-only]').forEach(el => { el.hidden = admin() || !!member(); });
    document.querySelectorAll('[data-member-only]').forEach(el => { el.hidden = !(member() || (admin() && window.Cloud && window.Cloud.adminMember)); });
    document.querySelectorAll('[data-train-only]').forEach(el => { el.hidden = !(admin() || coach() || centerAdm()); });
    // banner dei cookie: finché non si sceglie (o se si riapre dalle "Preferenze cookie")
    const bar = document.getElementById('cookieBar');
    if (bar) bar.hidden = Consent.decided() && !ui.cookieOpen;
  }

  // Banner cookie: Accetta tutti, Rifiuta (solo necessari), Personalizza. "Preferenze cookie" nel piè di pagina lo riapre.
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-consent]');
    if (!b) return;
    e.preventDefault();
    const bar = document.getElementById('cookieBar'), what = b.dataset.consent;
    if (what === 'open') { ui.cookieOpen = true; bar.hidden = false; const c = bar.querySelector('#ckPrefs'); if (c) c.checked = Consent.prefs(); return; }
    if (what === 'custom') { bar.classList.add('custom'); const c = bar.querySelector('#ckPrefs'); if (c) c.checked = Consent.prefs(); return; }
    const prefs = what === 'all' ? true : what === 'none' ? false : !!(bar.querySelector('#ckPrefs') || {}).checked;
    const before = Consent.prefs();
    Consent.set(prefs);
    // con il consenso si salvano le scelte già fatte in questa visita
    if (prefs) { Consent.write('pcm-lang', I18n.lang); if (ui.theme) Consent.write(THEME_KEY, ui.theme); if (ui.design) Consent.write(DESIGN_KEY, ui.design); }
    ui.cookieOpen = false; bar.classList.remove('custom'); bar.hidden = true;
    ui.flash = { text: t(prefs ? 'ckSavedYes' : 'ckSavedNo') + (prefs !== before ? ' ' + t('ckNextOpen') : '') };
    render();
  });

  // Aggiornamento dal database: se l'utente sta scrivendo in un campo, o ha un modulo compilato a metà
  // (modificato negli ultimi 2 minuti e non ancora inviato), si aspetta per non perdere quello che ha scritto.
  function isTyping() {
    const a = document.activeElement;
    if ($dialog.open || (a && a !== document.body && a.matches('input, select, textarea') && $app.contains(a))) return true;
    return [...$app.querySelectorAll('form[data-dirty]')].some(f => Date.now() - Number(f.dataset.dirty) < 120000);
  }
  ['input', 'change'].forEach(ev => document.addEventListener(ev, e => {
    const f = e.target.closest && e.target.closest('form');
    if (f && $app.contains(f) && !e.target.matches('[type=search]')) f.dataset.dirty = Date.now();
  }, true));
  // aggiornamenti rimandati: appena non si sta più compilando nulla
  setInterval(() => { if (pendingRender && !isTyping()) render(); }, 3000);

  function refresh() {
    if (isTyping()) { pendingRender = true; return; }
    render();
  }
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (pendingRender && !isTyping()) render(); }, 400);
  });
  $dialog.addEventListener('close', () => { if (pendingRender) render(); });

  // ---------- avvisi per i visitatori (prima pagina e pagina di ogni torneo) ----------
  function richText(s) {
    return esc(s)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }

  const todayStr = () => new Date().toLocaleDateString('sv');   // AAAA-MM-GG, ora locale

  // scope: 'home' oppure l'id del torneo; until: data di scadenza dell'avviso generale (facoltativa)
  function noticeBox(scope, text, until) {
    const editing = canNotice(scope) && ui.editNotice === scope;
    const expired = scope === 'home' && until && until < todayStr();
    if (editing) {
      return `<form class="card notice-box editing" data-form="notice-save" data-scope="${esc(scope)}">
        <h2><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(t('noticeTitle'))}</h2>
        <textarea name="text" rows="5" maxlength="4000" placeholder="${esc(t('noticePlaceholder'))}">${esc(text || '')}</textarea>
        <p class="muted small">${esc(t('noticeHelp'))}</p>
        ${scope === 'home' ? `<label class="until">${esc(t('noticeUntil'))}<input type="date" name="until" value="${esc(until || '')}">
          <small class="muted">${esc(t('noticeUntilHelp'))}</small></label>` : ''}
        <div class="form-actions">
          <button type="button" class="btn" data-action="notice-cancel">${esc(t('cancel'))}</button>
          ${text ? `<button type="button" class="btn danger" data-action="notice-clear" data-scope="${esc(scope)}">${esc(t('noticeClear'))}</button>` : ''}
          <button class="btn primary">${esc(t('save'))}</button>
        </div>
      </form>`;
    }
    if (!text) {
      return canNotice(scope) ? `<button class="notice-add" data-action="notice-edit" data-scope="${esc(scope)}"><i class="ti ti-speakerphone" aria-hidden="true"></i> ${esc(t('noticeAdd'))}</button>` : '';
    }
    if (expired && !canNotice(scope)) return '';
    return `<div class="notice-box ${expired ? 'expired' : ''}" role="note">
      <div class="notice-head"><h2><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(t('noticeTitle'))}
          ${until ? `<span class="badge">${esc(t(expired ? 'noticeExpired' : 'noticeVisibleUntil', { d: fmtDate(until) }))}</span>` : ''}</h2>
        ${canNotice(scope) ? `<button class="btn small" data-action="notice-edit" data-scope="${esc(scope)}"><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(t('edit'))}</button>` : ''}</div>
      <div class="notice-text">${richText(text)}</div>
    </div>`;
  }

  // Spazi editoriali della prima pagina (due articoli con foto, titolo e testo), modificabili dall'admin.
  const safePhoto = p => (typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) ? p : '');

  function editorialSection() {
    const items = S().editorial || [];
    const cards = [0, 1].map(i => editorialCard(i, items[i])).filter(Boolean);
    return cards.length ? `<section class="editorial" aria-label="${esc(t('edSection'))}">${cards.join('')}</section>` : '';
  }

  // Collegamento finale dell'articolo: una sezione dell'app (o un torneo non ancora finito).
  const ED_LINKS = [['#/', 'navHome'], ['#/book', 'navBook'], ['#/train', 'navTrain'], ['#/me', 'profile'], ['#/wrapped', 'wrTitle']];
  const edLinkOk = to => ED_LINKS.some(([h]) => h === to);
  function edLinkHtml(a, cls) {
    if (!a || !a.linkText || !edLinkOk(a.linkTo)) return '';
    return `<a class="btn ${cls || 'small'} ed-link" href="${esc(a.linkTo)}">${esc(a.linkText)} <i class="ti ti-arrow-right" aria-hidden="true"></i></a>`;
  }
  function editorialForm(i, a) {
    const photo = safePhoto(a.photo);
    return `<form class="card editorial-form" data-form="editorial-save" data-idx="${i}">
        <h2><i class="ti ti-article" aria-hidden="true"></i> ${esc(t('edSlot', { n: i + 1 }))}</h2>
        <label>${esc(t('edPos'))}<select name="pos">${[0, 1].map(k => `<option value="${k}" ${k === i ? 'selected' : ''}>${esc(t('edPos' + (k + 1)))}</option>`).join('')}</select></label>
        <p class="muted small">${esc(t('edPosHelp'))}</p>
        ${photo ? `<img class="ed-preview" src="${photo}" alt="">
        <label class="check"><input type="checkbox" name="removePhoto"> ${esc(t('edRemovePhoto'))}</label>` : ''}
        <label>${esc(t(photo ? 'edPhotoChange' : 'edPhoto'))}<input type="file" name="photo" accept="image/*"></label>
        <p class="muted small">${esc(t('edPhotoHelp'))}</p>
        <label>${esc(t('edTitle'))}<input name="title" maxlength="120" value="${esc(a.title || '')}"></label>
        <label>${esc(t('edText'))}<textarea name="text" rows="8" maxlength="6000">${esc(a.text || '')}</textarea></label>
        <p class="muted small">${esc(t('edTextHelp'))}</p>
        <fieldset class="ed-linkset"><legend>${esc(t('edLinkTitle'))}</legend>
          <label>${esc(t('edLinkText'))}<input name="linkText" maxlength="60" value="${esc(a.linkText || '')}" placeholder="${esc(t('edLinkTextPh'))}"></label>
          <label>${esc(t('edLinkTo'))}<select name="linkTo"><option value="">— ${esc(t('edLinkNone'))} —</option>
            ${ED_LINKS.map(([h, k]) => `<option value="${h}" ${a.linkTo === h ? 'selected' : ''}>${esc(t(k))}</option>`).join('')}
          </select></label>
          <p class="muted small">${esc(t('edLinkHelp'))}</p></fieldset>
        <p class="error" data-ed-err role="alert"></p>
        <div class="form-actions">
          <button type="button" class="btn" data-action="editorial-cancel">${esc(t('cancel'))}</button>
          ${a.title || a.text || photo ? `<button type="button" class="btn danger" data-action="editorial-clear" data-idx="${i}">${esc(t('edClear'))}</button>` : ''}
          <button class="btn primary">${esc(t('save'))}</button>
        </div>
      </form>`;
  }

  const edEmpty = a => !a || (!a.title && !a.text && !safePhoto(a.photo));

  // Scheda a dimensione fissa e identica per i due spazi: il testo che non ci sta finisce con "…"
  // e compare "Visualizza l'articolo" (pagina autonoma #/a/1 o #/a/2).
  function editorialCard(i, a) {
    a = a || {};
    if (fullAdmin() && ui.editEditorial === i) return editorialForm(i, a);
    if (edEmpty(a)) {
      return fullAdmin() ? `<button class="editorial-add" data-action="editorial-edit" data-idx="${i}"><i class="ti ti-article" aria-hidden="true"></i> ${esc(t('edAdd', { n: i + 1 }))}</button>` : '';
    }
    const photo = safePhoto(a.photo);
    return `<article class="card editorial-card">
      <a class="ed-photo ${photo ? '' : 'no-photo'}" href="#/a/${i + 1}" tabindex="-1" aria-hidden="true">${photo ? `<img src="${photo}" alt="" loading="lazy">` : '<i class="ti ti-article"></i>'}</a>
      <div class="ed-body">
        ${a.title ? `<h2><a href="#/a/${i + 1}">${esc(a.title)}</a></h2>` : ''}
        <div class="ed-text">${richText(a.text || '')}</div>
        <div class="ed-foot">
          <a class="ed-more" href="#/a/${i + 1}" hidden>${esc(t('edReadMore'))} →</a>
          ${edLinkHtml(a)}
          ${fullAdmin() ? `<button class="btn small" data-action="editorial-edit" data-idx="${i}"><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(t('edit'))}</button>` : ''}
        </div>
      </div>
    </article>`;
  }

  // Mostra "Visualizza l'articolo" solo dove titolo o testo sono stati tagliati.
  function fitEditorial() {
    document.querySelectorAll('.editorial-card').forEach(card => {
      const cut = [...card.querySelectorAll('.ed-text, .ed-body h2')].some(el => el.scrollHeight > el.clientHeight + 2);
      const more = card.querySelector('.ed-more');
      if (more) more.hidden = !cut;
    });
  }
  window.addEventListener('resize', () => fitEditorial());

  // Pagina autonoma di un articolo.
  function viewArticle(i) {
    const a = (S().editorial || [])[i];
    const back = `<a class="back" href="#/">← ${esc(t('navHome'))}</a>`;
    if (fullAdmin() && ui.editEditorial === i) return `<div class="page-head">${back}</div>${editorialForm(i, a || {})}`;
    if (edEmpty(a)) return `<div class="page-head">${back}</div><div class="empty">${esc(t('edNotFound'))}</div>`;
    const photo = safePhoto(a.photo);
    return `<article class="article-page">
      <div class="page-head">${back}</div>
      ${photo ? `<img class="article-photo" src="${photo}" alt="">` : ''}
      <div class="card article-body">
        ${a.title ? `<h1>${esc(a.title)}</h1>` : ''}
        <div class="article-text">${richText(a.text || '')}</div>
        ${edLinkHtml(a, 'primary')}
        ${fullAdmin() ? `<div class="btn-row"><button class="btn small" data-action="editorial-edit" data-idx="${i}"><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(t('edit'))}</button></div>` : ''}
      </div>
    </article>`;
  }

  // ---------- prima pagina ----------
  // Avvisi, prossime prenotazioni e allenamenti dell'utente, collegamenti rapidi alle sezioni.
  function homeQuickLinks() {
    const links = [['#/book', 'calendar-time', 'navBook'], ['#/train', 'barbell', 'navTrain']];
    if (member() || (admin() && window.Cloud && window.Cloud.adminMember)) links.push(['#/me', 'user', 'profile']);
    if (cashier()) links.push(['#/cassa', 'cash-register', 'navCassa']);
    if (admin()) links.push(['#/users', 'users', 'usersTitle'], ['#/athletes', 'id-badge-2', 'athTitle']);
    if (fullAdmin()) links.push(['#/courts', 'layout-grid', 'courtsManage']);
    links.push(['#/settings', 'settings', 'navSettings']);
    return `<section class="feat-block"><div class="page-head row"><h2><i class="ti ti-bolt" aria-hidden="true"></i> ${esc(t('homeQuick'))}</h2></div>
      <div class="quick-links">${links.map(([h, i, k]) => `<a class="btn" href="${h}"><i class="ti ti-${i}" aria-hidden="true"></i> ${esc(t(k))}</a>`).join('')}</div></section>`;
  }
  function homeNext() {
    const uid = myUid();
    if (!uid || !(member() || admin())) {
      return `<section class="card"><h2><i class="ti ti-calendar-plus" aria-hidden="true"></i> ${esc(t('homeWelcome'))}</h2>
        <p class="muted">${esc(t('homeWelcomeText'))}</p>
        <div class="btn-row"><a class="btn primary" href="#/book">${esc(t('navBook'))} →</a><a class="btn" href="#/settings">${esc(t('loginOrRegister'))}</a></div></section>`;
    }
    const mine = myBookings(uid).slice(0, 5);
    return `<section class="card"><div class="page-head row"><h2><i class="ti ti-calendar-event" aria-hidden="true"></i> ${esc(t('bkMyNext'))}</h2>
        <a class="btn small" href="#/book">${esc(t('navBook'))} →</a></div>
      ${mine.length ? `<ul class="reg-list">${mine.map(bookingItem).join('')}</ul>` : `<p class="muted">${esc(t('bkNoMine'))}</p>`}</section>
      ${member() ? myTrainingCard() : ''}`;
  }

  function viewFeatured() {
    return `
      ${admin() && homonymPending().length ? `<div class="msg-alert" role="alert"><div class="msg-head"><strong><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('homonym'))}</strong></div>
        <div class="msg-text">${esc(t('homonymWarn'))}</div><a class="btn small" href="#/users">${esc(t('usersOpen'))} →</a></div>` : ''}
      ${privacyAlert()}
      ${messageAlerts()}
      ${wrappedAlert()}
      ${trainingAlerts()}
      ${certAlerts()}
      ${bkReminderAlerts()}
      ${bookingAlerts()}
      ${verifyNotice()}
      ${noticeBox('home', S().notice, S().noticeUntil)}
      <div class="theme-hero" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <h1 class="sr-only">${esc(t('navHome'))}</h1>
      ${homeNext()}
      ${editorialSection()}
      ${spotSection(true)}
      ${homeQuickLinks()}`;
  }
  // Foto ridimensionata nel browser (max 1200 px, JPEG) perché stia comodamente nel database.
  async function shrinkPhoto(file, maxW = 1200, maxLen = 600000) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
      let w = Math.min(maxW, img.naturalWidth), q = .82, out = '';
      for (let k = 0; k < 8; k++) {
        const c = document.createElement('canvas');
        c.width = w; c.height = Math.round(img.naturalHeight * w / img.naturalWidth);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length < maxLen) return out;
        if (q > .55) q -= .1; else w = Math.round(w * .8);
      }
      throw new Error('too-big');
    } finally { URL.revokeObjectURL(url); }
  }

  async function saveEditorialForm(f) {
    const i = +f.dataset.idx, cur = (S().editorial || [])[i] || {};
    const err = f.querySelector('[data-ed-err]');
    let photo = safePhoto(cur.photo);
    if (f.removePhoto && f.removePhoto.checked) photo = '';
    const file = f.photo.files && f.photo.files[0];
    if (file) {
      err.textContent = t('edPhotoWorking');
      try { photo = await shrinkPhoto(file); } catch (e) { err.textContent = t('errPhoto'); return; }
    }
    const data = { title: f.title.value.trim(), text: f.text.value.trim(), photo };
    const lt = f.linkText.value.trim(), lto = f.linkTo.value;
    if (lt && !lto) { err.textContent = t('edLinkNeedTo'); return; }
    if (lto && !lt) { err.textContent = t('edLinkNeedText'); return; }
    if (lt && edLinkOk(lto)) Object.assign(data, { linkText: lt.slice(0, 60), linkTo: lto });
    const empty = !data.title && !data.text && !data.photo;
    S().editorial = (S().editorial || [null, null]).slice();
    const to = f.pos ? +f.pos.value : i;
    ui.editEditorial = null;
    if (to !== i && (to === 0 || to === 1)) {
      // nuova posizione: l'altro articolo prende il posto lasciato libero
      const other = S().editorial[to] || null, clean = x => (edEmpty(x) ? null : Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'updated')));
      S().editorial[to] = empty ? null : data; S().editorial[i] = other;
      if (window.Cloud && window.Cloud.saveEditorial) Promise.all([window.Cloud.saveEditorial(to, empty ? null : data), window.Cloud.saveEditorial(i, clean(other))]).catch(e => App.error(e.code || e.message));
      if (location.hash === '#/a/' + (i + 1)) location.hash = '#/a/' + (to + 1);
    } else {
      S().editorial[i] = empty ? null : data;
      if (window.Cloud && window.Cloud.saveEditorial) window.Cloud.saveEditorial(i, empty ? null : data).catch(e => App.error(e.code || e.message));
    }
    ui.flash = { text: t('saved') };
    render();
  }

  // ====================================================================
  // UTENTI REGISTRATI, REWARD, MESSAGGI
  // ====================================================================
  const member = () => (window.Cloud && !window.Cloud.isAdmin && window.Cloud.member) || null;
  const personName = p => `${p.last} ${p.first}`;
  // Nome mostrato agli altri: alias dell'admin se l'utente ne ha uno.
  const personLabel = p => (p && p.uid && (S().nicks || {})[p.uid])
    || personName((p && p.uid && (S().members || []).find(m => m.uid === p.uid)) || p);

  // ---------- reward delle prenotazioni (stelline, stelle comete, Terra, pianeti, galassia) ----------
  const REWARDS = [['star', '⭐'], ['comet', '☄️'], ['earth', '🌍'], ['planets', '🪐'], ['galaxy', '🌌']];
  // ---------- omonimi (utenti registrati con stesso nome, cognome e sesso) ----------
  const nameKeyOf = p => `${p.gender}|${L.nameKey(p.last, p.first)}`;
  function homonymGroups() {
    const g = {};
    (S().members || []).forEach(m => { (g[nameKeyOf(m)] = g[nameKeyOf(m)] || []).push(m); });
    return Object.values(g).filter(list => list.length > 1);
  }
  // Gruppi di omonimi ancora da distinguere con un alias (due o più persone mostrate con lo stesso nome).
  const homonymPending = () => homonymGroups().filter(list => new Set(list.map(m => personLabel(m).toLowerCase())).size < list.length);

  // ---------- utenti registrati (solo admin): email, alias, giocatore collegato ----------
  // Stato della conferma: email confermata dall'utente, confermato a mano dall'admin, oppure da confermare.
  function verifyBadge(uid) {
    if ((S().emailVerified || {})[uid]) return `<span class="badge st-done"><i class="ti ti-mail-check" aria-hidden="true"></i> ${esc(t('verEmail'))}</span>`;
    if ((S().manualVerified || {})[uid]) return `<span class="badge st-done"><i class="ti ti-user-check" aria-hidden="true"></i> ${esc(t('verManual'))}</span>
      <button class="btn small" data-action="ver-manual" data-uid="${uid}" data-on="0">${esc(t('verUndo'))}</button>`;
    return `<span class="badge warn-b">${esc(t('verPending'))}</span>
      <button class="btn small primary" data-action="ver-manual" data-uid="${uid}" data-on="1"><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('verConfirm'))}</button>`;
  }

  // Riepilogo dei ruoli: admin generale (il titolare), Admin, segreteria, cassa, allenatori.
  function rolesCard() {
    const byRole = r => (S().members || []).filter(m => roleOf(m.uid) === r).map(personName).sort();
    const general = [...new Set(((window.Cloud && window.Cloud.generalUids) || []).concat(window.Cloud && window.Cloud.general && myUid() ? [myUid()] : [], (S().members || []).filter(m => roleOf(m.uid) === 'general').map(m => m.uid)))].map(u => (uidName(u) === '?' ? 'Admin' : uidName(u)));
    const row = (r, names) => `<li><span class="reg-names">${roleBadge(r)}<br><small class="muted">${esc(t('roleHelp_' + r))}</small><br>${names.length ? names.map(n => `<span class="badge">${esc(n)}</span>`).join(' ') : `<small class="muted">—</small>`}</span></li>`;
    return `<details class="card sub-form" id="roles" data-keep="roles" ${keepOpen('roles')}><summary><i class="ti ti-key" aria-hidden="true"></i> ${esc(t('rolesTitle'))}</summary>
      <p class="muted small">${esc(t('rolesHelp'))}</p>
      <ul class="reg-list roles-list">
        ${row('general', general)}
        ${['admin', 'seg', 'cash', 'coach'].map(r => row(r, byRole(r))).join('')}
      </ul></details>`;
  }
  // Modulo "Crea utente" (admin e segreteria): nome, cognome, sesso, email, password iniziale e ruolo.
  function userCreateCard() {
    const rs = grantable();
    return `<details class="card sub-form user-create" data-keep="user-create" ${keepOpen('user-create')}><summary><i class="ti ti-user-plus" aria-hidden="true"></i> ${esc(t('userCreateTitle'))}</summary>
        <p class="muted small">${esc(t('userCreateHelp'))}</p>
        <form class="grid-form" data-form="user-create">
          <label>${esc(t('firstName'))}<input name="first" required maxlength="60" autocomplete="off"></label>
          <label>${esc(t('lastName'))}<input name="last" required maxlength="60" autocomplete="off"></label>
          <label>${esc(t('gender'))}<select name="gender" required><option value="">—</option><option value="M">${esc(t('male'))}</option><option value="F">${esc(t('female'))}</option></select></label>
          <label>Email<input name="email" type="email" required autocomplete="off" autocapitalize="off" spellcheck="false"></label>
          <label>${esc(t('userCreatePwd'))}<input name="password" type="text" required minlength="6" autocomplete="off"><small class="muted">${esc(t('userCreatePwdHelp'))}</small></label>
          <label>${esc(t('userRole'))}<select name="role" required>${rs.map(r => `<option value="${r}">${esc(t('role_' + r))}</option>`).join('')}</select>
            <small class="muted">${esc(t(fullAdmin() ? 'userRoleHelpAdmin' : 'userRoleHelpSeg'))}</small></label>
          <div class="form-actions span-all"><button class="btn primary"><i class="ti ti-user-plus" aria-hidden="true"></i> ${esc(t('userCreateBtn'))}</button></div>
        </form></details>`;
  }
  // Ruolo nella scheda dell'utente: badge per tutti; menu per cambiarlo solo all'admin.
  function userRoleRow(m) {
    const r = roleOf(m.uid), rs = grantable();
    const can = fullAdmin() && r !== 'general' && m.uid !== myUid() && rs.includes(r);
    if (!can) return `<span class="ban-row"><i class="ti ti-key" aria-hidden="true"></i> ${esc(t('userRole'))}: ${roleBadge(r)}</span>`;
    return `<label class="ban-row role-pick"><span><i class="ti ti-key" aria-hidden="true"></i> ${esc(t('userRole'))}</span>
      <select data-change="user-role" data-uid="${m.uid}" aria-label="${esc(t('userRole'))}">${rs.map(x => `<option value="${x}" ${x === r ? 'selected' : ''}>${esc(t('role_' + x))}</option>`).join('')}</select></label>`;
  }
  function viewUsers() {
    const f = L.norm(ui.userFilter || '');
    const acc = S().accounts || {};
    const pend = new Set(homonymPending().flat().map(m => m.uid));
    const homs = new Set(homonymGroups().flat().map(m => m.uid));
    const rf = ui.userRole || 'all';
    const list = (S().members || []).filter(m => !f || L.norm(`${m.first} ${m.last} ${acc[m.uid] || ''} ${(S().nicks || {})[m.uid] || ''}`).includes(f))
      .filter(m => rf === 'all' || roleOf(m.uid) === rf || (rf === 'admin' && roleOf(m.uid) === 'general'))
      .sort((a, b) => personName(a).localeCompare(personName(b)));
    // iscritti senza conferma (né email né a mano): avviso in cima alla lista
    const confirmedUid = uid => !!((S().emailVerified || {})[uid] || (S().manualVerified || {})[uid]);
    const unconf = (S().members || []).filter(m => !confirmedUid(m.uid)).sort((a, b) => personName(a).localeCompare(personName(b)));
    const count = r => (S().members || []).filter(m => roleOf(m.uid) === r || (r === 'admin' && roleOf(m.uid) === 'general')).length;
    const roleTabs = `<nav class="tabs user-tabs" aria-label="${esc(t('userRole'))}">${['all', 'user', 'coach', 'seg', 'cash', 'admin'].map(k =>
      `<a href="#/users" class="${rf === k ? 'active' : ''}" data-action="user-role-tab" data-r="${k}">${esc(t(k === 'all' ? 'usersAll' : 'role_' + k))} <small>${k === 'all' ? (S().members || []).length : count(k)}</small></a>`).join('')}</nav>`;
    return `
      <div class="page-head"><a class="back" href="#/settings">← ${esc(t('settings'))}</a><h1><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('usersTitle'))} (${(S().members || []).length})</h1>
        <p class="muted">${esc(t('usersIntro'))}</p></div>
      ${pend.size ? `<p class="note warn"><i class="ti ti-alert-triangle" aria-hidden="true"></i> ${esc(t('homonymWarn'))}</p>` : ''}
      ${userCreateCard()}
      ${rolesCard()}
      ${unconf.length ? `<div class="msg-alert" role="alert"><div class="msg-head"><strong><i class="ti ti-mail-exclamation" aria-hidden="true"></i> ${esc(t('usersUnconfTitle', { n: unconf.length }))}</strong></div>
        <div class="msg-text">${esc(t('usersUnconfHelp'))}</div>
        <ul class="reg-list">${unconf.map(m => `<li><span class="reg-names"><strong>${esc(personName(m))}</strong> <small class="muted">${esc(acc[m.uid] || '')}</small></span>
          <button class="btn small primary" data-action="ver-manual" data-uid="${m.uid}" data-on="1"><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('verConfirm'))}</button></li>`).join('')}</ul></div>` : ''}
      ${roleTabs}
      <div class="toolbar"><input type="search" class="search" placeholder="${esc(t('search'))}" value="${esc(ui.userFilter || '')}" data-change="user-filter" aria-label="${esc(t('search'))}"></div>
      ${f ? `<p class="note warn filter-note"><i class="ti ti-filter" aria-hidden="true"></i> ${esc(t('usersFiltered', { q: ui.userFilter, n: list.length, tot: (S().members || []).length }))}
        <button class="btn small" data-action="user-filter-clear"><i class="ti ti-x" aria-hidden="true"></i> ${esc(t('usersShowAll'))}</button></p>` : ''}
      <div class="card"><ul class="reg-list users-list">${list.map(m => {
        const edit = canEditUser(m.uid);
        return `<li class="${pend.has(m.uid) ? 'homonym' : ''} ${banOf(m.uid).book ? 'banned' : ''}">
          <details class="user-item" data-keep="usr-${m.uid}" ${keepOpen('usr-' + m.uid)}>
          <summary><strong>${esc(personName(m))}</strong> ${roleBadge(roleOf(m.uid))}
            ${(S().nicks || {})[m.uid] ? `<small class="muted">(${esc(S().nicks[m.uid])})</small>` : ''}
            ${homs.has(m.uid) ? `<span class="badge warn-b">${esc(t('homonym'))}</span>` : ''}
            ${confirmedUid(m.uid) ? '' : `<span class="badge warn-b">${esc(t('verPending'))}</span>`}
            ${banOf(m.uid).book ? `<span class="badge st-full">${esc(t('banTitle'))}</span>` : ''}</summary>
          <span class="reg-names">
            <small class="muted">${esc(acc[m.uid] || '—')}</small>
            ${acc[m.uid] && edit ? `<button class="btn small" data-action="user-reset" data-uid="${m.uid}"><i class="ti ti-key" aria-hidden="true"></i> ${esc(t('userResetBtn'))}</button>` : ''}
            ${canDeleteUser(m.uid) ? `<button class="btn small danger" data-action="user-delete" data-uid="${m.uid}"><i class="ti ti-user-x" aria-hidden="true"></i> ${esc(t('userDelete'))}</button>` : ''}
            ${userRoleRow(m)}
            <span class="ban-row">${verifyBadge(m.uid)} ${m.privacyAt ? `<span class="badge st-done" title="${esc(t('privacyAcceptedOn', { d: fmtDate(new Date(m.privacyAt).toLocaleDateString('sv')) }))}"><i class="ti ti-shield-check" aria-hidden="true"></i> ${esc(t('privacyOkBadge'))}</span>` : `<span class="badge tess-no">${esc(t('privacyNoBadge'))}</span>`}${m.deleteReq ? ` <span class="badge st-full">${esc(t('deleteRequested', { d: fmtDate(new Date(m.deleteReq).toLocaleDateString('sv')) }))}</span>` : ''}</span>
            ${edit ? `<span class="ban-row"><i class="ti ti-ban" aria-hidden="true"></i> ${esc(t('banTitle'))}:
              <label class="check"><input type="checkbox" data-change="ban" data-uid="${m.uid}" data-what="book" ${banOf(m.uid).book ? 'checked' : ''}> ${esc(t('banBook'))}</label></span>` : ''}</span>
          ${edit ? `<details class="sub-form" data-keep="ren-${m.uid}" ${keepOpen('ren-' + m.uid)}><summary><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(t('userRename'))}</summary>
            <form class="grid-form" data-form="member-rename" data-uid="${m.uid}">
              <label>${esc(t('firstName'))}<input name="first" required maxlength="60" value="${esc(m.first)}"></label>
              <label>${esc(t('lastName'))}<input name="last" required maxlength="60" value="${esc(m.last)}"></label>
              <div class="form-actions"><button class="btn small primary">${esc(t('save'))}</button></div>
            </form></details>` : ''}
          ${fullAdmin() ? `<form class="nick-form" data-form="nick-save" data-uid="${m.uid}">
            <input name="nick" maxlength="40" value="${esc((S().nicks || {})[m.uid] || '')}" placeholder="${esc(t('nickPh'))}" aria-label="${esc(t('nick'))}">
            <button class="btn small">${esc(t('save'))}</button>
          </form>` : ''}
          </details>
        </li>`; }).join('') || `<li class="muted">${esc(t('noMembers'))}</li>`}</ul></div>`;
  }

  // ====================================================================
  // PRENOTAZIONE DEI CAMPI, CONFERMA EMAIL, LISTA NERA
  // ====================================================================
  // Slot di mezz'ora: verde libero, rosso occupato, giallo selezione. Si prenota per multipli di 30 minuti.
  // di serie: da 1 ora a 2 ore (1 h, 1 h 30, 2 h), a mezz'ore
  const BOOK_DEFAULTS = { minHours: 1, maxHours: 2, maxPerDay: 1, daysAhead: 7 };
  const bookCfg = () => Object.assign({}, BOOK_DEFAULTS, S().booking || {});
  // Durata minima di una prenotazione in minuti (l'admin non ha limiti).
  const minBook = () => (admin() ? 30 : Math.max(30, Math.round(Number(bookCfg().minHours) * 60) || 30));
  const hoursText = h => durText('00:00', fromMin(Math.round(Number(h) * 60) || 30));
  const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const fromMin = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const addMin = (hm, n) => fromMin(toMin(hm) + n);
  const addDays = (d, n) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv'); };
  const dow = d => { const x = new Date(d + 'T12:00').getDay(); return x === 0 ? 7 : x; };
  const nowHM = () => { const d = new Date(); return fromMin(d.getHours() * 60 + d.getMinutes()); };
  const dayName = n => new Date(2024, 0, n).toLocaleDateString(I18n.locale(), { weekday: 'long' });   // 1 gen 2024 = lunedì
  const longDate = d => new Date(d + 'T12:00').toLocaleDateString(I18n.locale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const durText = (from, to) => { const n = toMin(to) - toMin(from), h = Math.floor(n / 60), m = n % 60; return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' '); };
  const HALF_HOURS = Array.from({ length: 37 }, (_, i) => fromMin(360 + i * 30));   // 06:00 – 24:00
  const myUid = () => (window.Cloud && window.Cloud.user && window.Cloud.user.uid) || null;
  const isPastSlot = (date, hm) => date < todayStr() || (date === todayStr() && hm <= nowHM());
  const courtById = id => (S().courts || []).find(c => c.id === id);
  const courtName = id => { const c = courtById(id); return c ? c.name : t('bkCourtDeleted'); };
  const courtHours = (c, date) => { const o = c.hours[dow(date)]; return o && o.open && o.from < o.to ? o : null; };
  const bookableCourts = () => (S().courts || []).filter(c => c.visible || admin());
  // tipo di campo: tennis o padel (badge nella pagina delle prenotazioni e filtro se ci sono entrambi)
  const COURT_TYPES = ['tennis', 'padel'];
  const courtType = c => (c && c.type === 'padel' ? 'padel' : 'tennis');
  const typeBadge = c => `<span class="badge court-${courtType(c)}"><i class="ti ti-${courtType(c) === 'padel' ? 'ping-pong' : 'ball-tennis'}" aria-hidden="true"></i> ${esc(t('courtType_' + courtType(c)))}</span>`;
  // Blocchi ricorrenti di quel giorno della settimana (allenamenti fissi): sempre occupati.
  const weeklyOn = date => {
    const g = {}, wd = dow(date);
    // allenamento annullato o eliminato quel giorno: il suo campo è libero
    const off = rid => /^t_/.test(rid || '') && !!(occOf(String(rid).split('_')[1], date) || {}).cancelled;
    (S().weekly || []).filter(w => w.dow === wd && !off(w.rid)).forEach(w => { g[w.rid] = g[w.rid] || { id: 'w:' + w.rid, rid: w.rid, recurring: true, courtId: w.courtId, date, from: w.from, to: w.to, userId: null, blocked: '' }; });
    return Object.values(g);
  };
  const bookingAt = (courtId, date, hm) => (S().bookings || []).concat(date < todayStr() ? S().bookingsPast || [] : [], weeklyOn(date)).find(b => b.courtId === courtId && b.date === date && b.from <= hm && hm < b.to);
  const recurringReason = rid => { const r = (S().recurring || []).find(x => x.id === rid); return r ? r.reason : ''; };
  const bookingText = b => `${courtName(b.courtId)}, ${fmtDate(b.date)} ${esc(b.from)}–${esc(b.to)}`;
  const memberByUid = uid => (S().members || []).find(m => m.uid === uid);
  const uidName = uid => { const m = memberByUid(uid); return m ? personLabel(m) : uid === myUid() && admin() ? 'Admin' : '?'; };
  const banOf = uid => (S().bans || {})[uid] || {};

  // Conferma dell'email: senza conferma non si prenota.
  const needsVerify = () => !!member() && !!window.Cloud && !window.Cloud.verified;
  function verifyNotice() {
    if (!needsVerify()) return '';
    return `<div class="msg-alert verify-alert" role="alert">
      <div class="msg-head"><strong><i class="ti ti-mail" aria-hidden="true"></i> ${esc(t('verifyTitle'))}</strong></div>
      <div class="msg-text">${esc(t('verifyText', { e: window.Cloud.user.email }))}</div>
      <div class="btn-row"><button class="btn small primary" data-action="verify-check">${esc(t('verifyCheck'))}</button>
        <button class="btn small" data-action="verify-resend">${esc(t('verifyResend'))}</button></div></div>`;
  }
  // Lista nera: avviso all'utente bloccato nelle prenotazioni (what = 'book').
  function banNotice(what) {
    const m = member();
    if (!m || !banOf(m.uid)[what]) return '';
    return `<p class="note warn"><i class="ti ti-ban" aria-hidden="true"></i> ${esc(t('banBookMsg'))}</p>`;
  }

  // Avvisi delle prenotazioni modificate o cancellate (ALERT in cima alla pagina, finché non si preme "Ho letto").
  function bookingAlerts() {
    if (!(member() || admin())) return '';
    const me = myUid(), all = S().notices || [];
    const mine = all.filter(n => n.to !== 'admins');
    // avvisi per gli admin: ognuno vede quelli che non ha ancora segnato come letti
    const adm = admin() ? all.filter(n => n.to === 'admins' && !(n.readBy || []).includes(me)) : [];
    const when = n => esc(new Date(n.at).toLocaleString(I18n.locale(), { dateStyle: 'medium', timeStyle: 'short' }));
    const icon = n => (n.cat === 'admBk' ? 'calendar-event' : 'calendar-exclamation');
    const personal = mine.map(n => `<div class="msg-alert" role="alert">
      <div class="msg-head"><strong><i class="ti ti-${icon(n)}" aria-hidden="true"></i> ${esc(t('bkNotice'))}</strong>
        <small>${when(n)}</small></div>
      <div class="msg-text">${esc(n.text)}</div>
      <div class="btn-row">
      <button class="btn small" data-action="notice-dismiss" data-id="${esc(n.id)}"><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('msgRead'))}</button></div>
    </div>`).join('');
    const shared = adm.length ? `<details class="msg-alert adm-notices" role="alert" ${adm.length <= 3 ? 'open' : ''}>
      <summary class="msg-head"><strong><i class="ti ti-bell" aria-hidden="true"></i> ${esc(t('admNoticesTitle', { n: adm.length }))}</strong></summary>
      <ul class="adm-notice-list">${adm.slice(0, 50).map(n => `<li><i class="ti ti-${icon(n)}" aria-hidden="true"></i>
        <span><small class="muted">${when(n)}</small><br>${esc(n.text)}</span>
        <button class="btn small" data-action="notice-dismiss" data-id="${esc(n.id)}" aria-label="${esc(t('msgRead'))}"><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('msgRead'))}</button></li>`).join('')}</ul>
      ${adm.length > 1 ? `<div class="btn-row"><button class="btn small" data-action="notice-read-all"><i class="ti ti-checks" aria-hidden="true"></i> ${esc(t('admNoticesReadAll'))}</button></div>` : ''}
      <p class="muted small">${esc(t('admNoticesHelp'))}</p>
    </details>` : '';
    return shared + personal;
  }


  // per conto di chi è la prenotazione: utente registrato o nome scritto dall'admin (giocatore non registrato)
  const bkWho = b => (b.guest ? `${b.guest} (${t('bkGuestShort')})` : uidName(b.userId));
  // le mie prenotazioni future: quelle fatte da me e quelle in cui chi ha prenotato mi ha indicato tra i giocatori (inv)
  function myBookings(uid) {
    const own = (S().bookings || []).filter(b => b.userId === uid && !b.guest && !isPastSlot(b.date, b.to));
    const ids = new Set(own.map(b => b.id)), live = new Set((S().bookings || []).map(b => b.id));
    const inv = (S().bkplayers || []).filter(x => (x.uids || []).includes(uid) && x.by !== uid && x.date && x.from && x.to && !isPastSlot(x.date, x.to)
        && live.has(x.gid || x.id) && !ids.has(x.gid || x.id))
      .map(x => ({ id: x.gid || x.id, courtId: x.courtId, courtName: x.courtName, date: x.date, from: x.from, to: x.to, inv: true, byName: x.ownerName || uidName(x.by) }));
    return own.concat(inv).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));
  }
  // altri giocatori della prenotazione (senza me), per l'elenco delle mie prenotazioni
  const bkMates = (b, uid) => { const x = bkPlayersOf(b.id) || (S().bkplayers || []).find(y => y.gid === b.id); if (!x) return []; return bkNamesOf(x, uid); };
  const bkSubText = (b, uid) => { const mates = bkMates(b, uid); return [b.inv ? t('bkInvitedBy', { n: b.byName || '?' }) : '', mates.length ? t('bkWith', { n: mates.join(', ') }) : ''].filter(Boolean).join(' · '); };
  function bookingItem(b) {
    const sub = bkSubText(b, myUid());
    return `<li><span class="reg-names"><i class="ti ti-${b.inv ? 'users' : 'calendar-event'}" aria-hidden="true"></i> <strong>${esc(fmtDate(b.date))}</strong> · ${esc(b.from)}–${esc(b.to)}<br>
      <small class="muted">${esc(b.courtName || courtName(b.courtId))} · ${esc(durText(b.from, b.to))}${sub ? ` · ${esc(sub)}` : ''}</small></span>
      ${b.inv ? `<span class="badge">${esc(t('bkInvitedBadge'))}</span>` : `<span class="btn-row"><button class="btn small" data-action="booking-open" data-id="${esc(b.id)}">${esc(t('edit'))}</button>
      <button class="btn small danger" data-action="booking-delete" data-id="${esc(b.id)}">${esc(t('bkCancel'))}</button></span>`}</li>`;
  }

  // Selezione in corso: { courtId, date, from, to, editId, userId, blocked } (editId = prenotazione in modifica).
  function selFree(courtId, date, from, to, editId) {
    const c = courtById(courtId), h = c && courtHours(c, date);
    if (!h || from < h.from || to > h.to) return false;
    for (let x = from; x < to; x = addMin(x, 30)) {
      const b = bookingAt(courtId, date, x);
      if ((b && b.id !== editId) || isPastSlot(date, x)) return false;
    }
    return true;
  }

  // Orario di inizio e di fine scelti dai menu (a mezz'ore, dentro l'orario del campo): in modifica e in nuova prenotazione.
  // Inizio: le mezz'ore libere; fine: fino all'orario di chiusura. Si conferma solo se tutto l'intervallo è libero.
  function bkTimeSelects(s) {
    const c = courtById(s.courtId), h = c && courtHours(c, s.date);
    if (!h) return '';
    const starts = [], ends = [];
    for (let x = h.from; x < h.to; x = addMin(x, 30)) if (x === s.from || selFree(s.courtId, s.date, x, addMin(x, 30), s.editId)) starts.push(x);
    for (let x = addMin(s.from, 30); x <= h.to; x = addMin(x, 30)) ends.push(x);
    const opt = (list, cur) => list.map(x => `<option value="${x}" ${x === cur ? 'selected' : ''}>${x}</option>`).join('');
    return `<dt>${esc(t('bkChangeTime'))}</dt><dd class="bk-times">
      <label class="small">${esc(t('bkFromLabel'))}<select data-change="bk-from" aria-label="${esc(t('bkFromLabel'))}">${opt(starts, s.from)}</select></label>
      <label class="small">${esc(t('bkToLabel'))}<select data-change="bk-to" aria-label="${esc(t('bkToLabel'))}">${opt(ends, s.to)}</select></label></dd>`;
  }
  function bkSetTime(which, v) {
    const x = ui.bkSel;
    if (!x || !/^\d\d:\d\d$/.test(v)) return;
    let from = x.from, to = x.to;
    if (which === 'from') { const dur = toMin(to) - toMin(from); from = v; if (toMin(to) <= toMin(from)) to = addMin(from, Math.max(30, dur)); }
    else to = v;
    const c = courtById(x.courtId), h = c && courtHours(c, x.date);
    if (h && to > h.to) to = h.to;
    if (toMin(to) <= toMin(from)) return render();
    if (!selFree(x.courtId, x.date, from, to, x.editId)) return warn('bkRangeBusy', { a: from, b: to });
    x.from = from; x.to = to;
    render();
  }

  function slotClick(courtId, hm) {
    const d = ui.bookDate, s = ui.bkSel;
    const keep = s && s.editId ? { editId: s.editId, userId: s.userId, blocked: s.blocked } : {};
    if (s && s.courtId === courtId && s.date === d) {
      if (hm >= s.from && hm < s.to) {
        // Tocco dentro la selezione: la prenotazione finisce in quello slot (mai sotto la durata minima);
        // toccando il primo slot di una selezione di durata minima la si annulla.
        const minEnd = addMin(s.from, minBook());
        if (hm === s.from && s.to <= minEnd && !s.editId) ui.bkSel = null;
        else s.to = addMin(hm, 30) > minEnd ? addMin(hm, 30) : (selFree(courtId, d, s.from, minEnd, s.editId) ? minEnd : addMin(hm, 30));
        return render();
      }
      const from = hm < s.from ? hm : s.from, to = hm < s.from ? s.to : addMin(hm, 30);
      if (selFree(courtId, d, from, to, s.editId)) { s.from = from; s.to = to; return render(); }
    }
    // Nuova selezione: parte già dalla durata minima, se gli slot successivi sono liberi.
    const to = selFree(courtId, d, hm, addMin(hm, minBook()), keep.editId || null) ? addMin(hm, minBook()) : addMin(hm, 30);
    ui.bkSel = Object.assign({ courtId, date: d, from: hm, to, editId: null, userId: null, blocked: '' }, keep);
    render();
  }

  // Durate ammesse (di serie 1 h, 1 h 30, 2 h): un tocco e la prenotazione dura così (se le mezz'ore sono libere).
  function bkDurations(s) {
    const cfg = bookCfg(), max = admin() ? Math.max(Number(cfg.maxHours) * 60, 240) : Number(cfg.maxHours) * 60, cur = toMin(s.to) - toMin(s.from), out = [];
    for (let m = Math.max(60, minBook()); m <= max && out.length < 6; m += 30) out.push(m);
    if (!out.length) return '';
    return `<div class="segmented wrap bk-durs" role="group" aria-label="${esc(t('bkDuration'))}">${out.map(m => `<button type="button" data-action="bk-dur" data-m="${m}" aria-pressed="${m === cur}" ${selFree(s.courtId, s.date, s.from, addMin(s.from, m), s.editId) ? '' : 'disabled'}>${esc(durText('00:00', fromMin(m)))}</button>`).join('')}</div>`;
  }
  function summaryPanel() {
    const s = ui.bkSel, uid = myUid();
    const legend = `<div class="legend"><span><i class="sw free"></i>${esc(t('bkFree'))}</span><span><i class="sw busy"></i>${esc(t('bkBusy'))}</span>
      <span><i class="sw sel"></i>${esc(t('bkSelected'))}</span><span><i class="sw off"></i>${esc(t('bkClosed'))}</span></div>`;
    if (!s) {
      return `<h3><i class="ti ti-calendar-plus" aria-hidden="true"></i> ${esc(t('bkYour'))}</h3>
        <p class="muted small">${uid && (member() || admin()) ? esc(t('bkHowTo')) : `${esc(t('bkLoginFirst'))} <a href="#/settings">${esc(t('loginOrRegister'))}</a>`}</p>${legend}`;
    }
    const orig = s.editId && (S().bookings || []).find(b => b.id === s.editId);
    const slotChanged = orig && (orig.courtId !== s.courtId || orig.date !== s.date || orig.from !== s.from || orig.to !== s.to || (orig.userId || '') !== (s.userId || '') || (orig.blocked || '') !== (s.blocked || '') || (orig.guest || '') !== (s.guest || ''));
    const plBox = bkPlayersBox(s, orig);
    const changed = slotChanged || (orig && plBox && bkPlayersChanged(s, orig));
    const canLonger = selFree(s.courtId, s.date, s.from, addMin(s.to, 30), s.editId);
    const mem = (S().members || []).slice().sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
    const who = s.userId || (orig ? '' : uid);
    const adminFields = admin() ? `
      <label>${esc(t('bkFor'))}<select data-change="bk-user"><option value="">${esc(orig ? '—' : t('bkForMe'))}</option>
        ${mem.map(m => `<option value="${m.uid}" ${m.uid === who && m.uid !== uid ? 'selected' : ''}>${esc(personLabel(m))}</option>`).join('')}</select></label>
      <label>${esc(t('bkGuest'))}<input value="${esc(s.guest || '')}" maxlength="60" data-change="bk-guest" placeholder="${esc(t('bkGuestPh'))}" autocomplete="off"></label>
      <label>${esc(t('bkBlockReason'))}<input value="${esc(s.blocked || '')}" maxlength="60" data-change="bk-blocked" placeholder="${esc(t('bkBlockPh'))}"></label>` : '';
    return `<h3><i class="ti ti-${orig ? 'pencil' : 'calendar-plus'}" aria-hidden="true"></i> ${esc(t(orig ? 'bkEditTitle' : 'bkSummary'))}</h3><div class="summary-body"><div>
      ${orig ? `<p class="muted small">${esc(t('bkEditOf', { w: orig.blocked ? t('bkBlock') + ': ' + orig.blocked : bkWho(orig), b: bookingText(orig) }))}</p>` : ''}
      <dl class="summary">
        <dt>${esc(t('bkCourt'))}</dt><dd>${esc(courtName(s.courtId))} ${courtById(s.courtId) ? typeBadge(courtById(s.courtId)) : ''}</dd>
        <dt>${esc(t('bkDay'))}</dt><dd>${esc(longDate(s.date))}</dd>
        <dt>${esc(t('bkTime'))}</dt><dd><strong>${esc(s.from)} – ${esc(s.to)}</strong></dd>
        ${bkTimeSelects(s)}
        <dt>${esc(t('bkDuration'))}</dt><dd>${esc(durText(s.from, s.to))}</dd>
      </dl>
      ${bkDurations(s)}
      <div class="btn-row">
        <button class="btn small" data-action="bk-shorter" ${toMin(s.to) - toMin(s.from) - 30 < minBook() ? 'disabled' : ''}>− 30 min</button>
        <button class="btn small" data-action="bk-longer" ${canLonger ? '' : 'disabled'}>+ 30 min</button>
      </div></div><div>
      ${adminFields}
      ${plBox}
      <div class="btn-row">
        ${orig ? `<button class="btn primary" data-action="booking-confirm" ${changed ? '' : 'disabled'}><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('bkSaveChanges'))}</button>
          <button class="btn danger" data-action="booking-delete" data-id="${esc(orig.id)}"><i class="ti ti-trash" aria-hidden="true"></i> ${esc(t('bkCancel'))}</button>`
        : `<button class="btn primary" data-action="booking-confirm"><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('bkConfirm'))}</button>`}
        <button class="btn" data-action="bk-clear">${esc(t(orig ? 'close' : 'cancel'))}</button>
      </div></div></div>${legend}`;
  }

  function viewBook() {
    const cfg = bookCfg(), uid = myUid();
    const today = todayStr();
    // l'admin può tornare anche ai giorni passati per vedere le prenotazioni già giocate
    if (!ui.bookDate || (ui.bookDate < today && !admin())) ui.bookDate = today;
    const d = ui.bookDate;
    if (admin() && d < today && window.Cloud && window.Cloud.loadBookingsDay) window.Cloud.loadBookingsDay(d);
    const max = addDays(today, Number(cfg.daysAhead) || 7);
    const allCourts = bookableCourts();
    // filtro Tutti / Tennis / Padel, solo se ci sono campi di entrambi i tipi
    const types = COURT_TYPES.filter(k => allCourts.some(c => courtType(c) === k));
    const ctype = types.length > 1 && types.includes(ui.bookType) ? ui.bookType : 'all';
    const courts = ctype === 'all' ? allCourts : allCourts.filter(c => courtType(c) === ctype);
    const typeTabs = types.length > 1 ? `<nav class="tabs court-tabs" aria-label="${esc(t('courtType'))}">${['all'].concat(types).map(k =>
      `<a href="#/book" class="${ctype === k ? 'active' : ''}" data-action="bk-type" data-type="${k}">${k === 'all' ? '' : `<i class="ti ti-${k === 'padel' ? 'ping-pong' : 'ball-tennis'}" aria-hidden="true"></i> `}${esc(t(k === 'all' ? 'usersAll' : 'courtType_' + k))} <small>${k === 'all' ? allCourts.length : allCourts.filter(c => courtType(c) === k).length}</small></a>`).join('')}</nav>` : '';
    const open = courts.map(c => ({ c, h: courtHours(c, d) }));
    const opened = open.filter(x => x.h && x.c.visible);
    const starts = open.filter(x => x.h).map(x => x.h.from).sort(), ends = open.filter(x => x.h).map(x => x.h.to).sort();
    let rows = [];
    if (starts.length) for (let x = starts[0]; x < ends[ends.length - 1]; x = addMin(x, 30)) rows.push(x);
    const allRows = rows.length;
    // Oggi si mostrano solo gli orari non ancora passati.
    // (l'admin vede sempre tutto il giorno, comprese le prenotazioni già passate)
    if (d === today && !admin()) rows = rows.filter(x => !isPastSlot(d, x));
    // Fasce orarie (mattina, pomeriggio, sera) quando gli orari sono molti.
    const inBand = (x, k) => (k === 'am' ? x < '13:00' : k === 'pm' ? x >= '13:00' && x < '18:00' : k === 'eve' ? x >= '18:00' : true);
    const showBands = rows.length > 12;
    let band = showBands ? ui.bookBand || 'all' : 'all';
    if (!rows.some(x => inBand(x, band))) band = 'all';
    const bandsBar = showBands ? `<div class="bands" role="group" aria-label="${esc(t('bkBands'))}">${['all', 'am', 'pm', 'eve'].map(k =>
      `<button class="${k === band ? 'on' : ''}" data-action="bk-band" data-band="${k}" ${rows.some(x => inBand(x, k)) ? '' : 'disabled'}>${esc(t('bkBand_' + k))}</button>`).join('')}</div>` : '';
    rows = rows.filter(x => inBand(x, band));
    const s = ui.bkSel && ui.bkSel.date === d ? ui.bkSel : null;
    const freeHours = c => { const h = courtHours(c, d); if (!h || !c.visible) return 0; let n = 0; for (let x = h.from; x < h.to; x = addMin(x, 30)) if (!bookingAt(c.id, d, x) && !isPastSlot(d, x)) n++; return n / 2; };
    // Un riquadro per campo, con gli orari in orizzontale; stessa scala oraria per tutti i campi.
    const courtBox = c => {
      const h = courtHours(c, d);
      const head = `<div class="court-head"><h3>${esc(c.name)} ${typeBadge(c)}${!c.visible ? ` <span class="badge">${esc(t('bkHidden'))}</span>` : ''}</h3>
        <span class="muted small">${h ? `${esc(t('bkOpenHours', { a: h.from, b: h.to }))} · <strong>${esc(t('bkFreeHours', { n: String(freeHours(c)).replace('.', ',') }))}</strong>` : esc(t('bkClosedDay'))}</span></div>`;
      if (!h || !rows.some(x => x >= h.from && x < h.to)) return `<section class="card court-box closed">${head}${h ? `<p class="muted small">${esc(t(band !== 'all' ? 'bkNoneInBand' : 'bkOverToday'))}</p>` : ''}</section>`;
      const labels = rows.map((x, k) => (x.endsWith(':00') || k === 0 ? `<span class="tl" style="grid-column:${k + 1} / span ${x.endsWith(':00') && k + 1 < rows.length ? 2 : 1}">${x}</span>` : '')).join('');
      const cells = [];
      for (let k = 0; k < rows.length; k++) {
        const x = rows[k], b = bookingAt(c.id, d, x);
        const inSel = s && s.courtId === c.id && x >= s.from && x < s.to;
        if (b && !(s && s.editId === b.id)) {
          // Prenotazione: un unico blocco rosso che copre tutti i suoi slot.
          let n = 0;
          while (k + n < rows.length && rows[k + n] < b.to) n++;
          // Gli utenti vedono solo "occupato": chi ha prenotato e il motivo dei blocchi li vede solo l'admin.
          const mine = uid && b.userId === uid && !b.guest, canOpen = !b.recurring && (mine || admin()) && !isPastSlot(d, b.to);
          const who = !admin() ? t('bkBusy') : b.recurring ? `${t('recurringShort')}: ${recurringReason(b.rid) || '—'}` : b.blocked ? b.blocked : bkWho(b);
          const label = mine ? esc(t('bkMine')) : !admin() ? esc(who)
            : b.recurring ? `<i class="ti ti-repeat" aria-hidden="true"></i> ${esc(recurringReason(b.rid) || t('recurringShort'))}`
            : b.blocked ? `<i class="ti ti-lock" aria-hidden="true"></i> ${esc(b.blocked)}` : esc(who);
          // Nelle prenotazioni brevi c'è spazio solo per l'orario (il nome è nel suggerimento).
          // l'admin vede subito per chi è la prenotazione anche quando è breve (l'orario resta nel suggerimento)
          const inner = n === 1 ? `<small>${admin() && !mine ? label : b.from}</small>` : n === 2 && !mine ? `<small>${admin() ? label : `${esc(b.from)}–${esc(b.to)}`}</small>` : `<span>${label}</span><small>${esc(b.from)}–${esc(b.to)}</small>`;
          const adminBlock = admin() && (b.blocked || b.recurring);
          // allenamento (fisso o singolo): si apre la sua scheda del giorno in Allenamenti
          const trId = b.recurring ? ((S().recurring || []).find(x => x.id === b.rid) || {}).trid : String(b.id || '').startsWith('trx_') ? String(b.id).split('_')[1] : '';
          const body = trId && trainingById(trId) && admin() ? `<button data-action="bk-train" data-tid="${trId}" data-date="${d}">${inner}</button>`
            : canOpen ? `<button data-action="booking-open" data-id="${esc(b.id)}">${inner}</button>`
            : admin() && !b.recurring && !b.blocked ? `<button data-action="bk-info" data-id="${esc(b.id)}" data-date="${b.date}">${inner}</button>`
            : admin() && b.recurring ? `<a href="#/courts">${inner}</a>` : `<div>${inner}</div>`;
          cells.push(`<div class="slot busy ${mine ? 'mine' : ''} ${adminBlock ? 'blocked' : ''} ${admin() && b.recurring ? 'recurring' : ''}" style="grid-column:${k + 1} / span ${n}" title="${esc(who)} ${esc(b.from)}–${esc(b.to)}${admin() && bkPlayersOf(b.id) && bkNamesOf(bkPlayersOf(b.id)).length ? ` · ${esc(t('bkWith', { n: bkNamesOf(bkPlayersOf(b.id)).join(', ') }))}` : ''}">${body}</div>`);
          k += n - 1;
          continue;
        }
        const pos = `style="grid-column:${k + 1}"`;
        if (x < h.from || x >= h.to) cells.push(`<div class="slot off" ${pos} title="${x} – ${esc(t('bkClosed'))}"></div>`);
        else if (inSel) cells.push(`<div class="slot sel" ${pos}><button data-action="bk-slot" data-court="${esc(c.id)}" data-t="${x}" title="${x}" aria-label="${esc(c.name)} ${x} ${esc(t('bkSelected'))}">${x === s.from ? '<i class="ti ti-check" aria-hidden="true"></i>' : ''}</button></div>`);
        else if (isPastSlot(d, x)) cells.push(`<div class="slot off past" ${pos} title="${x}"></div>`);
        else if (d > max || !c.visible) cells.push(`<div class="slot off" ${pos} title="${x} – ${esc(t('bkNotBookable'))}"></div>`);
        else cells.push(`<div class="slot free" ${pos}><button data-action="bk-slot" data-court="${esc(c.id)}" data-t="${x}" title="${x} – ${addMin(x, 30)}" aria-label="${esc(c.name)} ${x} ${esc(t('bkFree'))}"></button></div>`);
      }
      return `<section class="card court-box">${head}
        <div class="strip-wrap"><div class="strip" style="--n:${rows.length}">
          <div class="strip-labels">${labels}</div><div class="strip-slots">${cells.join('')}</div>
        </div></div></section>`;
    };
    const mine = uid ? myBookings(uid) : [];
    return `
      ${bookingAlerts()}
      ${verifyNotice()}
      ${banNotice('book')}
      <div class="page-head row"><h1><i class="ti ti-calendar-time" aria-hidden="true"></i> ${esc(t('bkTitle'))}</h1>
        ${fullAdmin() ? `<a class="btn small" href="#/courts"><i class="ti ti-settings" aria-hidden="true"></i> ${esc(t('courtsManage'))}</a>` : ''}</div>
      <p class="muted">${esc(t('bkIntro', { c: courts.filter(c => c.visible).length, o: opened.length, m: hoursText(cfg.minHours), h: hoursText(cfg.maxHours), d: cfg.daysAhead }))}</p>
      <div class="date-nav">
        <button class="btn icon" data-action="bk-day" data-delta="-1" aria-label="${esc(t('bkPrevDay'))}" ${d <= today && !admin() ? 'disabled' : ''}><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <input type="date" value="${d}" ${admin() ? '' : `min="${today}"`} max="${max}" data-change="bk-date" aria-label="${esc(t('bkDay'))}">
        <button class="btn icon" data-action="bk-day" data-delta="1" aria-label="${esc(t('bkNextDay'))}" ${d >= max ? 'disabled' : ''}><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        <strong class="date-label">${esc(longDate(d))}</strong>
      </div>
      ${typeTabs}
      ${bandsBar}
      <div class="book-layout">
        <div class="book-grid">
        ${!courts.length ? `<div class="empty"><i class="ti ti-layout-grid" aria-hidden="true"></i> ${esc(t(admin() ? 'bkNoCourtsAdmin' : 'bkNoCourts'))}</div>`
        : !rows.length ? `<div class="empty"><i class="ti ti-door-off" aria-hidden="true"></i> ${esc(t(allRows ? 'bkOverTodayAll' : 'bkClosedAll'))}</div>`
        : courts.map(courtBox).join('')}
        </div>
        <aside class="card book-summary ${ui.bkSel ? 'active' : 'idle'}">${ui.bkSel && ui.bkSel.date !== d ? `<p class="muted small">${esc(t('bkSelOtherDay', { d: fmtDate(ui.bkSel.date) }))}</p>` : ''}${summaryPanel()}</aside>
      </div>
      ${admin() ? bkPastList(d) : ''}
      ${uid && (member() || admin()) ? `<div class="card"><h2><i class="ti ti-calendar-event" aria-hidden="true"></i> ${esc(t('bkMyNext'))}</h2>
        ${mine.length ? `<ul class="reg-list">${mine.map(bookingItem).join('')}</ul>` : `<p class="muted">${esc(t('bkNoMine'))}</p>`}</div>` : ''}`;
  }

  // admin: elenco delle prenotazioni già concluse nel giorno mostrato (con chi ha prenotato e i giocatori)
  function bkPastList(d) {
    const seen = new Set();
    const list = (S().bookings || []).concat(d < todayStr() ? S().bookingsPast || [] : [], weeklyOn(d))
      .filter(b => b.date === d && isPastSlot(b.date, b.to) && !seen.has(b.id) && seen.add(b.id))
      .sort((a, b) => a.from.localeCompare(b.from) || courtName(a.courtId).localeCompare(courtName(b.courtId)));
    if (!list.length && d === todayStr()) return '';
    const items = list.map(b => {
      const pl = bkPlayersOf(b.id) || (S().bkplayers || []).find(x => x.gid === b.id);
      const names = pl ? bkNamesOf(pl) : [];
      const who = b.recurring ? `<i class="ti ti-repeat" aria-hidden="true"></i> ${esc(recurringReason(b.rid) || t('recurringShort'))}`
        : b.blocked ? `<i class="ti ti-lock" aria-hidden="true"></i> ${esc(b.blocked)}` : esc(bkWho(b) || '—');
      const info = !b.recurring && !b.blocked ? `<button class="btn small" data-action="bk-info" data-id="${esc(b.id)}" data-date="${b.date}"><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('bkInfoBtn'))}</button>` : '';
      return `<li><span class="reg-names"><strong>${esc(b.from)}–${esc(b.to)}</strong> · ${esc(courtName(b.courtId))} · ${who}${names.length ? `<br><small class="muted">${esc(t('bkPastPlayers'))}: ${esc(names.join(' · '))}</small>` : ''}</span>${info}</li>`;
    }).join('');
    return `<div class="card bk-past"><h2><i class="ti ti-history" aria-hidden="true"></i> ${esc(t('bkPastTitle', { n: list.length }))}</h2>
      ${list.length ? `<ul class="reg-list">${items}</ul>` : `<p class="muted">${esc(t('bkPastNone'))}</p>`}</div>`;
  }

  // admin: chi ha giocato in una prenotazione (e correzione dei giocatori indicati)
  async function bkInfoDialog(id, date) {
    const b = (S().bookings || []).concat(S().bookingsPast || []).find(x => x.id === id && (!date || x.date === date));
    if (!b || !admin() || !window.Cloud || !window.Cloud.bookingInfo) return;
    const head = `<h2><i class="ti ti-calendar-event" aria-hidden="true"></i> ${esc(courtName(b.courtId))} · ${esc(fmtDate(b.date))} ${esc(b.from)}–${esc(b.to)}</h2>
      <p class="muted">${esc(t('bkInfoBooker'))}: <strong>${esc(bkWho(b) || '—')}</strong></p>`;
    $dialog.innerHTML = `<div class="dialog-body bk-info">${head}<p class="muted">${esc(t('loading'))}</p></div>`;
    if (!$dialog.open) $dialog.showModal();
    let info;
    try { info = await window.Cloud.bookingInfo(b.id); } catch (e) { info = null; }
    if (!$dialog.open) return;
    let body;
    if (!info) body = `<p class="error">${esc(t('bkInfoErr'))}</p>`;
    else {
      const pl = info.players.length ? `<ul class="reg-list">${info.players.map(p => `<li><span class="reg-names"><strong>${esc(p.name || uidName(p.uid))}</strong>${p.role ? ` <span class="badge">${esc(t('bkInfoBookerShort'))}</span>` : ''}</span></li>`).join('')}</ul>`
        : `<p class="muted">${esc(t('playedNoPlayers'))}</p>`;
      body = `<h3>${esc(t('bkPastPlayers'))} (${info.players.length})</h3>${pl}`;
      // l'admin può correggere i giocatori anche dopo la partita
      if (b.userId && !b.guest) {
        ui.bkInfo = { b, doc: info.doc || null };
        const cur = info.doc ? bkAllOf(info.doc) : [];
        const mem = (S().members || []).filter(m => m.uid !== b.userId).sort((x, y) => personLabel(x).localeCompare(personLabel(y)));
        const sel = (i, v) => `<label class="small">${esc(t('bkPlayerN', { n: i + 1 }))}<select name="p${i}"><option value="">—</option>
          ${bkPickOptions(mem, v)}</select></label>`;
        body += `<details class="bk-info-edit"><summary><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(t('bkInfoEdit'))}</summary>
          <form class="grid-form" data-form="bk-info-pl">${Array.from({ length: 7 }, (_, i) => sel(i, cur[i] || '')).join('')}
          <p class="muted small span-all">${esc(t('bkInfoEditHelp'))}</p>
          <div class="form-actions span-all"><button class="btn primary">${esc(t('save'))}</button></div></form></details>`;
      }
    }
    $dialog.innerHTML = `<div class="dialog-body bk-info">${head}${body}<div class="form-actions"><button type="button" class="btn" data-action="close-dialog">${esc(t('close'))}</button></div></div>`;
  }
  // Conferma (nuova prenotazione o modifica) con tutti i controlli; avvisi a titolare e amministratori.
  // ---------- giocatori della prenotazione e reminder ----------
  const BK_REMIND = [30, 60, 120, 180, 360, 720, 1440];
  const remindLabel = m => (m < 60 ? t('bkRemMin', { n: m }) : m === 60 ? t('bkRem1h') : t('bkRemH', { n: m / 60 }));
  const bkOwnerOf = (s, orig) => (admin() ? (s.blocked ? null : s.userId || (orig ? orig.userId : myUid())) : myUid());
  const bkPlayersOf = gid => (S().bkplayers || []).concat(S().bkplayersPast || []).find(x => x.id === gid);
  const bkStartMs = b => new Date(`${b.date}T${esc(b.from)}`).getTime();
  // chi ha prenotato sceglie quante persone giocano con lui (fino a 7), chi sono e quando ricevere il reminder
  function bkPlayersBox(s, orig) {
    const owner = bkOwnerOf(s, orig);
    if (!owner || s.blocked || s.guest) return '';   // prenotazione per un non registrato: niente giocatori né reminder
    if (orig && Date.now() >= bkStartMs(orig) && !admin()) return '';   // modificabile fino all'inizio (l'admin sempre)
    // l'admin modifica anche le prenotazioni degli altri: si aspetta di avere i giocatori già indicati
    if (orig && !S().bkpReady) return `<div class="bk-players"><p class="muted small"><i class="ti ti-loader-2" aria-hidden="true"></i> ${esc(t('loading'))}</p></div>`;
    const cur = orig && bkPlayersOf(orig.id);
    if (!s.plInit) { s.plInit = true; s.players = cur ? bkAllOf(cur) : []; s.np = s.players.length; s.remind = cur ? cur.remind : 60; }
    const mem = (S().members || []).filter(m => m.uid !== owner).sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
    return `<div class="bk-players"><h4><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('bkPlayersTitle'))}</h4>
      <label>${esc(t('bkPlayersN'))}<select data-change="bk-np">${[0, 1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${n === s.np ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${Array.from({ length: s.np }, (_, i) => `<label>${esc(t('bkPlayerN', { n: i + 1 }))}<select data-change="bk-pl" data-i="${i}"><option value="">—</option>
        ${bkPickOptions(mem, s.players[i])}</select></label>`).join('')}
      <label>${esc(t('bkRemind'))}<select data-change="bk-rem">${BK_REMIND.map(m => `<option value="${m}" ${m === s.remind ? 'selected' : ''}>${esc(remindLabel(m))}</option>`).join('')}</select></label>
      <p class="muted small">${esc(t('bkPlayersHelp'))}</p></div>`;
  }
  const bkPickedUids = s => [...new Set((s.players || []).slice(0, s.np || 0).filter(Boolean))];
  const bkPlayersChanged = (s, orig) => { const cur = bkPlayersOf(orig.id); return JSON.stringify(bkPickedUids(s)) !== JSON.stringify(cur ? bkAllOf(cur) : []) || (s.remind || 60) !== (cur ? cur.remind : 60); };
  // utenti registrati selezionabili (in ordine alfabetico). Le chiavi "p_…" erano i giocatori senza account
  // dell'app di origine: qui non ci sono, ma un documento vecchio con quelle chiavi si legge ancora.
  const bkPickOptions = (mem, v) => mem.map(m => ({ v: m.uid, n: personLabel(m) }))
    .sort((a, b) => a.n.localeCompare(b.n, 'it', { sensitivity: 'base' }))
    .map(o => `<option value="${esc(o.v)}" ${v === o.v ? 'selected' : ''}>${esc(o.n)}</option>`).join('');
  const isGuestKey = k => typeof k === 'string' && k.startsWith('p_');
  // tutti i giocatori indicati: prima gli utenti, poi i giocatori senza account
  const bkAllOf = x => (x.uids || []).concat(Object.keys(x.guests || {}));
  // nomi dei giocatori indicati (utenti e senza account), escluso chi è in "skip"
  const bkNamesOf = (x, skip) => (x.uids || []).filter(u => u !== skip).map(u => (x.names || {})[u] || '').concat(Object.values(x.guests || {})).filter(Boolean);
  function bkPlayersDoc(data, s) {
    const picked = bkPickedUids(s).filter(u => u !== data.userId);
    const uids = picked.filter(u => !isGuestKey(u)), guests = {};
    const om = memberByUid(data.userId);
    return { gid: data.id, by: data.userId, ownerName: om ? personLabel(om) : '', date: data.date, from: data.from, to: data.to, courtId: data.courtId, courtName: courtName(data.courtId),
      uids, guests, names: Object.fromEntries(uids.map(u => { const m = memberByUid(u); return [u, m ? personLabel(m) : '']; })), remind: s.remind || 60 };
  }
  // Reminder in prima pagina: da "remind" minuti prima dell'inizio fino alla fine della prenotazione.
  function bkReminderAlerts() {
    const me = myUid();
    if (!me) return '';
    const now = Date.now();
    const when = d => (d === todayStr() ? t('bkToday') : d === addDays(todayStr(), 1) ? t('bkTomorrow') : longDate(d));
    // solo le prenotazioni in cui gioco io (l'admin carica i giocatori di tutte, ma il reminder è personale)
    return (S().bkplayers || []).filter(x => (x.by === me || (x.uids || []).includes(me)) && now >= bkStartMs(x) - (x.remind || 60) * 60000 && now < new Date(`${x.date}T${esc(x.to)}`).getTime())
      .sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from)).map(x => {
        const mine = x.by === me;
        const others = Object.entries(x.names || {}).filter(([u]) => u !== me).map(([, n]) => n).filter(Boolean);
        const txt = mine ? t('bkRemOwner', { q: when(x.date), a: x.from, b: x.to }) : t('bkRemGuest', { q: when(x.date), a: x.from, b: x.to, n: x.ownerName || '?' });
        const players = mine ? others : [x.ownerName].concat(others).filter(Boolean);
        return `<div class="msg-alert ok bk-reminder" role="status"><div class="msg-head"><strong><i class="ti ti-bell-ringing" aria-hidden="true"></i> ${esc(t('bkRemTitle'))}</strong></div>
          <div class="msg-text">${esc(txt)}<br><small>${esc(x.courtName || courtName(x.courtId))}${players.length ? ` · ${esc(t('bkRemWith', { l: players.join(', ') }))}` : ''}</small></div></div>`;
      }).join('');
  }
  function confirmBooking() {
    const s = ui.bkSel, uid = myUid(), cfg = bookCfg();
    if (!s) return;
    if (!uid || !(member() || admin())) { location.hash = '#/settings'; return warn('bkLoginFirst'); }
    if (needsVerify()) return warn('verifyFirst');
    if (!admin() && banOf(uid).book) return warn('banBookMsg');
    const c = courtById(s.courtId);
    if (!c || (!c.visible && !admin())) return warn('bkNotBookable');
    if (!selFree(s.courtId, s.date, s.from, s.to, s.editId)) return warn('bkTaken');
    const orig = s.editId && (S().bookings || []).find(b => b.id === s.editId);
    const owner = admin() ? (s.blocked ? null : s.userId || (orig ? orig.userId : uid)) : uid;
    if (!admin()) {
      if (s.date > addDays(todayStr(), Number(cfg.daysAhead) || 7)) return warn('bkNotBookable');
      if (toMin(s.to) - toMin(s.from) < minBook()) return warn('bkMinHours', { h: hoursText(cfg.minHours) });
      if (toMin(s.to) - toMin(s.from) > Number(cfg.maxHours) * 60) return warn('bkMaxHours', { h: hoursText(cfg.maxHours) });
      const same = (S().bookings || []).filter(b => b.userId === uid && b.date === s.date && b.id !== s.editId).length;
      if (same >= Number(cfg.maxPerDay)) return warn('bkMaxDay', { n: same, max: cfg.maxPerDay });
    }
    const guest = admin() && !s.blocked ? (s.guest || '').trim() : '';
    const data = { id: orig ? orig.id : Store.uid('g'), courtId: s.courtId, date: s.date, from: s.from, to: s.to, userId: guest ? uid : owner, blocked: admin() ? (s.blocked || '').trim() : '' };
    if (guest) data.guest = guest;
    const slotSame = orig && orig.courtId === data.courtId && orig.date === data.date && orig.from === data.from && orig.to === data.to && (orig.userId || '') === (data.userId || '') && (orig.blocked || '') === (data.blocked || '') && (orig.guest || '') === (data.guest || '');
    // l'elenco dei giocatori si riscrive solo per una nuova prenotazione o se chi modifica l'ha cambiato davvero:
    // se si sposta solo l'orario o il campo, i giocatori già indicati restano (niente elenchi vuoti per errore)
    const withPlayers = !!data.userId && !data.blocked && !data.guest && s.plInit && (!orig || !!s.plTouched);
    if (slotSame) {
      // cambiano solo i giocatori o il reminder
      if (!withPlayers) { ui.bkSel = null; render(); return; }
      return window.Cloud.saveBkPlayers(bkPlayersDoc(data, s)).then(() => { ui.bkSel = null; ui.flash = { text: t('bkPlayersSaved') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    }
    if (orig && !confirm(t('bkConfirmEdit', { a: bookingText(orig), b: bookingText(data) }))) return;
    window.Cloud.saveBooking(data, orig || null).then(() => {
      // giocatori e reminder (anche senza giocatori: il reminder serve a chi ha prenotato)
      if (withPlayers) window.Cloud.saveBkPlayers(bkPlayersDoc(data, s)).catch(e => console.error(e));
      else if (orig && data.userId && !data.blocked && !data.guest && data.userId === orig.userId) window.Cloud.moveBkPlayers(data.id, { date: data.date, from: data.from, to: data.to, courtId: data.courtId, courtName: courtName(data.courtId) });
      if (orig) notifyBooking(orig, data, 'edit');
      ui.bkSel = null;
      ui.flash = { text: orig ? t('bkEdited') : data.blocked ? t('bkBlocked') : t('bkDone', { b: bookingText(data) }) };
      render();
    }).catch(e => warn(e.code === 'permission-denied' ? 'bkTaken' : 'regError', { code: e.code || e.message }));
  }

  function removeBooking(id) {
    const b = (S().bookings || []).find(x => x.id === id);
    if (!b) return;
    if (!confirm(t(b.blocked ? 'bkConfirmUnblock' : 'bkConfirmDelete', { b: bookingText(b) }))) return;
    window.Cloud.deleteBooking(b).then(() => {
      notifyBooking(b, null, 'delete');
      if (ui.bkSel && ui.bkSel.editId === id) ui.bkSel = null;
      ui.flash = { text: t('bkDeleted') };
      render();
    }).catch(e => warn('regError', { code: e.code || e.message }));
  }

  // Chi cambia una prenotazione altrui avvisa il titolare; l'utente che cambia la propria avvisa gli amministratori.
  function notifyBooking(b, next, what) {
    const uid = myUid();
    if (!b.userId || b.blocked) return;
    if (admin() && b.userId !== uid) {
      window.Cloud.notify(b.userId, what === 'edit' ? t('bkNoteEditedByAdmin', { a: bookingText(b), b: bookingText(next) }) : t('bkNoteDeletedByAdmin', { a: bookingText(b) }));
    } else if (!admin()) {
      const who = member() ? personLabel(member()) : '?';
      window.Cloud.notify('admins', what === 'edit' ? t('bkNoteEditedByUser', { u: who, a: bookingText(b), b: bookingText(next) }) : t('bkNoteDeletedByUser', { u: who, a: bookingText(b) }));
    }
  }

  // ---------- reward dei campi (prenotazioni giocate), soglie decise dall'admin ----------
  function bookRewardFor(n) {
    const th = S().bookRewards || {};
    let best = null;
    REWARDS.forEach(([k, icon]) => { const v = Number(th[k]); if (v > 0 && n >= v) best = { key: k, icon }; });
    return best;
  }
  // Prenotazioni giocate (concluse e non cancellate): conteggio dal database meno quelle non ancora finite.
  function loadBookCount(uid) {
    ui.bookCounts = ui.bookCounts || {};
    if (ui.bookCounts[uid] != null || ui.bookCountLoading || !window.Cloud) return;
    ui.bookCountLoading = true;
    window.Cloud.countBookings(uid).then(total => {
      ui.bookCounts[uid] = Math.max(0, total - (S().bookings || []).filter(b => b.userId === uid && !isPastSlot(b.date, b.to)).length);
    }).catch(() => { ui.bookCounts[uid] = 0; }).finally(() => { ui.bookCountLoading = false; render(); });
  }
  function bookRewardStat(uid) {
    loadBookCount(uid);
    const n = (ui.bookCounts || {})[uid];
    if (n == null) return `<div class="stat"><span>${esc(t('bookReward'))}</span><strong>…</strong></div>`;
    const rw = bookRewardFor(n), th = S().bookRewards || {};
    const next = REWARDS.find(([k]) => Number(th[k]) > n);
    return `<div class="stat"><span>${esc(t('bookReward'))}</span><strong>${rw ? `${rw.icon} ${esc(t('rw_' + rw.key))}` : '—'}</strong>
      <small class="muted">${esc(t('bookPlayed', { n }))}${next ? ` · ${esc(t('rewardNext', { n: Number(th[next[0]]) - n, r: t('rw_' + next[0]) }))} ${next[1]}` : ''}</small></div>`;
  }

  // ---------- amministrazione dei campi ----------
  function courtForm(c) {
    const opt = v => HALF_HOURS.map(h => `<option ${h === v ? 'selected' : ''}>${h}</option>`).join('');
    return `<form data-form="court-save" class="card court-form"><input type="hidden" name="id" value="${esc(c.id)}">
      <div class="grid-form"><label>${esc(t('courtName'))}<input name="name" value="${esc(c.name)}" maxlength="40" required></label>
        <label>${esc(t('courtType'))}<select name="type">${COURT_TYPES.map(k => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${esc(t('courtType_' + k))}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" name="visible" ${c.visible ? 'checked' : ''}> ${esc(t('courtVisible'))}</label></div>
      <div class="table-wrap"><table class="table hours"><thead><tr><th>${esc(t('bkDay'))}</th><th>${esc(t('courtOpen'))}</th><th>${esc(t('courtFrom'))}</th><th>${esc(t('courtTo'))}</th></tr></thead><tbody>
      ${[1, 2, 3, 4, 5, 6, 7].map(n => { const o = c.hours[n]; return `<tr><td>${esc(dayName(n))}</td>
        <td><input type="checkbox" name="open${n}" ${o.open ? 'checked' : ''} aria-label="${esc(dayName(n))}"></td>
        <td><select name="from${n}">${opt(o.from)}</select></td>
        <td><select name="to${n}">${opt(o.to)}</select></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="form-actions">
        <button type="button" class="btn small" data-action="court-copy">${esc(t('courtCopy'))}</button>
        <button type="button" class="btn small danger" data-action="court-delete" data-id="${esc(c.id)}"><i class="ti ti-trash" aria-hidden="true"></i> ${esc(t('courtDelete'))}</button>
        <button class="btn small primary">${esc(t('save'))}</button>
      </div></form>`;
  }

  // Blocchi ricorrenti (allenamenti fissi): ogni settimana, quel giorno, dalle … alle …
  function recurringCard() {
    const courts = S().courts || [];
    const list = (S().recurring || []).slice().sort((a, b) => courtName(a.courtId).localeCompare(courtName(b.courtId)) || a.dow - b.dow || a.from.localeCompare(b.from));
    const opt = (v, sel) => HALF_HOURS.map(h => `<option ${h === sel ? 'selected' : ''}>${h}</option>`).join('');
    return `<div class="card" id="recurring">
      <h2><i class="ti ti-repeat" aria-hidden="true"></i> ${esc(t('recurringTitle'))}</h2>
      <p class="muted small">${esc(t('recurringHelp'))}</p>
      ${list.length ? `<ul class="reg-list">${list.map(r => `<li><span class="reg-names"><strong>${esc(courtName(r.courtId))}</strong> · <span class="cap">${esc(dayName(r.dow))}</span> · ${esc(r.from)}–${esc(r.to)}<br>
        <small class="muted">${esc(r.reason || '—')}</small></span>
        ${r.trid ? `<a class="btn small" href="#/train">${esc(t('navTrain'))} →</a>` : `<button class="btn small danger" data-action="recurring-delete" data-id="${esc(r.id)}"><i class="ti ti-trash" aria-hidden="true"></i> ${esc(t('remove'))}</button>`}</li>`).join('')}</ul>`
        : `<p class="muted">${esc(t('recurringNone'))}</p>`}
      ${courts.length ? `<form class="grid-form" data-form="recurring-add">
        <h3 class="span-all">${esc(t('recurringNew'))}</h3>
        <label>${esc(t('bkCourt'))}<select name="courtId">${courts.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
        <label>${esc(t('bkDay'))}<select name="dow">${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${esc(dayName(n))}</option>`).join('')}</select></label>
        <label>${esc(t('courtFrom'))}<select name="from">${opt(0, '18:00')}</select></label>
        <label>${esc(t('courtTo'))}<select name="to">${opt(0, '19:30')}</select></label>
        <label class="span-all">${esc(t('recurringReason'))}<input name="reason" maxlength="60" required placeholder="${esc(t('recurringReasonPh'))}"></label>
        <div class="form-actions span-all"><button class="btn primary"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('recurringAdd'))}</button></div>
      </form>` : ''}
    </div>`;
  }

  function addRecurringForm(f) {
    const r = { courtId: f.courtId.value, dow: Number(f.dow.value), from: f.from.value, to: f.to.value, reason: f.reason.value.trim() };
    if (!r.reason) return warn('recurringNoReason');
    if (r.to <= r.from) return warn('courtHoursErr', { d: dayName(r.dow) });
    // niente sovrapposizioni con altri blocchi ricorrenti dello stesso campo e giorno
    if ((S().recurring || []).some(x => x.courtId === r.courtId && x.dow === r.dow && x.from < r.to && r.from < x.to)) return warn('recurringOverlap');
    // prenotazioni già fatte in quegli orari (da oggi in poi): restano, ma l'admin lo sa
    const clash = (S().bookings || []).filter(b => b.courtId === r.courtId && dow(b.date) === r.dow && b.from < r.to && r.from < b.to && !isPastSlot(b.date, b.to));
    if (clash.length && !confirm(t('recurringClash', { n: clash.length, list: clash.map(b => `${fmtDate(b.date)} ${esc(b.from)}–${esc(b.to)} · ${b.blocked || bkWho(b)}`).join('\n') }))) return;
    window.Cloud.addRecurring(r).then(() => { ui.flash = { text: t('recurringAdded') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
  }

  function viewCourts() {
    const cfg = bookCfg(), th = S().bookRewards || {};
    return `
      <div class="page-head"><a class="back" href="#/book">← ${esc(t('bkTitle'))}</a><h1><i class="ti ti-layout-grid" aria-hidden="true"></i> ${esc(t('courtsManage'))}</h1></div>
      <form class="card grid-form" data-form="booking-settings">
        <h2 class="span-all">${esc(t('bkRules'))}</h2>
        <label>${esc(t('bkMinHoursLbl'))}<select name="minHours">${[0.5, 1, 1.5, 2, 2.5, 3].map(h => `<option value="${h}" ${h == cfg.minHours ? 'selected' : ''}>${esc(durText('00:00', fromMin(h * 60)))}</option>`).join('')}</select></label>
        <label>${esc(t('bkMaxHoursLbl'))}<select name="maxHours">${[0.5, 1, 1.5, 2, 2.5, 3, 4].map(h => `<option value="${h}" ${h == cfg.maxHours ? 'selected' : ''}>${esc(durText('00:00', fromMin(h * 60)))}</option>`).join('')}</select></label>
        <label>${esc(t('bkMaxDayLbl'))}<input type="number" min="1" name="maxPerDay" value="${cfg.maxPerDay}"></label>
        <label>${esc(t('bkDaysAheadLbl'))}<input type="number" min="1" max="90" name="daysAhead" value="${cfg.daysAhead}"></label>
        <div class="form-actions span-all"><button class="btn primary">${esc(t('save'))}</button></div>
      </form>
      <h2>${esc(t('courtsTitle'))}</h2>
      <p class="muted small">${esc(t('courtsHelp'))}</p>
      ${(S().courts || []).map(courtForm).join('')}
      <div class="btn-row"><button class="btn" data-action="court-add"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('courtAdd'))}</button></div>
      <p class="muted small">${esc(t('courtsBlockHelp'))}</p>
      ${recurringCard()}
      <form class="card" data-form="book-rewards-save">
        <h2><i class="ti ti-star" aria-hidden="true"></i> ${esc(t('bookRewardsTitle'))}</h2>
        <p class="muted small">${esc(t('bookRewardsHelp'))}</p>
        <div class="grid-form">${REWARDS.map(([k, icon]) => `<label>${icon} ${esc(t('rw_' + k))}
          <input name="${k}" type="number" min="0" inputmode="numeric" value="${th[k] || ''}" placeholder="—"></label>`).join('')}</div>
        <div class="form-actions"><button class="btn primary">${esc(t('save'))}</button></div>
      </form>`;
  }

  // livelli degli allenamenti (etichette fpLevel_…)
  const LEVELS = ['start', 'inter', 'high', 'pro'];
  // Moduli a scomparsa che restano aperti anche se la pagina si ridisegna (aggiornamenti dal database).
  const keepOpen = key => ((ui.keep || {})[key] ? 'open' : '');
  // ====================================================================
  // PRIVACY E TERMINI: pagine legali, presa visione, dati personali (diritti GDPR artt. 15-22).
  // ====================================================================
  function viewLegal(kind) {
    const title = { privacy: 'legalPrivacy', cookie: 'legalCookie', termini: 'legalTerms' }[kind];
    return `<div class="page-head"><h1><i class="ti ti-shield-lock" aria-hidden="true"></i> ${esc(t(title))}</h1>
      ${I18n.lang !== 'it' ? `<p class="note">${esc(t('legalItalianOnly'))}</p>` : ''}</div>
      <article class="card legal-text" lang="it">${Legal.pages[kind]}</article>
      <p class="muted small"><a href="#/privacy">${esc(t('legalPrivacy'))}</a> · <a href="#/cookie">${esc(t('legalCookie'))}</a> · <a href="#/termini">${esc(t('legalTerms'))}</a></p>`;
  }
  // Utente registrato che non ha ancora preso visione della versione attuale (es. registrato prima, o creato dall'admin).
  function privacyAlert() {
    const m = member();
    if (!m || m.privacyVer === Legal.VERSION) return '';
    return `<div class="msg-alert privacy-alert" role="alert"><div class="msg-head"><strong><i class="ti ti-shield-check" aria-hidden="true"></i> ${esc(t('privacyAlertTitle'))}</strong></div>
      <div class="msg-text">${t('privacyAlertText')}</div>
      <button class="btn small primary" data-action="privacy-accept">${esc(t('privacyAccept'))}</button></div>`;
  }
  function privacyCard() {
    const m = member();
    if (!m) return '';
    return `<div class="card" id="my-privacy"><h2><i class="ti ti-shield-lock" aria-hidden="true"></i> ${esc(t('myPrivacy'))}</h2>
      <p class="muted small">${m.privacyAt ? esc(t('privacyAcceptedOn', { d: fmtDate(new Date(m.privacyAt).toLocaleDateString('sv')) })) : ''}
        <a href="#/privacy">${esc(t('legalPrivacy'))}</a> · <a href="#/cookie">${esc(t('legalCookie'))}</a> · <a href="#/termini">${esc(t('legalTerms'))}</a></p>
      <p class="small">${esc(t('myPrivacyHelp'))}</p>
      <div class="btn-row">
        <button class="btn" data-action="my-data"><i class="ti ti-download" aria-hidden="true"></i> ${esc(t('myDataDownload'))}</button>
        ${m.deleteReq ? `<span class="badge">${esc(t('deleteRequested', { d: fmtDate(new Date(m.deleteReq).toLocaleDateString('sv')) }))}</span>`
          : `<button class="btn danger" data-action="delete-request"><i class="ti ti-user-x" aria-hidden="true"></i> ${esc(t('deleteRequest'))}</button>`}
      </div>
      <p class="muted small">${esc(t('myPrivacyContact'))} <a href="mailto:${Legal.ORG.email}">${Legal.ORG.email}</a></p></div>`;
  }
  // Copia dei propri dati (art. 15 e 20 GDPR) in formato JSON.
  async function myDataExport() {
    const m = member(), uid = m.uid, mine = x => x.uid === uid;
    const data = {
      titolare: Legal.ORG.name, generato: new Date().toISOString(),
      profilo: { nome: m.first, cognome: m.last, sesso: m.gender, email: m.email, registrato: m.created ? new Date(m.created).toISOString() : null, informativaAccettata: m.privacyAt ? new Date(m.privacyAt).toISOString() : null },
      schedaCorsista: (S().athletes || []).find(a => a.id === uid) || null,
      pianiAllenamento: (S().plans || []).filter(mine),
      presenze: (S().att || []).filter(mine),
      spotERecuperi: (S().spots || []).filter(mine),
      ricevute: (S().receipts || []).filter(mine),
      prenotazioni: (S().bookingsMine || []).map(b => ({ campo: courtName(b.courtId), data: b.date, dalle: b.from, alle: b.to })),
      giocatoriNellePrenotazioni: (S().bkplayers || []).filter(b => b.by === uid || (b.uids || []).includes(uid))
        .map(b => ({ data: b.date, dalle: b.from, alle: b.to, campo: b.courtName, prenotatoDaMe: b.by === uid })),
      pacchetti: (S().packs || []).filter(mine),
      messaggiRicevuti: (S().messages || []).filter(x => (x.to || []).includes(uid) || x.all).map(x => ({ titolo: x.title || '', testo: x.text || '', data: x.created ? new Date(x.created).toISOString() : null })),
      avvisi: (S().notices || []).filter(x => x.to === uid).map(x => ({ testo: x.text, data: x.at ? new Date(x.at).toISOString() : null })),
      limitazioni: (S().bans || {})[uid] || null
    };
    saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `quattro-mori-tennis_dati_${latinName(personName(m))}.json`);
  }
  const privacyActions = {
    'privacy-accept': () => { window.Cloud.acceptPrivacy(Legal.VERSION).then(() => { ui.flash = { text: t('privacyAccepted') }; render(); }).catch(e => warn('regError', { code: e.code || e.message })); },
    'my-data': () => myDataExport(),
    'delete-request': () => {
      const m = member();
      if (!m || !confirmed('deleteRequestConfirm')) return;
      window.Cloud.requestDeletion(t('deleteRequestNotice', { n: personName(m), e: m.email || '' }))
        .then(() => { ui.flash = { text: t('deleteRequestSent') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    }
  };

  // ====================================================================
  // ALLENAMENTI: allenamenti settimanali (admin), coach, gruppi del mese, schede corsisti e listino.
  // I gruppi li compone l'admin mese per mese; il piano del corsista (quanti a settimana, prezzo)
  // si ricava dai gruppi in cui è inserito. Il coach vede solo nomi (e poi presenze).
  // ====================================================================
  const coach = () => (member() && window.Cloud.coach) || null;
  // admin centro (anche l'admin): vede tutti gli allenamenti, può annullare una giornata ed eliminare un allenamento
  const centerAdm = () => !!(window.Cloud && window.Cloud.center);
  // admin generali (l'Admin Centro non li può eliminare)
  const isGeneralUser = uid => ((window.Cloud && window.Cloud.generalUids) || []).includes(uid);
  // ruolo di un utente: admin generale, Admin (roles.center), segreteria, cassa, allenatore, utente
  const roleOf = uid => {
    const r = (S().roles || {})[uid] || {};
    if (r.general || isGeneralUser(uid) || (uid === myUid() && window.Cloud && window.Cloud.general)) return 'general';
    return r.center ? 'admin' : r.seg ? 'seg' : r.cash ? 'cash' : coachOf(uid) ? 'coach' : 'user';
  };
  // la segreteria modifica ed elimina solo utenti e allenatori; l'Admin non elimina un admin generale
  const canEditUser = uid => fullAdmin() || (admin() && ['user', 'coach'].includes(roleOf(uid)));
  const canDeleteUser = uid => (fullAdmin() && (!!(window.Cloud && window.Cloud.general) || !isGeneralUser(uid))) || (segr() && canEditUser(uid));
  // ruoli che chi è collegato può dare: l'admin generale tutti; l'Admin tutti tranne Admin; la segreteria solo utente e allenatore
  const ROLES = ['user', 'coach', 'seg', 'cash', 'admin'];
  const grantable = () => (window.Cloud && window.Cloud.general ? ROLES : fullAdmin() ? ROLES.filter(r => r !== 'admin') : admin() ? ['user', 'coach'] : []);
  const ROLE_ICON = { general: 'crown', admin: 'shield-star', seg: 'clipboard-list', cash: 'cash-register', coach: 'school', user: 'user' };
  const roleBadge = r => `<span class="badge role-${r}"><i class="ti ti-${ROLE_ICON[r]}" aria-hidden="true"></i> ${esc(t('role_' + r))}</span>`;
  // Chi usa gli allenamenti in prima persona: l'utente registrato, oppure l'admin che ha anche la scheda da giocatore
  // (così un admin può essere corsista o coach).
  const self = () => member() || (admin() && window.Cloud.adminMember) || null;
  const curMonth = () => todayStr().slice(0, 7);
  const shiftMonth = (m, n) => { const d = new Date(m + '-15T12:00'); d.setMonth(d.getMonth() + n); return d.toLocaleDateString('sv').slice(0, 7); };
  const monthLabel = m => { const x = new Date(m + '-15T12:00').toLocaleDateString(I18n.locale(), { month: 'long', year: 'numeric' }); return x.charAt(0).toUpperCase() + x.slice(1); };
  // stagione sportiva dal 1° settembre: "2026/27"
  const seasonOf = d => { const y = +d.slice(0, 4), mo = +d.slice(5, 7); const a = mo >= 9 ? y : y - 1; return `${a}/${String((a + 1) % 100).padStart(2, '0')}`; };
  const QUARTERS = Array.from({ length: 73 }, (_, i) => fromMin(360 + i * 15));   // 06:00 – 24:00 ogni 15 minuti
  const trainings = () => (S().trainings || []).slice().sort((a, b) => a.dow - b.dow || a.from.localeCompare(b.from));
  const trainingById = id => (S().trainings || []).find(x => x.id === id);
  // Recupero allenamento: allenamento extra in una sola data (tr.date), non si ripete e non entra nel piano mensile.
  const isExtraTr = tr => !!(tr && tr.date);
  const weeklyTrainings = () => trainings().filter(tr => !tr.date);
  const trLabel = tr => { if (tr.date) { const x = longDate(tr.date); return `${x.charAt(0).toUpperCase() + x.slice(1)} ${esc(tr.from)}–${esc(tr.to)}`; }
    const d = dayName(tr.dow); return `${d.charAt(0).toUpperCase() + d.slice(1)} ${esc(tr.from)}–${esc(tr.to)}`; };
  const extraBadge = tr => (isExtraTr(tr) ? `<span class="badge tr-extra-badge"><i class="ti ti-refresh" aria-hidden="true"></i> ${esc(t('trExtraBadge'))}</span>` : '');
  const trTitle = tr => tr.name || t('trDefaultName', { l: t('fpLevel_' + tr.level) });
  const groupOf = (tid, month) => (S().groups || []).find(g => g.tid === tid && g.month === month);
  const athleteOf = uid => (S().athletes || []).find(a => a.id === uid);
  const planOf = (uid, month) => (S().plans || []).find(p => p.uid === uid && p.month === month);
  const coachOf = uid => (S().coaches || []).find(c => c.id === uid);
  const coachName = uid => { const m = memberByUid(uid), c = coachOf(uid); return m ? personName(m) : (c && c.name) || '—'; };
  const priceFor = n => { const p = S().prices || {}; const v = p['w' + Math.min(n, 4)]; return n && v != null && v !== '' ? Number(v) : null; };
  const euro = v => (v == null || v === '' ? '—' : Number(v).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }));
  // certificato medico (agonistico o non agonistico): scaduto, entro 7 giorni (rosso), entro 30 giorni (arancio), valido
  const CERT_TYPES = ['agon', 'nonagon'];
  const certState = a => {
    if (!a || !a.certExp) return 'none';
    const today = todayStr();
    return a.certExp < today ? 'expired' : a.certExp <= addDays(today, 7) ? 'd7' : a.certExp <= addDays(today, 30) ? 'd30' : 'ok';
  };
  const certDue = a => ['expired', 'd7', 'd30'].includes(certState(a));
  const certDays = a => Math.round((new Date(a.certExp + 'T12:00') - new Date(todayStr() + 'T12:00')) / 86400000);
  const certBadge = a => {
    const st = certState(a), ty = a && CERT_TYPES.includes(a.certType) ? t('certType_' + a.certType) + ' · ' : '';
    return `<span class="badge cert-${st}"><i class="ti ti-${st === 'ok' ? 'heart-check' : st === 'none' ? 'heart-question' : 'alert-triangle'}" aria-hidden="true"></i> ${esc(st === 'none' ? t('certNone') : ty + t('cert_' + st, { d: fmtDate(a.certExp), n: certDays(a) }))}</span>`;
  };
  const certTypeSelect = v => `<label>${esc(t('certType'))}<select name="certType"><option value="">—</option>${CERT_TYPES.map(k => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(t('certType_' + k))}</option>`).join('')}</select></label>`;
  // tesseramento FITP della stagione: qui si segna solo pagato / non pagato (si fa sulla piattaforma della federazione)
  const tessBadge = a => {
    const s = seasonOf(todayStr()), ok = !!(a && a.tess && a.tess[s]);
    return `<span class="badge ${ok ? 'st-done' : 'tess-no'}"><i class="ti ti-${ok ? 'id-badge-2' : 'id-off'}" aria-hidden="true"></i> ${esc(t(ok ? 'tessYes' : 'tessNo', { s }))}</span>`;
  };
  // Allenamenti che il coach può vedere (tutti o solo i suoi)
  const visibleTrainings = () => (admin() || centerAdm() ? trainings() : coach() ? trainings().filter(tr => coach().all || tr.coachUid === myUid()) : []);

  // Descrizione degli allenamenti del piano (dagli allenamenti attuali; per quelli eliminati resta quella salvata).
  const trDesc = tr => [trTitle(tr), trLabel(tr), tr.coachUid ? coachName(tr.coachUid) : ''].filter(Boolean).join(' · ');
  const planDesc = p => (p.tids || []).map((id, i) => { const tr = trainingById(id); return tr ? trDesc(tr) : (p.desc || [])[i] || ''; }).filter(Boolean);
  // Piano del mese ricalcolato da tutti i gruppi (con le modifiche "groups" non ancora salvate).
  function planFrom(uid, month, groups) {
    const tids = groups.filter(g => g.month === month && (g.uids || []).includes(uid) && !isExtraTr(trainingById(g.tid))).map(g => g.tid)
      .sort((a, b) => { const x = trainingById(a), y = trainingById(b); return x && y ? x.dow - y.dow || x.from.localeCompare(y.from) : 0; });
    const old = planOf(uid, month);
    const desc = tids.map(id => { const tr = trainingById(id); return tr ? trDesc(tr) : ''; }).filter(Boolean);
    if (!tids.length) return old ? { id: old.id, del: true } : null;
    const auto = priceFor(tids.length);
    // si tengono gli altri dati del piano (es. il pagamento già registrato)
    const keep = old ? Object.assign({}, old) : {}; delete keep.id;
    return Object.assign(keep, { id: `${uid}_${month}`, uid, month, tids, desc, n: tids.length, price: old && old.manual ? old.price : auto, manual: !!(old && old.manual), updated: Date.now() });
  }

  function viewTraining() {
    // utenti e visitatori: posti spot disponibili e i propri allenamenti
    if (!admin() && !coach() && !centerAdm()) {
      const mine = member() ? myTrainingCard() : '';
      return `${trainingAlerts()}<div class="page-head"><h1><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('navTrain'))}</h1><p class="muted">${esc(t('trIntroPublic'))}</p></div>${mine}${spotSection(false)}`;
    }
    const tab = ui.trTab || 'day';
    const tabs = `<nav class="tabs">${[['day', 'trTabDay', 'calendar-check'], ['groups', 'trTabGroups', 'users-group']].map(([k, l, i]) =>
      `<a href="#/train" class="${tab === k ? 'active' : ''}" data-action="tr-tab" data-tab="${k}"><i class="ti ti-${i}" aria-hidden="true"></i> ${esc(t(l))}</a>`).join('')}</nav>`;
    if (tab === 'day') return `${admin() ? trainingAlerts() : ''}<div class="page-head row"><h1><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('navTrain'))}</h1>
        ${admin() ? `<span class="btn-row"><a class="btn small" href="#/report"><i class="ti ti-report-analytics" aria-hidden="true"></i> ${esc(t('rpTitle'))} →</a><a class="btn small" href="#/athletes"><i class="ti ti-id-badge-2" aria-hidden="true"></i> ${esc(t('athTitle'))} →</a></span>` : ''}</div>${tabs}${admin() ? myTrainingCard() : ''}${trainingDay()}`;
    const month = ui.trMonth || curMonth();
    const list = visibleTrainings().filter(tr => !tr.date || tr.date.slice(0, 7) === month);
    const prev = shiftMonth(month, -1);
    const canCopy = centerAdm() && list.some(tr => !tr.date && !groupOf(tr.id, month) && groupOf(tr.id, prev));
    return `
      <div class="page-head row"><h1><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('navTrain'))}</h1>
        ${admin() ? `<span class="btn-row"><a class="btn small" href="#/report"><i class="ti ti-report-analytics" aria-hidden="true"></i> ${esc(t('rpTitle'))} →</a><a class="btn small" href="#/athletes"><i class="ti ti-id-badge-2" aria-hidden="true"></i> ${esc(t('athTitle'))} →</a></span>` : ''}</div>
      ${tabs}
      <div class="month-nav card">
        <button class="btn small" data-action="tr-month" data-m="${prev}" aria-label="${esc(t('prevMonth'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong>${esc(monthLabel(month))}</strong>
        <button class="btn small" data-action="tr-month" data-m="${shiftMonth(month, 1)}" aria-label="${esc(t('nextMonth'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        <label class="tr-pick"><span class="sr-only">${esc(t('trPickMonth'))}</span><input type="month" value="${month}" data-change="tr-month-pick" aria-label="${esc(t('trPickMonth'))}"></label>
        ${canCopy ? `<button class="btn small" data-action="tr-copy" data-m="${month}"><i class="ti ti-copy" aria-hidden="true"></i> ${esc(t('trCopyPrev', { m: monthLabel(prev) }))}</button>` : ''}
      </div>
      ${list.length ? `<div class="tr-grid">${list.map(tr => trainingCard(tr, month)).join('')}</div>` : `<div class="empty"><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('trNone'))}</div>`}
      ${centerAdm() ? trainingForm(null) : ''}
      ${admin() ? coachesCard() : ''}
      ${admin() ? selfProfileCard() : ''}`;
  }

  function trainingCard(tr, month) {
    if (centerAdm() && ui.trEdit === tr.id) return `<div class="card tr-card" id="tr-${esc(tr.id)}">${trainingForm(tr)}</div>`;
    const g = groupOf(tr.id, month), uids = (g && g.uids) || [];
    const names = (g && g.names) || {};
    const full = uids.length >= (tr.max || 0);
    const od = nextOcc(tr, month), oc = od && occOf(tr.id, od);
    const rows = uids.map(uid => {
      const a = athleteOf(uid), at = od && attOf(tr.id, od, uid);
      return `<li><span class="reg-names"><strong>${esc(names[uid] || coachName(uid))}</strong>${od && !(oc && oc.cancelled) ? ` ${attChip(at && at.status, od)}` : ''}
        ${admin() ? `<br>${tessBadge(a)} ${certBadge(a)}` : ''}</span>
        ${centerAdm() ? `<button class="btn small danger" data-action="grp-remove" data-tid="${esc(tr.id)}" data-m="${month}" data-uid="${uid}" aria-label="${esc(t('remove'))}"><i class="ti ti-user-minus" aria-hidden="true"></i></button>` : ''}</li>`;
    }).join('');
    let add = '';
    if (centerAdm()) {
      const members = (S().members || []).filter(m => !uids.includes(m.uid)).sort((a, b) => personName(a).localeCompare(personName(b)));
      add = `<details class="sub-form" data-keep="grp-${esc(tr.id)}" ${keepOpen('grp-' + tr.id)}><summary><i class="ti ti-user-plus" aria-hidden="true"></i> ${esc(t('grpAdd'))}</summary>
        <form class="grid-form" data-form="grp-add" data-tid="${esc(tr.id)}" data-m="${month}">
          <label class="span-all">${esc(t('athPerson'))}<select name="uid" required data-change="grp-pick"><option value="">— ${esc(t('chooseUser'))} —</option>
            ${members.map(m => `<option value="${m.uid}">${esc(personName(m))}${athleteOf(m.uid) || !admin() ? '' : ' ·  ' + esc(t('athNew'))}</option>`).join('')}</select></label>
          <label class="check"><input type="checkbox" name="tess"> ${esc(t('tessLabel', { s: seasonOf(todayStr()) }))}</label>
          ${admin() ? certTypeSelect('') : ''}
          <label>${esc(t('certExp'))}<input type="date" name="certExp"></label>
          <div class="form-actions span-all"><button class="btn primary">${esc(t('grpAddBtn'))}</button></div>
        </form></details>`;
    }
    return `<div class="card tr-card ${isExtraTr(tr) ? 'tr-extra' : ''}" id="tr-${esc(tr.id)}">
      <div class="ch-head">${extraBadge(tr)}<span class="badge lvl-${tr.level}">${esc(t('fpLevel_' + tr.level))}</span> <span class="badge ${full ? 'st-full' : ''}">${uids.length}/${tr.max}</span></div>
      <h3>${esc(trTitle(tr))}</h3>
      <p class="muted cap"><i class="ti ti-${isExtraTr(tr) ? 'calendar-event' : 'calendar-repeat'}" aria-hidden="true"></i> ${esc(trLabel(tr))}</p>
      <p class="muted small">${tr.coachUid ? `<i class="ti ti-school" aria-hidden="true"></i> ${esc(t('trCoach'))}: ${esc(coachName(tr.coachUid))}` : ''}
        ${tr.coachUid && (tr.courts || []).length ? ' · ' : ''}${(tr.courts || []).length ? `<i class="ti ti-layout-grid" aria-hidden="true"></i> ${esc(tr.courts.map(courtName).join(', '))}` : ''}</p>
      <h4>${esc(t('grpTitle', { m: monthLabel(month) }))}</h4>
      ${od && uids.length ? `<p class="muted small"><i class="ti ti-calendar-check" aria-hidden="true"></i> ${esc(t(oc && oc.cancelled ? 'occCancelledOn' : 'attOfDay', { d: longDate(od) }))}</p>` : ''}
      ${uids.length ? `<ul class="reg-list">${rows}</ul>` : `<p class="muted small">${esc(t('grpEmpty'))}</p>`}
      ${add}
      ${centerAdm() ? `<div class="btn-row"><button class="btn small" data-action="tr-edit" data-id="${esc(tr.id)}"><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(t('edit'))}</button>
        <button class="btn small danger" data-action="tr-delete" data-id="${esc(tr.id)}"><i class="ti ti-trash" aria-hidden="true"></i> ${esc(t('trDelete'))}</button></div>` : ''}
    </div>`;
  }

  function trainingForm(tr) {
    // nuovo allenamento: dopo un avviso il modulo riparte da quanto già scritto (ui.trDraft)
    const dr = !tr && ui.trDraft;
    const v = tr || dr || { name: '', dow: 1, from: '19:00', to: '20:15', level: 'inter', max: 8, coachUid: '', courts: [] };
    const coaches = (S().coaches || []).slice().sort((a, b) => coachName(a.id).localeCompare(coachName(b.id)));
    const opt = (sel, list) => list.map(h => `<option ${h === sel ? 'selected' : ''}>${h}</option>`).join('');
    const ex = isExtraTr(tr);
    const sources = weeklyTrainings();
    const form = `<form class="grid-form tr-form ${ex ? 'is-extra' : ''}" data-form="tr-save" data-id="${tr ? tr.id : ''}">
        ${tr ? `<h3 class="span-all">${esc(t(ex ? 'trExtraEditTitle' : 'trEditTitle'))}</h3>` : `<fieldset class="span-all tr-kind"><legend>${esc(t('trKind'))}</legend>
          <label class="check"><input type="radio" name="kind" value="weekly" ${dr && dr.kind === 'extra' ? '' : 'checked'}> ${esc(t('trKindWeekly'))}</label>
          <label class="check"><input type="radio" name="kind" value="extra" ${dr && dr.kind === 'extra' ? 'checked' : ''}> <span class="badge tr-extra-badge">${esc(t('trExtraBadge'))}</span> ${esc(t('trKindExtra'))}</label></fieldset>`}
        ${tr ? `<input type="hidden" name="kind" value="${ex ? 'extra' : 'weekly'}">` : ''}
        <label class="span-all">${esc(t('trName'))}<input name="name" maxlength="60" value="${esc(v.name || '')}" placeholder="${esc(t('trNamePh'))}"></label>
        <label class="only-extra">${esc(t('trExtraDate'))}<input type="date" name="date" value="${esc(v.date || '')}" min="${todayStr()}"></label>
        ${tr ? '' : `<label class="only-extra span-all">${esc(t('trCopyFrom'))}<select name="copyFrom"><option value="">${esc(t('trCopyNone'))}</option>
          ${sources.map(s => `<option value="${esc(s.id)}" ${dr && dr.copyFrom === s.id ? 'selected' : ''}>${esc(trTitle(s))} · ${esc(trLabel(s))}${s.coachUid ? ' · ' + esc(coachName(s.coachUid)) : ''}</option>`).join('')}</select>
          <small class="muted">${esc(t('trCopyFromHelp'))}</small></label>`}
        <label class="only-weekly">${esc(t('bkDay'))}<select name="dow">${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${n === v.dow ? 'selected' : ''}>${esc(dayName(n))}</option>`).join('')}</select></label>
        <label>${esc(t('courtFrom'))}<select name="from">${opt(v.from, QUARTERS.slice(0, -1))}</select></label>
        <label>${esc(t('courtTo'))}<select name="to">${opt(v.to, QUARTERS.slice(1))}</select></label>
        <label>${esc(t('trLevel'))}<select name="level">${LEVELS.map(l => `<option value="${l}" ${l === v.level ? 'selected' : ''}>${esc(t('fpLevel_' + l))}</option>`).join('')}</select></label>
        <label>${esc(t('trMax'))}<input type="number" name="max" min="1" max="60" required value="${v.max}" inputmode="numeric"></label>
        <label>${esc(t('trCoach'))}<select name="coachUid"><option value="">—</option>${coaches.map(c => `<option value="${esc(c.id)}" ${c.id === v.coachUid ? 'selected' : ''}>${esc(coachName(c.id))}</option>`).join('')}</select>
          ${coaches.length ? '' : `<small class="muted">${esc(t('trNoCoaches'))}</small>`}</label>
        <fieldset class="span-all fp-levels"><legend>${esc(t('trCourts'))}</legend>
          ${(S().courts || []).map(c => `<label class="check"><input type="checkbox" name="court" value="${esc(c.id)}" ${(v.courts || []).includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('') || `<span class="muted small">${esc(t('trNoCourts'))}</span>`}
          <small class="muted span-all only-weekly">${esc(t('trCourtsHelp'))}</small><small class="muted span-all only-extra">${esc(t('trExtraCourtsHelp'))}</small></fieldset>
        <div class="form-actions span-all">${tr ? `<button type="button" class="btn" data-action="tr-edit-cancel">${esc(t('cancel'))}</button>` : ''}
          <button class="btn primary">${esc(t(tr ? 'save' : 'trCreate'))}</button></div>
      </form>`;
    if (tr) return form;
    return `<details class="card sub-form" data-keep="tr-new" ${keepOpen('tr-new')}><summary><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('trNew'))}</summary>${form}</details>`;
  }

  // L'admin che vuole essere corsista o coach registra il proprio nome da giocatore (scheda utente members/{uid}).
  function selfProfileCard() {
    const me = window.Cloud.adminMember;
    if (me) return `<p class="muted small"><i class="ti ti-user-check" aria-hidden="true"></i> ${esc(t('selfProfileOk', { n: personName(me) }))}</p>`;
    return `<form class="card grid-form" data-form="self-profile" id="self-profile">
      <h2 class="span-all"><i class="ti ti-user-plus" aria-hidden="true"></i> ${esc(t('selfProfileTitle'))}</h2>
      <p class="muted small span-all">${esc(t('selfProfileHelp'))}</p>
      <label>${esc(t('firstName'))}<input name="first" required maxlength="60"></label>
      <label>${esc(t('lastName'))}<input name="last" required maxlength="60"></label>
      <label>${esc(t('gender'))}<select name="gender"><option value="M">${esc(t('male'))}</option><option value="F">${esc(t('female'))}</option></select></label>
      <div class="form-actions span-all"><button class="btn primary">${esc(t('save'))}</button></div>
    </form>`;
  }

  function coachesCard() {
    const list = (S().coaches || []).slice().sort((a, b) => coachName(a.id).localeCompare(coachName(b.id)));
    const others = (S().members || []).filter(m => !coachOf(m.uid)).sort((a, b) => personName(a).localeCompare(personName(b)));
    return `<div class="card" id="coaches">
      <h2><i class="ti ti-school" aria-hidden="true"></i> ${esc(t('coachTitle'))}</h2>
      <p class="muted small">${esc(t('coachHelp'))}</p>
      ${list.length ? `<ul class="reg-list coach-list">${list.map(c => `<li><span class="reg-names"><strong>${esc(coachName(c.id))}</strong></span>
        <select data-change="coach-all" data-uid="${esc(c.id)}" aria-label="${esc(t('coachSees'))}">
          <option value="0" ${c.all ? '' : 'selected'}>${esc(t('coachOwn'))}</option><option value="1" ${c.all ? 'selected' : ''}>${esc(t('coachAll'))}</option></select>
        <button class="btn small danger" data-action="coach-remove" data-uid="${esc(c.id)}"><i class="ti ti-trash" aria-hidden="true"></i></button></li>`).join('')}</ul>` : `<p class="muted">${esc(t('coachNone'))}</p>`}
      <form class="inline-form" data-form="coach-add">
        <select name="uid" required><option value="">— ${esc(t('chooseUser'))} —</option>${others.map(m => `<option value="${m.uid}">${esc(personName(m))}</option>`).join('')}</select>
        <select name="all"><option value="0">${esc(t('coachOwn'))}</option><option value="1">${esc(t('coachAll'))}</option></select>
        <button class="btn primary"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('coachAdd'))}</button>
      </form>
    </div>`;
  }

  // ---------- console corsisti (admin) ----------
  function viewAthletes(certOnly) {
    const month = ui.trMonth || curMonth();
    const q = (ui.athFilter || '').toLowerCase();
    const due = certDue;
    // solo certificati scaduti o in scadenza (dall'avviso): prima i più vecchi
    const list = (S().athletes || []).map(a => ({ a, m: memberByUid(a.id) }))
      .filter(x => !certOnly || due(x.a))
      .filter(x => !q || personName(x.m || { first: x.a.first || '', last: x.a.last || '' }).toLowerCase().includes(q))
      .sort(certOnly ? (x, y) => (x.a.certExp || '').localeCompare(y.a.certExp || '') : (x, y) => (x.m ? personName(x.m) : '').localeCompare(y.m ? personName(y.m) : ''));
    const noSheet = (S().members || []).filter(m => !athleteOf(m.uid)).sort((a, b) => personName(a).localeCompare(personName(b)));
    const warnN = (S().athletes || []).filter(certDue).length;
    return `
      <div class="page-head row"><h1><i class="ti ti-id-badge-2" aria-hidden="true"></i> ${esc(t('athTitle'))}</h1>
        <span class="btn-row"><button class="btn small" data-action="pack-sync" ${ui.packSyncing ? 'disabled' : ''} title="${esc(t('packSyncHelp'))}"><i class="ti ti-refresh" aria-hidden="true"></i> ${esc(t(ui.packSyncing ? 'packSyncing' : 'packSync'))}</button>
        <a class="btn small" href="#/train"><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('navTrain'))} →</a></span></div>
      ${certOnly ? `<div class="note warn cert-only"><span><i class="ti ti-heart-exclamation" aria-hidden="true"></i> <strong>${esc(t('certOnlyTitle', { n: list.length }))}</strong></span> <a class="btn small" href="#/athletes">${esc(t('certShowAll'))}</a></div>`
        : warnN ? certSummary('note') : ''}
      <div class="month-nav card">
        <button class="btn small" data-action="tr-month" data-m="${shiftMonth(month, -1)}" aria-label="${esc(t('prevMonth'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong>${esc(monthLabel(month))}</strong>
        <button class="btn small" data-action="tr-month" data-m="${shiftMonth(month, 1)}" aria-label="${esc(t('nextMonth'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        <input type="search" data-change="ath-filter" placeholder="${esc(t('search'))}" value="${esc(ui.athFilter || '')}">
      </div>
      ${certOnly ? '' : `<details class="card sub-form" data-keep="ath-new" ${keepOpen('ath-new')}><summary><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('athNewTitle'))}</summary>
        <form class="grid-form" data-form="ath-new" data-m="${month}">
          <label class="span-all">${esc(t('athPerson'))}<select name="uid" required><option value="">— ${esc(t('chooseUser'))} —</option>${noSheet.map(m => `<option value="${m.uid}">${esc(personName(m))}</option>`).join('')}</select></label>
          <label class="check"><input type="checkbox" name="tess"> ${esc(t('tessLabel', { s: seasonOf(todayStr()) }))}</label>
          ${certTypeSelect('')}
          <label>${esc(t('certExp'))}<input type="date" name="certExp"></label>
          ${trChecks(null, month)}
          <div class="form-actions span-all"><button class="btn primary">${esc(t('athCreate'))}</button></div></form></details>`}
      ${list.length ? `<div class="ath-list">${list.map(x => athleteCard(x.a, x.m, month)).join('')}</div>` : `<div class="empty"><i class="ti ti-id-badge-2" aria-hidden="true"></i> ${esc(t(certOnly ? 'certNoneDue' : 'athNone'))}</div>`}
      ${certOnly || !fullAdmin() ? '' : pricesCard()}`;
  }

  function athleteCard(a, m, month) {
    const name = m ? personName(m) : `${a.last || ''} ${a.first || ''}`.trim() || '?';
    const p = planOf(a.id, month);
    const editing = ui.athEdit === a.id;
    const planLine = p ? `${esc(t('planN', { n: p.n }))} · ${esc(planDesc(p).join(' / '))}` : esc(t('planNone'));
    const head = `<div class="ath-head"><div><strong>${esc(name)}</strong> ${tessBadge(a)} ${certBadge(a)}
        <br><small class="muted">${planLine}${p ? ` · <b>${esc(euro(p.price))}</b>${p.manual ? ` <span class="badge">${esc(t('priceManual'))}</span>` : ''} ${payBadge(p)}` : ''}</small>
        ${packsOf(a.id).length ? `<br><small class="muted"><i class="ti ti-ticket" aria-hidden="true"></i> ${activePack(a.id) ? esc(t('packLeftShort', { l: packsOf(a.id).reduce((s, k) => s + packLeft(k), 0) })) : esc(t('packNoneLeft'))}</small>` : ''}</div>
        <button class="btn small" data-action="ath-edit" data-uid="${esc(a.id)}">${esc(t(editing ? 'close' : 'athOpen'))}</button></div>`;
    if (!editing) return `<div class="card ath-card" id="ath-${esc(a.id)}">${head}</div>`;
    const s = seasonOf(todayStr());
    return `<div class="card ath-card" id="ath-${esc(a.id)}">${head}
      <form class="grid-form" data-form="ath-save" data-uid="${esc(a.id)}">
        <h3 class="span-all">${esc(t('athData'))}</h3>
        <p class="muted small span-all"><i class="ti ti-shield-lock" aria-hidden="true"></i> ${t('athDataNote')}</p>
        <label>${esc(t('athBirthPlace'))}<input name="birthPlace" maxlength="60" value="${esc(a.birthPlace || '')}"></label>
        <label>${esc(t('athBirthDate'))}<input type="date" name="birthDate" value="${esc(a.birthDate || '')}"></label>
        <label>${esc(t('athCity'))}<input name="city" maxlength="60" value="${esc(a.city || '')}"></label>
        <label>${esc(t('athAddress'))}<input name="address" maxlength="100" value="${esc(a.address || '')}" placeholder="${esc(t('athAddressPh'))}"></label>
        <label>${esc(t('athCf'))}<input name="cf" maxlength="16" value="${esc(a.cf || '')}" autocapitalize="characters" pattern="[A-Za-z0-9]{16}"></label>
        ${certTypeSelect(a.certType || '')}
        <label>${esc(t('certExp'))}<input type="date" name="certExp" value="${esc(a.certExp || '')}"></label>
        <label class="check span-all"><input type="checkbox" name="tess" ${a.tess && a.tess[s] ? 'checked' : ''}> ${esc(t('tessLabel', { s }))}</label>
        <div class="form-actions span-all"><button class="btn primary">${esc(t('save'))}</button></div>
      </form>
      <form class="grid-form" data-form="ath-trs" data-uid="${esc(a.id)}" data-m="${month}">${trChecks(a.id, month)}
        <div class="form-actions span-all"><button class="btn primary">${esc(t('athTrainingsSave'))}</button></div></form>
      ${p ? `<form class="grid-form" data-form="plan-price" data-uid="${esc(a.id)}" data-m="${month}">
        <h3 class="span-all">${esc(t('planTitle', { m: monthLabel(month) }))}</h3>
        <p class="span-all">${planLine}</p>
        <label>${esc(t('planPrice'))}<input type="number" name="price" min="0" step="0.01" value="${p.price != null ? p.price : ''}" inputmode="decimal"></label>
        <div class="form-actions span-all">${p.manual ? `<button type="button" class="btn" data-action="plan-auto" data-uid="${esc(a.id)}" data-m="${month}">${esc(t('planUseList', { p: euro(priceFor(p.n)) }))}</button>` : ''}
          <button class="btn primary">${esc(t('save'))}</button></div>
      </form>${payBox('month', p, a.id, p.price)}` : `<p class="muted small">${esc(t('planHint'))}</p>`}
      <div class="pack-box fitp-box"><h3><i class="ti ti-id-badge-2" aria-hidden="true"></i> ${esc(t('fitpTitle'))} ${esc(s)}</h3>
        <p class="muted small">${esc(t('fitpHelp'))}</p>${payBox('fitp', fitpObj(a.id, s), a.id, fitpPrice())}</div>
      ${packCard(a.id)}
      ${evalSummary(a.id)}
    </div>`;
  }
  // Valutazioni del corsista (admin e segreteria): media per voce (6 = sufficienza) e ultime schede con la nota.
  function evalSummary(uid) {
    const list = (S().evals || []).filter(e => e.uid === uid).sort((x, y) => y.date.localeCompare(x.date) || (y.at || 0) - (x.at || 0));
    const head = `<h3><i class="ti ti-clipboard-check" aria-hidden="true"></i> ${esc(t('evSumTitle'))}</h3>`;
    if (!list.length) return `<div class="ev-sum">${head}<p class="muted small">${esc(t('evSumNone'))}</p></div>`;
    const fmt = v => v.toLocaleString(I18n.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const rows = EV_KEYS.map(k => {
      const vs = list.map(e => (e.v || {})[k]).filter(x => x != null);
      const a = vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null;
      return `<li class="ev-avg ${a == null ? 'is-empty' : ''}"><span class="ev-avg-l">${esc(t('ev_' + k))}</span>
        <span class="ev-bar" aria-hidden="true"><i style="width:${a == null ? 0 : a * 10}%" class="${evClass(a == null ? null : Math.round(a * 10) / 10 < 6 ? 5 : 7)}"></i><b></b></span>
        <span class="ev-avg-v">${a == null ? '–' : `<strong class="${a < 6 ? 'low' : ''}">${esc(fmt(a))}</strong>`} <small class="muted">${esc(t('evSumN', { n: vs.length }))}</small></span></li>`;
    }).join('');
    const last = list.slice(0, 5).map(e => { const tr = trainingById(e.tid);
      return `<li><span class="reg-names"><strong>${esc(fmtDate(e.date))}</strong>${tr ? ` · ${esc(trTitle(tr))}` : ''}<br>
        ${EV_KEYS.filter(k => (e.v || {})[k] != null).map(k => `<span class="badge ev-mini ${evClass(e.v[k])}">${esc(t('evShort_' + k))} ${e.v[k]}</span>`).join(' ') || `<small class="muted">${esc(t('evNoVotes'))}</small>`}
        ${e.note ? `<br><small class="ev-note-txt">“${esc(e.note)}”</small>` : ''}</span></li>`; }).join('');
    return `<div class="ev-sum">${head}<p class="muted small">${esc(t('evSumHelp', { n: list.length }))}</p>
      <ul class="ev-avgs">${rows}</ul>
      <h4>${esc(t('evSumLast'))}</h4><ul class="reg-list">${last}</ul></div>`;
  }
  // Pacchetti del corsista (admin): elenco con allenamenti usati/rimasti e pagamento; nuovo pacchetto.
  function packCard(uid) {
    const ks = packsOf(uid).slice().reverse();
    return `<div class="pack-box"><h3><i class="ti ti-ticket" aria-hidden="true"></i> ${esc(t('packTitle'))}</h3>
      <p class="muted small">${esc(t('packHelp'))}</p>
      ${ks.length ? `<ul class="reg-list">${ks.map(k => `<li><span class="reg-names"><strong>${esc(t('packN', { n: k.n }))}</strong> · ${esc(euro(k.price))}
          <span class="badge ${packLeft(k) ? 'st-done' : 'st-full'}">${esc(t('packLeft', { l: packLeft(k), n: k.n }))}</span><br><small class="muted">${esc(t('packCreatedOn', { d: fmtDate(new Date(k.created || 0).toLocaleDateString('sv')) }))}</small>
          <form class="inline-form pack-from" data-form="pack-from" data-id="${esc(k.id)}"><label class="small">${esc(t('packFrom'))}<input type="date" name="from" value="${esc(packFrom(k))}" required></label><button class="btn small">${esc(t('save'))}</button></form>
          ${packUseList(k)}</span>
          ${!(k.used || 0) && !k.paid ? `<button class="btn small danger" data-action="pack-del" data-id="${esc(k.id)}">${esc(t('packDel'))}</button>` : ''}
          <div class="pay-wrap">${payBox('pack', k, uid, k.price)}</div></li>`).join('')}</ul>` : ''}
      <form class="inline-form" data-form="pack-new" data-uid="${uid}">
        <label class="small">${esc(t('packFrom'))}<input type="date" name="from" value="${todayStr()}" required></label>
        <label class="small">${esc(t('packNumber'))}<input type="number" name="n" min="1" max="100" step="1" required inputmode="numeric" style="width:5em"></label>
        <label class="small">${esc(t('packPrice'))}<input type="number" name="price" min="0" step="0.01" required inputmode="decimal" style="width:7em"></label>
        <button class="btn small primary"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('packNew'))}</button></form></div>`;
  }

  function pricesCard() {
    const p = S().prices || {};
    return `<form class="card grid-form" data-form="prices-save" id="prices">
      <h2 class="span-all"><i class="ti ti-currency-euro" aria-hidden="true"></i> ${esc(t('pricesTitle'))}</h2>
      <p class="muted small span-all">${esc(t('pricesHelp'))}</p>
      ${[1, 2, 3, 4].map(n => `<label>${esc(t('planN', { n }))}<input type="number" name="w${n}" min="0" step="0.01" value="${p['w' + n] != null ? p['w' + n] : ''}" inputmode="decimal"></label>`).join('')}
      ${[1, 2].map(n => `<label>${esc(t('priceQuarter', { n }))}<input type="number" name="q${n}" min="0" step="0.01" value="${p['q' + n] != null ? p['q' + n] : ''}" inputmode="decimal"></label>`).join('')}
      <label>${esc(t('priceSpot'))}<input type="number" name="spot" min="0" step="0.01" value="${p.spot != null ? p.spot : ''}" inputmode="decimal"></label>
      <h3 class="span-all">${esc(t('priceCourseTitle'))}</h3>
      <p class="muted small span-all">${esc(t('priceCourseHelp'))}</p>
      <label>${esc(t('priceCourseFrom'))}<input type="date" name="courseFrom" value="${esc(p.courseFrom || '')}"></label>
      <label>${esc(t('priceCourseTo'))}<input type="date" name="courseTo" value="${esc(p.courseTo || '')}"></label>
      ${[1, 2].map(n => `<label>${esc(t('priceCourse', { n }))}<input type="number" name="c${n}" min="0" step="0.01" value="${p['c' + n] != null ? p['c' + n] : ''}" inputmode="decimal"></label>`).join('')}
      <h3 class="span-all">${esc(t('fitpTitle'))}</h3>
      <label>${esc(t('priceFitp'))}<input type="number" name="fitp" min="0" step="0.01" value="${p.fitp != null ? p.fitp : ''}" inputmode="decimal"></label>
      <div class="form-actions span-all"><button class="btn primary">${esc(t('save'))}</button></div>
    </form>`;
  }

  // ---------- corsista: profilo e avvisi ----------
  // Quota del mese in corso: pagata (verde), da pagare entro il 10 (giallo), in ritardo dall'11 (rosso).
  const feeLine = pl => {
    if (!pl || pl.price === 0) return '';
    const st = payState(pl), ic = { paid: 'circle-check', due: 'clock', late: 'alert-triangle' }[st];
    return `<p class="note fee-${st}"><i class="ti ti-${ic}" aria-hidden="true"></i> ${esc(t({ paid: 'feePaid', due: 'feeDue', late: 'feeLate' }[st]))}</p>`;
  };
  function myTrainingCard(noNext) {
    const m = self();
    if (!m) return '';
    const a = athleteOf(m.uid), month = curMonth(), p = planOf(m.uid, month), pn = planOf(m.uid, shiftMonth(month, 1));
    const next = noNext ? '' : myNextTrainings();
    const ks = packsOf(m.uid), left = ks.reduce((s, k) => s + packLeft(k), 0);
    if (!a && !p && !pn && !next && !ks.length) return '';
    return `<div class="card" id="my-training">
      <h2><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('myTraining'))}</h2>
      ${a ? `<p>${tessBadge(a)} ${certBadge(a)}</p>` : ''}
      ${[[month, p], [shiftMonth(month, 1), pn]].filter(x => x[1]).map(([mo, pl]) => `<h4>${esc(monthLabel(mo))} · ${esc(t('planN', { n: pl.n }))}${pl.price != null ? ` · ${esc(euro(pl.price))}` : ''}</h4>
        <ul class="plain-list">${planDesc(pl).map(d => `<li><i class="ti ti-calendar-repeat" aria-hidden="true"></i> ${esc(d)}</li>`).join('')}</ul>${mo === month ? feeLine(pl) : ''}`).join('') || (ks.length ? '' : `<p class="muted small">${esc(t('planNoneMine'))}</p>`)}
      ${ks.length ? `<p class="note ${left ? 'ok' : 'warn'}"><i class="ti ti-ticket" aria-hidden="true"></i> ${esc(left ? t('packMine', { l: left }) : t('packMineEmpty'))}</p>${ks.map(packUseList).join('')}` : ''}
      ${next}
    </div>`;
  }
  // Avviso sul certificato: al corsista (in scadenza entro un mese o scaduto) e all'admin (quanti).
  // admin: a ogni accesso, avviso delle ricevute intestate a non tesserati
  function notTessAlert() {
    const n = notTessReceipts().length;
    return n ? `<div class="msg-alert" role="alert"><div class="msg-head"><strong><span class="tess-star" aria-hidden="true">★</span> ${esc(t('rcNotTessTitle', { n }))}</strong></div>
      <div class="msg-text">${esc(t('rcNotTessHelp'))}</div><a class="btn small" href="#/payments">${esc(t('payAdminTitle'))} →</a></div>` : '';
  }
  // Riepilogo dei certificati da rinnovare (admin e segreteria): scaduti e entro 7 giorni in rosso, entro 30 in arancio.
  function certSummary(kind) {
    const all = S().athletes || [], k = st => all.filter(a => certState(a) === st).length;
    const ex = k('expired'), d7 = k('d7'), d30 = k('d30');
    if (!ex && !d7 && !d30) return '';
    const chips = [ex ? `<span class="badge cert-expired">${esc(t('certSumExpired', { n: ex }))}</span>` : '', d7 ? `<span class="badge cert-d7">${esc(t('certSumD7', { n: d7 }))}</span>` : '',
      d30 ? `<span class="badge cert-d30">${esc(t('certSumD30', { n: d30 }))}</span>` : ''].filter(Boolean).join(' ');
    if (kind === 'note') return `<p class="note ${ex || d7 ? 'cert-red' : 'warn'} cert-sum"><i class="ti ti-heart-exclamation" aria-hidden="true"></i> ${chips} <a href="#/athletes/cert">${esc(t('certSee'))} →</a></p>`;
    return `<div class="msg-alert ${ex || d7 ? 'danger' : ''}" role="alert"><div class="msg-head"><strong><i class="ti ti-heart-exclamation" aria-hidden="true"></i> ${esc(t('certTitle'))}</strong></div>
      <div class="msg-text">${chips}<br><small>${esc(t('certSumHelp'))}</small></div><a class="btn small" href="#/athletes/cert">${esc(t('certSee'))} →</a></div>`;
  }
  function certAlerts() {
    if (admin()) return certSummary('alert') + notTessAlert();
    const m = member(), a = m && athleteOf(m.uid), st = certState(a);
    if (!certDue(a)) return '';
    return `<div class="msg-alert ${st === 'd30' ? '' : 'danger'}" role="alert"><div class="msg-head"><strong><i class="ti ti-heart-exclamation" aria-hidden="true"></i> ${esc(t('certTitle'))}</strong></div>
      <div class="msg-text">${esc(t(st === 'expired' ? 'certExpiredMsg' : 'certSoonMsg', { d: fmtDate(a.certExp), n: certDays(a) }))}</div></div>`;
  }

  // ---------- salvataggi ----------
  function trSave(f) {
    const old = f.dataset.id ? trainingById(f.dataset.id) : null;
    const kindEl = f.querySelector('[name=kind]:checked') || f.querySelector('[name=kind]');
    const extra = kindEl && kindEl.value === 'extra';
    const d = { name: f.name.value.trim(), dow: +f.dow.value, from: f.from.value, to: f.to.value, level: f.level.value,
      max: Math.max(1, parseInt(f.max.value, 10) || 1), coachUid: f.coachUid.value, courts: [...f.querySelectorAll('[name=court]:checked')].map(x => x.value) };
    if (!old) ui.trDraft = Object.assign({}, d, { kind: extra ? 'extra' : 'weekly', date: f.date ? f.date.value : '', copyFrom: f.copyFrom ? f.copyFrom.value : '' });
    if (d.to <= d.from) return warn('fpTimeErr');
    if (extra) return trSaveExtra(f, old, d);
    d.reason = `${t('navTrain')} · ${d.name || t('fpLevel_' + d.level)}${d.coachUid ? ' · ' + coachName(d.coachUid) : ''}`;
    // campi: niente sovrapposizioni con altri blocchi ricorrenti; avviso se ci sono prenotazioni future
    const mineR = new Set((old ? old.courts || [] : []).map(c => `t_${esc(old.id)}_${c}`));
    const clash = d.courts.filter(c => (S().recurring || []).some(r => !mineR.has(r.id) && r.courtId === c && r.dow === d.dow && r.from < d.to && d.from < r.to));
    if (clash.length) return warn('trCourtBusy', { c: clash.map(courtName).join(', ') });
    const today = todayStr();
    const busy = (S().bookings || []).filter(b => !b.recurring && d.courts.includes(b.courtId) && b.date >= today && dow(b.date) === d.dow && b.from < d.to && d.from < b.to);
    if (busy.length && !confirmed('trBookingsClash', { n: busy.length })) return;
    const groups = old ? (S().groups || []).filter(g => g.tid === old.id) : [];
    window.Cloud.saveTraining(old, d, groups).then(() => {
      if (old) ui.trEdit = null; else { (ui.keep || {})['tr-new'] = false; ui.trDraft = null; }
      ui.flash = { text: t(old ? 'trSaved' : 'trCreated') };
      render();
    }).catch(e => warn('regError', { code: e.code || e.message }));
  }

  // Recupero allenamento: una sola data; campi bloccati solo quel giorno; corsisti copiati da un altro allenamento.
  function trSaveExtra(f, old, d) {
    const date = f.date.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return warn('trExtraNeedDate');
    if (!old && date < todayStr()) return warn('trExtraPast');
    Object.assign(d, { date, dow: dow(date) });
    d.reason = `${t('trExtraBadge')} · ${d.name || t('fpLevel_' + d.level)}${d.coachUid ? ' · ' + coachName(d.coachUid) : ''}`;
    // campi: niente blocchi ricorrenti (altri allenamenti) né prenotazioni in quell'orario di quel giorno
    const clashR = d.courts.filter(c => (S().recurring || []).some(r => r.courtId === c && r.dow === d.dow && r.from < d.to && d.from < r.to));
    if (clashR.length) return warn('trCourtBusy', { c: clashR.map(courtName).join(', ') });
    const mine = old ? `trx_${esc(old.id)}_` : null;
    const clashB = (S().bookings || []).filter(b => !b.recurring && d.courts.includes(b.courtId) && b.date === date && b.from < d.to && d.from < b.to && !(mine && String(b.id).startsWith(mine)));
    if (clashB.length) return warn('trExtraBooked', { c: [...new Set(clashB.map(b => `${courtName(b.courtId)} ${esc(b.from)}–${esc(b.to)}`))].join(', ') });
    const src = !old && f.copyFrom && f.copyFrom.value ? trainingById(f.copyFrom.value) : null;
    const month = date.slice(0, 7);
    window.Cloud.saveTraining(old, d, old ? (S().groups || []).filter(g => g.tid === old.id) : []).then(id => {
      if (!src) return 0;
      // gruppo del mese dell'allenamento sorgente (se non c'è ancora, quello del mese precedente)
      const sg = groupOf(src.id, month) || groupOf(src.id, shiftMonth(month, -1));
      if (!sg || !(sg.uids || []).length) return 0;
      const g = { id: `${id}_${month}`, tid: id, month, uids: sg.uids.slice(), names: Object.assign({}, sg.names || {}), coachUid: d.coachUid || '', updated: Date.now(), from: src.id };
      return window.Cloud.saveGroups([g], [], [], g.uids.map(uid => ({ tid: id, date, uid, on: true }))).then(() => g.uids.length);
    }).then(n => {
      if (old) ui.trEdit = null; else { (ui.keep || {})['tr-new'] = false; ui.trDraft = null; }
      ui.trMonth = month;
      ui.flash = { text: n ? t('trExtraCopied', { n, s: trTitle(src) }) : t(old ? 'trSaved' : 'trExtraCreated') };
      render();
    }).catch(e => warn('regError', { code: e.code || e.message }));
  }

  // Aggiunge o toglie un corsista dal gruppo del mese, aggiornando il suo piano (e la scheda).
  function grpChange(tid, month, uid, add, athleteData) {
    const tr = trainingById(tid);
    if (!tr) return;
    const cur = groupOf(tid, month) || { id: `${tid}_${month}`, tid, month, uids: [], names: {} };
    const g = Object.assign({}, cur, { uids: (cur.uids || []).slice(), names: Object.assign({}, cur.names || {}), coachUid: tr.coachUid || '' });
    if (add) { if (!g.uids.includes(uid)) g.uids.push(uid); const m = memberByUid(uid); if (m) g.names[uid] = personName(m); }
    else { g.uids = g.uids.filter(x => x !== uid); delete g.names[uid]; }
    g.updated = Date.now();
    const all = (S().groups || []).filter(x => x.id !== g.id).concat([g]);
    const plan = planFrom(uid, month, all);
    const xm = isExtraTr(tr) ? [{ tid, date: tr.date, uid, on: !!add }] : [];
    return window.Cloud.saveGroups([g], plan ? [plan] : [], athleteData ? [athleteData] : [], xm);
  }

  // Spunte degli allenamenti del corsista per un mese (scheda corsista: creazione e modifica).
  function trChecks(uid, month) {
    const list = weeklyTrainings();
    if (!list.length) return `<p class="muted small span-all">${esc(t('trNone'))}</p>`;
    return `<fieldset class="span-all fp-levels tr-checks"><legend>${esc(t('athTrainings', { m: monthLabel(month) }))}</legend>
      ${list.map(tr => { const g = groupOf(tr.id, month), n = g ? (g.uids || []).length : 0, on = !!(uid && g && (g.uids || []).includes(uid));
        return `<label class="check"><input type="checkbox" name="tid" value="${esc(tr.id)}" ${on ? 'checked' : ''}> ${esc(trTitle(tr))} · ${esc(trLabel(tr))} <small class="muted">(${n}/${tr.max})</small></label>`; }).join('')}
      <small class="muted span-all">${esc(t('athTrainingsHelp'))}</small></fieldset>`;
  }
  // Mette il corsista esattamente negli allenamenti scelti per il mese (aggiunge e toglie dai gruppi), con il piano.
  function setAthleteTrainings(uid, month, tids, athleteData) {
    const m = memberByUid(uid), changed = [], full = [];
    trainings().forEach(tr => {
      const cur = groupOf(tr.id, month), has = !!(cur && (cur.uids || []).includes(uid)), want = tids.includes(tr.id);
      if (has === want) return;
      const g = Object.assign({ id: `${esc(tr.id)}_${month}`, tid: tr.id, month }, cur || {}, { uids: ((cur && cur.uids) || []).slice(), names: Object.assign({}, (cur && cur.names) || {}), coachUid: tr.coachUid || '', updated: Date.now() });
      if (want) { if (g.uids.length >= tr.max) full.push(trTitle(tr)); g.uids.push(uid); if (m) g.names[uid] = personName(m); }
      else { g.uids = g.uids.filter(x => x !== uid); delete g.names[uid]; }
      changed.push(g);
    });
    if (full.length && !confirmed('grpFullConfirmList', { l: full.join(', ') })) return Promise.resolve(false);
    if (!changed.length && !athleteData) return Promise.resolve(true);
    const all = (S().groups || []).filter(x => !changed.some(g => g.id === x.id)).concat(changed);
    const plan = changed.length ? planFrom(uid, month, all) : null;
    return window.Cloud.saveGroups(changed, plan ? [plan] : [], athleteData ? [athleteData] : []).then(() => true);
  }

  // ---------- presenze, spot e recuperi ----------
  // Ogni giorno il corsista del gruppo risponde presente/assente (entro le 13). Posti spot liberi:
  // massimo − presenti − spot confermati − (prima delle 13) chi non ha ancora risposto.
  const occOf = (tid, date) => (S().occ || []).find(o => o.tid === tid && o.date === date) || (ui.trPast && ui.trPast.day === date && ui.trPast.occ.find(o => o.tid === tid)) || undefined;
  const groupSize = (tr, month, date) => { if (date && extraDay(date, tr)) return ((occOf(tr.id, date) || {}).members || []).length; const n = (tr.sizes || {})[month]; if (n != null) return n; const g = groupOf(tr.id, month); return g ? (g.uids || []).length : 0; };
  const afterNoon = date => date < todayStr() || (date === todayStr() && nowHM() >= '13:00');   // termine per rispondere: ore 13
  const trStartMs = (tr, date) => new Date(`${date}T${esc(tr.from)}`).getTime();
  const spotOpen = (tr, date) => Date.now() < trStartMs(tr, date) - 3600000;   // candidature fino a un'ora prima
  // Posti spot: li decide l'admin giorno per giorno (occ.free); restano quelli non ancora assegnati a spot confermati.
  function spotsFree(tr, date) {
    const o = occOf(tr.id, date) || {};
    if (o.cancelled) return 0;
    // admin: il numero esatto; gli altri sanno solo se ci sono posti (occ.open)
    if (admin()) return Math.max(0, (Number((S().occfree || {})[`${esc(tr.id)}_${date}`]) || 0) - (o.s || 0));
    return o.open ? 1 : 0;
  }
  // suggerimento per l'admin (vecchio calcolo): massimo − presenti − spot − chi non ha ancora risposto (prima delle 13)
  function spotsSuggested(tr, date) {
    const o = occOf(tr.id, date) || {};
    const n = groupSize(tr, date.slice(0, 7), date), p = o.p || 0, a = o.a || 0, s = o.s || 0;
    return Math.max(0, (tr.max || 0) - p - s - (afterNoon(date) ? 0 : Math.max(0, n - p - a)));
  }
  // numero dei posti liberi: solo l'admin; gli altri vedono "posti spot disponibili"
  const freeBadge = (tr, date) => `<span class="badge st-done">${esc(admin() ? t('spotFree', { n: spotsFree(tr, date) }) : t('spotAvail'))}</span>`;
  // allenamenti nei giorni [from, from + days)
  // allenamenti del periodo (quelli eliminati solo per un giorno, quel giorno non ci sono)
  const occurrences = (from, days, list) => { const out = []; for (let i = 0; i < days; i++) { const d = addDays(from, i), w = dow(d); (list || trainings()).filter(tr => tr.dow === w && (!tr.date || tr.date === d) && !(occOf(tr.id, d) || {}).removed).forEach(tr => out.push({ tr, date: d })); } return out; };
  const attOf = (tid, date, uid) => (S().att || []).find(x => x.tid === tid && x.date === date && x.uid === uid) || (ui.trPast && ui.trPast.day === date && ui.trPast.att.find(x => x.tid === tid && x.uid === uid)) || undefined;
  const spotOf = (tid, date, uid) => (S().spots || []).find(x => x.tid === tid && x.date === date && x.uid === uid);
  // 5° lunedì/martedì/… del mese (giorno 29, 30 o 31): fuori abbonamento, niente gruppo, tutti i posti sono spot
  // (i recuperi allenamento valgono in qualsiasi giorno del mese)
  const extraDay = (date, tr) => !isExtraTr(tr) && +date.slice(8, 10) > 28;
  const inMyGroup = (tr, date) => { const m = self(); if (!m) return false;
    if (isExtraTr(tr)) return tr.date === date && (((groupOf(tr.id, date.slice(0, 7)) || {}).uids || []).includes(m.uid) || (S().xmem || []).some(x => x.tid === tr.id && x.uid === m.uid));
    if (extraDay(date, tr)) return ((occOf(tr.id, date) || {}).members || []).includes(m.uid);   // 5° allenamento: corsisti copiati dal gruppo
    const p = planOf(m.uid, date.slice(0, 7)); return !!(p && (p.tids || []).includes(tr.id)); };
  const occLabel = (tr, date) => `${isExtraTr(tr) ? t('trExtraBadge') + ' · ' : ''}${trTitle(tr)} · ${longDate(date)} ${esc(tr.from)}–${esc(tr.to)}`;
  // stato della presenza: verde confermata, rosso assente, grigio in attesa, arancione no reply (scaduto il termine)
  const attChip = (st, date) => { const k = st === 'in' ? 'in' : st === 'out' ? 'out' : afterNoon(date) ? 'late' : 'wait';
    return `<span class="badge att-chip att-${k}">${esc(t({ in: 'attIn', out: 'attOut', wait: 'attNone', late: 'attNoneAbsent' }[k]))}</span>`; };
  // prossimo allenamento del mese mostrato (da oggi in poi; il 5° giorno del mese è solo spot)
  const nextOcc = (tr, month) => { if (isExtraTr(tr)) return tr.date.slice(0, 7) === month ? tr.date : null; let d = month === curMonth() ? todayStr() : month > curMonth() ? month + '-01' : null; if (!d) return null;
    for (; d.slice(0, 7) === month; d = addDays(d, 1)) if (dow(d) === tr.dow && !extraDay(d)) return d; return null; };
  const attButtons = (tr, date, cur) => `<div class="btn-row att-btns">
      <button class="btn ${cur === 'in' ? 'primary' : ''}" data-action="att-set" data-tid="${esc(tr.id)}" data-date="${date}" data-st="in"><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('attPresent'))}</button>
      <button class="btn ${cur === 'out' ? 'danger' : ''}" data-action="att-set" data-tid="${esc(tr.id)}" data-date="${date}" data-st="out"><i class="ti ti-x" aria-hidden="true"></i> ${esc(t('attAbsent'))}</button>
      ${cur ? `<button class="btn small" data-action="att-set" data-tid="${esc(tr.id)}" data-date="${date}" data-st=""><i class="ti ti-arrow-back-up" aria-hidden="true"></i> ${esc(t('attUndo'))}</button>` : ''}</div>`;

  // Avvisi in prima pagina per il corsista: conferma di oggi, allenamenti annullati, esito di spot e recuperi.
  function trainingAlerts() {
    const m = self();
    if (!m) return '';
    const today = todayStr(), out = [];
    occurrences(today, 1).filter(o => inMyGroup(o.tr, o.date) && !(occOf(o.tr.id, o.date) || {}).cancelled && !attOf(o.tr.id, o.date, m.uid)).forEach(({ tr, date }) => {
      out.push(`<div class="msg-alert att-alert" role="alert"><div class="msg-head"><strong><i class="ti ti-hand-finger" aria-hidden="true"></i> ${esc(t('attTodayTitle'))}</strong></div>
        <div class="msg-text">${esc(occLabel(tr, date))}${afterNoon(date) ? `<br><small>${esc(t('attLate'))}</small>` : `<br><small>${esc(t('attBy12'))}</small>`}</div>${attButtons(tr, date, '')}</div>`);
    });
    occurrences(today, 2).filter(o => (occOf(o.tr.id, o.date) || {}).cancelled && (inMyGroup(o.tr, o.date) || (spotOf(o.tr.id, o.date, m.uid) || {}).status === 'ok')).forEach(({ tr, date }) => {
      const o = occOf(tr.id, date);
      out.push(`<div class="msg-alert danger" role="alert"><div class="msg-head"><strong><i class="ti ti-calendar-off" aria-hidden="true"></i> ${esc(t('occCancelledTitle'))}</strong></div>
        <div class="msg-text">${esc(occLabel(tr, date))}${o.note ? `<br>${esc(o.note)}` : ''}</div></div>`);
    });
    (S().spots || []).filter(sp => sp.uid === m.uid && sp.status !== 'pending' && !sp.seen).forEach(sp => {
      const tr = trainingById(sp.tid), ok = sp.status === 'ok';
      out.push(`<div class="msg-alert ${ok ? 'ok' : 'danger'}" role="alert"><div class="msg-head"><strong><i class="ti ti-${ok ? 'circle-check' : 'circle-x'}" aria-hidden="true"></i> ${esc(t(ok ? (sp.recovery ? 'recoveryOk' : 'spotOk') : 'spotNo'))}</strong></div>
        <div class="msg-text">${esc(tr ? occLabel(tr, sp.date) : sp.date)}${ok ? `<br>${esc(sp.pack ? t('packUsedMine', { l: (S().packs || []).filter(k => k.uid === m.uid).reduce((s, k) => s + packLeft(k), 0) }) : t('spotPrice', { p: euro(sp.price || 0) }))}` : ''}</div>
        <button class="btn small" data-action="spot-seen" data-id="${esc(sp.id)}">${esc(t('chAckRevoke'))}</button></div>`);
    });
    return out.join('');
  }

  // Posti spot disponibili nei prossimi 7 giorni (tutti li vedono; si candidano gli utenti registrati).
  function spotSection(home) {
    const m = self();
    const list = occurrences(todayStr(), 7).filter(({ tr, date }) => spotOpen(tr, date) && !(m && inMyGroup(tr, date))
      && (spotsFree(tr, date) > 0 || (m && spotOf(tr.id, date, m.uid))));
    if (home && !list.length) return '';
    const card = ({ tr, date }) => {
      const free = spotsFree(tr, date), mine = m && spotOf(tr.id, date, m.uid);
      let act = '';
      if (mine) act = mine.status === 'pending' ? `<p class="note">${esc(t('spotPending'))}</p><button class="btn small" data-action="spot-withdraw" data-id="${esc(mine.id)}">${esc(t('spotWithdraw'))}</button>`
        : `<p class="note ${mine.status === 'ok' ? 'ok' : 'warn'}">${esc(t(mine.status === 'ok' ? 'spotOk' : 'spotNo'))}</p>`;
      else if (!m) act = admin() ? '' : `<a class="btn small" href="#/settings">${esc(t('loginOrRegister'))}</a>`;
      else if (needsVerify()) act = `<p class="note warn">${esc(t('verifyFirst'))}</p>`;
      else act = `<button class="btn primary" data-action="spot-apply" data-tid="${esc(tr.id)}" data-date="${date}"><i class="ti ti-hand-finger" aria-hidden="true"></i> ${esc(t('spotApply'))}</button>`;
      return `<div class="card tr-card spot-card" id="spot-${esc(tr.id)}-${date}">
        <div class="ch-head"><span class="badge lvl-${tr.level}">${esc(t('fpLevel_' + tr.level))}</span> ${free > 0 ? freeBadge(tr, date) : ''}</div>
        <h3>${esc(trTitle(tr))}</h3>
        <p class="muted cap"><i class="ti ti-calendar" aria-hidden="true"></i> ${esc(longDate(date))} · ${esc(tr.from)}–${esc(tr.to)}</p>
        ${tr.coachUid ? `<p class="muted small"><i class="ti ti-school" aria-hidden="true"></i> ${esc(coachName(tr.coachUid))}</p>` : ''}
        <p class="muted small">${esc(m && activePack(m.uid) ? t('spotPackInfo') : t('spotPriceInfo', { p: euro((S().prices || {}).spot) }))}</p>
        ${act}</div>`;
    };
    return `<section class="feat-block" id="spots">
      <div class="page-head row"><h2><i class="ti ti-ticket" aria-hidden="true"></i> ${esc(t('spotTitle'))}</h2></div>
      ${list.length ? `<div class="tr-grid">${list.map(card).join('')}</div>` : `<p class="muted">${esc(t('spotNone'))}</p>`}</section>`;
  }

  // I prossimi allenamenti del corsista (7 giorni): stato e risposta.
  function myNextTrainings() {
    const m = self();
    if (!m) return '';
    const list = occurrences(todayStr(), 7).filter(o => inMyGroup(o.tr, o.date) && Date.now() < trStartMs(o.tr, o.date) + 3600000);
    const spots = (S().spots || []).filter(sp => sp.uid === m.uid && sp.date >= todayStr()).sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length && !spots.length) return '';
    return `<h4>${esc(t('myNext7'))}</h4>
      <ul class="reg-list">${list.map(({ tr, date }) => {
        const o = occOf(tr.id, date) || {}, a = attOf(tr.id, date, m.uid);
        return `<li><span class="reg-names"><strong>${esc(occLabel(tr, date))}</strong><br>${o.cancelled ? `<span class="badge st-full">${esc(t('occCancelled'))}</span>` : attChip(a && a.status, date)}</span>
          ${o.cancelled ? '' : attButtons(tr, date, a && a.status)}</li>`;
      }).join('')}
      ${spots.map(sp => { const tr = trainingById(sp.tid); return tr ? `<li><span class="reg-names"><strong>${esc(occLabel(tr, sp.date))}</strong><br>
        <span class="badge ${sp.status === 'ok' ? 'st-done' : sp.status === 'no' ? 'st-full' : ''}">${esc(t(sp.recovery ? 'recoveryBadge' : 'spotBadge'))} · ${esc(t('spotSt_' + sp.status))}</span></span></li>` : ''; }).join('')}</ul>`;
  }

  // ---------- giornata (admin e coach): presenze, spot, recuperi, annullamento ----------
  // Presenze: per giorno (scelto con le frecce o dal calendario) o per mese (elenco di tutti gli allenamenti del mese).
  function trainingDay() {
    const view = ui.trView === 'month' ? 'month' : 'day';
    const seg = `<div class="segmented" role="group">
        <button data-action="tr-view" data-v="day" aria-pressed="${view === 'day'}"><i class="ti ti-calendar-event" aria-hidden="true"></i> ${esc(t('trViewDay'))}</button>
        <button data-action="tr-view" data-v="month" aria-pressed="${view === 'month'}"><i class="ti ti-calendar-month" aria-hidden="true"></i> ${esc(t('trViewMonth'))}</button></div>`;
    if (view === 'month') return seg + trainingMonth();
    const day = ui.trDay || todayStr();
    // giorni passati oltre quelli già caricati: presenze e giornate lette dal database (admin)
    if (admin() && day < addDays(todayStr(), -1)) { const d = rangeData(day, day); ui.trPast = d ? { day, occ: d.occ, att: d.att } : null; } else ui.trPast = null;
    const all = visibleTrainings().filter(tr => tr.dow === dow(day) && (!tr.date || tr.date === day));
    const list = all.filter(tr => !(occOf(tr.id, day) || {}).removed), gone = all.filter(tr => (occOf(tr.id, day) || {}).removed);
    const goneRow = gone.length ? `<div class="card tr-removed"><h4><i class="ti ti-calendar-x" aria-hidden="true"></i> ${esc(t('occRemovedTitle'))}</h4><ul class="reg-list">${gone.map(tr => `<li><span class="reg-names"><strong>${esc(trTitle(tr))}</strong> · ${esc(tr.from)}–${esc(tr.to)}</span>
        ${centerAdm() ? `<button class="btn small" data-action="occ-restore" data-tid="${esc(tr.id)}" data-date="${day}">${esc(t('occRestore'))}</button>` : ''}</li>`).join('')}</ul></div>` : '';
    return `${seg}<div class="month-nav card">
        <button class="btn small" data-action="tr-day" data-d="${addDays(day, -1)}" aria-label="${esc(t('prevDay'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong class="cap">${esc(longDate(day))}</strong>
        <button class="btn small" data-action="tr-day" data-d="${addDays(day, 1)}" aria-label="${esc(t('nextDay'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        <label class="tr-pick"><span class="sr-only">${esc(t('trPickDay'))}</span><input type="date" value="${day}" data-change="tr-date" aria-label="${esc(t('trPickDay'))}"></label>
        ${day !== todayStr() ? `<button class="btn small" data-action="tr-day" data-d="${todayStr()}">${esc(t('trToday'))}</button>` : ''}
      </div>
      ${list.length ? `<div class="tr-grid">${list.map(tr => occCard(tr, day)).join('')}</div>` : `<div class="empty"><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('trNoneDay'))}</div>`}${goneRow}`;
  }
  function trainingMonth() {
    const month = ui.trDayMonth || (ui.trDay || todayStr()).slice(0, 7);
    const from = month + '-01', to = monthEnd(month), n = +to.slice(8, 10);
    const today = todayStr(), all = occurrences(from, n, visibleTrainings());
    // di default solo gli allenamenti da oggi in poi; quelli passati si mostrano a richiesta
    const pastN = all.filter(o => o.date < today).length;
    const occs = ui.trShowPast ? all : all.filter(o => o.date >= today);
    const pastBtn = pastN ? `<p><button class="btn small" data-action="tr-past"><i class="ti ti-history" aria-hidden="true"></i> ${esc(t(ui.trShowPast ? 'trHidePast' : 'trShowPast', { n: pastN }))}</button></p>` : '';
    const d = admin() ? rangeData(from, to) : { att: S().att || [], spots: S().spots || [], occ: S().occ || [] };
    const nav = `<div class="month-nav card">
        <button class="btn small" data-action="tr-dmonth" data-m="${shiftMonth(month, -1)}" aria-label="${esc(t('prevMonth'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong>${esc(monthLabel(month))}</strong>
        <button class="btn small" data-action="tr-dmonth" data-m="${shiftMonth(month, 1)}" aria-label="${esc(t('nextMonth'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        <label class="tr-pick"><span class="sr-only">${esc(t('trPickMonth'))}</span><input type="month" value="${month}" data-change="tr-dmonth-pick" aria-label="${esc(t('trPickMonth'))}"></label>
      </div>`;
    if (!d) return nav + `<div class="empty"><i class="ti ti-loader-2" aria-hidden="true"></i> ${esc(t('rpLoading'))}</div>`;
    if (!occs.length) return nav + pastBtn + `<div class="empty"><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t(pastN ? 'trNoneMonthLeft' : 'trNoneMonth'))}</div>`;
    const cnt = (tid, date) => {
      const at = d.att.filter(a => a.tid === tid && a.date === date), sp = d.spots.filter(s => s.tid === tid && s.date === date && s.status === 'ok');
      const o = d.occ.find(x => x.tid === tid && x.date === date) || {};
      return { p: at.filter(a => a.status === 'in').length, a: at.filter(a => a.status === 'out').length, s: sp.length, cancelled: !!o.cancelled };
    };
    const byDay = new Map();
    occs.forEach(o => { (byDay.get(o.date) || byDay.set(o.date, []).get(o.date)).push(o); });
    return nav + pastBtn + `<div class="card tr-month-list">${[...byDay.entries()].map(([date, list]) => `<div class="tr-month-day ${date === today ? 'is-today' : ''}">
        <button class="linkish tr-month-date cap" data-action="tr-day" data-d="${date}" data-to-day="1">${esc(longDate(date))}</button>
        <ul class="plain-list">${list.sort((x, y) => x.tr.from.localeCompare(y.tr.from)).map(({ tr }) => { const c = cnt(tr.id, date); return `<li class="${isExtraTr(tr) ? 'tr-extra-row' : ''}">
          <button class="linkish" data-action="tr-day" data-d="${date}" data-to-day="1">${esc(tr.from)}–${esc(tr.to)} · <strong>${esc(trTitle(tr))}</strong></button>
          ${extraBadge(tr)}${tr.coachUid ? ` <small class="muted">${esc(coachName(tr.coachUid))}</small>` : ''}
          ${c.cancelled ? `<span class="badge st-full">${esc(t('occCancelled'))}</span>` : `<small class="muted">${esc(t('trMonthCounts', { p: c.p, a: c.a, s: c.s }))}</small>`}</li>`; }).join('')}</ul></div>`).join('')}</div>`;
  }


  // ---------- scheda di valutazione dell'allenamento (decisa dal titolare) ----------
  // Per ogni corsista 7 voci con voto da 1 a 10 (6 = sufficienza), tutte facoltative, e la nota del giorno.
  // La compilano l'allenatore di quell'allenamento, l'admin e la segreteria; il corsista non la vede.
  const EV_KEYS = ['tec', 'mov', 'ctl', 'sce', 'int', 'att', 'con'];
  const evalOf = (tid, date, uid) => (S().evals || []).find(e => e.tid === tid && e.date === date && e.uid === uid);
  // l'allenatore di quell'allenamento segna le presenze e compila la scheda; admin e segreteria sempre
  const canMark = tr => centerAdm() || !!(tr && coach() && tr.coachUid === myUid());
  const canEval = tr => admin() || !!(tr && coach() && tr.coachUid === myUid());
  // bottone in fondo alla giornata di allenamento
  function evalCta(tr, date, o, uids) {
    if (!canEval(tr) || o.cancelled || date > todayStr() || !uids.length) return '';
    const done = uids.filter(u => evalOf(tr.id, date, u)).length;
    return `<div class="ev-cta"><a class="btn primary ev-btn" href="#/eval/${encodeURIComponent(tr.id)}/${date}"><i class="ti ti-clipboard-check" aria-hidden="true"></i> ${esc(t('evOpen'))}</a>
      <small class="muted">${esc(done ? t('evDoneN', { n: done, m: uids.length }) : t('evNoneYet'))}</small></div>`;
  }
  const evClass = v => (v == null ? '' : v < 6 ? 'low' : v === 6 ? 'pass' : 'good');
  function evRow(uid, k, cur) {
    return `<div class="ev-row" data-uid="${uid}" data-k="${k}">
      <div class="ev-label"><strong>${esc(t('ev_' + k))}</strong><small>${esc(t('evHint_' + k))}</small></div>
      <div class="ev-votes" role="group" aria-label="${esc(t('ev_' + k))}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n =>
        `<button type="button" class="ev-v ${n < 6 ? 'is-low' : n === 6 ? 'is-pass' : ''}" data-action="ev-vote" data-uid="${uid}" data-k="${k}" data-n="${n}" aria-pressed="${cur === n}">${n}</button>`).join('')}</div>
      <span class="ev-val ${evClass(cur)}" aria-live="polite">${cur != null ? cur : '–'}</span></div>`;
  }
  function evCard(tr, date, uid, name, st) {
    const d = evDraft(tr.id, date, uid);
    return `<section class="card ev-card" id="ev-${uid}" data-uid="${uid}">
      <div class="ev-head"><h3>${esc(name)}</h3>${st ? attChip(st, date) : ''}<span class="badge ev-count" data-ev-count="${uid}">${esc(t('evCount', { n: Object.keys(d.v).length }))}</span></div>
      ${EV_KEYS.map(k => evRow(uid, k, d.v[k])).join('')}
      <label class="ev-note">${esc(t('evNote'))}<input name="note" data-uid="${uid}" maxlength="160" value="${esc(d.note || '')}" placeholder="${esc(t('evNotePh'))}" autocomplete="off"></label>
      <div class="btn-row"><button type="button" class="btn primary" data-action="ev-save" data-uid="${uid}"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${esc(t('evSaveOne', { n: name.split(' ').slice(-1)[0] }))}</button></div>
    </section>`;
  }
  // bozza della scheda (finché non si salva): parte da quella già salvata
  function evDraft(tid, date, uid) {
    ui.ev = ui.ev && ui.ev.key === `${tid}_${date}` ? ui.ev : { key: `${tid}_${date}`, d: {} };
    if (!ui.ev.d[uid]) { const e = evalOf(tid, date, uid); ui.ev.d[uid] = { v: Object.assign({}, (e && e.v) || {}), note: (e && e.note) || '', dirty: false }; }
    return ui.ev.d[uid];
  }
  function viewEval(tid, date) {
    const tr = trainingById(tid);
    const back = `<a class="back" href="#/train">← ${esc(t('navTrain'))}</a>`;
    // tornando ad Allenamenti si riapre la stessa giornata
    if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) Object.assign(ui, { trDay: date, trView: 'day', trTab: 'day' });
    if (!tr || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !canEval(tr)) return `<div class="page-head">${back}</div><div class="empty"><i class="ti ti-lock" aria-hidden="true"></i> ${esc(t('evNoAccess'))}</div>`;
    const o = occOf(tr.id, date) || {}, g = groupOf(tr.id, date.slice(0, 7)), names = (g && g.names) || {};
    const uids = extraDay(date, tr) ? (o.members || []) : ((g && g.uids) || []);
    const name = uid => names[uid] || coachName(uid);
    const present = uids.filter(u => (attOf(tr.id, date, u) || {}).status === 'in'), others = uids.filter(u => !present.includes(u));
    const byName = (a, b) => name(a).localeCompare(name(b));
    return `<div class="page-head">${back}
        <h1><i class="ti ti-clipboard-check" aria-hidden="true"></i> ${esc(t('evTitle'))}</h1>
        <p class="muted cap">${esc(trTitle(tr))} · ${esc(longDate(date))} ${esc(tr.from)}–${esc(tr.to)}${tr.coachUid ? ` · <i class="ti ti-school" aria-hidden="true"></i> ${esc(coachName(tr.coachUid))}` : ''}</p></div>
      <div class="card ev-help">
        <p><strong><i class="ti ti-info-circle" aria-hidden="true"></i> ${esc(t('evScale'))}</strong></p>
        <p class="muted small">${esc(t('evTip'))}</p>
        <p class="muted small">${esc(t('evTapAgain'))}</p>
      </div>
      ${o.cancelled ? `<p class="note warn">${esc(t('occCancelled'))}</p>` : ''}
      ${!uids.length ? `<div class="empty"><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('evNoTrainees'))}</div>` : present.length ? present.slice().sort(byName).map(u => evCard(tr, date, u, name(u), 'in')).join('') : `<p class="note">${esc(t('evNoPresent'))}</p>`}
      ${others.length ? `<details class="card sub-form ev-others" data-keep="ev-others" ${present.length ? keepOpen('ev-others') : 'open'}><summary><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('evOthers', { n: others.length }))}</summary>
        ${others.slice().sort(byName).map(u => evCard(tr, date, u, name(u), (attOf(tr.id, date, u) || {}).status || '')).join('')}</details>` : ''}
      <div class="ev-savebar"${uids.length ? '' : ' hidden'}><button type="button" class="btn primary" data-action="ev-save-all" data-tid="${esc(tr.id)}" data-date="${date}"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${esc(t('evSaveAll'))}</button></div>`;
  }
  // salva le schede (una o tutte quelle modificate) leggendo anche la nota scritta nel campo
  function evSave(tid, date, onlyUid) {
    const tr = trainingById(tid);
    if (!tr || !canEval(tr) || !ui.ev || ui.ev.key !== `${tid}_${date}`) return;
    document.querySelectorAll('.ev-note input[data-uid]').forEach(i => { const d = ui.ev.d[i.dataset.uid]; if (d && d.note !== i.value.trim()) { d.note = i.value.trim().slice(0, 160); d.dirty = true; } });
    const list = Object.entries(ui.ev.d).filter(([uid, d]) => (onlyUid ? uid === onlyUid : d.dirty) && (d.dirty || onlyUid))
      .map(([uid, d]) => ({ tid, date, uid, coachUid: tr.coachUid || '', v: d.v, note: d.note }));
    if (!list.length) return warn('evNothing');
    window.Cloud.saveEvals(list).then(() => {
      list.forEach(e => { ui.ev.d[e.uid].dirty = false; });
      ui.flash = { text: t('evSaved', { n: list.length }) }; render();
    }).catch(trErr);
  }
  const evActions = {
    // tocco su un voto: si segna (o si toglie con un secondo tocco) senza ridisegnare la pagina
    'ev-vote': el => {
      const m = route(), tid = m[1], date = m[2], uid = el.dataset.uid, k = el.dataset.k, n = Number(el.dataset.n);
      if (m[0] !== 'eval' || !EV_KEYS.includes(k) || !(n >= 1 && n <= 10) || !canEval(trainingById(tid))) return;
      const d = evDraft(tid, date, uid);
      if (d.v[k] === n) delete d.v[k]; else d.v[k] = n;
      d.dirty = true;
      const row = el.closest('.ev-row');
      row.querySelectorAll('.ev-v').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.n) === d.v[k])));
      const val = row.querySelector('.ev-val'); val.textContent = d.v[k] != null ? d.v[k] : '–'; val.className = 'ev-val ' + evClass(d.v[k]);
      const c = document.querySelector(`[data-ev-count="${uid}"]`); if (c) c.textContent = t('evCount', { n: Object.keys(d.v).length });
    },
    'ev-save': el => { const m = route(); if (m[0] === 'eval') evSave(m[1], m[2], el.dataset.uid); },
    'ev-save-all': el => evSave(el.dataset.tid, el.dataset.date, null)
  };

  // data e ora brevi (es. 5 nov, 18:30)
  const whenShort = ms => (ms ? new Date(ms).toLocaleString(I18n.locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  function occCard(tr, date) {
    const o = occOf(tr.id, date) || {}, g = groupOf(tr.id, date.slice(0, 7)), names = (g && g.names) || {};
    // 5° allenamento del mese: niente gruppo, ma l'admin può copiare i corsisti del gruppo (danno la presenza come sempre)
    const ex = extraDay(date, tr), grpUids = (g && g.uids) || [], uids = ex ? (o.members || []) : grpUids;
    const late = afterNoon(date);
    const rows = uids.map(uid => {
      const a = attOf(tr.id, date, uid), st = a && a.status, key = `${esc(tr.id)}_${date}_${uid}`;
      const absent = st === 'out' || (!st && late);
      const rec = (S().spots || []).find(sp => sp.uid === uid && sp.recovery && sp.recovery.tid === tr.id && sp.recovery.date === date);
      return `<li><span class="reg-names"><strong>${esc(names[uid] || coachName(uid))}</strong><br>${attChip(st, date)}${a && a.forced ? ` <small class="muted">${esc(t('attForced'))}</small>` : ''}
          ${canEval(tr) && evalOf(tr.id, date, uid) ? ` <span class="badge ev-chip" title="${esc(t('evTitle'))}"><i class="ti ti-clipboard-check" aria-hidden="true"></i> ${esc(t('evChip', { n: Object.keys(evalOf(tr.id, date, uid).v || {}).length }))}</span>` : ''}
          ${rec ? ` <span class="badge">${esc(t('recoveryGiven', { d: fmtDate(rec.date) }))}</span>` : ''}</span>
        ${canMark(tr) && !o.cancelled ? `<span class="btn-row">
          ${st !== 'in' ? `<button class="btn small" data-action="att-force" data-tid="${esc(tr.id)}" data-date="${date}" data-uid="${uid}" data-st="in">${esc(t('attPresent'))}</button>` : ''}
          ${st !== 'out' ? `<button class="btn small" data-action="att-force" data-tid="${esc(tr.id)}" data-date="${date}" data-uid="${uid}" data-st="out">${esc(t('attAbsent'))}</button>` : ''}
          ${st ? `<button class="btn small" data-action="att-force" data-tid="${esc(tr.id)}" data-date="${date}" data-uid="${uid}" data-st=""><i class="ti ti-arrow-back-up" aria-hidden="true"></i> ${esc(t('attNoReply'))}</button>` : ''}
          ${admin() && absent && !rec ? `<button class="btn small" data-action="rec-open" data-key="${key}"><i class="ti ti-arrow-back-up" aria-hidden="true"></i> ${esc(t('recovery'))}</button>` : ''}</span>` : ''}
        ${admin() && ui.recFor === key ? recoveryForm(tr, date, uid, names[uid] || coachName(uid)) : ''}</li>`;
    }).join('');
    const sps = (S().spots || []).filter(sp => sp.tid === tr.id && sp.date === date);
    const pend = sps.filter(sp => sp.status === 'pending'), oks = sps.filter(sp => sp.status === 'ok');
    const spotPrice = (S().prices || {}).spot;
    const n = groupSize(tr, date.slice(0, 7), date);
    return `<div class="card tr-card occ-card ${isExtraTr(tr) ? 'tr-extra' : ''} ${o.cancelled ? 'is-cancelled' : ''}" id="occ-${esc(tr.id)}-${date}">
      <div class="ch-head">${extraBadge(tr)}<span class="badge lvl-${tr.level}">${esc(t('fpLevel_' + tr.level))}</span>
        ${o.cancelled ? `<span class="badge st-full">${esc(t('occCancelled'))}</span>` : admin() ? freeBadge(tr, date) : ''}</div>
      <h3>${esc(trTitle(tr))}</h3>
      <p class="muted"><i class="ti ti-clock" aria-hidden="true"></i> ${esc(tr.from)}–${esc(tr.to)}${tr.coachUid ? ` · ${esc(coachName(tr.coachUid))}` : ''}</p>
      ${o.cancelled && o.note ? `<p class="note warn">${esc(o.note)}</p>` : ''}
      <p class="occ-sum">${esc(t('occSummary', { p: o.p || 0, a: o.a || 0, u: Math.max(0, n - (o.p || 0) - (o.a || 0)), s: o.s || 0, m: tr.max }))}</p>
      ${admin() && !o.cancelled ? `<form class="inline-form occ-free" data-form="occ-free" data-tid="${esc(tr.id)}" data-date="${date}">
        <label class="small">${esc(t('occFreeLabel'))}<input type="number" name="free" min="0" max="99" step="1" inputmode="numeric" value="${(S().occfree || {})[`${esc(tr.id)}_${date}`] != null ? S().occfree[`${esc(tr.id)}_${date}`] : ''}" style="width:5em"></label>
        <button class="btn small primary">${esc(t('save'))}</button>
        <small class="muted">${esc(t('occFreeHint', { v: spotsSuggested(tr, date), s: o.s || 0 }))}</small></form>` : ''}
      ${ex ? `<p class="note"><i class="ti ti-ticket" aria-hidden="true"></i> ${esc(t('extraDayNote'))}</p>
        ${uids.length ? `<h4>${esc(t('extraMembersTitle', { n: uids.length }))}</h4><ul class="reg-list">${rows}</ul>` : ''}
        ${centerAdm() && !o.cancelled && grpUids.some(u => !uids.includes(u)) ? `<p><button class="btn small primary" data-action="occ-copy-group" data-tid="${esc(tr.id)}" data-date="${date}"><i class="ti ti-users-plus" aria-hidden="true"></i> ${esc(t(uids.length ? 'extraCopyMissing' : 'extraCopyGroup', { n: grpUids.filter(u => !uids.includes(u)).length }))}</button></p>` : ''}` : `<h4>${esc(t('grpTitle', { m: monthLabel(date.slice(0, 7)) }))}</h4>
      ${uids.length ? `<ul class="reg-list">${rows}</ul>` : `<p class="muted small">${esc(t('grpEmpty'))}</p>`}`}
      ${oks.length ? `<h4>${esc(t('spotConfirmed'))}</h4><ul class="reg-list">${oks.map(sp => `<li><span class="reg-names"><strong>${esc(sp.name)}</strong>
        ${sp.recovery ? ` <span class="badge">${esc(t('recoveryOf', { d: fmtDate(sp.recovery.date) }))}</span>` : ''}${admin() ? `<br><small class="muted">${esc(euro(sp.price || 0))}</small>` : ''}</span>
        ${admin() && !sp.paid ? `<button class="btn small" data-action="spot-undo" data-id="${esc(sp.id)}">${esc(t('spotUndo'))}</button>` : ''}
        ${admin() ? `<div class="pay-wrap">${payBox('spot', sp, sp.uid, sp.price || 0)}</div>` : ''}</li>`).join('')}</ul>` : ''}
      ${centerAdm() && !o.cancelled && isExtraTr(tr) ? occCopyForm(tr, date) : ''}
      ${admin() && !o.cancelled ? occAddForm(tr, date, uids, sps) : ''}
      ${pend.length ? `<h4>${esc(t('spotRequests'))} (${pend.length})</h4><ul class="reg-list">${pend.map(sp => `<li><span class="reg-names"><strong>${esc(sp.name)}</strong><br><small class="muted">${esc(whenShort(sp.at))}</small></span>
        ${admin() ? `<form class="inline-form" data-form="spot-decide" data-id="${esc(sp.id)}">${activePack(sp.uid) ? `<label class="check small"><input type="checkbox" name="pack" value="${activePack(sp.uid).id}" checked> ${esc(t('packUseLabel', { l: packsOf(sp.uid).reduce((s, k) => s + packLeft(k), 0) }))}</label>` : ''}<label class="small">${esc(t('spotPriceLabel'))}<input type="number" name="price" min="0" step="0.01" value="${spotPrice != null ? spotPrice : ''}" inputmode="decimal" style="width:6em"></label>
          <button class="btn small primary" data-submit="ok">${esc(t('spotConfirm'))}</button><button class="btn small danger" data-submit="no">${esc(t('spotReject'))}</button></form>` : ''}</li>`).join('')}</ul>` : ''}
      ${centerAdm() ? `<div class="btn-row">${o.cancelled ? `<button class="btn small" data-action="occ-restore" data-tid="${esc(tr.id)}" data-date="${date}">${esc(t('occRestore'))}</button>`
        : `<button class="btn small danger" data-action="occ-cancel" data-tid="${esc(tr.id)}" data-date="${date}"><i class="ti ti-calendar-off" aria-hidden="true"></i> ${esc(t('occCancel'))}</button>
          <button class="btn small danger" data-action="occ-remove" data-tid="${esc(tr.id)}" data-date="${date}"><i class="ti ti-calendar-x" aria-hidden="true"></i> ${esc(t('occRemove'))}</button>`}</div>` : ''}
      ${admin() && !o.cancelled && date <= todayStr() && uids.length && uids.some(u => packsOf(u).length) ? `<div class="btn-row occ-confirm-row"><button class="btn small" data-action="occ-confirm" data-tid="${esc(tr.id)}" data-date="${date}"><i class="ti ti-ticket" aria-hidden="true"></i> ${esc(t('occConfirm'))}</button>
        <small class="muted">${esc(t('occConfirmHelp'))}</small></div>` : ''}
      ${evalCta(tr, date, o, uids)}
    </div>`;
  }

  // Recupero già creato: copia (aggiunge) i corsisti del gruppo di un altro allenamento, senza doppioni.
  function occCopyForm(tr, date) {
    const key = `occcopy-${esc(tr.id)}-${date}`;
    return `<details class="sub-form occ-add" data-keep="${key}" ${keepOpen(key)}><summary><i class="ti ti-users-plus" aria-hidden="true"></i> ${esc(t('occCopyTitle'))}</summary>
      <form class="grid-form" data-form="occ-copy" data-tid="${esc(tr.id)}" data-date="${date}">
        <label class="span-all">${esc(t('trCopyFrom'))}<select name="src" required><option value="">— ${esc(t('chooseTraining'))} —</option>
          ${weeklyTrainings().map(s => `<option value="${esc(s.id)}">${esc(trTitle(s))} · ${esc(trLabel(s))}${s.coachUid ? ' · ' + esc(coachName(s.coachUid)) : ''}</option>`).join('')}</select></label>
        <p class="muted small span-all">${esc(t('occCopyHelp'))}</p>
        <div class="form-actions span-all"><button class="btn primary"><i class="ti ti-users-plus" aria-hidden="true"></i> ${esc(t('occCopyBtn'))}</button></div>
      </form></details>`;
  }

  // L'admin inserisce in questo allenamento del giorno una persona che non fa parte del gruppo:
  // come spot (prezzo modificabile, anche 0) o scalando un allenamento dal suo pacchetto.
  function occAddForm(tr, date, uids, sps) {
    const taken = new Set(uids.concat(sps.filter(sp => sp.status !== 'no').map(sp => sp.uid)));
    const mem = (S().members || []).filter(m => !taken.has(m.uid)).sort((a, b) => personName(a).localeCompare(personName(b)));
    const left = uid => packsOf(uid).reduce((s, k) => s + packLeft(k), 0);
    const key = `occadd-${esc(tr.id)}-${date}`, sp0 = (S().prices || {}).spot;
    return `<details class="sub-form occ-add" data-keep="${key}" ${keepOpen(key)}><summary><i class="ti ti-user-plus" aria-hidden="true"></i> ${esc(t('occAdd'))}</summary>
      <form class="grid-form" data-form="occ-add" data-tid="${esc(tr.id)}" data-date="${date}">
        <p class="muted small span-all">${esc(t('occAddHelp'))}</p>
        <label class="span-all">${esc(t('athPerson'))}<select name="uid" required><option value="">— ${esc(t('chooseUser'))} —</option>
          ${mem.map(m => `<option value="${m.uid}">${esc(personName(m))}${left(m.uid) ? ' · ' + esc(t('occAddPackLeft', { l: left(m.uid) })) : ''}</option>`).join('')}</select></label>
        <fieldset class="span-all occ-add-as"><legend>${esc(t('occAddAs'))}</legend>
          <label class="check"><input type="radio" name="as" value="spot" checked> ${esc(t('occAddSpot'))}</label>
          <label class="check"><input type="radio" name="as" value="pack"> ${esc(t('occAddPack'))}</label></fieldset>
        <label>${esc(t('spotPriceLabel'))}<input type="number" name="price" min="0" step="0.01" value="${sp0 != null ? sp0 : ''}" inputmode="decimal"></label>
        <div class="form-actions span-all"><button class="btn primary"><i class="ti ti-user-plus" aria-hidden="true"></i> ${esc(t('occAddBtn'))}</button></div>
      </form></details>`;
  }

  // Recupero: l'admin sceglie un altro allenamento (prossimi 30 giorni) e il prezzo (anche 0).
  function recoveryForm(tr, date, uid, name) {
    const opts = occurrences(todayStr(), 30).filter(o => !(o.tr.id === tr.id && o.date === date) && !(occOf(o.tr.id, o.date) || {}).cancelled && Date.now() < trStartMs(o.tr, o.date));
    return `<form class="grid-form rec-form" data-form="rec-save" data-tid="${esc(tr.id)}" data-date="${date}" data-uid="${uid}" data-name="${esc(name)}">
      <label class="span-all">${esc(t('recWhen'))}<select name="occ" required>${opts.map(o => `<option value="${o.tr.id}|${o.date}">${esc(occLabel(o.tr, o.date))} · ${esc(t('spotFree', { n: spotsFree(o.tr, o.date) }))}</option>`).join('')}</select></label>
      <label>${esc(t('spotPriceLabel'))}<input type="number" name="price" min="0" step="0.01" value="0" inputmode="decimal"></label>
      <div class="form-actions span-all"><button type="button" class="btn" data-action="rec-close">${esc(t('cancel'))}</button><button class="btn primary">${esc(t('recGive'))}</button></div>
    </form>`;
  }

  const trErr = e => warn('regError', { code: e.code || e.message });
  const occActions = {
    'tr-day': el => { ui.trDay = el.dataset.d; if (el.dataset.toDay) ui.trView = 'day'; render(); },
    'tr-view': el => { ui.trView = el.dataset.v; if (ui.trView === 'month') ui.trDayMonth = (ui.trDay || todayStr()).slice(0, 7); render(); },
    'tr-dmonth': el => { ui.trDayMonth = el.dataset.m; render(); },
    'tr-past': () => { ui.trShowPast = !ui.trShowPast; render(); },
    'wr-go': el => { ui.wrSlide = +el.dataset.i; render(); const w = document.querySelector('.wr'); if (w) w.scrollIntoView({ block: 'nearest' }); },
    'wr-share': async el => {
      const m = self(), w = m && wrappedData(m, el.dataset.q);
      if (!w) return;
      el.disabled = true;
      try { await shareCanvas(await wrappedImage(w), `wrapped-${w.q}.png`); } catch (e) { warn('figShareErr'); } finally { el.disabled = false; }
    },
    'tr-tab': el => { ui.trTab = el.dataset.tab; render(); },
    'att-set': el => {
      const tr = trainingById(el.dataset.tid), date = el.dataset.date, m = self();
      if (!tr || !m) return;
      if (needsVerify()) return warn('verifyFirst');
      if ((occOf(tr.id, date) || {}).cancelled) return warn('occCancelled');
      if (Date.now() > trStartMs(tr, date)) return warn('attStarted');
      const cur = attOf(tr.id, date, m.uid), st = el.dataset.st;
      // dopo le 13 si torna presenti solo se i posti non sono già andati agli spot
      if (st === 'in' && afterNoon(date) && !(cur && cur.status === 'in') && ((occOf(tr.id, date) || {}).s || 0) > 0 && spotsFree(tr, date) <= 0) return warn('attFullContact');
      window.Cloud.setAttendance(tr.id, date, m.uid, st || null, { coachUid: tr.coachUid || '' }).then(() => { ui.flash = { text: t(st === 'in' ? 'attSavedIn' : st === 'out' ? 'attSavedOut' : 'attSavedNone') }; render(); })
        .catch(e => (e && e.code === 'permission-denied' ? warn('attDenied') : trErr(e)));
    },
    'att-force': el => {
      const tr = trainingById(el.dataset.tid);
      if (!tr || !canMark(tr)) return;
      // data-st vuoto: torna "senza risposta" (si toglie la risposta e i contatori si aggiornano).
      // Admin e segreteria: il pacchetto del corsista si scala (o si restituisce) subito.
      const date = el.dataset.date, uid = el.dataset.uid;
      window.Cloud.setAttendance(tr.id, date, uid, el.dataset.st || null, { coachUid: tr.coachUid || '', forced: true })
        .then(() => (admin() ? window.Cloud.syncPackUse(tr.id, date, uid) : null))
        .then(r => { if (r === 'used' || r === 'released') ui.flash = { text: t(r === 'used' ? 'packScaledOne' : 'packBackOne', { n: coachName(uid) }) }; render(); }).catch(trErr);
    },
    'spot-apply': el => {
      const tr = trainingById(el.dataset.tid), date = el.dataset.date, m = self();
      if (!tr || !m) return;
      if (needsVerify()) return warn('verifyFirst');
      if (!spotOpen(tr, date)) return warn('spotClosed');
      const pk = activePack(m.uid);
      if (!confirmed(pk ? 'spotApplyConfirmPack' : 'spotApplyConfirm', { o: occLabel(tr, date), p: euro((S().prices || {}).spot), l: packsOf(m.uid).reduce((s, k) => s + packLeft(k), 0) })) return;
      window.Cloud.applySpot({ tid: tr.id, date, name: personLabel(m), coachUid: tr.coachUid || '', from: tr.from }).then(() => { ui.flash = { text: t('spotApplied') }; render(); }).catch(trErr);
    },
    'spot-withdraw': el => { if (confirmed('spotWithdrawConfirm')) window.Cloud.withdrawSpot(el.dataset.id).then(() => render()).catch(trErr); },
    'spot-seen': el => { window.Cloud.seeSpot(el.dataset.id).then(() => render()).catch(trErr); },
    'spot-undo': el => {
      const sp = (S().spots || []).find(x => x.id === el.dataset.id);
      if (sp && confirmed('spotUndoConfirm', { n: sp.name })) window.Cloud.decideSpot(sp, false).then(() => render()).catch(trErr);
    },
    'occ-cancel': el => {
      const tr = trainingById(el.dataset.tid);
      if (!tr) return;
      const note = prompt(t('occCancelPrompt', { o: occLabel(tr, el.dataset.date) }), '');
      if (note === null) return;
      window.Cloud.setOccCancelled(tr.id, el.dataset.date, true, note.slice(0, 200), occPackSpots(tr.id, el.dataset.date))
        .then(() => window.Cloud.extraTrainingBlocks(tr, true)).then(() => { ui.flash = { text: t('occCancelledDone') }; render(); }).catch(trErr);
    },
    // eliminato solo per quel giorno (un allenamento settimanale resta negli altri giorni)
    'occ-remove': el => {
      const tr = trainingById(el.dataset.tid);
      if (!tr || !confirmed('occRemoveConfirm', { o: occLabel(tr, el.dataset.date) })) return;
      window.Cloud.setOccCancelled(tr.id, el.dataset.date, true, '', occPackSpots(tr.id, el.dataset.date), true)
        .then(() => window.Cloud.extraTrainingBlocks(tr, true)).then(() => { ui.flash = { text: t('occRemovedDone') }; render(); }).catch(trErr);
    },
    // 5° allenamento: copia (o completa) i corsisti del gruppo del mese nella giornata
    'occ-copy-group': el => {
      const tr = trainingById(el.dataset.tid), date = el.dataset.date, g = tr && groupOf(tr.id, date.slice(0, 7));
      if (!g) return;
      const cur = (occOf(tr.id, date) || {}).members || [];
      const members = cur.concat((g.uids || []).filter(u => !cur.includes(u)));
      window.Cloud.setOccMembers(tr.id, date, members).then(() => { ui.flash = { text: t('extraCopied', { n: members.length - cur.length }) }; render(); }).catch(trErr);
    },
    'occ-restore': el => {
      const tr = trainingById(el.dataset.tid), date = el.dataset.date;
      if (!tr) return;
      // nel frattempo il campo può essere stato prenotato: si avvisa (le prenotazioni restano)
      const taken = (S().bookings || []).filter(b => !b.recurring && (tr.courts || []).includes(b.courtId) && b.date === date && b.from < tr.to && tr.from < b.to && !String(b.id).startsWith(`trx_${esc(tr.id)}_`));
      if (taken.length && !confirmed('occRestoreClash', { l: taken.map(b => `${courtName(b.courtId)} ${esc(b.from)}–${esc(b.to)} (${bkWho(b)})`).join(', ') })) return;
      window.Cloud.setOccCancelled(tr.id, date, false, '', occPackSpots(tr.id, date))
        .then(() => (taken.length ? null : window.Cloud.extraTrainingBlocks(tr, false))).then(() => render()).catch(trErr);
    },
    'rec-open': el => { ui.recFor = el.dataset.key; render(); },
    // conferma della giornata (admin e segreteria): le presenze scalano i pacchetti dei corsisti
    'occ-confirm': el => {
      const tr = trainingById(el.dataset.tid), date = el.dataset.date;
      if (!tr || !admin()) return;
      const o = occOf(tr.id, date) || {}, g = groupOf(tr.id, date.slice(0, 7));
      const uids = extraDay(date, tr) ? (o.members || []) : ((g && g.uids) || []);
      el.disabled = true;
      (async () => { let n = 0, b = 0; for (const u of uids) { const r = await window.Cloud.syncPackUse(tr.id, date, u); if (r === 'used') n++; if (r === 'released') b++; } return [n, b]; })()
        .then(([n, b]) => { ui.flash = { text: t('occConfirmed', { n, b }) }; render(); }).catch(e => { el.disabled = false; trErr(e); });
    },
    'pack-sync': () => {
      if (ui.packSyncing) return;
      ui.packSyncing = true; render();
      window.Cloud.recalcPacks().then(n => { ui.packSyncing = false; ui.flash = { text: t('packSyncDone', { n }) }; render(); })
        .catch(e => { ui.packSyncing = false; trErr(e); });
    },
    'rec-close': () => { ui.recFor = null; render(); }
  };
  // spot confermati di un allenamento del giorno scalati da un pacchetto (tornano nel pacchetto se si annulla)
  const occPackSpots = (tid, date) => (S().spots || []).filter(sp => sp.tid === tid && sp.date === date && sp.status === 'ok' && sp.pack);
  const occForms = {
    'bk-info-pl': f => {
      const x = ui.bkInfo; if (!x || !admin()) return;
      const b = x.b, picked = [...new Set([...f.querySelectorAll('select')].map(s => s.value).filter(v => v && v !== b.userId))];
      const uids = picked.filter(v => !isGuestKey(v));
      const guests = Object.fromEntries(picked.filter(isGuestKey).map(k => [k, ((x.doc && x.doc.guests) || {})[k] || '?']));
      const om = memberByUid(b.userId);
      const base = x.doc || { gid: b.id, by: b.userId, ownerName: om ? personLabel(om) : '', date: b.date, from: b.from, to: b.to, courtId: b.courtId, courtName: courtName(b.courtId), remind: 60 };
      const doc = Object.assign({}, base, { gid: b.id, uids, guests, names: Object.fromEntries(uids.map(u => { const m = memberByUid(u); return [u, m ? personLabel(m) : ((x.doc && x.doc.names) || {})[u] || '']; })) });
      delete doc.updated;
      window.Cloud.saveBkPlayers(doc).then(() => { ui.flash = { text: t('bkPlayersSaved') }; bkInfoDialog(b.id, b.date); render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'occ-free': f => {
      const v = f.free.value === '' ? null : Math.max(0, parseInt(f.free.value, 10) || 0);
      window.Cloud.setOccFree(f.dataset.tid, f.dataset.date, v).then(() => { ui.flash = { text: t('occFreeSaved', { n: v || 0 }) }; render(); }).catch(trErr);
    },
    'spot-decide': f => {
      const sp = (S().spots || []).find(x => x.id === f.dataset.id);
      if (!sp) return;
      const ok = submitMode !== 'no';
      const price = f.price.value === '' ? 0 : Math.round(Number(f.price.value) * 100) / 100;
      const packId = ok && f.pack && f.pack.checked ? f.pack.value : null;
      window.Cloud.decideSpot(sp, ok, price, packId).then(() => { ui.flash = { text: t(!ok ? 'spotRejectedDone' : packId ? 'spotConfirmedPack' : 'spotConfirmedDone', { n: sp.name }) }; render(); })
        .catch(e => (e && e.code === 'pack-empty' ? warn('packEmptyErr') : trErr(e)));
    },
    'occ-add': f => {
      const tr = trainingById(f.dataset.tid), date = f.dataset.date, m = memberByUid(f.uid.value);
      if (!tr || !m) return;
      const asPack = f.as.value === 'pack', pk = asPack ? activePack(m.uid) : null;
      if (asPack && !pk) return warn('occAddNoPack', { n: personName(m) });
      const price = asPack || f.price.value === '' ? 0 : Math.round(Number(f.price.value) * 100) / 100;
      const sp = { id: `${esc(tr.id)}_${date}_${m.uid}`, tid: tr.id, date, uid: m.uid, name: personLabel(m), coachUid: tr.coachUid || '', from: tr.from, at: Date.now(), added: true };
      window.Cloud.decideSpot(sp, true, price, pk ? pk.id : null).then(() => {
        ui.flash = { text: t(asPack ? 'occAddDonePack' : 'occAddDone', { n: personName(m), o: occLabel(tr, date) }) }; render();
      }).catch(e => (e && e.code === 'pack-empty' ? warn('packEmptyErr') : trErr(e)));
    },
    'rec-save': f => {
      const [tid, date] = f.occ.value.split('|'), tr = trainingById(tid);
      if (!tr) return;
      const price = f.price.value === '' ? 0 : Math.round(Number(f.price.value) * 100) / 100;
      const uid = f.dataset.uid;
      const sp = { id: `${tid}_${date}_${uid}`, tid, date, uid, name: f.dataset.name, coachUid: tr.coachUid || '', from: tr.from, at: Date.now(), recovery: { tid: f.dataset.tid, date: f.dataset.date } };
      window.Cloud.decideSpot(sp, true, price).then(() => { ui.recFor = null; ui.flash = { text: t('recGiven', { n: sp.name, o: occLabel(tr, date) }) }; render(); }).catch(trErr);
    }
  };

  // ---------- pagamenti e ricevute ----------
  // dati dell'associazione sulle ricevute (da js/club.js)
  const ASSOC = [Club.legalName, Club.address, Club.city, 'CF ' + Club.cf + ' · PI ' + Club.vat, 'PEC ' + Club.pec];
  const PAY_METHODS = ['cash', 'card', 'transfer'];
  // si incassa solo in sede: contanti, POS, bonifico
  const PAY_IT = { cash: 'contanti', card: 'POS', transfer: 'bonifico' };
  const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const itDate = d => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
  const itMonth = m => { const x = MONTHS_IT[+m.slice(5, 7) - 1]; return `${x.charAt(0).toUpperCase() + x.slice(1)} ${m.slice(0, 4)}`; };
  const euroIt = v => Number(v || 0).toFixed(2).replace('.', ',');
  // importo in lettere: 50 → "cinquanta/00", 121,5 → "centoventuno/50"
  function euroWords(v) {
    const U = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove'];
    const T = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];
    const w99 = n => { if (n < 20) return U[n]; const u = n % 10; let s = T[Math.floor(n / 10)]; if (u === 1 || u === 8) s = s.slice(0, -1); return u ? s + U[u] : s; };
    const w999 = n => { const h = Math.floor(n / 100), r = n % 100; let s = h ? (h === 1 ? 'cento' : U[h] + 'cento') : ''; if (r) { if (h && (r === 8 || Math.floor(r / 10) === 8)) s = s.slice(0, -1); s += w99(r); } return s; };
    const cents = Math.round(Number(v || 0) * 100), n = Math.floor(cents / 100), c = cents % 100;
    let s = n === 0 ? 'zero' : (n >= 1000 ? (Math.floor(n / 1000) === 1 ? 'mille' : w999(Math.floor(n / 1000)) + 'mila') : '') + (n % 1000 ? w999(n % 1000) : '');
    if (n > 3 && s.endsWith('tre')) s = s.slice(0, -3) + 'tré';
    return `${s}/${String(c).padStart(2, '0')}`;
  }
  const PERSON_FIELDS = ['birthPlace', 'birthDate', 'city', 'address', 'cf'];
  const missingPerson = a => PERSON_FIELDS.filter(k => !(a && a[k]));
  const personOf = (uid, a) => { const m = memberByUid(uid); return { name: m ? `${m.first} ${m.last}` : `${(a && a.first) || ''} ${(a && a.last) || ''}`.trim(), gender: (m && m.gender) || 'M', birthPlace: a.birthPlace, birthDate: a.birthDate, city: a.city, address: a.address, cf: a.cf }; };
  const causaleMonth = m => `Quota sociale allenamenti - mese di ${itMonth(m)}`;
  const causaleSpot = d => `Quota sociale allenamenti - allenamento del ${itDate(d)}`;
  const paidLine = (p, pd) => { pd = pd || (p && p.paid); return pd ? `${esc(t('paidOn', { d: fmtDate(pd.date), m: t('pay_' + pd.method) }))}${pd.quarter ? ` · ${esc(t(pd.course ? 'payCourseOf' : 'payQuarterOf', { a: monthLabel(pd.months[0]), b: monthLabel(pd.months[pd.months.length - 1]) }))}` : ''}${pd.rn ? ` · ${esc(t('receiptN', { n: rnFmt(pd.rn) }))}` : ''}` : ''; };
  const receiptById = id => (S().receipts || []).find(r => r.id === id);
  // numero della ricevuta con la serie: Q quote sociali, C commerciali (le vecchie, senza serie, sono Q)
  const rSeries = r => r.series || 'Q';
  const rcNum = r => `${r.n}/${rSeries(r)}/${r.year}`;
  const rnFmt = rn => (/^\d+\/\d{4}$/.test(rn || '') ? rn.replace('/', '/Q/') : rn || '');
  // stato del pagamento del mese: pagato, da pagare, in ritardo (dopo il 10 del mese)
  // pagato anche se coperto da un trimestrale (prepagato nella scheda del corsista)
  const prepaidOf = (uid, month) => { const a = athleteOf(uid); return (a && a.prepaid && a.prepaid[month]) || null; };
  const planPaid = p => p.paid || prepaidOf(p.uid, p.month);
  const payState = p => planPaid(p) ? 'paid' : (todayStr() > `${p.month}-10` ? 'late' : 'due');
  const quarterMonths = m => [m, shiftMonth(m, 1), shiftMonth(m, 2)];
  // CORSO INTERO: prezzo per 1 o 2 allenamenti a settimana e date del corso nel listino; copre tutti i mesi del corso
  const courseInfo = () => { const p = S().prices || {}; return /^\d{4}-\d{2}-\d{2}$/.test(p.courseFrom || '') && /^\d{4}-\d{2}-\d{2}$/.test(p.courseTo || '') && p.courseFrom <= p.courseTo ? { from: p.courseFrom, to: p.courseTo } : null; };
  const courseMonths = () => { const c = courseInfo(), out = []; if (!c) return out; for (let m = c.from.slice(0, 7); m <= c.to.slice(0, 7) && out.length < 24; m = shiftMonth(m, 1)) out.push(m); return out; };
  const coursePrice = n => { const v = (S().prices || {})['c' + n]; return (n === 1 || n === 2) && v != null && v !== '' ? Number(v) : null; };
  const causaleCourse = () => { const c = courseInfo(); return `Quota sociale allenamenti - corso intero dal ${itDate(c.from)} al ${itDate(c.to)}`; };
  // TESSERAMENTO FITP: quota a parte, per stagione (qui solo pagato / non pagato)
  const fitpPrice = () => { const v = (S().prices || {}).fitp; return v != null && v !== '' ? Number(v) : null; };
  const causaleFitp = s => `Quota tesseramento FITP - stagione ${s}`;
  const fitpObj = (uid, s) => { const a = athleteOf(uid) || {}; return { id: `${uid}|${s}`, uid, season: s, paid: (a.fitp || {})[s] || null }; };
  const quarterPrice = n => { const v = (S().prices || {})['q' + n]; return (n === 1 || n === 2) && v != null && v !== '' ? Number(v) : null; };
  const causaleQuarter = m => `Quota sociale allenamenti - trimestre ${itMonth(m)} - ${itMonth(shiftMonth(m, 2))}`;
  const payBadge = p => `<span class="badge pay-${payState(p)}">${esc(t('payState_' + payState(p)))}</span>`;
  // pacchetti di allenamenti: si usa il più vecchio con allenamenti rimasti
  const packsOf = uid => (S().packs || []).filter(k => k.uid === uid).sort((a, b) => (a.created || 0) - (b.created || 0));
  const packLeft = k => Math.max(0, (k.n || 0) - (k.used || 0));
  const activePack = uid => packsOf(uid).find(k => packLeft(k) > 0) || null;
  // giorno da cui il pacchetto scala le presenze (scelto alla creazione, altrimenti il giorno in cui è stato registrato)
  const packFrom = k => k.from || new Date(k.created || 0).toLocaleDateString('sv');
  // allenamenti scalati da un pacchetto: presenze (packuse, scritti dall'app di admin e segreteria) e spot confermati dal pacchetto.
  const packUses = k => (S().packuse || []).filter(u => u.pack === k.id).map(u => ({ date: u.date, tid: u.tid, kind: 'att' }))
    .concat((S().spots || []).filter(sp => sp.pack === k.id && sp.status === 'ok' && !sp.packBack).map(sp => ({ date: sp.date, tid: sp.tid, kind: 'spot' })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const packUseList = k => { const u = packUses(k); return u.length ? `<details class="pack-uses"><summary>${esc(t('packUsesTitle', { n: u.length }))}</summary><ul class="plain-list">${u.map(x => { const tr = trainingById(x.tid);
    return `<li><i class="ti ti-${x.kind === 'att' ? 'check' : 'ticket'}" aria-hidden="true"></i> ${esc(fmtDate(x.date))}${tr ? ' · ' + esc(trTitle(tr)) : ''} <small class="muted">${esc(t(x.kind === 'att' ? 'packUseAtt' : 'packUseSpot'))}</small></li>`; }).join('')}</ul></details>` : ''; };
  const causalePack = k => `Quota sociale allenamenti - pacchetto di ${k.n} allenamenti`;
  const packById = id => (S().packs || []).find(k => k.id === id);

  // Ricevuta nei moduli di pagamento: di base non si emette, con qualsiasi modalità; si spunta "Emetti ricevuta" per farla.
  const rcChecks = () => `<label class="check span-all ca-rc"><input type="checkbox" name="receipt"> ${esc(t('caReceiptCash'))}</label>`;
  const wantReceipt = f => f.receipt.checked;
  // Modulo di pagamento (admin): data, modalità, importo e, se mancano, i dati per la ricevuta.
  function payForm(kind, ref, uid, amount) {
    const a = athleteOf(uid) || {}, miss = missingPerson(a);
    const plan = kind === 'month' ? (S().plans || []).find(p => p.id === ref) : null;
    const qp = plan ? quarterPrice(plan.n) : null;
    const cm = courseMonths(), cp = plan && cm.includes(plan.month) ? coursePrice(plan.n) : null, ci = courseInfo();
    return `<form class="grid-form pay-form" data-form="pay-save" data-kind="${kind}" data-ref="${ref}" data-uid="${uid}">
      <h4 class="span-all">${esc(t(kind === 'fitp' ? 'fitpPayTitle' : 'payRecord'))}</h4>
      ${qp != null || cp != null ? `<label class="span-all">${esc(t('payPeriod'))}<select name="period" data-change="pay-period" data-m="${amount != null ? amount : ''}" data-q="${qp != null ? qp : ''}" data-c="${cp != null ? cp : ''}">
        <option value="month">${esc(t('payMonthly', { p: euro(amount) }))}</option>
        ${qp != null ? `<option value="quarter">${esc(t('payQuarterly', { p: euro(qp), a: monthLabel(plan.month), b: monthLabel(shiftMonth(plan.month, 2)) }))}</option>` : ''}
        ${cp != null ? `<option value="course">${esc(t('payCourse', { p: euro(cp), a: fmtDate(ci.from), b: fmtDate(ci.to) }))}</option>` : ''}</select></label>` : ''}
      <label>${esc(t('payDate'))}<input type="date" name="payDate" required value="${todayStr()}"></label>
      <label>${esc(t('payMethod'))}<select name="method">${PAY_METHODS.map(x => `<option value="${x}">${esc(t('pay_' + x))}</option>`).join('')}</select></label>
      <label>${esc(t('payAmount'))}<input type="number" name="amount" min="0" step="0.01" required value="${amount != null ? amount : ''}" inputmode="decimal"></label>
      ${rcChecks()}
      ${miss.length ? `<p class="note warn span-all">${esc(t('payNeedData'))} ${t('athDataNote')}</p>
        <label>${esc(t('athBirthPlace'))}<input name="birthPlace" maxlength="60" value="${esc(a.birthPlace || '')}"></label>
        <label>${esc(t('athBirthDate'))}<input type="date" name="birthDate" value="${esc(a.birthDate || '')}"></label>
        <label>${esc(t('athCity'))}<input name="city" maxlength="60" value="${esc(a.city || '')}"></label>
        <label>${esc(t('athAddress'))}<input name="address" maxlength="100" value="${esc(a.address || '')}" placeholder="${esc(t('athAddressPh'))}"></label>
        <label>${esc(t('athCf'))}<input name="cf" maxlength="16" value="${esc(a.cf || '')}" pattern="[A-Za-z0-9]{16}"></label>` : ''}
      <div class="form-actions span-all"><button type="button" class="btn" data-action="pay-close">${esc(t('cancel'))}</button><button class="btn primary"><i class="ti ti-receipt" aria-hidden="true"></i> ${esc(t('paySave'))}</button></div>
    </form>`;
  }
  // Riga di pagamento sotto un piano o uno spot (admin): stato, ricevuta, oppure pulsante per registrare.
  function payBox(kind, obj, uid, amount) {
    if (kind === 'fitp' && !obj.paid && ui.payFor !== `fitp:${esc(obj.id)}`) return `<p class="pay-line"><span class="badge pay-due">${esc(t('payState_due'))}</span>
        <button class="btn small primary" data-action="pay-open" data-key="fitp:${esc(obj.id)}"><i class="ti ti-cash" aria-hidden="true"></i> ${esc(t('fitpPayBtn'))}</button></p>`;
    if (kind === 'spot' && obj.pack) return `<p class="pay-line"><span class="badge st-done"><i class="ti ti-ticket" aria-hidden="true"></i> ${esc(t(obj.packBack ? 'packReturned' : 'packUsed'))}</span></p>`;
    const pd = kind === 'month' ? planPaid(obj) : obj.paid;
    if (pd) {
      const r = pd.rid && receiptById(pd.rid);
      return `<p class="pay-line"><i class="ti ti-circle-check" aria-hidden="true"></i> ${paidLine(obj, pd)}
        ${r ? ` <button class="btn small" data-action="rc-pdf" data-id="${esc(r.id)}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> ${esc(t('receiptPdf'))}</button>`
          : ` <button class="btn small" data-action="pay-undo" data-kind="${kind}" data-ref="${esc(obj.id)}" data-iid="${pd.iid || ''}">${esc(t('payUndo'))}</button>`}</p>`;
    }
    const key = `${kind}:${esc(obj.id)}`;
    return ui.payFor === key ? payForm(kind, obj.id, uid, amount)
      : `<p class="pay-line">${kind === 'month' ? payBadge(obj) : `<span class="badge pay-due">${esc(t('payState_due'))}</span>`}
        <button class="btn small primary" data-action="pay-open" data-key="${key}"><i class="ti ti-cash" aria-hidden="true"></i> ${esc(t('payRecord'))}</button></p>`;
  }

  // ---------- PDF della ricevuta (jsPDF in vendor/jspdf) ----------
  let jsPdfPromise = null;
  function loadJsPdf() {
    if (!jsPdfPromise) jsPdfPromise = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/jspdf/jspdf.umd.min.js'; sc.onload = () => resolve(window.jspdf.jsPDF); sc.onerror = () => { jsPdfPromise = null; reject(new Error('jspdf')); };
      document.head.appendChild(sc);
    });
    return jsPdfPromise;
  }
  function drawReceipt(pdf, r) {
    const p = r.person || {}, F = p.gender === 'F', L = 22, named = !!p.name, C = rSeries(r) === 'C';
    let y = 22;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(ASSOC[0], L, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5);
    ASSOC.slice(1).forEach(l => { y += 5.5; pdf.text(l, L, y); });
    y += 18; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
    pdf.text(`RICEVUTA N. ${rcNum(r)} del ${itDate(r.issued)}`, L, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11.5);
    if (C) { pdf.setFontSize(9.5); pdf.text('Ricevuta non fiscale', 188, y, { align: 'right' }); pdf.setFontSize(11.5); }
    y += 13; pdf.text(named ? `Si attesta che ${F ? 'la Sig.ra' : 'il Sig.'}:` : 'Si attesta che il/la Sig./Sig.ra:', L, y);
    const blank = '______________________________';
    const rows = named ? [['Nome e Cognome', p.name], [F ? 'Nata a' : 'Nato a', p.birthPlace || p.birthDate ? `${p.birthPlace || ''} il ${itDate(p.birthDate)}` : ''], ['Residente a', p.city || p.address ? `${p.city || ''}, ${p.address || ''}` : ''], ['Codice Fiscale', p.cf || '']]
      : [['Nome e Cognome', blank], ['Codice Fiscale', blank]];
    rows.forEach(([k, v]) => { y += 8; pdf.text('•', L + 3, y); pdf.setFont('helvetica', 'bold'); pdf.text(`${k}:`, L + 8, y); const w = pdf.getTextWidth(`${k}: `); pdf.setFont('helvetica', 'normal'); pdf.text(String(v || ''), L + 8 + w, y); });
    y += 13; pdf.text(`ha versato in data ${itDate(r.payDate)} la somma complessiva di:`, L, y);
    y += 8; pdf.text('•', L + 3, y); pdf.setFont('helvetica', 'bold'); pdf.text(`Euro ${euroIt(r.amount)}`, L + 8, y); pdf.setFont('helvetica', 'normal');
    y += 8; pdf.text('•', L + 3, y); pdf.text(`(Euro ${euroWords(r.amount)})`, L + 8, y);
    y += 13; pdf.setFont('helvetica', 'bold'); pdf.text('Causale:', L, y); pdf.setFont('helvetica', 'normal');
    y += 7; const cl = pdf.splitTextToSize(`${r.causale}.`, 166); pdf.text(cl, L, y); y += (cl.length - 1) * 5.5;
    if ((r.lines || []).length > 1) r.lines.forEach(l => { y += 6.5; pdf.text(`- ${l.desc}: Euro ${euroIt(l.amount)}`, L + 4, y); });
    y += 11; pdf.setFontSize(10); pdf.text(`Modalità di pagamento: ${PAY_IT[r.method] || r.method}`, L, y);
    // spazio per timbro e firma (verranno aggiunti)
    pdf.setFontSize(10.5);
    pdf.text("Timbro dell'associazione", L, 238); pdf.line(L, 262, L + 70, 262);
    pdf.text('Il Presidente', 128, 238); pdf.line(128, 262, 188, 262);
    if (r.void) { pdf.setTextColor(200, 0, 0); pdf.setFontSize(48); pdf.text('ANNULLATA', 105, 170, { align: 'center', angle: 25 }); pdf.setTextColor(0, 0, 0); }
  }
  const receiptFile = r => `ricevuta_${r.n}_${rSeries(r)}_${r.year}${(r.person || {}).name ? '_' + latinName(r.person.name) : ''}.pdf`;
  async function receiptsPdf(list) {
    const JsPDF = await loadJsPdf();
    const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
    list.forEach((r, i) => { if (i) pdf.addPage(); drawReceipt(pdf, r); });
    return pdf;
  }
  // Nome di file con sole lettere latine (senza accenti né simboli).
  const latinName = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');
  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function downloadReceipts(list, mode, name) {
    if (!list.length) return;
    try {
      if (mode === 'zip') {
        const JSZip = await loadZip(), zip = new JSZip();
        for (const r of list) zip.file(receiptFile(r), (await receiptsPdf([r])).output('arraybuffer'));
        saveBlob(await zip.generateAsync({ type: 'blob' }), `${name}.zip`);
      } else {
        const pdf = await receiptsPdf(list);
        saveBlob(pdf.output('blob'), list.length === 1 ? receiptFile(list[0]) : `${name}.pdf`);
      }
    } catch (e) { console.error(e); warn('regError', { code: e.message }); }
  }

  // ---------- AMMINISTRAZIONE PAGAMENTI (admin) ----------
  // Ricevute (di qualsiasi mese) intestate a persone non tesserate: si tessera la persona o si cambia l'intestatario.
  function notTessCard() {
    const list = notTessReceipts();
    if (!list.length) return '';
    return `<div class="card warn-card" id="not-tess"><h2><span class="tess-star" aria-hidden="true">★</span> ${esc(t('rcNotTessTitle', { n: list.length }))}</h2>
      <p class="muted small">${esc(t('rcNotTessHelp'))}</p>
      <ul class="reg-list">${list.map(r => `<li><span class="reg-names"><strong>${esc(t('receiptN', { n: rcNum(r) }))} · ${esc(r.person.name)}</strong>${tessStar(r)}<br>
        <small class="muted">${esc(fmtDate(r.issued))} · ${esc(euro(r.amount))} · ${esc(t('rcNotTessTip', { s: seasonOf(r.issued) }))}</small></span>
        <span class="btn-row"><a class="btn small" href="#/athletes" data-action="ath-goto" data-uid="${r.uid}" data-m="${r.issued.slice(0, 7)}">${esc(t('rcTessBtn'))}</a>
        <button class="btn small" data-action="ca-holder-open" data-id="${esc(r.id)}">${esc(t('caHolderBtn'))}</button></span>
        ${ui.caHolder === r.id ? caHolderForm(r) : ''}</li>`).join('')}</ul></div>`;
  }
  function viewPayments() {
    const month = ui.payMonth || curMonth();
    const kind = ui.payKind || 'all';
    const rs = (S().receipts || []).filter(r => r.issued.slice(0, 7) === month && (kind === 'all' || r.kind === kind)).sort((a, b) => b.year - a.year || b.n - a.n);
    const valid = rs.filter(r => !r.void);
    const tot = PAY_METHODS.map(m => [m, valid.filter(r => r.method === m).reduce((s, r) => s + r.amount, 0)]);
    const plans = (S().plans || []).filter(p => p.month === month && (p.tids || []).length);
    const due = plans.filter(p => !planPaid(p)).sort((a, b) => coachName(a.uid).localeCompare(coachName(b.uid)));
    const name = r => (r.person || {}).name || coachName(r.uid);
    return `<div class="page-head row"><h1><i class="ti ti-cash-register" aria-hidden="true"></i> ${esc(t('payAdminTitle'))}</h1>
        <span class="btn-row"><a class="btn small" href="#/report"><i class="ti ti-report-analytics" aria-hidden="true"></i> ${esc(t('rpTitle'))} →</a>
        <a class="btn small" href="#/athletes"><i class="ti ti-id-badge-2" aria-hidden="true"></i> ${esc(t('athTitle'))} →</a></span></div>
      <div class="month-nav card">
        <button class="btn small" data-action="pay-month" data-m="${shiftMonth(month, -1)}" aria-label="${esc(t('prevMonth'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong>${esc(monthLabel(month))}</strong>
        <button class="btn small" data-action="pay-month" data-m="${shiftMonth(month, 1)}" aria-label="${esc(t('nextMonth'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        <select data-change="pay-kind" aria-label="${esc(t('payKind'))}">${['all', 'month', 'pack', 'spot', 'fitp', 'cassa'].map(k => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(t('payKind_' + k))}</option>`).join('')}</select>
      </div>
      <div class="stats-row">
        <div class="stat"><span>${esc(t('payTotal'))}</span><strong>${esc(euro(valid.reduce((s, r) => s + r.amount, 0)))}</strong><small class="muted">${esc(t('receiptsCount', { n: valid.length }))}</small></div>
        ${tot.map(([m, v]) => `<div class="stat"><span>${esc(t('pay_' + m))}</span><strong>${esc(euro(v))}</strong></div>`).join('')}
      </div>
      <div class="card">
        <h2><i class="ti ti-alert-circle" aria-hidden="true"></i> ${esc(t('payMissing', { m: monthLabel(month) }))} (${due.length})</h2>
        <p class="muted small">${esc(t('payMissingHelp'))}</p>
        ${due.length ? `<ul class="reg-list">${due.map(p => `<li><span class="reg-names"><strong>${esc(coachName(p.uid))}</strong> ${payBadge(p)}<br><small class="muted">${esc(t('planN', { n: p.n }))} · ${esc(euro(p.price))}</small></span>
          <a class="btn small" href="#/athletes" data-action="ath-goto" data-uid="${p.uid}" data-m="${month}">${esc(t('athOpen'))}</a></li>`).join('')}</ul>` : `<p class="muted">${esc(t('payAllPaid'))}</p>`}
      </div>
      ${notTessCard()}
      ${revenueCard(month)}
      <div class="card">
        <h2><i class="ti ti-receipt" aria-hidden="true"></i> ${esc(t('receiptsTitle'))} (${rs.length})</h2>
        ${rs.length ? `<div class="btn-row"><button class="btn" data-action="rc-bulk" data-mode="pdf"><i class="ti ti-file-type-pdf" aria-hidden="true"></i> ${esc(t('receiptsPdfAll'))}</button>
          <button class="btn" data-action="rc-bulk" data-mode="zip"><i class="ti ti-file-zip" aria-hidden="true"></i> ${esc(t('receiptsZip'))}</button></div>
        <ul class="reg-list">${rs.map(r => `<li class="${r.void ? 'is-void' : ''}"><span class="reg-names"><strong>${esc(t('receiptN', { n: rcNum(r) }))} · ${esc((r.person && r.person.name) || t('caNoHolder'))}</strong>${tessStar(r)}
          ${r.void ? ` <span class="badge st-full">${esc(t('receiptVoid'))}</span>` : ''}<br>
          <small class="muted">${esc(fmtDate(r.issued))} · ${esc(euro(r.amount))} · ${esc(t('pay_' + r.method))} · ${esc(r.causale)}</small></span>
          <span class="btn-row"><button class="btn small" data-action="rc-pdf" data-id="${esc(r.id)}"><i class="ti ti-download" aria-hidden="true"></i> PDF</button>
          <button class="btn small" data-action="rc-renum" data-id="${esc(r.id)}"><i class="ti ti-hash" aria-hidden="true"></i> ${esc(t('receiptRenum'))}</button>
          ${r.void ? '' : `<button class="btn small" data-action="ca-holder-open" data-id="${esc(r.id)}">${esc(t('caHolderBtn'))}</button>
          <button class="btn small danger" data-action="rc-void" data-id="${esc(r.id)}">${esc(t('receiptVoidBtn'))}</button>`}</span>
          ${ui.caHolder === r.id ? caHolderForm(r) : ''}</li>`).join('')}</ul>`
          : `<p class="muted">${esc(t('receiptsNone'))}</p>`}
      </div>`;
  }

  // Ricevute del corsista (profilo)
  function myReceiptsCard() {
    const m = self();
    const rs = m ? (S().receipts || []).filter(r => r.uid === m.uid && !r.void).sort((a, b) => b.year - a.year || b.n - a.n) : [];
    if (!rs.length) return '';
    return `<div class="card" id="my-receipts"><h2><i class="ti ti-receipt" aria-hidden="true"></i> ${esc(t('myReceipts'))}</h2>
      <ul class="reg-list">${rs.map(r => `<li><span class="reg-names"><strong>${esc(t('receiptN', { n: rcNum(r) }))}</strong> · ${esc(euro(r.amount))}<br><small class="muted">${esc(fmtDate(r.payDate))} · ${esc(r.causale)}</small></span>
        <button class="btn small" data-action="rc-pdf" data-id="${esc(r.id)}"><i class="ti ti-download" aria-hidden="true"></i> PDF</button></li>`).join('')}</ul></div>`;
  }

  const payActions = {
    'pay-open': el => { ui.payFor = el.dataset.key; render(); },
    'pay-close': () => { ui.payFor = null; render(); },
    'pay-month': el => { ui.payMonth = el.dataset.m; render(); },
    'pay-undo': el => { if (confirmed('payUndoConfirm')) window.Cloud.unpay(el.dataset.kind, el.dataset.ref, el.dataset.iid).then(() => render()).catch(trErr); },
    'rc-pdf': el => { const r = receiptById(el.dataset.id); if (r) downloadReceipts([r], 'pdf'); },
    // Cambia il numero di una ricevuta: da quella in poi (stesso anno) la numerazione prosegue in ordine.
    'rc-renum': el => {
      const r = receiptById(el.dataset.id);
      if (!r) return;
      const v = prompt(t('receiptRenumPrompt', { n: rcNum(r) }), String(r.n));
      if (v === null) return;
      const x = parseInt(v, 10);
      if (!(x >= 1) || x === r.n) return;
      const year = (S().receipts || []).filter(q => q.year === r.year && rSeries(q) === rSeries(r)).sort((a, b) => a.n - b.n || (a.created || 0) - (b.created || 0));
      const from = year.filter(q => q.n > r.n || q.id === r.id);   // la ricevuta scelta e le successive
      const before = year.filter(q => !from.includes(q));
      const changes = from.map((q, i) => ({ r: q, n: x + i }));
      const clash = changes.filter(c => before.some(q => q.n === c.n)).map(c => c.n);
      if (clash.length && !confirmed('receiptRenumClash', { l: clash.join(', ') })) return;
      if (!confirmed('receiptRenumConfirm', { a: rcNum(r), b: `${x}/${rSeries(r)}/${r.year}`, k: changes.length })) return;
      // dove compare il numero: piani (anche trimestrali), spot, prepagati nella scheda
      const links = [];
      changes.forEach(({ r: q, n }) => {
        const rn = `${n}/${rSeries(q)}/${q.year}`;
        if (q.incasso) links.push({ col: 'incassi', id: q.incasso, field: `receipts.${rSeries(q)}.rn`, rn });
        Object.entries(S().bkpaid || {}).forEach(([gid, bp]) => { if (q.incasso && bp.incasso === q.incasso && rSeries(q) === 'Q') links.push({ col: 'bkpaid', id: gid, field: 'rn', rn }); });
        (S().plans || []).filter(p => p.paid && p.paid.rid === q.id).forEach(p => links.push({ col: 'plans', id: p.id, field: 'paid.rn', rn }));
        (S().spots || []).filter(p => p.paid && p.paid.rid === q.id).forEach(p => links.push({ col: 'spots', id: p.id, field: 'paid.rn', rn }));
        (S().packs || []).filter(p => p.paid && p.paid.rid === q.id).forEach(p => links.push({ col: 'packs', id: p.id, field: 'paid.rn', rn }));
        (S().athletes || []).forEach(a => Object.entries(a.prepaid || {}).forEach(([m, pd]) => { if (pd && pd.rid === q.id) links.push({ col: 'athletes', id: a.id, field: `prepaid.${m}.rn`, rn }); }));
      });
      const last = Math.max(...year.map(q => q.n).filter((n, i) => !from.includes(year[i])), ...changes.map(c => c.n));
      window.Cloud.renumberReceipts(changes.map(c => ({ id: c.r.id, n: c.n })), links, r.year, last, rSeries(r))
        .then(() => { ui.flash = { text: t('receiptRenumDone', { k: changes.length, l: `${last}/${rSeries(r)}/${r.year}` }) }; render(); }).catch(trErr);
    },
    'rc-void': el => {
      const r = receiptById(el.dataset.id);
      if (!r) return;
      // ricevuta della cassa: si annulla l'intero incasso (anche l'eventuale ricevuta dell'altra serie)
      const inc = r.kind === 'cassa' && (S().incassi || []).find(i => i.id === r.incasso);
      if (inc) { if (confirmed('caVoidConfirm', { n: rcNum(r) })) window.Cloud.voidIncasso(inc).then(() => { ui.flash = { text: t('receiptVoided') }; render(); }).catch(trErr); return; }
      if (confirmed('receiptVoidConfirm', { n: rcNum(r) })) window.Cloud.voidReceipt(r, (S().plans || []).filter(x => x.uid === r.uid && (r.months || []).includes(x.month) && x.paid && x.paid.rid === r.id).map(x => x.id)).then(() => { ui.flash = { text: t('receiptVoided') }; render(); }).catch(trErr);
    },
    'rc-bulk': el => {
      const month = ui.payMonth || curMonth(), kind = ui.payKind || 'all';
      const rs = (S().receipts || []).filter(r => r.issued.slice(0, 7) === month && (kind === 'all' || r.kind === kind)).sort((a, b) => a.n - b.n);
      downloadReceipts(rs, el.dataset.mode, `ricevute_${month}${kind === 'all' ? '' : '_' + kind}`);
    },
    'ath-goto': el => { ui.athEdit = el.dataset.uid; ui.trMonth = el.dataset.m; location.hash = '#/athletes'; },
    'pack-del': el => {
      const k = packById(el.dataset.id);
      if (k && confirmed('packDelConfirm', { n: k.n })) window.Cloud.deletePack(k.id).then(() => { ui.flash = { text: t('packDeleted') }; render(); }).catch(trErr);
    }
  };
  const payForms = {
    'pack-from': f => {
      const k = packById(f.dataset.id), from = f.from.value;
      if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return;
      window.Cloud.savePack(k.id, { from }).then(() => window.Cloud.recalcPacks([k.uid])).then(() => { ui.flash = { text: t('packFromSaved', { d: fmtDate(from) }) }; render(); }).catch(trErr);
    },
    'pack-new': f => {
      const n = parseInt(f.n.value, 10), price = Math.round(Number(f.price.value || 0) * 100) / 100;
      if (!(n >= 1)) return;
      const m = memberByUid(f.dataset.uid);
      const from = /^\d{4}-\d{2}-\d{2}$/.test(f.from.value) ? f.from.value : todayStr();
      // nuovo pacchetto: si contano anche le presenze già registrate dal giorno di inizio
      window.Cloud.savePack(null, { uid: f.dataset.uid, name: m ? personName(m) : '', n, price, from }).then(() => new Promise(r => setTimeout(r, 600)))
        .then(() => window.Cloud.recalcPacks([f.dataset.uid])).then(() => { ui.flash = { text: t('packCreated', { n }) }; render(); }).catch(trErr);
    },
    'pay-save': f => {
      const kind = f.dataset.kind, ref = f.dataset.ref, uid = f.dataset.uid;
      const obj = kind === 'month' ? (S().plans || []).find(p => p.id === ref) : kind === 'pack' ? packById(ref) : kind === 'fitp' ? fitpObj(uid, ref.split('|')[1]) : (S().spots || []).find(s => s.id === ref);
      if (!obj) return;
      const amount = Math.round(Number(f.amount.value || 0) * 100) / 100;
      const a = Object.assign({}, athleteOf(uid) || {});
      let athlete = null;
      if (f.cf) {   // dati mancanti compilati nel modulo: si salvano anche nella scheda
        athlete = {};
        PERSON_FIELDS.forEach(k => { const v = f[k].value.trim(); if (v) { athlete[k] = k === 'cf' ? v.toUpperCase() : v; a[k] = athlete[k]; } });
        const m = memberByUid(uid);
        if (m) Object.assign(athlete, { first: m.first, last: m.last });
        athlete.updated = Date.now();
        if (!athleteOf(uid)) Object.assign(athlete, { created: Date.now(), tess: {} });
      }
      // ricevuta: solo se richiesta (di base no)
      const receipt = wantReceipt(f);
      if (amount > 0 && receipt && missingPerson(a).length) return warn('payNeedData');
      const course = kind === 'month' && f.period && f.period.value === 'course' && courseMonths().includes(obj.month);
      const quarter = course || (kind === 'month' && f.period && f.period.value === 'quarter');
      const p = { kind, ref, uid, amount, receipt, method: f.method.value, payDate: f.payDate.value, issued: todayStr(), person: personOf(uid, a), athlete,
        causale: course ? causaleCourse() : quarter ? causaleQuarter(obj.month) : kind === 'month' ? causaleMonth(obj.month) : kind === 'pack' ? causalePack(obj) : kind === 'fitp' ? causaleFitp(obj.season) : causaleSpot(obj.date), month: obj.month || '', spotDate: obj.date || '' };
      if (kind === 'fitp') p.season = obj.season;
      if (quarter) {
        // trimestrale: il mese e i due successivi; corso intero: tutti i mesi del corso (dal mese del piano in poi)
        p.quarter = true; p.months = course ? courseMonths().filter(m => m >= obj.month) : quarterMonths(obj.month);
        if (course) p.course = true;
        p.planIds = (S().plans || []).filter(x => x.uid === uid && p.months.includes(x.month)).map(x => x.id);
        if (p.months.slice(1).some(m => prepaidOf(uid, m) || ((S().plans || []).find(x => x.uid === uid && x.month === m) || {}).paid) && !confirmed('payQuarterOverlap')) return;
      }
      window.Cloud.recordPayment(p).then(() => { ui.payFor = null; ui.flash = { text: t(amount > 0 && receipt ? 'paySavedReceipt' : 'paySaved') }; render(); }).catch(trErr);
    }
  };

  // ---------- CASSA: registro degli incassi, ricevute Q (quote sociali) e C (commerciali) ----------
  // Ogni incasso ha una o più righe; le quote sociali vanno nella ricevuta Q, il commerciale nella ricevuta C
  // (numerazioni autonome per anno). La ricevuta si emette solo se richiesta, con qualsiasi modalità.
  const CA_CATS = [['q_train', 'Q'], ['q_fitp', 'Q'], ['q_court', 'Q'], ['c_drink', 'C'], ['c_other', 'C']];
  const caSeries = cat => (CA_CATS.find(c => c[0] === cat) || [, 'C'])[1];
  // descrizione della riga sulla ricevuta (in italiano: è un documento contabile)
  const CA_IT = { q_train: 'Quota sociale allenamenti', q_fitp: 'Quota tesseramento FITP', q_court: 'Quota sociale - prenotazione campo per allenamento', c_drink: 'Bevande', c_other: 'Altro' };
  const caLineDesc = (cat, desc) => (cat === 'c_other' && desc ? desc : CA_IT[cat] + (desc ? ` - ${desc}` : ''));
  const caCausale = (series, lines) => (lines.length === 1 ? lines[0].desc : series === 'Q' ? 'Quote sociali (dettaglio)' : 'Vendita (dettaglio)');
  const bkLabel = b => `${fmtDate(b.date)} ${esc(b.from)}–${esc(b.to)} · ${courtName(b.courtId)}${b.guest ? ' · ' + bkWho(b) : b.userId ? ' · ' + uidName(b.userId) : ''}`;
  const bkItDesc = b => `${itDate(b.date)} ${esc(b.from)}-${esc(b.to)}, ${courtName(b.courtId)}`;
  // prenotazioni da incassare: da ieri in poi, di un utente, non ancora pagate
  // intestatari: solo i tesserati della stagione (elenco "tesserati" con i soli dati della ricevuta)
  const tessFor = date => { const se = seasonOf(date || todayStr()); return (S().tesserati || []).filter(x => (x.seasons || []).includes(se)).sort((a, b) => a.name.localeCompare(b.name)); };
  const isTess = (uid, date) => tessFor(date).some(x => x.id === uid);
  const caBookings = () => (S().bookings || []).filter(b => b.userId && !b.blocked && !(S().bkpaid || {})[b.id]).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));
  // nuovo incasso: qualsiasi utente registrato (i non tesserati vengono segnati con ★ nelle ricevute)
  const caMemberOpts = () => `<option value="">— ${esc(t('caNoHolder'))} —</option>${(S().members || []).slice().sort((a, b) => personName(a).localeCompare(personName(b))).map(m => `<option value="${m.uid}">${esc(personName(m))}${isTess(m.uid) ? '' : ' ★'}</option>`).join('')}`;
  // ricevuta intestata a una persona non tesserata nella stagione della ricevuta
  const rcNotTess = r => !r.void && !!r.uid && !!(r.person && r.person.name) && !isTess(r.uid, r.issued);
  const notTessReceipts = () => (S().receipts || []).filter(rcNotTess).sort((a, b) => (b.issued || '').localeCompare(a.issued || ''));
  const tessStar = r => (rcNotTess(r) ? ` <span class="tess-star" title="${esc(t('rcNotTessTip', { s: seasonOf(r.issued) }))}" aria-label="${esc(t('rcNotTessTip', { s: seasonOf(r.issued) }))}">★</span>` : '');
  const caHolderOpts = (date, sel) => `<option value="">— ${esc(t('caNoHolder'))} —</option>${tessFor(date).map(x => `<option value="${esc(x.id)}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}`;
  function caLineRow() {
    const bks = caBookings();
    return `<div class="ca-line">
      <label class="ca-cat-l">${esc(t('caCat'))}<select name="cat" data-change="ca-cat"><option value="">-</option>${CA_CATS.map(([k, sr]) => `<option value="${k}">${esc(t('caCat_' + k))} (${sr})</option>`).join('')}</select></label>
      <select name="bk" hidden aria-label="${esc(t('caBooking'))}"><option value="">— ${esc(t('caBooking'))} —</option>${bks.map(b => `<option value="${esc(b.id)}">${esc(bkLabel(b))}</option>`).join('')}</select>
      <input name="desc" maxlength="120" placeholder="${esc(t('caDesc'))}" aria-label="${esc(t('caDesc'))}">
      <input name="amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="€" aria-label="${esc(t('payAmount'))}">
    </div>`;
  }
  // incassi del mese + ricevute precedenti alla cassa (pagamenti allenamenti), per il resoconto completo
  function caMonthList(month) {
    const inc = (S().incassi || []).filter(i => i.date.slice(0, 7) === month);
    const legacy = (S().receipts || []).filter(r => !r.incasso && r.kind !== 'cassa' && !r.void && (r.payDate || r.issued || '').slice(0, 7) === month)
      .map(r => ({ id: 'r_' + r.id, legacy: true, date: r.payDate || r.issued, method: r.method, lines: [{ cat: 'q_train', series: 'Q', desc: r.causale, amount: r.amount }], totQ: r.amount, totC: 0, total: r.amount,
        receipts: { Q: { id: r.id, rn: rcNum(r) } }, uid: r.uid, name: (r.person || {}).name || '', void: false, at: r.created || 0, by: r.by }));
    return inc.concat(legacy).sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
  }
  const round2 = v => Math.round(v * 100) / 100;
  function viewCassa() {
    const month = ui.caMonth || curMonth();
    const list = caMonthList(month), ok = list.filter(i => !i.void);
    const sum = f => round2(ok.reduce((s, i) => s + f(i), 0));
    const byCat = CA_CATS.map(([k, sr]) => [k, sr, round2(ok.reduce((s, i) => s + (i.lines || []).filter(l => l.cat === k).reduce((a, l) => a + l.amount, 0), 0))]);
    const who = uid => (uid ? (memberByUid(uid) ? personName(memberByUid(uid)) : uid === myUid() ? t('caMe') : 'Admin') : '');
    const rcBtns = i => Object.entries(i.receipts || {}).map(([sr, r]) => { const rr = receiptById(r.id); return `<span class="badge rc-${sr}">${esc(rr ? rcNum(rr) : r.rn)}</span>${rr ? tessStar(rr) : ''}
      ${rr ? `<button class="btn small" data-action="rc-pdf" data-id="${esc(rr.id)}" aria-label="PDF ${esc(rcNum(rr))}"><i class="ti ti-file-type-pdf" aria-hidden="true"></i></button>` : ''}
      ${rr && admin() && !i.void ? `<button class="btn small" data-action="ca-holder-open" data-id="${esc(rr.id)}">${esc(t('caHolderBtn'))}</button>` : ''}`; }).join(' ');
    return `<div class="page-head row"><h1><i class="ti ti-cash-register" aria-hidden="true"></i> ${esc(t('caTitle'))}</h1>
        ${admin() ? `<a class="btn small" href="#/payments"><i class="ti ti-receipt" aria-hidden="true"></i> ${esc(t('payAdminTitle'))} →</a>` : ''}</div>
      <p class="muted small">${esc(t('caIntro'))}</p>
      <form class="card grid-form ca-form" data-form="ca-save" id="ca-form">
        <h2 class="span-all"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('caNew'))}</h2>
        <label>${esc(t('payDate'))}<input type="date" name="date" required value="${todayStr()}"></label>
        <label>${esc(t('payMethod'))}<select name="method">${PAY_METHODS.map(x => `<option value="${x}">${esc(t('pay_' + x))}</option>`).join('')}</select></label>
        <div class="span-all ca-lines">${caLineRow()}${caLineRow()}</div>
        <div class="span-all"><button type="button" class="btn small" data-action="ca-addline"><i class="ti ti-plus" aria-hidden="true"></i> ${esc(t('caAddLine'))}</button></div>
        <label class="span-all">${esc(t('caHolder'))}<select name="holder">${caMemberOpts()}</select>
          <small class="muted">${esc(t('caHolderTessOnly', { s: seasonOf(todayStr()) }))}</small></label>
        ${rcChecks()}
        ${admin() ? `<details class="span-all"><summary>${esc(t('caInsertTitle'))}</summary><p class="muted small">${esc(t('caInsertHelp'))}</p>
          <label>${esc(t('caInsertN'))}<input type="number" name="insN" min="1" step="1" inputmode="numeric"></label></details>` : ''}
        <div class="form-actions span-all"><button class="btn primary"><i class="ti ti-device-floppy" aria-hidden="true"></i> ${esc(t('caSave'))}</button></div>
      </form>
      <div class="month-nav card">
        <button class="btn small" data-action="ca-month" data-m="${shiftMonth(month, -1)}" aria-label="${esc(t('prevMonth'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong>${esc(monthLabel(month))}</strong>
        <button class="btn small" data-action="ca-month" data-m="${shiftMonth(month, 1)}" aria-label="${esc(t('nextMonth'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
        <button class="btn small" data-action="ca-xlsx" data-m="${month}"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> ${esc(t('caExcel'))}</button>
      </div>
      <div class="stats-row">
        <div class="stat"><span>${esc(t('caTotal'))}</span><strong>${esc(euro(sum(i => i.total)))}</strong><small class="muted">${esc(t('caCount', { n: ok.length }))}</small></div>
        <div class="stat"><span>${esc(t('caTotQ'))}</span><strong>${esc(euro(sum(i => i.totQ || 0)))}</strong></div>
        <div class="stat"><span>${esc(t('caTotC'))}</span><strong>${esc(euro(sum(i => i.totC || 0)))}</strong></div>
        ${PAY_METHODS.map(m => `<div class="stat"><span>${esc(t('pay_' + m))}</span><strong>${esc(euro(sum(i => (i.method === m ? i.total : 0))))}</strong></div>`).join('')}
      </div>
      <div class="card rp-card"><h2><i class="ti ti-chart-pie" aria-hidden="true"></i> ${esc(t('caByCat'))}</h2>
        <div class="table-wrap"><table class="table rp-table"><tbody>${byCat.map(([k, sr, v]) => `<tr><th scope="row">${esc(t('caCat_' + k))} <span class="badge rc-${sr}">${sr}</span></th><td class="num">${esc(euro(v))}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h2><i class="ti ti-list" aria-hidden="true"></i> ${esc(t('caList'))} (${list.length})</h2>
        ${list.length ? `<ul class="reg-list ca-list">${list.map(i => `<li class="${i.void ? 'is-void' : ''}"><span class="reg-names"><strong>${esc(fmtDate(i.date))} · ${esc(euro(i.total))}</strong> · ${esc(t('pay_' + i.method))}
            ${i.void ? ` <span class="badge st-full">${esc(t('caVoided'))}</span>` : ''}${i.name ? ` · ${esc(i.name)}` : ''}
            <br>${(i.lines || []).map(l => `<small class="muted">${esc(t('caCat_' + l.cat))}: ${esc(l.desc)} · ${esc(euro(l.amount))}</small>`).join('<br>')}
            <br><span class="btn-row">${rcBtns(i) || `<small class="muted">${esc(t('caNoReceipt'))}</small>`}${i.by ? ` <small class="muted">${esc(t('caBy', { n: who(i.by) }))}</small>` : ''}</span></span>
          ${admin() && !i.void && !i.legacy ? `<button class="btn small danger" data-action="ca-void" data-id="${esc(i.id)}">${esc(t('caVoidBtn'))}</button>` : ''}
          ${Object.values(i.receipts || {}).some(r => r.id === ui.caHolder) ? caHolderForm(receiptById(ui.caHolder)) : ''}</li>`).join('')}</ul>`
          : `<p class="muted">${esc(t('caNone'))}</p>`}
      </div>`;
  }
  // intestatario della ricevuta (admin): una persona registrata oppure un nome scritto a mano
  function caHolderForm(r) {
    if (!r) return '';
    return `<form class="inline-form ca-holder" data-form="ca-holder" data-id="${esc(r.id)}">
      <label class="small">${esc(t('caHolder'))}<select name="holder">${caHolderOpts(r.issued, r.uid)}</select></label>
      <button class="btn small primary">${esc(t('save'))}</button><button type="button" class="btn small" data-action="ca-holder-close">${esc(t('cancel'))}</button>
      ${(r.holderLog || []).length ? `<small class="muted span-all">${esc(t('caHolderLog'))}: ${(r.holderLog || []).map(h => `${fmtDate(new Date(h.at).toLocaleDateString('sv'))} «${h.from || '—'}» → «${h.to || '—'}»`).map(esc).join(' · ')}</small>` : ''}</form>`;
  }
  // persona per la ricevuta: dati del tesserato (nome, nascita, residenza, codice fiscale), altrimenti nome e sesso
  function caPerson(uid) {
    if (!uid) return null;
    const x = (S().tesserati || []).find(y => y.id === uid);
    if (x) return { name: x.name, gender: x.gender || 'M', birthPlace: x.birthPlace || '', birthDate: x.birthDate || '', city: x.city || '', address: x.address || '', cf: x.cf || '' };
    const a = admin() && athleteOf(uid);
    // dati mancanti nella scheda: campi vuoti (il database non accetta valori indefiniti)
    if (a) return Object.fromEntries(Object.entries(personOf(uid, a)).map(([k, v]) => [k, v == null ? '' : v]));
    const m = memberByUid(uid);
    return m ? { name: `${m.first} ${m.last}`, gender: m.gender || 'M' } : null;
  }
  // dove compare il numero di una ricevuta (piani, spot, pacchetti, prepagati, incassi, campi pagati)
  function rnLinks(q, rn) {
    const links = [];
    (S().plans || []).filter(p => p.paid && p.paid.rid === q.id).forEach(p => links.push({ col: 'plans', id: p.id, field: 'paid.rn', rn }));
    (S().spots || []).filter(p => p.paid && p.paid.rid === q.id).forEach(p => links.push({ col: 'spots', id: p.id, field: 'paid.rn', rn }));
    (S().packs || []).filter(p => p.paid && p.paid.rid === q.id).forEach(p => links.push({ col: 'packs', id: p.id, field: 'paid.rn', rn }));
    (S().athletes || []).forEach(a => Object.entries(a.prepaid || {}).forEach(([m, pd]) => { if (pd && pd.rid === q.id) links.push({ col: 'athletes', id: a.id, field: `prepaid.${m}.rn`, rn }); }));
    if (q.incasso) links.push({ col: 'incassi', id: q.incasso, field: `receipts.${rSeries(q)}.rn`, rn });
    if (q.incasso && rSeries(q) === 'Q') Object.entries(S().bkpaid || {}).forEach(([gid, bp]) => { if (bp.incasso === q.incasso) links.push({ col: 'bkpaid', id: gid, field: 'rn', rn }); });
    return links;
  }
  function caSave(f) {
    const rows = [...f.querySelectorAll('.ca-line')].map(row => ({ cat: row.querySelector('[name=cat]').value, bk: row.querySelector('[name=bk]').value,
      desc: row.querySelector('[name=desc]').value.trim(), amount: Math.round(Number(row.querySelector('[name=amount]').value || 0) * 100) / 100 })).filter(x => x.amount > 0 || x.cat);
    if (rows.some(x => !x.cat)) return warn('caNeedType');
    if (rows.some(x => !(x.amount > 0))) return warn('caNeedAmount');
    if (!rows.length) return warn('caNoLines');
    const bkById = id => (S().bookings || []).find(b => b.id === id);
    if (rows.some(x => x.cat === 'q_court' && !x.bk)) return warn('caNeedBooking');
    const lines = rows.map(x => {
      const b = x.cat === 'q_court' ? bkById(x.bk) : null;
      return Object.assign({ cat: x.cat, series: caSeries(x.cat), amount: x.amount, desc: caLineDesc(x.cat, b ? [bkItDesc(b), x.desc].filter(Boolean).join(' - ') : x.desc) }, b ? { ref: { kind: 'booking', id: b.id } } : {});
    });
    const method = f.method.value, date = f.date.value;
    const want = wantReceipt(f);
    // intestatario: un tesserato scelto, oppure chi ha prenotato il campo (se tesserato); altrimenti senza nome
    let uid = f.holder.value;
    if (!uid) { const b = rows.map(x => x.cat === 'q_court' && bkById(x.bk)).find(Boolean); if (b && b.userId) uid = b.userId; }
    const person = caPerson(uid);
    const p = { date, method, lines, uid, person, receipt: { Q: want, C: want }, causale: { Q: caCausale('Q', lines.filter(l => l.series === 'Q')), C: caCausale('C', lines.filter(l => l.series === 'C')) } };
    const tq = round2(lines.filter(l => l.series === 'Q').reduce((s, l) => s + l.amount, 0)), tc = round2(lines.filter(l => l.series === 'C').reduce((s, l) => s + l.amount, 0));
    const insN = f.insN && f.insN.value ? parseInt(f.insN.value, 10) : 0;
    if (insN) {
      // inserimento con numero scelto: una sola serie e ricevuta emessa
      const series = tq && tc ? null : tq ? 'Q' : 'C';
      if (!series) return warn('caInsertOneSeries');
      const year = +date.slice(0, 4);
      const same = (S().receipts || []).filter(r => r.year === year && rSeries(r) === series);
      const shifts = same.filter(r => r.n >= insN).sort((a, b) => b.n - a.n).map(q => ({ id: q.id, n: q.n + 1, links: rnLinks(q, `${q.n + 1}/${series}/${year}`) }));
      const last = Math.max(insN, ...same.map(r => (r.n >= insN ? r.n + 1 : r.n)));
      if (!confirmed('caInsertConfirm', { n: `${insN}/${series}/${year}`, k: shifts.length })) return;
      return window.Cloud.insertIncasso(p, series, insN, shifts, last).then(() => { ui.flash = { text: t('caSaved') }; render(); }).catch(trErr);
    }
    const what = [tq ? t('caConfirmQ', { v: euro(tq) }) : '', tc ? t('caConfirmC', { v: euro(tc) }) : ''].filter(Boolean).join(' + ');
    if (!confirmed(want ? 'caConfirmRc' : 'caConfirmNoRc', { w: what, m: t('pay_' + method), h: (person && person.name) || t('caNoHolder') })) return;
    f.querySelector('button.primary').disabled = true;
    // quota del tesseramento FITP incassata in cassa: la persona risulta tesserata per la stagione (admin e segreteria)
    const fitpUid = admin() && uid && lines.some(l => l.cat === 'q_fitp') ? uid : null;
    window.Cloud.recordIncasso(p).then(() => { if (fitpUid) window.Cloud.saveAthlete(fitpUid, { tess: { [seasonOf(date)]: true }, updated: Date.now() }).catch(() => {}); ui.flash = { text: t(want ? 'caSavedRc' : 'caSaved') }; render(); }).catch(e => { f.querySelector('button.primary').disabled = false; trErr(e); });
  }
  // prospetto mensile in Excel: incassi riga per riga, riepilogo per categoria e modalità, ricevute
  async function caXlsx(month) {
    const list = caMonthList(month), ok = list.filter(i => !i.void);
    const who = uid => (memberByUid(uid) ? personName(memberByUid(uid)) : '');
    const rowsI = [['Data', 'Modalità', 'Categoria', 'Serie', 'Descrizione', 'Importo', 'Ricevuta', 'Intestatario', 'Registrato da', 'Annullato']];
    list.slice().reverse().forEach(i => (i.lines || []).forEach(l => rowsI.push([itDate(i.date), PAY_IT[i.method] || i.method, t('caCat_' + l.cat), l.series, l.desc, l.amount,
      ((i.receipts || {})[l.series] || {}).rn || '', i.name || '', who(i.by), i.void ? 'sì' : ''])));
    const rowsS = [['Voce', 'Serie', 'Importo']].concat(CA_CATS.map(([k, sr]) => [t('caCat_' + k), sr, round2(ok.reduce((s, i) => s + (i.lines || []).filter(l => l.cat === k).reduce((a, l) => a + l.amount, 0), 0))]))
      .concat([['Totale quote sociali', 'Q', round2(ok.reduce((s, i) => s + (i.totQ || 0), 0))], ['Totale commerciale', 'C', round2(ok.reduce((s, i) => s + (i.totC || 0), 0))]])
      .concat(PAY_METHODS.map(m => [`Totale ${PAY_IT[m]}`, '', round2(ok.reduce((s, i) => s + (i.method === m ? i.total : 0), 0))]))
      .concat([['Totale', '', round2(ok.reduce((s, i) => s + i.total, 0))]]);
    const rs = (S().receipts || []).filter(r => (r.issued || '').slice(0, 7) === month).sort((a, b) => rSeries(a).localeCompare(rSeries(b)) || a.n - b.n);
    const rowsR = [['Numero', 'Serie', 'Data', 'Intestatario', 'Importo', 'Modalità', 'Causale', 'Annullata']].concat(rs.map(r => [rcNum(r), rSeries(r), itDate(r.issued), (r.person || {}).name || '', r.amount, PAY_IT[r.method] || r.method, r.causale, r.void ? 'sì' : '']));
    saveBlob(await makeXlsx([{ name: 'Incassi', rows: rowsI, money: [5] }, { name: 'Riepilogo', rows: rowsS, money: [2] }, { name: 'Ricevute', rows: rowsR, money: [4] }]), `prospetto_incassi_${month}.xlsx`);
  }
  const cassaActions = {
    'ca-month': el => { ui.caMonth = el.dataset.m; render(); },
    'ca-addline': () => { const box = document.querySelector('#ca-form .ca-lines'); if (box) box.insertAdjacentHTML('beforeend', caLineRow()); },
    'ca-xlsx': el => { caXlsx(el.dataset.m).catch(e => { console.error(e); warn('regError', { code: e.message }); }); },
    'ca-void': el => {
      const i = (S().incassi || []).find(x => x.id === el.dataset.id);
      if (i && confirmed('caVoidConfirm', { n: `${fmtDate(i.date)} · ${euro(i.total)}` })) window.Cloud.voidIncasso(i).then(() => { ui.flash = { text: t('caVoidedDone') }; render(); }).catch(trErr);
    },
    'ca-holder-open': el => { ui.caHolder = el.dataset.id; render(); },
    'ca-holder-close': () => { ui.caHolder = null; render(); }
  };
  const cassaForms = {
    'ca-save': f => caSave(f),
    'ca-holder': f => {
      const r = receiptById(f.dataset.id);
      if (!r) return;
      const uid = f.holder.value, person = caPerson(uid);
      if (uid && !isTess(uid, r.issued)) return warn('caNotTess');
      window.Cloud.setReceiptHolder(r, uid, person).then(() => { ui.caHolder = null; ui.flash = { text: t('caHolderSaved') }; render(); }).catch(trErr);
    }
  };

  // ---------- REPORT PRESENZE, RICAVI PER ALLENAMENTO E BACKUP MENSILE (admin) ----------
  // Presenze, spot e giornate dei periodi passati si leggono dal database solo quando servono (rpCache).
  const rpCache = {};
  function rangeData(from, to) {
    const k = `${from}_${to}`;
    if (rpCache[k] && rpCache[k] !== 'loading') return rpCache[k];
    if (!rpCache[k]) {
      rpCache[k] = 'loading';
      window.Cloud.loadTrainingRange(from, to).then(d => { rpCache[k] = d; render(); }).catch(e => { delete rpCache[k]; trErr(e); });
    }
    return null;
  }
  const monthEnd = m => addDays(shiftMonth(m, 1) + '-01', -1);
  const quarterStart = d => `${d.slice(0, 4)}-${String(Math.floor((+d.slice(5, 7) - 1) / 3) * 3 + 1).padStart(2, '0')}`;
  // periodo del report: settimana (lun–dom), mese, trimestre solare
  function rpPeriod(per, ref) {
    if (per === 'week') { const f = weekStart(ref); return { from: f, to: addDays(f, 6), label: t('weekOf', { a: fmtDate(f), b: fmtDate(addDays(f, 6)) }), prev: addDays(f, -7), next: addDays(f, 7) }; }
    if (per === 'quarter') { const q = quarterStart(ref); return { from: q + '-01', to: monthEnd(shiftMonth(q, 2)), label: `${monthLabel(q)} – ${monthLabel(shiftMonth(q, 2))}`, prev: shiftMonth(q, -3) + '-01', next: shiftMonth(q, 3) + '-01' }; }
    const m = ref.slice(0, 7);
    return { from: m + '-01', to: monthEnd(m), label: monthLabel(m), prev: shiftMonth(m, -1) + '-01', next: shiftMonth(m, 1) + '-01' };
  }
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 86400000) + 1;
  // Sessioni svolte nel periodo (già iniziate, non annullate) con i conteggi:
  // gruppo presenti / assenti / senza risposta (contano come assenti), spot e recuperi confermati.
  function rpSessions(from, to, d) {
    const now = Date.now();
    const occ = {}, att = {}, sp = {};
    d.occ.forEach(o => { occ[`${o.tid}_${o.date}`] = o; });
    d.att.forEach(a => { att[`${a.tid}_${a.date}_${a.uid}`] = a.status; });
    d.spots.filter(s => s.status === 'ok').forEach(s => { (sp[`${s.tid}_${s.date}`] = sp[`${s.tid}_${s.date}`] || []).push(s); });
    return occurrences(from, daysBetween(from, to)).filter(({ tr, date }) => trStartMs(tr, date) <= now && !(occ[`${esc(tr.id)}_${date}`] || {}).cancelled).map(({ tr, date }) => {
      const g = extraDay(date, tr) ? null : groupOf(tr.id, date.slice(0, 7)), uids = extraDay(date, tr) ? ((occ[`${esc(tr.id)}_${date}`] || {}).members || []) : (g && g.uids) || [];
      const st = uids.map(u => att[`${esc(tr.id)}_${date}_${u}`]);
      const sps = sp[`${esc(tr.id)}_${date}`] || [];
      return { tr, date, enrolled: uids.length, in: st.filter(x => x === 'in').length, out: st.filter(x => x === 'out').length, nr: st.filter(x => !x).length,
        spot: sps.filter(s => !s.recovery).length, rec: sps.filter(s => s.recovery).length };
    });
  }
  // somma per chiave (allenamento, livello, allenatore, giorno)
  function rpGroup(list, keyOf, labelOf) {
    const m = new Map();
    list.forEach(s => {
      const k = keyOf(s);
      const r = m.get(k) || { key: k, label: labelOf(s), n: 0, enrolled: 0, in: 0, out: 0, nr: 0, spot: 0, rec: 0, cap: 0 };
      r.n++; r.enrolled += s.enrolled; r.in += s.in; r.out += s.out; r.nr += s.nr; r.spot += s.spot; r.rec += s.rec; r.cap += s.tr.max || 0;
      m.set(k, r);
    });
    return [...m.values()].map(r => Object.assign(r, { tot: r.in + r.spot + r.rec, avg: r.n ? (r.in + r.spot + r.rec) / r.n : 0,
      pct: r.enrolled ? r.in / r.enrolled : null, fill: r.cap ? (r.in + r.spot + r.rec) / r.cap : null }));
  }
  const pctTxt = v => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const num1 = v => v.toLocaleString(I18n.locale(), { maximumFractionDigits: 1 });
  const RP_COLS = ['rpSessions', 'rpEnrolled', 'rpIn', 'rpOut', 'rpNoReply', 'rpSpot', 'rpRec', 'rpTotal', 'rpAvg', 'rpPct', 'rpFill'];
  const rpCells = r => [r.n, r.enrolled, r.in, r.out, r.nr, r.spot, r.rec, r.tot, num1(r.avg), pctTxt(r.pct), pctTxt(r.fill)];
  // pick: le righe diventano pulsanti (per allenamento: apre la visione per corsisti)
  function rpTable(title, icon, rows, pick) {
    return `<div class="card rp-card"><h2><i class="ti ti-${icon}" aria-hidden="true"></i> ${esc(title)}</h2>
      ${pick && rows.length ? `<p class="muted small">${esc(t('rpAthHint'))}</p>` : ''}
      ${rows.length ? `<div class="table-wrap"><table class="table rp-table"><thead><tr><th></th>${RP_COLS.map(c => `<th class="num">${esc(t(c))}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr${pick && ui.rpTid === r.key ? ' class="rp-sel"' : ''}><th scope="row">${pick ? `<button class="linkish" data-action="rp-tr" data-tid="${esc(r.key)}" aria-expanded="${ui.rpTid === r.key}">${esc(r.label)}</button>` : esc(r.label)}</th>${rpCells(r).map(v => `<td class="num">${esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : `<p class="muted">${esc(t('rpNone'))}</p>`}</div>`;
  }
  // Visione per corsisti di un allenamento: per ogni persona del gruppo, presenze e assenze negli allenamenti
  // svolti nel periodo (il gruppo è quello del mese di ciascun allenamento) e recuperi già fatti nel periodo.
  function rpAthletes(tid, from, to, d) {
    const att = {}, rows = new Map();
    d.att.forEach(a => { att[`${a.tid}_${a.date}_${a.uid}`] = a.status; });
    const ss = rpSessions(from, to, d).filter(s => s.tr.id === tid).sort((a, b) => a.date.localeCompare(b.date));
    ss.forEach(s => {
      const g = extraDay(s.date, s.tr) ? null : groupOf(tid, s.date.slice(0, 7));
      ((g && g.uids) || []).forEach(u => {
        const r = rows.get(u) || { uid: u, name: (g.names || {})[u] || coachName(u), in: 0, out: 0, nr: 0, rec: 0, days: [] };
        const st = att[`${tid}_${s.date}_${u}`];
        if (st === 'in') r.in++; else if (st === 'out') r.out++; else r.nr++;
        r.days.push({ date: s.date, st: st === 'in' ? 'in' : st === 'out' ? 'out' : 'nr' });
        rows.set(u, r);
      });
    });
    d.spots.filter(s => s.status === 'ok' && s.recovery && rows.has(s.uid)).forEach(s => { rows.get(s.uid).rec++; });
    const list = [...rows.values()].map(r => Object.assign(r, { abs: r.out + r.nr }))
      .sort((a, b) => b.abs - a.abs || a.name.localeCompare(b.name));
    return { sessions: ss.length, list };
  }
  function rpAthCard(r) {
    const tr = trainingById(ui.rpTid);
    if (!tr) return '';
    const a = rpAthletes(tr.id, r.p.from, r.p.to, r.d);
    const mark = { in: ['check', 'rpAthIn'], out: ['x', 'rpAthOut'], nr: ['question-mark', 'rpAthNr'] };
    return `<div class="card rp-card rp-ath" id="rp-ath">
      <div class="rp-ath-head"><h2><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('rpAthTitle', { tr: `${trTitle(tr)} · ${trLabel(tr)}` }))}</h2>
        <button class="btn small" data-action="rp-tr" data-tid=""><i class="ti ti-x" aria-hidden="true"></i> ${esc(t('close'))}</button></div>
      <p class="muted small">${esc(t('rpAthHelp', { p: r.p.label, n: a.sessions }))}</p>
      ${a.list.length ? `<ul class="rp-ath-list">${a.list.map(x => `<li class="rp-ath-row">
          <div class="rp-ath-top"><strong>${esc(x.name)}</strong>
            <span class="rp-ath-nums"><span class="rp-pill rp-in">${esc(t('rpAthInN', { n: x.in }))}</span><span class="rp-pill ${x.abs ? 'rp-out' : ''}">${esc(t('rpAthOutN', { n: x.abs }))}</span>
            ${x.nr ? `<span class="rp-pill rp-nr">${esc(t('rpAthNrN', { n: x.nr }))}</span>` : ''}${x.rec ? `<span class="rp-pill">${esc(t('rpAthRecN', { n: x.rec }))}</span>` : ''}</span></div>
          <span class="rp-days">${x.days.map(dd => `<span class="rp-day rp-${dd.st}" title="${esc(`${fmtDate(dd.date)}: ${t(mark[dd.st][1])}`)}"><i class="ti ti-${mark[dd.st][0]}" aria-hidden="true"></i>${esc(fmtDate(dd.date))}<span class="sr-only"> ${esc(t(mark[dd.st][1]))}</span></span>`).join('')}</span>
        </li>`).join('')}</ul>
        <p class="muted small">${esc(t('rpAthLegend'))}</p>`
        : `<p class="muted">${esc(t('rpAthNone'))}</p>`}</div>`;
  }
  function rpData() {
    const per = ui.rpPer || 'month', p = rpPeriod(per, ui.rpRef || todayStr());
    const d = rangeData(p.from, p.to);
    if (!d) return { per, p, loading: true };
    const ss = rpSessions(p.from, p.to, d);
    const byTr = rpGroup(ss, s => s.tr.id, s => `${trTitle(s.tr)} · ${trLabel(s.tr)}`);
    const byLvl = rpGroup(ss, s => s.tr.level, s => t('fpLevel_' + s.tr.level)).sort((a, b) => LEVELS.indexOf(a.key) - LEVELS.indexOf(b.key));
    const byCoach = rpGroup(ss, s => s.tr.coachUid || '', s => (s.tr.coachUid ? coachName(s.tr.coachUid) : t('rpNoCoach'))).sort((a, b) => a.label.localeCompare(b.label));
    const byDay = rpGroup(ss, s => s.tr.dow, s => { const x = dayName(s.tr.dow); return x.charAt(0).toUpperCase() + x.slice(1); }).sort((a, b) => a.key - b.key);
    return { per, p, d, ss, byTr, byLvl, byCoach, byDay, all: rpGroup(ss, () => 'all', () => t('rpAll'))[0] };
  }
  function viewReport() {
    const r = rpData();
    const head = `<div class="page-head row"><h1><i class="ti ti-report-analytics" aria-hidden="true"></i> ${esc(t('rpTitle'))}</h1>
        <a class="btn small" href="#/payments"><i class="ti ti-cash-register" aria-hidden="true"></i> ${esc(t('payAdminTitle'))} →</a></div>
      <div class="month-nav card">
        <div class="segmented" role="group">${['week', 'month', 'quarter'].map(k => `<button class="${r.per === k ? 'active' : ''}" aria-pressed="${r.per === k}" data-action="rp-per" data-p="${k}">${esc(t('rpPer_' + k))}</button>`).join('')}</div>
        <button class="btn small" data-action="rp-ref" data-d="${r.p.prev}" aria-label="${esc(t('prevPeriod'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong>${esc(r.p.label)}</strong>
        <button class="btn small" data-action="rp-ref" data-d="${r.p.next}" aria-label="${esc(t('nextPeriod'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
      </div>`;
    if (r.loading) return head + `<div class="empty"><i class="ti ti-loader-2" aria-hidden="true"></i> ${esc(t('rpLoading'))}</div>`;
    const a = r.all || { n: 0, tot: 0, avg: 0, pct: null, fill: null };
    return head + `<p class="muted small">${esc(t('rpHelp'))}</p>
      <div class="stats-row">
        <div class="stat"><span>${esc(t('rpSessions'))}</span><strong>${a.n}</strong></div>
        <div class="stat"><span>${esc(t('rpTotal'))}</span><strong>${a.tot}</strong><small class="muted">${esc(t('rpAvgShort', { v: num1(a.avg) }))}</small></div>
        <div class="stat"><span>${esc(t('rpPct'))}</span><strong>${pctTxt(a.pct)}</strong></div>
        <div class="stat"><span>${esc(t('rpFill'))}</span><strong>${pctTxt(a.fill)}</strong></div>
      </div>
      ${r.ss.length ? `<div class="btn-row"><button class="btn primary" data-action="rp-xlsx"><i class="ti ti-file-spreadsheet" aria-hidden="true"></i> ${esc(t('rpExcel'))}</button></div>
      <div class="charts-2 card">
        ${barChart(t('rpChartDay'), r.byDay.map(x => ({ label: x.label.slice(0, 3), full: x.label, v: x.tot })), t('rpUnit'))}
        ${barChart(t('rpChartLevel'), r.byLvl.map(x => ({ label: x.label, v: x.tot })), t('rpUnit'))}
      </div>` : ''}
      ${rpTable(t('rpByTraining'), 'barbell', r.byTr, true)}
      ${ui.rpTid ? rpAthCard(r) : ''}
      ${rpTable(t('rpByLevel'), 'stairs', r.byLvl)}
      ${rpTable(t('rpByCoach'), 'school', r.byCoach)}
      ${rpTable(t('rpByDay'), 'calendar-week', r.byDay)}`;
  }

  // Ricavi per allenamento di un mese (ripartizione equa):
  // quota mensile divisa tra gli allenamenti del piano (trimestrale: importo / 3), spot e recuperi all'allenamento,
  // pacchetti: prezzo / numero di allenamenti per ogni allenamento scalato. "Da incassare" = quote e spot non pagati.
  function revenueRows(month, d) {
    const rows = new Map();
    const row = tid => { if (!rows.has(tid)) { const tr = trainingById(tid); rows.set(tid, { tid, label: tr ? `${trTitle(tr)} · ${trLabel(tr)}` : t('rpDeleted'), plans: 0, spot: 0, pack: 0, due: 0 }); } return rows.get(tid); };
    (S().plans || []).filter(p => p.month === month && (p.tids || []).length).forEach(p => {
      const pd = planPaid(p), amount = pd ? (pd.quarter ? (pd.amount || 0) / ((pd.months || []).length || 3) : (pd.amount != null ? pd.amount : p.price || 0)) : (p.price || 0);
      p.tids.forEach(tid => { const r = row(tid); r.plans += amount / p.tids.length; if (!pd) r.due += amount / p.tids.length; });
    });
    d.spots.filter(s => s.status === 'ok' && s.date.slice(0, 7) === month && !s.packBack).forEach(s => {
      const r = row(s.tid);
      if (s.pack) { const k = packById(s.pack); r.pack += k && k.n ? (k.price || 0) / k.n : 0; }
      else { r.spot += s.price || 0; if (!s.paid && s.price) r.due += s.price; }
    });
    const round = v => Math.round(v * 100) / 100;
    return [...rows.values()].map(r => Object.assign(r, { plans: round(r.plans), spot: round(r.spot), pack: round(r.pack), due: round(r.due), tot: round(r.plans + r.spot + r.pack) }))
      .sort((a, b) => b.tot - a.tot);
  }
  function revenueCard(month) {
    const d = rangeData(month + '-01', monthEnd(month));
    if (!d) return `<div class="card"><h2><i class="ti ti-chart-pie" aria-hidden="true"></i> ${esc(t('revTitle', { m: monthLabel(month) }))}</h2><p class="muted">${esc(t('rpLoading'))}</p></div>`;
    const rows = revenueRows(month, d), sum = k => rows.reduce((s, r) => s + r[k], 0);
    return `<div class="card rp-card" id="revenue"><h2><i class="ti ti-chart-pie" aria-hidden="true"></i> ${esc(t('revTitle', { m: monthLabel(month) }))}</h2>
      <p class="muted small">${esc(t('revHelp'))}</p>
      ${rows.length ? `<div class="table-wrap"><table class="table rp-table"><thead><tr><th></th>${['revPlans', 'revSpot', 'revPack', 'revTotal', 'revDue'].map(c => `<th class="num">${esc(t(c))}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr><th scope="row">${esc(r.label)}</th>${[r.plans, r.spot, r.pack, r.tot, r.due].map(v => `<td class="num">${esc(euro(v))}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><th scope="row">${esc(t('rpAll'))}</th>${['plans', 'spot', 'pack', 'tot', 'due'].map(k => `<td class="num"><b>${esc(euro(sum(k)))}</b></td>`).join('')}</tr></tfoot></table></div>`
        : `<p class="muted">${esc(t('rpNone'))}</p>`}
      <div class="btn-row"><button class="btn primary" data-action="backup-xlsx" data-m="${month}"><i class="ti ti-database-export" aria-hidden="true"></i> ${esc(t('backupBtn', { m: monthLabel(month) }))}</button></div>
      <p class="muted small">${esc(t('trBackupHelp'))}</p></div>`;
  }

  // ---------- file Excel (.xlsx) generato nel browser (JSZip in vendor/jszip) ----------
  let xlZipPromise = null;
  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!xlZipPromise) xlZipPromise = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/jszip/jszip.min.js'; sc.onload = () => resolve(window.JSZip); sc.onerror = () => { xlZipPromise = null; reject(new Error('zip')); };
      document.head.appendChild(sc);
    });
    return xlZipPromise;
  }
  const xmlEsc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  // sheets = [{ name, rows: [[intestazioni], [valori]…], money: [indici delle colonne in euro] }]
  async function makeXlsx(sheets) {
    const JSZip = await loadZip(), z = new JSZip();
    const names = sheets.map((s, i) => xmlEsc(s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Foglio${i + 1}`));
    z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
    z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
    z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    // stili: 0 normale, 1 intestazione in grassetto, 2 euro (#.##0,00 €)
    z.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    sheets.forEach((s, i) => {
      const money = new Set(s.money || []);
      const widths = (s.rows[0] || []).map((_, c) => Math.min(60, Math.max(8, ...s.rows.map(r => String(r[c] == null ? '' : r[c]).length + 2))));
      const body = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
        const ref = colName(ci) + (ri + 1);
        if (v == null || v === '') return '';
        if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${ri && money.has(ci) ? ' s="2"' : ''}><v>${v}</v></c>`;
        return `<c r="${ref}" t="inlineStr"${ri ? '' : ' s="1"'}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
      }).join('')}</row>`).join('');
      z.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData></worksheet>`);
    });
    return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const rpXlRows = list => [['', ...RP_COLS.map(c => t(c))]].concat(list.map(r => [r.label, r.n, r.enrolled, r.in, r.out, r.nr, r.spot, r.rec, r.tot, Math.round(r.avg * 10) / 10,
    r.pct == null ? '' : Math.round(r.pct * 1000) / 10, r.fill == null ? '' : Math.round(r.fill * 1000) / 10]));
  async function reportXlsx() {
    const r = rpData();
    if (r.loading) return;
    const sessions = [['Data', 'Allenamento', 'Livello', 'Allenatore', 'Iscritti', 'Presenti', 'Assenti', 'Senza risposta', 'Spot', 'Recuperi', 'Totale presenti']]
      .concat(r.ss.slice().sort((a, b) => (a.date + a.tr.from).localeCompare(b.date + b.tr.from)).map(s => [itDate(s.date), `${trTitle(s.tr)} ${s.tr.from}–${s.tr.to}`, t('fpLevel_' + s.tr.level),
        s.tr.coachUid ? coachName(s.tr.coachUid) : '', s.enrolled, s.in, s.out, s.nr, s.spot, s.rec, s.in + s.spot + s.rec]));
    const ath = [['Allenamento', 'Corsista', 'Presenze', 'Assenze', 'di cui senza risposta', 'Recuperi fatti', 'Allenamenti assenti']];
    r.byTr.forEach(x => { const tr = trainingById(x.key); if (!tr) return;
      rpAthletes(tr.id, r.p.from, r.p.to, r.d).list.forEach(a => ath.push([x.label, a.name, a.in, a.abs, a.nr, a.rec, a.days.filter(dd => dd.st !== 'in').map(dd => itDate(dd.date)).join(', ')])); });
    const blob = await makeXlsx([
      { name: 'Per allenamento', rows: rpXlRows(r.byTr) }, { name: 'Corsisti', rows: ath }, { name: 'Per livello', rows: rpXlRows(r.byLvl) },
      { name: 'Per allenatore', rows: rpXlRows(r.byCoach) }, { name: 'Per giorno', rows: rpXlRows(r.byDay) }, { name: 'Sessioni', rows: sessions }]);
    saveBlob(blob, `report_presenze_${r.p.from}_${r.p.to}.xlsx`);
  }
  // Backup del mese: allenamenti, gruppi, piani, spot, pacchetti e ricavi per allenamento.
  async function backupXlsx(month) {
    const d = rangeData(month + '-01', monthEnd(month));
    if (!d) return;
    const trs = trainings(), PAYM = { cash: 'contanti', card: 'POS', transfer: 'bonifico' };
    const sheetTr = [['Allenamento', 'Giorno', 'Orario', 'Livello', 'Allenatore', 'Max persone', 'Campi', 'Iscritti nel mese']]
      .concat(trs.map(tr => [trTitle(tr), dayName(tr.dow), `${esc(tr.from)}–${esc(tr.to)}`, t('fpLevel_' + tr.level), tr.coachUid ? coachName(tr.coachUid) : '', tr.max || 0,
        (tr.courts || []).map(courtName).join(', '), ((groupOf(tr.id, month) || {}).uids || []).length]));
    const sheetGr = [['Allenamento', 'Orario', 'Corsista']];
    trs.forEach(tr => { const g = groupOf(tr.id, month); ((g && g.uids) || []).forEach(u => sheetGr.push([trTitle(tr), trLabel(tr), (g.names || {})[u] || coachName(u)])); });
    const plans = (S().plans || []).filter(p => p.month === month).sort((a, b) => coachName(a.uid).localeCompare(coachName(b.uid)));
    const sheetPl = [['Corsista', 'Allenamenti', 'Allenamenti a settimana', 'Prezzo', 'Prezzo manuale', 'Stato', 'Data pagamento', 'Modalità', 'Importo pagato', 'Ricevuta', 'Trimestrale']]
      .concat(plans.map(p => { const pd = planPaid(p); return [coachName(p.uid), planDesc(p).join(' / '), p.n || 0, p.price != null ? Number(p.price) : '', p.manual ? 'sì' : '',
        t('payState_' + payState(p)), pd ? itDate(pd.date) : '', pd ? PAYM[pd.method] || pd.method : '', pd && pd.amount != null ? pd.amount : '', pd && pd.rn ? pd.rn : '', pd && pd.quarter ? 'sì' : '']; }));
    const sps = d.spots.filter(s => s.date.slice(0, 7) === month && s.status === 'ok').sort((a, b) => a.date.localeCompare(b.date));
    const sheetSp = [['Data', 'Allenamento', 'Persona', 'Tipo', 'Prezzo', 'Pagato', 'Ricevuta']]
      .concat(sps.map(s => { const tr = trainingById(s.tid); return [itDate(s.date), tr ? trTitle(tr) : t('rpDeleted'), s.name || coachName(s.uid),
        s.pack ? (s.packBack ? 'pacchetto (restituito)' : 'pacchetto') : s.recovery ? 'recupero' : 'spot', s.pack ? 0 : s.price || 0, s.pack ? '' : s.paid ? 'sì' : 'no', s.paid && s.paid.rn ? s.paid.rn : '']; }));
    const sheetPk = [['Corsista', 'Allenamenti', 'Prezzo', 'Usati', 'Rimasti', 'Creato il', 'Pagato', 'Ricevuta']]
      .concat((S().packs || []).slice().sort((a, b) => (a.created || 0) - (b.created || 0)).map(k => [coachName(k.uid), k.n || 0, k.price || 0, k.used || 0, packLeft(k),
        itDate(new Date(k.created || 0).toLocaleDateString('sv')), k.paid ? 'sì' : 'no', k.paid && k.paid.rn ? k.paid.rn : '']));
    const rev = revenueRows(month, d);
    const sheetRv = [['Allenamento', 'Quote mensili', 'Spot e recuperi', 'Pacchetti', 'Totale', 'Da incassare']]
      .concat(rev.map(r => [r.label, r.plans, r.spot, r.pack, r.tot, r.due]))
      .concat([['Totale', ...['plans', 'spot', 'pack', 'tot', 'due'].map(k => Math.round(rev.reduce((s, r) => s + r[k], 0) * 100) / 100)]]);
    const blob = await makeXlsx([
      { name: 'Allenamenti', rows: sheetTr }, { name: 'Gruppi', rows: sheetGr }, { name: 'Piani', rows: sheetPl, money: [3, 8] },
      { name: 'Spot e recuperi', rows: sheetSp, money: [4] }, { name: 'Pacchetti', rows: sheetPk, money: [2] }, { name: 'Ricavi per allenamento', rows: sheetRv, money: [1, 2, 3, 4, 5] }]);
    saveBlob(blob, `backup_allenamenti_${month}.xlsx`);
  }
  const reportActions = {
    'rp-per': el => { ui.rpPer = el.dataset.p; render(); },
    'rp-tr': el => { ui.rpTid = el.dataset.tid || null; render(); if (ui.rpTid) { const c = document.getElementById('rp-ath'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
    'rp-ref': el => { ui.rpRef = el.dataset.d; render(); },
    'rp-xlsx': () => { reportXlsx().catch(e => { console.error(e); warn('regError', { code: e.message }); }); },
    'backup-xlsx': el => { backupXlsx(el.dataset.m).catch(e => { console.error(e); warn('regError', { code: e.message }); }); }
  };

  // ---------- profilo: statistiche delle attività (prenotazioni con grafici, allenamenti) ----------
  const dayShort = n => new Date(2024, 0, n).toLocaleDateString(I18n.locale(), { weekday: 'short' });   // 1 gen 2024 = lunedì
  const weekStart = d => addDays(d, 1 - dow(d));
  // Grafico a barre (una sola serie: niente legenda, il titolo dice cosa misura); valore sopra ogni barra,
  // dettaglio al passaggio del mouse e tabella equivalente per chi non vede il grafico.
  function barChart(title, rows, unit) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return `<figure class="bar-fig"><figcaption>${esc(title)}</figcaption>
      <div class="bar-chart" role="img" aria-label="${esc(title + ': ' + rows.map(r => `${r.label} ${r.v}`).join(', '))}">
        ${rows.map(r => `<div class="bar-col" title="${esc(`${r.full || r.label}: ${r.v} ${unit}`)}">
          <span class="bar-val">${r.v || ''}</span><span class="bar" style="height:${Math.round((r.v / max) * 100)}%"></span><span class="bar-lbl">${esc(r.label)}</span></div>`).join('')}
      </div>
      <details class="bar-table"><summary>${esc(t('showTable'))}</summary><table class="table"><tbody>${rows.map(r => `<tr><td>${esc(r.full || r.label)}</td><td class="num">${r.v}</td></tr>`).join('')}</tbody></table></details>
    </figure>`;
  }
  function myStatsCard() {
    const m = self();
    if (!m) return '';
    const bks = (S().bookingsMine || []).filter(b => b.userId === m.uid).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));
    const per = ui.stPeriod || 'week', ref = ui.stRef || todayStr();
    const from = per === 'week' ? weekStart(ref) : ref.slice(0, 7) + '-01';
    const to = per === 'week' ? addDays(from, 7) : shiftMonth(ref.slice(0, 7), 1) + '-01';
    const inP = bks.filter(b => b.date >= from && b.date < to);
    const hours = list => list.reduce((s, b) => s + (toMin(b.to) - toMin(b.from)) / 60, 0);
    const byDay = [1, 2, 3, 4, 5, 6, 7].map(n => ({ label: dayShort(n), full: dayName(n), v: inP.filter(b => dow(b.date) === n).length }));
    const months = Array.from({ length: 12 }, (_, i) => shiftMonth(curMonth(), i - 11));
    const byMonth = months.map(mo => ({ label: new Date(mo + '-15T12:00').toLocaleDateString(I18n.locale(), { month: 'short' }), full: monthLabel(mo), v: bks.filter(b => b.date.slice(0, 7) === mo).length }));
    const pLabel = per === 'week' ? t('weekOf', { a: fmtDate(from), b: fmtDate(addDays(from, 6)) }) : monthLabel(ref.slice(0, 7));
    const step = per === 'week' ? 7 : 0;
    const prevRef = per === 'week' ? addDays(ref, -step) : shiftMonth(ref.slice(0, 7), -1) + '-01', nextRef = per === 'week' ? addDays(ref, step) : shiftMonth(ref.slice(0, 7), 1) + '-01';
    // allenamenti: risposte e spot del corsista (stagione in corso)
    const season = seasonOf(todayStr()), sFrom = `${season.slice(0, 4)}-09-01`;
    const att = (S().att || []).filter(x => x.uid === m.uid && x.date >= sFrom && x.date <= todayStr());
    const sp = (S().spots || []).filter(x => x.uid === m.uid && x.status === 'ok' && x.date >= sFrom && x.date <= todayStr());
    const trBlock = att.length || sp.length ? `<h3><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('statTraining', { s: season }))}</h3>
      <div class="stats-row">
        <div class="stat"><span>${esc(t('statPresent'))}</span><strong>${att.filter(x => x.status === 'in').length}</strong></div>
        <div class="stat"><span>${esc(t('statAbsent'))}</span><strong>${att.filter(x => x.status === 'out').length}</strong></div>
        <div class="stat"><span>${esc(t('statSpots'))}</span><strong>${sp.filter(x => !x.recovery).length}</strong></div>
        <div class="stat"><span>${esc(t('statRecoveries'))}</span><strong>${sp.filter(x => x.recovery).length}</strong></div>
      </div>` : '';
    if (!bks.length && !trBlock) return '';
    return `<div class="card" id="my-stats">
      <h2><i class="ti ti-chart-bar" aria-hidden="true"></i> ${esc(t('myStats'))}</h2>
      ${bks.length ? `<div class="stats-row">
        <div class="stat"><span>${esc(t('statBookings'))}</span><strong>${bks.length}</strong><small class="muted">${esc(t('statHours', { h: hours(bks).toLocaleString(I18n.locale()) }))}</small></div>
        <div class="stat"><span>${esc(t('statPlayed'))}</span><strong>${bks.filter(b => isPastSlot(b.date, b.to)).length}</strong></div>
      </div>
      <div class="month-nav">
        <div class="segmented" role="group">${['week', 'month'].map(k => `<button class="${per === k ? 'active' : ''}" aria-pressed="${per === k}" data-action="st-period" data-p="${k}">${esc(t('per_' + k))}</button>`).join('')}</div>
        <button class="btn small" data-action="st-ref" data-d="${prevRef}" aria-label="${esc(t('prevPeriod'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <strong>${esc(pLabel)}</strong>
        <button class="btn small" data-action="st-ref" data-d="${nextRef}" aria-label="${esc(t('nextPeriod'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
      </div>
      <div class="charts-2">
        ${barChart(t('chartByDay', { p: pLabel }), byDay, t('statBookingsUnit'))}
        ${barChart(t('chartByMonth'), byMonth, t('statBookingsUnit'))}
      </div>
      <h3>${esc(t('statDetail', { n: inP.length, p: pLabel }))}</h3>
      ${inP.length ? `<ul class="reg-list">${inP.map(b => `<li><span class="reg-names"><strong class="cap">${esc(longDate(b.date))}</strong> · ${esc(b.from)}–${esc(b.to)}<br><small class="muted">${esc(courtName(b.courtId))}</small></span></li>`).join('')}</ul>`
        : `<p class="muted small">${esc(t('statNone'))}</p>`}` : ''}
      ${trBlock}
    </div>`;
  }
  const statActions = {
    'st-period': el => { ui.stPeriod = el.dataset.p; render(); },
    'st-ref': el => { ui.stRef = el.dataset.d; render(); }
  };

  const trForms = {
    'tr-save': f => trSave(f),
    'self-profile': f => {
      const d = { first: f.first.value.trim(), last: f.last.value.trim(), gender: f.gender.value };
      if (!d.first || !d.last) return warn('errRegFields');
      window.Cloud.saveSelfProfile(d).then(() => { ui.flash = { text: t('selfProfileSaved') }; render(); }).catch(trErr);
    },
    'coach-add': f => {
      const uid = f.uid.value;
      if (!uid) return;
      window.Cloud.setCoach(uid, { all: f.all.value === '1', name: personName(memberByUid(uid)) }).then(() => { ui.flash = { text: t('coachAdded') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    // recupero già creato: aggiunge i corsisti del gruppo di un altro allenamento (come alla creazione)
    'occ-copy': f => {
      const tr = trainingById(f.dataset.tid), src = trainingById(f.src.value), date = f.dataset.date;
      if (!tr || !src || !centerAdm()) return;
      const month = date.slice(0, 7);
      const sg = groupOf(src.id, month) || groupOf(src.id, shiftMonth(month, -1));
      const cur = groupOf(tr.id, month) || { id: `${tr.id}_${month}`, tid: tr.id, month, uids: [], names: {} };
      const add = ((sg && sg.uids) || []).filter(u => !(cur.uids || []).includes(u));
      if (!add.length) return warn('occCopyNone', { s: trTitle(src) });
      const g = Object.assign({}, cur, { uids: (cur.uids || []).concat(add), names: Object.assign({}, cur.names || {}, Object.fromEntries(add.map(u => [u, (sg.names || {})[u] || '']))),
        coachUid: tr.coachUid || '', updated: Date.now() });
      window.Cloud.saveGroups([g], [], [], add.map(uid => ({ tid: tr.id, date: tr.date || date, uid, on: true })))
        .then(() => { ui.flash = { text: t('occCopied', { n: add.length, s: trTitle(src) }) }; render(); })
        .catch(e => warn('regError', { code: e.code || e.message }));
    },
    'grp-add': f => {
      const tid = f.dataset.tid, month = f.dataset.m, uid = f.uid.value, tr = trainingById(tid);
      if (!uid || !tr) return;
      const g = groupOf(tid, month);
      if (g && (g.uids || []).length >= tr.max && !confirmed('grpFullConfirm', { n: tr.max })) return;
      const a = athleteOf(uid), m = memberByUid(uid), s = seasonOf(todayStr());
      // l'admin centro non vede le schede: si scrive il tesseramento solo se lo spunta (mai "non tesserato" sopra uno esistente)
      const ad = admin() ? { id: uid, first: m.first, last: m.last, tess: Object.assign({}, (a && a.tess) || {}, { [s]: f.tess.checked }), updated: Date.now() }
        : Object.assign({ id: uid, first: m.first, last: m.last, updated: Date.now() }, f.tess.checked ? { tess: { [s]: true } } : {});
      if (f.certExp.value) ad.certExp = f.certExp.value;
      if (f.certType && f.certType.value) ad.certType = f.certType.value;
      if (!a && admin()) ad.created = Date.now();
      grpChange(tid, month, uid, true, ad).then(() => { ui.flash = { text: t('grpAdded', { n: personName(m) }) }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'ath-new': f => {
      const m = memberByUid(f.uid.value);
      if (!m) return;
      const ad = { id: m.uid, first: m.first, last: m.last, tess: { [seasonOf(todayStr())]: f.tess.checked }, created: Date.now(), updated: Date.now() };
      if (f.certExp.value) ad.certExp = f.certExp.value;
      if (f.certType.value) ad.certType = f.certType.value;
      const tids = [...f.querySelectorAll('[name=tid]:checked')].map(x => x.value);
      setAthleteTrainings(m.uid, f.dataset.m, tids, ad).then(ok => { if (!ok) return; (ui.keep || {})['ath-new'] = false; ui.athEdit = m.uid; ui.flash = { text: t('athCreated') }; render(); })
        .catch(e => warn('regError', { code: e.code || e.message }));
    },
    'ath-trs': f => {
      const tids = [...f.querySelectorAll('[name=tid]:checked')].map(x => x.value);
      setAthleteTrainings(f.dataset.uid, f.dataset.m, tids, null).then(ok => { if (ok) { ui.flash = { text: t('athTrainingsSaved') }; render(); } })
        .catch(e => warn('regError', { code: e.code || e.message }));
    },
    'ath-save': f => {
      const uid = f.dataset.uid, a = athleteOf(uid) || {}, m = memberByUid(uid), s = seasonOf(todayStr());
      const cf = f.cf.value.trim().toUpperCase();
      const d = { birthPlace: f.birthPlace.value.trim(), birthDate: f.birthDate.value, city: f.city.value.trim(), address: f.address.value.trim(), cf,
        certExp: f.certExp.value, certType: f.certType.value, tess: Object.assign({}, a.tess || {}, { [s]: f.tess.checked }), updated: Date.now() };
      if (m) Object.assign(d, { first: m.first, last: m.last });
      window.Cloud.saveAthlete(uid, d).then(() => { ui.flash = { text: t('athSaved') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'plan-price': f => {
      const p = planOf(f.dataset.uid, f.dataset.m);
      if (!p) return;
      const v = f.price.value === '' ? null : Math.round(Number(f.price.value) * 100) / 100;
      window.Cloud.savePlan(Object.assign({}, p, { price: v, manual: true, updated: Date.now() })).then(() => { ui.flash = { text: t('saved') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'prices-save': f => {
      const n = x => (f[x].value === '' ? null : Math.round(Number(f[x].value) * 100) / 100);
      const cf = f.courseFrom.value, ct = f.courseTo.value;
      if (cf && ct && ct < cf) return warn('priceCourseErr');
      S().prices = { w1: n('w1'), w2: n('w2'), w3: n('w3'), w4: n('w4'), q1: n('q1'), q2: n('q2'), spot: n('spot'), c1: n('c1'), c2: n('c2'), courseFrom: cf || '', courseTo: ct || '', fitp: n('fitp') };
      commit(t('saved'));
    }
  };

  const trActions = {
    'tr-month': el => { ui.trMonth = el.dataset.m; render(); },
    'tr-edit': el => { ui.trEdit = el.dataset.id; render(); },
    'tr-edit-cancel': () => { ui.trEdit = null; render(); },
    'tr-delete': el => {
      const tr = trainingById(el.dataset.id);
      if (!tr || !confirmed('trDeleteConfirm', { n: trTitle(tr) + ' · ' + trLabel(tr) })) return;
      // si tolgono i gruppi da questo mese in poi (lo storico dei mesi passati resta)
      const month = curMonth();
      const gs = (S().groups || []).filter(g => g.tid === tr.id && g.month >= month);
      const rest = (S().groups || []).filter(g => !gs.includes(g));
      const plans = [];
      gs.forEach(g => (g.uids || []).forEach(uid => { const p = planFrom(uid, g.month, rest); if (p) plans.push(p); }));
      window.Cloud.deleteTraining(tr, gs, plans).then(() => { ui.flash = { text: t('trDeleted') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'tr-copy': el => {
      const month = el.dataset.m, prev = shiftMonth(month, -1);
      const add = weeklyTrainings().filter(tr => !groupOf(tr.id, month) && groupOf(tr.id, prev)).map(tr => {
        const pg = groupOf(tr.id, prev);
        return { id: `${esc(tr.id)}_${month}`, tid: tr.id, month, uids: (pg.uids || []).slice(), names: Object.assign({}, pg.names || {}), coachUid: tr.coachUid || '', updated: Date.now() };
      });
      if (!add.length) return;
      const all = (S().groups || []).concat(add);
      const uids = [...new Set(add.flatMap(g => g.uids))];
      const plans = uids.map(uid => planFrom(uid, month, all)).filter(Boolean);
      window.Cloud.saveGroups(add, plans, []).then(() => { ui.flash = { text: t('trCopied', { n: add.length }) }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'grp-remove': el => {
      const m = memberByUid(el.dataset.uid);
      if (!confirmed('grpRemoveConfirm', { n: m ? personName(m) : '?' })) return;
      grpChange(el.dataset.tid, el.dataset.m, el.dataset.uid, false).then(() => render()).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'coach-remove': el => {
      if (!confirmed('coachRemoveConfirm', { n: coachName(el.dataset.uid) })) return;
      window.Cloud.setCoach(el.dataset.uid, null).then(() => render()).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'ath-edit': el => { ui.athEdit = ui.athEdit === el.dataset.uid ? null : el.dataset.uid; render(); },
    'plan-auto': el => {
      const p = planOf(el.dataset.uid, el.dataset.m);
      if (!p) return;
      window.Cloud.savePlan(Object.assign({}, p, { price: priceFor(p.n), manual: false, updated: Date.now() })).then(() => render()).catch(e => warn('regError', { code: e.code || e.message }));
    }
  };

  // ---------- profilo dell'utente ----------
  // Profilo: "I prossimi impegni" in un'unica lista (allenamenti, spot e prenotazioni).
  function myAgenda(m, myBk) {
    const items = [];
    const today = todayStr(), tomorrow = addDays(today, 1);
    const chip = (date, time, kind) => {
      const d = new Date(`${date}T12:00:00`);
      const top = date === today ? t('agToday') : date === tomorrow ? t('agTomorrow') : d.toLocaleDateString(I18n.locale(), { weekday: 'short', day: 'numeric' });
      return `<span class="ag-chip ag-${kind}"><small>${esc(top)}</small><strong>${esc(time || '')}</strong></span>`;
    };
    const add = (date, time, kind, title, sub, side) => items.push({ key: `${date} ${time || '99'}`, html: `<li class="ag-item">${chip(date, time, kind)}
      <span class="ag-body"><strong>${title}</strong>${sub ? `<br><small class="muted">${sub}</small>` : ''}</span>${side ? `<span class="ag-side">${side}</span>` : ''}</li>` });
    if (self()) {
      occurrences(today, 7).filter(o => inMyGroup(o.tr, o.date) && Date.now() < trStartMs(o.tr, o.date) + 3600000).forEach(({ tr, date }) => {
        const o = occOf(tr.id, date) || {}, a = attOf(tr.id, date, m.uid);
        add(date, tr.from, 'tr', esc(trTitle(tr)), o.cancelled ? `<span class="badge st-full">${esc(t('occCancelled'))}</span>` : attChip(a && a.status, date), o.cancelled ? '' : attButtons(tr, date, a && a.status));
      });
      (S().spots || []).filter(sp => sp.uid === m.uid && sp.date >= today).forEach(sp => {
        const tr = trainingById(sp.tid);
        if (tr) add(sp.date, tr.from, 'tr', esc(trTitle(tr)), `<span class="badge ${sp.status === 'ok' ? 'st-done' : sp.status === 'no' ? 'st-full' : ''}">${esc(t(sp.recovery ? 'recoveryBadge' : 'spotBadge'))} · ${esc(t('spotSt_' + sp.status))}</span>`);
      });
    }
    myBk.forEach(b => { const sub = bkSubText(b, m.uid); add(b.date, b.from, 'bk', `${esc(b.courtName || courtName(b.courtId))}`, `${esc(b.from)}–${esc(b.to)} · ${esc(durText(b.from, b.to))}${sub ? ` · ${esc(sub)}` : ''}`,
      b.inv ? `<span class="badge">${esc(t('bkInvitedBadge'))}</span>` : `<button class="btn small" data-action="booking-open" data-id="${esc(b.id)}">${esc(t('edit'))}</button><button class="btn small danger" data-action="booking-delete" data-id="${esc(b.id)}">${esc(t('bkCancel'))}</button>`); });
    items.sort((a, b) => a.key.localeCompare(b.key));
    return `<div class="card agenda-card">
      <h2><i class="ti ti-calendar-time" aria-hidden="true"></i> ${esc(t('agTitle'))}</h2>
      ${items.length ? `<ul class="agenda">${items.map(x => x.html).join('')}</ul>` : `<p class="muted">${esc(t('agNone'))}</p>`}
      <div class="btn-row"><a class="btn small" href="#/book"><i class="ti ti-calendar-plus" aria-hidden="true"></i> ${esc(t('bkGo'))}</a>
        <a class="btn small" href="#/train"><i class="ti ti-barbell" aria-hidden="true"></i> ${esc(t('navTrain'))}</a></div>
    </div>`;
  }
  // Intestazione del profilo: nome, prenotazioni giocate e reward dei campi (soglie decise dall'admin).
  function profileHero(m, nextN) {
    loadBookCount(m.uid);
    const played = (ui.bookCounts || {})[m.uid];
    const th = S().bookRewards || {}, n = played || 0;
    const rw = bookRewardFor(n), next = REWARDS.find(([k]) => Number(th[k]) > n);
    const ini = `${(m.first || '?')[0] || ''}${(m.last || '')[0] || ''}`.toUpperCase();
    const prev = rw ? Number(th[rw.key]) || 0 : 0, goal = next ? Number(th[next[0]]) : 0;
    const pct = next && goal > prev ? Math.max(4, Math.min(100, Math.round((n - prev) / (goal - prev) * 100))) : 100;
    return `<section class="card profile-hero">
      <div class="ph-top">
        <span class="ph-avatar" aria-hidden="true">${esc(ini)}</span>
        <div class="ph-name"><h1>${esc(personName(m))}</h1>
          <p><span class="badge g-${m.gender}">${esc(t(m.gender === 'F' ? 'female' : 'male'))}</span> <span class="ph-mail">${esc(m.email)}</span></p>
          ${(S().nicks || {})[m.uid] ? `<p class="ph-mail">${esc(t('nickShownAs', { n: S().nicks[m.uid] }))}</p>` : ''}</div>
        ${rw ? `<span class="ph-reward" title="${esc(t('reward'))}">${rw.icon} ${esc(t('rw_' + rw.key))}</span>` : ''}
      </div>
      <div class="ph-stats">
        <div><strong>${played == null ? '…' : played}</strong><span>${esc(t('phPlayed'))}</span></div>
        <div><strong>${nextN}</strong><span>${esc(t('phNext'))}</span></div>
        <div><strong>${rw ? rw.icon : '—'}</strong><span>${esc(t('reward'))}</span></div>
      </div>
      ${next && played != null ? `<div class="ph-progress"><div class="ph-prog-head"><span>${esc(t('agNextReward', { r: t('rw_' + next[0]) }))} ${next[1]}</span><span>${esc(t('phToGo', { n: goal - n }))}</span></div>
        <div class="ph-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div></div>` : ''}
    </section>`;
  }

  // ---------- Wrapped del trimestre ----------
  // Attività dell'utente (presenze e spot): caricata una volta per sessione.
  function myActivity() {
    const m = self();
    if (!m || !window.Cloud || !window.Cloud.loadMyActivity) return null;
    // si ricarica dopo 10 minuti (nuove presenze…), mostrando intanto i dati già letti
    const fresh = ui.act && ui.act.uid === m.uid && (ui.act.loading || Date.now() - ui.act.at < 600000);
    if (!fresh) {
      ui.act = { uid: m.uid, data: ui.act && ui.act.uid === m.uid ? ui.act.data : null, loading: true, at: Date.now() };
      window.Cloud.loadMyActivity(m.uid).then(d => { if (ui.act && ui.act.uid === m.uid) { Object.assign(ui.act, { data: d, loading: false, at: Date.now() }); render(); } })
        .catch(() => { ui.act = { uid: m.uid, data: (ui.act && ui.act.data) || { att: [], spots: [] }, loading: false, at: Date.now() }; render(); });
    }
    return ui.act.data;
  }
  // Sessioni giocate nel periodo: prenotazioni, allenamenti (presente), spot. h = ore.
  function activityItems(m, act, from, to) {
    const out = [], today = todayStr();
    const hrs = (a, b) => a && b ? Math.max(0, (toMin(b === '00:00' ? '24:00' : b) - toMin(a)) / 60) : 1.5;
    const add = (kind, date, a, b) => { if (date >= from && date <= to && (date < today || (date === today && b && isPastSlot(date, b)))) out.push({ kind, date, from: a || '', h: hrs(a, b) }); };
    (S().bookingsMine || []).filter(b => b.userId === m.uid && !b.blocked).forEach(b => add('bk', b.date, b.from, b.to));
    if (act) {
      act.att.filter(a => a.status === 'in').forEach(a => { const tr = trainingById(a.tid); add('tr', a.date, tr && tr.from, tr && tr.to); });
      act.spots.filter(s => s.status === 'ok').forEach(s => { const tr = trainingById(s.tid); add('sp', s.date, tr && tr.from, tr && tr.to); });
    }
    return out;
  }

  // ---------- immagini da condividere (canvas 1080 px) ----------
  function cvFit(g, text, max, size, weight) { let s = size; do { g.font = `${weight} ${s}px Inter, system-ui, sans-serif`; s -= 2; } while (g.measureText(text).width > max && s > 20); }
  async function shareCanvas(c, name) {
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: Club.name }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- Wrapped: trimestri gen–mar, apr–giu, lug–set, ott–dic ----------
  const qOf = d => `${d.slice(0, 4)}-Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}`;
  const qRange = q => { const y = q.slice(0, 4), n = +q.slice(6); return { from: `${y}-${String(n * 3 - 2).padStart(2, '0')}-01`, to: addDays(`${n === 4 ? +y + 1 : y}-${String(n === 4 ? 1 : n * 3 + 1).padStart(2, '0')}-01`, -1) }; };
  const qShift = (q, k) => { let y = +q.slice(0, 4), n = +q.slice(6) + k; while (n < 1) { n += 4; y--; } while (n > 4) { n -= 4; y++; } return `${y}-Q${n}`; };
  function qLabel(q) {
    const r = qRange(q), m = d => new Date(d + 'T12:00').toLocaleDateString(I18n.locale(), { month: 'short' }).replace('.', '');
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    return `${cap(m(r.from))}–${cap(m(r.to))} ${q.slice(0, 4)}`;
  }
  const validQ = q => /^\d{4}-Q[1-4]$/.test(q || '');
  function wrappedData(m, q) {
    const act = myActivity();
    if (!act) return null;
    const { from, to } = qRange(q), items = activityItems(m, act, from, to);
    const att = act.att.filter(a => a.date >= from && a.date <= to && a.date < todayStr());
    const count = (list, key) => { const o = {}; list.forEach(x => { const k = key(x); if (k) o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1])[0] || null; };
    const slot = count(items.filter(x => x.from), x => `${dow(x.date)}|${x.from.slice(0, 2)}`);
    const month = count(items, x => x.date.slice(0, 7));
    const kinds = k => items.filter(x => x.kind === k).length;
    return { q, first: m.first || '', hours: Math.round(items.reduce((s, x) => s + x.h, 0) * 10) / 10, sessions: items.length,
      bk: kinds('bk'), tr: kinds('tr'), sp: kinds('sp'), trAll: att.length,
      days: new Set(items.map(x => x.date)).size,
      slot: slot ? { day: dayName(+slot[0].split('|')[0]), hour: slot[0].split('|')[1] + ':00' } : null, month: month ? monthLabel(month[0]).split(' ')[0] : '' };
  }
  const hasWrapped = w => !!(w && w.sessions);
  function wrappedSlides(w) {
    const L1 = (k, v) => `<div class="wr-row"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`;
    const slides = [];
    slides.push({ cls: 'wr-a', html: `<small>${esc(t('wrKicker', { q: qLabel(w.q) }))}</small><h2>${esc(t('wrHello', { n: w.first }))}</h2>
      <div class="wr-big">${esc(String(w.hours).replace('.', ','))} h</div><p>${esc(t('wrHours'))}</p><p class="wr-soft">${esc(t('wrSessions', { n: w.sessions, d: w.days }))}</p>` });
    if (w.bk || w.slot) slides.push({ cls: 'wr-b', html: `<small>${esc(t('wrCourtsK'))}</small><h2>${esc(t('wrCourtsT'))}</h2>
      <div class="wr-big">${w.bk}</div><p>${esc(t('wrBookings'))}</p>
      ${w.slot ? `<p class="wr-soft">${esc(t('wrSlot', { d: w.slot.day, h: w.slot.hour }))}</p>` : ''}${w.month ? `<p class="wr-soft">${esc(t('wrMonth', { m: w.month }))}</p>` : ''}` });
    if (w.trAll || w.sp) {
      const pct = w.trAll ? Math.round(w.tr / w.trAll * 100) : null;
      slides.push({ cls: 'wr-c', html: `<small>${esc(t('wrTrK'))}</small><h2>${esc(t(pct === 100 && w.tr >= 4 ? 'wrTrPerfect' : 'wrTrT'))}</h2>
        <div class="wr-big">${w.tr}${w.trAll ? `<span class="wr-of"> / ${w.trAll}</span>` : ''}</div><p>${esc(t('wrTrPresent'))}</p>
        ${pct != null ? `<p class="wr-soft">${esc(t('wrTrPct', { p: pct }))}</p>` : ''}${w.sp ? `<p class="wr-soft">${esc(t('wrTrSpots', { n: w.sp }))}</p>` : ''}` });
    }
    slides.push({ cls: 'wr-f', html: `<small>${esc(t('wrSumK', { q: qLabel(w.q) }))}</small><h2>${esc(t('wrSumT'))}</h2>
      ${L1(t('wrHoursShort'), String(w.hours).replace('.', ',') + ' h')}${w.bk ? L1(t('wrBookingsShort'), w.bk) : ''}
      ${w.trAll ? L1(t('wrTrShort'), `${w.tr} / ${w.trAll}`) : ''}
      ${w.slot ? L1(t('wrSlotShort'), `${w.slot.day.slice(0, 3)} ${w.slot.hour}`) : ''}
      <button class="btn wr-share" data-action="wr-share" data-q="${w.q}"><i class="ti ti-share" aria-hidden="true"></i> ${esc(t('wrShare'))}</button>` });
    return slides;
  }
  function viewWrapped(q) {
    const m = self();
    if (!m) return `<div class="page-head"><h1>${esc(t('wrTitle'))}</h1></div><div class="card"><p>${esc(t('regLoginFirst'))}</p><a class="btn primary" href="#/settings">${esc(t('loginOrRegister'))}</a></div>`;
    if (!validQ(q)) q = qShift(qOf(todayStr()), -1);
    const w = wrappedData(m, q);
    const nav = `<div class="month-nav card wr-nav"><a class="btn small" href="#/wrapped/${qShift(q, -1)}" aria-label="${esc(t('wrPrevQ'))}"><i class="ti ti-chevron-left" aria-hidden="true"></i></a>
      <strong>${esc(qLabel(q))}</strong>${qRange(qShift(q, 1)).from <= todayStr() ? `<a class="btn small" href="#/wrapped/${qShift(q, 1)}" aria-label="${esc(t('wrNextQ'))}"><i class="ti ti-chevron-right" aria-hidden="true"></i></a>` : '<span></span>'}</div>`;
    const head = `<div class="page-head"><a class="back" href="#/me">← ${esc(t('profile'))}</a><h1><i class="ti ti-sparkles" aria-hidden="true"></i> ${esc(t('wrTitle'))}</h1></div>`;
    if (!w) return head + nav + `<div class="empty"><i class="ti ti-loader-2" aria-hidden="true"></i> ${esc(t('loading'))}</div>`;
    if (!hasWrapped(w)) return head + nav + `<div class="empty"><i class="ti ti-mood-empty" aria-hidden="true"></i> ${esc(t(q === qOf(todayStr()) ? 'wrNotYet' : 'wrEmpty'))}</div>`;
    const slides = wrappedSlides(w), i = Math.max(0, Math.min(slides.length - 1, ui.wrQ === q ? ui.wrSlide || 0 : 0));
    ui.wrQ = q; ui.wrSlide = i;
    return head + nav + `<div class="wr ${slides[i].cls}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${slides.length}">
        <div class="wr-dots" aria-hidden="true">${slides.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
        ${i > 0 ? `<button class="wr-tap wr-prev" data-action="wr-go" data-i="${i - 1}" aria-label="${esc(t('wrPrev'))}"></button>` : ''}
        ${i < slides.length - 1 ? `<button class="wr-tap wr-next" data-action="wr-go" data-i="${i + 1}" aria-label="${esc(t('wrNext'))}"></button>` : ''}
        <div class="wr-body">${slides[i].html}</div>
        ${i < slides.length - 1 ? `<p class="wr-hint">${esc(t('wrTapHint'))}</p>` : ''}
      </div>
      <div class="btn-row wr-ctrl">${i > 0 ? `<button class="btn small" data-action="wr-go" data-i="${i - 1}"><i class="ti ti-arrow-left" aria-hidden="true"></i> ${esc(t('wrPrev'))}</button>` : ''}
        ${i < slides.length - 1 ? `<button class="btn small primary" data-action="wr-go" data-i="${i + 1}">${esc(t('wrNext'))} <i class="ti ti-arrow-right" aria-hidden="true"></i></button>` : ''}</div>`;
  }
  async function wrappedImage(w) {
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#0b3d91'; g.fillRect(0, 0, W, H);
    [[200, 260, 700, '#c8102e'], [980, 1500, 760, '#ffd400'], [900, 200, 500, '#4e8ad0']].forEach(([x, y, r, col]) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    g.fillStyle = '#fff'; g.font = '800 40px Inter, system-ui, sans-serif'; g.fillText(t('wrKicker', { q: qLabel(w.q) }).toUpperCase(), 90, 190);
    cvFit(g, t('wrHello', { n: w.first }), W - 180, 84, 900); g.fillText(t('wrHello', { n: w.first }), 90, 300);
    g.fillStyle = '#ffd400'; g.font = '900 260px Inter, system-ui, sans-serif'; g.fillText(`${String(w.hours).replace('.', ',')} h`, 80, 590);
    g.fillStyle = '#fff'; g.font = '700 48px Inter, system-ui, sans-serif'; g.fillText(t('wrHours'), 90, 700);
    const rows = [[t('wrSessionsShort'), w.sessions], w.bk && [t('wrBookingsShort'), w.bk], w.trAll && [t('wrTrShort'), `${w.tr} / ${w.trAll}`],
      w.slot && [t('wrSlotShort'), `${w.slot.day} ${w.slot.hour}`], w.month && [t('wrMonthShort'), w.month]].filter(Boolean).slice(0, 8);
    rows.forEach(([k, v], i) => {
      const y = 820 + i * 118;
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(90, y - 70); g.lineTo(W - 90, y - 70); g.stroke();
      g.textAlign = 'left'; g.fillStyle = '#fff'; cvFit(g, k, 600, 46, 700); g.fillText(k, 90, y);
      g.textAlign = 'right'; g.fillStyle = '#ffd400'; cvFit(g, String(v), 330, 50, 900); g.fillText(String(v), W - 90, y);
    });
    g.textAlign = 'center'; g.fillStyle = '#fff'; cvFit(g, Club.name.toUpperCase(), W - 180, 52, 900); g.fillText(Club.name.toUpperCase(), W / 2, H - 120);
    g.font = '600 32px Inter, system-ui, sans-serif'; g.fillText(Club.site, W / 2, H - 70);
    return c;
  }
  // Avviso in prima pagina e nel profilo: nelle prime 3 settimane del trimestre, se nel precedente si è giocato.
  function wrappedAlert() {
    const m = self(), today = todayStr();
    if (!m || +today.slice(5, 7) % 3 !== 1 || +today.slice(8, 10) > 21) return '';
    const q = qShift(qOf(today), -1), w = wrappedData(m, q);
    if (!hasWrapped(w)) return '';
    return `<a class="card wr-teaser" href="#/wrapped/${q}"><span class="wr-teaser-ic" aria-hidden="true">🎉</span>
      <span><strong>${esc(t('wrReady', { q: qLabel(q) }))}</strong><br><small>${esc(t('wrReadySub', { h: String(w.hours).replace('.', ',') }))}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></a>`;
  }
  // Profilo: gli ultimi trimestri conclusi con attività.
  function wrappedList(m) {
    const act = myActivity();
    if (!act) return '';
    const qs = [], cur = qOf(todayStr());
    for (let k = 1; k <= 8; k++) { const q = qShift(cur, -k), w = wrappedData(m, q); if (hasWrapped(w)) qs.push([q, w]); }
    if (!qs.length) return '';
    return `<div class="card"><h2><i class="ti ti-sparkles" aria-hidden="true"></i> ${esc(t('wrMine'))}</h2>
      <div class="wr-list">${qs.map(([q, w]) => `<a class="wr-chip" href="#/wrapped/${q}"><strong>${esc(qLabel(q))}</strong><small>${esc(String(w.hours).replace('.', ','))} h · ${w.sessions} ${esc(t('wrSessionsUnit'))}</small></a>`).join('')}</div></div>`;
  }

  function viewProfile() {
    const m = self();   // anche l'admin con la propria scheda
    if (!m) return `<div class="page-head"><h1>${esc(t('profile'))}</h1></div><div class="card"><p>${esc(t('regLoginFirst'))}</p><a class="btn primary" href="#/settings">${esc(t('loginOrRegister'))}</a></div>`;
    const editing = ui.editProfile;
    const myBk = myBookings(m.uid);
    return `
      ${privacyAlert()}
      ${certAlerts()}
      ${bookingAlerts()}
      ${verifyNotice()}
      ${banNotice('book')}
      ${profileHero(m, myBk.length)}
      ${editing ? `<form class="card grid-form" data-form="profile-save">
          <h2 class="span-all">${esc(t('editProfile'))}</h2>
          <label>${esc(t('firstName'))}<input name="first" required maxlength="60" value="${esc(m.first)}"></label>
          <label>${esc(t('lastName'))}<input name="last" required maxlength="60" value="${esc(m.last)}"></label>
          <label>${esc(t('gender'))}<select name="gender"><option value="M" ${sel(m.gender, 'M')}>${esc(t('male'))}</option><option value="F" ${sel(m.gender, 'F')}>${esc(t('female'))}</option></select></label>
          <div class="form-actions span-all"><button type="button" class="btn" data-action="profile-cancel">${esc(t('cancel'))}</button><button class="btn primary">${esc(t('save'))}</button></div>
        </form>` : ''}
      ${wrappedAlert()}
      ${myAgenda(m, myBk)}
      ${wrappedList(m)}
      <div class="stats-row">${bookRewardStat(m.uid)}</div>
      ${myStatsCard()}
      ${myTrainingCard(true)}
      ${myReceiptsCard()}
      ${privacyCard()}
      <div class="btn-row">
        ${editing || !member() ? '' : `<button class="btn" data-action="profile-edit"><i class="ti ti-pencil" aria-hidden="true"></i> ${esc(t('editProfile'))}</button>`}
        <button class="btn" data-action="logout">${esc(t('logout'))}</button>
      </div>`;
  }
  // ---------- messaggi dell'admin ----------
  const unreadMessages = () => {
    const m = member();
    if (!m) return [];
    const read = new Set(S().inbox || []);
    return (S().messages || []).filter(x => !read.has(x.id) && (x.all || (x.to || []).includes(m.uid)));
  };

  function messageAlerts() {
    return unreadMessages().map(x => `<div class="msg-alert" role="alert">
      <div class="msg-head"><strong><i class="ti ti-bell-ringing" aria-hidden="true"></i> ${esc(x.title || t('msgAlert'))}</strong>
        <small>${esc(new Date(x.created).toLocaleString(I18n.locale(), { dateStyle: 'medium', timeStyle: 'short' }))}</small></div>
      <div class="msg-text">${richText(x.text || '')}</div>
      <button class="btn small" data-action="msg-read" data-id="${esc(x.id)}"><i class="ti ti-check" aria-hidden="true"></i> ${esc(t('msgRead'))}</button>
    </div>`).join('');
  }

  function viewMessages() {
    const mem = (S().members || []).slice().sort((a, b) => personName(a).localeCompare(personName(b)));
    const target = ui.msgTarget || 'users';
    const f = L.norm(ui.msgFilter || '');
    const sent = S().messages || [];
    const who = x => x.all ? t('msgToAll') : t('msgToN', { n: (x.to || []).length });
    return `
      <div class="page-head"><a class="back" href="#/settings">← ${esc(t('settings'))}</a><h1><i class="ti ti-mail" aria-hidden="true"></i> ${esc(t('messages'))}</h1>
        <p class="muted">${esc(t('messagesIntro'))}</p></div>
      <form class="card grid-form" data-form="msg-send">
        <h2 class="span-all">${esc(t('msgNew'))}</h2>
        <div class="segmented wrap span-all" role="group">
          ${[['users', 'msgTargetUsers'], ['all', 'msgTargetAll']].map(([v, k]) => `<button type="button" data-action="msg-target" data-v="${v}" aria-pressed="${target === v}">${esc(t(k))}</button>`).join('')}
        </div>
        ${target === 'users' ? `<label class="span-all">${esc(t('search'))}<input type="search" value="${esc(ui.msgFilter || '')}" data-change="msg-filter"></label>
          <div class="msg-users span-all">${mem.filter(x => !f || L.norm(personName(x)).includes(f)).map(x => `<label class="check"><input type="checkbox" name="to" value="${x.uid}" ${(ui.msgTo || []).includes(x.uid) ? 'checked' : ''} data-change="msg-to"> ${esc(personName(x))}</label>`).join('') || `<p class="muted">${esc(t('noMembers'))}</p>`}</div>` : ''}
        ${target === 'all' ? `<p class="note span-all">${esc(t('msgAllNote', { n: mem.length }))}</p>` : ''}
        <label class="span-all">${esc(t('edTitle'))}<input name="title" maxlength="120"></label>
        <label class="span-all">${esc(t('edText'))}<textarea name="text" rows="5" maxlength="4000" required></textarea></label>
        <div class="form-actions span-all"><button class="btn primary"><i class="ti ti-send" aria-hidden="true"></i> ${esc(t('msgSend'))}</button></div>
      </form>
      <div class="card">
        <h2>${esc(t('msgSent'))} (${sent.length})</h2>
        ${sent.length ? `<ul class="reg-list">${sent.map(x => `<li><span class="reg-names"><strong>${esc(x.title || t('msgAlert'))}</strong> <small class="muted">· ${esc(who(x))} · ${esc(new Date(x.created).toLocaleString(I18n.locale(), { dateStyle: 'short', timeStyle: 'short' }))}</small><br><small>${esc((x.text || '').slice(0, 140))}</small></span>
          <button class="icon-btn" data-action="msg-delete" data-id="${esc(x.id)}" title="${esc(t('remove'))}" aria-label="${esc(t('remove'))}">✕</button></li>`).join('')}</ul>` : `<p class="muted">${esc(t('msgNone'))}</p>`}
      </div>`;
  }

  function sendMessageForm(f) {
    const target = ui.msgTarget || 'users';
    const msg = { title: f.title.value.trim(), text: f.text.value.trim(), all: false, to: [] };
    if (!msg.text) return warn('errMsgText');
    if (target === 'all') msg.all = true;
    else msg.to = (ui.msgTo || []).slice();
    if (!msg.all && !msg.to.length) return warn('errMsgTo');
    const btn = f.querySelector('button.primary'); btn.disabled = true;
    window.Cloud.sendMessage(msg).then(() => { ui.msgTo = []; ui.flash = { text: t('msgSentOk', { n: msg.all ? t('msgToAll') : msg.to.length }) }; render(); })
      .catch(e => { btn.disabled = false; warn('regError', { code: e.code || e.message }); });
  }

  // ---------- stili grafici (salvati solo su questo dispositivo) ----------
  // [id, colore principale, sfondo, colore accento]
  const THEMES = [
    ['logo', '#0b78b8', '#f3f8f6', '#5e9a22'], ['quattromori', '#c8102e', '#faf7f5', '#111111'],
    ['smeralda', '#00796b', '#eefaf7', '#0098c7'], ['alghero', '#c73b2f', '#fff5f1', '#1b4965'],
    ['mirto', '#6a2c70', '#f8f3f9', '#a87a1c'], ['pietra', '#8a5a2b', '#f4efe6', '#4a6b52'],
    ['fenicotteri', '#c2306a', '#fff4f8', '#1f8a7e'], ['isarutas', '#0a6c8f', '#fbf6ee', '#c4791b'],
    ['carnevale', '#d9a441', '#14100c', '#e0574a'], ['notturna', '#c6f432', '#0b1530', '#4fc1f0']
  ];
  const THEME_KEY = 'pcm-theme';

  function currentTheme() {
    return ui.theme || Consent.read(THEME_KEY) || 'logo';   // senza consenso: solo per questa visita
  }

  function applyTheme(id) {
    const th = THEMES.find(x => x[0] === id) || THEMES[0];
    if (th[0] === 'logo') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', th[0]);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || th[2]);
  }

  function setTheme(id) {
    ui.theme = id; Consent.write(THEME_KEY, id);
    applyTheme(id);
    render();
  }

  // Temi grafici: [id, font Google da caricare, stile dell'anteprima]
  const DESIGNS = [
    ['classico', '', 'font-family:Inter;border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,.08)', 'border-radius:8px'],
    ['quattromori', 'family=Oswald:wght@500;700&family=Source+Sans+3:wght@400;600', 'font-family:Oswald;text-transform:uppercase;color:#141414;background:linear-gradient(#c8102e,#c8102e) 0 58%/100% 7px no-repeat,linear-gradient(#c8102e,#c8102e) 70% 0/7px 100% no-repeat,#fff;border-top:4px solid #c8102e;border-radius:4px', 'background:#c8102e;color:#fff;border-radius:3px'],
    // campi da tennis e padel: terra rossa, erba, cemento, padel di sera (caratteri in assets/fonts/<id>.css)
    ['terrarossa', 'family=Fraunces:wght@600;700&family=DM+Sans:wght@400;500;700', 'font-family:Fraunces;font-weight:600;color:#fffaf3;background:linear-gradient(#fbf3e8,#fbf3e8) 0 80%/100% 3px no-repeat,linear-gradient(#fbf3e8,#fbf3e8) 90% 0/3px 80% no-repeat,linear-gradient(#173f2f,#173f2f) bottom/100% 9px no-repeat,radial-gradient(#7a2b1022 1px,transparent 1.5px) 0 0/9px 9px,linear-gradient(135deg,#d0653a,#a5421e);border-radius:8px', 'background:#173f2f;color:#fffaf3;border-radius:6px'],
    ['erba', 'family=Cormorant+Garamond:wght@600;700&family=Libre+Franklin:wght@400;500;600', 'font-family:"Cormorant Garamond";font-weight:700;font-size:1.35rem;color:#fffdf4;background:linear-gradient(#fffdf4,#fffdf4) 0 72%/100% 3px no-repeat,linear-gradient(#4b2a6b,#4b2a6b) top/100% 5px no-repeat,repeating-linear-gradient(90deg,#3f7e46 0 16px,#4a8b4f 16px 32px);border-radius:4px', 'background:#4b2a6b;color:#fffdf4;border-radius:2px;font-family:"Libre Franklin";letter-spacing:.08em'],
    ['cemento', 'family=Archivo:ital,wght@0,400;0,500;0,700;0,800;1,800', 'font-family:Archivo;font-weight:800;font-style:italic;text-transform:uppercase;color:#fff;background:linear-gradient(#fff,#fff) 0 78%/100% 3px no-repeat,linear-gradient(#fff,#fff) 90% 0/3px 78% no-repeat,linear-gradient(135deg,#2d63bd,#1d4a99) 10px 8px/calc(100% - 20px) calc(100% - 16px) no-repeat,#2a807d;border-radius:14px', 'background:#dcf03c;color:#0d1b2e;border-radius:99px;font-weight:700'],
    ['padel', 'family=Chakra+Petch:wght@600;700&family=Space+Grotesk:wght@400;500;700', 'font-family:"Chakra Petch";font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#c8ff2e;background:radial-gradient(40% 70% at 12% 0%,rgba(223,241,255,.45),transparent),radial-gradient(40% 70% at 88% 0%,rgba(223,241,255,.35),transparent),linear-gradient(#123a7f,#123a7f) bottom/100% 30% no-repeat,#070b12;border:1px solid rgba(191,227,255,.25);border-radius:10px', 'background:#c8ff2e;color:#0b1200;border-radius:6px;box-shadow:0 0 12px rgba(200,255,46,.6)'],
    ['mamuthones', 'family=Alegreya+SC:wght@500;700&family=Alegreya+Sans:wght@400;500;700', 'font-family:"Alegreya SC";color:#d9a441;background:radial-gradient(circle at 80% 30%,#4b3526,#1a130e 60%);border:1px solid #4a3a2c;border-radius:10px', 'background:linear-gradient(#e8b75a,#a8762a);color:#1b1206;border-radius:8px'],
    ['monteprama', 'family=Cinzel:wght@600;700&family=Source+Sans+3:wght@400;600', 'font-family:Cinzel;font-weight:700;letter-spacing:.06em;color:#4a3920;background:radial-gradient(circle at 78% 40%,transparent 7px,#8a7350 7.5px 9px,transparent 9.5px 13px,#8a7350 13.5px 15px,transparent 15.5px),#ece3d2;border-radius:2px', 'background:#7a5530;color:#fff;border-radius:2px'],
    ['tessuto', 'family=Josefin+Sans:wght@600;700&family=Nunito+Sans:wght@400;600;700', 'font-family:"Josefin Sans";font-weight:700;color:#1f1a17;background:repeating-linear-gradient(90deg,#b3261e 0 10px,#f2b632 10px 14px,#1a1a1a 14px 18px) top/100% 10px no-repeat,#fffaf1;padding-top:18px;border-radius:6px', 'background:#b3261e;color:#fff;border-radius:4px'],
    ['spiaggia', 'family=Baloo+2:wght@700;800&family=Nunito:wght@400;600;800', 'font-family:"Baloo 2";font-weight:800;color:#18324a;background:linear-gradient(#7fd3f5 0 45%,#13a8cf 45% 65%,#f3d9a4 65%);border-radius:20px', 'background:#f08a24;color:#fff;border-radius:99px'],
    ['arena', 'family=Barlow+Condensed:ital,wght@1,700;1,800&family=Barlow:wght@400;500;700', 'font-family:"Barlow Condensed";font-style:italic;text-transform:uppercase;color:#c6f432;background:radial-gradient(50% 60% at 15% 0%,rgba(255,251,224,.35),transparent),linear-gradient(#070d22,#1b2c63);border-radius:10px', 'background:#c6f432;color:#142004;border-radius:6px;font-style:italic'],
    ['sartiglia', 'family=Playfair+Display:wght@700&family=Lato:wght@400;700', 'font-family:"Playfair Display";font-weight:700;color:#c8151e;background:radial-gradient(circle at 80% 35%,#fff 0 7px,#c8151e 7.5px 12px,#d4a52a 12.5px 15px,transparent 15.5px),#fbf6f1;border-top:6px solid #c8151e;border-radius:12px', 'background:#c8151e;color:#fff;border-radius:6px'],
    ['nuraghe', 'family=Marcellus&family=Source+Sans+3:wght@400;600', 'font-family:Marcellus;color:#24221d;background:radial-gradient(ellipse 30% 22% at 30% 70%,#8a8576 98%,transparent),radial-gradient(ellipse 30% 22% at 75% 75%,#9d9480 98%,transparent),linear-gradient(#4f8fd8,#bcd6f0);border-radius:18px 18px 18px 4px', 'background:#1f5f9e;color:#fff;border-radius:10px'],
    ['molentargius', 'family=Quicksand:wght@500;700', 'font-family:Quicksand;font-weight:700;color:#c94f7c;background:linear-gradient(180deg,#fbeef3 0 55%,#6b8aa3 55%);border-radius:22px', 'background:#c94f7c;color:#fff;border-radius:99px'],
    ['cagliari', 'family=Montserrat:wght@500;700;800', 'font-family:Montserrat;font-weight:800;color:#fff;background:radial-gradient(60% 80% at 85% 20%,rgba(247,162,27,.55),transparent),linear-gradient(120deg,#4b1f75,#d6249f);border-radius:12px', 'background:#f7a21b;color:#2a0e3d;border-radius:99px'],
    ['sabbia', 'family=Barlow+Condensed:wght@600;700;800&family=Manrope:wght@400;600;700;800', 'font-family:"Barlow Condensed";font-weight:800;text-transform:uppercase;color:#F6F1E7;background:linear-gradient(#10233A,#10233A) 0 0/100% 34%,#F6F1E7;border-radius:16px', 'background:#88C133;color:#10233A;border-radius:12px'],
    ['halloween', 'family=Creepster&family=Manrope:wght@400;600;700;800', 'font-family:Creepster;font-size:1.3rem;color:#FF7A1A;background:url(img/themes/hw-web.svg) 0 0/60px no-repeat,url(img/themes/hw-pumpkin.svg) right 6px bottom 4px/34px no-repeat,radial-gradient(120% 80% at 80% 0%,#3A1E5C,#1A1033);border-radius:16px', 'background:#FF7A1A;color:#1A0A00;border-radius:12px'],
    ['natale', 'family=Mountains+of+Christmas:wght@700&family=Manrope:wght@400;600;700;800', 'font-family:"Mountains of Christmas";font-weight:700;font-size:1.3rem;color:#fff;background:url(img/themes/xm-lights.svg) 0 0/120px 18px repeat-x,url(img/themes/xm-tree.svg) right 6px bottom 4px/30px no-repeat,linear-gradient(#B51E33 0 30%,#0D2A24 30%);padding-top:24px;border-radius:16px', 'background:#D7263D;color:#fff;border-radius:12px'],
    ['capodanno', 'family=Playfair+Display:wght@700&family=Manrope:wght@400;600;700;800', 'font-family:"Playfair Display";font-weight:700;font-size:1.2rem;color:#E8C15A;background:url(img/themes/cp-firework.svg) right 4px top 2px/40px no-repeat,url(img/themes/cp-glasses.svg) right 6px bottom 4px/34px no-repeat,url(img/themes/cp-confetti.svg) 0 0/120px,radial-gradient(120% 80% at 80% 0%,#23284A,#0B0D1A);border-radius:16px', 'background:#E8C15A;color:#1A1400;border-radius:12px'],
    ['befana', 'family=Henny+Penny&family=Manrope:wght@400;600;700;800', 'font-family:"Henny Penny";font-size:1.2rem;color:#F2C14E;background:url(img/themes/bf-moon.svg) 46% bottom 6px/26px no-repeat,url(img/themes/bf-stocking.svg) right 8px bottom 4px/30px no-repeat,radial-gradient(120% 80% at 80% 0%,#2A3570,#141B3D);border-radius:16px', 'background:#E8892B;color:#1A0E00;border-radius:12px'],
    ['fumetto', 'family=Fira+Sans+Extra+Condensed:wght@500;800;900', 'font-family:"Fira Sans Extra Condensed";font-weight:900;text-transform:uppercase;color:#111;background:radial-gradient(rgba(230,25,75,.25) 1.4px,transparent 1.6px) 0 0/10px 10px,#fff4c9;border:3px solid #111;border-radius:12px;box-shadow:4px 4px 0 #1e6bff', 'background:#ffd400;color:#111;border:2px solid #111']
  ];
  const DESIGN_KEY = 'pcm-design';

  function currentDesign() {
    // Stile predefinito: Quattro Mori (ognuno può sceglierne un altro in Impostazioni).
    // Periodi a tema (Halloween, Natale, Capodanno, Befana: vedi BpaSeason in boot.js): per tutti, salvo chi in quei giorni sceglie un altro stile.
    return ui.design || BpaSeason.design(Consent.read(DESIGN_KEY), Consent.read('pcm-design-hw'), Consent.read('pcm-design-prev'));
  }

  // caratteri del tema: file dentro l'app (nessuna richiesta a Google Fonts)
  function loadFonts(query, id) {
    if (!query || document.getElementById('font-' + id)) return;
    const l = document.createElement('link');
    l.id = 'font-' + id; l.rel = 'stylesheet';
    l.href = `assets/fonts/${id}.css`;
    document.head.appendChild(l);
  }

  function applyDesign(id) {
    const d = DESIGNS.find(x => x[0] === id) || DESIGNS[0];
    if (d[0] === 'classico') document.documentElement.removeAttribute('data-design');
    else document.documentElement.setAttribute('data-design', d[0]);
    loadFonts(d[1], d[0]);
  }

  function setDesign(id) {
    // stile normale scelto: diventa lo "stile di prima" a cui si torna dopo un periodo a tema
    const seasonal = BpaSeason.list.some(x => x[0] === id), old = Consent.read(DESIGN_KEY);
    if (!seasonal) Consent.write('pcm-design-prev', id);
    else if (old && !BpaSeason.list.some(x => x[0] === old)) Consent.write('pcm-design-prev', old);
    ui.design = id; Consent.write(DESIGN_KEY, id);
    if (BpaSeason.current()) Consent.write('pcm-design-hw', BpaSeason.key());   // scelta fatta durante un periodo a tema: resta fino alla fine del periodo
    applyDesign(id);
    render();
  }

  function designCard() {
    const cur = currentDesign();
    DESIGNS.forEach(d => loadFonts(d[1], d[0]));
    return `<div class="card" id="design">
      <h2><i class="ti ti-layout-dashboard" aria-hidden="true"></i> ${esc(t('designTitle'))}</h2>
      <p class="muted small">${esc(t('designHelp'))}</p>
      <div class="theme-grid">${DESIGNS.map(([id, , pv, pb]) => `
        <button class="design-opt" data-action="set-design" data-design-id="${id}" aria-pressed="${cur === id}">
          <span class="pv" style='${pv}'><b>${esc(Club.short)}</b><span class="pb" style='${pb}'>6-4</span></span>
          <span class="nm">${esc(t('design_' + id))}</span>
          <span class="ds">${esc(t('designDesc_' + id))}</span>
        </button>`).join('')}</div>
    </div>`;
  }

  function themeCard() {
    const cur = currentTheme();
    return `<div class="card" id="theme">
      <h2><i class="ti ti-palette" aria-hidden="true"></i> ${esc(t('themeTitle'))}</h2>
      <p class="muted small">${esc(t('themeHelp'))}</p>
      <div class="theme-grid">${THEMES.map(([id, p, bg, a]) => `
        <button class="theme-opt" data-action="set-theme" data-theme-id="${id}" aria-pressed="${cur === id}">
          <span class="sw"><span style="background:${bg}"></span><span style="background:${p}"></span><span style="background:${a}"></span></span>
          ${esc(t('theme_' + id))}
        </button>`).join('')}</div>
    </div>`;
  }

  function viewSettings() {
    const user = window.Cloud && window.Cloud.user;
    let account;
    if (user && admin()) {
      account = `<p><i class="ti ti-circle-check" aria-hidden="true"></i> ${esc(t('loggedInAs', { email: user.email }))}</p>
        <button class="btn" data-action="logout">${esc(t('logout'))}</button>`;
    } else if (user && member()) {
      account = `<p><i class="ti ti-circle-check" aria-hidden="true"></i> ${esc(t('loggedInAs', { email: `${personName(member())} · ${user.email}` }))}</p>
        <div class="btn-row"><a class="btn primary" href="#/me"><i class="ti ti-user" aria-hidden="true"></i> ${esc(t('profile'))}</a>
        <button class="btn" data-action="logout">${esc(t('logout'))}</button></div>`;
    } else if (user && window.Cloud.authBusy) {
      account = `<p class="muted"><i class="ti ti-loader-2" aria-hidden="true"></i> ${esc(t('loading'))}</p>`;
    } else if (user && cashier()) {
      account = `<p><i class="ti ti-circle-check" aria-hidden="true"></i> ${esc(t('loggedInAs', { email: user.email }))}</p>
        <button class="btn" data-action="logout">${esc(t('logout'))}</button>`;
    } else if (user) {
      // primo accesso con Google (o account senza profilo): si completa la registrazione
      const g = ui.gName || (() => { const p = String(user.displayName || '').trim().split(/\s+/).filter(Boolean); return { first: p[0] || '', last: p.slice(1).join(' ') }; })();
      account = `<p>${esc(t('completeHelp', { email: user.email || '' }))}</p>
        <form class="grid-form" data-form="complete-profile">
          <label>${esc(t('firstName'))}<input name="first" required maxlength="60" autocomplete="given-name" value="${esc(g.first)}"></label>
          <label>${esc(t('lastName'))}<input name="last" required maxlength="60" autocomplete="family-name" value="${esc(g.last)}"></label>
          <label>${esc(t('gender'))}<select name="gender" required><option value="">—</option><option value="M">${esc(t('male'))}</option><option value="F">${esc(t('female'))}</option></select></label>
          <label class="check span-all legal-check"><input type="checkbox" name="privacy" required> <span>${t('registerPrivacy')}</span></label>
          <label class="check span-all legal-check"><input type="checkbox" name="age14" required> <span>${esc(t('registerAge'))}</span></label>
          <div class="form-actions span-all"><button type="button" class="btn" data-action="logout">${esc(t('logout'))}</button><button class="btn primary">${esc(t('completeBtn'))}</button></div>
        </form>`;
    } else {
      account = `<p class="muted">${esc(t('loginHelpAll'))}</p>
        <div class="google-login"><button type="button" class="btn google-btn" data-action="login-google"><i class="ti ti-brand-google" aria-hidden="true"></i> ${esc(t('loginGoogle'))}</button>
          <span class="or-sep">${esc(t('orEmail'))}</span></div>
        <form class="grid-form" data-form="login">
          <label>Email<input name="email" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
          <label>${esc(t('password'))}<input name="password" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" required></label>
          <div class="form-actions">
            <button type="button" class="btn small" data-action="reset-password">${esc(t('forgotPassword'))}</button>
            <button class="btn primary">${esc(t('login'))}</button>
          </div>
        </form>
        <details class="sub-form" data-keep="register" ${ui.showRegister || keepOpen('register') ? 'open' : ''}><summary><i class="ti ti-user-plus" aria-hidden="true"></i> ${esc(t('registerTitle'))}</summary>
          <p class="muted small">${esc(t('registerHelp'))}</p>
          <form class="grid-form" data-form="register">
            <label>${esc(t('firstName'))}<input name="first" required maxlength="60" autocomplete="given-name"></label>
            <label>${esc(t('lastName'))}<input name="last" required maxlength="60" autocomplete="family-name"></label>
            <label>${esc(t('gender'))}<select name="gender" required><option value="">—</option><option value="M">${esc(t('male'))}</option><option value="F">${esc(t('female'))}</option></select></label>
            <label>Email<input name="email" type="email" required autocomplete="email" autocapitalize="off" spellcheck="false"></label>
            <label>${esc(t('password'))}<input name="password" type="password" required minlength="6" autocomplete="new-password"></label>
            <label class="check span-all legal-check"><input type="checkbox" name="privacy" required> <span>${t('registerPrivacy')}</span></label>
            <label class="check span-all legal-check"><input type="checkbox" name="age14" required> <span>${esc(t('registerAge'))}</span></label>
            <div class="form-actions"><button class="btn primary">${esc(t('registerBtn'))}</button></div>
          </form>
        </details>`;
    }
    const link = (icon, title, help, href, label) => `<div class="card"><h2><i class="ti ti-${icon}" aria-hidden="true"></i> ${esc(title)}</h2>
        <p class="muted small">${esc(help)}</p><a class="btn primary" href="${href}">${esc(label || title)} →</a></div>`;
    return `
      <div class="page-head"><h1>${esc(t('settings'))}</h1></div>
      <div class="card admin-card" id="login">
        <h2><i class="ti ti-key" aria-hidden="true"></i> ${esc(t(member() ? 'myAccount' : user && !admin() && !cashier() && !window.Cloud.authBusy ? 'completeTitle' : user ? 'adminArea' : 'loginOrRegister'))}</h2>
        ${account}
      </div>
      ${fullAdmin() ? link('mail', t('messages'), t('messagesIntro'), '#/messages', t('messagesOpen')) : ''}
      ${admin() ? `<div class="card"><h2><i class="ti ti-users" aria-hidden="true"></i> ${esc(t('usersTitle'))} (${(S().members || []).length})</h2>
        ${homonymPending().length ? `<p class="note warn">${esc(t('homonymWarn'))}</p>` : `<p class="muted small">${esc(t('usersIntro'))}</p>`}
        <a class="btn primary" href="#/users">${esc(t('usersOpen'))} →</a></div>` : ''}
      ${cashier() ? link('cash-register', t('caTitle'), t('caIntroShort'), '#/cassa') : ''}
      ${admin() ? link('report-analytics', t('rpTitle'), t('rpIntro'), '#/report') : ''}
      ${admin() ? link('cash-register', t('payAdminTitle'), t('payAdminIntro'), '#/payments') : ''}
      ${fullAdmin() ? link('layout-grid', `${t('courtsManage')} (${(S().courts || []).length})`, t('courtsIntro'), '#/courts', t('courtsManage')) : ''}
      <div class="card">
        <h2>${esc(t('language'))}</h2>
        <div class="segmented wrap" role="group">
          ${[['it', 'Italiano'], ['en', 'English']].map(([c, n]) => `<button data-action="set-lang" data-lang="${c}" aria-pressed="${I18n.lang === c}">${n}</button>`).join('')}
        </div>
      </div>
      ${designCard()}
      ${themeCard()}`;
  }

  function setNotice(scope, text) {
    S().notice = text; if (!text) S().noticeUntil = '';
    ui.editNotice = null;
    commit(t(text ? 'noticeSaved' : 'noticeRemoved'));
  }

  // ---------- azioni ----------
  const confirmed = (key, p) => confirm(t(key, p));

  const actions = Object.assign({}, trActions, occActions, evActions, payActions, statActions, privacyActions, reportActions, cassaActions, {
    'user-reset': el => {
      const m = memberByUid(el.dataset.uid), email = (S().accounts || {})[el.dataset.uid];
      if (!canEditUser(el.dataset.uid)) return;
      if (!m || !email || !confirmed('userResetConfirm', { n: personName(m), e: email })) return;
      el.disabled = true;
      window.Cloud.resetPassword(email).then(() => { ui.flash = { text: t('userResetSent', { e: email }) }; render(); })
        .catch(e => { el.disabled = false; warn('regError', { code: e.code || e.message }); });
    },
    'user-filter-clear': () => { ui.userFilter = ''; render(); },
    'user-role-tab': el => { ui.userRole = el.dataset.r; render(); },
    'user-delete': el => {
      const m = memberByUid(el.dataset.uid);
      if (!m || !canDeleteUser(m.uid)) return;   // l'admin centro non elimina un admin generale
      const email = (S().accounts || {})[m.uid] || '';
      if (!confirmed('userDeleteConfirm', { n: personName(m), e: email })) return;
      // tolto da tutti i gruppi degli allenamenti; piani eliminati; poi scheda, profilo, email, conferme, lista nera, coach
      const groups = (S().groups || []).filter(g => (g.uids || []).includes(m.uid)).map(g => {
        const names = Object.assign({}, g.names || {}); delete names[m.uid];
        const data = Object.assign({}, g, { uids: g.uids.filter(x => x !== m.uid), names, updated: Date.now() }); delete data.id;
        return { id: g.id, data, tr: !!trainingById(g.tid) };   // allenamento ancora esistente: si aggiorna il numero del gruppo
      });
      const planIds = (S().plans || []).filter(p => p.uid === m.uid).map(p => p.id);
      const packIds = (S().packs || []).filter(k => k.uid === m.uid).map(k => k.id);
      window.Cloud.deleteUser(m.uid, groups, planIds, packIds).then(() => {
        ui.flash = { text: t('userDeleted', { n: personName(m) }) }; render();
      }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'ver-manual': el => {
      const on = el.dataset.on === '1', m = memberByUid(el.dataset.uid);
      if (!confirmed(on ? 'verConfirmAsk' : 'verUndoAsk', { n: m ? personName(m) : '' })) return;
      window.Cloud.setManualVerified(el.dataset.uid, on).then(() => { ui.flash = { text: t('saved') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'verify-resend': () => {
      // al massimo un invio al minuto (Firebase blocca gli invii troppo ravvicinati)
      if (Date.now() < (ui.verifyWait || 0)) return warn('verifyWait', { s: Math.ceil((ui.verifyWait - Date.now()) / 1000) });
      ui.verifyWait = Date.now() + 60000;
      window.Cloud.resendVerification().then(() => { ui.flash = { text: t('verifySent', { e: window.Cloud.user.email }) }; render(); })
        .catch(e => warn(e.code === 'auth/too-many-requests' ? 'verifyTooMany' : 'verifyMailFail', { code: e.code || e.message }));
    },
    'verify-check': () => window.Cloud.checkVerified().then(ok => { if (ok) { ui.flash = { text: t('verifyOk') }; render(); } else warn('verifyNotYet'); }),
    'bk-day': el => { ui.bookDate = addDays(ui.bookDate || todayStr(), Number(el.dataset.delta)); render(); },
    'bk-band': el => { ui.bookBand = el.dataset.band; render(); },
    'bk-type': el => { ui.bookType = el.dataset.type; render(); },
    'bk-dur': el => { const x = ui.bkSel, m = Number(el.dataset.m); if (x && m >= minBook() && selFree(x.courtId, x.date, x.from, addMin(x.from, m), x.editId)) { x.to = addMin(x.from, m); render(); } },
    'bk-slot': el => {
      if (!(member() || admin())) { location.hash = '#/settings'; return warn('bkLoginFirst'); }
      slotClick(el.dataset.court, el.dataset.t);
    },
    'bk-clear': () => { ui.bkSel = null; render(); },
    'bk-shorter': () => { const x = ui.bkSel; if (x && toMin(x.to) - toMin(x.from) - 30 >= minBook()) { x.to = addMin(x.to, -30); render(); } },
    'bk-longer': () => { const x = ui.bkSel; if (x && selFree(x.courtId, x.date, x.from, addMin(x.to, 30), x.editId)) { x.to = addMin(x.to, 30); render(); } },
    'booking-open': el => {
      const b = (S().bookings || []).find(x => x.id === el.dataset.id);
      if (!b || !(admin() || b.userId === myUid())) return;
      ui.bkSel = { courtId: b.courtId, date: b.date, from: b.from, to: b.to, editId: b.id, userId: b.guest ? null : b.userId, blocked: b.blocked || '', guest: b.guest || '' };
      ui.bookDate = b.date;
      if (!location.hash.startsWith('#/book')) location.hash = '#/book'; else render();
      setTimeout(() => { const x = document.querySelector('.book-summary'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
    },
    'bk-info': el => bkInfoDialog(el.dataset.id, el.dataset.date),
    'bk-train': el => {
      // scheda dell'allenamento in quel giorno (Allenamenti → Presenze del giorno)
      ui.trTab = 'day'; ui.trView = 'day'; ui.trDay = el.dataset.date;
      const id = `occ-${el.dataset.tid}-${el.dataset.date}`;
      if (location.hash !== '#/train') location.hash = '#/train'; else render();
      setTimeout(() => { const x = document.getElementById(id); if (x) { x.scrollIntoView({ behavior: 'smooth', block: 'start' }); x.classList.add('flash-focus'); setTimeout(() => x.classList.remove('flash-focus'), 2000); } }, 400);
    },
    'booking-confirm': () => confirmBooking(),
    'booking-delete': el => removeBooking(el.dataset.id),
    'notice-dismiss': el => {
      const n = (S().notices || []).find(x => x.id === el.dataset.id);
      if (!n) return;
      const shared = n.to === 'admins';
      if (shared) n.readBy = (n.readBy || []).concat([myUid()]); else S().notices = (S().notices || []).filter(x => x.id !== n.id);
      window.Cloud.dismissNotice(n.id, shared); render();
    },
    'notice-read-all': () => {
      const me = myUid();
      (S().notices || []).filter(n => n.to === 'admins' && !(n.readBy || []).includes(me)).forEach(n => { n.readBy = (n.readBy || []).concat([me]); window.Cloud.dismissNotice(n.id, true); });
      render();
    },
    'court-add': () => { S().courts = (S().courts || []).concat(Store.normCourt({ id: Store.uid('c'), name: `${t('bkCourt')} ${(S().courts || []).length + 1}` })); commit(); },
    'court-delete': el => {
      if (!confirmed('courtDeleteConfirm')) return;
      S().courts = (S().courts || []).filter(c => c.id !== el.dataset.id);
      (S().recurring || []).filter(r => r.courtId === el.dataset.id).forEach(r => window.Cloud.deleteRecurring(r).catch(() => {}));
      commit(t('saved'));
    },
    'recurring-delete': el => {
      const r = (S().recurring || []).find(x => x.id === el.dataset.id);
      if (!r || !confirmed('recurringDeleteConfirm', { c: courtName(r.courtId), d: dayName(r.dow), a: r.from, b: r.to })) return;
      window.Cloud.deleteRecurring(r).then(() => { ui.flash = { text: t('saved') }; render(); }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'court-copy': el => {
      const f = el.closest('form');
      [2, 3, 4, 5, 6, 7].forEach(n => {
        f.elements['open' + n].checked = f.elements.open1.checked;
        f.elements['from' + n].value = f.elements.from1.value;
        f.elements['to' + n].value = f.elements.to1.value;
      });
      // senza ridisegnare la pagina (gli orari copiati vanno ancora salvati)
      if (!f.querySelector('.flash')) { const fl = document.createElement('div'); fl.className = 'flash ok'; fl.textContent = t('courtCopied'); f.prepend(fl); }
    },
    'set-lang': el => { I18n.set(el.dataset.lang); render(); },
    'set-theme': el => setTheme(el.dataset.themeId),
    'set-design': el => setDesign(el.dataset.designId),
    'notice-edit': el => { ui.editNotice = el.dataset.scope; render(); },
    'profile-edit': () => { ui.editProfile = true; render(); },
    'profile-cancel': () => { ui.editProfile = false; render(); },
    'msg-read': el => { window.Cloud.markRead(el.dataset.id); S().inbox = (S().inbox || []).concat(el.dataset.id); render(); },
    'msg-target': el => { ui.msgTarget = el.dataset.v; render(); },
    'msg-delete': el => { if (!confirmed('confirmMsgDelete')) return; window.Cloud.deleteMessage(el.dataset.id).catch(e => warn('regError', { code: e.code || e.message })); },
    'editorial-edit': el => { ui.editEditorial = +el.dataset.idx; render(); },
    'editorial-cancel': () => { ui.editEditorial = null; render(); },
    'editorial-clear': el => {
      if (!confirmed('confirmEdClear')) return;
      const i = +el.dataset.idx;
      S().editorial = (S().editorial || [null, null]).slice(); S().editorial[i] = null;
      ui.editEditorial = null;
      if (window.Cloud && window.Cloud.saveEditorial) window.Cloud.saveEditorial(i, null).catch(e => App.error(e.code || e.message));
      render();
    },
    'notice-cancel': () => { ui.editNotice = null; render(); },
    'notice-clear': el => {
      if (!confirmed('confirmNoticeClear')) return;
      setNotice('home', '');
    },
    'logout': () => { window.Cloud.logout(); location.hash = '#/settings'; },
    'login-google': el => {
      el.disabled = true;
      window.Cloud.loginGoogle().then(g => new Promise(resolve => {
        ui.gName = { first: g.first, last: g.last };
        const t0 = Date.now();
        (function wait() { if (!window.Cloud.authBusy || Date.now() - t0 > 10000) resolve(); else setTimeout(wait, 150); })();
      })).then(() => {
        if (member() || admin() || cashier()) { ui.flash = { text: t('loginOk') }; if (location.hash.startsWith('#/settings')) location.hash = '#/'; }
        else { ui.flash = { text: t('completeFirst') }; location.hash = '#/settings'; }
        render();
      }).catch(e => { el.disabled = false; if (e && /popup-closed|cancelled-popup/.test(e.code || '')) return; warn(e && e.code === 'auth/popup-blocked' ? 'googlePopupBlocked' : 'googleFailed', { code: (e && (e.code || e.message)) || '' }); });
    },
    'reset-password': el => {
      const email = el.closest('form').email.value.trim();
      if (!email) return warn('enterEmailFirst');
      window.Cloud.resetPassword(email)
        .then(() => { ui.flash = { text: t('resetSent') }; render(); })
        .catch(() => warn('resetFailed'));
    },
    'close-dialog': () => $dialog.close()
  });

  const forms = Object.assign({}, trForms, occForms, payForms, cassaForms, {
    'user-create': f => {
      const d = { first: f.first.value.trim(), last: f.last.value.trim(), gender: f.gender.value, email: f.email.value.trim(), password: f.password.value, role: f.role.value };
      if (!d.first || !d.last || !d.gender) return warn('errRegFields');
      if (!grantable().includes(d.role)) return warn('errPermission');
      const btn = f.querySelector('button.primary'); btn.disabled = true;
      window.Cloud.adminCreateUser(d).then(() => { (ui.keep || {})['user-create'] = false; ui.flash = { text: t('userCreatedRole', { e: d.email, r: t('role_' + d.role) }) }; render(); })
        .catch(e => { btn.disabled = false; warn(e.code === 'auth/email-already-in-use' ? 'userCreateExists' : e.code === 'auth/weak-password' ? 'registerWeak' : 'regError', { code: e.code || e.message }); });
    },
    'court-save': f => {
      const c = courtById(f.id.value);
      if (!c) return;
      const hours = {};
      for (let n = 1; n <= 7; n++) {
        const o = { open: f.elements['open' + n].checked, from: f.elements['from' + n].value, to: f.elements['to' + n].value };
        if (o.open && o.to <= o.from) return warn('courtHoursErr', { d: dayName(n) });
        hours[n] = o;
      }
      Object.assign(c, { name: f.name.value.trim() || c.name, type: f.type.value === 'padel' ? 'padel' : 'tennis', visible: f.visible.checked, hours });
      commit(t('saved'));
    },
    'recurring-add': f => addRecurringForm(f),
    'booking-settings': f => {
      if (Number(f.minHours.value) > Number(f.maxHours.value)) return warn('bkMinMax');
      S().booking = { minHours: Number(f.minHours.value) || 1, maxHours: Number(f.maxHours.value) || 2, maxPerDay: Math.max(1, parseInt(f.maxPerDay.value, 10) || 1), daysAhead: Math.max(1, parseInt(f.daysAhead.value, 10) || 7) };
      commit(t('saved'));
    },
    'book-rewards-save': f => {
      const th = {};
      REWARDS.forEach(([k]) => { const v = parseInt(f[k].value, 10); if (v > 0) th[k] = v; });
      S().bookRewards = th;
      commit(t('saved'));
    },
    'msg-send': f => sendMessageForm(f),
    'member-rename': f => {
      const uid = f.dataset.uid, first = f.first.value.trim(), last = f.last.value.trim();
      if (!canEditUser(uid)) return;
      if (!first || !last) return warn('errRegFields');
      window.Cloud.renameMember(uid, first, last).then(() => {
        ui.flash = { text: t('userRenamed') }; render();
        (ui.keep || {})['ren-' + uid] = false;
      }).catch(e => warn('regError', { code: e.code || e.message }));
    },
    'nick-save': f => {
      const uid = f.dataset.uid, nick = f.nick.value.trim();
      const taken = Object.entries(S().nicks || {}).find(([u, n]) => u !== uid && n && n.toLowerCase() === nick.toLowerCase());
      if (nick && taken) return warn('nickTaken');
      S().nicks = Object.assign({}, S().nicks || {});
      if (nick) S().nicks[uid] = nick; else delete S().nicks[uid];
      commit(t('saved'));
    },
    'editorial-save': f => { saveEditorialForm(f); },
    'notice-save': f => {
      S().noticeUntil = f.until ? f.until.value : '';
      setNotice('home', f.text.value.trim());
    },
    'register': f => {
      const btn = f.querySelector('button.primary');
      const d = { first: f.first.value.trim(), last: f.last.value.trim(), gender: f.gender.value, email: f.email.value.trim(), password: f.password.value };
      if (!d.first || !d.last || !d.gender) return warn('errRegFields');
      if (!f.privacy.checked) return warn('registerPrivacyNeeded');
      if (f.age14 && !f.age14.checked) return warn('registerAgeNeeded');
      // contro i tentativi automatici: almeno 20 secondi tra un tentativo e l'altro (oltre ai limiti di Firebase)
      if (Date.now() < (ui.regWait || 0)) return warn('tooManyTries');
      ui.regWait = Date.now() + 20000;
      d.privacyVer = Legal.VERSION;
      btn.disabled = true;
      window.Cloud.register(d).then(res => {
        ui.verifyWait = Date.now() + 60000;
        if (res && res.mailErr) warn('verifyMailFail', { code: res.mailErr }); else ui.flash = { text: t('registerOkMail', { e: d.email }) };
        location.hash = '#/me'; render();
      })
        .catch(e => { btn.disabled = false; ui.showRegister = true; warn(e.code === 'auth/email-already-in-use' ? 'registerExists' : e.code === 'auth/weak-password' ? 'registerWeak' : e.code === 'auth/too-many-requests' ? 'tooManyTries' : 'registerErr', { code: e.code || e.message }); });
    },
    'complete-profile': f => {
      const d = { first: f.first.value.trim(), last: f.last.value.trim(), gender: f.gender.value, privacyVer: Legal.VERSION };
      if (!d.first || !d.last || !d.gender) return warn('errRegFields');
      if (!f.privacy.checked) return warn('registerPrivacyNeeded');
      if (!f.age14.checked) return warn('registerAgeNeeded');
      const btn = f.querySelector('button.primary'); btn.disabled = true;
      window.Cloud.completeProfile(d).then(() => { ui.gName = null; ui.flash = { text: t('completeDone') }; location.hash = '#/'; render(); })
        .catch(e => { btn.disabled = false; warn('regError', { code: e.code || e.message }); });
    },
    'profile-save': f => {
      const d = { first: f.first.value.trim(), last: f.last.value.trim(), gender: f.gender.value };
      if (!d.first || !d.last) return warn('errRegFields');
      window.Cloud.updateProfile(d).then(() => { ui.editProfile = false; ui.flash = { text: t('saved') }; render(); })
        .catch(e => warn('regError', { code: e.code || e.message }));
    },
    'login': f => {
      const btn = f.querySelector('button.primary');
      btn.disabled = true;
      // si esce dal campo della password (e su telefono si chiude la tastiera): la pagina si aggiorna subito
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      window.Cloud.login(f.email.value.trim(), f.password.value)
        .then(() => new Promise(resolve => {
          // si aspetta che il profilo sia caricato (connessione lenta: fino a 10 secondi), poi conferma e prima pagina
          const t0 = Date.now();
          (function wait() { if (member() || admin() || Date.now() - t0 > 10000) resolve(); else setTimeout(wait, 150); })();
        }))
        .then(() => {
          ui.flash = { text: t('loginOk') };
          if (member() && location.hash.startsWith('#/settings')) location.hash = '#/';
          render();
        })
        .catch(() => { btn.disabled = false; warn('loginFailed'); });
    }
  });

  // Azioni consentite a tutti; le altre solo agli amministratori (o al ruolo indicato).
  const PUBLIC_ACTIONS = new Set(['login-google', 'set-lang', 'set-theme', 'set-design', 'logout', 'reset-password', 'close-dialog', 'bk-day', 'bk-band', 'bk-type', 'bk-dur', 'bk-slot', 'bk-clear', 'bk-shorter', 'bk-longer']);
  // cassa: registra incassi, scarica ricevute e prospetto
  const CASH_ACTIONS = new Set(['ca-month', 'ca-addline', 'ca-xlsx', 'rc-pdf']);
  const CASH_FORMS = new Set(['ca-save']);
  // Admin Centro: allenamenti (vede tutti, annulla una giornata, elimina)
  const CENTER_ACTIONS = new Set(['tr-delete', 'occ-cancel', 'occ-remove', 'occ-restore', 'occ-copy-group', 'tr-edit', 'tr-edit-cancel', 'tr-copy', 'grp-remove', 'att-force']);
  const CENTER_FORMS = new Set(['tr-save', 'grp-add', 'occ-copy']);
  const PUBLIC_FORMS = new Set(['login', 'register', 'complete-profile']);
  // solo admin (non la segreteria): impostazioni dei campi, regole di prenotazione, listino, avvisi, articoli, messaggi
  const ADMIN_FORMS = new Set(['court-save', 'recurring-add', 'booking-settings', 'book-rewards-save', 'msg-send', 'nick-save', 'editorial-save', 'notice-save', 'prices-save']);
  const ADMIN_ACTIONS = new Set(['court-add', 'court-delete', 'recurring-delete', 'court-copy', 'msg-delete', 'msg-target', 'editorial-edit', 'editorial-clear', 'notice-edit', 'notice-clear']);
  const MEMBER_ACTIONS = new Set(['wr-go', 'wr-share', 'tr-past', 'tr-view', 'tr-dmonth', 'notice-read-all', 'profile-edit', 'profile-cancel', 'msg-read', 'verify-resend', 'verify-check', 'booking-open', 'booking-confirm', 'booking-delete', 'notice-dismiss', 'tr-month', 'tr-day', 'tr-tab', 'att-set', 'spot-apply', 'spot-withdraw', 'spot-seen', 'rc-pdf', 'st-period', 'st-ref', 'privacy-accept', 'my-data', 'delete-request']);
  const MEMBER_FORMS = new Set(['profile-save']);
  // allenatore: presenze e scheda di valutazione dei propri allenamenti (controllo anche nell'azione e nelle regole)
  const COACH_ACTIONS = new Set(['att-force', 'ev-vote', 'ev-save', 'ev-save-all', 'occ-confirm']);
  let submitMode = 'save';

  // reminder delle prenotazioni: la prima pagina si aggiorna ogni minuto (compaiono e spariscono da soli)
  setInterval(() => { const h = location.hash || '#/'; if (h === '#/' || h === '#') refresh(); }, 60000);
  // tornando nell'app dopo aver aperto il link dell'email, la conferma si controlla da sola
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && needsVerify()) window.Cloud.checkVerified().then(ok => { if (ok) { ui.flash = { text: t('verifyOk') }; render(); } }).catch(() => {});
  });
  // Nuova versione pubblicata: l'app (anche quella aggiunta alla schermata Home) la carica da sola.
  // Se l'utente sta scrivendo, compare un avviso con il pulsante per aggiornare.
  const myVer = ((document.querySelector('script[src*="js/app.js?v="]') || {}).src || '').split('v=')[1] || '';
  let verShown = false;
  async function checkVersion() {
    if (!myVer || !navigator.onLine) return;
    try {
      const html = await (await fetch('./?ver=' + Date.now(), { cache: 'no-store' })).text();
      const m = html.match(/js\/app\.js\?v=([\w.-]+)/);
      if (!m || m[1] === myVer) return;
      if (!isTyping()) { location.reload(); return; }
      if (verShown) return;
      verShown = true;
      const bar = document.createElement('div');
      bar.className = 'ver-bar'; bar.setAttribute('role', 'status');
      bar.innerHTML = `<span>${esc(t('newVersion'))}</span><button class="btn small primary" type="button">${esc(t('newVersionBtn'))}</button>`;
      bar.querySelector('button').addEventListener('click', () => location.reload());
      document.body.appendChild(bar);
    } catch (e) { /* offline */ }
  }
  setInterval(checkVersion, 600000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkVersion(); });
  setTimeout(checkVersion, 5000);

  document.addEventListener('click', e => {
    const sub = e.target.closest('[data-submit]');
    if (sub) submitMode = sub.dataset.submit;
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    if (ADMIN_ACTIONS.has(el.dataset.action) && !fullAdmin()) return;
    if (!admin() && !PUBLIC_ACTIONS.has(el.dataset.action) && !(cashier() && CASH_ACTIONS.has(el.dataset.action)) && !(centerAdm() && CENTER_ACTIONS.has(el.dataset.action)) && !(member() && MEMBER_ACTIONS.has(el.dataset.action)) && !(coach() && COACH_ACTIONS.has(el.dataset.action))) return;
    fn(el);
  });

  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = forms[f.dataset.form];
    if (ADMIN_FORMS.has(f.dataset.form) && !fullAdmin()) { submitMode = 'save'; return; }
    if (fn && (admin() || (cashier() && CASH_FORMS.has(f.dataset.form)) || (centerAdm() && CENTER_FORMS.has(f.dataset.form)) || PUBLIC_FORMS.has(f.dataset.form) || (member() && MEMBER_FORMS.has(f.dataset.form)))) fn(f);
    submitMode = 'save';
  });

  document.addEventListener('change', e => {
    const el = e.target;
    switch (el.dataset.change) {
      case 'grp-pick': {   // scheda già esistente: precompila tesseramento e certificato
        const a = athleteOf(el.value), f = el.form;
        f.tess.checked = !!(a && a.tess && a.tess[seasonOf(todayStr())]); f.certExp.value = (a && a.certExp) || '';
        if (f.certType) f.certType.value = (a && a.certType) || '';
        break;
      }
      case 'coach-all': if (admin()) { const c = coachOf(el.dataset.uid); window.Cloud.setCoach(el.dataset.uid, { all: el.value === '1', name: (c && c.name) || coachName(el.dataset.uid) }).then(() => { ui.flash = { text: t('saved') }; render(); }).catch(e => warn('regError', { code: e.code || e.message })); } break;
      case 'ath-filter': ui.athFilter = el.value; render(); break;
      case 'pay-kind': ui.payKind = el.value; render(); break;
      case 'pay-period': el.form.amount.value = el.value === 'quarter' ? el.dataset.q : el.value === 'course' ? el.dataset.c : el.dataset.m; break;
      case 'bk-date': if (el.value) { ui.bookDate = el.value; render(); } break;
      case 'bk-np': if (ui.bkSel) { ui.bkSel.plTouched = true; ui.bkSel.np = +el.value; ui.bkSel.players = (ui.bkSel.players || []).slice(0, ui.bkSel.np); render(); } break;
      case 'bk-pl': if (ui.bkSel) { ui.bkSel.plTouched = true; (ui.bkSel.players = ui.bkSel.players || [])[+el.dataset.i] = el.value; render(); } break;
      case 'bk-rem': if (ui.bkSel) { ui.bkSel.plTouched = true; ui.bkSel.remind = +el.value; render(); } break;
      case 'bk-from': bkSetTime('from', el.value); break;
      case 'bk-to': bkSetTime('to', el.value); break;
      case 'bk-user': if (ui.bkSel) { ui.bkSel.userId = el.value || null; if (el.value) { ui.bkSel.blocked = ''; ui.bkSel.guest = ''; } render(); } break;
      case 'bk-guest': if (ui.bkSel) { ui.bkSel.guest = el.value.trim(); if (ui.bkSel.guest) { ui.bkSel.userId = null; ui.bkSel.blocked = ''; } render(); } break;
      case 'bk-blocked': if (ui.bkSel) { ui.bkSel.blocked = el.value.trim(); if (ui.bkSel.blocked) { ui.bkSel.userId = null; ui.bkSel.guest = ''; } render(); } break;
      // cassa: prenotazione da scegliere per la quota del campo
      case 'ca-cat': {
        const bk = el.closest('.ca-line').querySelector('[name=bk]');
        if (bk) bk.hidden = el.value !== 'q_court';
        break;
      }
      case 'user-role': {
        // ruolo scelto dal menu (solo admin): un ruolo per persona
        if (!fullAdmin()) return;
        const uid = el.dataset.uid, m = memberByUid(uid), cur = roleOf(uid), role = el.value, name = m ? personName(m) : '';
        if (!grantable().includes(role) || !grantable().includes(cur)) { render(); return; }
        const trs = (S().trainings || []).filter(tr => tr.coachUid === uid);
        if (cur === 'coach' && trs.length && !confirmed('roleCoachLeave', { n: name, k: trs.length })) { render(); return; }
        if (!confirmed('roleChangeConfirm', { n: name, a: t('role_' + cur), b: t('role_' + role) })) { render(); return; }
        window.Cloud.setUserRole(uid, role, name, !!coachOf(uid))
          .then(() => { ui.flash = { text: t('roleChanged', { n: name, r: t('role_' + role) }) }; render(); })
          .catch(err => { warn('regError', { code: err.code || err.message }); });
        break;
      }
      case 'ban': {
        if (!canEditUser(el.dataset.uid)) return;
        const cur = Object.assign({ book: false }, banOf(el.dataset.uid));
        cur[el.dataset.what] = el.checked;
        window.Cloud.setBan(el.dataset.uid, cur).then(() => { ui.flash = { text: t('saved') }; render(); }).catch(err => warn('regError', { code: err.code || err.message }));
        break;
      }
      case 'msg-filter': ui.msgFilter = el.value; render(); break;
      case 'user-filter': ui.userFilter = el.value; render(); break;
      case 'msg-to': {
        const set = new Set(ui.msgTo || []);
        if (el.checked) set.add(el.value); else set.delete(el.value);
        ui.msgTo = [...set];
        break;
      }
      case 'tr-date': if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { ui.trDay = el.value; render(); } break;
      case 'tr-dmonth-pick': if (/^\d{4}-\d{2}$/.test(el.value)) { ui.trDayMonth = el.value; render(); } break;
      case 'tr-month-pick': if (/^\d{4}-\d{2}$/.test(el.value)) { ui.trMonth = el.value; render(); } break;
    }
  });

  document.addEventListener('toggle', e => {
    const d = e.target;
    if (d.dataset && d.dataset.keep) { ui.keep = ui.keep || {}; ui.keep[d.dataset.keep] = d.open; }
  }, true);

  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  applyTheme(currentTheme());
  applyDesign(currentDesign());

  window.App = {
    refresh,
    error(code) {
      ui.flash = { type: 'warn', text: t(code === 'permission-denied' ? 'errPermission' : 'errCloud', { code }) };
      render();
    }
  };
  render();
})();
