// Couche de données Supabase : comptes (inscription avec code e-mail, connexion, mot de passe oublié),
// profil, salon, catalogue personnalisé, éléments masqués, sessions clientes et leurs photos.
// L'app garde une copie locale (cache) ; si Supabase est injoignable, elle reste en mode local.
import { SUPABASE } from './config.js?v=202611161833';

const BUCKET = 'session-photos';
let sb = null;
export let online = false;

// Démarrage : vérifie que Supabase répond, puis crée le client (session gardée sur l'appareil)
export async function init() {
  if (online) return true;
  if (!window.supabase || !SUPABASE.url) return false;
  try {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(SUPABASE.url + '/auth/v1/health', { headers: { apikey: SUPABASE.anonKey }, signal: ctrl.signal });
    clearTimeout(tm);
    if (!r.ok) return false;
  } catch (e) { return false; }
  sb = window.supabase.createClient(SUPABASE.url, SUPABASE.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'stylup.auth' },
  });
  online = true;
  return true;
}

// Nouvel essai de connexion juste avant une action de compte (réseau revenu, démarrage trop lent…)
export const ensure = () => init();

export async function currentUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

// ---------- comptes ----------
// Codes d'erreur ramenés à quelques cas que l'app sait afficher
const errCode = e => {
  if (!e) return null;
  const c = e.code || '', m = (e.message || '').toLowerCase();
  if (c === 'invalid_credentials' || m.includes('invalid login')) return 'login';
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return 'unconfirmed';
  if (c === 'user_already_exists' || m.includes('already registered')) return 'exists';
  if (c === 'otp_expired' || m.includes('expired') || m.includes('invalid') && m.includes('token')) return 'code';
  if (c === 'weak_password' || m.includes('password should')) return 'weak';
  if (c.includes('rate_limit') || e.status === 429 || m.includes('rate limit') || m.includes('security purposes')) return 'rate';
  if (m.includes('fetch') || m.includes('network')) return 'network';
  return 'unknown';
};

export async function signUp(email, password, lang) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { lang } } });
  if (error) return { error: errCode(error) };
  // Adresse déjà inscrite et confirmée : Supabase renvoie un compte sans identité (anti-énumération)
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return { error: 'exists' };
  return { ok: true, session: !!data.session };
}
export async function verifyCode(email, token, kind) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: kind === 'recovery' ? 'recovery' : 'email' });
  if (error && kind !== 'recovery') { // anciens modèles d'e-mail : type « signup »
    const r2 = await sb.auth.verifyOtp({ email, token, type: 'signup' });
    if (!r2.error) return { ok: true };
  }
  return error ? { error: errCode(error) } : { ok: !!data.session };
}
export async function resendCode(email, kind) {
  const { error } = kind === 'recovery' ? await sb.auth.resetPasswordForEmail(email) : await sb.auth.resend({ type: 'signup', email });
  return error ? { error: errCode(error) } : { ok: true };
}
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? { error: errCode(error) } : { ok: true };
}
export async function sendRecovery(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email);
  return error ? { error: errCode(error) } : { ok: true };
}
export async function updatePassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  return error ? { error: errCode(error) } : { ok: true };
}
export async function signOut() { if (sb) await sb.auth.signOut({ scope: 'local' }).catch(() => {}); }

// ---------- données ----------
const must = ({ data, error }) => { if (error) throw error; return data; };
const appId = id => 'u' + id;                      // les éléments maison ont un id « u… » dans l'app
const dbId = id => String(id).replace(/^u/, '');

