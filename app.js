// Stylup — prototype coiffure. Parcours : accueil → client → prestation → accord → photo → (détourage) → coupe → couleur → aperçu → résultat → rendu retenu.
import { STR } from './i18n.js?v=202611151425';
import * as C from './catalog.js?v=202611151425';
import * as Cloud from './cloud.js?v=202611151425';
import { RENDER } from './config.js?v=202611151425';
import * as E from './engine.js?v=202611151425';

const $app = document.getElementById('app');
const KEY = 'stylup.proto.v1';
const store = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} return Object.assign({ lang: null, pro: 'Karine', started: false, sessions: [], hidden: [], account: null, loggedIn: false }, s || {}); })();
// Couleurs et coupes ajoutées par le salon dans le Catalogue
store.custom = Object.assign({ colors: [], cuts: { f: [], h: [] } }, store.custom || {});
store.custom.colors.forEach(c => delete c.reflet2); // plus de reflet secondaire
C.applyCustomCuts(store.custom.cuts);
if (!store.lang) { const l = (navigator.language || 'fr').slice(0, 2); store.lang = C.LANGS.includes(l) ? l : 'en'; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; } };

let route = { name: store.loggedIn ? 'home' : 'splash' }, stack = [], sheet = null, toastMsg = null, S = null, autoState = null, F = {};

