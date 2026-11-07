/* =========================================================
   NITRO SURGE FIGHTERS — connexion à l'éditeur de poses (en ligne)
   Comptes gérés par Supabase : aucun mot de passe dans ce fichier.
   ========================================================= */
(() => {
'use strict';
const SB_URL = 'https://wjuqigklzbulqyewkdwe.supabase.co';
const SB_KEY = 'sb_publishable_YBogVNeEglj0LY0B4QxrnQ_E6VT9GNW';   // clé publique (lecture protégée par les règles de la base)
const EDITOR_URL = 'https://cameleon-ds.github.io/nitro-surge-fighters/editeur-poses.html';
const ONLINE = location.protocol !== 'file:';

const ICON = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
};

const css = `
.nsfa-ov { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 30%, #2a2036, #0e0c13 70%); font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #ece8f4; }
.nsfa-card { width: min(380px, 92vw); background: #1b1824; border: 1px solid #34303f; border-radius: 14px; padding: 26px 24px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.nsfa-card h2 { margin: 0 0 4px; font-size: 18px; }
.nsfa-card p.sub { margin: 0 0 18px; color: #9a93aa; font-size: 13px; }
.nsfa-card label { display: block; font-size: 12px; color: #9a93aa; margin: 12px 0 5px; }
.nsfa-card input { width: 100%; box-sizing: border-box; background: #23202e; color: #ece8f4; border: 1px solid #34303f; border-radius: 8px; padding: 10px 11px; font: inherit; }
.nsfa-card input:focus { outline: none; border-color: #ffb02e; }
.nsfa-card button.main { width: 100%; margin-top: 18px; padding: 11px; border: 0; border-radius: 8px; background: linear-gradient(180deg, #ffb02e, #ff6a1a); color: #1a1006; font-weight: 700; font: inherit; font-weight: 700; cursor: pointer; }
.nsfa-card button.main:disabled { opacity: .5; cursor: default; }
.nsfa-links { display: flex; justify-content: space-between; gap: 10px; margin-top: 14px; font-size: 13px; }
.nsfa-links a { color: #ffb02e; cursor: pointer; text-decoration: none; }
.nsfa-msg { margin-top: 12px; font-size: 13px; min-height: 1em; }
.nsfa-msg.err { color: #ff6a7a; } .nsfa-msg.ok { color: #4fd18b; }
.nsfa-logo { font-weight: 800; letter-spacing: .05em; font-size: 12px; color: #ffb02e; margin-bottom: 14px; }
.nsfa-pbtn { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #ffb02e; background: #2e2a3c; color: #ffb02e; font: 700 15px/1 -apple-system, BlinkMacSystemFont, sans-serif; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 0; }
.nsfa-pbtn:hover { background: #3a3450; }
.nsfa-menu { position: fixed; z-index: 999; min-width: 220px; background: #1b1824; border: 1px solid #34303f; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.5); padding: 6px; font: 13px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; color: #ece8f4; }
.nsfa-menu .who { padding: 8px 10px 9px; color: #9a93aa; font-size: 12px; border-bottom: 1px solid #34303f; margin-bottom: 4px; word-break: break-all; }
.nsfa-menu a { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 7px; color: #ece8f4; text-decoration: none; cursor: pointer; }
.nsfa-menu a:hover { background: #2e2a3c; }
.nsfa-menu svg { width: 16px; height: 16px; color: #9a93aa; }
`;
let styled = false;
function style() { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

let sb = null;
function client() {
  if (sb) return sb;
  if (!window.supabase || !window.supabase.createClient) throw new Error('La bibliothèque Supabase ne s\'est pas chargée (connexion internet ?).');
  sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return sb;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- écran de connexion ----------
function screen(mode, done, info) {
  style();
  let ov = document.querySelector('.nsfa-ov'); if (!ov) { ov = document.createElement('div'); ov.className = 'nsfa-ov'; document.body.appendChild(ov); }
  const T = {
    login: { t: 'Connexion', s: 'Éditeur de poses — accès réservé.', f: '<label>E-mail</label><input id="nsfa-mail" type="email" autocomplete="username" required><label>Mot de passe</label><input id="nsfa-pw" type="password" autocomplete="current-password" required>', b: 'Se connecter',
      l: '<a data-m="forgot">Mot de passe oublié ?</a><a data-m="setup">Première connexion</a>' },
    forgot: { t: 'Mot de passe oublié', s: 'Tu vas recevoir un e-mail avec un lien pour choisir un nouveau mot de passe.', f: '<label>E-mail</label><input id="nsfa-mail" type="email" autocomplete="username" required>', b: 'Envoyer le lien', l: '<a data-m="login">Retour à la connexion</a>' },
    recovery: { t: 'Nouveau mot de passe', s: 'Choisis ton nouveau mot de passe (10 caractères minimum).', f: '<label>Nouveau mot de passe</label><input id="nsfa-pw" type="password" autocomplete="new-password" minlength="10" required><label>Confirmer</label><input id="nsfa-pw2" type="password" autocomplete="new-password" minlength="10" required>', b: 'Enregistrer le mot de passe', l: '' },
    setup: { t: 'Première connexion', s: 'Crée ton mot de passe avec le code d\'installation reçu (à usage unique).', f: '<label>Code d\'installation</label><input id="nsfa-code" autocomplete="off" placeholder="NSF-XXXXXX-XXXXXX" required><label>Choisis ton mot de passe</label><input id="nsfa-pw" type="password" autocomplete="new-password" minlength="10" required><label>Confirmer</label><input id="nsfa-pw2" type="password" autocomplete="new-password" minlength="10" required>', b: 'Créer mon accès', l: '<a data-m="login">Retour à la connexion</a>' },
  }[mode];
  ov.innerHTML = `<form class="nsfa-card" novalidate><div class="nsfa-logo">NITRO SURGE FIGHTERS</div><h2>${T.t}</h2><p class="sub">${T.s}</p>${T.f}<button class="main" type="submit">${T.b}</button><div class="nsfa-msg ${info && info.err ? 'err' : 'ok'}">${info ? esc(info.msg) : ''}</div><div class="nsfa-links">${T.l}</div></form>`;
  const form = ov.querySelector('form'), msg = ov.querySelector('.nsfa-msg'), btn = ov.querySelector('button.main');
  const say = (m, err) => { msg.className = 'nsfa-msg ' + (err ? 'err' : 'ok'); msg.textContent = m; };
  ov.querySelectorAll('[data-m]').forEach(a => a.addEventListener('click', () => screen(a.dataset.m, done)));
  const first = ov.querySelector('input'); if (first) setTimeout(() => first.focus(), 30);
  form.addEventListener('submit', async e => {
    e.preventDefault(); btn.disabled = true; say('');
    const v = id => (ov.querySelector('#' + id) || {}).value || '';
    try {
      if (mode === 'login') {
        const { error } = await client().auth.signInWithPassword({ email: v('nsfa-mail').trim(), password: v('nsfa-pw') });
        if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou mot de passe incorrect.' : error.message);
        ov.remove(); done();
      } else if (mode === 'forgot') {
        const { error } = await client().auth.resetPasswordForEmail(v('nsfa-mail').trim(), { redirectTo: EDITOR_URL });
        if (error) throw new Error(error.message);
        say('Si ce compte existe, un e-mail vient d\'être envoyé. Pense à regarder dans les spams.');
      } else if (mode === 'recovery') {
        if (v('nsfa-pw').length < 10) throw new Error('10 caractères minimum.');
        if (v('nsfa-pw') !== v('nsfa-pw2')) throw new Error('Les deux mots de passe ne sont pas identiques.');
        const { error } = await client().auth.updateUser({ password: v('nsfa-pw') });
        if (error) throw new Error(error.message);
        history.replaceState(null, '', location.pathname);
        ov.remove(); done();
      } else if (mode === 'setup') {
        if (v('nsfa-pw').length < 10) throw new Error('10 caractères minimum.');
        if (v('nsfa-pw') !== v('nsfa-pw2')) throw new Error('Les deux mots de passe ne sont pas identiques.');
        const r = await fetch(SB_URL + '/functions/v1/setup-account', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify({ code: v('nsfa-code'), password: v('nsfa-pw') }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
        const { error } = await client().auth.signInWithPassword({ email: j.email, password: v('nsfa-pw') });
        if (error) throw new Error(error.message);
        ov.remove(); done();
      }
    } catch (err) { say(err.message || String(err), true); }
    btn.disabled = false;
  });
}

// ---------- bouton profil (N dans un cercle) ----------
function profileButton(host, user, opts = {}) {
  style();
  const b = document.createElement('button'); b.className = 'nsfa-pbtn'; b.type = 'button'; b.title = 'Profil';
  b.textContent = 'N';
  host.prepend(b);
  let menu = null;
  const close = () => { if (menu) { menu.remove(); menu = null; } };
  b.addEventListener('click', e => {
    e.stopPropagation(); if (menu) return close();
    const r = b.getBoundingClientRect();
    menu = document.createElement('div'); menu.className = 'nsfa-menu';
    menu.style.left = r.left + 'px'; menu.style.top = (r.bottom + 8) + 'px';
    menu.innerHTML = `<div class="who">Connecté : ${esc(user.email)}</div>` +
      (opts.editorLink ? `<a href="editeur-poses.html">${ICON.edit}Éditeur de poses</a>` : '') +
      `<a href="profil.html">${ICON.user}Mon profil</a><a data-out>${ICON.out}Déconnexion</a>`;
    menu.querySelector('[data-out]').addEventListener('click', async () => { if (opts.beforeLogout && opts.beforeLogout() === false) return; await client().auth.signOut(); location.reload(); });
    document.body.appendChild(menu);
  });
  addEventListener('click', e => { if (menu && !menu.contains(e.target)) close(); });
}

// ---------- appels à la fonction sécurisée ----------
async function call(action, payload = {}) {
  const { data: { session } } = await client().auth.getSession();
  if (!session) throw new Error('Session expirée : reconnecte-toi.');
  const r = await fetch(SB_URL + '/functions/v1/poses', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ action, ...payload }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
  return j;
}

// ---------- accès protégé ----------
function require() {
  return new Promise(resolve => {
    const c = client();
    let handled = false;
    const finish = async () => { if (handled) return; const { data: { user } } = await c.auth.getUser(); if (!user) return; handled = true; resolve(user); };
    const isRecovery = /type=recovery/.test(location.hash + location.search);
    c.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') screen('recovery', finish); });
    c.auth.getSession().then(({ data: { session } }) => {
      if (isRecovery) { if (!document.querySelector('.nsfa-ov')) screen('recovery', finish); return; }
      if (session) finish(); else screen('login', finish);
    });
  });
}

window.NSFAuth = { ONLINE, require, profileButton, call, client, esc };
})();