// Tout ce qu'il faut à l'app après connexion
export async function loadAll() {
  const user = await currentUser(); if (!user) return null;
  const profile = must(await sb.from('profiles').select('first_name, lang').eq('id', user.id).maybeSingle()) || {};
  const salons = must(await sb.from('salons').select('id, name, city, trade').order('created_at').limit(1));
  const salon = salons[0] || null;
  const out = { email: user.email, profile, salon, items: [], hidden: [], sessions: [] };
  if (!salon) return out;
  const [items, hidden, sessions] = await Promise.all([
    sb.from('catalog_items').select('id, kind, name, description, tone, reflet').eq('salon_id', salon.id).order('position').order('created_at'),
    sb.from('catalog_hidden').select('item_key').eq('salon_id', salon.id),
    sb.from('client_sessions').select('id, client_first_name, services, choices, title, subtitle, render_path, after_path, rating, created_at').eq('salon_id', salon.id).order('created_at', { ascending: false }).limit(40),
  ]);
  out.items = must(items); out.hidden = must(hidden).map(h => h.item_key);
  const rows = must(sessions);
  const paths = rows.flatMap(r => [r.render_path, r.after_path]).filter(Boolean);
  const urls = {};
  if (paths.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24 * 7);
    (data || []).forEach(u => { if (u.signedUrl) urls[u.path] = u.signedUrl; });
  }
  out.sessions = rows.map(r => ({
    rid: r.id, id: Date.parse(r.created_at), date: Date.parse(r.created_at), first: r.client_first_name || '',
    services: r.services, svcLabel: (r.choices && r.choices.svcLabel) || '', title: r.title || '', sub: r.subtitle || '',
    thumb: urls[r.render_path] || null, after: urls[r.after_path] || null, rating: r.rating, paths: [r.render_path, r.after_path].filter(Boolean),
  }));
  return out;
}

// Convertit les lignes du catalogue en structure de l'app
export function toCustom(items) {
  const custom = { colors: [], cuts: { f: [], h: [] } };
  for (const it of items) {
    if (it.kind === 'color') custom.colors.push({ id: appId(it.id), name: it.name, tone: it.tone, reflet: it.reflet ?? 0 });
    else custom.cuts[it.kind === 'cut_h' ? 'h' : 'f'].push({ id: appId(it.id), name: it.name, desc: it.description || '' });
  }
  return custom;
}

export async function saveProfile(patch) {
  const user = await currentUser(); if (!user) return;
  must(await sb.from('profiles').update(patch).eq('id', user.id));
}
export async function createSalon({ name, city, trade }) {
  const row = must(await sb.from('salons').insert({ name, city, trade }).select('id, name, city, trade').single());
  return row;
}
export async function updateSalon(id, patch) { must(await sb.from('salons').update(patch).eq('id', id)); }

export const newItemId = () => appId(crypto.randomUUID());
export async function saveItem(salonId, kind, item, position = 0) {
  const row = { id: dbId(item.id), salon_id: salonId, kind, name: item.name, position,
    description: kind === 'color' ? null : (item.desc || null), tone: kind === 'color' ? item.tone : null, reflet: kind === 'color' ? (item.reflet ?? 0) : null };
  must(await sb.from('catalog_items').upsert(row));
}
export async function deleteItem(id) { must(await sb.from('catalog_items').delete().eq('id', dbId(id))); }
export async function setHidden(salonId, key, isHidden) {
  if (isHidden) must(await sb.from('catalog_hidden').upsert({ salon_id: salonId, item_key: key }));
  else must(await sb.from('catalog_hidden').delete().eq('salon_id', salonId).eq('item_key', key));
}

const dataUrlToBlob = async u => (await fetch(u)).blob();
// Enregistre une session : photos (rendu retenu, photo après prestation) puis la ligne en base
export async function addSession(salonId, s) {
  const id = crypto.randomUUID(), paths = {};
  for (const [k, url] of [['render', s.thumb], ['after', s.after]]) {
    if (!url) continue;
    const path = `${salonId}/${id}/${k}.jpg`;
    must(await sb.storage.from(BUCKET).upload(path, await dataUrlToBlob(url), { contentType: 'image/jpeg', upsert: false }));
    paths[k] = path;
  }
  must(await sb.from('client_sessions').insert({
    id, salon_id: salonId, client_first_name: s.first || null, client_gender: s.gender || null, services: s.services || [],
    choices: { svcLabel: s.svcLabel }, title: s.title, subtitle: s.sub, render_path: paths.render || null, after_path: paths.after || null,
    rating: s.rating || null, consent_photo: true,
  }));
  return { rid: id, paths: Object.values(paths) };
}
export async function deleteSession(rid, paths) {
  if (paths && paths.length) await sb.storage.from(BUCKET).remove(paths);
  must(await sb.from('client_sessions').delete().eq('id', rid));
}
export async function clearSessions(salonId) {
  const rows = must(await sb.from('client_sessions').select('id, render_path, after_path').eq('salon_id', salonId));
  const paths = rows.flatMap(r => [r.render_path, r.after_path]).filter(Boolean);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  must(await sb.from('client_sessions').delete().eq('salon_id', salonId));
}