// ---------- utilitaires ----------
const t = (k, v = {}) => (STR[store.lang][k] ?? STR.fr[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lab = o => C.label(o, store.lang), des = o => C.describe(o, store.lang);
const hidden = k => store.hidden.includes(k);
const pad = n => String(n).padStart(2, '0');
const FLAG = { fr: '🇫🇷', en: '🇬🇧', it: '🇮🇹', es: '🇪🇸', de: '🇩🇪' };
const langLabel = l => `<span class="flag" aria-hidden="true">${FLAG[l]}</span> ${l.toUpperCase()}`;
const ICON = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', down: '<path d="M6 9l6 6 6-6"/>', right: '<path d="M9 5l7 7-7 7"/>', up: '<path d="M5 15l7-7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>', len: '<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
  fr: '<path d="M4 11c2-6 14-6 16 0"/><path d="M7 10v6M10.5 9v7M14 9v7M17 10v6"/>', clip: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M7 7h10M10 2v5M14 2v5"/>',
  comb: '<path d="M3 7h18v4H3z"/><path d="M5 11v8M8.5 11v8M12 11v8M15.5 11v8M19 11v5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const svg = (k, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const swatchCss = (tone, reflet = 0) => C.lockGradient(C.colorOf(tone, reflet));
const colorSw = c => swatchCss(c.tone, c.reflet ?? 0);
const uid = () => 'u' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const fmtDate = ts => new Intl.DateTimeFormat(store.lang, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts));

function go(name, params = {}, mode = 'push') { if (mode === 'push') stack.push(route); route = { name, ...params }; sheet = null; render(); $app.querySelector('.main')?.scrollTo(0, 0); }
function back() { sheet = null; route = stack.pop() || { name: 'home' }; render(); }
function toast(m) { toastMsg = m; render(); setTimeout(() => { toastMsg = null; render(); }, 2600); }
function newSession() { S = { first: '', gender: null, cutSet: 'f', svc: { cut: false, color: false }, consent: { photo: false, age: false }, photo: null, photoUrl: null, mask: null, demo: false, framing: null, cuts: [{}], colors: [{}], open: { cut: 0, color: 0 }, renders: null, tab: 1, chosen: null, after: null, rating: null }; }

// ---------- gabarits ----------
const top = (title, opts = {}) => `<header class="top">${opts.noBack ? '' : `<button class="iconbtn" data-a="back" aria-label="${t('back')}">${svg('back')}</button>`}<h1 class="${opts.big ? 'big' : ''}">${esc(title)}</h1>${opts.right || ''}</header>`;
const foot = (primary, opts = {}) => `<footer class="foot">${primary}${opts.noAbandon ? '' : `<button class="btn ghost" data-a="abandon">${t('abandon')}</button>`}</footer>`;
const pbtn = (label, action, enabled = true, data = '') => `<button class="btn primary" data-a="${action}" ${data} ${enabled ? '' : 'disabled'}>${esc(label)}</button>`;
const tabbar = cur => `<nav class="tabs-bar">${[['home', 'tabSessions'], ['catalog', 'tabCatalog'], ['settings', 'tabSettings']].map(([r, k]) => `<button data-a="tab" data-r="${r}" aria-current="${cur === r}"><i></i>${t(k)}</button>`).join('')}</nav>`;
const fieldIn = (key, label, type = 'text', o = {}) => {
  const err = F.err && F.err[key];
  const input = `<input class="input ${o.cls || ''} ${err ? 'invalid' : ''}" id="f-${key}" data-f="${key}" type="${type}" value="${esc(F[key] || '')}" placeholder="${esc(o.ph || ' ')}" autocomplete="${o.ac || 'off'}" ${o.im ? `inputmode="${o.im}"` : ''} ${o.max ? `maxlength="${o.max}"` : ''} autocapitalize="off" spellcheck="false" ${o.req ? 'required aria-required="true"' : ''} ${err ? 'aria-invalid="true"' : ''}>`;
  const body = type === 'password' ? `<div class="pw">${input}<button type="button" class="eye" data-eye="f-${key}" aria-label="${t('show')}">${svg('eye')}</button></div>` : input;
  return `<label class="field" for="f-${key}"><span class="label">${esc(label)}${o.req ? '<span class="req" aria-hidden="true"> *</span>' : ''}</span>${body}${err ? `<span class="err">${esc(err)}</span>` : o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</label>`;
};
// Code de confirmation à 6 chiffres : un vrai champ (clavier numérique, remplissage auto du code reçu, collage)
// posé sur 6 cases visuelles groupées 3 + 3.
const otpDigits = v => (v || '').replace(/\D/g, '').slice(0, 6);
const otpField = () => {
  const err = F.err && F.err.code, v = otpDigits(F.code);
  const box = i => `<span class="otp-box${v[i] ? ' on' : ''}${i === Math.min(v.length, 5) ? ' cur' : ''}">${v[i] || ''}</span>`;
  return `<div class="field"><label class="label" for="f-code">${t('code')}</label>
    <div class="otp${err ? ' invalid' : ''}"><input class="otp-in" id="f-code" data-f="code" data-otp type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" value="${v}" ${err ? 'aria-invalid="true"' : ''}>
    <div class="otp-boxes" aria-hidden="true">${box(0)}${box(1)}${box(2)}<span class="otp-sep"></span>${box(3)}${box(4)}${box(5)}</div></div>
    ${err ? `<span class="err">${esc(err)}</span>` : ''}</div>`;
};
const otpPaint = inp => {
  const v = otpDigits(inp.value); if (inp.value !== v) inp.value = v; F.code = v;
  const wrap = inp.closest('.otp'); wrap.classList.remove('invalid'); inp.removeAttribute('aria-invalid');
  if (F.err) delete F.err.code; wrap.parentElement.querySelector('.err')?.remove();
  wrap.querySelectorAll('.otp-box').forEach((b, i) => { b.textContent = v[i] || ''; b.classList.toggle('on', !!v[i]); b.classList.toggle('cur', i === Math.min(v.length, 5)); });
};
// PROTOTYPE UNIQUEMENT : aucun e-mail n'est envoyé, donc toucher le champ y « reçoit » le code fictif 123456, chiffre par chiffre.
let otpDemoTimer = 0;
const otpDemoFill = inp => {
  if (Cloud.online || inp.value || otpDemoTimer) return;
  let i = 0; otpDemoTimer = setInterval(() => { inp.value = '123456'.slice(0, ++i); otpPaint(inp); if (i >= 6) { clearInterval(otpDemoTimer); otpDemoTimer = 0; } }, 70);
};
const formErr = () => F.err && F.err.form ? `<p class="err" role="alert" style="margin:0">${esc(F.err.form)}</p>` : '';
const authFoot = (primary, extra = '') => `<footer class="foot">${primary}${extra}</footer>`;

// Écrans dont le bouton principal reste désactivé tant que les champs obligatoires ne sont pas remplis
const READY = {
  salonSetup: () => ['first', 'salon', 'city'].every(k => (F[k] || '').trim()) && !!F.trade,
};

const SCREENS = {
  splash: () => `<div class="splash"><video class="splash-video" autoplay muted loop playsinline preload="auto" poster="assets/splash-bg.jpg" src="assets/splash.mp4" aria-hidden="true"></video><div class="splash-veil"></div>
    <div class="splash-content"><header class="splash-top"><button class="pill glass" data-a="langSheet" aria-label="${t('language')}" aria-haspopup="dialog">${langLabel(store.lang)}<span class="chev-s">${svg('down', 14)}</span></button></header>
    <h1 class="splash-logo"><img src="assets/stylup-logo.svg" alt="Stylup" width="266" height="155"></h1>
    <footer class="splash-foot">${pbtn(t('splashCreate'), 'toSignup')}<button class="btn ghost" data-a="toLogin">${t('splashLogin')}</button></footer></div></div>`,

  signup: () => `<div class="screen">${top(t('signupTitle'))}<main class="main">
    ${fieldIn('email', t('email'), 'email', { ph: t('emailPh'), ac: 'email', im: 'email' })}
    ${fieldIn('pass', t('password'), 'password', { ac: 'new-password', hint: t('passHint') })}
    ${formErr()}<div class="divider"><span>${t('or')}</span></div>
    <button class="btn ghost" data-a="google">${t('google')}</button>
    <hr class="sep">
    <p class="rowlink">${t('splashLogin')} <button class="link" data-a="toLogin">${t('loginBtn')}</button></p>
    </main>${authFoot(pbtn(t('cont'), 'signupOk'), `<p class="legal">${t('legal')}</p>`)}</div>`,

  verify: () => {
    const left = Math.max(0, Math.ceil(((F.resendAt || 0) - Date.now()) / 1000));
    return `<div class="screen">${top(t(F.mode === 'recovery' ? 'forgotTitle' : 'verifyTitle'))}<main class="main"><div class="hero"><h2>${t('verifyHead')}</h2><p class="muted">${t('verifySub', { email: `<strong>${esc(F.email)}</strong>` })}</p></div>
    ${otpField()}
    <button class="link" data-a="resend" id="resendBtn" ${left ? 'disabled' : ''}>${left ? t('resendIn', { n: left }) : t('resend')}</button>
    </main>${authFoot(pbtn(t('confirmBtn'), 'verifyOk'))}</div>`;
  },

  salonSetup: () => {
    const card = (k, name, sub, dis) => { const on = F.trade === k; return `<button class="trade ${on ? 'on' : ''}" data-a="trade" data-v="${k}" role="radio" aria-checked="${on}" ${dis ? 'disabled' : ''}><span class="grow"><img src="assets/trade-${k}.svg" alt="" width="32" height="32"><span class="trade-name">${t(name)}</span><span class="muted">${dis ? t('soon') : t(sub)}</span></span><span class="radio ${on ? 'on' : ''}"></span></button>`; };
    return `<div class="screen">${top(t('salonTitle'))}<main class="main">
    ${fieldIn('first', t('yourFirst'), 'text', { ac: 'given-name', req: true })}
    ${fieldIn('salon', t('salonName'), 'text', { ac: 'organization', req: true })}
    ${fieldIn('city', t('city'), 'text', { ac: 'address-level2', req: true })}
    <div class="field" role="radiogroup" aria-label="${t('yourTrade')}"><span class="label">${t('yourTrade')}<span class="req" aria-hidden="true"> *</span></span>${card('hair', 'tradeHair', 'tradeHairSub')}${card('nails', 'tradeNails', 'tradeNailsSub')}${card('lashes', 'tradeLashes', 'tradeLashesSub')}</div>
    </main>${authFoot(pbtn(t('done'), 'salonOk', READY.salonSetup()))}</div>`;
  },

  login: () => `<div class="screen">${top(t('loginTitle'))}<main class="main">
    ${fieldIn('email', t('email'), 'email', { ph: t('emailPh'), ac: 'email', im: 'email' })}
    ${fieldIn('pass', t('password'), 'password', { ac: 'current-password' })}
    ${formErr()}<button class="link right" data-a="toForgot">${t('forgot')}</button>
    <div class="divider"><span>${t('or')}</span></div>
    <button class="btn ghost" data-a="google">${t('google')}</button>
    <p class="rowlink">${t('noAccount')} <button class="link" data-a="toSignup">${t('createAccount')}</button></p>
    </main>${authFoot(pbtn(t('loginBtn'), 'loginOk'))}</div>`,

  forgot: () => `<div class="screen">${top(t('forgotTitle'))}<main class="main"><p class="muted" style="margin:0">${t('forgotSub')}</p>
    ${fieldIn('email', t('email'), 'email', { ph: t('emailPh'), ac: 'email', im: 'email' })}
    </main>${authFoot(pbtn(t('sendLink'), 'forgotOk'))}</div>`,

  forgotSent: () => `<div class="screen">${top(t('forgotTitle'))}<main class="main"><div class="hero"><h2>${t('sentTitle')}</h2><p class="muted">${t('sentSub', { email: `<strong>${esc(F.sentTo)}</strong>` })}</p></div>
    <p class="note">${t('demoLink')}</p><button class="btn ghost" data-a="openLink">${t('openLink')}</button>
    </main>${authFoot(pbtn(t('backLogin'), 'backLogin'))}</div>`,

  reset: () => `<div class="screen">${top(t('resetTitle'))}<main class="main">
    ${fieldIn('newPass', t('newPass'), 'password', { ac: 'new-password', hint: t('passHint') })}
    ${fieldIn('newPass2', t('newPass2'), 'password', { ac: 'new-password' })}
    </main>${authFoot(pbtn(t('savePass'), 'resetOk'))}</div>`,

  home: () => `<div class="screen">${top(t('hello', { name: store.pro }), { noBack: true, big: true, right: `<span class="avatar">${esc((store.pro || '?')[0].toUpperCase())}</span>` })}
    <main class="main"><section class="card"><h2>${t('newClientTitle')}</h2><p class="muted" style="margin:0">${t('newClientSub')}</p>${pbtn(t('newSession'), 'newSession')}</section>
    ${store.sessions.length ? `<p class="label" style="margin:8px 0 -4px">${t('recent', { n: store.sessions.length })}</p>` + store.sessions.map((s, i) => `<button class="sess" data-a="openSession" data-i="${i}"><img src="${s.thumb}" alt=""><span class="grow"><span><strong>${esc(s.first || t('client'))}</strong> · ${s.svcLabel}</span><span class="muted">${esc(s.title)}</span><span class="muted">${fmtDate(s.date)}</span></span>${svg('right')}</button>`).join('') : `<p class="muted">${t('noSessions')}</p>`}
    </main>${tabbar('home')}</div>`,

  client: () => `<div class="screen">${top(t('clientTitle'))}<main class="main">
    <label class="field"><span class="label">${t('firstName')}</span><input class="input" data-in="first" value="${esc(S.first)}" placeholder="${t('firstNamePh')}" autocomplete="off"></label>
    ${[['f', 'female'], ['h', 'male'], ['n', 'nonbinary']].map(([g, k]) => `<button class="row ${S.gender === g ? 'on' : ''}" data-a="gender" data-g="${g}"><span class="grow">${t(k)}</span><span class="radio ${S.gender === g ? 'on' : ''}"></span></button>`).join('')}
    </main>${foot(pbtn(t('cont'), 'toServices', !!S.gender))}</div>`,

  services: () => `<div class="screen">${top(t('servicesTitle'))}<main class="main">
    ${[['cut', 'svcCut'], ['color', 'svcColor']].map(([k, l]) => `<button class="row ${S.svc[k] ? 'on' : ''}" data-a="svc" data-k="${k}" role="switch" aria-checked="${S.svc[k]}"><span class="grow">${t(l)}</span><span class="toggle ${S.svc[k] ? 'on' : ''}"></span></button>`).join('')}
    </main>${foot(pbtn(t('cont'), 'toConsent', S.svc.cut || S.svc.color))}</div>`,

  consent: () => `<div class="screen">${top(t('consentTitle'))}<main class="main">
    <section class="card"><button class="cardhead" data-a="consent" data-k="photo" role="switch" aria-checked="${S.consent.photo}"><h3>${t('consentQ')}</h3><span class="toggle ${S.consent.photo ? 'on' : ''}"></span></button>
    <ul class="bullets"><li>${t('consentP1')}</li><li>${t('consentP2')}</li><li>${t('consentP3')}</li></ul></section>
    <section class="card"><button class="cardhead" data-a="consent" data-k="age" role="switch" aria-checked="${S.consent.age}"><span class="grow" style="flex:1"><h3>${t('age15')}</h3><span class="muted">${t('age15Sub')}</span></span><span class="toggle ${S.consent.age ? 'on' : ''}"></span></button></section>
    </main>${foot(pbtn(t('cont'), 'toCapture', S.consent.photo && S.consent.age))}</div>`,

  capture: () => {
    const st = S.framing; const cls = st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : '';
    const msg = st === 'ok' ? t('photoValid') : st === 'bad' ? t('photoInvalid') : st === 'busy' ? t('analysing') : st === 'ready' ? t('photoReady') : '';
    return `<div class="screen">${top(t('captureTitle'))}<main class="main"><section class="card"><div><h3>${t('face')}</h3><p class="muted" style="margin:2px 0 0">${t('faceSub')}</p></div>
      <label class="chipbtn">${S.photo ? t('retake') : t('takePhoto')}<input type="file" accept="image/*" capture="environment" data-file="photo"></label>
      <div class="photo frame ${cls}">${S.photoUrl ? `<img src="${S.photoUrl}" alt="">` : `<div class="empty">${t('faceSub')}</div>`}</div>
      ${msg ? `<p class="status ${cls}" style="margin:0">${msg}</p>` : ''}
      <label class="link" style="cursor:pointer">${t('gallery')}<input type="file" accept="image/*" data-file="photo"></label>
      <button class="link" data-a="demo">${t('demoClient')}</button></section></main>${foot(pbtn(t('cont'), 'afterCapture', !!S.photo && st !== 'busy'))}</div>`;
  },

  brush: () => `<div class="screen">${top(t('brushTitle'))}<main class="main"><p class="muted" style="margin:0">${t('brushWhy')} ${t('brushSub')}</p>
    <div class="brushwrap"><canvas id="brushCanvas"></canvas></div>
    <div class="seg"><button data-a="brushMode" data-m="brush" aria-pressed="${route.mode !== 'erase'}">${t('brush')}</button><button data-a="brushMode" data-m="erase" aria-pressed="${route.mode === 'erase'}">${t('eraser')}</button><button data-a="brushClear">${t('clear')}</button></div>
    <label class="field"><span class="label">${t('size')}</span><input type="range" min="8" max="80" value="${route.size || 34}" data-in="brushSize"></label>
    </main>${foot(pbtn(t('validateMask'), 'brushOk'))}</div>`,

  cut: () => {
    const set = C.CUT_SETS[S.cutSet];
    const cards = S.cuts.map((cut, i) => {
      const open = S.open.cut === i;
      const fields = set.map(f => {
        const val = cut[f.key]; const off = f.dependsOn && !cut[f.dependsOn];
        const inner = val ? (() => { const o = f.options.find(x => x.id === val); return `<button class="sel" data-a="cutSheet" data-i="${i}" data-k="${f.key}"><span class="sw">${svg(f.icon, 22)}</span><span class="grow"><strong>${esc(lab(o))}</strong><span class="muted">${esc(des(o))}</span></span><span class="mod">${t('modify')}</span></button>`; })()
          : `<button class="chipbtn" data-a="cutSheet" data-i="${i}" data-k="${f.key}">${t('ch_' + f.key)}</button>`;
        return `<div class="field ${off ? 'off' : ''}"><span class="label">${t('f_' + f.key)}</span>${inner}</div>`;
      }).join('');
      return `<section class="card"><button class="cardhead" data-a="openCard" data-kind="cut" data-i="${i}" aria-expanded="${open}"><h3>${t('cutN', { n: pad(i + 1) })}${!open && cutDone(cut) ? ` <span class="muted" style="font-weight:400">· ${esc(cutTitle(cut))}</span>` : ''}</h3><span class="chev">${svg('up')}</span></button>${open ? fields + (i > 0 ? `<button class="link" data-a="removeCard" data-kind="cut" data-i="${i}">${t('remove')}</button>` : '') : ''}</section>`;
    }).join('');
    const ok = S.cuts.every(cutDone); const nextIsColor = S.svc.color;
    return `<div class="screen">${top(t('cutTitle'))}<main class="main">
      ${S.gender === 'n' ? `<div class="field"><span class="label">${t('cutSet')}</span><div class="seg"><button data-a="cutSet" data-s="f" aria-pressed="${S.cutSet === 'f'}">${t('cutSetF')}</button><button data-a="cutSet" data-s="h" aria-pressed="${S.cutSet === 'h'}">${t('cutSetH')}</button></div></div>` : ''}
      ${cards}${S.cuts.length < 2 ? `<button class="link" data-a="addCard" data-kind="cut">${t('addCut')}</button>` : ''}</main>
      ${foot(pbtn(nextIsColor ? t('cont') : t('launch'), nextIsColor ? 'toColor' : 'launch', ok))}</div>`;
  },

  color: () => {
    const cards = S.colors.map((c, i) => {
      const open = S.open.color === i; const tn = c.tone && C.TONES.find(x => x.id === c.tone); const rf = c.reflet != null && C.REFLETS.find(x => x.id === c.reflet);
      if (c.custom) {
        const row = `<button class="sel" data-a="toneSheet" data-i="${i}"><span class="sw" style="background:${colorSw(c)}"></span><span class="grow"><strong>${esc(c.name)}</strong><span class="muted">${C.colorCode(c.tone, c.reflet)} · ${t('customTag')}</span></span><span class="mod">${t('modify')}</span></button>`;
        return `<section class="card"><button class="cardhead" data-a="openCard" data-kind="color" data-i="${i}" aria-expanded="${open}"><h3>${t('colorN', { n: pad(i + 1) })}${!open ? ` <span class="muted" style="font-weight:400">· ${esc(colorTitle(c))}</span>` : ''}</h3><span class="chev">${svg('up')}</span></button>
        ${open ? `<div class="field"><span class="label">${t('myColors')}</span>${row}</div>${i > 0 ? `<button class="link" data-a="removeCard" data-kind="color" data-i="${i}">${t('remove')}</button>` : ''}` : ''}</section>`;
      }
      const toneRow = tn ? `<button class="sel" data-a="toneSheet" data-i="${i}"><span class="sw" style="background:${swatchCss(tn.id)}"></span><span class="grow"><strong>${esc(lab(tn))}</strong><span class="muted">${t('toneDetail', { n: tn.id })}</span></span><span class="mod">${t('modify')}</span></button>` : `<button class="chipbtn" data-a="toneSheet" data-i="${i}">${t('chooseTone')}</button>`;
      const refRow = rf ? `<button class="sel" data-a="refletSheet" data-i="${i}"><span class="sw" style="background:${swatchCss(tn.id, rf.id)}"></span><span class="grow"><strong>${esc(lab(rf))}</strong><span class="muted">${t('refletDetail', { n: rf.id, temp: t(rf.temp === 'warm' ? 'warm' : rf.temp === 'cold' ? 'cold' : 'neutral') })}</span></span><span class="mod">${t('modify')}</span></button>` : `<button class="chipbtn" data-a="refletSheet" data-i="${i}">${t('chooseReflet')}</button>`;
      return `<section class="card"><button class="cardhead" data-a="openCard" data-kind="color" data-i="${i}" aria-expanded="${open}"><h3>${t('colorN', { n: pad(i + 1) })}${!open && tn ? ` <span class="muted" style="font-weight:400">· ${esc(colorTitle(c))}</span>` : ''}</h3><span class="chev">${svg('up')}</span></button>
        ${open ? `<div class="field"><span class="label">${t('toneLabel')}</span>${toneRow}</div><div class="field ${tn ? '' : 'off'}"><span class="label">${t('refletLabel')}</span>${refRow}</div>${i > 0 ? `<button class="link" data-a="removeCard" data-kind="color" data-i="${i}">${t('remove')}</button>` : ''}` : ''}</section>`;
    }).join('');
    return `<div class="screen">${top(t('colorTitle'))}<main class="main">${cards}${S.colors.length < 2 ? `<button class="link" data-a="addCard" data-kind="color">${t('addColor')}</button>` : ''}</main>${foot(pbtn(t('launch'), 'launch', S.colors.every(c => c.tone)))}</div>`;
  },

  generating: () => `<div class="screen">${top(t('resultTitle'), { noBack: true })}<main class="main"><div class="gen"><h2>${t('generating')}</h2><p class="muted" id="secs">${renderMode() && S.svc.cut ? t('generatingAi') : t('secondsLeft', { n: 2 })}</p><div class="bar"><i></i></div></div></main>${foot(`<button class="btn ghost" data-a="cancelGen">${t('cancel')}</button>`, { noAbandon: true })}</div>`,

  result: () => {
    const R = S.renders; const cur = S.tab; const v = cur === 0 ? null : R[cur - 1];
    const tabs = [t('original'), ...R.map((r, i) => tabLabel(i))];
    const img = cur === 0 ? S.photoUrl : v.url;
    const notes = v ? (v.aiError ? `<div class="overlay-note"><strong>${t('renderError')}</strong><span class="muted">${t(v.aiError === 'daily_limit' ? 'renderLimit' : 'renderErrorSub')}${v.color ? ' ' + t('cutPendingColor') : ''}</span></div>` : v.cutPending ? `<div class="overlay-note"><strong>${t('cutPending')}</strong><span class="muted">${t('cutPendingSub')}${v.color ? ' ' + t('cutPendingColor') : ''}</span></div>` : v.mock ? `<div class="overlay-note soft"><span class="muted">${t('mockNote')}</span></div>` : v.demoUsed ? `<div class="overlay-note soft"><span class="muted">${t('demoExample')}</span></div>` : '') : '';
    const info = v ? infoOf(v) : { title: t('notSet'), sub: '-', dot: '' };
    return `<div class="screen">${top(t('resultTitle'))}<main class="main flush"><div class="photo" style="aspect-ratio:390/445">${`<img src="${img}" alt="">`}${v ? `<span class="badge">${t('simulation')}</span>` : ''}${notes}</div>
      <div class="rtabs" role="tablist">${tabs.map((l, i) => `<button role="tab" data-a="rtab" data-i="${i}" aria-selected="${i === cur}"><i></i>${esc(l)}</button>`).join('')}</div>
      <div class="info"><span class="dot" style="${info.dot}">${info.icon || ''}</span><span style="flex:1;display:flex;flex-direction:column;gap:2px"><strong>${esc(info.title)}</strong><span class="muted">${esc(info.sub)}</span></span></div></main>
      <footer class="foot row2"><button class="btn ghost" data-a="editChoices">${t('edit')}</button>${pbtn(t('chooseRender'), 'chooseRender', cur !== 0)}</footer></div>`;
  },

  kept: () => {
    const v = S.renders[S.chosen]; const info = infoOf(v);
    return `<div class="screen">${top(t('keptTitle'))}<main class="main"><div class="photo" style="aspect-ratio:390/445;border-radius:14px"><img src="${v.url}" alt=""><span class="badge">${t('simulation')}</span></div>
      <section class="card"><h3>${esc(info.title)}</h3><span class="muted">${esc(info.sub)}</span></section><p class="muted" style="margin:0">${t('disclaimer')}</p>
      <section class="card"><h3>${t('afterTitle')}</h3><label class="chipbtn">${t('addAfter')}<input type="file" accept="image/*" capture="environment" data-file="after"></label>
      ${S.after ? `<div class="pair"><figure><img src="${E.thumb(v.canvas, 360)}" alt=""><figcaption class="muted">${t('simulationCap')}</figcaption></figure><figure><img src="${S.after}" alt=""><figcaption class="muted">${t('realCap')}</figcaption></figure></div>
      <span class="label">${t('rateQ')}</span><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-a="rate" data-n="${n}" aria-pressed="${S.rating === n}">${n}</button>`).join('')}</div>` : ''}</section>
      </main>${foot(pbtn(t('finish'), 'finish'), { noAbandon: true })}</div>`;
  },

  session: () => {
    const s = store.sessions[route.i]; if (!s) return SCREENS.home();
    return `<div class="screen">${top((s.first || t('client')) + ' · ' + s.svcLabel)}<main class="main"><p class="muted" style="margin:0">${fmtDate(s.date)}</p>
      <div class="pair"><figure><img src="${s.thumb}" alt=""><figcaption class="muted">${t('simulationCap')}</figcaption></figure>${s.after ? `<figure><img src="${s.after}" alt=""><figcaption class="muted">${t('realCap')}</figcaption></figure>` : ''}</div>
      <section class="card"><h3>${esc(s.title)}</h3><span class="muted">${esc(s.sub)}</span>${s.rating ? `<span class="label">${t('ratingVal', { n: s.rating })}</span>` : ''}</section>
      </main><footer class="foot"><button class="btn ghost" data-a="deleteSession" data-i="${route.i}">${t('deleteSession')}</button></footer></div>`;
  },

  catalog: () => {
    const tog = (k, name, sw) => `<button class="trow" data-a="hide" data-k="${k}" role="switch" aria-checked="${!hidden(k)}">${sw ? `<span class="swatch" style="background:${sw}"></span>` : ''}<span class="grow" style="${hidden(k) ? 'color:var(--muted)' : ''}">${esc(name)}</span><span class="toggle ${hidden(k) ? '' : 'on'}"></span></button>`;
    // Ligne d'un élément ajouté par le salon : toucher le nom pour le modifier, l'interrupteur pour le masquer
    const mine = (k, name, sub, sw, act, data) => `<div class="trow mine">${sw ? `<span class="swatch" style="background:${sw}"></span>` : ''}<button class="grow mine-edit" data-a="${act}" ${data} aria-label="${esc(t('edit2') + ' : ' + name)}"><span style="${hidden(k) ? 'color:var(--muted)' : ''}">${esc(name)}</span><span class="muted">${esc(sub)}</span></button><button class="tswitch" data-a="hide" data-k="${k}" role="switch" aria-checked="${!hidden(k)}" aria-label="${esc(name)}"><span class="toggle ${hidden(k) ? '' : 'on'}"></span></button></div>`;
    const add = (label, act, data = '') => `<button class="addrow" data-a="${act}" ${data}><span class="plus">${svg('plus', 18)}</span>${esc(label)}</button>`;
    const cutRows = set => store.custom.cuts[set].map(x => mine(set + ':' + C.CUSTOM_FIELD[set] + ':' + x.id, x.name, x.desc || t('customTag'), '', 'editCut', `data-set="${set}" data-id="${x.id}"`)).join('');
    // Premier niveau : le métier (Coiffure / Ongles / Cils), chaque métier a son propre catalogue
    // Un salon n'a qu'une activité : celle choisie à l'inscription ; les autres sont visibles mais inactives
    const trade = (store.account && store.account.trade) || 'hair';
    const TR = { hair: 'tradeHair', nails: 'tradeNails', lashes: 'tradeLashes' };
    const seg = `<div class="tradeseg" role="tablist" aria-label="${t('yourTrade')}">${Object.keys(TR).map(k => `<button role="tab" aria-selected="${trade === k}" ${trade === k ? '' : 'disabled aria-disabled="true"'}><img src="assets/trade-${k}.svg" alt="" width="20" height="20">${t(TR[k])}</button>`).join('')}</div>`;
    if (trade !== 'hair') return `<div class="screen">${top(t('catalogTitle'), { noBack: true, big: true })}<main class="main">${seg}
      <section class="card soon-card"><img src="assets/trade-${trade}.svg" alt="" width="40" height="40"><h3>${t(TR[trade])} · ${t('soon')}</h3><p class="muted" style="margin:0">${t('catSoonSub', { trade: t(TR[trade]).toLowerCase() })}</p></section>
      </main>${tabbar('catalog')}</div>`;
    // Second niveau (coiffure) : Couleur / Coupe femme / Coupe homme, une page de réglage plus légère chacune
    const sub = route.sub || 'color';
    const SUBS = { color: 'catColor', f: 'catCutF', h: 'catCutH' };
    const seg2 = `<div class="subseg" role="tablist">${Object.keys(SUBS).map(k => `<button role="tab" data-a="catSub" data-s="${k}" aria-selected="${sub === k}">${t(SUBS[k])}</button>`).join('')}</div>`;
    const content = sub === 'color'
      ? `<section class="card"><span class="label">${t('myColors')}</span>${store.custom.colors.length ? store.custom.colors.map(x => mine('ucolor:' + x.id, x.name, C.colorCode(x.tone, x.reflet) + ' · ' + lab(C.TONES.find(y => y.id === x.tone)), colorSw(x), 'editColor', `data-id="${x.id}"`)).join('') : `<p class="muted" style="margin:0">${t('myColorsEmpty')}</p>`}${add(t('addMyColor'), 'newColor')}</section>
      <section class="card"><span class="label">${t('tones')}</span>${C.TONES.map(x => tog('tone:' + x.id, x.id + ' · ' + lab(x), swatchCss(x.id))).join('')}</section>
      <section class="card"><span class="label">${t('reflets')}</span>${C.REFLETS.map(x => tog('reflet:' + x.id, '.' + x.id + ' · ' + lab(x), swatchCss(7, x.id))).join('')}</section>`
      : `<section class="card"><span class="label">${t(sub === 'f' ? 'cutsF' : 'cutsH')}</span>${C.CUT_SETS[sub].find(x => x.key === C.CUSTOM_FIELD[sub]).options.filter(o => !o.custom).map(o => tog(sub + ':' + C.CUSTOM_FIELD[sub] + ':' + o.id, lab(o))).join('')}${cutRows(sub)}${add(t('addMyCut'), 'newCut', `data-set="${sub}"`)}</section>`;
    return `<div class="screen">${top(t('catalogTitle'), { noBack: true, big: true })}<main class="main">${seg}${seg2}<p class="muted" style="margin:0">${t({ color: 'catSubColor', f: 'catSubF', h: 'catSubH' }[sub])}</p>
      ${content}
      </main>${tabbar('catalog')}</div>`;
  },

  settings: () => {
    const acc = store.account || {};
    const prof = (k, label, val, ac) => `<label class="field" for="set-${k}"><span class="label">${esc(label)}<span class="req" aria-hidden="true"> *</span></span><input class="input" id="set-${k}" data-set="${k}" value="${esc(val || '')}" placeholder=" " autocomplete="${ac}" required aria-required="true"></label>`;
    return `<div class="screen">${top(t('settingsTitle'), { noBack: true, big: true })}<main class="main">
    ${prof('first', t('yourFirst'), acc.first || store.pro, 'given-name')}
    ${prof('salon', t('salonName'), acc.salon, 'organization')}
    ${prof('city', t('city'), acc.city, 'address-level2')}
    <hr class="sep section">
    <div class="field"><span class="label">${t('language')}</span><div class="chips">${C.LANGS.map(l => `<button data-a="setLang" data-l="${l}" aria-pressed="${store.lang === l}">${langLabel(l)}</button>`).join('')}</div></div>
    <hr class="sep section">
    <section class="card"><h3>${t('storage')}</h3><span class="muted">${t('storageSub')}</span><button class="btn ghost small" data-a="clearAll">${t('clearAll')}</button></section>
    <hr class="sep section">
    ${store.account ? `<section class="card"><h3>${t('account')}</h3><span class="muted">${esc(store.account.email)}</span><button class="btn ghost small" data-a="logout">${t('logout')}</button></section>` : ''}
    <p class="muted" style="text-align:center">${t('version')}</p></main>${tabbar('settings')}</div>`;
  },
};

// ---------- panneaux ----------
function sheetHtml() {
  if (!sheet) return '';
  const head = (title, sub) => `<div class="grab"></div><div class="head"><div class="grow"><h2>${esc(title)}</h2>${sub ? `<span class="muted">${esc(sub)}</span>` : ''}</div><button class="iconbtn" data-a="closeSheet" aria-label="${t('close')}">${svg('x')}</button></div>`;
  let body = '', title = '', sub = '', btn = pbtn(t('validate'), 'sheetOk', sheet.sel != null);
  if (sheet.kind === 'tone') {
    title = t('toneSheet'); sub = t('toneSheetSub');
    const mine = store.custom.colors.filter(x => !hidden('ucolor:' + x.id) || x.id === sheet.sel);
    body = (mine.length ? `<span class="label">${t('yourColorsSheet')}</span><div class="grid3">${mine.map(x => `<button class="tile" data-a="pick" data-v="${x.id}" aria-pressed="${sheet.sel === x.id}"><i style="background:${colorSw(x)}"></i><span class="tname">${esc(x.name)}</span><span class="tcode">${C.colorCode(x.tone, x.reflet)}</span></button>`).join('')}</div><span class="label" style="margin-top:8px">${t('tonesSheet')}</span>` : '') + `<div class="grid3">${C.TONES.filter(x => !hidden('tone:' + x.id) || x.id === sheet.sel).map(x => `<button class="tile" data-a="pick" data-v="${x.id}" aria-pressed="${sheet.sel === x.id}"><i style="background:${swatchCss(x.id)}"></i>${esc(lab(x))}</button>`).join('')}</div>`;
  } else if (sheet.kind === 'reflet') {
    const tone = S.colors[sheet.i].tone; title = t('refletSheet'); sub = t('refletSheetSub', { tone: tone + ' · ' + lab(C.TONES.find(x => x.id === tone)) });
    body = `<div class="grid3">${C.REFLETS.filter(x => !hidden('reflet:' + x.id) || x.id === sheet.sel).map(x => `<button class="tile" data-a="pick" data-v="${x.id}" aria-pressed="${sheet.sel === x.id}"><i style="background:${swatchCss(tone, x.id)}"></i>${esc(lab(x))}</button>`).join('')}</div>`;
  } else if (sheet.kind === 'cut') {
    const f = C.CUT_SETS[S.cutSet].find(x => x.key === sheet.k); const cut = S.cuts[sheet.i]; title = t('f_' + f.key); sub = t('sub_' + f.key);
    const opts = f.options.filter(o => !hidden(S.cutSet + ':' + f.key + ':' + o.id) || o.id === sheet.sel);
    body = opts.map(o => { const okk = C.isAllowed(f, o, cut); return `<button class="opt" data-a="pick" data-v="${o.id}" aria-pressed="${sheet.sel === o.id}" ${okk ? '' : 'disabled'}><span class="grow"><strong>${esc(lab(o))}</strong><span class="muted">${esc(okk ? des(o) : t('incompatible'))}</span></span><span class="radio ${sheet.sel === o.id ? 'on' : ''}"></span></button>`; }).join('');
  } else if (sheet.kind === 'customColor') {
    title = sheet.id ? t('editColor') : t('newColor');
    const tiles = (f, list) => `<div class="minigrid">${list.map(x => `<button class="mtile" data-a="ccPick" data-f="${f}" data-v="${x.id}" aria-pressed="${sheet[f] === x.id}"><i style="background:${f === 'tone' ? swatchCss(x.id) : swatchCss(sheet.tone || 7, x.id)}"></i><span>${f === 'tone' ? x.id : '.' + x.id}</span></button>`).join('')}</div>`;
    body = `<label class="field" for="cc-name"><span class="label">${t('cName')}<span class="req" aria-hidden="true"> *</span></span><input class="input" id="cc-name" data-sheet="name" value="${esc(sheet.name)}" placeholder="${esc(t('cNamePh'))}" autocomplete="off"></label>
      <div class="ccprev"><span class="sw" style="background:${sheet.tone ? swatchCss(sheet.tone, sheet.reflet) : 'var(--line)'}"></span><span class="grow"><strong>${sheet.tone ? C.colorCode(sheet.tone, sheet.reflet) : '–'}</strong><span class="muted">${sheet.tone ? esc(lab(C.TONES.find(x => x.id === sheet.tone)) + (sheet.reflet ? ' · ' + lab(C.REFLETS.find(x => x.id === sheet.reflet)).toLowerCase() : '')) : t('cTone')}</span></span></div>
      <span class="label">${t('cTone')}<span class="req" aria-hidden="true"> *</span></span>${tiles('tone', C.TONES)}
      <span class="label">${t('cR1')}</span>${tiles('reflet', C.REFLETS)}`;
    btn = pbtn(t('saveBtn'), 'ccSave', !!(sheet.name.trim() && sheet.tone)) + (sheet.id ? `<button class="btn ghost danger" data-a="customDelete">${t('deleteBtn')}</button>` : '');
  } else if (sheet.kind === 'customCut') {
    title = sheet.id ? t('editCut') : t('newCut'); sub = sheet.set === 'f' ? t('cutsF') : t('cutsH');
    body = `<label class="field" for="cu-name"><span class="label">${t('cName')}<span class="req" aria-hidden="true"> *</span></span><input class="input" id="cu-name" data-sheet="name" value="${esc(sheet.name)}" placeholder="${esc(t('cutNamePh'))}" autocomplete="off"></label>
      <label class="field" for="cu-desc"><span class="label">${t('cDesc')} · ${t('optionalTag')}</span><input class="input" id="cu-desc" data-sheet="desc" value="${esc(sheet.desc)}" placeholder="${esc(t('cDescPh'))}" autocomplete="off"></label>`;
    btn = pbtn(t('saveBtn'), 'cuSave', !!sheet.name.trim()) + (sheet.id ? `<button class="btn ghost danger" data-a="customDelete">${t('deleteBtn')}</button>` : '');
  } else if (sheet.kind === 'lang') {
    title = t('language'); body = `<div class="chips">${C.LANGS.map(l => `<button data-a="setLang" data-l="${l}" aria-pressed="${store.lang === l}">${langLabel(l)}</button>`).join('')}</div>`; btn = '';
  } else if (sheet.kind === 'abandon') {
    title = t('abandonQ'); sub = t('abandonSub'); body = ''; btn = `${pbtn(t('abandonYes'), 'abandonYes')}<button class="btn ghost" data-a="closeSheet">${t('abandonNo')}</button>`;
  }
  return `<div class="veil" data-a="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">${head(title, sub)}${body ? `<div class="body">${body}</div>` : ''}${btn}</div>`;
}

// ---------- logique métier ----------
const cutSetFor = g => g === 'h' ? 'h' : 'f';
const cutDone = cut => C.CUT_SETS[S.cutSet].every(f => !f.required || cut[f.key]);
const opt = (cut, key) => { const f = C.CUT_SETS[S.cutSet].find(x => x.key === key); return f && cut[key] ? f.options.find(o => o.id === cut[key]) : null; };
function cutTitle(cut) { if (S.cutSet === 'f') { const a = opt(cut, 'shape'), b = opt(cut, 'length'); return [a, b].filter(Boolean).map(lab).join(' · '); } const a = opt(cut, 'style'), b = opt(cut, 'top'); return [a, b].filter(Boolean).map(lab).join(' · '); }
function cutSub(cut) { const o = opt(cut, S.cutSet === 'f' ? 'fringe' : 'sides'); return o ? lab(o) : ''; }
function colorTitle(c) { if (c.custom) return `${c.name} · ${C.colorCode(c.tone, c.reflet)}`; const tn = C.TONES.find(x => x.id === c.tone); const rf = C.REFLETS.find(x => x.id === (c.reflet ?? 0)); return `${c.tone}.${c.reflet ?? 0} · ${lab(tn)}${rf.id ? ' ' + lab(rf).toLowerCase() : ''}`; }
function colorNote(c) { const rf = C.REFLETS.find(x => x.id === (c.reflet ?? 0)); return t(rf.temp === 'warm' ? 'warmNote' : rf.temp === 'cold' ? 'coldNote' : 'neutralNote'); }
function infoOf(v) {
  if (v.cut && v.color) return { title: cutTitle(v.cut), sub: colorTitle(v.color), dot: `background:${colorSw(v.color)}` };
  if (v.cut) return { title: cutTitle(v.cut), sub: cutSub(v.cut) || '-', icon: svg('cut') };
  return { title: colorTitle(v.color), sub: colorNote(v.color), dot: `background:${colorSw(v.color)}` };
}
function tabLabel(i) { const n = pad(i + 1); return S.svc.cut && S.svc.color ? t('render', { n }) : S.svc.cut ? t('cutN', { n }) : t('colorN', { n }); }
function nextChoice() { return S.svc.cut ? 'cut' : 'color'; }

// Rendu génératif (coupe, et couleur quand il y a aussi une coupe) via la fonction Supabase → Nano Banana 2
// Le service n'est utilisé que s'il confirme que la clé Gemini est en place (vérifié une fois au démarrage)
let renderReady = false;
if (RENDER.enabled && RENDER.url) fetch(RENDER.url, { headers: { apikey: RENDER.anonKey, Authorization: `Bearer ${RENDER.anonKey}` } })
  .then(r => r.json()).then(j => { renderReady = !!(j && j.configured); }).catch(() => {});
const renderMode = () => /[?&]render=mock\b/.test(location.search) ? 'mock' : renderReady ? 'live' : null;
let renderAbort = null;
function renderPayload(cut, color) {
  const en = o => C.label(o, 'en'), enDesc = o => C.describe(o, 'en');
  const set = S.cutSet, fields = C.CUT_SETS[set];
  const items = cut ? fields.filter(f => cut[f.key]).map(f => { const o = f.options.find(x => x.id === cut[f.key]); return { field: f.key, name: en(o), desc: enDesc(o) }; }) : [];
  const col = color ? { tone: color.tone, toneName: en(C.TONES.find(x => x.id === color.tone)), reflet: color.reflet ?? 0, refletName: en(C.REFLETS.find(x => x.id === (color.reflet ?? 0))), code: C.colorCode(color.tone, color.reflet ?? 0), custom: color.custom ? color.name : null } : null;
  return { cut: items.length ? { set, items } : null, color: col };
}
async function aiRender(cut, color, signal) {
  const body = { image: S.photo.toDataURL('image/jpeg', 0.9), ...renderPayload(cut, color) };
  let url;
  if (renderMode() === 'mock') {
    await new Promise(r => setTimeout(r, 1500));
    let c = S.photo; if (color && S.mask) c = E.recolor(c, S.mask, color.tone, color.reflet ?? 0);
    const out = document.createElement('canvas'); out.width = c.width; out.height = c.height; const g = out.getContext('2d');
    g.filter = 'contrast(1.04) saturate(1.08)'; g.drawImage(c, 0, 0); return out;
  }
  const r = await fetch(RENDER.url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', apikey: RENDER.anonKey, Authorization: `Bearer ${RENDER.anonKey}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.image) { const e = new Error(j.error || 'http_' + r.status); e.code = j.error || (r.status === 429 ? 'daily_limit' : 'error'); throw e; }
  url = j.image;
  return E.canvasFromUrl(url);
}
async function computeRenders() {
  const n = Math.max(S.svc.cut ? S.cuts.length : 0, S.svc.color ? S.colors.length : 0);
  const mode = renderMode(); renderAbort = new AbortController();
  const one = async i => {
    const cut = S.svc.cut ? S.cuts[Math.min(i, S.cuts.length - 1)] : null;
    const color = S.svc.color ? S.colors[Math.min(i, S.colors.length - 1)] : null;
    let base = S.photo, mask = S.mask, demoUsed = false, cutPending = false, ai = false, aiError = null;
    if (cut && mode) {
      // la coupe change le volume des cheveux : un seul rendu génératif fait coupe + couleur
      try { base = await aiRender(cut, color, renderAbort.signal); ai = true; }
      catch (e) { if (renderAbort.signal.aborted) throw e; aiError = e.code || 'error'; cutPending = true; }
      if (ai) return { url: base.toDataURL('image/jpeg', 0.9), canvas: base, cut, color, ai, mock: mode === 'mock' };
    } else if (cut) {
      const preset = S.demo && S.cutSet === 'f' && E.DEMO.cuts[cut.shape];
      if (preset) { base = await E.canvasFromUrl(preset.photo); mask = await E.maskFromUrl(preset.mask, base.width, base.height); demoUsed = true; }
      else cutPending = true;
    }
    if (color && mask) base = E.recolor(base, mask, color.tone, color.reflet ?? 0);
    return { url: base.toDataURL('image/jpeg', 0.9), canvas: base, cut, color, demoUsed, cutPending, aiError };
  };
  return Promise.all(Array.from({ length: n }, (_, i) => one(i)));
}

async function setPhoto(canvas, isDemo, mask) {
  S.photo = canvas; S.photoUrl = canvas.toDataURL('image/jpeg', 0.9); S.demo = isDemo; S.mask = mask || null; S.renders = null;
  if (isDemo) { S.framing = 'ok'; render(); return; }
  S.framing = 'busy'; render();
  const r = await E.checkFraming(canvas).catch(() => null);
  S.framing = r === null ? 'ready' : r.ok ? 'ok' : 'bad'; render();
}

// ---------- détourage au doigt ----------
let brush = null;
function mountBrush() {
  const cv = document.getElementById('brushCanvas'); if (!cv) return;
  const w = S.photo.width, h = S.photo.height; cv.width = w; cv.height = h;
  if (!brush || brush.w !== w) { const m = E.canvasOf(w, h); brush = { w, h, m, tint: E.canvasOf(w, h) }; }
  const ctx = cv.getContext('2d');
  const draw = () => { ctx.drawImage(S.photo, 0, 0); const tc = brush.tint.getContext('2d'); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, w, h); tc.fillStyle = '#ff9aa8'; tc.fillRect(0, 0, w, h); tc.globalCompositeOperation = 'destination-in'; tc.drawImage(brush.m, 0, 0); ctx.globalAlpha = 0.55; ctx.drawImage(brush.tint, 0, 0); ctx.globalAlpha = 1; };
  draw();
  let last = null;
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height]; };
  const stroke = (a, b) => { const m = brush.m.getContext('2d'); m.globalCompositeOperation = route.mode === 'erase' ? 'destination-out' : 'source-over'; m.strokeStyle = '#fff'; m.lineCap = m.lineJoin = 'round'; m.lineWidth = (route.size || 34) * w / cv.getBoundingClientRect().width; m.beginPath(); m.moveTo(a[0], a[1]); m.lineTo(b[0], b[1]); m.stroke(); draw(); };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); last = pos(e); stroke(last, last); };
  cv.onpointermove = e => { if (!last) return; const p = pos(e); stroke(last, p); last = p; };
  cv.onpointerup = cv.onpointercancel = () => { last = null; };
}
function brushToMask() {
  const { w, h, m } = brush; const d = m.getContext('2d').getImageData(0, 0, w, h).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 128) n++;
  if (n < 200) return null;
  const out = E.canvasOf(w, h); const o = out.getContext('2d'); o.fillStyle = '#000'; o.fillRect(0, 0, w, h); o.filter = `blur(${Math.max(2, Math.round(w / 200))}px)`; o.drawImage(m, 0, 0); return out;
}

// ---------- comptes (prototype : tout reste sur l'appareil, aucun e-mail n'est envoyé) ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const passOk = p => (p || '').length >= 8 && /\d/.test(p) && /[A-Za-zÀ-ÿ]/.test(p);
async function hashPass(email, pass) {
  const s = 'stylup:' + email.trim().toLowerCase() + ':' + pass;
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h; }
}
const fail = errs => { F.err = errs; render(); const k = Object.keys(errs)[0]; document.getElementById('f-' + k)?.focus(); };
// ---------- Supabase ----------
// Écritures en arrière-plan : l'écran ne bloque pas, un message s'affiche si l'enregistrement échoue
const sync = (fn) => { if (!Cloud.online || !store.account || !store.account.salonId) return; Promise.resolve().then(fn).catch(e => { console.warn('sync', e); toast(t('syncError')); }); };
// Remplace le cache local par les données du compte (après connexion ou au démarrage)
function applyCloud(d) {
  store.account = { email: d.email, verified: true, first: d.profile.first_name || '', salonId: d.salon && d.salon.id, salon: d.salon ? d.salon.name : '', city: d.salon ? d.salon.city : '', trade: d.salon ? d.salon.trade : null };
  if (d.profile.first_name) store.pro = d.profile.first_name;
  if (d.profile.lang && C.LANGS.includes(d.profile.lang)) store.lang = d.profile.lang;
  store.custom = Cloud.toCustom(d.items); store.hidden = d.hidden; store.sessions = d.sessions;
  C.applyCustomCuts(store.custom.cuts); save();
}
// Après connexion : charge le compte puis va à l'accueil (ou à « Votre établissement » si pas encore de salon)
async function afterSignIn() {
  let d; try { d = await Cloud.loadAll(); } catch (e) { return toast(t('errNetwork')); }
  if (!d) return;
  applyCloud(d);
  if (!d.salon) { F = { first: d.profile.first_name || '', salon: '', city: '', trade: null }; stack = [{ name: 'splash' }]; route = { name: 'salonSetup' }; return render(); }
  enterApp();
}
// Premier passage sur Supabase : on envoie le catalogue maison créé sur cet appareil (ids « u… » non-UUID renouvelés)
async function migrateLocalCatalog(salonId) {
  const isUuid = id => /^u[0-9a-f-]{36}$/.test(id);
  const c = store.custom, idMap = {};
  const fix = it => { if (!isUuid(it.id)) { const n = uid(); idMap[it.id] = n; it.id = n; } return it; };
  c.colors.forEach(fix); c.cuts.f.forEach(fix); c.cuts.h.forEach(fix);
  store.hidden = store.hidden.map(k => k.replace(/u[0-9a-z-]+$/, m => idMap[m] || m));
  await Promise.all([
    ...c.colors.map((x, i) => Cloud.saveItem(salonId, 'color', x, i)),
    ...c.cuts.f.map((x, i) => Cloud.saveItem(salonId, 'cut_f', x, i)),
    ...c.cuts.h.map((x, i) => Cloud.saveItem(salonId, 'cut_h', x, i)),
    ...store.hidden.map(k => Cloud.setHidden(salonId, k, true)),
  ]).catch(e => console.warn('migration', e));
  C.applyCustomCuts(c.cuts); save();
}
const cloudErr = (code, field) => {
  const msg = { login: 'errLogin', exists: 'errExists', code: 'errCode', weak: 'errPass', rate: 'errRate', network: 'errNetwork' }[code] || 'errUnknown';
  return fail(field && (code === 'exists' || code === 'code' || code === 'weak') ? { [field]: t(msg) } : { form: t(msg) });
};

const enterApp = () => { store.loggedIn = true; store.started = true; save(); F = {}; stack = []; route = { name: 'home' }; render(); };
setInterval(() => { if (route.name !== 'verify') return; const b = document.getElementById('resendBtn'); if (!b) return; const left = Math.max(0, Math.ceil(((F.resendAt || 0) - Date.now()) / 1000)); b.disabled = !!left; b.textContent = left ? t('resendIn', { n: left }) : t('resend'); }, 1000);

// ---------- actions ----------
const A = {
  back,
  toSignup: () => { F = { email: F.email || '' }; go('signup'); },
  toLogin: () => { F = { email: (store.account && store.account.email) || F.email || '' }; go('login'); },
  google: () => toast(t('googleSoon')),
  signupOk: async () => {
    const email = (F.email || '').trim(), errs = {};
    if (!EMAIL_RE.test(email)) errs.email = t('errEmail');
    if (!passOk(F.pass)) errs.pass = t('errPass');
    if (!errs.email && store.account && store.account.verified && store.account.email.toLowerCase() === email.toLowerCase()) errs.email = t('errExists');
    if (Object.keys(errs).length) return fail(errs);
    if (Cloud.online) {
      const r = await Cloud.signUp(email, F.pass, store.lang);
      if (r.error) return cloudErr(r.error, r.error === 'weak' ? 'pass' : 'email');
      if (r.session) return afterSignIn(); // confirmation e-mail désactivée côté Supabase
      F = { email, code: '', mode: 'signup', resendAt: Date.now() + 60000 }; return go('verify');
    }
    store.account = { email, hash: await hashPass(email, F.pass), verified: false }; save();
    F = { email, code: '', resendAt: Date.now() + 30000 }; go('verify');
  },
  resend: async () => {
    if (Cloud.online) { const r = await Cloud.resendCode(F.email, F.mode); if (r.error) return cloudErr(r.error); F.resendAt = Date.now() + 60000; }
    else F.resendAt = Date.now() + 30000;
    F.err = null; toast(t('resent'));
  },
  verifyOk: async () => {
    if (Cloud.online) {
      const code = (F.code || '').replace(/\D/g, ''); if (code.length !== 6) return fail({ code: t('errCode') });
      const r = await Cloud.verifyCode(F.email, code, F.mode);
      if (r.error) return cloudErr(r.error, 'code');
      if (F.mode === 'recovery') { F = { sentTo: F.email }; return go('reset', {}, 'replace'); }
      return afterSignIn();
    }
    if ((F.code || '').replace(/\D/g, '') !== '123456') return fail({ code: t('errCode') });
    store.account.verified = true; save();
    F = { first: store.account.first || '', salon: store.account.salon || '', city: store.account.city || '' }; go('salonSetup', {}, 'replace');
  },
  trade: d => { F.trade = d.v; render(); },
  salonOk: async () => {
    const errs = {}; ['first', 'salon', 'city'].forEach(k => { if (!(F[k] || '').trim()) errs[k] = t('errRequired'); });
    if (Object.keys(errs).length || !F.trade) return fail(errs);
    if (Cloud.online) {
      try {
        const salon = await Cloud.createSalon({ name: F.salon.trim(), city: F.city.trim(), trade: F.trade });
        await Cloud.saveProfile({ first_name: F.first.trim(), lang: store.lang });
        Object.assign(store.account, { first: F.first.trim(), salon: salon.name, city: salon.city, trade: salon.trade, salonId: salon.id }); store.pro = F.first.trim();
        await migrateLocalCatalog(salon.id);
        return enterApp();
      } catch (e) { console.warn(e); return fail({ form: t('errNetwork') }); }
    }
    Object.assign(store.account, { first: F.first.trim(), salon: F.salon.trim(), city: F.city.trim(), trade: F.trade }); store.pro = F.first.trim(); enterApp();
  },
  loginOk: async () => {
    const email = (F.email || '').trim(), errs = {};
    if (!EMAIL_RE.test(email)) errs.email = t('errEmail');
    if (!F.pass) errs.pass = t('errRequired');
    if (Object.keys(errs).length) return fail(errs);
    if (Cloud.online) {
      const r = await Cloud.signIn(email, F.pass);
      if (r.error === 'unconfirmed') { await Cloud.resendCode(email, 'signup'); F = { email, code: '', mode: 'signup', resendAt: Date.now() + 60000 }; return go('verify'); }
      if (r.error) return cloudErr(r.error);
      return afterSignIn();
    }
    const acc = store.account;
    if (!acc || acc.email.toLowerCase() !== email.toLowerCase() || acc.hash !== await hashPass(email, F.pass)) return fail({ form: t('errLogin') });
    if (!acc.verified) { F = { email, code: '', resendAt: Date.now() + 30000 }; return go('verify'); }
    if (!acc.salon) { F = { first: '', salon: '', city: '', trade: null }; return go('salonSetup'); }
    store.pro = acc.first || store.pro; enterApp();
  },
  toForgot: () => { F = { email: F.email || '' }; go('forgot'); },
  forgotOk: async () => {
    const email = (F.email || '').trim(); if (!EMAIL_RE.test(email)) return fail({ email: t('errEmail') });
    if (Cloud.online) { const r = await Cloud.sendRecovery(email); if (r.error) return cloudErr(r.error); F = { email, code: '', mode: 'recovery', resendAt: Date.now() + 60000 }; return go('verify'); }
    F = { sentTo: email }; go('forgotSent');
  },
  openLink: () => { F = { sentTo: F.sentTo }; go('reset'); },
  backLogin: () => { F = { email: F.sentTo || '' }; stack = [{ name: 'splash' }]; route = { name: 'login' }; render(); },
  resetOk: async () => {
    const errs = {};
    if (!passOk(F.newPass)) errs.newPass = t('errPass');
    else if (F.newPass !== F.newPass2) errs.newPass2 = t('errMatch');
    if (Object.keys(errs).length) return fail(errs);
    if (Cloud.online) { const r = await Cloud.updatePassword(F.newPass); if (r.error) return cloudErr(r.error, r.error === 'weak' ? 'newPass' : null); toast(t('passChanged')); return afterSignIn(); }
    const acc = store.account;
    if (acc && acc.email.toLowerCase() === (F.sentTo || '').toLowerCase()) { acc.hash = await hashPass(acc.email, F.newPass); save(); }
    const email = F.sentTo; F = { email }; stack = [{ name: 'splash' }]; route = { name: 'login' }; toast(t('passChanged'));
  },
  logout: async () => {
    if (Cloud.online) { await Cloud.signOut(); Object.assign(store, { account: null, sessions: [], hidden: [], custom: { colors: [], cuts: { f: [], h: [] } } }); C.applyCustomCuts(store.custom.cuts); }
    store.loggedIn = false; save(); S = null; F = {}; stack = []; route = { name: 'splash' }; render(); },
  catSub: d => { route = { ...route, sub: d.s }; render(); },
  tab: d => { stack = []; route = { name: d.r }; sheet = null; render(); },
  langSheet: () => { sheet = { kind: 'lang' }; render(); },
  setLang: d => { store.lang = d.l; save(); sync(() => Cloud.saveProfile({ lang: d.l })); if (sheet && sheet.kind === 'lang') sheet = null; render(); },
  newSession: () => { newSession(); go('client'); },
  gender: d => { S.gender = d.g; S.cutSet = cutSetFor(d.g); S.cuts = [{}]; render(); },
  toServices: () => go('services'),
  svc: d => { S.svc[d.k] = !S.svc[d.k]; render(); },
  toConsent: () => go('consent'),
  consent: d => { S.consent[d.k] = !S.consent[d.k]; render(); },
  toCapture: () => go('capture'),
  demo: async () => { const p = await E.canvasFromUrl(E.DEMO.photo); const m = await E.maskFromUrl(E.DEMO.mask, p.width, p.height); await setPhoto(p, true, m); },
  afterCapture: async () => {
    if (S.svc.color && !S.mask) {
      const prev = S.framing; S.framing = 'busy'; render(); const m = await E.autoHairMask(S.photo).catch(() => null); S.framing = prev;
      if (m) S.mask = m; else { brush = null; return go('brush', { mode: 'brush', size: 34 }); }
    }
    go(nextChoice());
  },
  brushMode: d => { route.mode = d.m; render(); },
  brushClear: () => { brush.m.getContext('2d').clearRect(0, 0, brush.w, brush.h); render(); },
  brushOk: () => { const m = brushToMask(); if (!m) return toast(t('maskEmpty')); S.mask = m; go(nextChoice()); },
  cutSet: d => { S.cutSet = d.s; S.cuts = S.cuts.map(() => ({})); render(); },
  openCard: d => { S.open[d.kind] = S.open[d.kind] === +d.i ? -1 : +d.i; render(); },
  addCard: d => { const list = d.kind === 'cut' ? S.cuts : S.colors; list.push({}); S.open[d.kind] = list.length - 1; render(); },
  removeCard: d => { const list = d.kind === 'cut' ? S.cuts : S.colors; list.splice(+d.i, 1); S.open[d.kind] = 0; render(); },
  cutSheet: d => { sheet = { kind: 'cut', i: +d.i, k: d.k, sel: S.cuts[+d.i][d.k] ?? null }; render(); },
  toneSheet: d => { const c = S.colors[+d.i]; sheet = { kind: 'tone', i: +d.i, sel: c.custom || (c.tone ?? null) }; render(); },
  refletSheet: d => { sheet = { kind: 'reflet', i: +d.i, sel: S.colors[+d.i].reflet ?? null }; render(); },
  newColor: () => { sheet = { kind: 'customColor', id: null, name: '', tone: null, reflet: 0 }; render(); },
  editColor: d => { const x = store.custom.colors.find(y => y.id === d.id); sheet = { kind: 'customColor', id: x.id, name: x.name, tone: x.tone, reflet: x.reflet ?? 0 }; render(); },
  ccPick: d => { sheet[d.f] = +d.v; render(); },
  ccSave: () => {
    const v = { name: sheet.name.trim(), tone: sheet.tone, reflet: sheet.reflet ?? 0 };
    let item; if (sheet.id) { item = store.custom.colors.find(y => y.id === sheet.id); Object.assign(item, v); } else store.custom.colors.push(item = { id: uid(), ...v });
    const pos = store.custom.colors.indexOf(item); sync(() => Cloud.saveItem(store.account.salonId, 'color', item, pos));
    save(); sheet = null; toast(t('savedItem'));
  },
  newCut: d => { sheet = { kind: 'customCut', set: d.set, id: null, name: '', desc: '' }; render(); },
  editCut: d => { const x = store.custom.cuts[d.set].find(y => y.id === d.id); sheet = { kind: 'customCut', set: d.set, id: x.id, name: x.name, desc: x.desc || '' }; render(); },
  cuSave: () => {
    const v = { name: sheet.name.trim(), desc: sheet.desc.trim() }, list = store.custom.cuts[sheet.set];
    let item; if (sheet.id) { item = list.find(y => y.id === sheet.id); Object.assign(item, v); } else list.push(item = { id: uid(), ...v });
    const kind = sheet.set === 'h' ? 'cut_h' : 'cut_f', pos = list.indexOf(item); sync(() => Cloud.saveItem(store.account.salonId, kind, item, pos));
    C.applyCustomCuts(store.custom.cuts); save(); sheet = null; toast(t('savedItem'));
  },
  customDelete: () => {
    if (sheet.kind === 'customColor') { store.custom.colors = store.custom.colors.filter(y => y.id !== sheet.id); store.hidden = store.hidden.filter(k => k !== 'ucolor:' + sheet.id); }
    else { store.custom.cuts[sheet.set] = store.custom.cuts[sheet.set].filter(y => y.id !== sheet.id); store.hidden = store.hidden.filter(k => !k.endsWith(':' + sheet.id)); C.applyCustomCuts(store.custom.cuts); }
    const gone = sheet.id; sync(async () => { await Cloud.deleteItem(gone); const keys = [`ucolor:${gone}`, `f:shape:${gone}`, `h:style:${gone}`]; for (const k of keys) await Cloud.setHidden(store.account.salonId, k, false); });
    save(); sheet = null; toast(t('deleted'));
  },
  pick: d => { sheet.sel = sheet.kind === 'cut' || /^u/.test(d.v) ? d.v : +d.v; render(); },
  closeSheet: () => { sheet = null; render(); },
  sheetOk: () => {
    if (sheet.kind === 'tone') {
      const mine = typeof sheet.sel === 'string' && store.custom.colors.find(x => x.id === sheet.sel);
      if (mine) S.colors[sheet.i] = { custom: mine.id, name: mine.name, tone: mine.tone, reflet: mine.reflet ?? 0 };
      else { const prev = S.colors[sheet.i]; S.colors[sheet.i] = prev.custom ? { tone: sheet.sel } : Object.assign(prev, { tone: sheet.sel }); }
    }
    else if (sheet.kind === 'reflet') { S.colors[sheet.i].reflet = sheet.sel; }
    else if (sheet.kind === 'cut') {
      const cut = S.cuts[sheet.i]; cut[sheet.k] = sheet.sel;
      for (const f of C.CUT_SETS[S.cutSet]) if (f.dependsOn === sheet.k && cut[f.key] && !C.isAllowed(f, f.options.find(o => o.id === cut[f.key]), cut)) delete cut[f.key];
    }
    S.renders = null; sheet = null; render();
  },
  toColor: () => go('color'),
  launch: async () => {
    go('generating'); let n = 2; const tm = setInterval(() => { n = Math.max(1, n - 1); const el = document.getElementById('secs'); if (el && !(renderMode() && S.svc.cut)) el.textContent = t('secondsLeft', { n }); }, 900);
    const started = Date.now(); let R; try { R = await computeRenders(); } catch (e) { clearInterval(tm); return; } await new Promise(r => setTimeout(r, Math.max(0, 1800 - (Date.now() - started)))); clearInterval(tm);
    if (route.name !== 'generating') return; S.renders = R; S.tab = 1; go('result', {}, 'replace');
  },
  cancelGen: () => { renderAbort?.abort(); back(); },
  rtab: d => { S.tab = +d.i; render(); },
  editChoices: () => back(),
  chooseRender: () => { S.chosen = S.tab - 1; S.after = null; S.rating = null; go('kept'); },
  rate: d => { S.rating = +d.n; render(); },
  finish: () => {
    const v = S.renders[S.chosen]; const info = infoOf(v);
    const svcLabel = [S.svc.cut && t('svcCut'), S.svc.color && t('svcColor')].filter(Boolean).join(' + ');
    const entry = { id: Date.now(), date: Date.now(), first: S.first.trim(), svcLabel, services: [S.svc.cut && 'cut', S.svc.color && 'color'].filter(Boolean), gender: S.gender, title: info.title, sub: info.sub, thumb: E.thumb(v.canvas, 360, 0.8), after: S.after, rating: S.rating };
    store.sessions.unshift(entry);
    sync(async () => { const r = await Cloud.addSession(store.account.salonId, entry); entry.rid = r.rid; entry.paths = r.paths; save(); });
    store.sessions = store.sessions.slice(0, 40); if (!save()) { store.sessions.pop(); save(); }
    S = null; stack = []; route = { name: 'home' }; toast(t('saved'));
  },
  openSession: d => go('session', { i: +d.i }),
  deleteSession: d => { const [s] = store.sessions.splice(+d.i, 1); save(); back(); if (s && s.rid) sync(() => Cloud.deleteSession(s.rid, s.paths)); },
  abandon: () => { sheet = { kind: 'abandon' }; render(); },
  abandonYes: () => { S = null; brush = null; stack = []; route = { name: 'home' }; sheet = null; render(); },
  hide: d => { const i = store.hidden.indexOf(d.k); if (i >= 0) store.hidden.splice(i, 1); else store.hidden.push(d.k); save(); render(); const on = i < 0; sync(() => Cloud.setHidden(store.account.salonId, d.k, on)); },
  clearAll: () => { store.sessions = []; save(); toast(t('cleared')); sync(() => Cloud.clearSessions(store.account.salonId)); },
};

$app.addEventListener('click', e => { const eye = e.target.closest('[data-eye]'); if (eye) { e.preventDefault(); const inp = document.getElementById(eye.dataset.eye); inp.type = inp.type === 'password' ? 'text' : 'password'; eye.setAttribute('aria-label', inp.type === 'password' ? t('show') : t('hide')); eye.classList.toggle('on', inp.type === 'text'); return; } const el = e.target.closest('[data-a]'); if (!el || el.disabled) return; if (el.dataset.a === 'closeSheet' && el.classList.contains('sheet')) return; const f = A[el.dataset.a]; if (f) { e.preventDefault(); f(el.dataset, el); } });
$app.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.f) { e.preventDefault(); $app.querySelector('.foot .btn.primary')?.click(); } });
// Réglages : prénom, établissement et ville sont obligatoires ; enregistrés à la frappe, jamais vides
function saveProfileField(inp) {
  const k = inp.dataset.set, v = inp.value.trim(), field = inp.closest('.field');
  field.querySelector('.err')?.remove();
  if (!v) { inp.classList.add('invalid'); inp.setAttribute('aria-invalid', 'true'); field.insertAdjacentHTML('beforeend', `<span class="err">${esc(t('errRequired'))}</span>`); return; }
  inp.classList.remove('invalid'); inp.removeAttribute('aria-invalid');
  store.account = store.account || {}; store.account[k] = v; if (k === 'first') store.pro = v; save();
  clearTimeout(profileTimer[k]); profileTimer[k] = setTimeout(() => sync(() => k === 'first' ? Cloud.saveProfile({ first_name: v }) : Cloud.updateSalon(store.account.salonId, { [k === 'salon' ? 'name' : 'city']: v })), 700);
}
const profileTimer = {};
$app.addEventListener('input', e => { if (e.target.dataset.set) return saveProfileField(e.target); if (e.target.dataset.sheet && sheet) { sheet[e.target.dataset.sheet] = e.target.value; const ok = $app.querySelector('.sheet [data-a=ccSave], .sheet [data-a=cuSave]'); if (ok) ok.disabled = !(sheet.name.trim() && (sheet.kind !== 'customColor' || sheet.tone)); return; } if (e.target.dataset.otp !== undefined) otpPaint(e.target); if (e.target.dataset.f) { const k = e.target.dataset.f; F[k] = e.target.value; const ready = READY[route.name], cta = ready && $app.querySelector('.foot .btn.primary'); if (cta) cta.disabled = !ready(); if (F.err && (F.err[k] || F.err.form)) { delete F.err[k]; delete F.err.form; e.target.classList.remove('invalid'); e.target.removeAttribute('aria-invalid'); e.target.closest('.field')?.querySelector('.err')?.remove(); $app.querySelector('p.err[role=alert]')?.remove(); } return; } const k = e.target.dataset.in; if (!k) return; if (k === 'first') S.first = e.target.value; else if (k === 'brushSize') route.size = +e.target.value; });
$app.addEventListener('focusin', e => { if (e.target.dataset.otp !== undefined) e.target.closest('.otp').classList.add('focus'); });
$app.addEventListener('focusout', e => { if (e.target.dataset.otp !== undefined) e.target.closest('.otp').classList.remove('focus'); });
$app.addEventListener('click', e => { if (e.target.dataset.otp !== undefined) otpDemoFill(e.target); });
$app.addEventListener('change', async e => {
  const k = e.target.dataset.file; if (!k) return; const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  const c = await E.photoFromFile(f);
  if (k === 'photo') await setPhoto(c, false, null); else { S.after = E.thumb(c, 360, 0.8); render(); }
});

let lastRoute = null, lastSheet = null;
function render() {
  document.documentElement.lang = store.lang;
  if (!S && !['splash', 'home', 'catalog', 'settings', 'session', 'signup', 'verify', 'salonSetup', 'login', 'forgot', 'forgotSent', 'reset'].includes(route.name)) route = { name: store.loggedIn ? 'home' : 'splash' };
  const html = (SCREENS[route.name] || SCREENS.home)();
  const oldVid = $app.querySelector('.splash-video');
  // Même écran (et même panneau) qu'avant : on garde la position de défilement au lieu de remonter en haut
  const sameScreen = route === lastRoute, sameSheet = sameScreen && sheet && lastSheet && sheet.kind === lastSheet;
  const mainY = sameScreen ? $app.querySelector('.main')?.scrollTop : 0, sheetY = sameSheet ? $app.querySelector('.sheet .body')?.scrollTop : 0;
  $app.innerHTML = html + sheetHtml() + (toastMsg ? `<div class="toast" role="status">${esc(toastMsg)}</div>` : '');
  const newVid = $app.querySelector('.splash-video'); if (oldVid && newVid) newVid.replaceWith(oldVid); // la vidéo continue au lieu de repartir du début
  if (mainY) { const m = $app.querySelector('.main'); if (m) m.scrollTop = mainY; }
  if (sameSheet) $app.querySelectorAll('.sheet, .veil').forEach(el => el.classList.add('stay')); // pas de nouvelle animation d'ouverture
  if (sheetY) { const b = $app.querySelector('.sheet .body'); if (b) b.scrollTop = sheetY; }
  lastRoute = route; lastSheet = sheet ? sheet.kind : null;
  if (route.name === 'brush') mountBrush();
  const v = $app.querySelector('.splash-video'); if (v) { if (matchMedia('(prefers-reduced-motion: reduce)').matches) v.pause(); else v.play().catch(() => {}); }
}
render();
// Démarrage : si Supabase répond, la session du compte (gardée sur l'appareil) remplace le mode local
Cloud.init().then(async ok => {
  if (!ok) return;
  const user = await Cloud.currentUser();
  if (!user) { if (store.loggedIn) { store.loggedIn = false; store.account = null; save(); stack = []; route = { name: 'splash' }; render(); } return; }
  try {
    const d = await Cloud.loadAll(); applyCloud(d);
    if (!d.salon) { F = { first: d.profile.first_name || '', salon: '', city: '', trade: null }; stack = [{ name: 'splash' }]; route = { name: 'salonSetup' }; return render(); }
    if (!store.loggedIn) return enterApp();
    if (!S) render();
  } catch (e) { console.warn('load', e); }
});
window.__stylup = { get S() { return S; }, get route() { return route; }, A };
