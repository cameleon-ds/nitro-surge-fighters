/* =========================================================
   NITRO SURGE FIGHTERS — moteur de combat pixel art
   Résolution native 384x216, mise à l'échelle "pixelated"
   ========================================================= */
'use strict';
(() => {
const VERSION = 'v370';

let W = 384; const H = 216, GROUND = 190, GRAV = 0.34;
let CX = 192; // centre horizontal
const EXT = 50;            // le décor dépasse de 50 px de chaque côté : la caméra défile un peu
let SW = 384 + 2 * EXT;    // largeur totale du décor
const cv = document.getElementById('game');
let ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
// Calque haute définition sous le canvas pixel : les grandes images (écran titre, sélection) restent nettes, sans pixels
const HI = document.createElement('canvas'); HI.id = 'hi'; cv.parentNode.insertBefore(HI, cv);
const hx = HI.getContext('2d'); let hiUsed = false;

// Portrait sur mobile (ex. rotation verrouillée) : on pivote tout le jeu de 90°
let ROT = false, W_LOCK = null;
function syncW(w) { W_LOCK = w || null; resize(); }   // fixe (ou libère) la largeur de la scène
const app = document.getElementById('app');
function resize() {
  const touchDev = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || /[?&]touch/.test(location.search);
  let iw = innerWidth, ih = innerHeight;
  // iPhone (appli sur l'écran d'accueil, rotation verrouillée) : innerHeight est trop petit -> on prend la taille réelle de l'écran
  if (navigator.standalone && ih > iw) { const a = Math.min(screen.width, screen.height), b = Math.max(screen.width, screen.height); iw = a; ih = b; }
  ROT = touchDev && ih > iw;
  document.body.classList.toggle('rot', ROT);
  const aw = ROT ? ih : iw, ah = ROT ? iw : ih;
  app.style.width = aw + 'px'; app.style.height = ah + 'px';
  app.style.left = ROT ? iw + 'px' : '0px';
  // Plein écran : la largeur interne s'adapte au format de l'écran (16:9 → 21:9)
  const nw = W_LOCK || Math.max(384, Math.min(520, Math.round(H * aw / ah)));   // en ligne (SYNC) : même largeur de scène sur les deux téléphones
  if (nw !== W) {
    const old = W; W = nw; CX = W / 2; SW = W + 2 * EXT;
    cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
    if (typeof makeBG === 'function') { for (const k in STAGE_IMG) BGS[k] = buildStageBG(k); BG = BGS[(typeof G !== 'undefined' && G.stage) || 'dojo']; }
    if (typeof G !== 'undefined' && G.f) G.f.forEach(f => { f.x += (W - old) / 2; });
    if (typeof G !== 'undefined' && G.props) G.props.forEach(p => { p.x += (W - old) / 2; });
  }
  const s = Math.min(aw / W, ah / H);
  cv.style.width = Math.round(W * s) + 'px';
  cv.style.height = Math.round(H * s) + 'px';
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  HI.style.width = cv.style.width; HI.style.height = cv.style.height;
  HI.width = Math.round(W * s * dpr); HI.height = Math.round(H * s * dpr);
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 150));

/* ---------------- Utilitaires de dessin ---------------- */
const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };
function seg(a, b, w, col) {
  ctx.fillStyle = col;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const o = Math.floor(w / 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    ctx.fillRect(Math.round(a[0] + dx * t) - o, Math.round(a[1] + dy * t) - o, w, w);
  }
}
function disc(x, y, r, col) {
  ctx.fillStyle = col;
  x = Math.round(x); y = Math.round(y);
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6));
    ctx.fillRect(x - dx, y + dy, dx * 2 + 1, 1);
  }
}
function sDisc(x, y, r, col) {   // disque dessiné dans le sprite (basse résolution)
  sx.fillStyle = col;
  x = Math.round(x); y = Math.round(y); r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.6));
    sx.fillRect(x - dx, y + dy, dx * 2 + 1, 1);
  }
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Symboles PlayStation dessinés (la police n'a pas ✕ ○ □ △)
const PS_GLYPH = { '\u2715': ['x', '#7ab4ff'], '\u25CB': ['o', '#ff6a7a'], '\u25A1': ['s', '#ff9ae0'], '\u25B3': ['t', '#5ae0a8'] };
const PS_RE = /[\u2715\u25CB\u25A1\u25B3]/;
function psGlyph(kind, x, y, sz, col) {   // x, y : coin haut gauche d'une case sz x sz
  const c = sz / 2, r = sz * .38;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    if (kind === 'x') { ctx.moveTo(x + c - r, y + c - r); ctx.lineTo(x + c + r, y + c + r); ctx.moveTo(x + c + r, y + c - r); ctx.lineTo(x + c - r, y + c + r); }
    else if (kind === 'o') ctx.arc(x + c, y + c, r, 0, Math.PI * 2);
    else if (kind === 's') ctx.rect(x + c - r * .9, y + c - r * .9, r * 1.8, r * 1.8);
    else { ctx.moveTo(x + c, y + c - r * 1.05); ctx.lineTo(x + c + r * 1.05, y + c + r * .8); ctx.lineTo(x + c - r * 1.05, y + c + r * .8); ctx.closePath(); }
  };
  path(); ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, sz * .32); ctx.stroke();   // contour noir
  path(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, sz * .16); ctx.stroke();
  ctx.restore();
}
function text(s, x, y, size = 8, col = '#fff', align = 'left', out = '#000') {
  s = String(s);
  if (PS_RE.test(s)) {   // texte mêlé de symboles PlayStation : on dessine morceau par morceau
    ctx.font = size + 'px "Press Start 2P", monospace';
    const parts = s.split(/([\u2715\u25CB\u25A1\u25B3])/).filter(t => t !== ''), gw = size * 1.15;
    const wOf = t => PS_GLYPH[t] ? gw : ctx.measureText(t).width;
    const tot = parts.reduce((a, t) => a + wOf(t), 0);
    let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
    for (const t of parts) {
      if (PS_GLYPH[t]) { const a = ctx.globalAlpha, op = /rgba\(.*,\s*(\.?\d+)\)/.exec(col); if (op) ctx.globalAlpha = a * +op[1]; psGlyph(PS_GLYPH[t][0], cx + (gw - size) / 2, y, size, PS_GLYPH[t][1]); ctx.globalAlpha = a; }
      else text(t, cx, y, size, col, 'left', out);
      cx += wOf(t);
    }
    return;
  }
  ctx.font = size + 'px "Press Start 2P", monospace';
  ctx.textAlign = align; ctx.textBaseline = 'top';
  const o = Math.max(1, Math.round(size / 8));
  ctx.fillStyle = out;
  for (let ox = -o; ox <= o; ox++) for (let oy = -o; oy <= o + 1; oy++) {
    if (ox || oy) ctx.fillText(s, x + ox, y + oy);
  }
  ctx.fillStyle = col;
  ctx.fillText(s, x, y);
}

let seed = 1337;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ---------------- Décor : dojo + plateau en bois ---------------- */
function makeBG() {
  seed = 1337;
  const W = SW;   // le décor est dessiné sur toute la largeur de la scène
  const off = Math.round((W - 384) / 2);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const F = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) * k) | 0, gg = Math.min(255, ((n >> 8) & 255) * k) | 0, b = Math.min(255, (n & 255) * k) | 0;
    return `rgb(${r},${gg},${b})`;
  };

  // Mur en plâtre chaud
  F(0, 0, W, 132, '#d6bd92');
  for (let i = 0; i < 1400; i++) F(rnd() * W, rnd() * 132, 1, 1, rnd() < .5 ? '#cbb184' : '#e0caa2');

  // Panneaux shoji (gauche et droite)
  const shoji = (x0, w) => {
    F(x0, 22, w, 100, '#5a3820');
    F(x0 + 3, 25, w - 6, 94, '#f1e6c8');
    for (let y = 25; y < 119; y += 2) if ((y / 2) % 3 === 0) F(x0 + 3, y, w - 6, 1, '#f7eed6');
    for (let x = x0 + 3 + 12; x < x0 + w - 4; x += 13) F(x, 25, 2, 94, '#7a4e2c');
    for (let y = 25 + 15; y < 119; y += 16) F(x0 + 3, y, w - 6, 2, '#7a4e2c');
    F(x0 + 3, 25, w - 6, 1, '#fffaea');
  };
  g.save(); g.translate(off, 0);
  for (let n = 0; 18 - 98 * n > -off - 100; n++) shoji(18 - 98 * n, 82);
  for (let n = 0; 284 + 98 * n < W - off + 20; n++) shoji(284 + 98 * n, 82);

  // Alcôve centrale (tokonoma)
  F(140, 24, 104, 98, '#4a2c18');
  F(143, 27, 98, 92, '#8a6640');
  for (let i = 0; i < 300; i++) F(143 + rnd() * 98, 27 + rnd() * 92, 1, 1, rnd() < .5 ? '#7e5c38' : '#96714a');
  F(143, 27, 98, 4, '#5e3e22');
  // Rouleau suspendu avec un ensō
  F(176, 31, 32, 2, '#3a2010');
  F(178, 33, 28, 64, '#eee3c4');
  F(178, 33, 2, 64, '#d8cba6');
  F(176, 97, 32, 4, '#3a2010');
  F(174, 98, 4, 2, '#c9a860'); F(206, 98, 4, 2, '#c9a860');
  for (let a = 0.35; a < Math.PI * 2 - 0.2; a += 0.05) {
    const r = 9 + Math.sin(a * 3) * .6, th = a < 1.2 ? 1 : (a < 4 ? 3 : 2);
    F(192 + Math.cos(a) * r - th / 2, 60 + Math.sin(a) * r - th / 2, th, th, '#1a1414');
  }
  F(197, 82, 4, 4, '#b8261c'); F(198, 83, 2, 2, '#e04a3a');
  // Petite table basse + vase
  F(160, 112, 64, 4, '#3a2010'); F(162, 116, 4, 6, '#3a2010'); F(218, 116, 4, 6, '#3a2010');
  F(186, 102, 12, 10, '#26323e'); F(188, 100, 8, 2, '#26323e'); F(187, 103, 2, 7, '#3e5266');
  F(191, 90, 1, 10, '#3e5a2a'); F(188, 92, 4, 1, '#5c7e3a'); F(192, 88, 5, 1, '#5c7e3a');
  g.restore();

  // Poutres et piliers
  F(0, 0, W, 16, '#4a2c18'); F(0, 2, W, 2, '#6c4428'); F(0, 14, W, 3, '#2c180a');
  F(0, 16, W, 6, '#5a3820'); F(0, 21, W, 1, '#2c180a');
  const pillar = x => {
    F(x, 16, 14, 108, '#5c3a1e'); F(x + 2, 16, 3, 108, '#7c522c'); F(x + 11, 16, 3, 108, '#3e2410');
    for (let y = 20; y < 122; y += 6 + (rnd() * 6 | 0)) F(x + 6, y, 1, 3, '#4a2c16');
  };
  g.save(); g.translate(off, 0);
  for (let n = 0; 102 - 98 * n > -off - 20; n++) pillar(102 - 98 * n);
  [126, 244].forEach(pillar);
  for (let n = 0; 268 + 98 * n < W - off + 20; n++) pillar(268 + 98 * n);
  g.restore();

  // Lanternes en papier
  const lantern = x => {
    F(x, 16, 1, 18, '#2a1a0e');
    for (let r = 0; r < 18; r++) {
      const w = Math.round(Math.sin((r + 1) / 19 * Math.PI) * 9);
      F(x - w, 34 + r, w * 2 + 1, 1, r % 4 === 0 ? '#8c1810' : '#d8382a');
      F(x - w + 1, 34 + r, 2, 1, '#f06a52');
    }
    F(x - 4, 32, 9, 2, '#2a1a0e'); F(x - 4, 52, 9, 2, '#2a1a0e');
    F(x, 54, 1, 5, '#e0b040');
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, d = 12 + rnd() * 6;
      F(x + Math.cos(a) * d, 43 + Math.sin(a) * d, 1, 1, 'rgba(255,190,90,.35)');
    }
  };
  g.save(); g.translate(off, 0);
  for (let n = 0; 115 - 196 * n > -off; n++) lantern(115 - 196 * n);
  for (let n = 0; 257 + 196 * n < W - off; n++) lantern(257 + 196 * n);
  g.restore();

  // Plinthe
  F(0, 122, W, 10, '#3a2210'); F(0, 122, W, 1, '#6a4224'); F(0, 131, W, 1, '#20120a');

  // Plancher : lattes en perspective
  const top = 132, bot = 204, vy = -260, vx = W / 2, pw = 22;
  const k = (bot - vy) / (top - vy);
  const tones = ['#b47c46', '#a87240', '#bd8650', '#ae7844'];
  for (let y = top; y < bot; y++) {
    const s = (y - vy) / (top - vy);
    const depth = 0.72 + 0.3 * (y - top) / (bot - top);
    for (let i = -24; i <= 24; i++) {
      const x0 = vx + (i - .5) * pw * s, x1 = vx + (i + .5) * pw * s;
      const tone = tones[(i + 48) % 4];
      F(x0, y, x1 - x0 + 1, 1, shade(tone, depth));
      F(x0, y, 1, 1, shade('#5a3418', depth));
    }
  }
  // Grain du bois et joints de lattes
  for (let i = -24; i <= 24; i++) {
    for (let j = 0; j < 14; j++) {
      const y = top + 2 + rnd() * (bot - top - 4);
      const s = (y - vy) / (top - vy);
      const cx = vx + i * pw * s + (rnd() - .5) * pw * s * .7;
      const len = 3 + rnd() * 8 * s;
      F(cx, y, len, 1, shade('#7a4a24', 0.75 + 0.3 * (y - top) / (bot - top)));
    }
    const jy = top + 6 + rnd() * (bot - top - 12);
    const s = (jy - vy) / (top - vy);
    F(vx + (i - .5) * pw * s, jy, pw * s, 1, '#4a2a12');
  }
  // Reflet lumineux sur le vernis
  for (let y = 146; y < 162; y++) for (let x = 0; x < W; x++) {
    if (((x + y) & 3) === 0 && rnd() < .55 - Math.abs(y - 154) / 20) F(x, y, 1, 1, 'rgba(255,230,180,.25)');
  }
  // Bord avant du plateau
  F(0, 204, W, 2, '#d49a5c');
  F(0, 206, W, 10, '#4a2810');
  for (let x = 0; x < W; x += 32) { F(x, 206, 2, 10, '#2a160a'); F(x + 2, 206, 1, 10, '#6a3e1c'); }
  F(0, 213, W, 3, '#1e0f06');
  return c;
}
let BG = null;
const BGS = {};
// Décors dessinés à partir des images (fidèles aux illustrations) : mis à l'échelle sur la largeur de la scène,
// la ligne du sol de l'image est calée sur le sol du jeu
const STAGE_IMG = { dojo: ['stage_dojo.jpg', 650], city: ['stage_city.jpg', 652], temple: ['stage_temple.jpg', 668], hall: ['stage_hall.jpg', 668], terrace: ['stage_terrace.jpg', 660], alley: ['stage_alley.jpg', 630], ring: ['stage_ring.jpg', 722], lab: ['stage_lab.jpg', 676] };
const URBAN = ['city', 'terrace', 'alley', 'ring', 'lab'];   // décors urbains : poubelles, cônes, bouteilles
const STAGE_PIC = {};
// Chargement différé : seuls les logos, l'image titre et la musique du titre bloquent le démarrage ;
// portraits et décors se téléchargent ensuite en arrière-plan (prêts bien avant l'écran de sélection)
// Hasard du COMBAT (IA du CPU, poses de fin) : en ligne (mode SYNC), hasard à graine identique sur les deux téléphones ;
// sinon Math.random comme avant. Le hasard purement visuel (étincelles, éclairs, sang) reste Math.random.
const RNG = { s: 0, on: false };
function rngSeed(seed) { RNG.s = seed >>> 0; RNG.on = true; }
function rngOff() { RNG.on = false; }
function rand() {
  if (!RNG.on) return Math.random();
  let t = RNG.s = (RNG.s + 0x6D2B79F5) >>> 0;   // mulberry32
  t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
const LAZY = []; let lazyGo = false;
const lazySrc = (im, src) => { if (lazyGo) im.src = src; else LAZY.push([im, src]); };
function lazyStart() { if (lazyGo) return; lazyGo = true; LAZY.forEach(([im, src]) => { im.src = src; }); LAZY.length = 0; }
for (const k in STAGE_IMG) {
  const im = new Image();
  im.onload = () => { BGS[k] = buildStageBG(k); if (typeof G !== 'undefined' && G.stage === k) BG = BGS[k]; };
  lazySrc(im, STAGE_IMG[k][0] + '?v=104');
  STAGE_PIC[k] = im;
}
function buildStageBG(k) {
  const im = STAGE_PIC[k], floor = STAGE_IMG[k][1] / 768;
  if (!im || !im.complete || !im.naturalWidth) return URBAN.includes(k) ? makeCityBG() : makeBG();
  const c = document.createElement('canvas'); c.width = SW; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const sc = Math.max(SW / im.naturalWidth, (H + 32) / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
  let oy = Math.round(GROUND - floor * h);
  oy = Math.min(0, Math.max(H - h, oy));
  g.fillStyle = '#000'; g.fillRect(0, 0, SW, H);
  g.drawImage(im, (SW - w) / 2, oy, w, h);
  return c;
}

// Décor prolongé vers le haut pour le travelling d'ouverture : vraie image au-dessus quand elle existe, puis brume douce
const INTRO_TOP = 110; let IBG = null, IBG_KEY = '';
function introBG() {
  const key = G.stage + '|' + SW + '|' + (BG && BG.width);
  if (IBG && IBG_KEY === key) return IBG;
  IBG_KEY = key; IBG = document.createElement('canvas'); IBG.width = SW; IBG.height = H + INTRO_TOP;
  const g = IBG.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const im = STAGE_PIC[G.stage]; let y0 = INTRO_TOP;   // haut du contenu réel
  if (im && im.complete && im.naturalWidth && STAGE_IMG[G.stage]) {
    const floor = STAGE_IMG[G.stage][1] / 768, sc = Math.max(SW / im.naturalWidth, (H + 32) / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    const oy = Math.min(0, Math.max(H - h, Math.round(GROUND - floor * h)));
    g.drawImage(im, (SW - w) / 2, oy + INTRO_TOP, w, h); y0 = Math.max(0, oy + INTRO_TOP);
  }
  g.drawImage(BG, 0, INTRO_TOP);
  if (y0 > 0) {   // au-dessus : prolongement flou du haut de l'image
    const t = document.createElement('canvas'); t.width = 12; t.height = 2;
    const tg = t.getContext('2d'); tg.imageSmoothingEnabled = true; tg.drawImage(IBG, 0, y0, SW, 8, 0, 0, 12, 2);
    g.drawImage(t, 0, 0, 12, 1, 0, 0, SW, y0);
    for (let i = 0; i < 12; i++) { g.globalAlpha = 1 - (i + 1) / 13; g.drawImage(t, 0, 0, 12, 1, 0, y0 + i * 2, SW, 2); }   // fondu doux vers l'image
    g.globalAlpha = 1;
    const fade = g.createLinearGradient(0, 0, 0, y0); fade.addColorStop(0, 'rgba(0,0,0,.35)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade; g.fillRect(0, 0, SW, y0);
  }
  return IBG;
}
/* ---------------- Décor 2 : la ville la nuit (style Streets of Rage) ---------------- */
function makeCityBG() {
  seed = 4242;
  const W = SW, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const F = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
  // ciel de nuit
  const sky = g.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, '#06041a'); sky.addColorStop(.6, '#1c0f3a'); sky.addColorStop(1, '#3a1a4a');
  g.fillStyle = sky; g.fillRect(0, 0, W, 132);
  for (let i = 0; i < 120; i++) F(rnd() * W, rnd() * 60, 1, 1, rnd() < .3 ? '#fff6d8' : '#8a7ab0');
  // lune
  g.fillStyle = '#f4ecc8'; g.beginPath(); g.arc(W * .72, 26, 9, 0, 7); g.fill();
  g.fillStyle = '#1c0f3a'; g.beginPath(); g.arc(W * .72 + 4, 23, 8, 0, 7); g.fill();
  // gratte-ciel lointains
  for (let x = -10; x < W; ) {
    const w = 16 + rnd() * 26 | 0, h = 40 + rnd() * 60 | 0;
    F(x, 132 - h, w, h, '#120c2a');
    for (let wy = 132 - h + 4; wy < 126; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 4) if (rnd() < .28) F(wx, wy, 2, 2, rnd() < .5 ? '#d8b04a' : '#6a5a9a');
    x += w + (rnd() * 4 | 0);
  }
  // immeubles de briques au premier plan du fond
  for (let x = -20; x < W; ) {
    const w = 70 + rnd() * 50 | 0, top = 20 + rnd() * 40 | 0, br = rnd() < .5 ? '#4a2228' : '#3a2632';
    F(x, top, w, 132 - top, br);
    for (let yy = top; yy < 132; yy += 3) for (let xx = x + ((yy / 3) % 2) * 4; xx < x + w; xx += 8) F(xx, yy, 1, 1, '#2a1218');
    F(x, top, w, 3, '#2a1418'); F(x, top + 3, w, 1, '#5a3038');
    for (let wy = top + 10; wy < 104; wy += 18) for (let wx = x + 8; wx < x + w - 12; wx += 18) {
      const lit = rnd() < .45;
      F(wx - 1, wy - 1, 12, 13, '#1a0c10');
      F(wx, wy, 10, 11, lit ? '#e8b85a' : '#241830');
      if (lit) { F(wx, wy, 10, 2, '#fff0b0'); F(wx + 4, wy, 2, 11, '#a87a30'); }
      else F(wx + 4, wy, 2, 11, '#1a0c10');
    }
    // escalier de secours
    if (rnd() < .5) { const ex = x + w - 22; for (let ey = top + 22; ey < 110; ey += 18) { F(ex, ey, 18, 2, '#141418'); F(ex, ey - 8, 1, 8, '#141418'); F(ex + 17, ey - 8, 1, 8, '#141418'); } }
    x += w + 6;
  }
  // enseignes néon
  const neon = (x, y, txt, col) => {
    g.save(); g.font = '8px "Press Start 2P", monospace'; g.textBaseline = 'top';
    g.shadowColor = col; g.shadowBlur = 4; g.fillStyle = col; g.fillText(txt, x, y);
    g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = .55; g.fillText(txt, x, y); g.restore();
  };
  for (let x = 60; x < W - 60; x += 230) { neon(x, 70, 'BAR', '#ff3aa8'); neon(x + 110, 54, 'HOTEL', '#3af0ff'); }
  // trottoir et rue
  F(0, 124, W, 8, '#2a2630'); F(0, 124, W, 1, '#4a4450');            // bas des façades
  const top = 132, bot = 196;
  for (let y = top; y < bot; y++) {
    const k = (y - top) / (bot - top);
    F(0, y, W, 1, `rgb(${70 + k * 30 | 0},${68 + k * 28 | 0},${80 + k * 30 | 0})`);
  }
  for (let y = top + 6, s0 = 10; y < bot; y += s0, s0 += 2) F(0, y, W, 1, '#3e3a48');          // joints des dalles
  for (let x = 0; x < W; x += 28) for (let y = top; y < bot; y += 12) F(x + ((y / 12) % 2) * 14, y, 1, 12, '#4a4656');
  F(0, bot, W, 3, '#8a8698'); F(0, bot + 3, W, 2, '#3a3644');          // bordure
  F(0, bot + 5, W, H - bot - 5, '#16161e');                            // chaussée
  for (let x = 0; x < W; x += 40) F(x, 210, 20, 2, '#d8c040');
  // réverbères
  for (let x = 40; x < W; x += 170) {
    F(x, 40, 3, 92, '#18181e'); F(x, 40, 16, 3, '#18181e'); F(x + 12, 43, 8, 3, '#2a2a34');
    const lg = g.createRadialGradient(x + 16, 50, 1, x + 16, 120, 70);
    lg.addColorStop(0, 'rgba(255,220,140,.35)'); lg.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = lg; g.beginPath(); g.moveTo(x + 12, 46); g.lineTo(x - 30, 196); g.lineTo(x + 62, 196); g.lineTo(x + 20, 46); g.fill();
    F(x + 13, 46, 6, 2, '#fff2c0');
  }
  // bouche d'incendie
  for (let x = 120; x < W; x += 260) { F(x, 122, 6, 10, '#b8261c'); F(x - 1, 120, 8, 3, '#d8382a'); F(x - 2, 125, 10, 2, '#8a140e'); }
  return c;
}


/* ---------------- Personnages (designs originaux, pixel art « gros pixels ») ---------------- */
// Têtes 9x9 de profil (regard vers la droite).
// Cheveux : a bord · h ombre · H moyen · L reflet   Bandeau : b
// Peau : e bord · S ombre · s moyen · l reflet      k œil · m bouche
const HEAD_KAITO = [
  "..aaaaaa..",
  ".aHHLLHHa.",
  "aHHHHLLHHa",
  "aBBBBBBBBB",
  "abbbbbbbbb",
  "ahhSkssks.",
  "ahhSkssks.",
  "ahSssssss.",
  ".aSssssss.",
  "..Ssssmms.",
  "..eSSSSSe.",
];
const HEAD_SORA = [
  "..aaaaaa..",
  ".aHHLLHHa.",
  "aHHLLLLHHa",
  "aHHHHHHHHa",
  "ahHHHsHHHs",
  "ahhSkssks.",
  "ahhSkssks.",
  "ahSssssss.",
  ".aSssssss.",
  "..Ssssmms.",
  "..eSSSSSe.",
];

const HEAD_VESPER = [
  "..aaaaaa..",
  ".aHLLLHHa.",
  "aHHLLLHHHa",
  "aHHHHHHHha",
  "ahHHsHHsHh",
  "ahhScssch.",
  "ahhSssssh.",
  "ahbBnBBBh.",
  ".abBBnBBB.",
  "..bBBBnnb.",
  "...eBBBBe.",
];
const HEAD_VANE = [   // crâne d'extraterrestre chauve, grands yeux noirs, menton fin
  "..eeeeee..",
  ".eSssllse.",
  "eSssssllse",
  "eSssssslse",
  "eSsssssss.",
  "eSSSkkskk.",
  "eSSSkkskk.",
  "eSSsssSss.",
  ".eSsssss..",
  "..eSsss...",
  "...eSSe...",
];
const HEAD_GROG2 = [   // tête de Lord Vane : crâne gris, visage vert délavé, yeux noirs à pupille rouge, barbe mauve
  "..aaaaaa..",
  ".aHHHLLHa.",
  "aHHHHHLLHa",
  "ahHHHHHHLa",
  "eShhhhhhh.",
  "eSSSkkskk.",
  "eSSSkcskc.",
  "ebSsssSsB.",
  ".bBBSkSBb.",
  "..bBnBBnb.",
  "...bBnBb..",
  "....bbb...",
];
const HEAD_KAEL = [   // tête de Kaito rasée sur les côtés (la crête est dessinée à part)
  "..eeeeee..",
  ".eSsslsse.",
  "eSssssllse",
  "eSsssssssl",
  "eSsssssss.",
  "eSSSkssks.",
  "eSSSkssks.",
  "eSSssssss.",
  ".eSssssss.",
  "..Ssssmms.",
  "..eSSSSSe.",
];
const HEAD_GROG = [   // même tête que Kaito : cheveux gris acier, yeux rouges
  "..aaaaaa..",
  ".aHHLLHHa.",
  "aHHHHLLHHa",
  "aBBBBBBBBB",
  "abbbbbbbbb",
  "ahhScssck.",
  "ahhScssck.",
  "ahSssssss.",
  ".aSssssss.",
  "..Ssssmms.",
  "..eSSSSSe.",
];
const HEAD_GROG_BACK = [
  "..aaaaaa..",
  ".ahhhhhhha",
  "ahhHLLhhha",
  "ahhHLLhhha",
  "ahhhhhhhhh",
  "aaaaaaaaaa",
  "..SSSSSSS.",
  "..Sssssss.",
  "..Sssssss.",
  "..Sssssss.",
  "...SSSSS..",
];

const GROG_TORSO = [   // d'après le pixel art de Nizar
  "....oooooo..oooooo....",
  "..oommmmmdoodmmmmmoo..",
  ".ommmmmmmmddmmmmmmmmo.",
  "ommxmmmmmmddmmmmmmxmmo",
  "omxmmmmmmmmdmmmmmmmxmo",
  "ommmmmmmmmmdmmmmmmmmmo",
  "omdmmmmxmmmdmmmxmxmmdo",
  "omdmmmmmxmmdmmmmxmmmdo",
  ".odddddddddddddddddddo",
  ".omdmmmmmmmdmmmmmmdmo.",
  "..odmmddddmdddddmmdo..",
  "..odmmmmmmdmmmmxmmdo..",
  "..odmmddddddddmmmmdo..",
  "...odmmmmmdmmmxmmdo...",
  "...odmmmmmdmmmmmmdo...",
  "....oooooooooooooo....",
];
// Têtes vues de dos 3/4 (nuque, oreille et bord de la joue à l'avant)
const HEAD_KAITO_BACK = [
  "..aaaaaa..",
  ".aHHLLHHa.",
  "aHHHLLHHHa",
  "aBBBBBBBBB",
  "abbbnbbbbb",
  "ahHHhHHSks",
  "ahhHHhHSks",
  "ahhhhhhSss",
  ".ahhhhSsss",
  "..ahhhSss.",
  "...eSSSSe.",
];
const HEAD_SORA_BACK = [
  "..aaaaaa..",
  ".aHHLLHHa.",
  "aHHLLLLHHa",
  "aHHHLLHHHa",
  "aHHHHHHHHa",
  "ahHHhHHSks",
  "ahhHHhHSks",
  "ahhhhhhSss",
  ".ahhhhSsss",
  "..ahhhSss.",
  "...eSSSSe.",
];

// Palettes 4 tons : [bord, ombre, moyen, reflet]
const DEFS = [
  { name: 'HIRO', twinFb: true, style: 'tshirt', vneck: true, head: HEAD_KAITO, headBack: HEAD_KAITO_BACK, band: true, torn: false, hem: true,
    skin:  ['#7a3c1c', '#b8683a', '#e8a46a', '#ffd8a0'],
    hair:  { a: '#2a1a10', h: '#4a3020', H: '#6c4830', L: '#94704a' },
    bandP: ['#08080c', '#18181e', '#2c2c36', '#50505c'],
    top:   ['#8a94b0', '#b8c2dc', '#e4eaf6', '#ffffff'],
    legs:  ['#08080c', '#18181e', '#2e2e3a', '#4c4c5c'],
    belt:  ['#040406', '#121216', '#26262e', '#44444e'],
    glove: ['#08080c', '#18181e', '#2e2e3a', '#565664'],
    fb: ['#ffffff', '#a8f4ff', '#2fb4ff', '#1458c4'] },
  { name: 'AXEL', fireUpper: true, style: 'tshirt', vneck: true, head: HEAD_SORA, headBack: HEAD_SORA_BACK, braid: true, jeans: true, shoes: true,
    skin:  ['#6a3418', '#a45e34', '#d8945c', '#f8c48c'],
    hair:  { a: '#8a5a14', h: '#c08a24', H: '#ecc048', L: '#fff08a' },   // blond
    top:   ['#08080c', '#18181e', '#2e2e3a', '#4c4c5c'],                 // t-shirt noir (2e couleur : rouge)
    legs:  ['#16264a', '#2a4478', '#4a6eac', '#82a8dc'],                 // jean bleu
    belt:  ['#2e180a', '#4e2c14', '#704220', '#9a6436'],                 // ceinture cuir
    glove: ['#08080c', '#18181e', '#2e2e3a', '#565664'],                 // gants noirs (comme Kaito)
    fb: ['#ffffff', '#fff2a0', '#ff9c2c', '#c64812'] },
  { name: 'VESPER', style: 'tshirt', head: HEAD_VESPER, headBack: HEAD_SORA_BACK, braid: true, ponytail: true, neonV: true, female: true, techBelt: true, shoes: true, slim: true, sleeves: true, kit: 'vesper',
    skin:  ['#6a3e2c', '#b8826a', '#e8bea0', '#fce0c8'],
    eye:   '#5ae0e0',
    hair:  { a: '#1e0a3a', h: '#4a1e8a', H: '#7a3ad0', L: '#b07aff' },   // longue queue de cheval violette
    bandP: ['#06040c', '#140e22', '#24183a', '#3af0ff'],               // masque noir, liseré cyan
    top:   ['#140828', '#2e1656', '#4e2a8a', '#8a5ad0'],               // combinaison violette
    legs:  ['#0e0618', '#20123a', '#34205a', '#5a3a8a'],
    belt:  ['#0a0a12', '#1ab8e0', '#3af0ff', '#c8ffff'],               // ceinture futuriste néon cyan
    glove: ['#05050a', '#14141c', '#26263a', '#3af0ff'],
    shoe:  ['#08080e', '#22222e', '#3af0ff', '#1ab8e0'],               // bottes noires, semelle cyan
    fb: ['#ffffff', '#c8f8ff', '#3af0ff', '#c83aff'] },
  { name: 'GROG', style: 'tshirt', head: HEAD_GROG2, headBack: HEAD_GROG2, bareChest: true, torn: true, softNeck: true, size: 1.1, traps: true, minBelt: true, kit: 'grog',
    speed: .72, tough: .82, power: 1.12,
    skin:  ['#2c3a30', '#5a6e5e', '#80968a', '#a8bcaa'],               // vert délavé
    eye:   '#ff2a1a',                                                   // pupille rouge dans l'œil noir
    hair:  { a: '#24262c', h: '#4a4e56', H: '#6e737c', L: '#a4a8b0' },   // crâne gris
    bandP: ['#2a2032', '#4a3c56', '#6a5a78', '#8e7e9c'],               // barbe mauve délavé
    top:   ['#2c3a30', '#5a6e5e', '#80968a', '#a8bcaa'],               // torse nu
    legs:  ['#141518', '#26282c', '#3a3d42', '#55585e'],               // pantalon gris foncé déchiré
    belt:  ['#141518', '#26282c', '#26282c', '#3a3d42'],               // pas de ceinture : simple taille du pantalon
    glove: ['#08080c', '#18181e', '#2e2e3a', '#565664'],               // gants noirs
    fb: ['#ffffff', '#a8f4ff', '#2fb4ff', '#1458c4'] },
  { name: 'ZEPHYR', style: 'tshirt', vneck: true, head: HEAD_SORA, headBack: HEAD_SORA_BACK, kasa: true, tornTop: true, softNeck: true, flaps: true, sword: true, shoes: true, kit: 'zephyr',
    skin:  ['#6a3c24', '#b07650', '#e0aa80', '#fcd4b0'],
    hair:  { a: '#4a5262', h: '#8a92a4', H: '#c4ccda', L: '#ffffff' },   // cheveux argentés
    top:   ['#120804', '#24140a', '#3a2212', '#58361e'],               // kimono brun très foncé, un peu déchiré (mystique)
    legs:  ['#3a4048', '#8a929c', '#c4ccd4', '#eef2f6'],               // pantalon blanc cassé
    belt:  ['#0a1420', '#16263a', '#24405a', '#3a6080'],
    glove: ['#0a1420', '#16263a', '#24405a', '#3a6080'],
    shoe:  ['#0a1018', '#1a2836', '#d8b462', '#b8944a'],               // bottes bleu nuit, semelles beige (couleur du chapeau)
    fb: ['#ffffff', '#d8fbff', '#7ae8f0', '#2a9aaa'] },
  { name: 'NYX', style: 'tshirt', vneck: true, head: HEAD_SORA, headBack: HEAD_SORA_BACK, witchHat: true, hairDown: true, female: true, slim: true, sleeveless: true, thinArms: true, noAbs: true, softNeck: true, flaps: true, shoes: true, kit: 'nyx',
    skin:  ['#7a3c1c', '#b8683a', '#e8a46a', '#ffd8a0'],   // peau claire comme Hiro
    eye:   '#3a2418',
    hair:  { a: '#2a1238', h: '#6a3a8e', H: '#9a68c4', L: '#c8a2ec' },   // longs cheveux mauves
    top:   ['#14040a', '#360a1c', '#5a1630', '#86304a'],               // corset bordeaux
    flapP: ['#0c0c10', '#24242c', '#363642', '#4c4c5a'],               // jupe noire déchirée
    legs:  ['#08080a', '#16161a', '#24242a', '#36363e'],               // pantalon noir
    belt:  ['#08080a', '#1a1a20', '#2a2a32', '#3e3e48'],
    glove: ['#06060a', '#141418', '#24242c', '#3a3a44'],               // mitaines noires
    shoe:  ['#06060a', '#18181e', '#2a2018', '#1a140e'],               // bottes noires
    fb: ['#ffffff', '#ffb0e0', '#c83aff', '#6a0a8a'] },
  { name: 'KAEL', style: 'tshirt', head: HEAD_KAEL, headBack: HEAD_KAEL, mohawk: true, vest: true, sleeveless: true, bracer: true, bracerGlow: '#5af0ff', heavyBelt: true, shoes: true, softNeck: true, kit: 'kael',
    skin:  ['#6a3c24', '#b07250', '#dca07a', '#f8c8a0'],
    hair:  { a: '#3a0606', h: '#7a0e10', H: '#b81c1e', L: '#f04a3a' },   // crête rouge
    top:   ['#060608', '#121216', '#1e1e24', '#2e2e36'],               // débardeur noir
    vestP: ['#2a2a04', '#8a8e10', '#d4dc1c', '#f6ff6a'],               // gilet jaune fluo sans manches
    legs:  ['#0c100a', '#1c2216', '#2c3424', '#424e38'],               // pantalon cargo noir-kaki
    belt:  ['#1a0e06', '#3a2412', '#5a3a1e', '#7a5434'],
    armorP:['#2a2e36', '#5a6270', '#9aa4b4', '#e4ecf6'],               // gants high-tech
    glove: ['#2a2e36', '#5a6270', '#9aa4b4', '#e4ecf6'],
    shoe:  ['#1a0e06', '#4a2a14', '#2a1a0c', '#1a0e06'],               // bottes marron
    fb: ['#ffffff', '#c8f8ff', '#5af0ff', '#1a78d0'] },
  { name: 'LORD VANE', style: 'tshirt', head: HEAD_VANE, headBack: HEAD_VANE, cape: true, epaulettes: true, uniform: true, float: true, sleeves: true, shoes: true, softNeck: true, noAbs: true, kit: 'vane',
    tough: .9, power: 1.08,
    skin:  ['#2e3a4c', '#6a7a94', '#a8b8d0', '#dce8f6'],
    hair:  { a: '#2e3a4c', h: '#6a7a94', H: '#a8b8d0', L: '#dce8f6' },
    top:   ['#0a0e0a', '#1a221a', '#2a342a', '#3e4a3c'],
    capeP: ['#0e060c', '#24101c', '#3a1a2c', '#56283e'],
    legs:  ['#0a0e0a', '#1a221a', '#2a342a', '#3e4a3c'],
    belt:  ['#060606', '#121212', '#1e1e1e', '#2e2e2e'],
    glove: ['#2e3a4c', '#6a7a94', '#a8b8d0', '#dce8f6'],
    shoe:  ['#060608', '#141418', '#1e1e24', '#0e0e12'],
    fb: ['#ffffff', '#e0b0ff', '#8a2ad0', '#2a0a4a'] },
];

// Squelettes : [tête, cou, bassin, coudeAv, mainAv, coudeAr, mainAr, genouAv, piedAv, genouAr, piedAr]
const POSES = {
  idle0:   [3,-55, 1,-47, -1,-29, 9,-40, 14,-48, 4,-38, 9,-45, 7,-15, 11,0, -8,-14, -12,0],
  idle1:   [3,-54, 1,-46, -1,-28, 9,-39, 14,-47, 4,-37, 9,-44, 7,-14, 11,0, -8,-13, -12,0],
  walk0:   [4,-55, 2,-47, 0,-29, 6,-38, 11,-44, -5,-37, 0,-43, 8,-15, 12,0, -6,-14, -11,0],
  walk1:   [4,-57, 2,-49, 0,-31, 7,-40, 12,-46, -6,-38, -2,-44, 2,-16, 1,0, 5,-21, 1,-9],
  walk2:   [4,-55, 2,-47, 0,-29, 9,-39, 14,-45, -8,-36, -4,-42, -5,-14, -10,0, 8,-15, 12,0],
  walk3:   [4,-57, 2,-49, 0,-31, 7,-40, 12,-46, -6,-38, -2,-44, 5,-21, 1,-9, 2,-16, 1,0],
  jump:    [3,-58, 1,-50, 0,-34, 9,-44, 13,-51, 4,-42, 9,-48, 10,-30, 6,-20, 2,-27, -4,-18],
  punch0:  [3,-52, 1,-44, 0,-26, 6,-40, 9,-46, -4,-38, 0,-42, 10,-14, 16,0, -8,-12, -16,0],
  punch1:  [8,-51, 6,-43, 2,-26, 17,-44, 30,-45, -4,-38, 0,-42, 11,-14, 17,0, -9,-11, -18,0],
  kick0:   [-1,-55, -2,-47, -2,-30, 4,-42, 8,-48, -8,-40, -4,-46, 13,-42, 9,-30, -4,-15, -6,0],
  kick1:   [-9,-52, -8,-44, -3,-30, 0,-42, 4,-48, -12,-40, -8,-46, 20,-40, 42,-44, -4,-15, -7,0],
  fpunch0: [3,-52, 1,-44, 0,-26, 8,-40, 12,-46, -6,-38, -2,-42, 10,-14, 16,0, -8,-12, -16,0],
  fpunch1: [9,-51, 7,-43, 3,-26, 3,-40, 6,-46, 16,-45, 32,-46, 13,-14, 20,0, -5,-11, -12,0],
  fkick0:  [-2,-55, -3,-47, -2,-30, 4,-42, 8,-48, -8,-40, -4,-46, 6,-15, 9,0, 12,-42, 9,-29],
  fkick1:  [-10,-52, -9,-44, -3,-30, -2,-42, 2,-48, -14,-40, -10,-46, 5,-15, 8,0, 22,-40, 48,-44],
  gp0:     [2,-47, 0,-40, -2,-23, 8,-49, 16,-58, 6,-34, 10,-38, 10,-12, 14,0, -9,-9, -15,0],      // Axel : à moitié baissé, poing levé (vu de dos 3/4)
  gp1:     [13,-37, 10,-31, 0,-19, 16,-19, 19,-4, 2,-28, -3,-22, 15,-11, 19,0, -8,-6, -16,0],    // Axel : poing frappé au sol devant lui
  hatc:    [3,-55, 1,-47, -1,-29, 13,-55, 9,-64, 4,-38, 9,-45, 7,-15, 11,0, -8,-14, -12,0],     // Zephyr : main sur le chapeau
  special0:[-1,-52, -2,-44, -2,-26, -7,-34, -11,-30, -9,-35, -13,-31, 10,-13, 15,0, -9,-12, -16,0],
  special1:[6,-50, 4,-42, 1,-25, 15,-40, 26,-40, 13,-38, 24,-37, 11,-13, 18,0, -8,-11, -17,0],
  upper0:  [4,-46, 2,-38, 0,-22, 8,-30, 10,-24, 4,-30, 8,-36, 10,-12, 12,0, -6,-10, -10,0],
  upper1:  [3,-58, 2,-50, 0,-32, 6,-62, 8,-76, -4,-44, -2,-38, 8,-26, 6,-12, -3,-16, -6,-2],
  upper2:  [3,-58, 1,-50, 0,-34, 8,-56, 12,-66, -4,-44, -2,-38, 9,-30, 6,-20, 2,-26, -4,-18],
  hit:     [-4,-53, -4,-45, -2,-28, 2,-40, 6,-46, -8,-38, -4,-44, 6,-14, 10,0, -9,-13, -13,0],
  block:   [0,-52, -1,-44, -2,-26, 7,-40, 6,-52, 5,-42, 9,-52, 8,-13, 12,0, -8,-12, -14,0],
  scissor: [-2,-58, -2,-50, 0,-34, 8,-47, 15,-52, -8,-45, -15,-49, 14,-30, 31,-28, -7,-25, -19,-33],   // Kael : ciseau (jambe avant tendue, jambe arrière pliée)
  fjump:   [8,-54, 6,-46, 0,-30, 18,-46, 31,-47, -6,-42, -12,-37, 11,-22, 5,-12, -10,-25, -23,-19],   // Axel : poing tendu, jambe arrière tendue, jambe avant pliée
  slide:   [-21,-12, -14,-11, 0,-7, -10,-16, -4,-20, -17,-5, -24,-1, 13,-8, 31,-6, 8,-3, 17,0],   // glissade : allongé sur le dos, jambe avant tendue au ras du sol
  tuckG:   [2,-24, 1,-18, 0,-8, 8,-16, 10,-22, 4,-14, 8,-20, 9,-12, 5,-4, 4,-9, -1,-2],             // Grog : boule au ras du sol (roulades)
  jkick:   [-2,-58, -2,-50, 0,-34, 6,-44, 10,-50, -6,-42, -2,-48, 14,-26, 30,-18, 2,-28, -6,-24],
  jpunch:  [5,-56, 3,-48, 0,-33, 14,-42, 26,-34, -4,-42, 0,-48, 10,-28, 6,-18, 2,-27, -5,-20],
  crouch:  [5,-36, 3,-29, 0,-14, 10,-24, 14,-31, 5,-22, 10,-28, 12,-10, 14,0, -8,-6, -16,0],
  cblock:  [1,-35, 0,-28, -2,-14, 7,-25, 6,-36, 5,-26, 9,-36, 11,-10, 13,0, -8,-6, -16,0],
  cpunch:  [5,-37, 3,-30, 0,-15, 15,-30, 27,-31, -4,-23, -1,-28, 12,-10, 13,0, -8,-4, -16,0],
  ckick:   [-2,-33, -3,-27, -2,-12, 4,-20, 8,-12, -10,-20, -14,-8, 16,-5, 34,-2, -8,-4, -14,0],
  dive:    [-7,-60, -6,-52, 0,-36, -12,-46, -20,-54, 3,-48, 9,-55, 15,-24, 30,-6, 6,-38, -4,-30],
  gq0:     [2,-54, 1,-46, -1,-28, 6,-60, 10,-72, 2,-58, 6,-70, 8,-14, 12,0, -8,-13, -12,0],     // Grog : poings levés
  gq1:     [9,-36, 7,-29, 0,-14, 15,-19, 22,-2, 11,-17, 17,-2, 12,-10, 14,0, -8,-6, -16,0],          // poings au sol
  rampart: [0,-53, -1,-45, -2,-27, 11,-41, 7,-57, 10,-39, 13,-56, 8,-14, 12,0, -8,-13, -14,0],     // bras croisés devant
  rburst:  [4,-55, 2,-47, -1,-29, 15,-47, 24,-55, -6,-44, -13,-52, 9,-15, 13,0, -9,-14, -14,0],    // bras écartés
  crush0:  [2,-58, 1,-50, 0,-32, 6,-63, 9,-76, 1,-61, 4,-74, 8,-26, 6,-12, -3,-16, -6,-2],      // envol, bras au-dessus de la tête
  vgrab:   [1,-58, 0,-49, 0,-31, 10,-50, 21,-53, -6,-40, -10,-34, 2,-15, 2,0, 0,-15, -1,0],   // clone de Vane : debout comme au repos, bras tendu sur le cou de l'adversaire
  vidle:   [1,-57, 0,-49, 0,-31, -4,-40, -8,-34, -6,-40, -10,-34, 2,-15, 2,0, 0,-15, -1,0],   // Vane : pieds joints, mains dans le dos
  tatsu:   [1,-58, 0,-50, 0,-34, -7,-46, -13,-44, 6,-46, 12,-44, 14,-36, 30,-37, 3,-24, -3,-17],
  parry:   [2,-55, 0,-47, -1,-29, 10,-44, 16,-53, 8,-42, 15,-47, 8,-15, 12,0, -9,-14, -13,0],
  stunned: [-3,-52, -3,-44, -1,-28, 2,-36, 4,-29, -7,-36, -5,-29, 6,-14, 10,0, -8,-13, -12,0],
  throw0:  [4,-55, 2,-47, 0,-29, 14,-46, 22,-48, 10,-44, 20,-44, 8,-15, 13,0, -9,-14, -14,0],
  throwS:  [6,-51, 4,-43, 1,-27, 12,-35, 19,-25, 10,-33, 17,-23, 10,-13, 14,0, -9,-12, -14,0],
  throwT:  [-2,-56, -2,-48, -1,-30, -6,-60, -12,-68, -4,-58, -10,-66, 7,-15, 11,0, -9,-14, -13,0],
  tuck:    [2,-46, 1,-40, 0,-30, 8,-38, 10,-44, 4,-36, 8,-42, 9,-34, 5,-26, 4,-31, -1,-24],
  sho0:    [6,-38, 4,-31, 0,-15, 8,-24, 11,-18, -2,-25, 3,-28, 12,-10, 14,0, -8,-6, -16,0],   // shoryuken : accroupi, poing bas (de face)
  sbk1:    [0,-57, 0,-49, 0,-31, 6,-62, 7,-75, -8,-41, -6,-47, 7,-23, 5,-11, -2,-17, -3,-2],  // montée, complètement de dos, genou levé
  sbk2:    [0,-58, 0,-50, 0,-32, 6,-64, 6,-78, -8,-42, -7,-48, 6,-22, 4,-12, -1,-17, -2,-3],
  urB:     [5,-56, 3,-48, 1,-30, 9,-42, 13,-48, 11,-62, 18,-77, 8,-24, 6,-11, -3,-14, -6,-1],   // shoryuken : montée vue de dos, poing levé
  turnA:   [4,-56, 2,-48, 0,-31, 9,-44, 12,-50, 8,-54, 12,-62, 8,-26, 6,-14, -3,-16, -6,-4],   // rotation au sommet (encore de dos)
  turnB:   [3,-57, 1,-49, 0,-32, 7,-54, 10,-62, -4,-44, -3,-40, 8,-28, 6,-18, 0,-24, -5,-14],  // rotation (déjà de face)
  rup0:    [4,-38, 2,-31, -1,-15, 10,-24, 14,-31, -2,-22, 4,-18, 12,-10, 13,0, -8,-4, -16,0],
  rup1:    [4,-48, 3,-40, 0,-24, 9,-34, 13,-40, 8,-44, 14,-56, 10,-12, 12,0, -7,-8, -12,0],
  rup2:    [5,-56, 3,-48, 1,-30, 9,-42, 13,-48, 11,-62, 18,-77, 8,-15, 12,0, -8,-14, -12,0],
  rup3:    [4,-54, 2,-46, 0,-29, 9,-40, 13,-46, 8,-52, 12,-60, 8,-15, 12,0, -8,-14, -12,0],
  win:     [1,-57, 0,-49, 0,-30, 6,-58, 8,-71, -6,-40, -2,-32, 5,-15, 7,0, -6,-15, -8,0],
  fall:    [-14,-40, -9,-36, 2,-26, -6,-44, -12,-50, -14,-30, -18,-26, 10,-30, 18,-36, 12,-22, 20,-24],
  down:    [-24,-6, -17,-6, 0,-5, -14,-12, -8,-14, -20,-3, -26,-2, 9,-9, 18,-3, 10,-4, 20,-2],
};

// Axel : images intermédiaires du coup de poing au sol (le poing décrit un arc de cercle vers l'avant jusqu'au sol)
const GP_A0 = Math.atan2(-18, 16), GP_A1 = Math.atan2(27, 9), GP_R0 = 24, GP_R1 = 28;   // bras tendu en diagonale vers le haut et l'avant pendant la charge
const gpArc = k => { const a = GP_A0 + (GP_A1 - GP_A0) * k, r = GP_R0 + (GP_R1 - GP_R0) * k; return [a, r]; };
[.25, .5, .75].forEach((k, i) => {
  const A = POSES.gp0, B = POSES.gp1, P = A.map((v, j) => v + (B[j] - v) * k);
  const sh = [P[2], P[3]], [a, r] = gpArc(k);
  P[8] = sh[0] + Math.cos(a) * r; P[9] = sh[1] + Math.sin(a) * r;                       // poing sur l'arc
  P[6] = sh[0] + Math.cos(a - .35) * r * .52; P[7] = sh[1] + Math.sin(a - .35) * r * .52;   // coude
  POSES['gpI' + (i + 1)] = P;
});
const OUT = '#140c08';
// Les sprites sont dessinés en basse résolution puis agrandis x2 (pixels « gros »).
const K = 0.7, UP = 2;
const SPR = document.createElement('canvas');
SPR.width = 120; SPR.height = 86;
const sx = SPR.getContext('2d');
const ROLLC = document.createElement('canvas'); ROLLC.width = SPR.width; ROLLC.height = SPR.height;
const rx = ROLLC.getContext('2d');
const OX = 60, OY = 76;

const sR = (x, y, w, h, c) => { sx.fillStyle = c; sx.fillRect(Math.round(x), Math.round(y), w, h); };
function sPoly(pts, col) {
  sx.fillStyle = col;
  let y0 = Infinity, y1 = -Infinity;
  pts.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + .5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
      if (xb > xa) sx.fillRect(xa, y, xb - xa, 1);
    }
  }
}
const grow = (pts, k) => {
  const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
  return pts.map(p => { const dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * k, p[1] + dy / l * k]; });
};
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Membre musclé : bord sombre, ombre, ton moyen décalé vers la lumière, reflet vif
function limbT(a, b, w0, w1, bulge, pal) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const pass = (k, ox, oy, col, min) => {
    sx.fillStyle = col;
    for (let i = 0; i <= n; i++) {
      const t = i / n, w = w0 + (w1 - w0) * t + bulge * Math.sin(Math.PI * t);
      const s = Math.max(min, Math.round(w * k));
      if (s <= 0) continue;
      sx.fillRect(Math.round(a[0] + dx * t + ox * w) - (s >> 1), Math.round(a[1] + dy * t + oy * w) - (s >> 1), s, s);
    }
  };
  pass(1, 0, 0, pal[0], 1);
  pass(.75, .05, .07, pal[1], 1);
  pass(.55, -.12, -.16, pal[2], 1);
  if (Math.max(w0, w1) + bulge >= 3.5) pass(.2, -.26, -.3, pal[3], 1);
}
function fist(q, dir, glove, skin) {
  const x0 = Math.round(q[0]) - 2, y0 = Math.round(q[1]) - 2;
  sR(x0, y0, 5, 4, glove[1]);
  sR(x0, y0, 4, 2, glove[2]);
  sR(x0 + 1, y0, 1, 1, glove[3]);
  const fx = dir > 0 ? x0 + 3 : x0;
  sR(fx, y0, 2, 4, skin[2]);
  sR(fx, y0 + 3, 2, 1, skin[0]);
  sR(fx + (dir > 0 ? 1 : 0), y0, 1, 1, skin[3]);
}
// Baskets montantes en toile noire, bout et semelle blancs
function shoeP(q, dir, dark, P) {
  const x = Math.round(q[0]), y = Math.round(q[1]);
  const x0 = x - (dir > 0 ? 2 : 4);
  if (P && P.combat) {   // grosses rangers noires montantes
    const x1 = x - (dir > 0 ? 3 : 5);
    sR(x1, y - 5, 8, 4, dark ? '#050507' : '#101014');                          // tige
    sR(x1 + (dir > 0 ? 1 : 3), y - 5, 4, 1, dark ? '#1a1a20' : '#2e2e36');       // haut de la tige
    for (let i = 0; i < 1; i++) sR(x1 + (dir > 0 ? 2 : 4), y - 4 + i * 2, 2, 1, dark ? '#202026' : '#3a3a44');   // lacets
    sR(x1 + (dir > 0 ? 5 : 0), y - 3, 4, 2, dark ? '#16161a' : '#2a2a32'); sR(x1 + (dir > 0 ? 6 : 1), y - 3, 2, 1, dark ? '#2a2a32' : '#55555f');   // bout renforcé
    sR(x1 - (dir > 0 ? 0 : 1), y - 1, 10, 1, dark ? '#2a2a30' : '#4a4a54');     // semelle
    return;
  }
  if (P && P.hunt) {   // exactement les baskets de John, en noir et gris
    sR(x0, y - 4, 6, 3, dark ? '#0a0a0e' : '#16161c');                         // tige noire
    sR(x0 + (dir > 0 ? 1 : 2), y - 4, 3, 1, dark ? '#1c1c24' : '#34343e');     // reflet
    sR(x0 + (dir > 0 ? 4 : 0), y - 3, 3, 2, dark ? '#4a4c52' : '#7a7c84');     // bout gris
    sR(x0, y - 1, 7, 1, dark ? '#3e4046' : '#6a6c74');                         // semelle grise
    sR(x0 + 1, y - 3, 1, 1, '#8a8c94');                                        // œillet
    return;
  }
  if (P) {   // bottes (palette du personnage)
    sR(x0, y - 5, 6, 4, dark ? P[0] : P[1]); sR(x0 + (dir > 0 ? 1 : 2), y - 5, 3, 1, dark ? P[1] : '#4a4a5a');
    sR(x0, y - 1, 7, 1, dark ? P[3] : P[2]); return;
  }
  sR(x0, y - 4, 6, 3, dark ? '#0a0a0e' : '#16161c');          // tige noire
  sR(x0 + (dir > 0 ? 1 : 2), y - 4, 3, 1, dark ? '#1c1c24' : '#34343e');   // reflet
  sR(x0 + (dir > 0 ? 4 : 0), y - 3, 3, 2, dark ? '#b8b8b0' : '#f4f4ee');   // bout blanc
  sR(x0, y - 1, 7, 1, dark ? '#a8a8a0' : '#e8e8e0');          // semelle blanche
  sR(x0 + 1, y - 3, 1, 1, '#d8d8d0');                          // œillet
}
function shoeDown(q, dir, dark) {   // basket pointe vers le bas (Axel en plein shoryuken)
  const x0 = Math.round(q[0]) - 2, y = Math.round(q[1]) - 4;
  sR(x0, y, 4, 4, dark ? '#0a0a0e' : '#16161c');                            // tige
  sR(x0 + (dir > 0 ? 1 : 2), y, 1, 3, dark ? '#1c1c24' : '#34343e');        // reflet
  sR(x0, y + 4, 4, 3, dark ? '#b8b8b0' : '#f4f4ee');                         // bout blanc vers le bas
  sR(x0 + (dir > 0 ? 3 : 0), y + 1, 1, 6, dark ? '#a8a8a0' : '#e8e8e0');    // semelle sur le côté
}
function shoeTilt(q, dir, dark) {   // basket pointe vers le bas, inclinée vers l'arrière (jambe avant pliée du saut-poing d'Axel)
  for (let i = 0; i < 7; i++) {
    const xx = Math.round(q[0] - 2 - dir * i * .75), yy = Math.round(q[1]) - 4 + i;
    sR(xx, yy, 4, 1, i >= 4 ? (dark ? '#b8b8b0' : '#f4f4ee') : (dark ? '#0a0a0e' : '#16161c'));   // tige noire puis bout blanc
    sR(xx + (dir > 0 ? 3 : 0), yy, 1, 1, dark ? '#a8a8a0' : '#e8e8e0');                               // semelle
  }
}
function footP(q, dir, skin) {
  const x0 = Math.round(q[0]) - (dir > 0 ? 1 : 3), y = Math.round(q[1]);
  sR(x0 + (dir > 0 ? 0 : 2), y - 3, 3, 1, skin[1]);          // cheville
  sR(x0, y - 2, 5, 2, skin[1]);                              // pied (plante = dernière ligne)
  sR(x0 + (dir > 0 ? 0 : 1), y - 2, 4, 1, skin[2]);          // reflet
}

// ---- Retouches de sprites (dessinées dans Piskel) ----
// Par personnage et par pose : pixels remplacés dans la vue droite (R) et la vue gauche (L).
// p = couleurs, c = "x,y,couleur[,couleur 2e skin];..." (coordonnées du sprite 120 x 86) ; couleur '' = pixel effacé.
// a = couleurs du 2e skin (même personnage des deux côtés), quand elles diffèrent.
// Seuls les pixels retouchés sont ici : le reste de la pose (bandeau, cheveux animés...) reste dessiné par le code.
const SPR_PATCH = {"HIRO":{"special0":{"R":{"p":["","#8a94b0","#b8c2dc","#e4eaf6","#b8683a","#ffffff","#e8a46a","#ffd8a0","#7a3c1c","#2e2e3a","#18181e","#4c4c5c","#040406","#121216","#08080c"],"c":"51,46,0;65,46,1,1;66,46,1,1;52,47,2,2;53,47,2,2;54,47,2,2;55,47,2,2;56,47,3,3;64,47,3,3;65,47,2,2;66,47,2,2;67,47,1,1;55,48,3,3;56,48,3,3;60,48,4;62,48,1,1;64,48,5,5;65,48,3,3;66,48,3,3;67,48,1,1;56,49,3,3;61,49,1,1;62,49,2,2;63,49,2,2;64,49,5,5;66,49,3,3;67,49,1,1;50,50,1,1;54,50,2,2;56,50,3,3;57,50,2,2;60,50,6;61,50,2,2;66,50,2,2;67,50,1,1;50,51,1,1;51,51,3,3;54,51,2,2;56,51,3,3;57,51,3,3;58,51,2,2;59,51,2,2;60,51,2,2;66,51,2,2;67,51,1,1;50,52,7;51,52,6;52,52,4;53,52,8;54,52,1,1;59,52,7;60,52,7;61,52,6;63,52,6;65,52,2,2;67,52,1,1;49,53,9;50,53,9;51,53,8;52,53,9;53,53,9;54,53,9;55,53,6;57,53,7;58,53,7;59,53,6;60,53,6;61,53,6;62,53,6;63,53,6;64,53,1,1;65,53,2,2;66,53,1,1;48,54,10;49,54,11;50,54,9;51,54,8;53,54,11;54,54,9;55,54,9;56,54,7;57,54,6;58,54,6;59,54,6;60,54,6;61,54,6;62,54,6;63,54,4;66,54,1,1;47,55,10;48,55,10;49,55,7;50,55,8;53,55,9;54,55,11;55,55,9;56,55,6;57,55,6;58,55,6;59,55,6;60,55,6;61,55,6;62,55,4;63,55,4;64,55,1,1;47,56,10;48,56,7;49,56,6;50,56,6;51,56,8;52,56,8;54,56,9;55,56,10;56,56,10;57,56,4;58,56,4;59,56,4;60,56,4;61,56,4;62,56,4;47,57,10;48,57,4;49,57,6;50,57,8;51,57,6;54,57,10;55,57,10;56,57,10;57,57,8;58,57,8;47,58,8;48,58,4;49,58,6;50,58,8;51,58,4;54,58,10;55,58,10;48,59,8;49,59,4;50,59,0;51,59,8;60,59,12,9;61,59,12,9;62,59,12,9;63,59,12,9;65,59,0;51,60,0;52,60,0;53,60,9;61,60,12,9;62,60,12,9;63,60,12,9;53,61,13,10;61,61,12,9;59,62,12,9;60,62,12,9;61,64,14;61,65,14;54,66,11;60,66,14;61,66,14;64,66,10;59,67,14;60,67,14;59,68,14;64,68,14;65,68,14;61,69,0;64,69,14;62,70,0;62,71,0;48,72,9;64,72,14","a":["","#08080c","#18181e","#2e2e3a","#b8683a","#4c4c5c","#e8a46a","#ffd8a0","#7a3c1c","#2a0404","#4a0808"]},"L":{"p":["#8a94b0","","#b8c2dc","#e4eaf6","#ffffff","#7a3c1c","#b8683a","#e8a46a","#ffd8a0","#2e2e3a","#4c4c5c","#18181e","#121216","#040406","#26262e","#08080c"],"c":"53,46,0,0;54,46,0,0;68,46,1;52,47,0,0;53,47,2,2;54,47,2,2;55,47,3,3;63,47,3,3;64,47,2,2;65,47,2,2;66,47,2,2;67,47,2,2;52,48,0,0;53,48,3,3;54,48,3,3;55,48,4,4;56,48,2,2;57,48,0,0;58,48,5;59,48,6;63,48,3,3;64,48,3,3;66,48,4,4;67,48,3,3;52,49,0,0;53,49,3,3;55,49,4,4;56,49,2,2;57,49,2,2;58,49,0,0;63,49,3,3;64,49,2,2;65,49,3,3;52,50,0,0;53,50,2,2;58,50,2,2;60,50,7;62,50,2,2;63,50,3,3;64,50,2,2;65,50,2,2;66,50,4,4;68,50,0,0;69,50,0,0;52,51,0,0;53,51,2,2;59,51,2,2;60,51,2,2;61,51,2,2;62,51,3,3;63,51,3,3;64,51,2,2;65,51,2,2;67,51,3,3;68,51,3,3;69,51,0,0;52,52,0,0;54,52,2,2;56,52,7;57,52,6;58,52,7;59,52,8;60,52,8;62,52,3,3;63,52,2,2;64,52,2,2;65,52,0,0;66,52,5;67,52,6;68,52,7;69,52,8;53,53,0,0;54,53,2,2;55,53,0,0;56,53,7;57,53,7;58,53,7;59,53,7;60,53,7;61,53,8;62,53,8;63,53,5;64,53,7;65,53,9;66,53,9;67,53,9;69,53,9;70,53,9;53,54,0,0;55,54,2,2;56,54,6;57,54,7;58,54,7;59,54,7;60,54,7;61,54,7;62,54,7;63,54,8;64,54,9;65,54,9;66,54,10;68,54,5;69,54,9;70,54,10;71,54,11;55,55,0,0;56,55,6;57,55,6;58,55,7;59,55,7;60,55,7;61,55,7;62,55,7;63,55,7;64,55,9;65,55,10;66,55,9;67,55,7;68,55,8;69,55,5;70,55,8;71,55,11;72,55,11;56,56,2,2;57,56,6;58,56,6;59,56,6;60,56,6;61,56,6;62,56,6;63,56,11;64,56,11;65,56,9;66,56,8;67,56,5;68,56,5;69,56,7;70,56,7;71,56,8;72,56,11;59,57,2,2;60,57,3,3;61,57,5;62,57,5;63,57,11;64,57,11;65,57,11;66,57,7;69,57,5;70,57,7;71,57,6;72,57,11;64,58,11;65,58,11;66,58,7;68,58,6;69,58,5;70,58,7;71,58,6;72,58,5;55,59,12,9;56,59,13,10;57,59,13,10;58,59,13,10;59,59,13,10;65,59,5;69,59,1;70,59,6;71,59,5;54,60,13,10;55,60,12,9;56,60,13,10;57,60,13,10;58,60,13,10;59,60,12,9;66,60,9;67,60,1;68,60,1;69,60,1;56,61,12,9;57,61,14,11;58,61,13,10;59,61,13,10;66,61,12,9;67,61,1;58,62,11;59,62,13,10;60,62,13,10;61,62,9;66,62,1;58,63,11;59,63,11;60,63,11;57,64,14,11;58,64,15;57,65,11;58,65,15;65,65,10;55,66,11;59,66,15;65,66,10;60,67,15;54,68,15;55,68,15;59,68,11;60,68,15;55,69,15;58,69,1;59,69,1;60,69,11;57,70,1;57,71,1;71,71,1;71,72,9;71,73,11","a":["#08080c","","#18181e","#2e2e3a","#4c4c5c","#7a3c1c","#b8683a","#e8a46a","#ffd8a0","#4a0808","#2a0404","#6e1010"]}},"idle0":{"R":{"p":["","#e8a46a","#ffd8a0","#2e2e3a","#8a94b0","#b8683a","#7a3c1c","#18181e","#b8c2dc","#e4eaf6","#08080c","#44444e","#040406","#121216"],"c":"51,47,0;69,47,0;70,47,0;71,47,1;72,47,2;73,47,3;51,48,0;65,48,4,4;66,48,4,4;69,48,0;71,48,1;73,48,3;51,49,0;59,49,5;66,49,4,4;67,49,1;69,49,6;70,49,3;71,49,1;73,49,7;66,50,4,4;67,50,1;69,50,6;71,50,6;73,50,7;59,51,8,7;66,51,4,4;67,51,5;70,51,7;71,51,7;72,51,7;60,52,9,3;65,52,8,7;66,52,4,4;67,52,1;71,52,7;55,53,3;56,53,10;57,53,10;65,53,4,4;66,53,5;64,54,8,7;65,54,4,4;66,54,6;65,55,4,4;54,56,0;60,56,11,8;64,56,8,7;65,56,12,9;54,57,0;55,57,0;56,57,13,10;57,57,13,10;58,57,13,10;59,57,13,10;60,57,13,10;61,57,13,10;54,58,0;55,58,0;56,58,3;57,58,3;58,58,3;59,58,13,10;60,58,13,10;61,58,13,10;62,58,13,10;63,58,13,10;64,58,13,10;56,59,3;57,59,3;58,59,3;59,59,3;62,59,13,10;64,64,10;65,64,10;55,66,3;56,66,3;57,66,3;65,66,10;66,66,10;65,67,10","a":["","#e8a46a","#ffd8a0","#2e2e3a","#08080c","#b8683a","#7a3c1c","#18181e","#962222","#2a0404","#4a0808"]},"L":{"p":["#2e2e3a","","#b8c2dc","#e4eaf6","#7a3c1c","#8a94b0","#18181e","#e8a46a","#b8683a","#ffd8a0","#08080c","#040406","#44444e","#26262e","#121216","#4c4c5c"],"c":"46,47,0;49,47,1;50,47,1;51,47,1;53,47,2,2;54,47,3,0;68,47,1;46,48,0;50,48,1;51,48,4;53,48,5,4;54,48,5,4;67,48,5,4;68,48,1;46,49,6;49,49,0;50,49,4;51,49,7;52,49,7;53,49,5,4;60,49,8;61,49,9;67,49,5,4;68,49,1;46,50,6;50,50,4;51,50,9;52,50,7;53,50,5,4;47,51,6;48,51,6;49,51,6;51,51,7;52,51,8;53,51,5,4;59,51,2,2;60,51,2,2;61,51,7;48,52,6;52,52,7;53,52,5,4;54,52,2,2;59,52,3,0;63,52,6;48,53,4;53,53,8;54,53,5,4;59,53,3,0;62,53,10;63,53,10;64,53,0;53,54,4;54,54,5,4;55,54,2,2;62,54,4;64,54,8;54,55,5,4;55,55,2,2;59,55,3,0;65,55,8;54,56,11,8;55,56,2,2;58,56,6;59,56,12,9;65,56,1;66,56,1;54,57,11,8;56,57,13,10;57,57,12,9;58,57,14,11;59,57,14,11;60,57,14,11;61,57,14,11;62,57,14,11;63,57,14,11;64,57,1;65,57,1;66,57,1;54,58,14,11;55,58,14,11;56,58,14,11;57,58,14,11;58,58,14,11;59,58,14,11;61,58,0;62,58,0;63,58,0;64,58,1;65,58,1;66,58,1;56,59,13,10;57,59,14,11;58,59,11,8;60,59,0;61,59,0;62,59,0;63,59,0;64,59,1;57,60,6;62,60,15;63,60,0;54,63,10;55,63,14,11;54,64,10;55,64,10;63,65,15;64,65,0;53,66,10;54,66,10;62,66,0;63,66,0;64,66,0;54,67,10;63,67,15","a":["#2e2e3a","","#18181e","#7a3c1c","#08080c","#e8a46a","#b8683a","#ffd8a0","#2a0404","#962222","#6e1010","#4a0808","#4c4c5c"]}},"idle1":{"R":{"p":["#8a94b0","#b8683a","#e4eaf6","#e8a46a","#ffd8a0","#2e2e3a","","#7a3c1c","#18181e","#b8c2dc","#08080c","#26262e","#44444e","#040406"],"c":"65,47,0,0;66,47,0,0;59,48,1;60,48,1;61,48,1;63,48,1;64,48,2,2;65,48,2,2;71,48,3;72,48,4;73,48,5;59,49,4;65,49,0,0;66,49,0,0;69,49,6;70,49,5;71,49,3;73,49,5;59,50,1;63,50,3;66,50,0,0;67,50,3;68,50,4;69,50,7;70,50,8;71,50,3;73,50,8;66,51,0,0;67,51,3;69,51,7;71,51,7;72,51,7;73,51,8;59,52,9,7;60,52,9,7;62,52,9,7;66,52,0,0;67,52,1;69,52,3;72,52,8;73,52,6;60,53,2,2;63,53,2,2;64,53,2,2;66,53,0,0;67,53,3;69,53,1;71,53,8;55,54,5;56,54,10;57,54,10;58,54,9,7;63,54,9,7;64,54,9,7;65,54,0,0;66,54,1;67,54,1;68,54,1;70,54,7;63,55,2,2;65,55,0,0;66,55,7;69,55,7;71,55,6;58,56,9,7;63,56,9,7;64,56,9,7;65,56,0,0;66,56,7;67,56,7;68,56,7;70,56,6;51,57,6;52,57,6;53,57,6;54,57,6;55,57,11,8;60,57,12,9;61,57,8;62,57,8;63,57,2,2;64,57,9,7;65,57,13,10;66,57,6;67,57,6;68,57,6;69,57,6;54,58,6;55,58,6;56,58,8;57,58,8;58,58,8;59,58,8;60,58,8;61,58,8;65,58,13,10;54,59,6;55,59,6;56,59,5;57,59,8;62,59,10;63,59,10;64,59,10;62,60,10;64,65,10;65,65,10;56,66,5;57,66,5;58,66,5;55,67,5;58,67,8;65,67,10;50,72,5","a":["#08080c","#b8683a","#2e2e3a","#e8a46a","#ffd8a0","","#7a3c1c","#18181e","#6e1010","#962222","#2a0404"]},"L":{"p":["#8a94b0","#7a3c1c","#b8683a","#2e2e3a","#ffd8a0","#e8a46a","#b8c2dc","#e4eaf6","","#18181e","#08080c","#040406","#44444e","#26262e","#121216","#4c4c5c"],"c":"54,47,0,0;55,47,1;56,47,2;46,48,3;47,48,4;48,48,5;53,48,6,6;54,48,7,3;55,48,7,3;56,48,2;58,48,2;59,48,2;60,48,2;61,48,6,6;46,49,3;47,49,5;50,49,8;51,49,1;53,49,0,0;54,49,0,0;58,49,5;60,49,4;61,49,6,6;46,50,9;49,50,9;50,50,1;51,50,4;52,50,5;53,50,0,0;56,50,5;57,50,2;60,50,2;61,50,4;46,51,9;47,51,1;48,51,1;50,51,1;51,51,4;52,51,5;53,51,0,0;59,51,2;47,52,9;48,52,9;50,52,5;51,52,5;52,52,2;53,52,0,0;57,52,6,6;58,52,2;59,52,6,6;60,52,6,6;61,52,5;48,53,9;49,53,2;50,53,2;52,53,5;53,53,0,0;54,53,6,6;55,53,7,3;56,53,7,3;59,53,7,3;61,53,1;63,53,9;48,54,1;49,54,1;50,54,2;51,54,2;52,54,2;53,54,2;54,54,0,0;55,54,6,6;56,54,6,6;59,54,7,3;61,54,6,6;62,54,10;63,54,10;64,54,3;50,55,1;53,55,1;54,55,0,0;55,55,6,6;56,55,7,3;57,55,7,3;62,55,1;64,55,2;52,56,1;53,56,1;54,56,0,0;55,56,6,6;56,56,6,6;58,56,6,6;59,56,7,3;61,56,6,6;65,56,2;66,56,2;68,56,1;51,57,8;52,57,8;53,57,8;54,57,11,8;55,57,6,6;56,57,7,3;57,57,9;58,57,9;59,57,12,9;65,57,8;66,57,8;67,57,8;68,57,8;69,57,8;54,58,11,8;56,58,13,10;57,58,12,9;58,58,9;59,58,9;60,58,9;61,58,9;62,58,9;63,58,9;64,58,8;65,58,8;66,58,8;54,59,14,11;55,59,10;56,59,10;57,59,10;58,59,14,11;62,59,9;63,59,3;64,59,8;65,59,8;66,59,8;55,60,14,11;56,60,13,10;57,60,10;58,60,11,8;62,60,15;63,60,3;64,60,8;57,61,9;54,64,10;55,64,14,11;54,65,10;55,65,10;63,65,3;61,66,3;62,66,3;63,66,3;54,67,10;61,67,9;63,67,15;64,67,3;64,68,15;69,72,3;69,73,9","a":["#08080c","#7a3c1c","#b8683a","#2e2e3a","#ffd8a0","#e8a46a","#18181e","","#2a0404","#962222","#6e1010","#4a0808","#4c4c5c"]}}},"AXEL":{"fjump":{"R":{"p":["#2e2e3a","","#d8945c","#565664","#a45e34","#4c4c5c","#18181e","#6a3418","#08080c","#4e2c14","#2e180a","#d8b048","#16264a","#2a4478","#82a8dc","#4a6eac","#16161c","#34343e","#d8d8d0"],"c":"62,42,0,0;79,43,1;80,43,1;81,43,1;82,43,1;83,43,1;84,43,1;61,44,0,0;76,44,2;77,44,2;83,44,0;84,44,3;63,45,4;64,45,4;66,45,2;69,45,5,6;70,45,5,6;76,45,4;83,45,6;84,45,0;64,46,4;65,46,4;66,46,2;67,46,2;75,46,4;76,46,4;79,46,0;83,46,0;84,46,0;61,47,0,0;67,47,4;76,47,7;79,47,6;80,47,6;82,47,2;83,47,2;84,47,7;61,48,0,0;63,48,2;67,48,2;79,48,6;80,48,6;82,48,4;83,48,2;84,48,7;53,49,7;54,49,7;55,49,7;56,49,2;62,49,6,9;65,49,4;66,49,2;67,49,2;81,49,7;82,49,7;83,49,7;55,50,7;56,50,2;57,50,2;59,50,8,10;65,50,2;66,50,6,9;67,50,6,9;55,51,7;60,51,6,9;64,51,6,9;65,51,6,9;66,51,6,9;69,51,6,9;70,51,6,9;55,52,7;61,52,0,0;63,52,0,0;65,52,0,0;67,52,6,9;68,52,6,9;69,52,6,9;56,53,9;57,53,9;60,53,6,9;61,53,6,9;55,54,9;56,54,10;57,54,9;61,54,0,0;62,54,0,0;63,54,0,0;56,55,10;57,55,9;62,55,11;63,55,11;65,55,6,9;66,55,6,9;53,56,1;54,56,1;55,56,12;49,57,1;50,57,1;51,57,1;52,57,1;53,57,1;54,57,12;57,57,13;58,57,13;67,57,1;45,58,1;46,58,1;47,58,1;48,58,1;49,58,1;50,58,1;51,58,1;52,58,1;53,58,1;54,58,12;55,58,13;56,58,14;57,58,13;58,58,13;59,58,13;67,58,1;45,59,1;46,59,1;47,59,1;48,59,1;49,59,1;50,59,1;51,59,1;52,59,1;53,59,12;54,59,13;55,59,13;57,59,13;60,59,12;61,59,12;62,59,12;67,59,1;68,59,1;45,60,1;46,60,1;47,60,1;48,60,1;49,60,1;50,60,1;51,60,1;52,60,1;53,60,12;54,60,13;55,60,15;57,60,15;62,60,12;63,60,12;64,60,12;65,60,12;66,60,1;67,60,1;68,60,1;45,61,1;46,61,1;47,61,1;48,61,1;49,61,1;50,61,1;51,61,1;52,61,1;53,61,12;56,61,14;57,61,15;58,61,15;59,61,15;64,61,12;65,61,12;66,61,1;67,61,1;68,61,1;45,62,1;46,62,1;47,62,1;48,62,1;49,62,1;50,62,1;51,62,1;52,62,1;53,62,12;54,62,12;56,62,14;57,62,14;58,62,15;59,62,15;60,62,15;61,62,15;65,62,12;66,62,12;67,62,1;68,62,1;45,63,1;46,63,1;47,63,1;48,63,1;51,63,13;52,63,13;53,63,13;54,63,12;55,63,12;56,63,13;57,63,13;58,63,14;59,63,14;60,63,15;61,63,15;62,63,15;65,63,12;67,63,1;68,63,1;45,64,1;46,64,1;47,64,1;48,64,1;50,64,13;51,64,13;52,64,14;53,64,14;54,64,13;55,64,13;56,64,12;57,64,12;58,64,13;59,64,13;60,64,12;61,64,14;62,64,15;63,64,15;64,64,13;65,64,13;68,64,1;45,65,1;46,65,1;47,65,1;48,65,1;49,65,13;50,65,13;51,65,14;52,65,14;53,65,13;54,65,13;55,65,13;56,65,13;57,65,12;58,65,12;59,65,12;60,65,13;61,65,14;62,65,15;63,65,15;64,65,13;65,65,13;45,66,1;46,66,1;47,66,1;48,66,1;49,66,13;50,66,14;51,66,14;52,66,13;53,66,13;54,66,13;55,66,13;56,66,12;57,66,12;58,66,12;59,66,13;60,66,14;61,66,14;62,66,15;63,66,15;64,66,13;65,66,13;66,66,12;67,66,12;49,67,14;50,67,14;51,67,13;52,67,13;53,67,13;54,67,12;55,67,12;56,67,12;57,67,12;60,67,14;61,67,15;62,67,15;63,67,13;64,67,13;65,67,12;66,67,12;49,68,14;50,68,13;51,68,13;52,68,13;53,68,13;54,68,12;55,68,12;59,68,14;60,68,15;61,68,15;62,68,13;63,68,13;64,68,13;65,68,12;48,69,16;49,69,17;50,69,13;51,69,13;52,69,12;53,69,12;54,69,12;59,69,16;60,69,17;61,69,17;62,69,13;63,69,13;64,69,12;47,70,16;48,70,16;49,70,18;50,70,16;51,70,12;52,70,12;53,70,12;58,70,16;59,70,16;60,70,18;61,70,16;62,70,13;63,70,12;64,70,12;46,71,18;47,71,16;48,71,16;49,71,16;50,71,16;51,71,16;57,71,18;58,71,16;59,71,16;60,71,16;61,71,16;62,71,16;47,72,18;48,72,16;49,72,16;50,72,16;51,72,16;52,72,18;58,72,18;59,72,16;60,72,16;61,72,16;62,72,16;63,72,18;48,73,18;49,73,16;50,73,16;51,73,18;52,73,18;59,73,18;60,73,16;61,73,16;62,73,18;63,73,18;49,74,18;50,74,18;51,74,18;52,74,18;60,74,18;61,74,18;62,74,18;63,74,18;50,75,18;51,75,18;61,75,18;62,75,18","a":["#d8302a","","#d8945c","#2e2e3a","#565664","#a45e34","#ff7058","#18181e","#6a3418","#9a1818","#5a0c0c","#4e2c14","#2e180a","#d8b048","#16264a","#2a4478","#82a8dc","#4a6eac","#16161c","#34343e","#d8d8d0"]},"L":{"p":["#2e2e3a","","#565664","#f8c48c","#d8945c","#08080c","#18181e","#a45e34","#4c4c5c","#6a3418","#4e2c14","#2e180a","#d8b048","#fff0a0","#16264a","#2a4478","#82a8dc","#4a6eac","#34343e","#16161c","#d8d8d0"],"c":"57,42,0,0;36,43,1;37,43,1;38,43,1;39,43,1;40,43,1;35,44,2;36,44,0;37,44,0;40,44,3;42,44,4;43,44,4;49,44,5,6;56,44,3;57,44,6,7;58,44,0,0;59,44,0,0;35,45,0;36,45,6;37,45,6;40,45,4;43,45,7;48,45,3;49,45,8,10;50,45,8,10;52,45,9;53,45,4;55,45,7;56,45,7;57,45,6,7;58,45,6,7;35,46,0;36,46,0;37,46,6;40,46,0;43,46,7;44,46,7;49,46,0,0;50,46,0,0;52,46,4;53,46,4;54,46,7;55,46,7;58,46,6,7;35,47,9;36,47,4;37,47,4;39,47,6;40,47,6;43,47,9;52,47,7;53,47,7;57,47,6,7;58,47,0,0;35,48,9;36,48,4;37,48,7;38,48,9;39,48,6;40,48,6;52,48,4;54,48,7;55,48,4;56,48,4;57,48,6,7;58,48,0,0;63,48,7;65,48,3;36,49,9;37,49,9;38,49,9;52,49,4;53,49,4;54,49,7;55,49,7;57,49,6,7;58,49,0,0;62,49,7;64,49,9;65,49,9;66,49,9;52,50,6,7;53,50,6,7;54,50,4;60,50,5,6;62,50,4;64,50,9;66,50,4;49,51,6,7;50,51,6,7;53,51,6,7;54,51,6,7;55,51,6,7;56,51,6,7;64,51,9;50,52,6,7;51,52,6,7;52,52,6,7;53,52,6,7;54,52,0,0;56,52,0,0;57,52,0,0;62,52,9;64,52,9;65,52,4;52,53,6,7;56,53,6,7;57,53,0,0;58,53,6,7;59,53,6,7;61,53,6,7;62,53,10;63,53,10;64,53,9;53,54,6,7;55,54,0,0;57,54,0,0;58,54,0,0;62,54,10;63,54,11;65,54,1;53,55,6,7;54,55,6,7;55,55,0,0;56,55,12;57,55,12;63,55,11;65,55,1;53,56,5,6;56,56,13;57,56,12;64,56,14;65,56,1;66,56,1;53,57,11;61,57,15;62,57,15;65,57,14;66,57,1;67,57,1;68,57,1;69,57,1;70,57,1;52,58,1;53,58,11;59,58,15;60,58,15;61,58,15;62,58,15;63,58,16;64,58,15;65,58,14;66,58,1;67,58,1;68,58,1;69,58,1;70,58,1;71,58,1;72,58,1;73,58,1;74,58,1;51,59,1;52,59,1;53,59,11;56,59,15;57,59,14;58,59,14;59,59,14;60,59,15;61,59,15;62,59,15;64,59,15;65,59,15;66,59,14;67,59,1;68,59,1;69,59,1;70,59,1;71,59,1;72,59,1;73,59,1;74,59,1;51,60,1;52,60,1;53,60,1;54,60,14;55,60,14;57,60,14;62,60,17;64,60,17;65,60,15;66,60,14;67,60,1;68,60,1;69,60,1;70,60,1;71,60,1;72,60,1;73,60,1;74,60,1;51,61,1;52,61,1;53,61,1;54,61,14;55,61,14;60,61,17;61,61,17;62,61,17;63,61,16;66,61,14;67,61,1;68,61,1;69,61,1;70,61,1;71,61,1;72,61,1;73,61,1;74,61,1;51,62,1;52,62,1;53,62,14;54,62,14;58,62,17;59,62,17;60,62,17;61,62,17;62,62,16;63,62,16;65,62,14;66,62,14;67,62,1;68,62,1;69,62,1;70,62,1;71,62,1;72,62,1;73,62,1;74,62,1;51,63,1;52,63,1;54,63,14;57,63,17;58,63,17;59,63,17;60,63,16;61,63,16;62,63,15;63,63,15;64,63,14;65,63,14;66,63,15;67,63,15;68,63,15;71,63,1;72,63,1;73,63,1;74,63,1;51,64,1;54,64,15;55,64,15;56,64,17;57,64,17;58,64,16;59,64,14;60,64,15;61,64,15;62,64,14;63,64,14;64,64,15;65,64,15;66,64,16;67,64,16;68,64,15;69,64,15;71,64,1;72,64,1;73,64,1;74,64,1;52,65,14;54,65,15;55,65,15;56,65,17;57,65,17;58,65,16;59,65,15;60,65,14;61,65,14;62,65,14;63,65,15;64,65,15;65,65,15;66,65,15;67,65,16;68,65,16;69,65,15;70,65,15;71,65,1;72,65,1;73,65,1;74,65,1;52,66,14;53,66,14;54,66,15;55,66,15;56,66,17;57,66,17;58,66,16;59,66,16;60,66,15;61,66,14;62,66,14;63,66,14;64,66,15;65,66,15;66,66,15;67,66,15;68,66,16;69,66,16;70,66,15;71,66,1;72,66,1;73,66,1;74,66,1;53,67,14;54,67,14;55,67,15;56,67,15;57,67,17;58,67,17;59,67,16;62,67,14;63,67,14;64,67,14;65,67,14;66,67,15;67,67,15;68,67,15;69,67,16;70,67,16;54,68,14;55,68,15;56,68,15;57,68,15;58,68,17;59,68,17;60,68,16;64,68,14;65,68,14;66,68,15;67,68,15;68,68,15;69,68,15;70,68,16;55,69,14;56,69,15;57,69,15;58,69,18;59,69,18;60,69,19;65,69,14;66,69,14;67,69,14;68,69,15;69,69,15;70,69,18;71,69,19;55,70,14;56,70,14;57,70,15;58,70,19;59,70,20;60,70,19;61,70,19;66,70,14;67,70,14;68,70,14;69,70,19;70,70,20;71,70,19;72,70,19;57,71,19;58,71,19;59,71,19;60,71,19;61,71,19;62,71,20;68,71,19;69,71,19;70,71,19;71,71,19;72,71,19;73,71,20;56,72,20;57,72,19;58,72,19;59,72,19;60,72,19;61,72,20;67,72,20;68,72,19;69,72,19;70,72,19;71,72,19;72,72,20;56,73,20;57,73,20;58,73,19;59,73,19;60,73,20;67,73,20;68,73,20;69,73,19;70,73,19;71,73,20;56,74,20;57,74,20;58,74,20;59,74,20;67,74,20;68,74,20;69,74,20;70,74,20;57,75,20;58,75,20;68,75,20;69,75,20","a":["#d8302a","","#565664","#2e2e3a","#f8c48c","#d8945c","#5a0c0c","#9a1818","#18181e","#a45e34","#ff7058","#6a3418","#4e2c14","#2e180a","#d8b048","#fff0a0","#16264a","#2a4478","#82a8dc","#4a6eac","#34343e","#16161c","#d8d8d0"]}}}};
const patchCellsC = new Map();
function patchCells(pt) { let c = patchCellsC.get(pt); if (!c) { c = pt.c.split(';').map(s => s.split(',').map(Number)); patchCellsC.set(pt, c); } return c; }
function applySprPatch(d, pn, dir) {
  const P = SPR_PATCH[d.name] && SPR_PATCH[d.name][pn], pt = P && (dir > 0 ? P.R : P.L); if (!pt) return;
  const alt = d.alt && pt.a;
  for (const [x, y, i, j] of patchCells(pt)) {
    const col = alt && j != null ? pt.a[j] : pt.p[i];
    if (!col) sx.clearRect(x, y, 1, 1); else { sx.fillStyle = col; sx.fillRect(x, y, 1, 1); }
  }
}

function drawFighter(f, x = f.x, y = f.y) {
  const d = f.def, PN = poseOf(f), P = POSES[PN];
  let swE = null, swH = null;
  const spinning = (f.state === 'zdash' && f.t >= 3) || (f.state === 'tatsu' && f.t >= 4) || (f.state === 'gtatsu' && f.t >= 6 && f.t < 54) || (f.state === 'tornado' && f.t >= 3 && f.vy < 0);
  const dir0 = spinning && ((f.t >> 2) & 1) ? -f.dir : f.dir;
  const mir = d.kit === 'grog' && dir0 < 0, dir = mir ? 1 : dir0;   // Grog : vers la gauche = miroir exact du dessin vers la droite
  // Regard vers la droite : vue de face 3/4 · regard vers la gauche : vue de dos 3/4
  const upRise = f.state === 'uppercut' && (f.apexT == null || f.t - f.apexT < 4);
  const backView = f.state === 'rupper' || (upRise && f.t >= 3) || f.state === 'axgp' || (f.state === 'nsuper' && superKit(f) === 'axel' && f.t >= 12);   // Axel : frappe au sol vue de dos 3/4
  const fullBack = upRise && f.t >= 6;   // shoryuken en montée : complètement de dos, bras levé du côté de l'adversaire   // l'uppercut accroupi est vu de dos, bras proche levé
  sx.clearRect(0, 0, SPR.width, SPR.height);
  // Jambes plus courtes que le haut du corps (proportions trapues)
  const Q = P.slice(), LF = .82, px0 = Q[4], py0 = Q[5];
  if (G.clash && G.clash.f && G.clash.f.includes(f.real || f)) {   // bras de fer : les bras tremblent vite, de plus en plus fort
    const C = G.clash, ten = Math.min(1, Math.max(C.g[0], C.g[1]) / 100), amp = 1 + 2.5 * ten, ph = (f.clashPh != null ? f.clashPh : G.frame) * 1.7 + (f.id || 0) * 1.3, a = Math.sin(ph) * amp;
    Q[7] += a * .5; Q[9] += a; Q[11] -= a * .5; Q[13] -= a; Q[6] += a * .3; Q[8] += a * .5;
  }
  if (['idle', 'parry', 'stunned', 'win'].includes(f.state)) { Q[18] += 4; Q[19] += 1; Q[14] += 4; Q[15] += 1; }   // jambes avant et arrière légèrement pliées vers l'avant
  const footBefore = Math.max(Q[17], Q[21]);
  for (const i of [7, 8, 9, 10]) { Q[i * 2] = px0 + (Q[i * 2] - px0) * LF; Q[i * 2 + 1] = py0 + (Q[i * 2 + 1] - py0) * LF; }
  const lift = footBefore - Math.max(Q[17], Q[21]);
  for (let i = 1; i < Q.length; i += 2) Q[i] += lift;
  if (d.size) for (let i = 0; i < Q.length; i++) Q[i] *= d.size;   // colosse : plus grand
  if (d.kit === 'grog' && f.state === 'idle') { const up = poseOf(f) === 'idle1'; Q[1] += up ? 1.4 : 0; Q[0] += up ? .6 : 0; }   // Grog : la tête bouge aussi légèrement pendant la respiration
  if (d.upper) for (const i of [0, 1, 3, 4, 5, 6]) { Q[i * 2] = Q[4] + (Q[i * 2] - Q[4]) * d.upper; Q[i * 2 + 1] = Q[5] + (Q[i * 2 + 1] - Q[5]) * d.upper; }   // buste plus imposant
  const pt = i => [OX + dir * Q[i * 2] * K, OY + Q[i * 2 + 1] * K];
  let [h, n, p, fe, fh, be, bh, fk, ff, bk, bf] = [0,1,2,3,4,5,6,7,8,9,10].map(pt);
  const sk = d.skin, top = d.top, legs = d.legs;
  const dim = pal => [pal[0], pal[0], pal[1], pal[1]];   // membre éloigné de la caméra, dans l'ombre
  const tshirt = d.style === 'tshirt';

  let ux = p[0] - n[0], uy = p[1] - n[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const fwd = [uy * dir, -ux * dir];
  const sh = add(n, [ux, uy], 1);
  // épaules écartées : avant (côté adversaire) et arrière (côté caméra)
  // marche : les épaules suivent les bras (l'épaule du bras qui avance avance aussi), le buste pivote
  const walking = f.state === 'walk' && !d.float;   // Vane glisse sans marcher
  const rs = walking ? -Math.sin(f.walkPh || 0) : 0, RK = 2.6;
  const sdA = add(sh, fwd, (d.bulk ? 7 : 3.5) + RK * rs), sdB = add(sh, fwd, (d.bulk ? -9 : -4.5) - RK * rs);   // colosse : épaules très larges
  if (walking) {
    // épaule du premier plan abaissée au niveau de l'autre
    sdB[1] = Math.max(sdB[1], sdA[1]);
    // bras qui pivotent depuis l'épaule, à l'opposé de la jambe du même côté ; avant-bras plié
    const ph = f.walkPh || 0, AMP = .5, BEND = .85, L1 = 6.6, L2 = 6.2;
    const swingArm = (sd, th) => {
      const e = [sd[0] + dir * L1 * Math.sin(th), sd[1] + L1 * Math.cos(th)];
      return [e, [e[0] + dir * L2 * Math.sin(th + BEND), e[1] + L2 * Math.cos(th + BEND)]];
    };
    [fe, fh] = swingArm(sdA, -AMP * Math.sin(ph));
    [be, bh] = swingArm(sdB, AMP * Math.sin(ph));
  }
  // en marchant, les deux épaules à la même hauteur (l'épaule du premier plan descend au niveau de l'autre)
  const shY = walking ? Math.max(sdA[1], sdB[1]) + .5 : null;
  if (shY != null) { sdA[1] = shY; sdB[1] = shY; }
  if (fullBack) {   // de dos : épaules symétriques, à la même hauteur
    const a2 = add(sh, fwd, 5.5), b2 = add(sh, fwd, -5.5);
    sdA[0] = a2[0]; sdA[1] = a2[1]; sdB[0] = b2[0]; sdB[1] = a2[1];
  }

  const drawBand = () => {
    if (!d.band) return;
    const knot = backView ? [h[0] - dir * 1, h[1] - 2] : [h[0] - dir * 4, h[1] - 2];
    const speed = Math.min(1, Math.abs(f.vx) / 2.5 + (f.air ? .6 : 0));
    [0, 1].forEach(r => {
      let prev = knot;
      for (let i = 1; i <= 5; i++) {
        const wave = Math.sin(G.frame * .22 + i * .9 + r * 1.7) * (.6 + speed) * i * .3;
        const q = [knot[0] - dir * (2.4 * i - r * .5 * i), knot[1] + i * (.6 + r * .5) + (1 - speed) * i * i * .14 + wave];
        limbT(prev, q, 2, 2, 0, r ? dim(d.bandP) : d.bandP);
        prev = q;
      }
    });
  };
  const drawBraid = () => {
    if (d.hairDown) {   // longs cheveux mauves : masse qui tombe derrière la tête jusqu'aux épaules
      const hp = d.hair, sw = (f.air ? -f.vx * .5 : 0) + Math.sin(G.frame * .08) * .4;
      const t0 = [h[0] - dir * 1, h[1] - 6], L = 15;
      for (let i = 0; i <= L; i++) {
        const k = i / L, w = Math.round(8 + 3 * Math.sin(k * Math.PI * .7)), cx2 = t0[0] - dir * (2.5 + k * 2.5) + sw * k * 3, y = t0[1] + i * 1.5;
        sR(cx2 - w / 2 - 1, y, w + 2, 2, hp.a); sR(cx2 - w / 2, y, w, 2, hp.h);
        for (let st = -w / 2 + 1; st < w / 2; st += 3) sR(cx2 + st, y, 1, 2, (i + st) % 2 ? hp.H : hp.L);   // mèches
      }
      const tip = t0[1] + L * 1.5 + 2;
      for (let st = -4; st <= 4; st += 2) sR(t0[0] - dir * 5 + st + sw * 3, tip, 1, 2 + (st & 2 ? 1 : 0), hp.h);   // pointes effilées
    }
    if (!d.braid) return;
    const hp = d.hair, swing = (f.air ? -f.vx : 0) + Math.sin(G.frame * .12) * .5;
    if (d.ponytail) {
      // vraie queue de cheval : attachée haut à l'arrière du crâne, épaisse au départ, fine au bout
      const base = [h[0] - dir * 4, h[1] - 6];
      sR(base[0] - 1, base[1] - 1, 3, 3, hp.a); sR(base[0] - 1, base[1], 3, 1, '#101018');   // élastique
      const N = 11;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const q = [base[0] - dir * (1.9 * i - .09 * i * i) + swing * i * .3, base[1] + .5 + 2.2 * i];
        const w = Math.max(1, Math.round(3.6 - 2.8 * t));
        sR(q[0] - (w >> 1) - 1, q[1] - 1, w + 2, 3, hp.a);
        sR(q[0] - (w >> 1), q[1] - 1, w, 2, i % 3 === 1 ? hp.H : hp.h);
        if (w > 1 && i % 2 === 0) sR(q[0] - (w >> 1) + (dir > 0 ? w - 1 : 0), q[1] - 1, 1, 1, hp.L);
      }
      return;
    }
    const base = backView ? [h[0] - dir * 1, h[1] + 2] : [h[0] - dir * 4, h[1]];
    const slant = backView ? .6 : 1.4;
    const windy = f.state === 'axgp' || (f.state === 'nsuper' && f.t >= 12);   // frappe au sol : la tresse flotte en arrière dans le vent
    for (let i = 0; i < 7; i++) {
      const q = windy ? [base[0] - dir * 2.7 * i, base[1] - 1 - .35 * i + Math.sin(G.frame * .35 - i * .9) * .38 * i] : [base[0] - dir * (slant * i - .07 * i * i) + swing * i * .25, base[1] + 2.2 * i];
      sR(q[0] - 1, q[1] - 1, 3, 3, hp.a);
      sR(q[0] - 1, q[1] - 1, 2, 2, i % 2 ? hp.h : hp.H);
      if (i % 2 === 0) sR(q[0] - 1, q[1] - 1, 1, 1, hp.L);
      if (i === 6) { if (windy) { sR(q[0] - dir * 2 - .5, q[1] - 1, 1, 3, top[2]); sR(dir > 0 ? q[0] - 6 : q[0] + 3, q[1], 3, 1, hp.H); } else { sR(q[0] - 1, q[1] + 2, 3, 1, top[2]); sR(q[0], q[1] + 3, 1, 3, hp.H); } }   // bout pointu : horizontal vers l'arrière dans le vent
    }
  };
  // Bras : lead = bras avant (celui qui frappe), rear = bras arrière
  const arm = (s0, e, hd, near, fd = dir) => {
    if (window.__skip) return;
    if (s0 === sdA) { swE = e; swH = hd; if (f.id === 0 || f.id === 1) f.handW = [x + (mir ? -1 : 1) * (hd[0] - OX) * UP, y + (hd[1] - OY) * UP]; }   // main avant (sabre, gants chargés)
    const S = near ? sk : dim(sk), T = near ? top : dim(top), Gl = near ? d.glove : dim(d.glove);
    if (d.armor) {   // Grog : biceps nus et musclés, avant-bras blindé sanglé, gantelet, énorme épaulière
      const AR = near ? d.armorP : dim(d.armorP), SP = d.strap || ['#2a1608', '#5a3418', '#7a4a26'];
      limbT(s0, e, near ? 10 : 9.5, 8, near ? 2.4 : 2, S);
      const bc = mix(s0, e, .55), bn = add(bc, [ (e[1] - s0[1]) * .12 * fd, 0]);
      if (near) { sDisc(bn[0], bn[1] - 1, 3, S[3]); sR(bn[0] - 2, bn[1] + 1, 4, 1, S[1]); const sl = mix(s0, e, .8); sR(sl[0] - 1, sl[1], 3, 1, S[1]); }   // biceps éclairé
      const f0 = mix(e, hd, .12);
      limbT(f0, mix(f0, hd, .85), near ? 8 : 7.5, near ? 7.5 : 7, .3, AR);
      const ed = mix(f0, hd, .1); limbT(ed, mix(f0, hd, .75), 1.5, 1.5, 0, [AR[3], AR[3], AR[3], AR[3]]);   // arête lumineuse
      for (const t of [.22, .82]) { const q = mix(f0, hd, t); sR(q[0] - 4, q[1] - 1, 8, 2, SP[1]); sR(q[0] - 4, q[1] - 1, 8, 1, SP[2]); sR(q[0], q[1] - 1, 1, 1, AR[3]); }
      const x0 = Math.round(hd[0]) - 3, y0 = Math.round(hd[1]) - 2;   // grosse main verte
      sR(x0, y0, 7, 5, S[0]); sR(x0 + 1, y0, 5, 4, S[2]); sR(x0 + 1, y0 + 3, 5, 1, S[1]);
      return;
    }
    limbT(s0, e, d.bigArms ? (near ? 7.5 : 7) : d.thinArms ? (near ? 3.8 : 3.4) : near ? 5 : 4.5, d.bigArms ? 4.8 : d.thinArms ? 3.2 : 4, near ? (d.bigArms ? 1.6 : 1.2) : 1, d.skinTop ? [S[1], S[1], S[2], S[3]] : S);   // Grog : contour adouci
    if (!d.sleeveless) limbT(s0, mix(s0, e, tshirt ? .4 : 1), near ? 6 : 5.5, near ? 5.5 : 5, tshirt ? 0 : .5, d.skinTop ? [T[1], T[1], T[2], T[3]] : T);
    else { const sc2 = mix(s0, e, .12); sR(sc2[0] - 2, sc2[1] - 1, 4, 2, T[1]); }   // emmanchure du corset
    limbT(e, hd, d.bigArms ? (near ? 6 : 5.5) : d.thinArms ? (near ? 3.4 : 3) : near ? 4.5 : 4, d.bigArms ? (near ? 5 : 4.5) : d.thinArms ? 2.6 : near ? 3.5 : 3, 1, d.sleeves ? T : d.bigArms ? [S[1], S[1], S[2], S[3]] : S);
    if (d.tornTop && tshirt) { const ed = mix(s0, e, .42); sR(ed[0] - 1, ed[1], 1, 2, T[0]); sR(ed[0] + 1, ed[1] + 1, 1, 2, T[1]); }   // manche effilochée
    if (d.sleeves) limbT(s0, mix(s0, e, 1), near ? 5.5 : 5, near ? 5 : 4.5, .3, T);
    if (d.epaulettes) {   // épaulettes dorées à franges
      const ep = mix(s0, e, .05); sR(ep[0] - 3, ep[1] - 2, 6, 2, near ? '#c8a040' : '#7a6020'); sR(ep[0] - 2, ep[1] - 2, 4, 1, near ? '#f0d070' : '#9a7a30');
      for (let k = -3; k <= 2; k++) sR(ep[0] + k, ep[1], 1, k % 2 ? 2 : 3, near ? '#a88030' : '#5a4418');
    }
    if (!tshirt) limbT(e, mix(e, hd, .25), 5.5, 5.5, 0, T);
    if (d.bracer) {   // Grog : brassard d'acier sanglé de cuir sur l'avant-bras
      const AR = near ? d.armorP : dim(d.armorP), b0 = mix(e, hd, .1), b1 = mix(e, hd, .65);
      limbT(b0, b1, near ? 5.5 : 5, near ? 5 : 4.5, .2, AR);
      const hl = mix(b0, b1, .2); sR(hl[0], hl[1] - 1, 1, 2, AR[3]);
      const st = mix(b0, b1, .55); sR(st[0] - 2, st[1], 5, 1, d.bracerGlow ? (near ? d.bracerGlow : '#1a78a0') : near ? '#6e3c28' : '#3c1e0a');
      if (d.bracerGlow && near) { const g2 = mix(b0, b1, .3); sR(g2[0] - 1, g2[1], 3, 1, d.bracerGlow); }
    }
    fist(hd, fd, Gl, S);
  };
  const leg = (k, ft, near) => {
    const soft = pal => d.outlineLegs ? pal : [pal[1], pal[1], pal[2], pal[3]];   // pas de bord sombre (pas de contour), sauf Grog
    const Lg = near ? soft(legs) : dim(legs), S = near ? soft(sk) : dim(sk);
    limbT(p, k, d.female ? 6.5 : d.bulk ? 11.5 : d.baggy ? 9 : 7, d.female ? 4.2 : d.bulk ? 6 : d.baggy ? 7.5 : 5, d.bulk ? 1.8 : .8, Lg);
    // la jambe s'arrête à la cheville : rien ne dépasse sous le pied / la semelle
    const ank = add(ft, [0, d.shoes ? -4 : -4]);
    if (d.torn) {
      limbT(k, ank, 4, 3, 1, S);
      const cut = mix(k, ank, .45);
      limbT(k, cut, 6, 5.5, 0, Lg);
      if (near) {
        sR(cut[0] - 2, cut[1] + 2, 1, 1, Lg[1]); sR(cut[0] + 1, cut[1] + 2, 1, 1, Lg[1]);
        const tr = mix(p, k, .6); sR(tr[0] + dir, tr[1], 2, 1, sk[2]);
      }
    } else limbT(k, ank, d.female ? 4.2 : d.bulk ? 4.2 : d.baggy ? 7.5 : 5.5, d.female ? 2.6 : d.bulk ? 2.8 : d.baggy ? 7 : 3.5, .8, Lg);
    if (d.baggy) {   // pantalon cargo : poche sur la cuisse, plis tombant sur les rangers
      if (near) { const pk = mix(p, k, .6); sR(pk[0] - 2, pk[1] - 2, 5, 5, Lg[1]); sR(pk[0] - 2, pk[1] - 2, 5, 1, Lg[3]); sR(pk[0] - 1, pk[1] - 1, 3, 1, Lg[2]); }
      const cf = mix(k, ank, .8); sR(cf[0] - 3, cf[1], 7, 1, Lg[1]); const cf2 = mix(k, ank, .45); sR(cf2[0] - 2, cf2[1], 4, 1, Lg[1]);
    }
    if (d.hem) {
      // bas du kimono effiloché aux chevilles
      const hx = Math.round(ank[0]), hy = Math.round(ank[1]);
      sR(hx - 3, hy, 6, 1, Lg[1]);
      [[-3, 2], [-2, 1], [-1, 3], [0, 1], [1, 2], [2, 1]].forEach(([dx, l], i) => sR(hx + dx, hy + 1, 1, l, i % 2 ? Lg[2] : Lg[1]));
    }
    if (d.cargo) {   // poche cargo sur la cuisse, plis
      const pk = mix(p, k, .55); sR(pk[0] - 2, pk[1] - 2, 5, 5, Lg[1]); sR(pk[0] - 2, pk[1] - 2, 5, 1, Lg[3]);
      const pl2 = mix(k, ank, .35); sR(pl2[0] - 2, pl2[1], 4, 1, Lg[1]);
    }
    if (d.bulk && d.shoes) {   // grosses rangers montantes, lacées
      const B = d.shoe, b0 = add(ft, [0, -9]), b1 = add(ft, [0, -3]);
      limbT(add(ft, [0, -5]), b1, 5, 6, 0, near ? [B[0], B[1], B[2], B[2]] : [B[0], B[0], B[1], B[1]]);
      if (near) sR(Math.round(ft[0]) + dir, Math.round(ft[1]) - 5, 2, 1, B[3]);
      const x0 = Math.round(ft[0]) - (dir > 0 ? 3 : 5);
      sR(x0, Math.round(ft[1]) - 4, 8, 3, near ? B[1] : B[0]); sR(x0 + (dir > 0 ? 4 : 0), Math.round(ft[1]) - 4, 4, 1, near ? B[2] : B[1]);
      sR(x0, Math.round(ft[1]) - 1, 8, 1, '#08080a');
    } else if (d.shoes && d.fireUpper && f.air && (f.state === 'fjump' || f.state === 'uppercut')) shoeDown(ft, dir, !near);   // pieds tendus vers le bas
    else if (d.shoes) shoeP(ft, dir, !near, d.shoe); else footP(ft, dir, S);
    if (d.jeans && near) { const kp = mix(p, k, .75); sR(kp[0] - 1, kp[1], 2, 2, Lg[3]); }   // délavé au genou
  };

  // ---- Plan arrière ----
  if (d.cape) {   // cape élimée qui tombe des épaules jusqu'aux mollets, bord déchiré
    const C = d.capeP, sway = Math.min(4, Math.abs(f.vx) * 1.5) + Math.sin(G.frame * .07 + f.id) * 1.2;
    const s1 = add(sh, fwd, 7), s2 = add(sh, fwd, -8), bot = Math.min(p[1] + 24, Math.max(ff[1], bf[1]) - 6);
    const b1 = [s1[0] + dir * 2 - dir * sway * .3, bot], b2 = [s2[0] - dir * (4 + sway), bot - 2];
    sPoly([s1, s2, b2, b1], C[1]);
    sPoly([add(s2, fwd, 1), add(sh, fwd, -2), [mix(b1, b2, .6)[0], bot - 3], b2], C[2]);
    for (let k = 0; k <= 8; k++) { const q = mix(b2, b1, k / 8); sR(q[0], q[1] - (k % 2 ? 0 : 3), 1, k % 2 ? 2 : 4, C[0]); }
    sR(s2[0], s2[1], 2, Math.max(2, bot - s2[1] - 6), C[3]);
  }
  if (!backView) { drawBand(); drawBraid(); }
  // Le bras éloigné (celui qui frappe) passe derrière le torse ; le bras proche de la caméra
  // part de l'épaule arrière, ce qui laisse voir pectoraux et abdos en vue de face.
  const guard = !backView && !d.float && ['idle', 'crouch', 'jump', 'land', 'getup', 'parry', 'hit', 'stunned', 'kick', 'fkick', 'ckick', 'jkick'].includes(f.state);
  const bob = f.state === 'idle' && ((G.frame / 18 | 0) + f.id) % 2 ? 1 : 0;
  if (guard && f.state !== 'parry') {
    // bras avant tendu devant, à hauteur d'épaule, bien à droite du torse
    const e1 = d.wide ? add(sdA, [dir * 3, 8 + bob]) : d.bulk ? add(sdA, [dir * 6, 8 + bob]) : add(sdA, [dir * 3, 5 + bob]), h1 = d.wide ? add(e1, [dir * 1, 7]) : d.bulk ? add(e1, [dir * 3, 6]) : add(e1, [dir * 4, -4]);   // colosse : bras écartés, poings bas   // bras avant plié, poing devant la poitrine
    arm(sdA, e1, h1, true);
  } else if (fullBack) arm(sdB, be, bh, false);   // de dos : le bras plié passe derrière le dos
  else arm(sdA, fe, fh, !backView);
  const flapPts = side => {   // pans longs du kimono (devant / derrière), bas effiloché
    const hang = f.air ? 9 : 12, sway = Math.min(3, Math.abs(f.vx) * 1.2) + Math.sin(G.frame * .15 + side) * .6;
    const a0 = side > 0 ? .5 : -5, a1 = side > 0 ? 5.5 : -.5, s2 = side > 0 ? -sway * .4 : -sway;
    return [add(p, fwd, a0), add(p, fwd, a1), add([p[0], p[1] + hang], fwd, a1 + s2 + (side > 0 ? .5 : 0)), add([p[0], p[1] + hang - 1], fwd, a0 + s2)];
  };
  const drawFlap = (side, shade) => {
    const FP = d.flapP || top, P2 = flapPts(side); sPoly(P2, FP[shade]); sPoly([P2[0], P2[1], mix(P2[1], P2[2], .5), mix(P2[0], P2[3], .5)], FP[shade === 1 ? 2 : 3]);
    for (let k = 0; k < 3; k++) { const q = mix(P2[3], P2[2], (k + .5) / 3); sR(q[0], q[1] + (k % 2), 1, 1, FP[0]); }   // bas déchiré
  };
  if (d.flaps && !fullBack) drawFlap(backView ? 1 : -1, 1);   // pan arrière, derrière les jambes
  leg(fk, ff, false);   // jambe avant (côté adversaire) derrière, dans l'ombre

  // ---- Torse ----
  const wa = add(p, [-ux, -uy], 1);
  const at = t => mix(sh, wa, t);
  const tw = d.slim ? .95 : d.bulk ? 1.55 : d.wide ? 1.4 : 1.15;   // torse plus large (on le voit de 3/4) ; plus fin pour les combattantes
  const torso = [add(sh, fwd, 6 * tw + RK * rs), add(at(.3), fwd, 6.5 * tw + RK * .6 * rs), add(at(.75), fwd, 5 * tw + RK * .2 * rs), add(wa, fwd, 4.5 * tw),
                 add(wa, fwd, -4 * tw), add(at(.6), fwd, -5 * tw - RK * .3 * rs), add(at(.25), fwd, -6 * tw - RK * .7 * rs), add(sh, fwd, -5.5 * tw - RK * rs)];
  if (shY != null) { torso[0][1] = Math.max(torso[0][1], shY - 1); torso[7][1] = Math.max(torso[7][1], shY - 1); }
  if (fullBack) {
    const T2 = [add(sh, fwd, 7), add(at(.3), fwd, 7.5), add(at(.75), fwd, 5.5), add(wa, fwd, 4.8),
                add(wa, fwd, -4.8), add(at(.75), fwd, -5.5), add(at(.3), fwd, -7.5), add(sh, fwd, -7)];
    for (let i = 0; i < 8; i++) torso[i] = T2[i];
  }
  if (d.wide && !fullBack) {   // Grog : buste en V, taille plus étroite
    torso[2] = add(torso[2], fwd, -1); torso[3] = add(torso[3], fwd, -1.5); torso[4] = add(torso[4], fwd, 1.5); torso[5] = add(torso[5], fwd, 1);
  }
  if (d.bulk && !fullBack) {   // buste en V : épaules énormes, taille plus étroite
    torso[0] = add(torso[0], fwd, 2); torso[7] = add(torso[7], fwd, -2); torso[1] = add(torso[1], fwd, 1.5); torso[6] = add(torso[6], fwd, -1.5);
    torso[3] = add(torso[3], fwd, -1.5); torso[4] = add(torso[4], fwd, 1.5);
  }
  if (d.skinTop) limbT([h[0] - dir * .5, h[1] + 3], [n[0] + dir * .5, n[1] + 1], 5, 5, 0, [sk[1], sk[1], sk[2], sk[3]]);   // Grog : cou derrière le torse
  sPoly(grow(torso, .6), d.skinTop ? top[1] : top[0]);
  if (d.female && !fullBack) {   // taille plus fine
    for (const i of [2, 3, 4, 5]) { const c = mix(at(.75), at(.75), 0); torso[i] = mix(torso[i], add(i < 4 ? wa : at(.6), [0, 0]), .18); }
  }
  sPoly(torso, top[2]);
  if (fullBack) {
    // dos vu de face : deux omoplates, colonne au centre, flancs dans l'ombre
    sPoly([add(sh, fwd, 7), add(sh, fwd, 5), add(at(.7), fwd, 4), add(wa, fwd, 3.5), add(wa, fwd, 4.8), add(at(.75), fwd, 5.5), add(at(.3), fwd, 7.5)], top[1]);
    sPoly([add(sh, fwd, -7), add(sh, fwd, -5), add(at(.7), fwd, -4), add(wa, fwd, -3.5), add(wa, fwd, -4.8), add(at(.75), fwd, -5.5), add(at(.3), fwd, -7.5)], top[1]);
    sPoly([add(sh, fwd, 1.5), add(sh, fwd, 5), add(at(.3), fwd, 4.5), add(at(.36), fwd, 1.5)], top[3]);
    sPoly([add(sh, fwd, -1.5), add(sh, fwd, -5), add(at(.3), fwd, -4.5), add(at(.36), fwd, -1.5)], top[3]);
    for (let t = .1; t <= .85; t += .12) { const q = at(t); sR(q[0], q[1], 1, 1, top[1]); }
  } else if (backView) {
    // Dos : omoplates éclairées, colonne vertébrale, flanc avant dans l'ombre
    sPoly([add(sh, fwd, 6), add(sh, fwd, 3), add(at(.6), fwd, 2.5), add(wa, fwd, 2), add(wa, fwd, 4.5), add(at(.75), fwd, 5), add(at(.3), fwd, 6.5)], top[1]);
    sPoly([add(sh, fwd, -5), add(sh, fwd, -1), add(at(.3), fwd, -1.5), add(at(.32), fwd, -5)], top[3]);
    for (let t = .1; t <= .85; t += .12) { const q = add(at(t), fwd, .5); sR(q[0], q[1], 1, 1, top[1]); }
    const bl1 = add(at(.35), fwd, -3); sR(bl1[0] - (dir < 0 ? 1 : 0), bl1[1], 2, 1, top[1]);
    const bl2 = add(at(.35), fwd, 2.5); sR(bl2[0] - (dir < 0 ? 1 : 0), bl2[1], 2, 1, top[1]);
  } else if (d.bare) {   // torse nu : seul le flanc arrière est dans l'ombre, la musculature est dessinée plus bas
    sPoly([add(sh, fwd, -10), add(sh, fwd, -7.5), add(at(.6), fwd, -6.5), add(wa, fwd, -4), add(wa, fwd, -5.5), add(at(.6), fwd, -8)], top[1]);
  } else {
    sPoly([add(sh, fwd, -5.5), add(sh, fwd, -2.5), add(at(.6), fwd, -2), add(wa, fwd, -1.5), add(wa, fwd, -4), add(at(.6), fwd, -5), add(at(.25), fwd, -6)], top[1]);
    sPoly([add(sh, fwd, 2), add(sh, fwd, 5.5), add(at(.28), fwd, 5.5), add(at(.22), fwd, 2.5)], top[3]);
    if (tshirt) {
      // t-shirt moulant : ombre sous les pectoraux, ligne centrale des abdos
      if (!d.skinTop && !d.noAbs) for (let k = -3; k <= 5; k++) { const q = add(at(.42), fwd, k); sR(q[0], q[1], 1, 1, top[1]); }
      if (!d.skinTop && !d.noAbs) {   // Grog / Nyx : pas d'abdos
        for (let t = .48; t <= .85; t += .1) { const q = add(at(t), fwd, 1.2); sR(q[0], q[1], 1, 1, top[1]); }
        const a1 = add(at(.62), fwd, -1.5), a2 = add(at(.62), fwd, 3.5); sR(a1[0] - (dir < 0 ? 1 : 0), a1[1], 2, 1, top[1]); sR(a2[0] - (dir < 0 ? 1 : 0), a2[1], 2, 1, top[1]);
      }
    } else {
      // veste ouverte en V : torse nu visible
      sPoly([add(sh, fwd, -1), add(sh, fwd, 4.5), add(at(.55), fwd, 1.5)], sk[2]);
      sPoly([add(sh, fwd, 0), add(sh, fwd, 3), add(at(.25), fwd, 1.5)], sk[3]);
      for (let k = 0; k <= 3; k++) { const q = add(at(.3), fwd, k); sR(q[0], q[1], 1, 1, sk[1]); }
      const ab = add(at(.45), fwd, 1.5); sR(ab[0], ab[1], 1, 1, sk[1]);
      for (let t = 0; t <= 1; t += .1) { const q = mix(add(sh, fwd, 4.5), add(at(.6), fwd, -1), t); sR(q[0], q[1], 1, 1, top[0]); }
    }
  }
  if ((d.muscles || d.traps) && !backView && !fullBack) {   // Grog : trapèzes, deltoïdes ronds, pectoraux détaillés
    const S0 = sk[0], S1 = sk[1], S2 = sk[2], S3 = sk[3];
    // trapèzes : pente musclée du cou vers les épaules
    const nk = add(n, [0, -5]);   // trapèzes énormes qui montent jusqu'au bas du crâne
    sPoly([add(nk, fwd, -3.5), add(nk, fwd, 4), add(sh, fwd, 8), add(at(.08), fwd, 6), add(at(.08), fwd, -6), add(sh, fwd, -7.5)], S1);
    sPoly([add(nk, fwd, -2.5), add(nk, fwd, 3), add(sh, fwd, 7), add(at(.05), fwd, 4.5), add(at(.05), fwd, -4.5), add(sh, fwd, -6.5)], S1);
    sPoly([add(nk, fwd, -1.5), add(nk, fwd, 2.5), add(sh, fwd, 5.5), add(at(.02), fwd, 3), add(at(.02), fwd, -3), add(sh, fwd, -5)], S2);
    const tr = add(nk, fwd, 2.5); sR(tr[0], tr[1] + 2, 2, 1, S3); sR(tr[0] + dir * 2, tr[1] + 3, 2, 1, S3); sR(tr[0] + dir * 3, tr[1] + 4, 2, 1, S3);
    const tl = add(nk, fwd, -2); sR(tl[0], tl[1] + 2, 1, 2, S3);
    if (d.muscles) {   // pectoraux : deux grandes masses bombées qui occupent le haut du torse
    sPoly([add(at(.03), fwd, 1), add(at(.03), fwd, 7), add(at(.2), fwd, 8), add(at(.38), fwd, 6.5), add(at(.46), fwd, 3.5), add(at(.46), fwd, 1)], S2);   // pectoral avant
    sPoly([add(at(.03), fwd, 0), add(at(.03), fwd, -5.5), add(at(.2), fwd, -6.5), add(at(.38), fwd, -5.5), add(at(.46), fwd, -2.5), add(at(.46), fwd, 0)], S2);   // pectoral arrière
    sPoly([add(at(.06), fwd, 2), add(at(.06), fwd, 6.5), add(at(.16), fwd, 7), add(at(.26), fwd, 5), add(at(.26), fwd, 2)], S3);        // reflet avant (grand)
    sPoly([add(at(.07), fwd, -1), add(at(.07), fwd, -4.5), add(at(.15), fwd, -5), add(at(.22), fwd, -3.5), add(at(.22), fwd, -1)], S3); // reflet arrière
    for (let k2 = -5.5; k2 <= 7.5; k2 += .5) {   // ombre franche sous les pectoraux, qui remonte sur les côtés
      const side = Math.max(0, Math.abs(k2 - 1) - 3.5), q = add(at(.48 - side * .03), fwd, k2);
      sR(q[0], q[1], 1, 2, S1);
    }
    for (let t = .04; t <= .46; t += .03) { const q = add(at(t), fwd, .5); sR(q[0], q[1], 1, 1, S1); }   // sillon entre les pectoraux
    }
  }
  if (d.scars && !backView) {   // cicatrices en X sur le torse
    for (const [t, o] of [[.25, 3.5], [.55, -2]]) { const q = add(at(t), fwd, o); sR(q[0] - 1, q[1] - 1, 1, 1, '#7a3a2a'); sR(q[0] + 1, q[1] - 1, 1, 1, '#7a3a2a'); sR(q[0], q[1], 1, 1, '#7a3a2a'); sR(q[0] - 1, q[1] + 1, 1, 1, '#7a3a2a'); sR(q[0] + 1, q[1] + 1, 1, 1, '#7a3a2a'); }
  }
  // Cou court et large
  if (!d.skinTop) limbT([h[0] - dir * .5, h[1] + 3], [n[0] + dir * .5, n[1] - .5], d.bulk ? 8 : 5, d.bulk ? 9 : 5, 0, d.softNeck ? [sk[1], sk[1], sk[2], sk[3]] : sk);   // softNeck : cou sans contour
  if (d.bulk && !backView) {   // trapèzes massifs
    sPoly([add(sh, fwd, -7), add(sh, fwd, 8), add(n, fwd, 3), add(n, fwd, -3)], sk[1]);
    sPoly([add(sh, fwd, -5), add(sh, fwd, 6.5), add(n, fwd, 2), add(n, fwd, -2)], sk[2]);
    const tl = add(sh, fwd, 3); sR(tl[0] - 1, tl[1] - 2, 3, 1, sk[3]);
  }
  if (d.bare && !backView && !fullBack && Math.abs(ux) < .45) {   // torse en pixel art dessiné à la main : pectoraux, abdos, dentelés, harnais en X
    const SP = d.strap || ['#2a1608', '#5a3418', '#7a4a26'], A = d.armorP;
    const PAL = { o: sk[0], d: sk[1], m: sk[2], l: sk[3], r: SP[1], g: A[1], G: A[3], x: '#7a3a2a' };
    const top0 = mix(n, sh, .3), step = (wa[1] + 2 - top0[1]) / 16;   // du bas du cou jusqu'à la taille
    for (let r2 = 0; r2 < 16; r2++) {
      const c0 = mix(top0, wa, r2 / 15), y = Math.round(top0[1] + r2 * step), hh = Math.max(1, Math.round(top0[1] + (r2 + 1) * step) - y);
      const row = GROG_TORSO[r2];
      for (let c = 0; c < row.length; c++) { const ch = row[c]; if (ch === '.') continue; sR(Math.round(c0[0] + dir * (c - 10)) - (dir < 0 ? 0 : 0), y, 1, hh, PAL[ch]); }
    }
  } else if (d.harness && !fullBack) {   // harnais vu de dos ou buste penché
    const SP = d.strap || ['#2a1608', '#5a3418', '#7a4a26'];
    for (const [a0, a1] of [[add(sh, fwd, 7), add(wa, fwd, -6)], [add(sh, fwd, -6), add(wa, fwd, 6.5)]]) for (let t = 0; t <= 1; t += .06) { const q = mix(a0, a1, t); sR(q[0], q[1], 2, 1, SP[1]); }
  }

  if (tshirt && !backView && !d.vneck && !d.bare && !d.skinTop && !d.bareChest) {
    // col rond
    const c1 = add(sh, fwd, -1.5), c2 = add(sh, fwd, 3.5), cb = add(at(.1), fwd, 1);
    sPoly([add(c1, fwd, -1), add(c2, fwd, 1), add(cb, [0, 1])], top[1]);
    sPoly([c1, c2, cb], sk[2]);
  }
  if (d.neonV && !backView && !fullBack) {   // col en V néon cyan sur la combinaison
    const c1 = add(sh, fwd, -3.5), c2 = add(sh, fwd, 5.5), cb = add(at(.3), fwd, 1);
    for (let t = 0; t <= 1; t += .12) { const q = mix(c1, cb, t), r = mix(c2, cb, t); sR(q[0], q[1], 1, 1, '#3af0ff'); sR(r[0], r[1], 1, 1, '#3af0ff'); }
    sR(cb[0], cb[1], 1, 1, '#c8ffff');
  }
  if (d.tornTop && !fullBack) {   // kimono déchiré : accrocs sur la poitrine et le bas
    const hm = add(wa, fwd, -3.5); sR(hm[0], hm[1] - 1, 1, 2, sk[1]); const hm2 = add(wa, fwd, 2); sR(hm2[0], hm2[1] - 1, 1, 2, top[0]);
  }
  if (tshirt && !backView && d.vneck) {
    // Col en V ouvert : haut des pectoraux visible
    const c1 = add(sh, fwd, -3), c2 = add(sh, fwd, 5), cb = add(at(.34), fwd, 1);
    sPoly([add(c1, fwd, -1), add(c2, fwd, 1), add(cb, [0, 1])], top[1]);   // bord du col
    sPoly([c1, c2, cb], sk[2]);                                            // peau
    sPoly([add(c1, fwd, .5), add(sh, fwd, .5), add(at(.18), fwd, .5)], sk[3]);   // reflet pectoral gauche
    sPoly([add(sh, fwd, 2), add(c2, fwd, -.8), add(at(.16), fwd, 2.2)], sk[3]);  // reflet pectoral droit
    for (let t = .05; t <= .3; t += .06) { const q = add(at(t), fwd, 1.2); sR(q[0], q[1], 1, 1, sk[1]); }  // sillon
    const pl = add(at(.22), fwd, -1); sR(pl[0] - (dir < 0 ? 1 : 0), pl[1], 2, 1, sk[1]);
    const pr = add(at(.22), fwd, 2.5); sR(pr[0] - (dir < 0 ? 1 : 0), pr[1], 2, 1, sk[1]);
  }


  if (d.bareChest && !backView && !fullBack) {   // Grog torse nu : mêmes pectoraux que Hiro, mais entièrement visibles, et abdos
    sPoly([add(at(.03), fwd, 1.5), add(at(.03), fwd, 6), add(at(.18), fwd, 6.8), add(at(.34), fwd, 5), add(at(.38), fwd, 1.5)], sk[3]);    // pectoral avant éclairé
    sPoly([add(at(.03), fwd, .5), add(at(.03), fwd, -4.5), add(at(.17), fwd, -5.2), add(at(.32), fwd, -3.8), add(at(.36), fwd, .5)], sk[2]);  // pectoral arrière
    for (let t = .04; t <= .38; t += .05) { const q = add(at(t), fwd, 1.1); sR(q[0], q[1], 1, 1, sk[1]); }   // sillon entre les pectoraux
    for (let k = -4.5; k <= 6.5; k += .5) { const side = Math.max(0, Math.abs(k - 1) - 3), q = add(at(.4 - side * .025), fwd, k); sR(q[0], q[1], 1, 1, sk[1]); }   // ombre sous les pectoraux
    const ph = add(at(.14), fwd, 4); sR(ph[0], ph[1], 2, 1, '#c8dccb');   // reflet
    for (let t = .48; t <= .9; t += .06) { const q = add(at(t), fwd, 1.2); sR(q[0], q[1], 1, 1, sk[1]); }   // ligne blanche des abdos
    for (const t of [.56, .68, .8]) { const a1 = add(at(t), fwd, -2), a2 = add(at(t), fwd, 4); sR(a1[0] - (dir < 0 ? 1 : 0), a1[1], 2, 1, sk[1]); sR(a2[0] - (dir < 0 ? 1 : 0), a2[1], 2, 1, sk[1]); }   // 3 rangées d'abdos
    for (const t of [.5, .62, .74]) { const b1 = add(at(t), fwd, -.5), b2 = add(at(t), fwd, 2.5); sR(b1[0], b1[1], 1, 1, sk[3]); sR(b2[0], b2[1], 1, 1, sk[3]); }   // reflets des abdos
  }
  if (d.uniform && !backView && !fullBack) {   // veste militaire croisée : boutons dorés, col montant, passepoil
    for (let t = .15; t <= .8; t += .16) for (const o of [0, 3.5]) { const q = add(at(t), fwd, o); sR(q[0], q[1], 1, 1, '#d0a848'); }
    for (let t = .05; t <= 1; t += .07) { const q = add(at(t), fwd, 1.8); sR(q[0], q[1], 1, 1, '#6a5a2a'); }
    const c1 = add(n, fwd, -3), c2 = add(n, fwd, 3); sPoly([add(c1, [0, -2]), add(c1, [0, 2]), add(sh, fwd, -1), add(n, fwd, -1)], top[1]); sPoly([add(c2, [0, -2]), add(c2, [0, 2]), add(sh, fwd, 2), add(n, fwd, 1)], top[2]);
    const ch = add(at(.1), fwd, -1); for (let k = 0; k < 5; k++) sR(ch[0] + k - 1, ch[1] + (k % 2), 1, 1, '#b08a38');
  }
  if (d.vest && !fullBack) {   // gilet sans manches : pans ouverts devant, col montant
    const V = d.vestP;
    if (!backView) {
      // pan côté caméra large, pan côté adversaire étroit : le débardeur noir apparaît au centre-avant
      sPoly([add(sh, fwd, -7.5), add(sh, fwd, -.5), add(at(.5), fwd, 0), add(wa, fwd, .5), add(wa, fwd, -5), add(at(.5), fwd, -7)], V[2]);
      sPoly([add(sh, fwd, 5), add(sh, fwd, 7.5), add(at(.4), fwd, 7.5), add(wa, fwd, 5.5), add(wa, fwd, 4), add(at(.5), fwd, 4.5)], V[2]);
      sPoly([add(sh, fwd, 5.8), add(sh, fwd, 7.5), add(wa, fwd, 5.5), add(wa, fwd, 4.8)], V[1]);
      for (const o of [-.5, 5]) for (let t = 0; t <= 1; t += .08) { const q = mix(add(sh, fwd, o), add(wa, fwd, o > 0 ? 4 : .5), t); sR(q[0], q[1], 1, 1, V[0]); }   // bords
      sR(add(at(.2), fwd, -4)[0], add(at(.2), fwd, -4)[1], 2, 1, V[3]);
    } else sPoly([add(sh, fwd, -7), add(sh, fwd, 7), add(wa, fwd, 5), add(wa, fwd, -5)], V[2]);
    const c1 = add(n, fwd, -4), c2 = add(n, fwd, 3.5);   // col montant
    sPoly([add(c1, [0, -3]), add(c1, [0, 2]), add(sh, fwd, -2.5), add(n, fwd, -1.5)], V[1]);
    sPoly([add(c2, [0, -3]), add(c2, [0, 2]), add(sh, fwd, 3), add(n, fwd, 1.5)], V[2]);
    // emmanchures effilochées
    for (const sd of [sdA, sdB]) { sR(sd[0] - 2, sd[1] - 1, 4, 2, V[1]); sR(sd[0] - 2, sd[1] + 1, 1, 1, V[0]); sR(sd[0] + 1, sd[1] + 1, 1, 1, V[0]); }
  }
  // Silhouette féminine : poitrine et hanches arrondies
  if (d.curves) {   // formes désactivées pour Vesper (silhouette simple, base Kaito plus mince)
    if (!backView) {
      const bc = add(at(.3), fwd, 5.2 * tw);             // poitrine (côté adversaire)
      sDisc(bc[0], bc[1] + 1, 3, top[0]); sDisc(bc[0], bc[1], 3, top[2]);
      sR(bc[0] - 1 + (dir > 0 ? 0 : -1), bc[1] - 2, 2, 1, top[3]);
      const b2 = add(at(.32), fwd, 1.2);                  // second sein, de 3/4
      sDisc(b2[0], b2[1], 2, top[2]); sR(b2[0] - 1, b2[1] + 2, 3, 1, top[1]);
      const und = add(at(.42), fwd, 2.5); sR(und[0] - 3, und[1], 6, 1, top[1]);   // ombre sous la poitrine
    }
    const hb = add(add(p, [-ux, -uy], -1), fwd, -4.2);   // fessier arrondi
    sDisc(hb[0], hb[1], 4, legs[1]); sDisc(hb[0] + dir * .5, hb[1] - .5, 3, legs[2]);
    sR(hb[0] - dir * 2, hb[1] - 2, 1, 2, legs[3]);
  }

  // ---- Jambe proche ----
  leg(bk, bf, true);    // jambe arrière au premier plan, côté caméra

  // Pans de veste
  if (d.flaps && !fullBack) drawFlap(backView ? -1 : 1, 2);   // pan avant, devant les jambes
  if (d.style === 'jacket') {
    const hang = f.air ? 5 : 7, flare = Math.min(2, Math.abs(f.vx));
    const back = [add(p, fwd, -4.5), add(p, fwd, -.5), add([p[0], p[1] + hang], fwd, -1 - flare), add([p[0], p[1] + hang], fwd, -5.5 - flare)];
    const front = [add(p, fwd, .5), add(p, fwd, 5), add([p[0], p[1] + hang], fwd, 5.5), add([p[0], p[1] + hang - 1], fwd, 1)];
    if (backView) { sPoly(front, top[1]); sPoly(back, top[2]); const hl = add(p, fwd, -3); sR(hl[0], hl[1] + 1, 1, hang - 2, top[3]); }
    else { sPoly(back, top[1]); sPoly(front, top[2]); const hl = add(p, fwd, 3); sR(hl[0], hl[1] + 1, 1, hang - 2, top[3]); }
  }

  // Ceinture (le nœud est devant, donc caché en vue de dos)
  const bl = d.belt, by = add(p, [-ux, -uy], 1.5);
  if (d.minBelt) limbT(add(by, fwd, -4), add(by, fwd, 4.5), 1.5, 1.5, 0, [bl[1], bl[1], bl[2], bl[2]]);   // Grog : ceinture fine qui ne dépasse pas
  else limbT(add(by, fwd, d.bulk ? -6 : -4.5), add(by, fwd, d.bulk ? 6.5 : 5), d.techBelt ? 2 : d.heavyBelt ? 3.5 : 3, d.techBelt ? 2 : d.heavyBelt ? 3.5 : 3, 0, bl);
  if (d.minBelt) {
  } else if (d.uniform) {   // ceinturon noir, boucle dorée
    const bk2 = add(by, fwd, 3); if (!backView) { sR(bk2[0] - 2, bk2[1] - 1, 4, 3, '#a07a28'); sR(bk2[0] - 1, bk2[1], 2, 1, '#f0d070'); }
  } else if (d.heavyBelt) {   // grosse ceinture, boucle d'acier
    const bk2 = add(by, fwd, 3.5); const A = d.armorP;
    for (let t = -5; t <= 6; t += 2.2) { const q = add(by, fwd, t); sR(q[0], q[1] - 1, 1, 1, '#a88a5a'); }   // rivets
    if (!backView) { sR(bk2[0] - 3, bk2[1] - 2, 6, 4, A[0]); sR(bk2[0] - 2, bk2[1] - 1, 4, 2, A[2]); sR(bk2[0] - 1, bk2[1] - 1, 2, 1, A[0]); sR(bk2[0] - 2, bk2[1] - 2, 1, 1, A[3]); }
  } else if (d.techBelt) {   // ceinture futuriste : bande fine, segments et boucle lumineuse
    const bk2 = add(by, fwd, 3);
    for (let t = -4; t <= 4.5; t += 2.5) { const q = add(by, fwd, t); sR(q[0], q[1] - 1, 1, 1, bl[0]); }
    sR(bk2[0] - 2, bk2[1] - 1, 4, 3, bl[0]); sR(bk2[0] - 1, bk2[1] - 1, 2, 2, '#c8ffff');
  } else if (d.jeans) {
    const bk2 = add(by, fwd, 3); sR(bk2[0] - 1, bk2[1] - 1, 3, 2, '#d8b048'); sR(bk2[0], bk2[1] - 1, 1, 1, '#fff0a0');   // boucle
  } else if (!backView) {
    const kn = add(by, fwd, 3.5);
    sR(kn[0] - 1, kn[1] - 1, 3, 3, bl[2]); sR(kn[0] - 1, kn[1] - 1, 1, 1, bl[3]);
    sR(kn[0] + (dir > 0 ? 1 : -1), kn[1] + 1, 1, 5, bl[1]);
    sR(kn[0], kn[1] + 1, 1, 4, bl[2]);
  } else {
    const kn = add(by, fwd, 4.5);   // pans du nœud qui dépassent devant
    sR(kn[0], kn[1] + 1, 1, 4, bl[1]);
  }

  // ---- Tête ----
  const map = backView ? d.headBack : d.head, hp = d.hair, bp = d.bandP || [];
  const pal = { a: hp.a, h: hp.h, H: hp.H, L: hp.L, b: bp[1], B: bp[2], n: bp[3],
                e: sk[0], S: sk[1], s: sk[2], l: sk[3], k: '#120a06', m: sk[2], c: d.eye || '#120a06' };
  const hx = Math.round(h[0]), hy = Math.round(h[1]) - 7;
  for (let r = 0; r < map.length; r++) for (let c = 0; c < map[r].length; c++) {
    const ch = map[r][c]; if (ch === '.') continue;
    sR(hx + (dir > 0 ? c - 5 : 4 - c), hy + r, 1, 1, pal[ch]);
  }
  if (d.mohawk) {   // crête iroquoise qui fait le tour du crâne, du front à la nuque, pointes rayonnantes
    const hp = d.hair, cx = hx + (dir > 0 ? .5 : -.5), cy = hy + 5.5;
    const N = 15;
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i <= N; i++) {
      const th = -.55 + i / N * 2.75, vx = -dir * Math.sin(th), vy = -Math.cos(th);
      const L = (i % 2 ? 3.2 : 5.2) * (1 - Math.max(0, i - 6) * .09) * (i < 2 ? .7 : 1);   // plus courte derrière la tête
      if (pass === 0) { for (let r2 = 4.2; r2 <= 6; r2 += .5) sR(Math.round(cx + vx * r2), Math.round(cy + vy * r2), 1, 1, hp.a); continue; }   // base sombre sur le crâne
      for (let r2 = 5.2; r2 <= 5.2 + L; r2 += .5) {
        const t = (r2 - 5.2) / L, col = pass === 1 ? hp.a : t > .7 ? hp.L : t > .35 ? hp.H : hp.h;
        const px = Math.round(cx + vx * r2), py = Math.round(cy + vy * r2);
        if (pass === 1) { if (t < .8) sR(px - 1, py, 3, 1, col); } else sR(px, py, 1, 1, col);
      }
    }
  }
  if (d.witchHat) {   // grand chapeau de sorcière noir, incliné vers l'arrière, pointe tordue
    const WH = ['#050508', '#121218', '#22222c', '#3a3a4a'], cx = hx + (dir > 0 ? 0 : -1), by = hy + 3;
    const tl = x => Math.round(-dir * (x - cx) * .2);   // bord avant relevé, bord arrière abaissé
    for (let x = cx - 12; x <= cx + 12; x++) { const yy = by + tl(x); sR(x, yy, 1, 1, WH[0]); sR(x, yy - 1, 1, 1, Math.abs(x - cx) < 10 ? WH[2] : WH[1]); }
    const halves = [6, 6, 5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 1];
    let tx = cx, ty = by;
    halves.forEach((hw, r2) => {
      const off = -dir * Math.round(r2 * .45 + Math.max(0, r2 - 7) * .7), y = by - 2 - r2, x0 = cx + off;
      sR(x0 - hw, y, hw * 2 + 1, 1, WH[1]); sR(x0 - hw, y, 1, 1, WH[0]); sR(x0 + hw, y, 1, 1, WH[0]);
      if (hw > 1) sR(x0 + dir * (hw - 2), y, 1, 1, WH[3]);
      tx = x0; ty = y;
    });
    sR(tx - dir, ty - 1, 1, 1, WH[1]); sR(tx - dir * 2, ty - 1, 1, 1, WH[1]); sR(tx - dir * 3, ty, 1, 1, WH[1]); sR(tx - dir * 4, ty + 1, 1, 1, WH[0]);   // pointe pliée
    const bx0 = cx - dir; sR(bx0 - 6, by - 3, 13, 2, '#2a1030'); sR(bx0 + dir * 2 - 1, by - 3, 2, 2, '#8a8a96');   // bandeau et boucle
  }
  if (d.kasa && !f.noHat) {   // chapeau de paille conique de samouraï, incliné vers l'avant
    const K2 = ['#3a2a12', '#8a6a30', '#b8944a', '#e4c67e'], cx = hx + (dir > 0 ? 0 : -1), by = hy + 5;   // enfoncé : le bord avant cache les yeux
    const tilt = x => Math.round(dir * (x - cx) * .25);   // l'avant du bord descend, l'arrière remonte
    const px = (x, y, col) => sR(x, y + tilt(x), 1, 1, col);
    for (let r2 = 0; r2 < 6; r2++) {
      const half = [3, 6, 8, 10, 11, 12][r2], y = by - 6 + r2;   // profil arrondi
      for (let x = cx - half; x <= cx + half; x++) {
        let col = r2 === 5 ? K2[1] : K2[2];
        if (x === cx - half || x === cx + half) col = K2[0];
        else if (r2 < 4 && (x - cx) * -dir >= half - 2 && (x - cx) * -dir <= half - 1) col = K2[3];   // reflet
        else if (r2 >= 2 && (x - cx + half) % 3 === 2) col = K2[1];   // tressage
        px(x, y, col);
      }
    }
    for (let x = cx - 13; x <= cx + 13; x++) px(x, by, K2[0]);   // bord inférieur
    for (let x = cx - 1; x <= cx + 1; x++) px(x, by - 7, x === cx ? K2[2] : K2[0]);   // sommet arrondi
  }

  // ---- Plan avant ----
  if (fullBack) { drawBraid(); drawBand(); arm(sdA, fe, fh, true, -dir); }   // poing levé : doigts tournés vers l'intérieur
  else if (backView) { drawBraid(); drawBand(); arm(sdB, be, bh, true); }
  else {
    // Vue de face : en garde, le bras proche reste sur le côté gauche du corps
    // (coude vers le bas, poing devant les côtes) pour dégager pectoraux et abdos.
    const guard2 = !d.float && ['idle', 'punch', 'kick', 'fkick', 'crouch', 'cpunch', 'ckick', 'jpunch', 'jkick', 'jump', 'land', 'getup', 'hit', 'stunned'].includes(f.state);
    if (guard2) {
      const e2 = d.wide ? add(sdB, [-dir * 3, 8 + bob]) : d.bulk ? add(sdB, [-dir * 7, 7 + bob]) : add(sdB, [-dir * 3.5, 6 + bob]);
      const h2 = d.wide ? add(e2, [-dir * 1, 7]) : d.bulk ? add(e2, [-dir * 1, 7]) : add(e2, [dir * 3, -2.5]);
      arm(sdB, e2, h2, true);
    } else arm(sdB, be, bh, true);
  }

  if (d.sword && swH) {   // sabre fin : lame d'acier dans le prolongement de l'avant-bras
    let ux2 = swH[0] - swE[0], uy2 = swH[1] - swE[1]; const L2 = Math.hypot(ux2, uy2) || 1; ux2 /= L2; uy2 /= L2;
    if (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'block') { ux2 = dir * .75; uy2 = -.66; }   // en garde : lame pointée vers l'avant
    if (f.state === 'plunge' || f.state === 'hover') { ux2 = dir * .1; uy2 = 1; }
    if (f.state === 'wallslash') {   // sabre levé derrière la tête, puis abattu jusqu'au sol
      const th = f.t < 8 ? -2.0 : f.t < 14 ? -2.0 + (f.t - 8) / 6 * 3.3 : 1.3; ux2 = dir * Math.cos(th); uy2 = Math.sin(th);
    }
    if (f.state === 'zslash' && f.t >= 2) { const th = -2.1 + Math.min(1, ((f.t - 2) % 8) / 5) * 2.8; ux2 = dir * Math.cos(th); uy2 = Math.sin(th); }   // shoryuken à 3 coups : même arc que avant + Y
    if (f.state === 'fpunch' && f.t < 16) {   // avant + Y : coup de sabre en arc de cercle, du haut vers le bas en passant par l'avant
      const th = -2.1 + Math.min(1, f.t / 13) * 2.8; ux2 = dir * Math.cos(th); uy2 = Math.sin(th);
    }   // plongeon : lame pointée vers le sol
    // katana : poignée tressée, tsuba ronde, lame légèrement courbée
    for (let k = -4; k <= 0; k++) { const x = Math.round(swH[0] + ux2 * k), y = Math.round(swH[1] + uy2 * k); sR(x, y, 1, 1, (k & 1) ? '#e8e0d0' : '#1a1418'); }   // tsuka
    const tb = [swH[0] + ux2 * 1.5, swH[1] + uy2 * 1.5]; sR(tb[0] - 1, tb[1] - 1, 3, 3, '#2a2228'); sR(tb[0], tb[1] - 1, 1, 1, '#c8a040');      // tsuba
    const nx = uy2 * (dir > 0 ? 1 : -1), ny = -ux2 * (dir > 0 ? 1 : -1);   // normale : la lame se courbe vers le haut
    const wp = (k, c2) => [x + (swH[0] + ux2 * k + nx * c2 - OX) * UP, y + (swH[1] + uy2 * k + ny * c2 - OY) * UP];   // position à l'écran
    if (f.id === 0 || f.id === 1) f.swSeg = [wp(6, ((3) / 17) ** 1.6 * 3.4), wp(20, 3.4)];
    for (let k = 3; k <= 20; k++) {
      const c2 = ((k - 3) / 17) ** 1.6 * 3.4, x = Math.round(swH[0] + ux2 * k + nx * c2), y = Math.round(swH[1] + uy2 * k + ny * c2);
      sR(x, y, 1, 1, k > 18 ? '#ffffff' : '#e6eef2'); sR(Math.round(x - nx), Math.round(y - ny), 1, 1, '#8a98a4');
    }
  }
  applySprPatch(d, PN, dir);   // retouches Piskel (après le corps, avant les teintes et flashs)
  if (f.tintKeep) {   // teinte qui garde tous les détails (double rose de Vane)
    const T = TINTC || (TINTC = document.createElement('canvas')); T.width = SPR.width; T.height = SPR.height; const tx = T.getContext('2d');
    tx.clearRect(0, 0, T.width, T.height); tx.drawImage(SPR, 0, 0);
    sx.save(); sx.globalCompositeOperation = 'color'; sx.globalAlpha = .7; sx.fillStyle = f.tintKeep; sx.fillRect(0, 0, SPR.width, SPR.height);
    sx.globalAlpha = 1; sx.globalCompositeOperation = 'soft-light'; sx.fillStyle = 'rgba(255,90,210,.4)'; sx.fillRect(0, 0, SPR.width, SPR.height);
    sx.globalCompositeOperation = 'destination-in'; sx.drawImage(T, 0, 0); sx.restore();
  }
  if (f.tint) { sx.save(); sx.globalCompositeOperation = 'source-atop'; sx.fillStyle = f.tint; sx.fillRect(0, 0, SPR.width, SPR.height); sx.restore(); }   // silhouette teintée (échos, doubles)
  if (f.flash > 0) {
    const img = sx.getImageData(0, 0, SPR.width, SPR.height), dd = img.data;
    for (let i = 0; i < dd.length; i += 4) if (dd[i + 3]) { dd[i] = dd[i + 1] = dd[i + 2] = 255; }
    sx.putImageData(img, 0, 0);
  }
  const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  let src = SPR;
  let ang = null, cy = OY - 30 * K;
  if (d.float && f.state === 'walk' && Math.abs(f.vx) > .1) ang = (f.vx * f.dir > 0 ? 1 : -1) * dir * .14;   // légère inclinaison dans le sens du déplacement
  if (f.state === 'jump' && f.roll && f.t > 3) { const a0 = f.rollA0 || 0; ang = a0 + f.roll * dir * Math.min(1, (f.t - 3) / (f.rollT || 34)) * (Math.PI * 2 - Math.abs(a0)); }   // roulade avant / arrière (plus ou moins rapide)
  if (f.rotAng != null) { ang = f.rotAng; if (f.state === 'throw') cy = OY - 14 * K; if (f.state === 'grogroll') cy = OY - 12 * K * (d.size || 1); }
  if (ang != null) {
    // rotation autour du centre du corps, en basse résolution
    const cx = OX;
    rx.setTransform(1, 0, 0, 1, 0, 0); rx.clearRect(0, 0, ROLLC.width, ROLLC.height);
    rx.imageSmoothingEnabled = false;
    rx.translate(cx, cy); rx.rotate(mir ? -ang : ang); rx.drawImage(SPR, -cx, -cy);
    src = ROLLC;
  }
  if (mir) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(src, -OX * UP, Math.round(y) - OY * UP, SPR.width * UP, SPR.height * UP); ctx.restore(); }
  else ctx.drawImage(src, Math.round(x) - OX * UP, Math.round(y) - OY * UP, SPR.width * UP, SPR.height * UP);
  ctx.imageSmoothingEnabled = prev;
}

function drawShadow(f) {
  const hgt = Math.max(0, GROUND - f.y), k = 1 - Math.min(.55, hgt / 140);
  const al = .55 * Math.max(.12, 1 - hgt / 90);   // plus marquée au sol, s'estompe en sautant
  ctx.fillStyle = `rgba(20,8,2,${al.toFixed(3)})`;
  const w = (f.state === 'down' ? 34 : 24) * k;
  for (let dy = -2; dy <= 2; dy++) {
    const ww = Math.round(w * Math.sqrt(1 - (dy / 3) ** 2));
    ctx.fillRect(Math.round(f.x) - ww + (f.state === 'down' ? -8 * f.dir : 0), GROUND + 1 + dy, ww * 2, 1);
  }
}

/* ---------------- Audio (synthétisé) ---------------- */
let AC = null, NOISE = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const len = AC.sampleRate * .5;
    NOISE = AC.createBuffer(1, len, AC.sampleRate);
    const dd = NOISE.getChannelData(0);
    for (let i = 0; i < len; i++) dd[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
// volume des bruitages (option SFX, 0 à 4 barres ; 4 = 100 %)
const sfxVol = () => (typeof OPT === 'undefined' ? 4 : OPT.sfx) / 4;
// Chaîne audio « 16 bits » : bus des bruitages → légère saturation quantifiée → compresseur → sortie ; écho pour les sons de menu
let SFXOUT = null, SFXBUS = null, CRUNCH = null, ECHO = null, VERB = null, VECHO = null;
function sfxBus() {
  if (SFXBUS) return SFXBUS;
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = .002; comp.release.value = .12;
  comp.connect(AC.destination); SFXOUT = comp; if (typeof CAST !== 'undefined' && CAST.dest) comp.connect(CAST.dest);
  SFXBUS = AC.createGain(); SFXBUS.gain.value = 1; SFXBUS.connect(comp);
  CRUNCH = AC.createWaveShaper(); const n = 1024, cv2 = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, y = Math.tanh(x * 2.2); cv2[i] = Math.round(y * 24) / 24; }   // saturation + quantification (grain 16 bits)
  CRUNCH.curve = cv2; CRUNCH.connect(SFXBUS);
  ECHO = AC.createDelay(1); ECHO.delayTime.value = .11; const fb = AC.createGain(); fb.gain.value = .38; const wet = AC.createGain(); wet.gain.value = .5;
  ECHO.connect(fb).connect(ECHO); ECHO.connect(wet).connect(SFXBUS);
  VERB = AC.createConvolver(); const len = Math.round(AC.sampleRate * 2.2), ir = AC.createBuffer(2, len, AC.sampleRate);   // réverbe : salle synthétique
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  VERB.buffer = ir; const vg = AC.createGain(); vg.gain.value = .55; VERB.connect(vg).connect(SFXBUS); ECHO.connect(VERB);
  VECHO = AC.createDelay(1); VECHO.delayTime.value = .24; const vfb = AC.createGain(); vfb.gain.value = .32; const vwet = AC.createGain(); vwet.gain.value = .42;   // delay plus long pour les voix de l'annonceur
  VECHO.connect(vfb).connect(VECHO); VECHO.connect(vwet).connect(SFXBUS); VECHO.connect(VERB);
  return SFXBUS;
}
function tone(type, f0, f1, dur, vol, at = 0, out) {
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const v = Math.max(.0011, vol * sfxVol()); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(out || (sfxBus(), CRUNCH)); o.start(t); o.stop(t + dur + .02);
  return g;
}
function noise(dur, vol, freq, type = 'bandpass', f1, q = 1, at = 0) {
  const t = AC.currentTime + at, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const v = Math.max(.0011, vol * sfxVol()); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(fl).connect(g).connect((sfxBus(), CRUNCH)); s.start(t); s.stop(t + dur + .02);
}
// impact : claquement aigu + coup sourd qui descend (style arcade 16 bits)
const smack = (snapF, snapV, f0, f1, dur, vol) => { noise(.05, snapV, snapF, 'highpass', 0, .7); noise(dur * .8, vol * .7, 900, 'lowpass', 160); tone('sine', f0, f1, dur, vol); tone('square', f0 * 1.5, f1, dur * .45, vol * .35); };
// Vrais bruitages d'impact (extraits de « Punch & Impact Sound Effects ») : légers, lourds, chute, KO
const SFX_FILES = { light: ['hit2', 'hit3'], heavy: ['hit1', 'hit4'], thud: ['hit6'], ko: ['hit5'], r1: ['round-1'], r2: ['round-2'], r3: ['round-3'], fight: ['fight'], kov: ['ko'], win: ['you-win'], lose: ['you-lose'], perfect: ['perfect'], swing: ['wh1', 'wh2', 'wh4', 'wh5'], jump: ['wh3', 'wh6', 'wh7'], fb: ['fireball'], vcharge: ['vane-charge'], vlaunch: ['vane-launch'], wh4: ['wh4'], tele: ['tele1', 'tele2', 'tele3', 'tele4'], counter: ['ctr1', 'ctr2', 'ctr3', 'ctr4'], clash: ['tele4'], obj: ['obj1', 'obj2', 'obj3'], congrats: ['congratulations'] };   // whoosh.mp3 découpé   // + voix de l'annonceur
const SFX_BUF = {}; let sfxLoading = false;
function loadSfx() {
  if (sfxLoading || !AC) return; sfxLoading = true;
  // ouvert en local (fichier sur l'ordinateur) : le navigateur interdit fetch() -> on charge les sons intégrés dans sfx-data.js
  const local = location.protocol === 'file:';
  const get = nm => local ? Promise.resolve(Uint8Array.from(atob(window.SFX_DATA[nm]), ch => ch.charCodeAt(0)).buffer) : fetch('sfx/' + nm + '.mp3?v=178').then(r => r.arrayBuffer());
  const go = () => { for (const k in SFX_FILES) SFX_FILES[k].forEach((nm, i) => get(nm).then(b => AC.decodeAudioData(b)).then(buf => { (SFX_BUF[k] = SFX_BUF[k] || [])[i] = buf; }).catch(() => {})); };
  if (local && !window.SFX_DATA) { const sc = document.createElement('script'); sc.src = 'sfx-data.js'; sc.onload = go; document.head.appendChild(sc); } else go();
}
const VOX = 1;   // hauteur des voix de l'annonceur (1 = voix d'origine)
function playSample(k, vol = 1, rate = 1, exact = false, at = 0) {
  const L = (SFX_BUF[k] || []).filter(Boolean); if (!L.length) return false;
  const src = AC.createBufferSource(), g = AC.createGain();
  src.buffer = L[Math.random() * L.length | 0]; src.playbackRate.value = exact ? rate : rate * (.94 + Math.random() * .12);   // légère variation à chaque coup
  g.gain.value = vol * sfxVol(); src.connect(g).connect(sfxBus()); if (exact) { g.connect(VECHO); g.connect(VERB); }   // voix : delay + réverbe
  src.start(AC.currentTime + at);
  return true;
}
// Sphère de Lord Vane : son de charge qui monte tant que A est maintenu, coupé net au lancer
function vaneChargeStart(f) {
  vaneChargeStop(f); if (!AC) return;
  const L = (SFX_BUF.vcharge || []).filter(Boolean); if (!L.length) return;
  const src = AC.createBufferSource(), g = AC.createGain(); src.buffer = L[0]; src.playbackRate.value = 1.6;
  g.gain.value = .9 * sfxVol(); src.connect(g).connect(sfxBus()); src.start(); f.chSnd = { src, g };
}
function vaneChargeStop(f) {
  const c = f.chSnd; if (!c || !AC) return; f.chSnd = null;
  try { const t = AC.currentTime; c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(.0001, t + .08); c.src.stop(t + .1); } catch (e) {}
}
function sfx(n) {
  if (AC && !sfxLoading) loadSfx();
  if (!AC || (typeof OPT !== 'undefined' && OPT.sfx === 0)) return;
  try {
    switch (n) {
      case 'tally': { const g = tone('square', 1568, 1568, .035, .16); try { g.connect(ECHO); } catch (e) {} break; }   // décompte du score (écho + réverbe)
      case 'tallyEnd': [1046, 1318, 1568].forEach((fq, i) => { const g = tone('square', fq, fq, i === 2 ? .5 : .14, .2, i * .13); try { g.connect(ECHO); } catch (e) {} }); break;   // fin du décompte : trois notes
      case 'whoosh': if (!playSample('swing', .8)) noise(.13, .4, 500, 'bandpass', 2600, 1.4); break;   // coup donné dans l'air
      case 'jump': if (!playSample('jump', .55, .9)) noise(.18, .3, 400, 'bandpass', 1600, 1.2); break;   // saut   // fouetté qui siffle vers l'aigu
      case 'hit': if (!playSample('light', 1)) smack(2400, .8, 190, 60, .12, .9); break;                 // coup léger
      case 'heavy': if (!playSample('heavy', 1.1)) { smack(1600, 1, 150, 38, .24, 1.1); noise(.3, .6, 380, 'lowpass', 90); } break;   // gros coup
      case 'block': if (!playSample('thud', .85, 1.35)) { tone('square', 1100, 700, .045, .35); noise(.06, .6, 3800, 'bandpass', 0, 2); } break;   // garde : son de chute, joué plus aigu
      case 'fb': if (playSample('fb', 1)) break; tone('sawtooth', 300, 90, .45, .3); tone('square', 600, 140, .3, .14); noise(.45, .45, 1400, 'bandpass', 300, .8); break;   // projectile : souffle d'énergie
      case 'upper': if (!playSample('jump', .7, 1)) { noise(.22, .45, 400, 'bandpass', 3000, 1.2); tone('square', 200, 820, .22, .16); } break;   // shoryuken et envols : même whoosh que le saut
      case 'ko': playSample('ko', 1.2, .85); tone('sine', 140, 28, 1.2, .6); tone('sawtooth', 220, 40, 1, .3); noise(1.2, .7, 600, 'lowpass', 60); noise(.08, .9, 2000, 'highpass'); break;
      case 'thud': if (!playSample('thud', 1)) { tone('sine', 110, 32, .3, .9); noise(.25, .6, 400, 'lowpass', 70); } break;   // chute au sol
      case 'crash': if (playSample('obj', 1)) break; noise(.25, .55, 2600); noise(.12, .45, 900); tone('triangle', 1400, 500, .12, .12); break;
      case 'beep': {   // déplacement du curseur : note aiguë 8 bits (une noire) avec delay et réverbe
        sfxBus(); const g = tone('square', 1760, 1760, .5, .14, 0, SFXBUS); g.connect(ECHO); g.connect(VERB);
        break;
      }
      case 'charge': tone('sawtooth', 180, 260, .18, .12); break;   // sphère en charge
      case 'swing4': if (!playSample('wh4', .8)) noise(.13, .4, 500, 'bandpass', 2600, 1.4); break;   // accroupi + Y
      case 'tele': if (!playSample('tele', .9)) tone('square', 1200, 2200, .12, .14); break;   // téléportations
      case 'counter': if (!playSample('counter', 1.1)) { tone('square', 1800, 1800, .09, .22); tone('triangle', 2700, 2600, .35, .25); } break;   // contre réussi
      case 'go': tone('square', 660, 1320, .3, .2); break;
      case 'select': {   // validation : arpège très rapide vers l'aigu avec écho (style Street Fighter)
        sfxBus(); const N = [784, 1175, 1568];   // tonique, quinte, octave
        N.forEach((fq, i) => { const last = i === N.length - 1, g = tone('square', fq, fq, last ? .45 : .11, .3, i * .075, SFXBUS); g.connect(ECHO); g.connect(VERB); });
        const g2 = tone('triangle', 1568, 1568, .6, .18, 2 * .075, SFXBUS); g2.connect(VERB);
        break;
      }
      case 'parry': playSample('clash', 1); break;   // deux projectiles qui se touchent / parade : tele4
    }
  } catch (e) {}
}

/* ---------------- Entrées : clavier + tactile ---------------- */
const BTNS = ['p', 'k', 's', 'x'];
const keys = new Set();
const latched = new Set(); // appuis très brefs (entre deux frames)
// Marche style Streets of Rage : buste droit, bras le long du corps qui balancent
// à l'opposé des jambes, léger rebond. 8 images générées pour une animation fluide.
const WALK_N = 8, WALK_A = 8.5;   // amplitude du pas (unités squelette)
for (let i = 0; i < WALK_N; i++) {
  const ph = i / WALK_N * Math.PI * 2;
  const bob = -1.6 * (1 + Math.cos(2 * ph)) / 2;            // le corps monte quand les jambes se croisent
  const hipY = -30 + bob;
  const leg = p => {
    const fx = WALK_A * Math.sin(p), lift = -6.5 * Math.max(0, Math.cos(p));   // pied qui avance = pied levé
    const fy = lift;
    const kx = fx * .5 + 2.5 - lift * .45, ky = (hipY + fy) / 2 + lift * .35;
    return [kx, ky, fx, fy];
  };
  const L1 = leg(ph), L2 = leg(ph + Math.PI);
  const arm = (p, x0) => {                                   // bras pendant, balancier
    const sw = Math.sin(p);
    const ex = x0 + 2.6 * sw, ey = -38.5 + bob + Math.abs(sw) * .6;
    // coude bien plié (~60°) : l'avant-bras part légèrement vers l'avant
    return [ex, ey, ex + 7.6 + 1.8 * sw, ey + 4.6 - Math.max(0, sw) * 1.2];   // avant-bras (partie nue) plié vers l'avant
  };
  const A1 = arm(ph + Math.PI, 2.5), A2 = arm(ph, -1.5);     // bras opposé à la jambe du même côté
  POSES['wk' + i] = [4, -57 + bob, 2, -49 + bob, .5, hipY, ...A1, ...A2, ...L1, ...L2].map(v => Math.round(v * 2) / 2);
  const hc = POSES.hatc, dy = bob - 2;   // Zephyr qui marche en tenant son chapeau (charge)
  POSES['wkh' + i] = [4, -57 + bob, 2, -49 + bob, .5, hipY, hc[6], hc[7] + dy, hc[8], hc[9] + dy, hc[10], hc[11] + dy, hc[12], hc[13] + dy, ...L1, ...L2].map(v => Math.round(v * 2) / 2);
}

// Touches du clavier (personnalisables dans OPTIONS > KEYBOARD) et boutons de manette (OPTIONS > GAMEPAD)
const KEY_DEF = { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown', p: 'KeyJ', k: 'KeyK', s: 'KeyL', x: 'KeyI', start: 'Enter', back: 'Escape' };   // J = Y, K = B, L = A, I = X
const PAD_DEF = { p: 3, k: 1, s: 0, x: 2, start: 9, back: 8 };   // manette Xbox : Y = coup de poing, B = pied, A = spécial, X = contre
let KEYS = Object.assign({}, KEY_DEF), PADB = Object.assign({}, PAD_DEF);
let padCustom = false;   // boutons de manette modifiés à la main
try { const sv = JSON.parse(localStorage.getItem('sf2keys') || 'null'); if (sv) { Object.assign(KEYS, sv.k || {}); if (KEYS.x === 'Space') KEYS.x = 'KeyI';   /* ancien réglage : X passe sur I (Espace reste actif) */ if (sv.p) { Object.assign(PADB, sv.p); padCustom = !!sv.pc; } } } catch (e) {}
const saveKeys = () => { try { localStorage.setItem('sf2keys', JSON.stringify({ k: KEYS, p: PADB, pc: padCustom })); } catch (e) {} };
// Type de manette : AUTO (détecté), XBOX, PLAYSTATION, SWITCH PRO, JOY-CON -> noms des boutons et boutons par défaut adaptés
const PAD_TYPES = ['AUTO', 'XBOX', 'PLAYSTATION', 'SWITCH PRO', 'JOY-CON'];
let padType = 0; try { padType = Math.max(0, Math.min(4, +(localStorage.getItem('sf2padtype') || 0))); } catch (e) {}
function padKind() {   // type réellement utilisé : 'xbox' | 'ps' | 'switch' | 'joycon'
  if (padType) return ['', 'xbox', 'ps', 'switch', 'joycon'][padType];
  let id = ''; try { const g = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find(Boolean); id = g ? g.id : ''; } catch (e) {}
  if (/joy-?con/i.test(id)) return 'joycon';
  if (/057e|nintendo|pro controller|switch/i.test(id)) return 'switch';
  if (/054c|playstation|dualshock|dualsense|wireless controller|ps[345]/i.test(id)) return 'ps';
  return 'xbox';
}
// Switch : boutons placés comme sur la manette (A à droite, B en bas, Y à gauche, X en haut) -> A = spécial, B = pied, Y = poing, X = contre
const padDefault = () => (padKind() === 'switch' || padKind() === 'joycon') ? { p: 2, k: 0, s: 1, x: 3, start: 9, back: 8 } : Object.assign({}, PAD_DEF);
function padApplyDefault() { PADB = padDefault(); padCustom = false; saveKeys(); }
function keyAction(code) {
  for (const a in KEYS) if (KEYS[a] === code) return a;
  const ALT = { KeyW: 'u', KeyA: 'l', KeyS: 'd', KeyD: 'r', Space: 'x' };   // ZQSD (AZERTY) / WASD (QWERTY) : mêmes touches physiques ; flèches toujours actives
  if (ALT[code]) return ALT[code];
  if (code === 'Enter') return 'start'; if (code === 'Escape' || code === 'Backspace') return 'back';   // toujours utilisables dans les menus
  return null;
}
let bindWait = null;   // { dev: 'kb' | 'pad', act } : attente d'une touche / d'un bouton à associer
addEventListener('keydown', e => {
  initAudio();
  if (bindWait && bindWait.dev === 'kb') {   // capture de la nouvelle touche
    e.preventDefault();
    if (e.code !== 'Escape') bindKey('kb', bindWait.act, e.code);
    bindWait = null; keys.clear(); return;
  }
  if (bindWait && bindWait.dev === 'pad') {   // réglage manette en attente : ÉCHAP annule, HAUT / BAS change de ligne sans rien modifier
    if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); bindWait = null; keys.clear(); sfx('beep'); return; }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); bindMove(e.code === 'ArrowUp' ? -1 : 1); return; }
  }
  const m = keyAction(e.code);
  if (m) { keys.add(m); latched.add(m); e.preventDefault(); }
  if ((m === 's' || m === 'start') && G.showOpts && !G.showKeys && G.ocur === 0) { OPT.full = !OPT.full; saveOpt(); sfx('select'); G.fsDone = G.frame; if (OPT.full) enterFS(); else exitFS(); }   // option PLEIN ÉCRAN (validée pendant l'appui : autorisé par le navigateur)
});
addEventListener('keyup', e => { const m = keyAction(e.code); if (m) keys.delete(m); });
function bindKey(dev, act, val) {   // associe et échange si la touche était déjà utilisée
  const M = dev === 'kb' ? KEYS : PADB;
  for (const a in M) if (M[a] === val && a !== act) M[a] = M[act];
  M[act] = val; saveKeys(); sfx('select');
}
// Manette (Xbox en Bluetooth, etc.) : API Gamepad du navigateur
let padPrev = [];
function padList() { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch (e) { return []; } }
let padKindLast = null;
function readPad(i) {
  const gp = padList()[i], o = {}; if (!gp) return o;
  if (i === 0 && !padCustom) { const k = padKind(); if (k !== padKindLast) { padKindLast = k; PADB = padDefault(); } }   // boutons par défaut selon la manette détectée
  const B = n => !!(gp.buttons[n] && gp.buttons[n].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, menu = inMenu(), dz = menu ? .6 : .38;
  o.l = B(14) || ax < -dz; o.r = B(15) || ax > dz; o.u = B(12) || ay < -dz; o.d = B(13) || ay > dz;
  for (const a in PADB) if (B(PADB[a])) o[a] = true;
  if (o.l || o.r || o.u || o.d || gp.buttons.some(b => b.pressed)) initAudio();   // manette : active le son dès le premier appui (sons du menu de démarrage)
  if (i === 0 && bindWait && bindWait.dev === 'pad') {   // capture du nouveau bouton
    const now = gp.buttons.map(b => b.pressed);
    const n = now.findIndex((p, k) => p && !padPrev[k] && k !== 12 && k !== 13 && k !== 14 && k !== 15);
    const mv = now[12] && !padPrev[12] ? -1 : now[13] && !padPrev[13] ? 1 : 0;   // croix haut / bas : ligne suivante / précédente sans changement
    padPrev = now;
    if (mv) { bindMove(mv); return {}; }
    if (n >= 0) { padCustom = true; bindKey('pad', bindWait.act, n); bindWait = null; G.padLock = 12; }
    return {};
  }
  if (i === 0) padPrev = gp.buttons.map(b => b.pressed);
  if (G.padLock > 0) { G.padLock--; return {}; }
  return o;
}
function bindMove(m) {   // annule l'attente et passe à la ligne précédente / suivante
  bindWait = null; keys.clear(); G.padLock = 8;
  const N = bindRows().length + 2; G.kcur = Math.max(0, Math.min(N - 1, (G.kcur || 0) + m)); sfx('beep');
}
const PAD_NAMES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'XBOX'],
  ps: ['\u2715', '\u25CB', '\u25A1', '\u25B3', 'L1', 'R1', 'L2', 'R2', 'CREATE', 'OPTIONS', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'PS'],
  switch: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '-', '+', 'LS', 'RS', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME', 'CAPTURE'],
  joycon: ['B', 'A', 'Y', 'X', 'SL', 'SR', 'ZL', 'ZR', '-', '+', 'STICK', 'STICK', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME', 'CAPTURE'] };
const padName = n => (PAD_NAMES[padKind()] || PAD_NAMES.xbox)[n] || 'BTN ' + n;
function keyName(c) {
  if (!c) return '-';
  const M = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', Backspace: 'BKSP', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Tab: 'TAB' };
  return M[c] || c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase();
}
const padOn = () => padList().length > 0;
// libellé d'un bouton du jeu (Y/B/A/X) selon l'appareil utilisé : clavier, manette ou tactile
function btnLabel(b) {
  const act = { Y: 'p', B: 'k', A: 's', X: 'x' }[b];
  if (isTouch && !padOn()) return b;
  return padOn() ? padName(PADB[act]) : keyName(KEYS[act]);
}
addEventListener('blur', () => keys.clear());

const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || /[?&]touch/.test(location.search);
if (isTouch) document.body.classList.add('touch');
if (isTouch && innerHeight > innerWidth) document.body.classList.add('needrot');   // démarré en portrait : « ROTATE YOUR PHONE » reste jusqu'à CONTINUE, même après la rotation
document.body.classList.add('booting');   // écran de démarrage : pas de bouton START de la manette

const touch = { x: 0, y: 0, btn: new Set() };
let tap = null; // dernier tap en coordonnées canvas

(() => {
  const zone = document.getElementById('stickZone'), stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let id = null;
  const upd = e => {
    const r = stick.getBoundingClientRect();
    const rad = (ROT ? r.height : r.width) / 2;
    let sx = e.clientX - (r.left + r.width / 2), sy = e.clientY - (r.top + r.height / 2);
    let dx = ROT ? sy : sx, dy = ROT ? -sx : sy;
    const l = Math.hypot(dx, dy);
    if (l > rad) { dx *= rad / l; dy *= rad / l; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    touch.x = dx / rad; touch.y = dy / rad;
  };
  const end = e => {
    if (e.pointerId !== id) return;
    id = null; touch.x = touch.y = 0; knob.style.transform = 'translate(-50%,-50%)';
  };
  zone.addEventListener('pointerdown', e => { id = e.pointerId;   /* un nouveau doigt reprend toujours le stick (évite un stick bloqué si un relâché a été perdu) */ zone.setPointerCapture(id); upd(e); e.preventDefault(); });
  zone.addEventListener('pointermove', e => { if (e.pointerId === id) upd(e); });
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);   // doigt perdu (notification, geste système...) : le stick revient au centre
  document.addEventListener('visibilitychange', () => { if (document.hidden) { id = null; touch.x = touch.y = 0; knob.style.transform = 'translate(-50%,-50%)'; touch.btn.clear(); keys.clear(); } });

  const bz = document.getElementById('btnZone');
  const owners = new Map();
  const refresh = () => {
    touch.btn.clear();
    document.querySelectorAll('.b').forEach(b => b.classList.remove('on'));
    owners.forEach(el => { if (el) { touch.btn.add(el.dataset.b); latched.add(el.dataset.b); el.classList.add('on'); } });
  };
  const pick = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest ? el.closest('.b') : null; };
  bz.addEventListener('pointerdown', e => { bz.setPointerCapture(e.pointerId); owners.set(e.pointerId, pick(e)); refresh(); e.preventDefault(); });
  bz.addEventListener('pointermove', e => { if (owners.has(e.pointerId)) { owners.set(e.pointerId, pick(e)); refresh(); } });
  const bend = e => { owners.delete(e.pointerId); refresh(); };
  bz.addEventListener('pointerup', bend);
  bz.addEventListener('pointercancel', bend);
  bz.addEventListener('lostpointercapture', bend);
  const sb = document.getElementById('startBtn');
  if (sb) {
    sb.addEventListener('pointerdown', e => { latched.add('start'); sb.classList.add('on'); e.preventDefault(); e.stopPropagation(); });
    const off = () => sb.classList.remove('on');
    sb.addEventListener('pointerup', off); sb.addEventListener('pointercancel', off); sb.addEventListener('pointerleave', off);
  }
})();

// Bouton « Continuer » de l'écran portrait (rotation verrouillée)
const ROT_EL = document.getElementById('rotate');
const rotateShown = () => !!ROT_EL && getComputedStyle(ROT_EL).display !== 'none';
document.getElementById('rotateOk').addEventListener('click', () => { document.body.classList.add('rotok'); resize(); });

let fsTried = false;
addEventListener('pointerdown', e => {
  initAudio();
  const r = cv.getBoundingClientRect();
  tap = e.target !== cv ? null : ROT
    ? { x: (e.clientY - r.top) / r.height * W, y: (r.right - e.clientX) / r.width * H }
    : { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  syncFS();   // plein écran (demandé au premier toucher, si l'option est activée)
}, { passive: true });
// Plein écran : activé par défaut sur mobile, réglable dans OPTIONS. Le navigateur n'accepte l'entrée en plein écran qu'après une action du joueur.
const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function enterFS() {
  const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!rq || isFS()) return;
  try { const pr = rq.call(el); if (pr && pr.then) pr.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (err) {}
}
function exitFS() { const ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex && isFS()) { try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
function syncFS() { if (typeof OPT === 'undefined') return; if (OPT.full) enterFS(); }
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => {
  if (!isFS() && !isTouch && typeof OPT !== 'undefined' && OPT.full) { OPT.full = false; saveOpt(); }   // PC : ÉCHAP quitte le plein écran et désactive l'option
}));
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// Stick tactile : très petite zone morte, la direction est choisie selon l'angle (8 directions)
function stickDirs() {
  const x = touch.x, y = touch.y, m = Math.hypot(x, y);
  if (m < 0.15) return { l: false, r: false, u: false, d: false };
  const ax = Math.abs(x) / m, ay = Math.abs(y) / m;   // cos de l'angle avec chaque axe
  const H = ax > 0.38, V = ay > 0.38;                // secteurs de 67,5° : diagonales comprises
  return { l: H && x < 0, r: H && x > 0, u: V && y < 0, d: V && y > 0 };
}
// Menus : stick moins sensible (60 %) — il faut pousser franchement, une seule direction à la fois
function menuStickDirs() {
  const x = touch.x, y = touch.y, m = Math.hypot(x, y), o = { l: false, r: false, u: false, d: false };
  if (m < 0.55) return o;
  if (Math.abs(y) > Math.abs(x) * 1.4) { if (y < 0) o.u = true; else o.d = true; }
  else if (Math.abs(x) > Math.abs(y) * 1.4) { if (x < 0) o.l = true; else o.r = true; }
  return o;
}
const inMenu = () => G.paused || ['title', 'select', 'stage', 'over'].includes(G.scene);
function readPlayer() {
  const st = inMenu() ? menuStickDirs() : stickDirs();
  const K = k => keys.has(k) || latched.has(k);
  const r = {
    l: K('l') || st.l,
    r: K('r') || st.r,
    u: K('u') || st.u,
    d: K('d') || st.d,
    p: K('p') || touch.btn.has('p'),
    k: K('k') || touch.btn.has('k'),
    s: K('s') || touch.btn.has('s'),
    x: K('x') || touch.btn.has('x'),
    start: K('start'),
    back: K('back'),
  };
  latched.clear();
  const ps = padSlots(); if (ps.p1 != null) { const gp = readPad(ps.p1); for (const b in gp) if (gp[b]) r[b] = true; }   // manette branchée sur le PC
  const rm = readRemote(1);   // manette smartphone du joueur 1
  for (const b in rm) if (rm[b]) r[b] = true;
  return r;
}

/* ---------------- Manettes smartphone (PeerJS / WebRTC) ---------------- */
// Le PC crée un « peer » ; chaque téléphone scanne un QR code (Player 1 / Player 2), ouvre controller.html
// et envoie l'état de ses boutons directement au PC.
const NET = { peer: null, id: null, status: 'off', rem: { 1: null, 2: null } };
function remDirs(r, menu) {
  const x = r.x || 0, y = r.y || 0, m = Math.hypot(x, y), o = { l: false, r: false, u: false, d: false };
  if (menu) {
    if (m < .55) return o;
    if (Math.abs(y) > Math.abs(x) * 1.4) { if (y < 0) o.u = true; else o.d = true; }
    else if (Math.abs(x) > Math.abs(y) * 1.4) { if (x < 0) o.l = true; else o.r = true; }
    return o;
  }
  if (m < .15) return o;
  const ax = Math.abs(x) / m, ay = Math.abs(y) / m;
  return { l: ax > .38 && x < 0, r: ax > .38 && x > 0, u: ay > .38 && y < 0, d: ay > .38 && y > 0 };
}
function readRemote(p) {
  const r = NET.rem[p], o = {};
  if (!r || !r.open) return o;
  Object.assign(o, remDirs(r, inMenu()));
  for (const b of ['p', 'k', 's', 'x', 'start']) o[b] = !!(r.held[b] || r.tap[b]);
  r.tap = {};
  return o;
}
const remoteOn = p => !!(NET.rem[p] && NET.rem[p].open);
// État envoyé à chaque manette smartphone : personnage choisi, énergie, résultat (YOU WIN / YOU LOSE)
function netStateFor(p) {
  const fi = p - 1, fightSc = ['intro', 'fight', 'ko', 'timeup', 'score', 'over'].includes(G.scene);
  if (fightSc && G.f && G.f[fi]) {
    const f = G.f[fi];
    return { t: 'st', ch: f.def.idx, name: f.def.name, hp: Math.round(f.hp), res: G.scene === 'over' ? (f.wins >= 2 ? 'win' : 'lose') : null };
  }
  let ch = null;
  if (G.scene === 'select' || G.scene === 'stage') ch = p === 1 ? (G.selPhase || G.scene === 'stage' ? G.p1 : null) : (G.scene === 'stage' ? G.p2 : null);
  return ch == null ? { t: 'st', ch: null } : { t: 'st', ch, name: fighterDef(ch).name, hp: 100, res: null };
}
function netSendState() {
  if (G.frame % 6) return;
  if (NET.guest && NET.guest.conn && NET.guest.conn.open) {   // Player 2 en ligne : combat ou menu (pour activer Y / X et les noms des boutons)
    const fi = ['intro', 'fight', 'ko', 'timeup'].includes(G.scene) && !G.demo, g = NET.guest;
    if (fi !== g.fiSent || G.frame - (g.fiF || 0) > 60) { g.fiSent = fi; g.fiF = G.frame; try { g.conn.send({ t: 'sc', fi }); } catch (e) {} }
  }
  for (const p of [1, 2]) {
    const r = NET.rem[p]; if (!r || !r.open) continue;
    const m = netStateFor(p), k = JSON.stringify(m);
    if (k !== r.sent || G.frame - (r.sentF || 0) > 60) { r.sent = k; r.sentF = G.frame; try { r.conn.send(m); } catch (e) {} }
  }
}
// Répartition des manettes du PC (Xbox, etc.) entre les joueurs :
// smartphone en joueur 1 → la 1re manette va au joueur 2 ; sinon 1re manette = joueur 1, 2e manette = joueur 2
function padSlots() {
  const n = padList().length, o = { p1: null, p2: null };
  if (remoteOn(1)) { if (!remoteOn(2) && n >= 1) o.p2 = 0; else if (n >= 1) o.p1 = 0; }
  else { if (n >= 1) o.p1 = 0; if (!remoteOn(2) && n >= 2) o.p2 = 1; }
  return o;
}
const p2On = () => remoteOn(2) || padSlots().p2 != null;   // joueur 2 humain (smartphone ou manette)
function readP2() {
  const o = readRemote(2), ps = padSlots();
  if (ps.p2 != null) { const gp = readPad(ps.p2); for (const b in gp) if (gp[b]) o[b] = true; }
  return o;
}
// Serveurs STUN/TURN publics : aident les téléphones à se connecter même derrière une box ou en 4G
const ICE = { iceServers: [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
] };
function netRetry() {   // le réseau revient (Wi-Fi / 4G activé pendant le jeu) : on recharge PeerJS si besoin et on relance la connexion, sans redémarrer
  if (G.guest || !navigator.onLine || (NET.peer && NET.id && !NET.peer.disconnected && !NET.peer.destroyed)) return;
  if (typeof Peer === 'undefined') {
    if (netRetry.loading) return; netRetry.loading = true;
    const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
    sc.onload = () => { netRetry.loading = false; netStart(); }; sc.onerror = () => { netRetry.loading = false; sc.remove(); };
    document.head.appendChild(sc); return;
  }
  if (NET.peer && NET.id && NET.peer.disconnected && !NET.peer.destroyed) { try { NET.peer.reconnect(); } catch (e) {} return; }
  if (NET.peer && !NET.id) { try { NET.peer.destroy(); } catch (e) {} NET.peer = null; }
  if (loadDone()) netStart();
}
window.addEventListener('online', () => setTimeout(netRetry, 500));
setInterval(netRetry, 6000);   // filet de sécurité si l'événement « online » n'arrive pas
function netStart() {
  if (G.guest || NET.peer || typeof Peer === 'undefined') return;
  // identifiant gardé d'une session à l'autre : les téléphones déjà connectés se reconnectent seuls si la page est rechargée
  let id = null; try { id = localStorage.getItem('sf2host'); } catch (e) {}
  if (!id) { id = 'sf2-' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem('sf2host', id); } catch (e) {} }
  NET.status = 'connecting';
  try { NET.peer = new Peer(id, { config: ICE }); } catch (e) { NET.status = 'error'; return; }
  NET.peer.on('open', pid => { NET.id = pid; NET.status = 'ready'; makeQRs(); });
  NET.peer.on('error', e => {
    if (e && e.type === 'unavailable-id') {   // identifiant déjà pris (autre onglet) : on en prend un nouveau
      try { localStorage.removeItem('sf2host'); NET.peer.destroy(); } catch (_) {}
      NET.peer = null; setTimeout(netStart, 300); return;
    }
    if (!NET.id) NET.status = 'error';
  });
  NET.peer.on('disconnected', () => { setTimeout(() => { try { if (NET.peer && !NET.peer.destroyed) NET.peer.reconnect(); } catch (e) {} }, 1000); });   // reconnexion au serveur de signalisation
  NET.peer.on('connection', conn => {
    const p = (conn.metadata && conn.metadata.p) === 2 ? 2 : 1;
    if (NET.rem[p] && NET.rem[p].conn && NET.rem[p].conn !== conn) { const old = NET.rem[p].conn; try { old.send({ t: 'bye', why: 'replaced' }); } catch (e) {} setTimeout(() => { try { old.close(); } catch (e) {} }, 300); }   // une seule manette par joueur : l'ancienne page est prévenue et s'arrête
    const r = NET.rem[p] = { conn, open: false, held: {}, tap: {}, x: 0, y: 0, last: performance.now() };
    const opened = () => { if (r.open) return; r.open = true; r.last = performance.now(); sfx('select'); try { conn.send({ t: 'hi', p }); } catch (e) {} if (conn.metadata && conn.metadata.guest) guestJoined(conn); };
    conn.on('open', opened); if (conn.open) opened();
    conn.on('data', m => {
      r.last = performance.now(); if (!r.open) opened();
      if (m && m.t === 'li') { lsRecv(m); return; }
      if (m && m.t === 'ck') { lsRecvCk(m); return; }
      if (m && m.t === 'end') { lsDesync(); return; }
      if (m && m.t === 'gw') { if (NET.guest && NET.guest.conn === conn) NET.guest.w = +m.w || 0; return; }
      if (m && m.t === 'po') { const rt = performance.now() - m.ts; LS.rtt = LS.rtt ? LS.rtt * .7 + rt * .3 : rt; return; }
      if (!m || m.t !== 'in') return;
      for (const b of ['p', 'k', 's', 'x', 'start']) { const v = !!(b === 'x' ? m.bx : m[b]); if (v && !r.held[b]) r.tap[b] = true; r.held[b] = v; }
      r.x = +m.x || 0; r.y = +m.y || 0;
    });
    conn.on('close', () => { if (NET.rem[p] === r) { r.open = false; r.held = {}; r.x = r.y = 0; } if (NET.guest && NET.guest.conn === conn) { try { NET.guest.call && NET.guest.call.close(); } catch (e) {} NET.guest = null; if (LS.role === 1) lsStop(); addNote('PLAYER 2 LEFT'); } });
    conn.on('error', () => {});
  });
  // battement de cœur : le PC répond régulièrement ; une manette muette depuis 6 s est considérée déconnectée (elle se reconnecte seule)
  if (NET.hb) return; NET.hb = setInterval(() => {
    const now = performance.now();
    for (const p of [1, 2]) {
      const r = NET.rem[p]; if (!r || !r.conn) continue;
      if (r.open) { try { r.conn.send({ t: 'hb' }); if (NET.guest && NET.guest.conn === r.conn) r.conn.send({ t: 'pg', ts: performance.now() }); } catch (e) {} }
      if (r.open && now - r.last > 6000) { r.open = false; r.held = {}; r.x = r.y = 0; }
    }
  }, 1000);
}

/* ---------------- MULTIJOUEUR EN LIGNE (invitation) ----------------
   Le Player 1 (hôte) fait tourner le jeu et envoie l'image + le son en direct (WebRTC / PeerJS).
   Le Player 2 ouvre le lien d'invitation (?join=ID) : il voit le jeu en vidéo et envoie ses touches comme une manette. */
const JOIN = (() => { try { return new URLSearchParams(location.search).get('join'); } catch (e) { return null; } })();
const CAST = { cv: null, cx: null, stream: null, dest: null };
const inviteURL = () => NET.id ? location.origin + location.pathname.replace(/[^/]*$/, '') + 'join.html?join=' + encodeURIComponent(NET.id) : '';
let QR_INV = null, QR_INV_ID = null;
function inviteQR() {   // QR code du lien d'invitation (option locale)
  if (!NET.id || typeof qrcode === 'undefined') return null;
  if (QR_INV && QR_INV_ID === NET.id) return QR_INV;
  const q = qrcode(0, 'M'); q.addData(inviteURL()); q.make();
  const n = q.getModuleCount(), c = document.createElement('canvas'), m = 2, pad = 3; c.width = c.height = (n + pad * 2) * m;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + pad) * m, (y + pad) * m, m, m);
  QR_INV_ID = NET.id; return QR_INV = c;
}
function castStream() {   // image du jeu (calque HD + pixels) et son, envoyés au Player 2
  if (!CAST.cv) { CAST.cv = document.createElement('canvas'); CAST.cx = CAST.cv.getContext('2d'); CAST.cv.width = 768; CAST.cv.height = 432; castFrame(true); }
  if (!CAST.stream) {
    CAST.stream = CAST.cv.captureStream(30);
    try { initAudio(); if (AC) { CAST.dest = AC.createMediaStreamDestination(); sfxBus(); if (SFXOUT) SFXOUT.connect(CAST.dest); if (bgmGain) bgmGain.connect(CAST.dest); CAST.dest.stream.getAudioTracks().forEach(t => CAST.stream.addTrack(t)); } } catch (e) {}
  }
  return CAST.stream;
}
function castFrame(force) {
  if (!CAST.cv || (!force && !(NET.guest && NET.guest.call))) return;
  const w = W * 2, h = H * 2, c = CAST.cx; if (CAST.cv.width !== w) { CAST.cv.width = w; CAST.cv.height = h; }
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  if (HI.style.visibility === 'visible') { c.imageSmoothingEnabled = true; c.drawImage(HI, 0, 0, w, h); }
  c.imageSmoothingEnabled = false; c.drawImage(cv, 0, 0, w, h);
}
function guestJoined(conn) {   // un joueur a ouvert le lien : il devient le Player 2
  NET.guest = { conn, call: null };
  try { NET.guest.call = NET.peer.call(conn.peer, castStream(), { metadata: { cast: true } }); } catch (e) {}
  G.invPop = false; G.qrPop = false;
  if (G.mode === 'arcade' || G.mode === 'tutorial') G.mode = 'vs';
  if (G.scene === 'title') { G.mode = 'vs'; G.scene = 'select'; G.selPhase = 0; G.t = 0; }
  addNote('PLAYER 2 JOINED!'); sfx('counter');
}

/* ---------------- MODE EN LIGNE « SYNC » (lockstep avec délai d'entrée) ----------------
  Le combat tourne sur les DEUX téléphones ; on n'échange que les touches (un nombre par image).
  Chaque touche locale est appliquée D images plus tard sur les deux téléphones, le temps qu'elle traverse le réseau.
  Les menus (sélection, stage) restent en vidéo ; le mode SYNC couvre le combat, la pause et l'écran de fin. */
const LS = { on: false, role: 0, conn: null, D: 4, F: 0, loc: {}, rem: {}, locNext: 0, stall: 0, pending: null, optBak: null, rtt: 0 };
const syncWanted = () => OPT.online !== 'video' && NET.guest && NET.guest.conn && NET.guest.conn.open && G.mode === 'vs';
function lsSend(m) { try { LS.conn && LS.conn.open && LS.conn.send(m); } catch (e) {} }
function lsHostGo(stage) {   // Player 1 (hôte) : lance le combat sur les deux téléphones
  const d = Math.max(3, Math.min(9, Math.ceil((LS.rtt || 80) / 2 / (1000 / 60)) + 2));   // délai selon le ping
  const cfg = { p1: G.p1, p2: G.p2, stage, seed: (Math.random() * 4294967296) >>> 0, w: Math.min(W, NET.guest.w || W), frame: G.frame, d, opt: { zoom: OPT.zoom, energy: OPT.energy, time: OPT.time, guides: OPT.guides, blood: OPT.blood } };
  LS.conn = NET.guest.conn; LS.role = 1;
  try { LS.conn.send({ t: 'go', cfg }); } catch (e) {}
  LS.pending = cfg;
}
function lsGuestGo(cfg) { LS.conn = G.guest.conn; LS.role = 2; LS.pending = cfg; }
function lsBegin(cfg) {   // même point de départ sur les deux téléphones (appelé en haut d'une image)
  LS.pending = null; LS.on = true; LS.n = (LS.n || 0) + 1; LS.D = cfg.d; LS.ck = {}; LS.rck = {}; LS.F = 0; LS.loc = {}; LS.rem = {}; LS.locNext = 0; LS.stall = 0;
  for (let f = 0; f < LS.D; f++) { LS.loc[f] = 0; LS.rem[f] = 0; } LS.locNext = LS.D;
  if (!LS.optBak) LS.optBak = Object.assign({}, OPT);
  Object.assign(OPT, cfg.opt);   // options du combat de l'hôte (non enregistrées sur le téléphone de l'invité)
  syncW(cfg.w); rngSeed(cfg.seed);
  G.frame = cfg.frame; G.st = 0; G.mode = 'vs'; G.tut = null; G.arc = null; G.demo = false; G.instHelp = false; G.paused = false; G.noAI = false; G.freeze = 0; G.shake = 0; G.photo = null; G.showOpts = G.showMoves = false; G.pconf = null; G.qrPop = false; G.invPop = false;
  startMatch(cfg.p1, cfg.p2, cfg.stage);
  G.f[0].cpu = false; G.f[0].ctl = pctl; G.f[1].cpu = false; G.f[1].ctl = p2ctl;
  pctl.held = {}; pctl.prev = {}; pctl.buf = {}; pctl.q = null; p2ctl.held = {}; p2ctl.prev = {}; p2ctl.buf = {}; p2ctl.q = null;
  SYNC.src = lsSrc;
  if (LS.role === 1) castPause(true);
  if (G.guest) { G.guest.vid.style.display = 'none'; G.musicHold = false; }
}
function lsStop() {   // fin du mode SYNC (retour aux menus, déconnexion)
  if (!LS.on && !LS.pending) return;
  LS.on = false; LS.pending = null; SYNC.src = null; rngOff(); syncW(null);
  if (LS.optBak) { Object.assign(OPT, LS.optBak); LS.optBak = null; }
  if (LS.role === 1) castPause(false);
  if (G.guest) { G.musicHold = true; if (G.guest.status === 'live') G.guest.vid.style.display = 'block'; }
  LS.role = 0;
}
function lsSrc(m1) {   // touches de l'image LS.F (null = celles de l'autre téléphone ne sont pas encore arrivées)
  if (LS.locNext <= LS.F + LS.D) {
    LS.loc[LS.locNext] = m1; LS.locNext++;
    const a = []; for (let f = Math.max(0, LS.locNext - 8); f < LS.locNext; f++) a.push(LS.loc[f]);   // les 8 dernières : une perte de paquet ne bloque pas
    lsSend({ t: 'li', s: Math.max(0, LS.locNext - 8), a });
  }
  const r = LS.rem[LS.F];
  if (r === undefined) { LS.stall++; return null; }
  const l = LS.loc[LS.F]; delete LS.loc[LS.F - 30]; delete LS.rem[LS.F - 30];
  if (LS.F % 30 === 0 && LS.F > 0) lsCheck(LS.F);   // anti-écart : empreinte de l'état AVANT cette image
  LS.F++; LS.stall = 0;
  return LS.role === 1 ? [l, r] : [r, l];
}
function lsHash() {   // empreinte du combat (positions, vie, états, projectiles)
  let h = 2166136261; const add = v => { const t = String(v); for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); };
  add(G.scene); add(G.round); add(G.timer); add(G.paused ? 1 : 0);
  if (G.f) for (const f of G.f) { add(Math.round(f.x)); add(Math.round(f.y)); add(Math.round(f.hp * 10)); add(f.state); add(f.wins); }
  if (G.fbs) add(G.fbs.length);
  return h >>> 0;
}
function lsCheck(F) {
  const h = lsHash(); LS.ck = LS.ck || {}; LS.ck[F] = h; delete LS.ck[F - 600];
  lsSend({ t: 'ck', f: F, h });
  if (LS.rck && LS.rck[F] != null && LS.rck[F] !== h) lsDesync();
}
function lsRecvCk(m) {
  if (!LS.on) return; LS.rck = LS.rck || {}; LS.rck[m.f] = m.h; delete LS.rck[m.f - 600];
  if (LS.ck && LS.ck[m.f] != null && LS.ck[m.f] !== m.h) lsDesync();
}
function lsDesync() {   // les deux combats ne sont plus identiques : on repasse en mode vidéo (le combat de l'hôte continue)
  if (!LS.on) return;
  lsSend({ t: 'end' }); LS.desyncs = (LS.desyncs || 0) + 1;
  if (LS.role === 1) { if (G.f && G.f[1]) G.f[1].ctl = p2ctl; addNote('ONLINE: VIDEO MODE'); }
  lsStop();
}
function lsRecv(m) { if (!LS.on && !LS.pending) return; for (let i = 0; i < m.a.length; i++) { const f = m.s + i; if (LS.rem[f] === undefined) LS.rem[f] = m.a[i] | 0; } }
function castPause(off) {   // vidéo et son vers le Player 2 : coupés pendant le combat SYNC (inutiles, et libèrent le réseau)
  if (!CAST.stream) return; CAST.stream.getTracks().forEach(t => { t.enabled = !off; });
}
function lsAfterStep() {   // fin du combat : retour aux menus -> fin du mode SYNC (au même moment sur les deux téléphones)
  if (LS.on && (G.scene === 'select' || G.scene === 'title' || G.scene === 'stage')) lsStop();
}
function drawLsWait() {   // l'autre téléphone ne répond plus : message d'attente
  if (!LS.on || LS.stall < 20) return;
  R(CX - 100, H / 2 - 12, 200, 24, 'rgba(10,4,20,.85)');
  text(LS.stall > 600 ? 'CONNECTION LOST' : 'WAITING FOR THE OTHER PLAYER...', CX, H / 2 - 4, 8, '#ffd23a', 'center');
}
function addNote(txt) { G.note = { txt, t: 0 }; }
function drawNote() { const N = G.note; if (!N) return; N.t++; if (N.t > 150) { G.note = null; return; } const a = Math.min(1, N.t / 8, (150 - N.t) / 20); ctx.save(); ctx.globalAlpha = a; R(CX - 90, 4, 180, 14, 'rgba(10,4,20,.85)'); text(N.txt, CX, 7, 8, '#5aff8a', 'center'); ctx.restore(); }
// ---- côté Player 2 (lien d'invitation) ----
function guestStart() {
  G.guest = { status: 'connecting', t: 0 }; G.musicHold = true; G.boot = false; document.body.classList.remove('booting');
  const v = document.createElement('video'); v.id = 'guestVid'; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
  Object.assign(v.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'contain', background: '#000', zIndex: '3', imageRendering: 'pixelated', display: 'none' });
  document.getElementById('app').appendChild(v); G.guest.vid = v;
  const unmute = () => { if (v.muted) { v.muted = false; v.play().catch(() => {}); } };
  ['pointerup', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, unmute, { capture: true, passive: true }));
  guestConnect();
}
function guestConnect() {
  const Gs = G.guest; if (!Gs) return;
  if (typeof Peer === 'undefined') { setTimeout(guestConnect, 400); return; }
  if (!Gs.peer || Gs.peer.destroyed) {
    try { Gs.peer = new Peer(undefined, { config: ICE }); } catch (e) { Gs.status = 'error'; return; }
    Gs.peer.on('open', () => guestDial());
    Gs.peer.on('call', call => {
      call.answer();
      call.on('stream', st => { const v = Gs.vid; v.srcObject = st; v.style.display = 'block'; v.muted = false; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); Gs.status = 'live'; });
      call.on('close', () => { Gs.vid.style.display = 'none'; Gs.status = 'lost'; });
    });
    Gs.peer.on('error', e => { Gs.status = e && e.type === 'peer-unavailable' ? 'notfound' : 'error'; setTimeout(guestDial, 3000); });
    Gs.peer.on('disconnected', () => { setTimeout(() => { try { Gs.peer.reconnect(); } catch (e) {} }, 1000); });
  } else guestDial();
}
function guestDial() {   // connexion au Player 1 (et reconnexion si la liaison tombe)
  const Gs = G.guest; if (!Gs || !Gs.peer || Gs.peer.destroyed || !Gs.peer.open) return;
  if (Gs.conn && Gs.conn.open) return;
  const c = Gs.peer.connect(JOIN, { metadata: { p: 2, guest: true }, serialization: 'json' });
  Gs.conn = c; if (Gs.status !== 'live') Gs.status = 'connecting';
  c.on('open', () => { if (Gs.status !== 'live') Gs.status = 'joined'; try { c.send({ t: 'gw', w: W }); } catch (e) {} });   // largeur de scène naturelle de ce téléphone (mode SYNC)
  c.on('data', m => { if (!m) return; if (m.t === 'li') { lsRecv(m); return; } if (m.t === 'ck') { lsRecvCk(m); return; } if (m.t === 'end') { lsDesync(); return; } if (m.t === 'pg') { try { c.send({ t: 'po', ts: m.ts }); } catch (e) {} return; } if (m.t === 'go') { lsGuestGo(m.cfg); return; } if (m.t === 'bye') Gs.status = 'replaced'; if (m.t === 'sc') Gs.fight = !!m.fi; });
  c.on('close', () => { Gs.status = 'lost'; if (LS.role === 2) lsStop(); Gs.vid.style.display = 'none'; setTimeout(guestDial, 2500); });
  c.on('error', () => {});
}
function guestStep() {   // le Player 2 envoie ses touches (clavier, écran tactile, manette) comme une manette
  const Gs = G.guest; Gs.t++;
  const r = readPlayer(), c = Gs.conn;
  const x = Math.abs(touch.x) > .15 || Math.abs(touch.y) > .15 ? touch.x : (r.r ? 1 : 0) - (r.l ? 1 : 0), y = Math.abs(touch.x) > .15 || Math.abs(touch.y) > .15 ? touch.y : (r.d ? 1 : 0) - (r.u ? 1 : 0);
  const m = { t: 'in', x: +x.toFixed(2), y: +y.toFixed(2), p: !!r.p, k: !!r.k, s: !!r.s, bx: !!r.x, start: !!(r.start || r.back) };
  const k = JSON.stringify(m);
  if (c && c.open && (k !== Gs.last || Gs.t % 12 === 0)) { Gs.last = k; try { c.send(m); } catch (e) {} }
  if (Gs.t % 180 === 0 && (!c || !c.open)) guestDial();
}
function drawGuest() {   // écran d'attente du Player 2 (la vidéo du jeu passe par-dessus quand elle arrive)
  const Gs = G.guest; R(0, 0, W, H, '#05030a');
  const msg = { connecting: 'CONNECTING TO PLAYER 1...', joined: 'CONNECTED! WAITING FOR THE GAME...', live: '', lost: 'CONNECTION LOST - RECONNECTING...', notfound: 'PLAYER 1 NOT FOUND - RETRYING...', error: 'CONNECTION ERROR - RETRYING...', replaced: 'ANOTHER PLAYER 2 JOINED' }[Gs.status] || '';
  text('NITRO SURGE FIGHTERS', CX, 70, 8, '#ffd23a', 'center');
  text('ONLINE - PLAYER 2', CX, 86, 8, '#ff3ae8', 'center');
  if ((G.frame >> 4) % 2 || Gs.status === 'joined') text(msg, CX, 120, 8, '#ffffff', 'center');
}
const QR = { 1: null, 2: null };
function controllerURL(p) { return new URL('controller.html?h=' + NET.id + '&p=' + p + '&v=155', location.href).href; }
function makeQRs() {
  if (typeof qrcode === 'undefined' || !NET.id) return;
  for (const p of [1, 2]) {
    const q = qrcode(0, 'M'); q.addData(controllerURL(p)); q.make();
    const n = q.getModuleCount(), c = document.createElement('canvas'), m = 2, pad = 3;
    c.width = c.height = (n + pad * 2) * m;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + pad) * m, (y + pad) * m, m, m);
    QR[p] = c;
  }
}
function drawQRs() {
  if (isTouch) return;
  for (const p of [1, 2]) {
    const q = QR[p], col = p === 1 ? '#5ac8ff' : '#ff7a6a', ps = padSlots(), padP = ps['p' + p] != null && !remoteOn(p), on = remoteOn(p) || (p === 2 && padP);
    const sz = Math.round((q ? q.width : 74) * .72), x = p === 1 ? 8 : W - 8 - sz, y = 36;   // QR codes plus petits
    text('PLAYER ' + p, x + sz / 2, y - 12, 8, col, 'center');
    if (q) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.globalAlpha = on ? .35 : 1; ctx.drawImage(q, x, y, sz, sz); ctx.restore(); }
    else { R(x, y, sz, sz, '#111'); text(NET.status === 'error' ? 'OFFLINE' : '...', x + sz / 2, y + sz / 2 - 4, 8, '#9a8aa0', 'center'); }
    text(padP && p === 2 ? 'GAMEPAD' : on ? 'CONNECTED' : 'SCAN', x + sz / 2, y + sz + 4, 8, on ? '#5ae06a' : '#d8c8a8', 'center');
    if (!on) text('TO PLAY', x + sz / 2, y + sz + 14, 8, '#d8c8a8', 'center');
  }
}

const makeCtl = () => ({ held: {}, prev: {}, buf: {} });
// Touches d'une image, compactées en un nombre (10 bits) : c'est tout ce qui passe par le réseau en mode SYNC
const IN_KEYS = ['l', 'r', 'u', 'd', 'p', 'k', 's', 'x', 'start', 'back'];
const inPack = h => { let m = 0; IN_KEYS.forEach((k, i) => { if (h[k]) m |= 1 << i; }); return m; };
const inUnpack = m => { const h = {}; IN_KEYS.forEach((k, i) => { h[k] = !!(m & (1 << i)); }); return h; };
const SYNC = { src: null };   // src(p1, p2) -> [p1, p2] | null : source des touches en ligne (inactive hors ligne)
function confuse(held, f) {   // brume de Nyx : gauche/droite et haut/bas inversés (les coups spéciaux restent possibles)
  if (!f || !(f.confT > 0) || f.noSpecT > 0 || G.scene !== 'fight' || G.paused || held.s) return held;   // le menu pause n'est jamais inversé
  const o = Object.assign({}, held), sw = (a, b) => { const t = o[a]; o[a] = o[b]; o[b] = t; };
  sw('l', 'r'); sw('u', 'd'); return o;
}
function ctlUpdate(c, held) {
  c.prev = c.held; c.held = held;
  for (const b of [...BTNS, 'start', 'back', 'l', 'r', 'u', 'd']) {
    if (held[b] && !c.prev[b]) { const atk = b === 'p' || b === 'k' || b === 's'; if (atk && c.buf[b] > 0) { c.q = c.q || {}; c.q[b] = Math.min(2, (c.q[b] || 0) + 1); } c.buf[b] = atk ? 14 : 8; c.ord = c.ord || {}; c.n = (c.n || 0) + 1; c.ord[b] = c.n; }
    else if (c.buf[b] > 0 && !(G.freeze > 0)) { if (--c.buf[b] === 0 && c.q) c.q[b] = 0; }   // le tampon ne s'use pas pendant l'arrêt sur impact
  }
}
function take(c, b) { if (c.buf[b] > 0) { c.buf[b] = 0; if (c.q && c.q[b] > 0) { c.q[b]--; c.buf[b] = 14; } return true; } return false; }
const edge = (c, b) => !!(c.held[b] && !c.prev[b]);
// Menus : A (ou Entrée) valide, B (ou Échap) revient en arrière
const okPress = c => edge(c, 's') || edge(c, 'start');
const backPress = c => edge(c, 'k') || edge(c, 'back');
let entKbT = -1e9; addEventListener('keydown', e => { if (e.code === 'Enter' || e.code === 'NumpadEnter') entKbT = performance.now(); }, true);
const entRecent = () => !LS.on && performance.now() - entKbT < 250;
const entKb = () => !isTouch && !LS.on && edge(pctl, 'start') && entRecent();   // PC : ENTRÉE (clavier) = valider comme A

/* ---------------- Données d'attaque ---------------- */
const ATK = {
  punch:    { dur: 12, act: [2, 7], box: [14, -76, 43, -59], dmg: 7,  stun: 15, bstun: 10, push: 2.6, sfx: 'hit' },
  fpunch:   { dur: 22, act: [5, 12], box: [18, -80, 52, -58], dmg: 9,  stun: 17, bstun: 11, push: 3.2, sfx: 'hit' },
  fkick:    { dur: 30, act: [9, 16], box: [26, -70, 72, -44], dmg: 11, stun: 19, bstun: 13, push: 3.6, sfx: 'heavy' },
  kick:     { dur: 16, act: [3, 9], box: [20, -68, 62, -44], dmg: 9,  stun: 17, bstun: 12, push: 3.0, sfx: 'hit' },
  jpunch:   { act: [3, 16], box: [11, -59, 38, -34], high: true, dmg: 8,  stun: 16, bstun: 10, push: 2.0, sfx: 'hit' },
  jkick:    { act: [3, 18], box: [8, -42, 43, -11],  high: true, dmg: 10, stun: 18, bstun: 12, push: 2.4, sfx: 'hit' },
  cpunch:   { dur: 16, act: [3, 8],  box: [14, -50, 42, -35], dmg: 6,  stun: 13, bstun: 9,  push: 2.2, sfx: 'hit' },
  ckick:    { dur: 14, act: [3, 7],  box: [14, -14, 49, 0],   dmg: 4,  stun: 16, low: true, bstun: 10, push: 0.5, sfx: 'hit' },
  rupper:   { dur: 30, act: [4, 13], box: [8, -110, 50, -40], dmg: 9, knock: true, bstun: 12, push: 2.0, sfx: 'heavy' },
  flame:    { dur: 26, act: [6, 12], box: [14, -80, 54, -48], dmg: 10, stun: 18, bstun: 12, push: 3.0, sfx: 'heavy' },
  gtatsu:   { act: [6, 54], box: [-40, -76, 46, -40], dmg: 4, stun: 16, bstun: 10, push: 0.8, sfx: 'hit' },
  dive:     { act: [3, 60], box: [8, -30, 38, 2], high: true, knock: true, dmg: 11, stun: 20, bstun: 12, push: 2.2, sfx: 'hit' },
  tatsu:    { act: [4, 90], box: [-42, -70, 45, -39], dmg: 12, knock: true, high: true, bstun: 14, push: 2.6, sfx: 'heavy', sym: true },
  wallslash:{ dur: 34, act: [9, 17], box: [6, -96, 48, 0], dmg: 14, knock: true, stun: 22, bstun: 16, push: 3.2, sfx: 'heavy' },
  tpstrike: { dur: 22, act: [4, 12], box: [8, -60, 50, -28], dmg: 11, knock: true, unblock: true, stun: 20, bstun: 14, push: 3, sfx: 'heavy' },
  meteor:   { act: [2, 40], box: [-22, -80, 26, -10], dmg: 9, knock: true, bstun: 12, push: 2, sfx: 'heavy', sym: true },
  meteorD:  { act: [0, 99], box: [6, -40, 40, 2], high: true, dmg: 14, knock: true, stun: 22, bstun: 16, push: 3, sfx: 'heavy' },
  sonic:    { dur: 26, act: [6, 10], box: [10, -70, 44, -40], dmg: 8, stun: 16, bstun: 10, push: 2.5, sfx: 'heavy' },
  plunge:   { act: [0, 99], box: [-10, -34, 16, 6], high: true, dmg: 12, knock: true, stun: 20, bstun: 14, push: 2.5, sfx: 'heavy' },
  tornado:  { act: [3, 26], box: [-24, -104, 30, -8], dmg: 13, knock: true, lift: 7.5, bstun: 16, push: 1.5, sfx: 'heavy' },
  zdash:    { act: [3, 21], box: [-22, -80, 28, -22], dmg: 10, knock: true, stun: 18, bstun: 12, push: 2, sfx: 'heavy' },   // Zephyr : vrille électrique horizontale en l'air
  zslash:   { act: [2, 23], box: [0, -64, 40, -4], dmg: 5, stun: 18, bstun: 10, push: .5, sfx: 'hit' },   // Zephyr : 3 coups de sabre en glissant
  gust:     { dur: 26, act: [7, 12], box: [10, -70, 46, -30], dmg: 6, stun: 14, bstun: 10, push: 1.6, sfx: 'hit' },
  gpound:   { act: [7, 99], box: [-18, -40, 18, 4], high: true, dmg: 15, knock: true, stun: 22, bstun: 16, push: 3, sfx: 'heavy' },
  vtripP:   { act: [1, 40], box: [14, -76, 46, -56], dmg: 4, stun: 16, bstun: 8, push: .5, sfx: 'hit' },   // Vane : 3 coups de poing très rapides (Y maintenu puis lâché)
  vtripK:   { act: [1, 40], box: [18, -68, 60, -44], dmg: 5, stun: 16, bstun: 8, push: .5, sfx: 'hit' },   // Vane : 3 coups de pied très rapides (B maintenu puis lâché)
  vdive:    { act: [2, 80], box: [8, -30, 40, 2], high: true, knock: true, dmg: 11, stun: 20, bstun: 12, push: 2.2, sfx: 'hit' },   // Vane : coup de pied en diagonale vers le bas (saut + bas + A)
  hslide:   { act: [15, 60], box: [2, -100, 32, -30], dmg: 8, stun: 18, bstun: 10, push: 1.6, sfx: 'hit' },   // Hiro : glissade basse puis mini shoryuken (ne fait pas tomber)
  fjump:    { act: [5, 60], box: [8, -66, 48, -34], dmg: 11, stun: 34, bstun: 12, push: 1.4, sfx: 'heavy' },   // Axel : saut loin vers l'avant, poing en feu
  crushD:   { act: [0, 99], box: [-10, -46, 28, 4], high: true, dmg: 16, knock: true, stun: 22, bstun: 16, push: 3, sfx: 'heavy' },
  zenith:   { dur: 60, act: [3, 20], box: [-16, -96, 30, -12], dmg: 12, knock: true, stun: 20, bstun: 14, push: 2.2, sfx: 'heavy' },
  uppercut: { act: [5, 19], box: [0, -115, 31, -36], dmg: 14, knock: true, bstun: 16, push: 2.0, sfx: 'heavy' },
  kbarrage: { act: [1, 30], box: [12, -80, 50, -54], dmg: 4, stun: 16, bstun: 8, push: .35, sfx: 'hit' },             // Kael : rafale de 5 poings électriques
  kspin:    { act: [2, 90], box: [-44, -74, 46, -36], dmg: 11, knock: true, high: true, bstun: 14, push: 2.6, sfx: 'heavy', sym: true },   // Kael : coup de pied rotatif 360° aérien
  bflip:    { act: [3, 24], box: [-16, -84, 40, -12], dmg: 7, stun: 16, bstun: 12, push: 1.4, sfx: 'heavy', sym: true },   // tous : bas + A, petit saut avant + coup de pied tournoyant vers l'arrière
  flipk:    { act: [5, 40], box: [-12, -84, 42, -14], dmg: 6, stun: 12, bstun: 12, push: 1.1, sfx: 'hit' },             // Hiro / Axel : salto avant coup de pied
  nyxspin:  { act: [1, 400], box: [-40, -78, 42, -30], dmg: 10, knock: true, high: true, bstun: 14, push: 2.6, sfx: 'heavy', sym: true },   // Nyx : coup de pied 360° arrière en plein vol
  nslide:   { dur: 32, act: [3, 22], box: [8, -18, 46, 0], dmg: 8, knock: true, low: true, bstun: 12, push: 2.4, sfx: 'hit' },
  grogroll: { act: [3, 39], box: [-6, -34, 34, 0], dmg: 5, stun: 14, low: true, bstun: 10, push: .6, sfx: 'hit' },        // Grog : roulades au sol x3
  aflip:    { act: [1, 40], box: [-14, -82, 42, -12], dmg: 5, stun: 14, high: true, bstun: 10, push: 1.2, sfx: 'hit' },    // Hiro / Axel en l'air : 3 saltos coup de pied   // Nyx : glissade au sol
};
const FB_HIT = { dmg: 10, stun: 18, bstun: 14, push: 2.6, chip: 2, sfx: 'heavy' };
const FB_BIG = { dmg: 22, knock: true, stun: 24, bstun: 20, push: 3.6, chip: 5, sfx: 'heavy' };
const ATTACKING = ['zdash', 'bflip', 'vtripP', 'vtripK', 'vdive', 'hslide', 'fjump', 'grogroll', 'aflip', 'nyxspin', 'kbarrage', 'kspin', 'flipk', 'nslide', 'gpound', 'axgp', 'tpstrike', 'meteor', 'meteorD', 'voidcast', 'plasmawall', 'sonic', 'flask', 'geyser', 'wallslash', 'plunge', 'tornado', 'gust', 'cyclone', 'crushD', 'quake', 'zenith', 'holo', 'punch', 'kick', 'fpunch', 'fkick', 'flame', 'gtatsu', 'cpunch', 'rupper', 'ckick', 'jpunch', 'jkick', 'tatsu', 'dive', 'uppercut', 'special'];
const NEUTRAL = ['idle', 'walk', 'block', 'crouch', 'cblock'];

/* ---------------- État du jeu ---------------- */
const G = {
  scene: 'title', frame: 0, t: 0, round: 1, timer: 99, tick: 0,
  pick: 0, freeze: 0, shake: 0, flashT: 0, darkT: 0, boltX: 0, boltY: 0, f: [], fbs: [], sparks: [], popups: [], msg: null, winner: null, fighting: false,
};
const pctl = makeCtl();
const p2ctl = makeCtl();   // manette smartphone du joueur 2

function makeFighter(def, id, x, dir, cpu) {
  return {
    def, id, x, y: GROUND, vx: 0, vy: 0, dir, cpu, hp: 100, lag: 100, lagT: 0,
    state: 'idle', t: 0, air: false, airAtk: false, hasHit: false, stun: 0, bstun: 0,
    invuln: 0, flash: 0, fb: null, wins: 0, ko: false, landT: 0,
    ctl: makeCtl(), ai: { cd: 30, hold: {}, holdT: 0, press: null, pressU: false, pressFrames: 0, reacted: false },
  };
}

const chargeMax = f => { const T = f.def.twinFb ? 72 : f.def.fireUpper ? 72 : 120; return f.hp <= 80 ? T / 2 : T; };   // charge max : Hiro 1,2 s, Axel 1,2 s (moitié à 80 % d'énergie ou moins)
function setState(f, s) { if (s === 'hit' || s === 'fall') f.vxReady = 0; if (s !== 'jump' && s !== 'hatcharge') f.hatHold = false; if (f.chSnd && s !== f.state) vaneChargeStop(f); if (s !== 'pteleport' && s !== 'nyxtele') f.fadeK = 0; if (s !== 'sink') f.sinkK = 0; if (s === 'hit' || s === 'fall') f.wallT = 0; if (f.dizzy && s !== 'stunned') { f.dizzy = false; f.dizzyEnd = G.frame; } if (s !== 'jump') { f.rollT = 0; f.rollA0 = 0; f.airNoS = false; } f.fireDash = 0; f.state = s; f.t = 0; f.hasHit = false; f.rotAng = null; }
function face(f, o) { f.dir = o.x >= f.x ? 1 : -1; }

const VANE_NORMALS = ['punch', 'kick', 'fpunch', 'fkick', 'cpunch', 'ckick', 'flame', 'vtripP', 'vtripK'];
function poseOf(f) {
  if (f.def.float && !f.ghostDraw && VANE_NORMALS.includes(f.state)) return 'vidle';   // Vane reste immobile : c'est son double qui frappe
  switch (f.state) {
    case 'idle': if (f.def.float) return 'vidle'; return ((G.frame / 18 | 0) + f.id) % 2 ? 'idle1' : 'idle0';
    case 'walk': {
      if (f.def.float) return 'vidle';   // Vane : pieds joints, mains dans le dos, il glisse
      // l'image suit la distance parcourue : les pieds ne glissent pas, quelle que soit la vitesse
      const step = WALK_A * 4 * K * UP / WALK_N;   // distance à l'écran entre deux images
      const i = Math.floor(f.t * Math.abs(f.vx) / step) % WALK_N;
      const wi = f.vx * f.dir < 0 ? (WALK_N - i) % WALK_N : i;
      f.walkPh = wi / WALK_N * Math.PI * 2;
      return 'wk' + wi;
    }
    case 'block': return 'block';
    case 'crouch': return 'crouch';
    case 'cblock': return 'cblock';
    case 'cpunch': return f.t < 3 || f.t >= 8 ? 'crouch' : 'cpunch';
    case 'ckick': return f.t < 2 || f.t >= 10 ? 'crouch' : 'ckick';   // jambe tendue pendant les images actives (visible à l'impact)
    case 'tatsu': return f.t < 4 ? 'jump' : 'tatsu';
    case 'dive': return f.t < 3 ? 'jkick' : 'dive';
    case 'gtatsu': return f.t >= 6 && f.t < 54 ? 'tatsu' : 'kick0';
    case 'flame': return f.t < 5 ? 'special0' : 'special1';
    case 'jump': return f.roll && f.t > 3 ? 'tuck' : 'jump';
    case 'rupper': return f.t < 4 ? 'rup0' : f.t < 9 ? 'rup1' : f.t < 17 ? 'rup2' : 'rup3';
    case 'jpunch': return f.t < 3 ? 'jump' : 'jpunch';
    case 'airflask': return f.t < 4 ? 'jump' : 'jpunch';
    case 'airfb': return f.t < 8 ? 'special1' : 'jump';
    case 'nrush': return f.rushN >= 10 && f.t > 63 ? 'punch0' : (f.t - 3) % 5 < 4 ? (f.rushPose || 'punch1') : 'punch0';
    case 'nitroUp': return 'win';
    case 'vsuper': case 'vxcharge': return 'special0';
    case 'vsrel': return f.t < 10 ? 'special1' : 'vidle';
    case 'vgrabC': return 'punch1';
    case 'vgrabH': return 'vgrab';
    case 'nsuper': if (superKit(f) === 'axel') return f.t < 12 ? 'crouch' : f.t < 60 ? 'gp0' : f.t < 63 ? 'gpI' + (f.t - 59) : 'gp1'; return f.t < 12 ? 'crouch' : f.t < 58 ? 'special0' : 'special1';
    case 'nyxglide': return 'jump';
    case 'kbarrage': return f.t >= 30 ? 'punch0' : (f.t % 6) < 3 ? 'punch1' : 'fpunch1';
    case 'kspin': return f.t < 2 ? 'jump' : 'tuck';   // roulade en boule, comme Grog (haut + A)
    case 'nyxspin': return 'tuck';   // même roulade que son saut avant
    case 'flipk': return f.t < 4 ? 'crouch' : 'jkick';
    case 'bflip': return f.t < 3 ? 'crouch' : 'jkick';
    case 'nslide': return f.t < 3 || f.t >= 26 ? 'crouch' : 'slide';
    case 'grogroll': return f.t < 3 || f.t >= 39 ? 'crouch' : 'tuckG';
    case 'aflip': return 'jkick';
    case 'fjump': return f.t < 4 ? 'sho0' : 'fjump';
    case 'vtripP': return f.t >= 40 ? 'punch0' : (f.t % 8) < 2 ? 'punch0' : ((f.t >> 3) & 1) ? 'fpunch1' : 'punch1';   // poing gauche / droit en alternance
    case 'vtripK': return f.t >= 40 ? 'kick0' : (f.t % 8) < 2 ? 'kick0' : ((f.t >> 3) & 1) ? 'fkick1' : 'kick1';    // pied gauche / droit en alternance
    case 'vdive': return 'dive';
    case 'hslide': return f.t < 3 ? 'crouch' : f.t < 15 ? 'sho0' : 'rup2';
    case 'jkick': return f.t < 3 ? 'jump' : 'jkick';
    case 'punch': return f.t < 2 || f.t >= 8 ? 'punch0' : 'punch1';   // coup de poing très rapide
    case 'kick': return f.t < 3 || f.t >= 10 ? 'kick0' : 'kick1';   // coup de pied rapide
    case 'fpunch': if (f.def.sword) return f.t < 4 ? 'upper1' : f.t < 9 ? 'fpunch1' : f.t < 16 ? 'punch1' : 'fpunch0';
      return f.t < 5 ? 'fpunch0' : f.t < 13 ? 'fpunch1' : 'fpunch0';
    case 'fkick': return f.t < 9 || f.t >= 17 ? 'fkick0' : 'fkick1';
    case 'special': return f.t < 12 ? 'special0' : 'special1';
    case 'axgp': { if (!f.fired) return 'gp0'; const k = f.t - f.gpT; return k < 3 ? 'gpI' + (k + 1) : 'gp1'; }
    case 'pthrow': return f.t < 7 ? 'special0' : 'special1';
    case 'holo': return f.t < 7 ? 'special0' : 'special1';
    case 'vcharge': return 'special0';
    case 'shadow': return 'tuck';
    case 'quake': return f.t < 12 ? 'gq0' : 'gq1';
    case 'grogcharge': return 'gq0';
    case 'grogrush': return f.t < 3 ? 'gq0' : 'wk' + (Math.floor(f.t / 2) % WALK_N);
    case 'grogstop': return 'gq1';
    case 'rampart': return 'rampart';
    case 'rburst': return 'rburst';
    case 'crush': return f.t < 6 ? 'crouch' : 'tuck';
    case 'crushD': return 'crush0';
    case 'gpound': return f.t < 7 ? 'tuck' : 'crush0';
    case 'crushLand': return 'gq1';
    case 'gust': return f.t < 6 ? 'special0' : f.t < 16 ? 'punch1' : 'punch0';
    case 'cyclone': return f.t < 4 ? 'crouch' : f.air ? 'tuck' : 'special1';
    case 'sink': return f.t < 22 ? 'block' : 'upper0';
    case 'tornado': return f.t < 3 ? 'sho0' : 'upper2';
    case 'hover': return 'tuck';
    case 'zdash': return f.t < 3 ? 'sho0' : 'upper2';   // corps à l'horizontale, bras + sabre devant (comme la vrille, couchée)
    case 'flask': return f.t < 8 ? 'special0' : 'punch1';
    case 'nyxcharge': return 'special0';
    case 'nyxsnake': return f.t < 3 ? 'special0' : 'punch1';
    case 'sonic': return f.t < 5 ? 'fpunch0' : f.t < 16 ? 'fpunch1' : 'fpunch0';
    case 'voidcast': return f.t < 7 ? 'fpunch0' : f.t < 26 ? 'fpunch1' : 'fpunch0';   // un seul bras tendu
    case 'airvoid': return f.t < 6 ? 'jump' : 'jpunch';
    case 'pteleport': return 'idle0';
    case 'tpstrike': return f.t < 4 ? 'kick0' : f.t < 15 ? 'kick1' : 'kick0';   // coup de pied à la réapparition
    case 'meteor': return 'tuck';
    case 'meteorD': return 'dive';
    case 'flashstep': return 'block';
    case 'plasmawall': return f.t < 6 ? 'crouch' : f.t < 34 ? 'win' : 'upper0';
    case 'smokeback': return f.t < 4 ? 'special0' : 'hit';
    case 'nyxtele': return 'idle0';
    case 'geyser': return f.t < 8 ? 'upper1' : 'gq1';
    case 'wallslash': return f.t < 8 ? 'upper1' : f.t < 11 ? 'fpunch1' : f.t < 28 ? 'cpunch' : 'crouch';
    case 'plunge': return 'sho0';
    case 'hatcharge': if (Math.abs(f.vx) > .1) {   // charge du chapeau en se déplaçant : animation de marche normale
        const step = WALK_A * 4 * K * UP / WALK_N, i = Math.floor(f.t * Math.abs(f.vx) / step) % WALK_N, wi = f.vx * f.dir < 0 ? (WALK_N - i) % WALK_N : i;
        return 'wkh' + wi;   // jambes qui marchent, main toujours sur le chapeau
      } return 'hatc';
    case 'hatcatch': return 'hatc';
    case 'hatthrow': return f.t < 4 ? 'hatc' : 'punch1';
    case 'zslash': { if (f.t < 2) return 'crouch'; const ph = (f.t - 2) % 8; return ph < 2 ? 'upper1' : ph < 5 ? 'fpunch1' : 'punch1'; }   // 3 coups de sabre en arc (comme avant + Y), rapides
    case 'zenith': return f.t < 3 ? 'crouch' : 'tuck';
    case 'uppercut': {
      // accroupi, le poing monte, envol de dos ; au sommet il se retourne et redescend de face
      if (f.t < 3) return 'sho0';
      if (f.t < 6) return 'rup1';
      if (f.apexT == null) return f.t < 12 ? 'sbk1' : 'sbk2';
      const dt = f.t - f.apexT;
      return dt < 4 ? 'turnA' : dt < 8 ? 'turnB' : 'upper2';
    }
    case 'land': case 'getup': return 'upper0';
    case 'hit': return 'hit';
    case 'fall': return 'fall';
    case 'down': return 'down';
    case 'win': return 'win';
    case 'parry': return 'parry';
    case 'stunned': return 'stunned';
    case 'held': return 'fall';
    case 'throw':
      if (f.throwType === 'toss') return f.t >= 6 && f.t < 26 ? 'tuck' : 'throw0';
      if (f.throwType === 'rocket') return f.t < 6 ? 'throw0' : f.t < 34 ? 'win' : f.t < 52 ? 'crush0' : 'gq1';
      return f.t < 6 ? 'throw0' : f.t < 22 ? 'throwT' : 'throwS';
  }
  return 'idle0';
}

function threatened(f, o) {
  const dist = Math.abs(o.x - f.x);
  if (ATTACKING.includes(o.state) && dist < 120) return true;
  if (o.fb && Math.sign(o.fb.vx) === Math.sign(f.x - o.fb.x) && Math.abs(o.fb.x - f.x) < 110) return true;
  return false;
}

// Projectiles (boules d'énergie, clones, fioles...) : 3 tirs d'affilée maximum, puis 1 seconde d'attente
function shotOK(f) { if (G.frame - (f.shotLast || -999) > 90) f.shotN = 0; return G.frame >= (f.shotCd || 0) && (f.shotN || 0) < 3; }
function shotUse(f) { f.shotN = (f.shotN || 0) + 1; f.shotLast = G.frame; if (f.shotN >= 3) { f.shotCd = G.frame + 24 + 60; f.shotN = 0; } }
// détruit les projectiles adverses dans une zone (poings de Kael, pied de Vesper...) ; renvoie le nombre détruit
function killShots(g, x0, x1, y0, y1, skipBig) {
  let n = 0;
  const hit = (q, qy) => { if (q.owner === g || q.dead || q.alive === false || q.charging || (skipBig && (q.big || q.r != null))) return; if (q.x < x0 - 8 || q.x > x1 + 8 || qy < y0 - 8 || qy > y1 + 8) return;
    if ('alive' in q) q.alive = false; q.dead = true; if (q.owner && q.owner.fb === q) q.owner.fb = null; n++;
    (G.clashFx = G.clashFx || []).push({ x: q.x, y: qy, t: 0 }); };
  for (const q of G.fbs || []) hit(q, q.y);
  for (const q of G.blades || []) hit(q, q.y);
  for (const q of G.sonics || []) hit(q, q.y);
  for (const q of G.voids || []) hit(q, q.y);
  for (const q of G.flasks || []) hit(q, q.y);
  for (const q of G.holos || []) hit(q, q.y - 50);
  for (const q of G.waves || []) if (!q.ring && !q.small) hit(q, GROUND - 16);   // ondes au sol de Grog
  if (n) { G.flashT = Math.max(G.flashT, 3); G.shake = Math.max(G.shake, 4); G.freeze = Math.max(G.freeze || 0, 3); sfx('parry'); }
  return n;
}
// Nyx en glissade : les projectiles passent au-dessus
// états où le combattant n'est pas en train de faire un coup spécial
const CALM_ST = ['idle', 'walk', 'block', 'crouch', 'cblock', 'punch', 'kick', 'fpunch', 'fkick', 'cpunch', 'ckick', 'rupper', 'jpunch', 'jkick', 'jump', 'land', 'hit', 'fall', 'down', 'getup', 'held', 'throw', 'parry', 'stunned', 'win'];
const NORMAL_ATK = ['punch', 'kick', 'fpunch', 'fkick', 'cpunch', 'ckick', 'rupper', 'jpunch', 'jkick'];
const underShot = o => (o.state === 'hslide' && o.t >= 2 && o.t < 15) || (o.def.twinFb && o.state === 'uppercut') || (o.state === 'nslide' && o.t >= 2 && o.t < 26) || (o.state === 'grogroll' && o.t >= 3 && o.t < 39);
// Kael (coup de pied rotatif) : renvoie boules de feu, clones, fioles et objets du décor lancés sur lui
function reflectNear(g, R, yc, yr) {
  const mir = (q, vk, qy) => {
    if (q.owner === g || q.dead || q.alive === false) return;
    if (Math.abs(q.x - g.x) > R || Math.abs(qy - yc) > yr) return;
    const v = vk ? q[vk] : q.dir; if (Math.sign(v) !== Math.sign(g.x - q.x) && Math.abs(q.x - g.x) > 10) return;
    if (q.owner && q.owner.fb === q) q.owner.fb = null;
    q.owner = g; q.dir = -(q.dir || Math.sign(v)); if (vk) q[vk] = -q[vk]; if ('x0' in q) q.x0 = q.x; q.x = g.x + q.dir * (R - 6); q.t = 0;
    if (q.vy != null && !q.straight) q.vy = Math.min(q.vy, -2.5);
    addSpark(q.x, qy, 'parry'); sfx('parry'); G.flashT = Math.max(G.flashT, 4); G.freeze = Math.max(G.freeze || 0, 4); addPopup(g.x, g.y - 120, 'REFLECT!', '#7af0ff'); g.reflF = G.frame;
  };
  for (const q of G.fbs || []) mir(q, 'vx', q.y);
  for (const q of G.blades || []) mir(q, null, q.y);
  for (const q of G.sonics || []) mir(q, null, q.y);
  for (const q of G.voids || []) if (!q.charging) mir(q, 'vx', q.y);
  for (const q of G.flasks || []) mir(q, 'vx', q.y);
  for (const q of G.holos || []) mir(q, null, q.y - 50);
  for (const q of G.hats || []) {   // chapeau de Zephyr renvoyé : il repart vers Zephyr, qui le rattrape
    if (q.owner === g || q.back || Math.abs(q.x - g.x) > R + 10 || Math.abs(q.y - yc) > yr + 14) continue;
    q.hit = true; hatReturn(q); q.vx = Math.sign(q.owner.x - q.x) * 6;
    addSpark(q.x, q.y, 'parry'); sfx('parry'); G.flashT = Math.max(G.flashT, 4); G.freeze = Math.max(G.freeze || 0, 4); addPopup(g.x, g.y - 120, 'REFLECT!', '#7af0ff'); g.reflF = G.frame;
  }
  for (const p of G.props || []) {
    const F = p.fly; if (!p.alive || !F || F.owner === g || F.lastBy === g) continue;
    if (Math.abs(p.x - g.x) > R + 6 || Math.abs(p.y - yc) > yr + 10) continue;
    aimProp(p, g, F.owner); p.fly.deflected = false; p.fly.lastBy = g;
    addSpark(p.x, p.y, 'parry'); sfx('counter'); G.flashT = Math.max(G.flashT, 4); addPopup(g.x, g.y - 120, 'REFLECT!', '#7af0ff'); g.reflF = G.frame;
  }
}
// force d'un projectile : grosse boule de feu chargée 2, très grosse sphère de Lord Vane 3, le reste 1
const shotPow = q => q.r != null ? ((q.big || q.c > .5) ? 3 : 1) : q.big ? 2 : 1;
// rebond : le sommet arrive pile à la hauteur de la boule de feu d'Hiro (les deux s'annulent là-haut) ; au ras du sol elle passe dessous
const GP_BV = sc => Math.sqrt(2 * .25 * (56 - 10 * sc));
function spawnBounceFb(f, big) {   // Axel : la boule part du sol et avance en rebondissant
  const sc = big ? 1.6 : 1;
  f.fb = { owner: f, x: f.x + f.dir * 30, y: GROUND - 10 * sc, vx: (big ? 4.4 : 3.1) * f.dir, dir: f.dir, t: 0, alive: true, big: !!big, sc, bounce: GP_BV(sc), bvy: -GP_BV(sc) };   // même hauteur de rebond pour la petite et la grosse boule (assez haut pour passer dessous en glissade)
  G.fbs.push(f.fb);
  for (let i = 0; i < 3; i++) addSpark(f.x + f.dir * (26 + i * 6), GROUND - 4, 'fb', f.def.fb);
  G.shake = Math.max(G.shake, big ? 7 : 4); sfx('fb'); sfx('heavy');
}
function spawnFireball(f, big) {
  f.fb = { owner: f, x: f.x + f.dir * (big ? 52 : 40), y: f.y - 56, vx: 3.8 * f.dir, dir: f.dir, t: 0, alive: true, big: !!big, sc: big ? 2 : 1 };
  G.fbs.push(f.fb);
  if (f.def.twinFb && !big) {   // Kaito : deux boules qui ondulent en sinusoïde, en opposition de phase
    f.fb.y0 = f.fb.y; f.fb.ph = 0;
    const tw = Object.assign({}, f.fb, { ph: Math.PI, twin: true }); f.fb.mate = tw; tw.mate = f.fb; G.fbs.push(tw);   // les deux boules jumelles disparaissent ensemble
  }
  sfx('fb');
}


/* ---------------- NITRO / SURGE ----------------
   NITRO (X X Y) : jauge pleine quand on a infligé ou reçu la moitié de l'énergie ; 8 s plus rapide, écho vert, NITRO COMBO (10 coups)
   SURGE (X X A) : pendant le Nitro, jauge pleine après un quart de plus ; 5 s, écho mauve et double mauve qui répète chaque coup */
const NITRO_T = 480, SURGE_T = 300, NITRO_NEED = 50, SURGE_NEED = 25;
const nitroFull = f => ((f.nDeal || 0) + (f.nTake || 0)) >= NITRO_NEED;
const surgeFull = f => ((f.sDeal || 0) + (f.sTake || 0)) >= SURGE_NEED;
function powerUp(f, o, surge) {   // activation : pose de puissance, écran noir et flash (style Denjin)
  if (surge) { if (!(f.nitroT > 0)) f.nDeal = f.nTake = 0; f.surgeT = SURGE_T; f.nitroT = Math.max(f.nitroT || 0, SURGE_T); f.sDeal = f.sTake = 0; }   // Surge possible directement, même sans Nitro
  else { f.nitroT = NITRO_T; f.nDeal = f.nTake = 0; f.sDeal = f.sTake = 0; }   // Nitro : les jauges verte et mauve repartent de zéro
  f.rotAng = null; f.slowT = 0; if (!f.air) { setState(f, 'nitroUp'); f.vx = 0; }
  f.invuln = Math.max(f.invuln || 0, 40); f.powF = G.frame; f.powSurge = !!surge;
  G.freeze = Math.max(G.freeze || 0, 38); G.darkT = Math.max(G.darkT, 56); G.flashT = 12; G.boltX = f.x; G.boltY = f.y - 54; G.shake = Math.max(G.shake, 5);
  G.powerMsg = { txt: surge ? 'SURGE' : 'NITRO', name: f.def.name, col: surge ? '#d070ff' : '#5aff8a', t: 0 };   // grand texte au centre en dézoom, nom du combattant dessous
  sfx('counter'); sfx('fb'); if (AC) playSample('fight', 1.25, VOX, true);
}
function nitroInput(f, o) {   // X X Y : Nitro ; X X A pendant le Nitro : Surge
  if (!G.fighting || f.ko) return;
  for (const b of ['x', 'p', 'k', 's']) if (edge(f.ctl, b)) { (f.pseq = f.pseq || []).push([b, G.frame]); if (f.pseq.length > 3) f.pseq.shift(); }
  const q = f.pseq || []; if (q.length < 3 || G.frame - q[0][1] > 40) return;
  const k = q.map(e => e[0]).join('');
  if (k === 'xxp' && !(f.nitroT > 0) && nitroFull(f)) { f.pseq = []; powerUp(f, o, false); }
  else if (k === 'xxs' && !(f.surgeT > 0) && surgeFull(f)) { f.pseq = []; powerUp(f, o, true); }
}
function nitroGain(att, def, dmg) {   // les jauges se remplissent avec les dégâts infligés ou reçus
  if (!(dmg > 0) || (G.tut && G.tut.phase !== 4)) return;
  // jauge verte d'abord ; une fois pleine (ou pendant le Nitro), c'est la jauge mauve qui se remplit
  // pendant le Nitro / Surge rien ne se recharge ; ensuite la verte d'abord, puis la mauve
  if (att && !(att.nitroT > 0)) { if (nitroFull(att)) att.sDeal = (att.sDeal || 0) + dmg; else att.nDeal = (att.nDeal || 0) + dmg; }
  if (!(def.nitroT > 0)) { if (nitroFull(def)) def.sTake = (def.sTake || 0) + dmg; else def.nTake = (def.nTake || 0) + dmg; }
}
// NITRO COMBO : 10 coups très rapides (visage, ventre, pied au visage, tibia), le dernier fait tomber
const RUSH_POSE = ['punch1', 'fpunch1', 'kick1', 'ckick'], RUSH_Y = [-74, -50, -76, -14];
const RUSH_N = 8;
function comboHit(att) { att.cmbN = G.frame - (att.cmbLast || -999) < 90 ? (att.cmbN || 1) + 1 : 1; att.cmbLast = G.frame; feedCombo(att); }
function updRush(f, o) {
  f.vx = 0; f.invuln = 6; face(f, o);
  if (f.rushN < RUSH_N) { o.x = f.x + f.dir * 34; o.vx = 0; if (o.state !== 'fall') { o.state = 'hit'; o.stun = 40; } o.air = false; o.y = GROUND; }
  if (f.t >= 3 && (f.t - 3) % 5 === 0 && f.rushN < RUSH_N) {
    f.rushN++; f.rushPose = RUSH_POSE[(f.rushN - 1) % 4];
    const sx = f.x + f.dir * 28, sy = f.y + RUSH_Y[(f.rushN - 1) % 4], dmg = dmgK(4), last = f.rushN >= RUSH_N;
    const vfin = last && f.vaneFin && !f.rushSuper;   // Vane : Surge + Y Y B B / B B Y Y → le dernier coup est le clone mauve qui attrape
    const before = o.hp, keep = !last || f.rushSuper || vfin;   // l'adversaire reste à 1 tant que l'enchaînement n'est pas fini
    if (keep) { const nh = o.hp - dmg; f.rushDebt = (f.rushDebt || 0) + Math.max(0, 1 - nh); o.hp = Math.max(1, nh); }
    else { o.hp = Math.max(0, o.hp - dmg - (f.rushDebt || 0)); f.rushDebt = 0; }
    nitroGain(f, o, before - o.hp); o.lagT = 32; o.flash = 3; comboHit(f);
    addSpark(sx, sy, 'hit'); spawnBlood(sx, sy, f.dir, 4); sfx(f.rushN % 2 ? 'hit' : 'heavy'); G.shake = Math.max(G.shake, 3); G.freeze = Math.max(G.freeze || 0, 2);
    if (f.surgeT > 0) f.rushGhost = G.frame + 2;   // le double mauve frappe juste après
    if (vfin) {   // Lord Vane : l'adversaire est paralysé, Vane charge un clone mauve (X maintenu 1 s, puis A)
      o.paraT = 240; o.stun = 240; G.darkT = Math.max(G.darkT, 30); G.flashT = 10; G.boltX = sx; G.boltY = sy; G.freeze = 10; G.shake = 6;
      addPopup(o.x, o.y - 104, 'PARALYZED!', '#c88aff'); sfx('parry');
      o.x = f.x + f.dir * 96; f.vaneFin = false; const auto = true; setState(f, 'vsuper');   // l'adversaire est repoussé : le clone aura de la place pour foncer
      f.vx = 0; f.chargeT = 0; f.vsAuto = auto; return;
    }
    if (last && f.rushSuper) {   // SURGE + Y Y B A : l'adversaire est paralysé, écran noir, coup spécial chargé
      o.paraT = 240; o.stun = 240; G.darkT = Math.max(G.darkT, 30); G.flashT = 10; G.boltX = sx; G.boltY = sy; G.freeze = 10; G.shake = 6;
      addPopup(o.x, o.y - 104, 'PARALYZED!', '#c88aff'); sfx('parry');
      setState(f, 'nsuper'); f.vx = 0; return;
    }
    if (last) {
      setState(o, 'fall'); o.air = true; o.vy = -6; o.vx = f.dir * 3.2; o.stun = 0;
      const surge = f.surgeT > 0;
      if (surge && f.def.kit === 'grog') {   // Grog : le dernier coup du Surge est l'explosion de son dôme géant
        G.waves.push({ owner: f, x: f.x, dir: f.dir, t: 0, life: 30, small: true, ring: true, dome: true, done: true, big: true });
        o.vy = -7.5; o.vx = f.dir * 5; f.rampT = 0; sfx('parry'); sfx('fb');
      }
      const zFin = surge && f.def.kit === 'zephyr' && o.hp > 0;   // Zephyr : le Surge finit par son shoryuken à 3 coups
      if (zFin) { setState(o, 'hit'); o.air = false; o.y = GROUND; o.vx = 0; o.vy = 0; o.stun = 45; }
      G.darkT = 50; G.flashT = 12; G.boltX = sx; G.boltY = sy; G.freeze = 14; G.shake = 9;
      G.bigPop = { txt: surge ? 'NITRO SURGE COMBO!' : 'NITRO COMBO!', col: surge ? '#d070ff' : '#5aff8a', t: 0 };
      addScore(f, surge ? SCORE_PTS.surge : SCORE_PTS.nitro);
      sfx('fb'); sfx('heavy');
      if (zFin) { setState(f, 'zslash'); f.vx = 0; sfx('whoosh'); return; }
    }
  }
  if (f.rushGhost && G.frame >= f.rushGhost) { f.rushGhost = 0; const sx = f.x + f.dir * 30, sy = f.y + RUSH_Y[(f.rushN + 1) % 4]; addSpark(sx, sy, 'parry'); comboHit(f); if (o.hp > 1) o.hp = Math.max(1, o.hp - 1); sfx('hit'); }
  if (f.rushN >= RUSH_N && f.t > 3 + RUSH_N * 5 + 10) setState(f, 'idle');
}
// coup spécial chargé de chaque personnage (après les 8 coups du Surge + Y Y B A)
const SUPER_PAL = { hiro: ['#ffffff', '#a8f4ff', '#2fb4ff', '#1458c4'], axel: ['#ffffff', '#fff2a0', '#ff9c2c', '#c64812'], nyx: ['#ffffff', '#ffc0f0', '#ff4ac8', '#8a0a6a'],
  vane: ['#ffffff', '#e0a0ff', '#8a2ad0', '#140420'], grog: ['#ffffff', '#a8e8ff', '#2a8aff', '#0a1a6a'], kael: ['#ffffff', '#d8fcff', '#5af0ff', '#1a78d0'],
  zephyr: ['#ffffff', '#d8fbff', '#7ae8f0', '#2a9aaa'], vesper: ['#ffffff', '#c8f8ff', '#3af0ff', '#c83aff'] };
const superKit = f => f.def.kit || (f.def.twinFb ? 'hiro' : 'axel');
function updSuper(f, o) {   // recule, charge (écran noir), puis lâche le projectile géant
  if (!(o.ko)) { o.vx = 0; if (o.state !== 'fall') { o.state = 'hit'; o.stun = 60; } o.paraT = Math.max(o.paraT || 0, 30); }
  f.invuln = 6; face(f, o);
  if (f.t < 12) f.vx = -3.4 * f.dir; else f.vx = 0;
  if (f.t < 58) G.darkT = Math.max(G.darkT, 24);
  if (f.t >= 14 && f.t < 56 && f.t % 3 === 0) {   // énergie qui converge vers les mains
    const ax = superKit(f) === 'axel', a = Math.random() * 6.28, d = 30 + Math.random() * 20, hx2 = f.x + f.dir * 22, hy = f.y - (ax ? 75 : 56);
    (f.chg = f.chg || []).push({ x: hx2 + Math.cos(a) * d, y: hy + Math.sin(a) * d, tx: hx2, ty: hy, t: 0 });
    if (f.t % 12 === 0) sfx('parry');
  }
  if (f.t === 58 && superKit(f) === 'axel') { f.vx = 2.4 * f.dir; sfx('whoosh'); }   // Axel : avance et frappe le sol
  if (f.t === 63 && superKit(f) === 'axel') {
    f.vx = 0; (G.supers = G.supers || []).push({ owner: f, target: o, kit: 'axel', x: f.x + f.dir * 40, y: GROUND - 26, vx: f.dir * 5.5, dir: f.dir, t: 0, pal: SUPER_PAL.axel, bvy: -5.5 });
    for (let i = 0; i < 4; i++) addSpark(f.x + f.dir * (34 + i * 8), GROUND - 4, 'fb', SUPER_PAL.axel);
    G.flashT = 10; G.shake = Math.max(G.shake, 9); sfx('fb'); sfx('heavy');
  }
  if (f.t === 58 && superKit(f) !== 'axel') {
    const kit = superKit(f);
    (G.supers = G.supers || []).push({ owner: f, target: o, kit, x: f.x + f.dir * 30, y: f.y - 54, vx: f.dir * 5.5, dir: f.dir, t: 0, pal: SUPER_PAL[kit] || f.def.fb });
    if (kit === 'zephyr') f.noHat = true;   // Zephyr : le super est son chapeau géant électrique
    G.flashT = 10; G.shake = Math.max(G.shake, 6); sfx('fb'); sfx('heavy');
  }
  if (f.t > 90) { f.chg = null; setState(f, 'idle'); }
}
const HAT_HIT = { dmg: 9, stun: 22, bstun: 12, push: 2, chip: 1, sfx: 'hit' };
const HATJUMP_HIT = { dmg: 10, knock: true, stun: 20, bstun: 12, push: 3, chip: 1, sfx: 'heavy' };
function hatReady(f) { G.darkT = Math.max(G.darkT, 60); G.flashT = 12; G.boltX = f.x + f.dir * 4; G.boltY = f.y - 82; vaneChargeStop(f); sfx('counter'); }
function throwHat(f, o) { f.noHat = true; (G.hats = G.hats || []).push({ owner: f, target: o, x: f.x + f.dir * 20, y: f.y - 70, vx: f.dir * 11, vy: -.5, t: 0, rot: 0, trail: [] }); sfx('fb'); sfx('parry'); sfx('whoosh'); G.flashT = Math.max(G.flashT, 6); G.shake = Math.max(G.shake, 4); }
const ZFLOOR_HIT = { dmg: 7, stun: 40, bstun: 12, push: 1, chip: 0, sfx: 'heavy', unblock: true, low: true };
function updZFloor() {   // éclairs qui courent sur tout le sol après le plongeon de Zephyr : paralysent qui les touche
  for (const q of G.zfloor || []) {
    q.t++; if (q.t > 48) { q.dead = true; continue; }
    const o = G.f.find(g => g !== q.owner); if (!o || q.hit || o.air || o.ko || q.t > 40 || !hurtbox(o)) continue;
    if (Math.abs(o.x - q.x) <= q.t * 11 + 6) { q.hit = true; shock(q.owner, o, ZFLOOR_HIT, o.x, GROUND - 12); o.paraT = Math.max(o.paraT || 0, 40); o.paraBlue = true; addPopup(o.x, o.y - 104, 'PARALYZED!', '#7af0ff'); }
  }
  if (G.zfloor) G.zfloor = G.zfloor.filter(q => !q.dead);
}
const GRUSH_HIT = { dmg: 18, knock: true, stun: 24, bstun: 16, push: 6, chip: 4, sfx: 'heavy', unblock: true };
function drawGrogRush() {   // Grog : charge (électricité qui grossit) puis course électrique (même effet que la vrille de Zephyr)
  for (const f of G.f) {
    if (f.state === 'grogcharge') { const k = Math.min(1, f.chargeT / 78); glowAt(f.x, f.y - 46, 30 + 30 * k, 'rgba(90,200,255,.9)', .2 + .35 * k); zapChaos(f.x, f.y - 2, 22, 90, 2 + Math.round(6 * k), .45); }
    if (f.state === 'grogrush' && f.t >= 3) {
      for (let i = 1; i <= 4; i++) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3 * (1 - i / 5); drawFighter(Object.assign({}, f, { flash: 0, tint: 'rgba(60,150,255,.9)' }), f.x - f.dir * i * 16, f.y); ctx.restore(); }   // échos bleus
      glowAt(f.x, f.y - 46, 60, 'rgba(90,200,255,.9)', .5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .32 + .15 * Math.random(); drawFighter(Object.assign({}, f, { flash: 0, tint: 'rgba(110,210,255,1)' }), f.x, f.y); ctx.restore();
      zapChaos(f.x, f.y - 2, 24, 96, 10, .45);
    }
  }
}
function drawZFloor() {
  drawGrogRush(); drawVClones();
  for (const q of G.zfloor || []) {
    const a = q.t > 30 ? (48 - q.t) / 18 : 1, reach = q.t * 11;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(47,180,255,.25)'; ctx.fillRect(Math.round(q.x - reach), GROUND - 2, Math.round(reach * 2), 3);
    for (const dd of [-1, 1]) {
      for (let line = 0; line < 2; line++) {
        const pts = []; for (let d = 0; d <= reach; d += 7) pts.push([q.x + dd * d, GROUND - 1 - Math.random() * (line ? 9 : 5)]);
        if (pts.length < 2) continue;
        elecArc(pts, 'rgba(20,88,196,.9)', 3); elecArc(pts, 'rgba(90,200,255,1)', 1.6); elecArc(pts, '#ffffff', .8);
      }
      for (let b = 0; b < 4; b++) {   // petits éclairs qui jaillissent du sol
        const bx = q.x + dd * Math.random() * reach, L = [[bx, GROUND]]; let y = GROUND; for (let k = 0; k < 3; k++) { y -= 3 + Math.random() * 5; L.push([bx + (Math.random() - .5) * 8, y]); }
        elecArc(L, 'rgba(168,244,255,.9)', 1);
      }
      glowAt(q.x + dd * reach, GROUND - 6, 16, 'rgba(120,220,255,.9)', .7 * a);
    }
    ctx.restore();
  }
}
function zapChaos(x, y0, w, hgt, n, sc = 1) {   // éclairs chaotiques éparpillés autour du personnage (effet foudre)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    let px = x + (Math.random() - .5) * 2 * w, py = y0 - Math.random() * hgt, ang = Math.random() * 6.28; const L = [[px, py]];
    for (let k = 0; k < 4; k++) { ang += (Math.random() - .5) * 1.6; const len = (4 + Math.random() * 5) * sc; px += Math.cos(ang) * len; py += Math.sin(ang) * len; L.push([px, py]); }
    elecArc(L, 'rgba(20,88,196,.9)', 3); elecArc(L, 'rgba(90,200,255,1)', 1.6); elecArc(L, '#ffffff', .8);
  }
  ctx.restore();
}
function updHats() {   // chapeau de Zephyr : part très vite, téléguidé vers l'adversaire, puis revient en arc sur sa tête
  for (const q of G.hats || []) {
    const f = q.owner, o = q.target; q.t++; q.rot += .9;
    q.trail.unshift([q.x, q.y, q.rot]); if (q.trail.length > 9) q.trail.pop();
    if (!q.back && q.t > 45) hatReturn(q);
    const back = q.back;
    if (back) {   // retour à vitesse normale, en arc (la direction se corrige doucement)
      q.bt = (q.bt || 0) + 1;
      const tx = f.x + f.dir * 3, ty = f.y - 80, dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy) || 1, k = Math.min(.35, .05 + q.bt * .004);
      q.vx += (dx / d * 5 - q.vx) * k; q.vy += (dy / d * 5 - q.vy) * k;
      q.x += q.vx; q.y += q.vy;
      if (d < 14) { q.dead = true; f.noHat = false; if (!f.air && ['idle', 'walk', 'crouch'].includes(f.state)) setState(f, 'hatcatch'); sfx('counter'); }   // attrapé et remis sur la tête
      continue;
    }
    const tx = o.x, ty = o.y - 52, dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy) || 1;   // aller : très rapide et téléguidé
    q.vx += (dx / d * 11 - q.vx) * .3; q.vy += (dy / d * 11 - q.vy) * .3;
    q.x += q.vx; q.y += q.vy;
    if (!q.hit && !q.big && o && !o.ko) {
      const hb = hurtbox(o);
      if (hb && overlap([q.x - 20, q.y - 20, q.x + 20, q.y + 20], hb)) { q.hit = true; applyHit(f, o, HAT_HIT, q.x, q.y, q.x - Math.sign(q.vx || 1) * 10, true); hatReturn(q); }
    }
  }
  if (G.hats) G.hats = G.hats.filter(q => !q.dead);
}
function hatReturn(q) { q.back = true; q.bt = 0; q.vx = -Math.sign(q.vx || 1) * 1.5; q.vy = -6.5; }   // rebondit vers le haut puis revient en arc
function hatDisc(x, y, r, rot, ghost) {   // chapeau vu de dessus : disque de paille 2D qui tourne très vite, entouré d'électricité
  ctx.save(); ctx.translate(x, y);
  if (ghost) {   // écho bleu (comme le Nitro, mais en bleu)
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(47,140,255,.55)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(168,244,255,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.29); ctx.stroke(); ctx.restore(); return;
  }
  ctx.rotate(rot);
  ctx.fillStyle = '#b8944a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.29); ctx.fill();
  ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 1; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.29; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
  for (const k of [.35, .7]) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, 6.29); ctx.stroke(); }
  ctx.fillStyle = '#d8b462'; ctx.beginPath(); ctx.arc(0, 0, r * .18, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#3a2a12'; ctx.fillRect(r * .55, -1, r * .4, 2);   // repère qui montre la rotation
  ctx.strokeStyle = '#3a2a12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.29); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';   // électricité identique à l'onde au sol, mais en cercle
  const g = ctx.createRadialGradient(x, y, r * .5, x, y, r * 1.6);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.4, 'rgba(120,220,255,.45)'); g.addColorStop(1, 'rgba(20,88,196,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 6.29); ctx.fill();
  for (const [rr, col, lw] of [[1.25, 'rgba(20,88,196,.9)', 5], [1.12, 'rgba(47,180,255,1)', 3], [1.04, '#a8f4ff', 2], [.98, '#ffffff', 1.2]]) {
    const pts = []; for (let i = 0; i <= 28; i++) { const t = rot * 1.5 + i / 28 * 6.29; pts.push([x + Math.cos(t) * r * rr, y + Math.sin(t) * r * rr]); }
    elecArc(pts, col, lw);
  }
  for (let b = 0; b < 4; b++) {   // éclairs qui jaillissent du bord
    const t = Math.random() * 6.29, L = []; for (let s2 = 0; s2 <= 3; s2++) L.push([x + Math.cos(t + s2 * .15) * r * (1.1 + s2 * .2), y + Math.sin(t + s2 * .15) * r * (1.1 + s2 * .2)]);
    elecArc(L, 'rgba(168,244,255,.9)', 1.2);
  }
  ctx.restore();
}
function hatShape(x, y, sc, rot) {   // chapeau de paille conique (vu de profil), qui tourne
  ctx.save(); ctx.translate(x, y); ctx.scale(sc * (.75 + .25 * Math.cos(rot)), sc);
  ctx.beginPath(); ctx.moveTo(-17, 2); ctx.quadraticCurveTo(-8, -5, 0, -10); ctx.quadraticCurveTo(8, -5, 17, 2); ctx.closePath();
  ctx.fillStyle = '#b8944a'; ctx.fill(); ctx.strokeStyle = '#3a2a12'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 1; for (const k of [-.5, 0, .5]) { ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(k * 30, 1); ctx.stroke(); }
  ctx.restore();
}
function zapAround(x, y, rx, ry, n, al) {   // éclairs électriques autour d'un point
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al;
  for (let i = 0; i < n; i++) {
    const a0 = Math.random() * 6.28; let px = x + Math.cos(a0) * rx, py = y + Math.sin(a0) * ry;
    ctx.strokeStyle = i % 2 ? '#bff8ff' : '#5ad8ff'; ctx.lineWidth = i % 3 ? 1 : 1.6; ctx.beginPath(); ctx.moveTo(px, py);
    for (let j = 0; j < 3; j++) { const a = a0 + (j + 1) * .35; px = x + Math.cos(a) * rx * (.85 + Math.random() * .3); py = y + Math.sin(a) * ry * (.85 + Math.random() * .3); ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
}
function glowAt(x, y, r, col, al) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill(); ctx.restore(); }
function drawHats() {
  for (const q of G.hats || []) {
        const r = 25 * (q.big ? 1.3 : 1);
    for (let i = q.trail.length - 1; i >= 1; i--) { const [tx, ty] = q.trail[i]; ctx.save(); ctx.globalAlpha = .5 * (1 - i / q.trail.length); hatDisc(tx, ty, r, 0, true); ctx.restore(); }   // échos bleus
    glowAt(q.x, q.y, r * 1.8, 'rgba(120,220,255,.9)', .5);
    hatDisc(q.x, q.y, r, q.rot);
  }
  for (const f of G.f) {
    if (f.def.kit !== 'zephyr') continue;
    if (f.hatHold && !(f.state === 'jump' && f.chargeT >= 60)) {   // énergie qui va et vient sur le contour du chapeau
      const k = Math.min(1, (f.chargeT || 0) / 60), hx = f.x + f.dir * 4, hy = f.y - 82, pul = .5 + .5 * Math.sin(G.frame * .5);
      const gr = 1 + 1.6 * k;   // le cercle électrique grossit pendant la charge
      glowAt(hx, hy, (18 + 10 * k) * gr, 'rgba(120,220,255,.9)', .25 + .45 * k);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#7af0ff'; ctx.lineWidth = 1 + 1.5 * k; ctx.globalAlpha = .4 + .5 * pul;
      ctx.beginPath(); ctx.ellipse(hx, hy, (18 + 3 * pul) * gr, (6 + 1.5 * pul) * gr, 0, 0, 6.29); ctx.stroke(); ctx.restore();
      zapAround(hx, hy, 20 * gr, 8 * gr, 2 + Math.round(5 * k), .5 + .5 * k);
    }
    if (['hover', 'tornado', 'plunge', 'zdash'].includes(f.state) || (f.state === 'jump' && f.hatHold && f.chargeT >= 60)) {   // tout le corps en glow bleu + petits éclairs collés au corps
      const zd = f.state === 'zdash', cyb = zd ? f.y - 34 : f.y - 42;
      glowAt(f.x, cyb, zd ? 52 : 44, 'rgba(90,200,255,.9)', .45);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .32 + .15 * Math.random(); drawFighter(Object.assign({}, f, { flash: 0, tint: 'rgba(110,210,255,1)' }), f.x, f.y); ctx.restore();
      if (zd) zapChaos(f.x, f.y - 22, 34, 26, 9, .45); else zapChaos(f.x, f.y - 4, 15, 80, 9, .45);
    }   // électricité : arrêt en l'air (invincible) et tornade
  }
}
const VCLONE_BLOCK = { dmg: 5, stun: 14, bstun: 14, push: 3, chip: 2, sfx: 'hit' };
function vaneFinish(f, o, k) {   // fin du Surge de Vane : l'adversaire prend les dégâts restants et tombe
  const debt = f.rushDebt || 0; f.rushDebt = 0; const before = o.hp; o.hp = Math.max(0, o.hp - dmgK(k) - debt); nitroGain(f, o, before - o.hp); comboHit(f);
  o.paraT = 0; setState(o, 'fall'); o.air = true; o.vy = -2; o.vx = f.dir * 2.5; o.flash = 4;
  G.bigPop = { txt: 'NITRO SURGE COMBO!', col: '#d070ff', t: 0 }; addScore(f, SCORE_PTS.surge);
}
function updVaneSuper(f, o) {   // X maintenu : énergie mauve dans les mains ; chargé (1 s) puis A : clone qui fonce sur l'adversaire
  const c = f.ctl, h = c.held;
  if (!(o.ko)) { o.vx = 0; if (o.state !== 'fall') { o.state = 'hit'; o.stun = 60; } o.paraT = Math.max(o.paraT || 0, 30); }
  f.invuln = 6; face(f, o); f.vx = 0;
  const hx = f.x + f.dir * 22, hy = f.y - 56;
  if (f.chargeT < 60) {
    if (h.x || f.vsAuto) f.chargeT++;
    else if (f.t > 20) { vaneChargeStop(f); vaneFinish(f, o, 8); setState(f, 'idle'); return; }   // X lâché trop tôt : fin normale
    if (f.chargeT === 8) vaneChargeStart(f);
    if (f.t % 3 === 0) { const a = Math.random() * 6.28, d = 30 + Math.random() * 20; (f.chg = f.chg || []).push({ x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d, tx: hx, ty: hy, t: 0 }); }
    if (f.chargeT === 60) { G.darkT = Math.max(G.darkT, 60); G.flashT = 12; G.boltX = hx; G.boltY = hy; vaneChargeStop(f); sfx('counter'); f.chgT = f.t; }
    return;
  }
  if (take(c, 's') || (f.vsAuto && f.t - f.chgT > 20) || f.t - f.chgT > 150) {   // A : le clone mauve part
    f.chg = null; (G.vclones = G.vclones || []).push({ owner: f, target: o, x: f.x + f.dir * 20, y: f.y, dir: f.dir, t: 0, ph: 'fly', lift: 0, trail: [], fin: true });
    G.flashT = Math.max(G.flashT, 8); G.shake = Math.max(G.shake, 5); sfx('fb'); sfx('tele'); setState(f, 'vsrel');
  }
}
function updVClones() {   // clone mauve de Vane : fonce, attrape l'adversaire au cou, monte doucement, puis explose
  for (const q of G.vclones || []) {
    const o = q.target, f = q.owner; q.t++;
    q.trail.unshift([q.x, q.y, o.x, o.y]); if (q.trail.length > 7) q.trail.pop();
    if (q.ph === 'fly') {
      q.x += q.dir * 7;
      if (!q.fin && Math.abs(o.x - q.x) < 34 && (o.air || o.ko || !hurtbox(o))) { if (q.t > 120) q.dead = true; continue; }   // saute par-dessus : le clone passe
      if (!q.fin && Math.abs(o.x - q.x) < 34 && ['block', 'cblock'].includes(o.state)) { q.dead = true; applyHit(f, o, VCLONE_BLOCK, o.x - q.dir * 10, o.y - 60, q.x, true); addSpark(o.x - q.dir * 12, o.y - 60, 'parry'); continue; }   // paré : le clone se dissipe
      if (Math.abs(o.x - q.x) < 34) { q.ph = 'grab'; q.gt = 0; sfx('heavy'); sfx('parry'); G.shake = Math.max(G.shake, 5); addSpark(o.x - q.dir * 8, o.y - 66, 'parry'); }
      if (q.t > 120) q.dead = true;
      continue;
    }
    q.gt++; q.lift = Math.min(70, q.lift + .85);   // monte lentement avec l'adversaire
    if (q.ox == null) q.ox = o.x; o.x = q.ox + (G.frame % 2 ? 1.2 : -1.2);   // vibration très rapide de gauche à droite jusqu'à l'explosion
    o.vx = 0; o.air = false; o.state = 'hit'; o.stun = 30; o.y = GROUND - q.lift; o.paraT = Math.max(o.paraT || 0, 4);   // électricité autour de l'adversaire pendant la montée
    q.x = o.x - q.dir * 30; q.y = GROUND - q.lift;
    if (q.gt % 10 === 0) sfx('parry');
    if (q.gt >= 84) {   // explosion mauve et noire, l'adversaire retombe
      q.dead = true; (G.vblasts = G.vblasts || []).push({ x: (q.x + o.x) / 2, y: q.y - 50, t: 0, alt: isAltV(f) });
      G.darkT = Math.max(G.darkT, 40); G.flashT = 14; G.boltX = o.x; G.boltY = o.y - 50; G.freeze = 16; G.shake = 14; sfx('fb'); sfx('heavy'); sfx('thud');
      if (q.fin) vaneFinish(f, o, 22);
      else { const before = o.hp; o.hp = Math.max(0, o.hp - dmgK(16)); nitroGain(f, o, before - o.hp); comboHit(f); o.paraT = 0; setState(o, 'fall'); o.air = true; o.vy = -2; o.vx = q.dir * 2.5; o.flash = 4; }
    }
  }
  if (G.vclones) G.vclones = G.vclones.filter(q => !q.dead);
  for (const b of G.vblasts || []) b.t++;
  if (G.vblasts) G.vblasts = G.vblasts.filter(b => b.t < 36);
}
function drawVClones() {
  for (const f of G.f) if ((VALT = isAltV(f)) || true) if (f.vxReady > 0) {   // pixel mauve illuminé devant Vane tant que la charge est prête
    const x = Math.round(f.x + f.dir * 20), y = Math.round(f.y - 50 - floatOff(f)), fade = Math.min(1, f.vxReady / 30), pul = .7 + .3 * Math.sin(G.frame * .3);
    glowAt(x, y, 12 + 4 * pul, 'rgba(200,80,255,.95)', .6 * fade);
    ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = '#e8a0ff'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); ctx.restore();
  }
  for (const f of G.f) if ((VALT = isAltV(f)) || true) if (f.state === 'vsuper' || f.state === 'vxcharge') { const k = Math.min(1, f.chargeT / (f.state === 'vxcharge' ? 72 : 60)); glowAt(f.x + f.dir * 22, f.y - 56, 12 + 26 * k, 'rgba(170,60,255,.95)', .4 + .4 * k); }
  for (const q of G.vclones || []) { VALT = isAltV(q.owner);
    const fig = (x, y) => ({ def: q.owner.def, id: 9, dir: q.dir, state: q.ph === 'grab' ? 'vgrabH' : 'vgrabC', t: 8, flash: 0, x, y, vx: 0, air: false, ghostDraw: true });
    q.trail.forEach(([tx, ty, ox, oy], i) => {   // échos mauves (clone et adversaire qui monte)
      if (i === 0 || i % 2) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22 * (1 - i / 7);
      drawFighter(Object.assign(fig(tx, ty), { tint: 'rgba(170,60,255,.9)' }), tx, ty);
      if (q.ph === 'grab') drawFighter(Object.assign({}, q.target, { flash: 0, tint: 'rgba(200,90,255,.9)' }), ox, oy);
      ctx.restore();
    });
    {   // même rendu que le double de Vane quand il frappe : ombre noire, copie détaillée teintée rose, glow
      const gx = q.x, gy = q.y;
      ctx.save(); ctx.globalAlpha = .3; drawFighter(Object.assign(fig(gx, gy), { tint: 'rgba(8,0,16,.9)' }), gx - q.dir * 3, gy + 1); ctx.restore();
      ctx.save(); ctx.globalAlpha = .62; drawFighter(Object.assign(fig(gx, gy), { tintKeep: '#ff40c8' }), gx, gy); ctx.restore();
      ctx.save(); ctx.globalAlpha = .18; ctx.globalCompositeOperation = 'lighter'; drawFighter(Object.assign(fig(gx, gy), { tint: 'rgba(255,60,210,1)' }), gx, gy); ctx.restore();
    }
    glowAt(q.x, q.y - 50, 40, 'rgba(170,60,255,.9)', .28);
    { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let b = 0; b < 3; b++) { const L = []; for (let s2 = 0; s2 <= 4; s2++) L.push([q.x + (Math.random() - .5) * 30, q.y - 8 - s2 * 18]); elecArc(L, 'rgba(255,120,235,.8)', 1.2); } ctx.restore(); }
  }
  for (const b of G.vblasts || []) { VALT = !!b.alt;   // explosion mauve et noire
    const k = b.t / 36, R0 = 16 + b.t * 5, a = 1 - k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, R0); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.3, `rgba(220,120,255,${.9 * a})`); g.addColorStop(.7, `rgba(138,42,208,${.6 * a})`); g.addColorStop(1, 'rgba(20,4,32,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, R0, 0, 6.29); ctx.fill();
    for (let i = 0; i < 6; i++) { const an = Math.random() * 6.28, L = [[b.x, b.y]]; for (let s2 = 1; s2 <= 4; s2++) L.push([b.x + Math.cos(an) * R0 * s2 / 4 + (Math.random() - .5) * 10, b.y + Math.sin(an) * R0 * s2 / 4 + (Math.random() - .5) * 10]); elecArc(L, 'rgba(255,140,240,.9)', 1.4); }
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(10,0,20,${.6 * a})`; ctx.beginPath(); ctx.arc(b.x, b.y, R0 * .45, 0, 6.29); ctx.fill();   // cœur noir
    ctx.strokeStyle = `rgba(20,0,40,${.8 * a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(b.x, b.y, R0 * .85, 0, 6.29); ctx.stroke();
    ctx.restore();
  }
  VALT = false;
}

function updSupers() {
  updVClones();
  for (const q of G.supers || []) {
    q.t++; q.x += q.vx;
    if (q.bvy != null) { q.bvy += .3; q.y += q.bvy; if (q.y >= GROUND - 26) { q.y = GROUND - 26; q.bvy = -5.5; addSpark(q.x, GROUND - 3, 'fb', q.pal); G.shake = Math.max(G.shake, 3); } }   // super d'Axel : rebondit
    const o = q.target;
    if (!q.dead && o && Math.abs(o.x - q.x) < 30) {
      q.dead = true; const f = q.owner, debt = f.rushDebt || 0; f.rushDebt = 0;
      const before = o.hp; o.hp = Math.max(0, o.hp - dmgK(20) - debt); nitroGain(f, o, before - o.hp); comboHit(f);
      o.paraT = 0; setState(o, 'fall'); o.air = true; o.vy = -6.5; o.vx = q.dir * 3.6; o.flash = 4; o.burn = 90; o.burnPal = q.pal;
      for (let i = 0; i < 3; i++) addSpark(q.x + (Math.random() - .5) * 30, q.y + (Math.random() - .5) * 30, 'fb', q.pal);
      G.darkT = 50; G.flashT = 12; G.boltX = q.x; G.boltY = q.y; G.freeze = 18; G.shake = 12;
      G.bigPop = { txt: 'NITRO SURGE COMBO!', col: '#d070ff', t: 0 };
      if (q.kit === 'zephyr') (G.hats = G.hats || []).push({ owner: f, target: o, x: q.x, y: q.y, vx: -q.dir * 2, vy: -3, t: 0, rot: 0, trail: [], big: true, back: true, hit: true });   // le chapeau revient sur sa tête
      addScore(f, SCORE_PTS.surge);
      sfx('fb'); sfx('heavy'); sfx('thud');
    }
    if (q.x < (G.camL || 0) - 80 || q.x > (G.camL || 0) + W + 80) q.dead = true;
  }
  if (G.supers) G.supers = G.supers.filter(q => !q.dead);
}
function drawSupers() {
  for (const f of G.f) for (const p of f.chg || []) { VALT = isAltV(f);   // charge
    p.t++; p.x += (p.tx - p.x) * .15; p.y += (p.ty - p.y) * .15;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const pal = SUPER_PAL[superKit(f)] || f.def.fb; ctx.fillStyle = pal[2]; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); ctx.restore();
  }
  for (const f of G.f) if ((VALT = isAltV(f)) || true) if (f.state === 'nsuper' && f.t > 14 && f.t < 58) {   // boule qui grossit dans les mains
    const ax = superKit(f) === 'axel', pal = SUPER_PAL[superKit(f)] || f.def.fb, r = 4 + (f.t - 14) * .45, x = f.x + f.dir * (ax ? 22 : 24), y = f.y - (ax ? 75 : 56);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 1, x, y, r * 2.2);
    g.addColorStop(0, pal[0]); g.addColorStop(.35, pal[1]); g.addColorStop(.7, pal[2] + '99'); g.addColorStop(1, pal[3] + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 6.29); ctx.fill(); ctx.restore();
  }
  for (const q of G.supers || []) { VALT = isAltV(q.owner);
    const pal = q.pal, x = Math.round(q.x), y = Math.round(q.y), pulse = 1 + Math.sin(q.t * .6) * .1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (q.kit === 'zephyr') {   // chapeau géant électrique téléguidé
      ctx.restore(); ctx.save(); q.trail = q.trail || []; q.trail.unshift([q.x, q.y]); if (q.trail.length > 6) q.trail.pop(); q.rot = (q.rot || 0) + .45;
      q.trail.forEach(([tx, ty], i) => { ctx.save(); ctx.globalAlpha = .28 * (1 - i / 6); hatShape(tx, ty, 2.4, q.rot - i * .45); ctx.restore(); });
      glowAt(q.x, q.y, 60, 'rgba(120,220,255,.9)', .6); hatShape(q.x, q.y, 2.4, q.rot); zapAround(q.x, q.y - 6, 44, 22, 7, 1);
    } else if (q.kit === 'vesper') {   // grand clone d'énergie
      ctx.restore(); ctx.save(); ctx.globalAlpha = .75;
      drawFighter(Object.assign({}, q.owner, { state: 'fkick', t: 12, x: q.x, y: GROUND, dir: q.dir, rotAng: null, air: false, flash: 0, ghostDraw: true, tint: 'rgba(58,220,255,.9)' }), q.x, GROUND);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .4;
      drawFighter(Object.assign({}, q.owner, { state: 'fkick', t: 12, x: q.x, y: GROUND, dir: q.dir, rotAng: null, air: false, flash: 0, ghostDraw: true, tint: 'rgba(200,60,255,1)' }), q.x - q.dir * 6, GROUND);
    } else {   // grosse sphère (feu, vide, électricité)
      const R0 = 26 * pulse, g = ctx.createRadialGradient(x, y, 2, x, y, R0 * 1.9);
      g.addColorStop(0, pal[0]); g.addColorStop(.3, pal[1]); g.addColorStop(.6, pal[2] + 'cc'); g.addColorStop(1, pal[3] + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R0 * 1.9, 0, 6.29); ctx.fill();
      for (let i = 1; i <= 5; i++) { ctx.globalAlpha = .25 * (1 - i / 6); ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.arc(x - q.dir * i * 10, y, R0 * (1 - i * .12), 0, 6.29); ctx.fill(); }   // traînée
      ctx.globalAlpha = 1;
      if (q.kit === 'grog' || q.kit === 'kael' || q.kit === 'vane') for (let b = 0; b < 3; b++) { const L = []; const a0 = Math.random() * 6.28; for (let k = 0; k <= 4; k++) L.push([x + Math.cos(a0 + k * .5) * (12 + k * 6), y + Math.sin(a0 + k * .5) * (12 + k * 6)]); elecArc(L, pal[1], 1); }
      if (q.kit === 'vane') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(10,0,20,.55)'; ctx.beginPath(); ctx.arc(x, y, R0 * .55, 0, 6.29); ctx.fill(); }
    }
    ctx.restore();
  }
  VALT = false;
}

// double mauve du Surge : il répète chaque coup qui touche, et chaque projectile, un peu après
function surgeStep() {
  for (const g of G.ghostQ || []) if (G.frame >= g.f && !g.done) {
    g.done = true;
    if (g.hit) { const { att, def, data, sx, sy } = g.hit; if (!def.ko && G.fighting && def.state !== 'down') { G.ghostHit = true; applyHit(att, def, data, sx + att.dir * 4, sy, att.x, false); G.ghostHit = false; addSpark(sx, sy, 'parry'); } }
    if (g.shot) { const c = Object.assign({}, g.shot, { t: 0, _ghost: true, _seen: true, mate: null, alive: true, dead: false }); (G[g.arr] = G[g.arr] || []).push(c); sfx('fb'); }
  }
  if (G.ghostQ) G.ghostQ = G.ghostQ.filter(g => !g.done);
  for (const arr of ['fbs', 'blades', 'sonics', 'flasks', 'holos', 'voids']) for (const q of G[arr] || []) {
    if (q._seen || q.charging) continue; q._seen = true;
    const w = q.owner; if (!w || !(w.surgeT > 0) || q._ghost) continue;
    (G.ghostQ = G.ghostQ || []).push({ f: G.frame + 8, arr, shot: Object.assign({}, q) });
  }
}
const LONG_ST = ['nrush', 'nsuper', 'vsuper', 'idle', 'walk', 'block', 'crouch', 'win', 'voidcast', 'down', 'stunned', 'jump', 'fall', 'hover', 'rampart'];
function startBflip(f) { f.slowT = 0; f.rotAng = null; const air = f.air; setState(f, 'bflip'); f.vx = 0; f.echo = []; if (air) { f.t = 3; f.vy = -3.5; f.vx = 1.5 * f.dir; f.flash = 5; } sfx('whoosh'); }
function updFighter(f, o) {
  const c = f.ctl, h = c.held;
  const fwd = f.dir > 0 ? h.r : h.l, back = f.dir > 0 ? h.l : h.r;
  f.t++;
  if (f.def.kit === 'vane') {   // Y ou B maintenu puis lâché (même en se déplaçant) : rafale de 3 coups
    for (const b of ['p', 'k']) { const K2 = b + 'Hold'; if (h[b]) f[K2] = (f[K2] || 0) + 1; else { if ((f[K2] || 0) >= 18) { f.relB = b; f.relT = G.frame; } f[K2] = 0; } }
    if (f.relB && G.frame - f.relT > 10) f.relB = null;
  }
  if (f.restT > 0) {   // temps d'arrêt : seul le coup qui termine un enchaînement reste possible
    f.restT--;
    for (const b of ['p', 'k', 's']) if (c.buf[b] > 0 && !(o.state === 'hit' && FINISHERS.includes((f.combo || '') + b)) && !(G.frame - (f.iseqLast || -999) < 45 && FINISHERS.includes((f.iseq || '') + b))) { c.buf[b] = 0; if (c.q) c.q[b] = 0; }
  }
  if (f.invuln > 0) f.invuln--;
  if (f.vxReady > 0) { f.vxReady--; if (!f.vxReady) addSpark(f.x + f.dir * 20, f.y - 50 - floatOff(f), 'parry'); }   // charge de Vane : 3 s, puis elle disparaît
  if (f.flash > 0) f.flash--;
  if (f.counterT > 0) f.counterT--;
  const live = G.fighting;

  switch (f.state) {
    case 'idle': case 'walk': case 'block': case 'crouch': case 'cblock': {
      if ((f.state === 'block' || f.state === 'cblock') && f.bstun > 0) { f.bstun--; f.vx *= .8; break; }
      face(f, o);
      if (!live) { f.vx = 0; if (f.state !== 'idle') setState(f, 'idle'); break; }
      // 4e coup d'un enchaînement Y Y B / B B Y : A = frappe enflammée
      if (f.def.kit === 'grog' && f.counterT > 0 && o.slowT > 0 && Math.abs(o.x - f.x) < 80 && take(c, 's')) { doThrow(f, o, 'rocket'); f.invuln = 90; addPopup(f.x, f.y - 120, 'ROCKET!', '#5ad0ff'); break; }   // contre + A : fusée électrique
      if (f.vxReady > 0 && take(c, 's')) { f.vxReady = 0; (G.vclones = G.vclones || []).push({ owner: f, target: o, x: f.x + f.dir * 20, y: f.y, dir: f.dir, t: 0, ph: 'fly', lift: 0, trail: [] }); G.flashT = Math.max(G.flashT, 6); sfx('fb'); sfx('tele'); setState(f, 'vsrel'); f.vx = 0; break; }   // Vane chargé : A = clone mauve
      if ((comboReady(f, o) || seqReady(f)) && take(c, 's')) { setState(f, 'flame'); f.vx = 0; markFire(f, o, 's'); break; }
      if (take(c, 's')) {
        if (h.d && f.def.kit === 'grog' && G.frame < (f.rollCd || 0)) break;   // Grog : petite pause avant de pouvoir refaire ses roulades
        if (h.d) { setState(f, f.def.kit === 'grog' ? 'grogroll' : 'nslide'); f.vx = 0; sfx('whoosh'); break; }   // bas + A : glissade au sol qui fait tomber (Grog : 3 roulades)
        if (f.def.kit === 'vesper') {   // Vesper : Lame Zénith / Pas de l'Ombre / Éclair Holographique
          if (h.u) { setState(f, 'zenith'); f.vx = 0; f.invuln = 8; break; }
          if (back) { setState(f, 'shadow'); f.invuln = 14; { const mine = G.mines.filter(m => m.owner === f && !m.dead); if (mine.length >= 3) G.mines = G.mines.filter(m => m !== mine[0]); } G.mines.push({ owner: f, x: f.x, t: 0 }); sfx('tele'); break; }   // jusqu'à 3 mines au sol
          // Clone énergétique : 3 tirs d'affilée, puis 1 seconde d'attente
          if (shotOK(f)) { const third = (f.shotN || 0) === 2; shotUse(f); setState(f, 'holo'); f.vx = 0; f.holoBlue = third; f.holoBig = false; }   // 3e clone : bleu électrique
          break;
        }
        if (f.def.kit === 'vane') {   // Vane : Impact Météore / Téléportation Fantôme / Éclair du Vide
          f.vx = 0;
          if (h.u) { setState(f, 'meteor'); f.invuln = 8; break; }
          if (back) { setState(f, 'pteleport'); f.invuln = 20; break; }
          if (shotOK(f)) { shotUse(f); setState(f, 'voidcast'); break; }
          break;
        }
        if (f.def.kit === 'kael') {   // Kael : Uppercut Plasma / Esquive Éclair / Onde Sonique
          if (h.u) { if (G.frame >= (f.kCd || 0)) { setState(f, 'plasmawall'); f.vx = 0; f.kCd = G.frame + 40 + 15; } break; }   // 1/4 s d'attente entre deux
          if (back) { setState(f, 'flashstep'); f.invuln = 12; sfx('tele'); break; }
          if (shotOK(f) && G.frame >= (f.kCd || 0)) { shotUse(f); setState(f, 'sonic'); f.vx = 0; f.kCd = G.frame + 26 + 15; break; }
          break;
        }
        if (f.def.kit === 'nyx') {   // Nyx : Geyser Alchimique / Écran de Fumée Toxique / Fiole Magma
          f.vx = 0;
          if (h.u) { setState(f, 'geyser'); break; }
          if (back) { const sm = G.smokes.find(c => c.owner === f && !c.dead); if (sm) { if (!sm.used) { sm.used = true; setState(f, 'nyxtele'); f.invuln = 26; sfx('tele'); } } else if (G.frame - (f.smokeLast || -999) >= 30) setState(f, 'smokeback'); break; }   /* nouvelle fumée : 0,5 s après la précédente */   // une seule fumée ; 2e fois : téléportation de l'autre côté
          if (shotOK(f)) { shotUse(f); setState(f, 'flask'); break; }
          break;
        }
        if (f.def.kit === 'zephyr') {   // Zephyr : Tornade Ascendante / Cyclone Rétrograde / Lame de Fond
          if (h.u) { setState(f, 'zslash'); f.vx = 0; sfx('whoosh'); break; }   // glisse en avant, 3 coups de sabre, le 3e monte en tornade électrique
          if (back) { setState(f, 'sink'); f.vx = 0; f.invuln = 50; sfx('tele'); break; }   // passe sous terre et ressort derrière l'adversaire
          if (shotOK(f)) { shotUse(f); setState(f, 'gust'); f.vx = 0; break; }
          break;
        }
        if (f.def.kit === 'grog') {   // Grog : Écrasement Céleste / Rempart de Fer / Impact Sismique
          f.vx = 0;
          if (h.u) { setState(f, 'crush'); break; }
          if (back) { setState(f, 'rampart'); f.rampT = 180; sfx('block'); sfx('parry'); break; }   // bras électrisés pendant 3 s
          if (f.rampT > 0) {   // électricité active + A : explosion du dôme (renvoie les boules de feu)
            f.rampT = 0; setState(f, 'rburst'); G.flashT = Math.max(G.flashT, 8); G.shake = Math.max(G.shake, 6); G.boltX = f.x; G.boltY = f.y - 50; sfx('parry'); sfx('heavy');
            G.waves.push({ owner: f, x: f.x, dir: f.dir, t: 0, life: 30, small: true, ring: true, dome: true, done: true, big: true });   // dôme géant
            G.darkT = Math.max(G.darkT, 20); G.flashT = Math.max(G.flashT, 12); G.shake = Math.max(G.shake, 10); G.freeze = Math.max(G.freeze || 0, 5); sfx('fb');
            if (Math.abs(o.x - f.x) < 150 && hurtbox(o)) applyHit(f, o, RAMPART_HIT, (o.x + f.x) / 2, o.y - 50, f.x, true);   // le dôme repousse l'adversaire proche
            break;
          }
          if (shotOK(f)) { shotUse(f); setState(f, 'quake'); break; }
          break;
        }
        if (h.u && f.def.twinFb && !(G.frame - (f.hsT || -999) < 40)) { setState(f, 'hslide'); f.vx = 0; f.upQ = false; sfx('whoosh'); break; }   // Hiro : glissade basse + mini shoryuken ; haut + A juste après : shoryuken
        if (h.u && f.def.fireUpper && !(G.frame - (f.fjHitT || -999) < 45)) { setState(f, 'fjump'); f.vx = 0; f.upQ = false; break; }   // Axel : saut-poing en feu vers l'avant
        if (h.u) { setState(f, 'uppercut'); f.vx = 0; f.invuln = 11; f.apexT = null; break; }   // (Axel : après un saut-poing réussi, shoryuken en feu)
        if (back) { setState(f, 'flipk'); f.vx = 0; f.flipN = 1; f.flipHits = 0; f.flipQ = false; f.flipFin = false; f.flipS = FLIP_S; break; }   // arrière + A : salto avant coup de pied (x3, puis 4e en feu)
        if (shotOK(f)) { shotUse(f); setState(f, (f.def.fireUpper && !f.def.kit) ? 'axgp' : 'special'); f.vx = 0; f.fired = false; f.chargeT = 0; f.charged = false; break; }
      }
      if (f.def.kit === 'kael' && f.kcharge > 0 && !h.d && take(c, 'p')) { setState(f, 'kbarrage'); f.vx = 0; f.kcharge = Math.max(f.kcharge, 40); f.barN = 0; break; }   // poing encore électrique : rafale de 5 coups
      // Prise après un contre réussi : Y renverse, B projette de l'autre côté
      if (f.counterT > 0 && o.slowT > 0 && Math.abs(o.x - f.x) < 80) {
        if (take(c, 'p')) { doThrow(f, o, 'slam'); break; }
        if (take(c, 'k')) { doThrow(f, o, 'toss'); break; }
      }
      // Contre (X) : fenêtre de parade
      // X collé à l'adversaire : prise automatique (arrière + X : projection derrière soi)
      if (c.buf.x > 0 && Math.abs(o.x - f.x) < 36 && !o.air && !o.ko && !(o.invuln > 0) && ['idle', 'walk', 'crouch', 'block', 'cblock', 'land'].includes(o.state)) { take(c, 'x'); doThrow(f, o, back ? 'toss' : 'slam'); break; }
      if (c.buf.x > 0 && nearProp(f)) { take(c, 'x'); pickProp(f, nearProp(f)); break; }   // X près d'un objet : on le lance
      if (take(c, 'x')) { setState(f, 'parry'); f.vx = 0; sfx('whoosh'); break; }
      // Saut : stick vers le haut (court délai pour laisser passer haut + A)
      if (h.u) {
        f.jumpQ = (f.jumpQ || 0) + 1;
        if (f.jumpQ >= 4) {
          f.jumpQ = 0;
          const vj = f.def.kit === 'vane';   // Lord Vane saute plus haut et plus loin que les autres
          setState(f, 'jump'); f.vy = vj ? -8.6 : -7.4; f.air = true; f.airAtk = false; f.roll = fwd ? 1 : back ? -1 : 0; sfx('jump');
          f.vx = (fwd ? 2.2 : back ? -2.2 : 0) * f.dir * (vj ? 1.4 : 1); break;
        }
      } else f.jumpQ = 0;
      // Accroupi : coups bas, garde basse avec bas + arrière
      if (h.d) {
        f.vx = 0;
        if (take(c, 'p')) { setState(f, 'rupper'); sfx('swing4'); break; }   // accroupi + Y : uppercut montant (anti-aérien)
        if (take(c, 'k')) { setState(f, 'ckick'); f.ckC = 1; sfx('whoosh'); break; }
        const want = back && threatened(f, o) ? 'cblock' : 'crouch';
        if (f.state !== want) { setState(f, want); f.bstun = 0; }
        break;
      }
      if (f.relB) { const b = f.relB; f.relB = null; setState(f, b === 'p' ? 'vtripP' : 'vtripK'); f.vx = 0; f.vtN = 0; break; }   // Vane : rafale de 3 coups
      // avant + Y : coup de poing du bras proche, plus long · avant + B : coup de pied de l'autre jambe, plus long
      if (fwd && f.def.sword && take(c, 'p')) { setState(f, 'wallslash'); f.vx = 0; sfx('whoosh'); break; }   // Zephyr : grand coup de sabre de la tête au sol
      if (take(c, 'p')) { setState(f, fwd ? 'fpunch' : 'punch'); f.vx = 0; sfx('whoosh'); markFire(f, o, 'p'); break; }
      if (take(c, 'k')) { setState(f, fwd ? 'fkick' : 'kick'); f.vx = 0; sfx('whoosh'); markFire(f, o, 'k'); break; }
      if (back && threatened(f, o)) { f.vx = 0; if (f.state !== 'block') { setState(f, 'block'); f.bstun = 0; } break; }
      const tox = f.toxT > 0 ? .45 : 1;   // ralenti dans le liquide toxique
      if (fwd) { f.vx = 1.9 * (f.def.speed || 1) * tox * f.dir; if (f.state !== 'walk') setState(f, 'walk'); }
      else if (back) { f.vx = -1.45 * (f.def.speed || 1) * tox * f.dir; if (f.state !== 'walk') setState(f, 'walk'); }
      else { f.vx = 0; if (f.state !== 'idle') setState(f, 'idle'); }
      break;
    }
    case 'fpunch': if (f.t < 7) f.vx = 1.4 * f.dir; else f.vx = 0;
    // fallthrough
    case 'ckick':
      // enchaînement : on peut relancer un coup de pied bas dès la fin de la frappe
      if (f.t >= 7 && h.d && take(c, 'k')) { setState(f, 'ckick'); sfx('whoosh'); break; }   // bas + B répété : coups de pied bas simples
    // fallthrough
    case 'punch': case 'kick': case 'fkick': case 'cpunch': case 'rupper': case 'flame':
      // combo : dès que le coup touche, on peut enchaîner immédiatement le suivant
      if (f.fireDash > 0) {   // 4e coup en feu : élan rapide vers l'avant, coup actif pendant tout l'élan
        f.fireDash--; f.vx = 7.5 * f.dir; reflectNear(f, 46, f.y - 56, 40);   // l'élan en feu renvoie les boules de feu
        const a0 = ATK[f.state].act[0]; if (f.t > a0) f.t = a0;
        if (f.hasHit) f.fireDash = 0;
        if (!f.fireDash) f.vx = 0;
        break;
      }
      if (f.hasHit && live && ['punch', 'kick', 'fpunch', 'fkick'].includes(f.state) && tryCombo(f, o, c, fwd)) break;
      if (live && ['punch', 'kick', 'fpunch', 'fkick'].includes(f.state) && f.t >= ATK[f.state].act[1] - 1 && tryCombo(f, o, c, fwd)) break;   // enchaînement facilité : le coup suivant part dès la fin de la frappe, même sans toucher
      if (f.t >= ATK[f.state].dur) setState(f, h.d ? 'crouch' : 'idle');
      break;
    case 'gtatsu': {
      const tt = f.t - 6;
      f.vx = tt >= 0 && tt < 48 ? 2.0 * f.dir : 0;
      if (tt >= 0 && tt < 48 && tt % 12 === 0) { f.hasHit = false; sfx('whoosh'); }   // 4 tours = 4 coups
      if (f.t >= 62) setState(f, 'idle');
      break;
    }
    case 'axgp':   // Axel : poing frappé au sol, boule de feu qui rebondit vers l'adversaire (A maintenu : plus grosse et plus rapide)
      if (!f.fired) {
        if (h.s && f.t >= 4 && live) {
          f.chargeT = (f.chargeT || 0) + 1; f.t = Math.min(f.t, 5);
          if (f.chargeT === 8) vaneChargeStart(f);
          if (f.chargeT === chargeMax(f)) { f.charged = true; G.darkT = 60; G.flashT = 12; G.boltX = f.x + f.dir * 22; G.boltY = f.y - 75; vaneChargeStop(f); sfx('counter'); addPopup(f.x, f.y - 100, 'MAX!', '#ffd23a'); }
        } else if (f.t >= 4) { vaneChargeStop(f); f.fired = true; f.gpT = f.t; f.vx = 2.4 * f.dir; sfx('whoosh'); }   // il avance en frappant
      } else {
        const k = f.t - f.gpT;
        if (k >= 3) f.vx = 0;
        if (k === 3) spawnBounceFb(f, f.charged);   // le poing touche le sol
        if (k >= 26) setState(f, 'idle');
      }
      break;
    case 'special':
      if (!f.fired) {
        if (h.s && f.t >= 6 && live) {
          // A maintenu : position de charge
          f.chargeT = (f.chargeT || 0) + 1; f.t = Math.min(f.t, 10);
          if (f.chargeT === 8) vaneChargeStart(f);   // son de charge
          if (f.chargeT === chargeMax(f)) {   // 2 s (1 s si l'énergie est à 80 % ou moins) : charge maximale
            f.charged = true; G.darkT = 60; G.flashT = 12;
            G.boltX = f.x - f.dir * 14; G.boltY = f.y - 44; vaneChargeStop(f); sfx('counter');   // signal : charge complète
            addPopup(f.x, f.y - 100, 'MAX!', '#ffd23a');
          }
        } else if (f.t >= 12) { vaneChargeStop(f); spawnFireball(f, f.charged); f.fired = true; }
      }
      if (f.t >= 40) setState(f, 'idle');
      break;
    case 'uppercut':
      // trajectoire en courbe : d'abord vers l'avant, puis de plus en plus vers le haut
      if (f.t === 0) f.apexT = null;
      if (f.t === 5) { f.air = true; sfx('upper'); }
      if (f.def.fireUpper) {   // John : part loin en avant puis monte en courbe, poing enflammé
        if (f.t === 3) f.fireState = 'uppercut';
        // Axel : shoryuken en feu comme Hiro, mais monte moins haut ; en montant il casse les boules de feu
        if (f.t >= 3 && (f.vy < 0 || !f.air) && f.apexT == null) killShots(f, Math.min(f.x, f.x + 34 * f.dir) - 26, Math.max(f.x, f.x + 34 * f.dir) + 26, f.y - 110, f.y + 6);
        if (f.t >= 5 && f.t <= 10) { f.vx = 4.4 * f.dir; f.vy = [-0.8, -1.3, -2, -3, -4.2, -5.6][f.t - 5]; }
        else if (f.t === 11) { f.vy = -6.0; f.vx = 2.2 * f.dir; }
        else if (f.t > 11 && f.vy < 0) f.vx *= .86;
        if (f.t > 11 && f.vy >= 0 && f.apexT == null) f.apexT = f.t;
        if (f.t >= 4) { const [hp] = grogArm(f, 4, 4); (f.ftrail = f.ftrail || []).push({ x: hp[0], y: hp[1], bx: f.x, by: f.y, t: f.t, st: f.state, rotAng: f.rotAng }); if (f.ftrail.length > 12) f.ftrail.shift(); }   // traînée de feu du poing
        break;
      }
      if (f.t >= 5 && f.t <= 10) { f.vx = 4.2 * f.dir; f.vy = [-0.8, -1.4, -2.2, -3.3, -4.8, -6.6][f.t - 5]; }
      else if (f.t === 11) { f.vy = -7.7; f.vx = 2.4 * f.dir; }
      else if (f.t > 11 && f.vy < 0) f.vx *= .86;
      if (f.t > 11 && f.vy >= 0 && f.apexT == null) f.apexT = f.t;
      break;
    case 'jump':
      if (f.hatHold) {   // saut pendant la charge du chapeau : A lâché en l'air = lancer en l'air
        f.chargeT = (f.chargeT || 0) + 1; if (f.chargeT === 60) hatReady(f);
        if (f.chargeT >= 60 && o && !o.ko && hurtbox(o) && overlap([f.x - 20, f.y - 80, f.x + 20, f.y], hurtbox(o))) {   // roulade électrique qui touche l'adversaire : coup, la charge s'arrête (chapeau gardé)
          applyHit(f, o, HATJUMP_HIT, (f.x + o.x) / 2, f.y - 50, f.x, true); f.hatHold = false; f.airAtk = true; vaneChargeStop(f); addSpark((f.x + o.x) / 2, f.y - 50, 'parry'); break;
        }
        if (!h.s) { f.hatHold = false; f.airAtk = true; vaneChargeStop(f); if (f.chargeT >= 60) throwHat(f, o); }
        break;
      }
      if (!f.airAtk && live) {
        if (take(c, 'p')) { setState(f, 'jpunch'); f.airAtk = true; sfx('whoosh'); }
        else if (take(c, 'k')) { setState(f, 'jkick'); f.airAtk = true; sfx('whoosh'); }
        else if (f.airNoS) { if (c.buf.s > 0) take(c, 's'); }   // roulade de retour : coups simples seulement
        else if (f.def.kit === 'vane' && h.d && take(c, 's')) {   // en l'air + bas + A : coup de pied en diagonale vers le bas
          setState(f, 'vdive'); f.airAtk = true; f.bounced = false; sfx('upper');
        }
        else if (f.def.kit === 'vane' && take(c, 's')) {   // en l'air + A : grosse sphère du vide en diagonale vers le sol
          setState(f, 'airvoid'); f.airAtk = true;
        }
        else if (f.def.kit === 'zephyr' && h.d && take(c, 's')) {   // Zephyr : en l'air + bas + A : arrêt en l'air puis plongeon sabre pointé vers le sol
          setState(f, 'hover'); f.airAtk = true; f.vx = 0; f.vy = 0; sfx('whoosh');
        }
        else if (f.def.kit === 'zephyr' && take(c, 's')) {   // Zephyr : en l'air + A : vrille électrique horizontale vers l'avant
          setState(f, 'zdash'); f.airAtk = true; f.vx = 0; f.vy = 0; sfx('upper'); sfx('parry');
        }
        else if (f.def.kit === 'grog' && take(c, 's')) {   // Grog : chute verticale comme un poids énorme
          setState(f, 'gpound'); f.airAtk = true; f.vx = 0; f.vy = -1.2; sfx('whoosh');
        }
        else if (f.def.kit === 'nyx' && take(c, 's')) {   // Nyx : plane (1 s, jusqu'à 2 s si A reste appuyé)
          setState(f, 'nyxglide'); f.airAtk = true; sfx('whoosh');
        }
        else if (f.def.kit === 'kael' && take(c, 's')) {   // Kael : coup de pied rotatif 360° électrique sur place (2 tours), renvoie les projectiles
          setState(f, 'kspin'); f.airAtk = true; f.vy = Math.min(f.vy, 0); sfx('upper'); sfx('parry');
        }
        else if (f.def.kit === 'vesper' && take(c, 's')) {
          // Vesper : coup de pied plongeant en diagonale avec traînée néon
          setState(f, 'dive'); f.airAtk = true; f.trail = []; f.bounced = false; sfx('upper');
        }
        else if (f.def.twinFb && (f.airFb || 0) < 2 && take(c, 's')) {   // Hiro : boule de feu en diagonale vers le sol, puis recule (2 fois par saut)
          setState(f, 'airfb'); f.airFb = (f.airFb || 0) + 1;
          G.fbs.push({ owner: f, x: f.x + f.dir * 26, y: f.y - 48, vx: 3.6 * f.dir, vy: 2.7, dir: f.dir, t: 0, alive: true, big: false, sc: 1 });
          f.vx = -2.4 * f.dir; f.vy = Math.min(f.vy, -1.6); sfx('fb');
        }
        else if (f.def.twinFb) { if (c.buf.s > 0) take(c, 's'); }
        else if (take(c, 's')) {
          // Axel : 3 saltos coup de pied rapides vers l'avant (durée du tatsumaki)
          setState(f, 'aflip'); f.airAtk = true;
          f.vy = Math.min(f.vy, -1.5); f.vx = 2.7 * f.dir; sfx('upper');
        }
      }
      break;
    case 'tatsu':
      f.vy -= GRAV * 0.45; // plane un peu pendant la rotation
      if (f.t % 8 === 4) sfx('whoosh');
      break;
    case 'dive':
      if (f.t < 3) { f.vx *= .5; f.vy = Math.min(f.vy, 0) * .5; }
      else if (!f.hasHit) {
        f.vx = 5.2 * f.dir; f.vy = 5.6 - GRAV;
        if (killShots(f, f.x + f.dir * 27 - 16, f.x + f.dir * 27 + 16, f.y - 30, f.y + 6)) f.hasHit = true;   // touche un projectile : coup annulé
      }
      (f.trail = f.trail || []).push([f.x + f.dir * 27, f.y - 1]); if (f.trail.length > 14) f.trail.shift();
      if (f.hasHit) {   // retour : grand saut rapide en roulade arrière (Y / B possibles, pas A)
        f.trail = null; setState(f, 'jump'); f.air = true; f.roll = -1; f.t = 3; f.rollT = 22; f.vx = -4.4 * f.dir; f.vy = -5.6; f.airAtk = false; f.airNoS = true; sfx('jump');
      }
      break;
    case 'land':
      if (f.def.twinFb && G.frame - (f.hsT || -999) < 40 && h.u && take(c, 's')) { setState(f, 'uppercut'); f.vx = 0; f.invuln = 11; f.apexT = null; break; }   // Hiro : haut + A dès l'atterrissage de la glissade
      if (f.t >= f.landT) setState(f, 'idle'); break;
    case 'hit':
      // on peut parer le tour suivant d'une tornade même après avoir encaissé le premier
      if ((o.state === 'gtatsu' || (o.state === 'flipk' && !o.flipFin) || o.state === 'aflip') && take(c, 'x')) { setState(f, 'parry'); f.vx = 0; break; }
      f.vx *= .82; if (f.t >= f.stun) setState(f, 'idle'); break;
    case 'down':
      f.vx *= .8;
      if (!f.ko && f.t >= 40) { setState(f, 'getup'); f.invuln = 22; }
      break;
    case 'getup':
      if (f.t >= 16) {
        // plus de la moitié de l'énergie perdue : se relève étourdi 4 secondes
        if (f.hp <= 50 && G.frame - (f.dizzyEnd || -9999) > 480) { setState(f, 'stunned'); f.stun = 240; f.dizzy = true; f.mash = 0; f.mashShow = 0; }
        else setState(f, 'idle');
      }
      break;
    case 'nrush': updRush(f, o); break;
    case 'nsuper': updSuper(f, o); break;
    case 'vsuper': updVaneSuper(f, o); break;
    case 'vxcharge': {   // X maintenu 1 s : écran foncé ; puis A = clone mauve qui attrape l'adversaire par le cou
      f.vx = 0; face(f, o); const hx = f.x + f.dir * 22, hy = f.y - 56;
      if (f.chargeT < 72) {
        if (!h.x) { vaneChargeStop(f); f.chg = null; setState(f, 'idle'); break; }   // relâché trop tôt : plus aucune trace de la charge
        f.chargeT++; if (f.chargeT === 16) vaneChargeStart(f);
        if (f.t % 3 === 0) { const a = Math.random() * 6.28, d = 30 + Math.random() * 20; (f.chg = f.chg || []).push({ x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d, tx: hx, ty: hy, t: 0 }); }
        if (f.chargeT === 72) { G.darkT = Math.max(G.darkT, 60); G.flashT = 12; G.boltX = hx; G.boltY = hy; vaneChargeStop(f); sfx('counter'); f.chg = null; f.vxReady = 180; setState(f, 'idle'); }   // chargé : Vane reprend ses mouvements, la charge reste 3 s
        break;
      }
      if (take(c, 's')) { f.chg = null; (G.vclones = G.vclones || []).push({ owner: f, target: o, x: f.x + f.dir * 20, y: f.y, dir: f.dir, t: 0, ph: 'fly', lift: 0, trail: [] }); G.flashT = Math.max(G.flashT, 6); sfx('fb'); sfx('tele'); setState(f, 'vsrel'); break; }
      if (f.t - f.chgT > 150) { f.chg = null; setState(f, 'idle'); }   // pas de A : la charge se perd
      break;
    }
    case 'vsrel': f.vx = 0; if (f.t >= 24) setState(f, 'idle'); break;
    case 'nitroUp': f.vx = 0; if (f.t >= 10) setState(f, 'idle'); break;
    case 'parry': f.vx = 0; if (f.t <= 14 && take(c, 's')) { startBflip(f); break; }
      if (f.def.kit === 'vane' && h.x && f.t >= 12 && live) { setState(f, 'vxcharge'); f.chargeT = 12; break; }   /* Vane : X maintenu = charge du clone mauve */
      if (f.t >= 22) setState(f, 'idle'); break;   // X puis A : petit saut + coup de pied tournoyant vers l'arrière
    case 'stunned':
      f.vx *= .8;
      if (f.dizzy) {
        // marteler les boutons pour sortir plus vite de l'étourdissement
        let n = 0;
        if (f.cpu) { if (rand() < [.02, .12, .22, .35][DL()]) n = 1; }
        else for (const b of [...BTNS, 'l', 'r', 'u', 'd']) if (edge(c, b)) n++;
        if (n) { f.t += 9 * n; f.mash += n; f.mashShow = 40; }
        if (f.mashShow > 0) f.mashShow--;
      }
      if (f.t >= f.stun) { setState(f, 'idle'); if (f.dizzy) { f.dizzy = false; f.dizzyEnd = G.frame; } }
      break;
    case 'throw': f.vx = 0; updThrow(f); if (f.t >= (f.throwType === 'rocket' ? 74 : 38)) { f.y = GROUND; f.rotAng = null; f.victim = null; setState(f, 'idle'); } break;
    case 'held':   // positionné par le lanceur ; si la projection est interrompue, la victime retombe (jamais figée)
      if (o.state !== 'throw' || f.t > 150) { f.air = f.y < GROUND - 1; if (f.air) { setState(f, 'fall'); f.vy = 1; f.vx = 0; } else { f.y = GROUND; setState(f, 'idle'); } }
      return;
    case 'holo':
      f.vx = 0;
      if (f.t === 6 && h.s && live && f.def.kit === 'vesper' && !f.holoBig) { setState(f, 'vcharge'); f.chargeT = 0; break; }   // A maintenu : clone chargé
      if (f.t === 7) { G.holos.push({ owner: f, x: f.x + f.dir * 16, y: f.y, dir: f.dir, t: 0, blue: f.holoBlue || f.holoBig, big: f.holoBig, trail: [] }); sfx('fb'); if (f.holoBig) { sfx('parry'); G.shake = Math.max(G.shake, 3); } f.holoBlue = false; f.holoBig = false; }
      if (f.t >= 24) setState(f, 'idle');
      break;
    case 'vcharge': {   // Vesper charge (A maintenu) : 1 s = écran foncé, puis A lâché = clone bleu électrique rapide
      f.vx = 0; f.chargeT = (f.chargeT || 0) + 1;
      if (f.chargeT === 8) vaneChargeStart(f);
      if (f.chargeT === 60) { G.darkT = Math.max(G.darkT, 60); G.flashT = 12; G.boltX = f.x + f.dir * 18; G.boltY = f.y - 56; vaneChargeStop(f); sfx('counter'); }
      if (!h.s) { vaneChargeStop(f); f.holoBig = f.chargeT >= 60; setState(f, 'holo'); f.t = 7 - 1; f.chargeT = 0; }
      break;
    }
    case 'shadow':   // recule très vite en laissant une mine
      f.vx = f.t < 12 ? -f.dir * 5.5 : f.vx * .6;
      if (f.t >= 18) { f.vx = 0; setState(f, 'idle'); }
      break;
    case 'zenith':   // salto vers le haut, lame tendue, retombe derrière l'adversaire
      if (f.t === 3) { f.air = true; f.vy = -8 * 1.5; f.vx = 1.5 * f.dir * Math.min(3.6, Math.max(1.8, (Math.abs(o.x - f.x) + 30) / 22)); sfx('upper'); }
      if (f.air && f.t > 3) f.vy += GRAV * 1.25;   // saut plus rapide, retombe plus vite
      if (f.air) f.rotAng = f.dir * Math.min(1, f.t / 20) * Math.PI * 2;   // rotation 2x plus rapide
      break;
    case 'quake':   // frappe le sol : onde de choc au ras du sol
      f.vx = 0;
      if (f.t === 6 && h.s && live && f.def.kit === 'grog') { setState(f, 'grogcharge'); f.chargeT = 0; break; }   // A maintenu : prépare la charge électrique
      if (f.t === 12) { G.waves.push({ owner: f, x: f.x + f.dir * 22, dir: f.dir, t: 0, life: 75 }); G.shake = Math.max(G.shake, 5); sfx('thud'); sfx('heavy'); }
      if (f.t >= 34) setState(f, 'idle');
      break;
    case 'grogcharge': {   // A maintenu 1,3 s : écran foncé ; A lâché = course électrique sur tout l'écran
      f.vx = 0; f.chargeT = (f.chargeT || 0) + 1;
      if (f.chargeT === 8) vaneChargeStart(f);
      if (f.chargeT === 78) { G.darkT = Math.max(G.darkT, 60); G.flashT = 12; G.boltX = f.x; G.boltY = f.y - 50; vaneChargeStop(f); sfx('counter'); }
      if (!h.s) { vaneChargeStop(f); if (f.chargeT >= 78) { setState(f, 'grogrush'); f.rushD = 0; f.rushPx = null; sfx('upper'); sfx('fb'); sfx('parry'); G.shake = Math.max(G.shake, 6); } else { setState(f, 'quake'); f.t = 7; } }
      break;
    }
    case 'grogrush': {   // course électrique : invincible, détruit tout sur son passage ; seul X puis A l'arrête
      f.invuln = Math.max(f.invuln || 0, 2);
      if (f.t < 3) { f.vx = 0; break; }
      const px = f.x; f.vx = 12 * f.dir; f.rushD += 12;
      if (f.t % 4 === 0) sfx('whoosh');
      killShots(f, f.x - 44, f.x + 44, f.y - 120, f.y + 4);   // même la grosse sphère de Lord Vane
      if (o && !o.ko && Math.abs(o.x - f.x) < 46 && hurtbox(o)) {
        if (o.state === 'bflip') {   // contre X puis A : Grog se met en garde et glisse en arrière, sans être touché
          setState(f, 'block'); f.bstun = 22; f.vx = -7 * f.dir; G.flashT = Math.max(G.flashT, 6); G.freeze = Math.max(G.freeze || 0, 6); addSpark((o.x + f.x) / 2, f.y - 50, 'parry'); sfx('parry'); sfx('block'); addPopup(o.x, o.y - 110, 'COUNTER!', '#7af0ff'); break;
        }
        if (!f.hasHit) { f.hasHit = true; applyHit(f, o, GRUSH_HIT, (o.x + f.x) / 2, f.y - 50, f.x, true); G.shake = Math.max(G.shake, 10); }
      }
      if (f.rushD >= W + 40 || (f.t > 6 && Math.abs(f.x - (f.rushPx != null ? f.rushPx : px - 99)) < .5)) { setState(f, 'grogstop'); f.vx = 4 * f.dir; break; }   // a traversé l'écran (ou bloqué au bord)
      f.rushPx = f.x;
      break;
    }
    case 'grogstop': f.vx *= .75; if (f.t >= 16) { f.vx = 0; setState(f, 'idle'); } break;
    case 'rampart': f.vx = 0; if (f.t >= 18) setState(f, 'idle'); break;
    case 'rburst': f.vx = 0; if (f.t >= 22) setState(f, 'idle'); break;
    case 'crush':   // grand bond vertical, suit l'adversaire en montant
      if (f.t < 6) { f.vx = 0; break; }
      if (f.t === 6) { f.air = true; f.vy = -9.6; sfx('upper'); }
      f.vx = f.dir * .8; f.rotAng = f.dir * Math.min(1, (f.t - 6) / 24) * Math.PI * 2;   // roulade en l'air
      if (f.t > 8 && f.vy >= -.5) { f.rotAng = null; setState(f, 'crushD'); f.vx = f.dir * 4.2; sfx('whoosh'); sfx('fb'); }
      break;
    case 'crushD':   // plongeon poings en avant
      f.rotAng = f.dir * 2.3; f.vy = 6.2 - GRAV; f.vx = f.dir * 4.2;   // descente en diagonale électrique
      break;
    case 'gpound':
      f.vx = 0; if (f.t < 7) f.vy = Math.min(f.vy, 0) - GRAV * .85; else f.vy = 10 - GRAV;
      break;
    case 'crushLand': f.vx = 0; if (f.t >= 20) setState(f, 'idle'); break;
    case 'zslash':   // glissade + 3 coups de sabre de bas en haut, puis tornade
      f.vx = f.t < 22 ? 5.2 * f.dir * (1 - f.t / 30) : 0;   // avance aussi loin que la glissade de Hiro
      if (f.t === 2 || f.t === 10 || f.t === 18) { f.hasHit = false; sfx('whoosh'); }
      if (f.t >= 24) { setState(f, 'tornado'); f.invuln = 10; sfx('parry'); }
      break;
    case 'hatcharge': {   // A maintenu : la main tient le chapeau, l'énergie se charge ; Zephyr peut avancer / reculer (plus lentement) ou sauter
      face(f, o); f.hatHold = true; f.chargeT = (f.chargeT || 0) + 1;
      if (f.chargeT === 8) vaneChargeStart(f);
      if (f.chargeT === 60) hatReady(f);   // 1 s : écran foncé + éclat sur le chapeau (comme Hiro)
      if (!h.s) { vaneChargeStop(f); f.hatHold = false; if (f.chargeT >= 60) setState(f, 'hatthrow'); else { setState(f, 'gust'); f.t = 6; } break; }   // A lâché : lance le chapeau (ou lame d'air si trop tôt)
      if (live && h.u) { const full = f.chargeT >= 60; setState(f, 'jump'); f.hatHold = true; f.vy = -7.4; f.air = true; f.airAtk = false; f.roll = full ? (back ? -1 : 1) : 0; f.rollT = 30; f.vx = (fwd ? 2.2 : back ? -2.2 : 0) * f.dir; sfx('jump'); if (full) sfx('parry'); break; }   // chargé à fond : saut en roulade électrique
      const full = f.chargeT >= 60, sp = f.def.speed || 1;   // chargé à fond : marche à vitesse normale
      f.vx = fwd ? (full ? 1.9 * sp : 1.1) * f.dir : back ? (full ? -1.45 * sp : -.85) * f.dir : 0;
      break;
    }
    case 'hatthrow':
      f.vx = 0;
      if (f.t === 4) throwHat(f, o);
      if (f.t >= 18) setState(f, 'idle');
      break;
    case 'hatcatch': f.vx = 0; if (f.t >= 10) setState(f, 'idle'); break;
    case 'gust':   // coup de sabre qui libère une lame d'air en croissant
      f.vx = 0;
      if (f.t === 6 && h.s && live && f.def.kit === 'zephyr') { setState(f, 'hatcharge'); f.chargeT = 0; break; }   // A maintenu : charge du chapeau
      if (f.t === 7) { G.blades.push({ owner: f, x: f.x + f.dir * 30, y: f.y - 50, dir: f.dir, t: 0 }); sfx('whoosh'); sfx('fb'); }
      if (f.t >= 26) setState(f, 'idle');
      break;
    case 'sink': {   // s'enfonce dans le sol dans un éclair, puis ressort juste derrière l'adversaire
      f.vx = 0; f.invuln = Math.max(f.invuln, 2);
      if (f.t <= 20) f.sinkK = f.t / 20;
      if (f.t === 21) { f.x = Math.max(18, Math.min(SW - 18, o.x + Math.sign(o.x - f.x || 1) * 34)); f.dir = o.x > f.x ? 1 : -1; sfx('tele'); G.flashT = Math.max(G.flashT, 3); }
      if (f.t > 21) f.sinkK = Math.max(0, 1 - (f.t - 21) / 16);
      if (f.t >= 44) { f.sinkK = 0; setState(f, 'idle'); }
      break;
    }
    case 'cyclone':   // bond en arrière + bourrasque qui aspire l'adversaire
      if (f.t === 4) { f.air = true; f.vy = -4.6; f.vx = -f.dir * 3.4; f.pullT = 40; sfx('whoosh'); }
      if (!f.air && f.t > 6) { f.vx *= .7; if (f.t >= 30) setState(f, 'idle'); }
      break;
    case 'voidcast':
      f.vx = 0;
      if (f.t === 8) { G.voids.push({ owner: f, x: f.x + f.dir * 36, y: f.y - 54, vx: 0, vy: 0, dir: f.dir, t: 0, r: 10, slow: true, charging: true, ch: 0 }); vaneChargeStart(f); }
      if (f.t === 9) {   // maintenir A : la sphère grossit dans la main ; relâcher pour la lancer
        const q = G.voids.find(v => v.owner === f && v.charging);
        if (q) {
          const held = f.ctl && f.ctl.held && f.ctl.held.s;
          if (held && q.ch < 300) { q.ch++; f.t = 8; }   /* tenue jusqu'à 5 s */
          else {
            const c = Math.min(1, q.ch / 90); q.charging = false; q.c = c; q.vx = f.dir * (3.2 - 2 * c);   // plus elle est grosse, plus elle est lente
            q.hit = Object.assign({}, VOID_HIT, { dmg: Math.round(8 + 24 * c), stun: c > .5 ? 54 : 18, push: .6 + c * 3, chip: 1 + Math.round(c * 5), knock: c > .75 });
            G.shake = Math.max(G.shake, 2 + c * 6); vaneChargeStop(f); if (!(AC && playSample('vlaunch', .55 + c * .3, 1.1 - c * .2, true))) sfx('fb');   // son de lancer, plus grave et plus fort quand la sphère est grosse
          }
        }
      }
      if (f.t >= 30) setState(f, 'idle');
      break;
    case 'airvoid':
      f.vy = Math.min(f.vy, 0) - GRAV * .6;
      if (f.t === 6) { G.voids.push({ owner: f, x: f.x + f.dir * 20, y: f.y - 46, vx: f.dir * 4.2, vy: 4.2, dir: f.dir, t: 0, r: 13, big: true }); if (!(AC && playSample('vlaunch', .65, 1, true))) sfx('fb'); sfx('heavy'); }
      if (f.t >= 18) setState(f, 'jump');
      break;
    case 'pteleport':   // recule d'un mètre en se désintégrant, puis se réintègre dans le dos de l'adversaire
      if (f.t < 14) { f.vx = -f.dir * 3.2; f.fadeK = f.t / 14; if (f.t % 2 === 0) vaneDust(f, false); }
      if (f.t === 1) sfx('tele');
      if (f.t === 14) { f.vx = 0; f.x = Math.max(18, Math.min(SW - 18, o.x - (o.dir || 1) * 76)); f.dir = o.x > f.x ? 1 : -1; sfx('tele'); }
      if (f.t >= 14) { f.vx = Math.abs(o.x - f.x) > 26 ? f.dir * 3.6 : 0; f.fadeK = Math.max(0, 1 - (f.t - 14) / 14); if (f.t % 2 === 0) vaneDust(f, true); }   // réapparaît en s'approchant de l'adversaire
      if (f.t >= 28) { f.vx = 0; f.fadeK = 0; setState(f, 'tpstrike'); sfx('whoosh'); }
      break;
    case 'tpstrike': f.vx = 0; if (f.t >= 22) setState(f, 'idle'); break;
    case 'meteor':
      if (f.t === 2) { f.air = true; f.vy = -9.2; f.vx = f.dir * 1.2; sfx('upper'); }
      if (f.air) f.rotAng = f.dir * f.t * .45;
      if (f.t > 6 && f.vy >= -.5) { f.rotAng = null; setState(f, 'meteorD'); f.vx = f.dir * 5; sfx('whoosh'); }
      break;
    case 'meteorD':
      f.vy = 6.4 - GRAV; f.vx = f.dir * 5;
      break;
    case 'sonic':   // direct du droit supersonique
      f.vx = f.t < 6 ? f.dir * 1.5 : 0;
      if (f.t === 6) { G.sonics.push({ owner: f, x: f.x + f.dir * 30, x0: f.x + f.dir * 30, y: f.y - 56, dir: f.dir, t: 0, big: f.kcharge > 0 }); if (f.kcharge > 0) f.kcharge = 0; sfx('heavy'); sfx('fb'); G.shake = Math.max(G.shake, 2); }
      if (f.t >= 26) setState(f, 'idle');
      break;
    case 'plasmawall':   // bras levé, vu de face : mur électrique du sol jusqu'en haut de l'écran
      f.vx = 0;
      if (f.t < 8) killShots(f, f.x - 30, f.x + 30, f.y - 110, f.y + 6);   // déjà protégé pendant qu'il lève le bras
      if (f.t === 8) { G.pwalls.push({ owner: f, x: f.x + f.dir * 42, t: 0, big: f.kcharge > 0 }); if (f.kcharge > 0) f.kcharge = 0; G.shake = Math.max(G.shake, 4); G.flashT = Math.max(G.flashT, 4); sfx('parry'); sfx('heavy'); }
      if (f.t >= 40) setState(f, 'idle');
      break;
    case 'kbarrage':   // 5 coups de poing électriques très rapides en avançant ; si les 5 touchent, le 5e fait tomber
      f.vx = f.t < 30 ? 2.2 * f.dir : 0;   // avance aussi loin qu'il a reculé avec l'Esquive Éclair
      if (f.t < 30) {   // les poings détruisent boules de feu, clones, projectiles et fumée de confusion
        const x0 = f.dir > 0 ? f.x : f.x - 60, x1 = f.dir > 0 ? f.x + 60 : f.x;
        killShots(f, x0, x1, f.y - 96, f.y - 24);
        for (const sm of G.smokes || []) if (!sm.dead && sm.owner !== f && Math.abs(sm.x - (f.x + f.dir * 30)) < 40) { sm.dead = true; sm.t = 9999; (G.clashFx = G.clashFx || []).push({ x: sm.x, y: f.y - 50, t: 0 }); sfx('parry'); }
      }
      if (f.t < 30 && f.t % 6 === 0) { f.hasHit = false; sfx('whoosh'); }
      if (f.t >= 40) { f.kcharge = 0; setState(f, 'idle'); }
      break;
    case 'kspin': {   // roulade avant très rapide dans la continuité du saut, redescend lentement, renvoie les projectiles
      if (f.vy > 0) f.vy = Math.min(1.6, f.vy - GRAV * .65);
      f.vx = h.r ? 2.4 : h.l ? -2.4 : f.vx * .92;   // dirigeable à gauche / à droite
      f.rotAng = f.dir * f.t * (Math.PI * 2 / 7);
      reflectNear(f, 48, f.y - 54, 44); if (f.t % 7 === 1) sfx('whoosh');
      break;
    }
    case 'vtripP': case 'vtripK':   // Vane : 5 coups très rapides en avançant, le 5e fait tomber
      f.vx = f.t < 40 ? 1.8 * f.dir : 0;
      if (f.t < 40 && f.t % 8 === 0) { f.hasHit = false; sfx('whoosh'); }
      if (f.t >= 46) setState(f, 'idle');
      break;
    case 'vdive':   // Vane : coup de pied plongeant en diagonale, casse les boules de feu (pas les grosses)
      if (f.t < 2) { f.vx *= .5; f.vy = Math.min(f.vy, 0) * .5; break; }
      if (!f.hasHit) { f.vx = 5 * f.dir; f.vy = 5.4 - GRAV; killShots(f, f.x + f.dir * 26 - 18, f.x + f.dir * 26 + 18, f.y - 36, f.y + 6, true); }
      else if (!f.bounced) { f.bounced = true; f.vx = -1.6 * f.dir; f.vy = -3.2; }
      break;
    case 'hslide': {   // Hiro : glisse en s'abaissant (passe sous les boules de feu), puis petit saut uppercut
      if (f.t < 3) { f.vx = 0; break; }
      if (f.t < 15) f.vx = 6 * f.dir;
      if (f.t === 15) { f.air = true; f.vy = -3.4; f.vx = 1.4 * f.dir; f.y -= 1; sfx('upper'); }
      if (h.u && take(c, 's')) f.upQ = true;   // haut + A à nouveau : shoryuken à l'atterrissage
      if (f.upQ && f.hasHit) { f.upQ = false; setState(f, 'uppercut'); f.invuln = 11; f.apexT = null; f.t = 4; f.hsT = G.frame; }   // 1er coup reçu (même en garde) : enchaîne tout de suite le shoryuken
      break;
    }
    case 'fjump': {   // Axel : saut en arc, pas haut mais loin, poing en feu
      if (f.t < 4) { f.vx = 0; break; }
      if (f.t === 4) { f.air = true; f.vy = -4.6; f.vx = 5.6 * f.dir; f.y -= 1; f.fireState = 'fjump'; sfx('upper'); sfx('fb'); }
      if (f.hasHit) f.vx *= .85;
      if (f.hasHit && h.u && take(c, 's')) f.upQ = true;   // haut + A pendant le saut : shoryuken en feu à l'atterrissage
      const [hp] = grogArm(f, 4, 4); (f.ftrail = f.ftrail || []).push({ x: hp[0], y: hp[1], bx: f.x, by: f.y, t: f.t, st: f.state, rotAng: f.rotAng }); if (f.ftrail.length > 12) f.ftrail.shift();
      break;
    }
    case 'aflip': {   // 3 saltos avant coup de pied en l'air
      f.vy -= GRAV * .45;
      f.rotAng = f.dir * Math.min(3, f.t / 12) * Math.PI * 2;
      if (f.t % 12 === 0 && f.t < 36) { f.hasHit = false; sfx('whoosh'); }
      if (f.t >= 36) { setState(f, 'jump'); f.airAtk = true; }
      break;
    }
    case 'grogroll': {   // Grog : roulades super rapides au sol, 3 coups
      f.vx = f.t < 3 ? 0 : f.t < 39 ? 4.4 * f.dir : 0;
      f.rotAng = f.t >= 3 && f.t < 39 ? f.dir * (f.t - 3) / 12 * Math.PI * 2 : null;
      if (f.t >= 3 && f.t < 39 && (f.t - 3) % 12 === 0) { f.hasHit = false; sfx('whoosh'); }
      if (f.t >= 46) { f.rollCd = G.frame + 36; setState(f, 'idle'); }   // 0,6 s avant la prochaine roulade
      break;
    }
    case 'bflip': {   // petit saut légèrement en avant, un tour de coup de pied vers l'arrière (pas rapide)
      if (f.t === 1) f.flash = 5;   // détente éclair : flash blanc sur le personnage
      reflectNear(f, 52, f.y - 46, 54);   // renvoie toutes les boules de feu, projectiles d'énergie et objets lancés
      if (f.t < 2) { f.vx = 0; break; }
      if (f.t === 2) { f.air = true; f.vy = -5.2; f.vx = 1.7 * f.dir; f.y -= 1; sfx('upper'); }
      if (f.air) f.vy += GRAV * .5;   // plus rapide qu'avant
      f.rotAng = -f.dir * Math.min(1, (f.t - 2) / 21) * Math.PI * 2;
      if (f.t % 2 === 0) { (f.echo = f.echo || []).push({ x: f.x, y: f.y, state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air }); if (f.echo.length > 6) f.echo.shift(); f.bfEcho = true; }   // échos
      if (f.t > 60 && !f.air) { f.rotAng = null; setState(f, 'idle'); }
      break;
    }
    case 'flipk': {   // petit saut avant + coup de pied tournoyant (salto avant complet) ; le 4e tourne en arrière, en feu
      if (f.t < 4) { f.vx = 0; break; }
      // vitesse : S = 1.35 par défaut, 2x plus vite pour les saltos enchaînés après un premier coup reçu (même saut, plus rapide)
      const S = f.flipS || FLIP_S;
      if (f.t === 4) { f.air = true; f.vy = (f.flipFin ? -6 : -5.2) * S; f.vx = (f.flipFin ? 2.6 : 2.4) * S * f.dir; f.y -= 1; sfx(f.flipFin ? 'fb' : 'upper'); }
      if (f.t > 4 && f.air) f.vy += GRAV * (S * S - 1);
      if (f.hasHit && !f.flipFin) f.vx = 1.1 * S * f.dir;
      const k = Math.min(1, (f.t - 4) / ((f.flipFin ? 30 : 26) / S));
      f.rotAng = (f.flipFin ? -1 : 1) * f.dir * k * Math.PI * 2;
      if (back && take(c, 's') && f.flipN < 3 && !f.flipFin) f.flipQ = true;   // arrière + A à nouveau : enchaîne le salto suivant
      if (f.flipFin && f.rotAng != null) { const dx = f.dir * 28 * K * UP, dy = 10 * K * UP, cy = f.y - 30 * K * UP, a2 = f.rotAng, cs = Math.cos(a2), sn = Math.sin(a2); (f.ftrail2 = f.ftrail2 || []).push({ x: f.x + dx * cs - dy * sn, y: cy + dx * sn + dy * cs }); if (f.ftrail2.length > 14) f.ftrail2.shift(); }   // pied en feu
      break;
    }
    case 'nyxspin':   // plongeon tournoyant rapide en diagonale vers le sol ; au contact : 3 coups très rapides, le 3e fait tomber
      f.rotAng = f.dir * f.t * (Math.PI * 2 / 10);
      if (f.nHits > 0 && f.nHits < 3) {   // reste collée à l'adversaire pendant l'enchaînement
        f.vx = 0; f.vy = -GRAV; f.x += ((o.x - f.dir * 30) - f.x) * .3;
        if (f.t - f.nHitT >= 6) f.hasHit = false;   // coup suivant
        if (f.t - f.nHitT > 24) { f.rotAng = null; setState(f, 'jump'); f.airAtk = true; f.vy = 0; }   // adversaire hors d'atteinte : retombe
      } else if (f.nHits >= 3) { if (f.t - f.nHitT > 6) { f.rotAng = null; setState(f, 'jump'); f.airAtk = true; f.vx = -1.5 * f.dir; f.vy = -2; } }
      else { f.vx = 4.6 * f.dir; f.vy = 5.2 - GRAV; }
      if (f.t % 6 === 0) sfx('whoosh');
      break;
    case 'nslide':   // Nyx : glisse vers l'avant au ras du sol
      f.vx = f.t < 3 ? 0 : f.t < 22 ? 5.2 * f.dir : f.vx * .7;
      if (f.t >= 32) { f.vx = 0; setState(f, 'idle'); }
      break;
    case 'flashstep':   // pas de côté éclair vers l'arrière, les gants se chargent
      f.vx = f.t < 10 ? -f.dir * 6.5 : f.vx * .5;
      if (f.t === 8) { f.kcharge = 180; sfx('parry'); addPopup(f.x, f.y - 100, 'CHARGED!', '#5af0ff'); }   // poings électriques 3 s
      if (f.t >= 18) { f.vx = 0; setState(f, 'idle'); }
      break;
    case 'flask':   // lance une fiole en cloche
      f.vx = 0;
      if (f.t === 6 && h.s && live) { setState(f, 'nyxcharge'); f.chargeT = 0; break; }   // A maintenu : charge du serpent électrique
      if (f.t === 8) { G.flasks.push({ owner: f, x: f.x + f.dir * 18, y: f.y - 62, vx: f.dir * 3.4, vy: -3.6, t: 0 }); sfx('whoosh'); }
      if (f.t >= 24) setState(f, 'idle');
      break;
    case 'nyxcharge': {   // A maintenu : 0,5 s petit éclat (demi-serpent), 1,3 s écran foncé (serpent qui traverse tout l'écran)
      f.vx = 0; f.chargeT = (f.chargeT || 0) + 1;
      const hx = f.x + f.dir * 20, hy = f.y - 58;
      if (f.chargeT === 8) vaneChargeStart(f);
      if (f.chargeT === 30) { addSpark(hx, hy, 'parry'); G.flashT = Math.max(G.flashT, 5); G.boltX = hx; G.boltY = hy; sfx('parry'); }   // petit éclat sur la charge, devant Nyx
      if (f.chargeT === 78) { G.darkT = Math.max(G.darkT, 60); G.flashT = 12; G.boltX = hx; G.boltY = hy; vaneChargeStop(f); sfx('counter'); }
      if (!h.s) {
        vaneChargeStop(f); const n = f.chargeT;
        if (n >= 30) { setState(f, 'nyxsnake'); f.snakeFull = n >= 78; } else { setState(f, 'flask'); f.t = 7; }   // relâché trop tôt : fiole normale
      }
      break;
    }
    case 'nyxsnake':
      f.vx = 0;
      if (f.t === 3) { (G.snakes = G.snakes || []).push({ owner: f, x: f.x + f.dir * 24, y0: f.y - 58, y: f.y - 58, dir: f.dir, t: 0, big: f.snakeFull, max: f.snakeFull ? 9999 : W / 2, dist: 0, pts: [] }); sfx('fb'); sfx('parry'); if (f.snakeFull) { G.shake = Math.max(G.shake, 4); sfx('heavy'); } }
      if (f.t >= 20) setState(f, 'idle');
      break;
    case 'nyxglide': {   // Nyx plane : flotte, se déplace dans les 4 directions (même hors de l'écran en haut), lâche une fiole à la fin
      if (take(c, 's')) { setState(f, 'nyxspin'); f.nHits = 0; f.nHitT = 0; f.vx = 4.6 * f.dir; sfx('whoosh'); sfx('upper'); break; }   // A à nouveau : plongeon tournoyant en diagonale vers le sol
      if (take(c, 'p')) { setState(f, 'jpunch'); f.airAtk = true; f.vy = 0; sfx('whoosh'); break; }   // Y / B : coup simple puis retombe dans la direction du vol
      if (take(c, 'k')) { setState(f, 'jkick'); f.airAtk = true; f.vy = 0; sfx('whoosh'); break; }
      const lim = 60;   // 1 s de vol plané (plus de prolongation en restant appuyé)
      const lift = f.y > GROUND - 112 ? -Math.min(2.2, (f.y - (GROUND - 112)) * .12) : 0;   // monte assez haut pour passer au-dessus d'un adversaire ou d'une boule de feu
      f.vy = -GRAV + Math.sin(f.t * .18) * .35 + (h.u ? -3.2 : h.d ? 3.2 : lift);
      f.vx = h.r ? 3.4 : h.l ? -3.4 : f.vx * .8;   // plane plus vite
      if (f.y < NYX_TOP) { f.y = NYX_TOP; f.vy = Math.max(f.vy, -GRAV); }   // ne monte pas plus haut que la barre d'énergie (au niveau du buste)
      if (f.t >= lim) {   // fin du vol plané : lâche une fiole et retombe
        G.flasks.push({ owner: f, x: f.x + f.dir * 8, y: f.y - 40, vx: f.dir * 1.4, vy: .5, t: 0 }); sfx('whoosh');
        setState(f, 'jump'); f.airAtk = true; f.vy = 0;
      }
      break;
    }
    case 'airfb':   // Hiro : lance la boule de feu en l'air puis reprend son saut (peut en relancer une)
      if (f.t >= 12) { setState(f, 'jump'); f.airAtk = false; }
      break;
    case 'airflask':   // en l'air : fiole lancée tout droit en diagonale vers le sol
      if (f.t === 4) { G.flasks.push({ owner: f, x: f.x + f.dir * 16, y: f.y - 50, vx: f.dir * 3.8, vy: 4.2, t: 0, straight: true }); }
      break;
    case 'nyxtele': {   // s'évapore en fumée, réapparaît loin de l'autre côté de l'adversaire
      f.vx = 0;
      if (f.t < 10) { f.fadeK = f.t / 10; if (f.t % 2 === 0) nyxPuff(f); }
      if (f.t === 10) { const side = Math.sign(o.x - f.x) || f.dir, L0 = (G.camL || 0) + 24, L1 = (G.camL || 0) + W - 24; f.x = Math.max(L0, Math.min(L1, o.x + side * 120)); f.dir = Math.sign(o.x - f.x) || -side; for (let k = 0; k < 4; k++) nyxPuff(f); }
      if (f.t >= 10) { f.fadeK = Math.max(0, 1 - (f.t - 10) / 10); if (f.t % 2 === 0 && f.t < 20) nyxPuff(f); }
      if (f.t >= 22) { f.fadeK = 0; setState(f, 'idle'); }
      break;
    }
    case 'smokeback':   // lâche un nuage toxique et recule
      if (f.t === 3) { G.smokes = G.smokes.filter(c => c.owner !== f); G.smokes.push({ owner: f, x: f.x + f.dir * 40, dir: f.dir, t: 0 }); f.smokeLast = G.frame; sfx('fb'); }
      f.vx = f.t >= 3 && f.t < 18 ? -f.dir * 3.2 : 0;
      if (f.t >= 26) setState(f, 'idle');
      break;
    case 'geyser':   // frappe le sol : gerbe de flammes violettes en diagonale vers le haut
      f.vx = 0;
      if (f.t === 9) { G.geysers.push({ owner: f, x: f.x + f.dir * 14, dir: f.dir, t: 0 }); G.shake = Math.max(G.shake, 3); sfx('heavy'); sfx('fb'); }
      if (f.t >= 34) setState(f, 'idle');
      break;
    case 'wallslash':   // lève le sabre au-dessus de la tête puis frappe jusqu'au sol en s'accroupissant
      f.vx = f.t >= 8 && f.t < 13 ? f.dir * 1.2 : 0;
      if (f.t === 8) sfx('upper');
      if (f.t === 13) { f.wallT = 26; f.wallX = f.x + f.dir * 34; G.shake = Math.max(G.shake, 2); }
      if (f.t >= 34) setState(f, 'idle');
      break;
    case 'zdash':   // vrille horizontale en l'air (comme le shoryuken, mais couché), traverse un tiers de l'écran puis retombe
      f.vy = -GRAV;
      if (f.t < 3) { f.vx = 0; break; }
      f.vx = 7.2 * f.dir; f.rotAng = f.dir * Math.PI / 2;   // projeté à l'horizontale, tourne sur lui-même (dessin retourné toutes les 4 images)
      if (f.t % 6 === 0) sfx('whoosh');
      if (killShots(f, f.x - 26, f.x + 26, f.y - 84, f.y - 8)) {   // touche une boule de feu : les deux s'annulent, roulade arrière automatique
        setState(f, 'jump'); f.air = true; f.roll = -1; f.t = 3; f.rollT = 22; f.vx = -4.4 * f.dir; f.vy = -5.6; f.airAtk = false; f.airNoS = true; sfx('parry'); sfx('jump'); break;
      }
      if (f.t >= 21) { setState(f, 'jump'); f.t = 4; f.airAtk = true; f.vx = 1.2 * f.dir; f.vy = 0; }
      break;
    case 'hover':   // suspendu en l'air une demi-seconde : entouré d'électricité et invincible
      f.vx = 0; f.vy = -GRAV; f.invuln = Math.max(f.invuln || 0, 2);
      if (f.t >= 30) { setState(f, 'plunge'); sfx('upper'); }
      break;
    case 'plunge':   // s'abat à la verticale, sabre vers le sol
      f.vx = 0; f.vy = 9.5 - GRAV;
      break;
    case 'tornado':   // vrille verticale sabre au clair dans un mini-cyclone
      if (f.t === 3) { f.air = true; f.vy = -8.8; f.vx = f.dir * 1.3; sfx('upper'); }
      if (f.air && f.t % 6 === 0) sfx('whoosh');
      break;
    case 'pthrow': f.vx = 0; if (f.t === 7) launchProp(f, o); if (f.t >= 22) setState(f, 'idle'); break;
  }

  // Physique
  if (f.air) {
    f.vy += GRAV; f.x += f.vx; f.y += f.vy;
    if (f.y >= GROUND) {
      f.y = GROUND; f.vy = 0; f.air = false; f.airFb = 0;
      if (f.state === 'fall') { setState(f, 'down'); G.shake = Math.max(G.shake, 3); sfx('thud'); }
      else if (f.state === 'uppercut') { setState(f, 'land'); f.landT = 14; }
      else if (f.state === 'vdive') { f.bounced = false; setState(f, 'land'); f.landT = 8; }
      else if (f.state === 'hslide') { f.hsT = G.frame; if (f.upQ) { f.upQ = false; setState(f, 'uppercut'); f.invuln = 11; f.apexT = null; } else { setState(f, 'land'); f.landT = 6; } }
      else if (f.state === 'fjump') { if (f.upQ) { f.upQ = false; setState(f, 'uppercut'); f.invuln = 11; f.apexT = null; f.t = 4; f.fireState = 'uppercut'; } else { setState(f, 'land'); f.landT = 8; } }
      else if (f.state === 'tatsu' || f.state === 'kspin' || f.state === 'aflip') { f.ftrail2 = null; setState(f, 'land'); f.landT = f.state === 'kspin' ? 6 : 10; }
      else if (f.state === 'bflip') { f.rotAng = null; setState(f, 'land'); f.landT = 6; }
      else if (f.state === 'flipk') {   // retombe sur ses pieds : salto suivant, 4e coup en feu, ou fin
        const n = f.flipN, q2 = f.flipQ, hits = f.flipHits, fin = f.flipFin; f.rotAng = null; f.ftrail2 = null;
        if (!fin && n >= 3 && hits >= 3) { setState(f, 'flipk'); f.t = 3; f.flipN = 4; f.flipFin = true; f.flipQ = false; f.flipHits = hits; f.flipS = 1.6; addPopup(f.x, f.y - 110, 'FIRE FLIP!', f.def.fb[2]); }
        else if (!fin && q2 && n < 3) { setState(f, 'flipk'); f.t = 3; f.flipN = n + 1; f.flipQ = false; f.flipFin = false; f.flipHits = hits; f.flipS = hits >= 1 ? FLIP_S * 2 : FLIP_S; }
        else { setState(f, 'land'); f.landT = fin ? 12 : 6; }
      }
      else if (f.state === 'dive') { f.trail = null; f.bounced = false; setState(f, 'land'); f.landT = 8; G.shake = Math.max(G.shake, 1); }
      else if (f.state === 'zenith') { f.rotAng = null; setState(f, 'land'); f.landT = 10; }
      else if (f.state === 'tornado') { setState(f, 'land'); f.landT = 12; }
      else if (f.state === 'meteor' || f.state === 'meteorD' || f.state === 'airvoid') { f.rotAng = null; setState(f, 'land'); f.landT = 10; G.shake = Math.max(G.shake, 3); }
      else if (f.state === 'plunge' || f.state === 'hover') {   // impact : onde de choc électrique jusqu'aux deux bords de l'écran
        setState(f, 'land'); f.landT = 16; G.shake = Math.max(G.shake, 7); G.flashT = Math.max(G.flashT, 4); sfx('thud'); sfx('heavy');
        (G.zfloor = G.zfloor || []).push({ owner: f, x: f.x, t: 0 }); sfx('parry');   // éclairs qui se propagent sur tout le sol, à gauche et à droite
      }
      else if (f.state === 'gpound') {   // impact : onde de choc sur tout le sol, l'écran tremble
        setState(f, 'crushLand'); G.shake = Math.max(G.shake, 18); G.flashT = Math.max(G.flashT, 5); G.quakeT = 40; sfx('thud'); sfx('heavy');
        for (const dd of [-1, 1]) G.waves.push({ owner: f, x: f.x + dd * 10, dir: dd, t: 0, life: 200, speed: 6.5 });
      }
      else if (f.state === 'crushD' || f.state === 'crush') {
        const hit = f.hasHit; f.rotAng = null; setState(f, 'crushLand'); G.shake = Math.max(G.shake, 8); sfx('thud'); sfx('heavy');
        for (const dd of [-1, 1]) G.waves.push({ owner: f, x: f.x + dd * 10, dir: dd, t: 0, life: 12, small: true, done: hit });
      }
      else if (f.state === 'jump' && f.hatHold) { setState(f, 'hatcharge'); }   // retombe en continuant de charger le chapeau
      else if (f.state === 'zdash') { f.rotAng = null; setState(f, 'land'); f.landT = 8; }
      else if (['jump', 'jpunch', 'jkick', 'airflask', 'nyxglide', 'nyxspin', 'airfb'].includes(f.state)) { f.rotAng = null; setState(f, 'land'); f.landT = 4; }
      f.vx = 0;
    }
  } else {
    f.x += f.vx;
  }
  f.x = Math.max(18, Math.min(SW - 18, f.x));

  // Barre de vie « traînante »
  if (f.lag > f.hp) { if (f.lagT > 0) f.lagT--; else f.lag = Math.max(f.hp, f.lag - .6); }
}

function hurtbox(f) {
  if (f.state === 'crush') return null;   // Grog : la montée en roulade esquive tous les coups
  if (f.invuln > 0 || ['fall', 'down', 'getup', 'held'].includes(f.state)) return null;
  if (f.air) return [f.x - 13, f.y - 81, f.x + 13, f.y - 17];
  if ((f.state === 'hslide' && f.t >= 2 && f.t < 15) || (f.state === 'nslide' && f.t >= 2 && f.t < 26) || (f.state === 'grogroll' && f.t >= 3 && f.t < 39)) return [f.x - 18, f.y - 28, f.x + 18, f.y];   // glissade : passe sous les boules de feu
  if (f.state === 'land' || f.state === 'uppercut') return [f.x - 14, f.y - 67, f.x + 14, f.y];
  if (['crouch', 'cblock', 'cpunch', 'ckick'].includes(f.state)) return [f.x - 15, f.y - 56, f.x + 15, f.y];
  return [f.x - 14, f.y - 84, f.x + 14, f.y];
}
function atkBox(f) {
  const a = ATK[f.state];
  if (!a || f.hasHit) return null;
  if (f.t < a.act[0] || f.t >= a.act[1]) return null;
  if (['vdive', 'hslide', 'fjump', 'aflip', 'nyxspin', 'kspin', 'flipk', 'jpunch', 'jkick', 'uppercut', 'tatsu', 'zenith', 'dive', 'crushD', 'gpound', 'tornado', 'plunge', 'zdash', 'meteor', 'meteorD'].includes(f.state) && !f.air) return null;
  let [x0, y0, x1, y1] = a.box;
  if (f.def.float && VANE_NORMALS.includes(f.state)) { x0 += 26; x1 += 26; y0 -= floatOff(f); y1 -= floatOff(f); }   // c'est le double, plus loin devant, qui frappe
  return f.dir > 0 ? [f.x + x0, f.y + y0, f.x + x1, f.y + y1] : [f.x - x1, f.y + y0, f.x - x0, f.y + y1];
}
const overlap = (a, b) => a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function isBlocking(d, fromX, data) {
  if (data.unblock) return false;
  if (d.air || !NEUTRAL.includes(d.state)) return false;
  const h = d.ctl.held;
  if (!(fromX < d.x ? h.r : h.l)) return false;
  if (data.low && !h.d) return false;   // balayage : garde basse obligatoire
  if (data.high && h.d) return false;   // attaque sautée : garde debout obligatoire
  return true;
}

// Prises après un contre :
//  'toss' (B) : on attrape, roulade arrière, l'adversaire est propulsé à l'opposé de l'écran
//  'slam' (Y) : l'adversaire passe par-dessus nous en tournant et retombe juste de l'autre côté
const FINISHERS = ['ppkk', 'kkpp', 'ppks', 'kkps'];
function comboReady(f, o) {
  return o.state === 'hit' && G.frame - (f.comboLast || -999) < 50 && (f.combo === 'ppk' || f.combo === 'kkp');
}
// Le 4e coup d'un enchaînement est en feu (bleu Kaito, rouge Sora)
// enchaînements à 4 coups (YYBB, BBYY, YYBA, BBYA) : comptés sur les touches, même loin de l'adversaire ;
// le 4e coup part en feu avec un élan rapide vers l'avant
const seqReady = f => G.frame - (f.iseqLast || -999) < 45 && ['ppk', 'kkp'].includes(f.iseq || '');
function markFire(f, o, kind) {
  const live = o.state === 'hit' && G.frame - (f.comboLast || -999) < 50;
  const seq = (G.frame - (f.iseqLast || -999) < 45 ? (f.iseq || '') : '') + kind;
  f.iseqLast = G.frame;
  const fin = FINISHERS.includes(seq) || (live && FINISHERS.includes((f.combo || '') + kind));
  f.iseq = fin ? '' : seq.slice(-3);
  f.fireState = fin ? f.state : null; f.fireDash = fin ? 18 : 0;
  if (fin) { sfx('fb'); sfx('upper'); f.lastFin = FINISHERS.includes(seq) ? seq : (f.combo || '') + kind; }
}
function tryCombo(f, o, c, fwd) {
  // le bouton appuyé en premier passe en premier
  const order = ['s', 'p', 'k'].filter(b => c.buf[b] > 0 && (b !== 's' || comboReady(f, o) || seqReady(f))).sort((x, y) => (c.ord || {})[x] - (c.ord || {})[y]);
  const b = order[0]; if (!b) return false;
  take(c, b);
  if (b === 's') { setState(f, 'flame'); f.vx = 0; markFire(f, o, 's'); return true; }
  if (b === 'p') { setState(f, fwd ? 'fpunch' : 'punch'); f.vx = 0; sfx('whoosh'); markFire(f, o, 'p'); return true; }
  setState(f, fwd ? 'fkick' : 'kick'); f.vx = 0; sfx('whoosh'); markFire(f, o, 'k'); return true;
}
function doThrow(f, o, type) {
  setState(f, 'throw'); f.throwType = type; f.vx = 0; f.vy = 0; f.counterT = 0; f.victim = o;
  f.gx = f.x; f.gy = f.y;
  setState(o, 'held'); o.air = false; o.vx = o.vy = 0; o.slowT = 0; o.flash = 3; o.invuln = 0;
  G.freeze = 6; sfx('whoosh');
  addPopup(f.x, f.y - 100, 'THROW!', '#ff7a3a');
}
function updThrow(f) {
  const o = f.victim; if (!o) return;
  const d = f.dir, t = f.t, T0 = 6, T1 = 26;
  const k = Math.max(0, Math.min(1, (t - T0) / (T1 - T0)));
  if (f.throwType === 'rocket') {   // s'envole très haut avec l'adversaire puis s'écrase comme une météorite
    const top = 84;
    if (t < 6) { o.x = f.x + d * 18; o.y = f.y; }
    else if (t < 34) { const e = 1 - Math.pow(1 - (t - 6) / 28, 2); f.y = GROUND - (GROUND - top) * e; o.x = f.x + d * 4; o.y = f.y - 64; o.rotAng = d * Math.PI / 2; if (t === 6) { sfx('upper'); G.shake = Math.max(G.shake, 4); } }
    else if (t < 40) { f.y = top; o.x = f.x + d * 4; o.y = f.y - 64 + (t - 34) * 4; o.rotAng = d * (Math.PI / 2 + (t - 34) / 6 * Math.PI); f.rotAng = d * (t - 34) / 6 * 2.3; }
    else if (t < 52) { const k2 = (t - 40) / 12; f.y = top + (GROUND - top) * k2 * k2; f.rotAng = d * 2.3; o.x = f.x + d * 24; o.y = Math.min(GROUND, f.y + 6); o.rotAng = d * Math.PI * 1.5; if (t === 40) sfx('whoosh'); }
    else if (t === 52) {
      f.y = GROUND; f.rotAng = null; o.y = GROUND; o.rotAng = null;
      setState(o, 'fall'); o.air = true; o.vx = d * 2.5; o.vy = -3.5;
      o.hp = Math.max(0, o.hp - dmgK(24)); o.lagT = 40; o.flash = 4;
      G.shake = 18; G.quakeT = 24; G.flashT = Math.max(G.flashT, 8); G.freeze = 6; sfx('thud'); sfx('heavy');
      G.waves.push({ owner: f, x: f.x + d * 20, dir: d, t: 0, life: 22, small: true, ring: true, dome: true, done: true });
      for (const dd of [-1, 1]) G.waves.push({ owner: f, x: f.x + dd * 10, dir: dd, t: 0, life: 18, small: true, done: true });
    }
    if (t > 52) f.victim = null;
    return;
  }
  if (f.throwType === 'toss') {
    // roulade arrière du lanceur
    f.rotAng = t >= T0 && t < T1 ? -d * k * Math.PI * 2 : null;
    if (t >= T0 && t < T1) f.x = f.gx - d * 14 * k;
    // la victime passe au-dessus, d'avant en arrière
    const phi = k * Math.PI;
    o.x = f.x + d * Math.cos(phi) * 30; o.y = f.y - 6 - Math.sin(phi) * 34;
    o.rotAng = -d * phi; o.dir = d === 1 ? -1 : 1;
    if (t === T1) {
      setState(o, 'fall'); o.air = true; o.vx = -d * 5.6; o.vy = -4.5; o.rotAng = null;
      o.hp = Math.max(0, o.hp - dmgK(13)); o.lagT = 32; o.flash = 3;
      G.shake = 6; sfx('heavy');
    }
  } else {
    // renversement : la victime fait un demi-tour complet autour de nous
    const phi = k * Math.PI;
    o.x = f.x + d * Math.cos(phi) * 24; o.y = f.y - 8 - Math.sin(phi) * 44;
    o.rotAng = -d * phi * 1.15; o.dir = d === 1 ? -1 : 1;
    if (t === T1) {
      setState(o, 'fall'); o.air = true; o.vx = -d * 1.2; o.vy = 2.5; o.rotAng = null;
      o.hp = Math.max(0, o.hp - dmgK(15)); o.lagT = 32; o.flash = 3;
      G.shake = 9; sfx('heavy');
    }
  }
  if (t > T1) f.victim = null;
}
/* ---------- Objets du décor : chaise et vases (cassables, lançables avec X) ---------- */
const PROP_HIT = { dmg: 9, knock: true, stun: 22, bstun: 16, push: 3.6, chip: 0, sfx: 'heavy', unblock: true };
const PROP_DIM = { chair: [30, 46], vase: [12, 22], tallvase: [14, 30], crate: [22, 20], pot: [18, 30], bottle: [9, 24], cone: [22, 31], trash: [27, 38], lantern: [18, 36], sake: [14, 20], barrel: [20, 26], candle: [16, 38], drum: [20, 30], brazier: [20, 30], stool: [20, 22], bucket: [16, 14], canister: [16, 32], hazard: [20, 28], labdrum: [20, 30] };
function makeProps() {
  const X = f => Math.round(SW * f);
  const SET = {   // objets adaptés au thème de chaque décor
    dojo:    [['crate', 0], ['vase', 0], ['chair', 0], ['pot', 0], ['tallvase', 1], ['crate', 0]],
    city:    [['trash', 0], ['bottle', 0], ['cone', 0], ['bottle', 0], ['cone', 0], ['trash', 0]],
    temple:  [['lantern', 0], ['sake', 0], ['tallvase', 2], ['sake', 1], ['pot', 0], ['lantern', 0]],
    hall:    [['barrel', 0], ['candle', 0], ['chair', 0], ['tallvase', 1], ['candle', 0], ['barrel', 0]],
    terrace: [['drum', 0], ['brazier', 0], ['crate', 0], ['drum', 0], ['brazier', 0], ['drum', 0]],
    alley:   [['trash', 0], ['bottle', 0], ['crate', 0], ['cone', 0], ['bottle', 0], ['trash', 0]],
    ring:    [['bucket', 0], ['stool', 0], ['bottle', 0], ['bottle', 0], ['stool', 0], ['bucket', 0]],
    lab:     [['labdrum', 0], ['labdrum', 1], ['labdrum', 0], ['labdrum', 1], ['labdrum', 0], ['labdrum', 1]],   // tonneaux gris acier et orange
  }[G.stage] || [];
  const XS = [.05, .12, .2, .8, .88, .95];
  const list = SET.map(([t, v], i) => [t, X(XS[i]), v]);
  return list
    .map(([type, x, v]) => ({ type, x, y: GROUND, v, alive: true, held: null, fly: null }));
}
const propBox = p => { const [w, h] = PROP_DIM[p.type]; return [p.x - w / 2, p.y - h, p.x + w / 2, p.y]; };
function nearProp(f) { return (G.props || []).find(p => p.alive && !p.held && !p.fly && Math.abs(p.x - f.x) < 24); }
function pickProp(f, p) { p.held = f; setState(f, 'pthrow'); f.vx = 0; sfx('whoosh'); }
function launchProp(f, o) {
  const p = (G.props || []).find(q => q.held === f); if (!p) return;
  p.held = null; p.x = f.x + f.dir * 18; p.y = f.y - 58;
  aimProp(p, f, o);
  sfx('whoosh');
}
const PGRAV = .28;
// trajectoire en cloche (gravité) qui finit toujours sur la cible
function aimProp(p, owner, target) {
  const d = Math.abs(target.x - p.x);
  const T = Math.max(26, Math.min(56, d / 5.5 + 14));
  p.fly = { owner, target, T, t: 0, rot: (p.fly && p.fly.rot) || 0, vx: 0, vy: 0, spin: Math.sign(target.x - p.x) || 1 };
  const ty = target.y - 46;
  p.fly.vx = (target.x - p.x) / T; p.fly.vy = (ty - p.y) / T - .5 * PGRAV * T;
}
function breakProp(p, x = p.x, y = p.y - 10) {
  if (!p.alive) return;
  p.alive = false; p.held = null; p.fly = null;
  const EXTRA = { lantern: ['#5a5e56', '#8a8e84', '#3a3e38', '#6a7a4a'], sake: ['#e8e0d0', '#2a2a30', '#b8b0a0', '#7a1a14'], barrel: ['#6a4020', '#8a5a30', '#3a2010', '#5a5a64'], candle: ['#24242c', '#4a4a56', '#f0e0b0', '#ffb040'],
    drum: ['#6a2a10', '#9a4a1a', '#3a1a0a', '#4a4a50'], brazier: ['#2a2a30', '#4a4a56', '#ff8a2a', '#ffd040'], stool: ['#2a2a30', '#5a5a64', '#a82a1a', '#1a1a20'], bucket: ['#7a7a88', '#a8a8b8', '#4a8ad0', '#c8e8ff'],
    labdrum: ['#4a5662', '#7a8a96', '#c8641a', '#2a3038'], canister: ['#a8b8c0', '#4a5a64', '#3aff8a', '#c8ffd8'], hazard: ['#d8b81a', '#1a1a20', '#a88a10', '#5a5a64'] };
  const cols = EXTRA[p.type] || (p.type === 'bottle' ? ['#2a7a2a', '#5ac85a', '#1a4a1a', '#c8f0c8'] : p.type === 'cone' ? ['#ff6a1a', '#ffffff', '#c84a0a'] : p.type === 'trash' ? ['#7a7a88', '#a8a8b8', '#4a4a56', '#3a6a2a'] : p.type === 'chair' || p.type === 'crate' ? ['#8a5a30', '#6a4020', '#b07a44'] : p.type === 'pot' ? ['#b8642e', '#3e7a2a', '#7a3a18', '#5c9a3a'] : VASE_COLS[p.v]);
  for (let i = 0; i < 14; i++) G.shards.push({ x: x + (Math.random() - .5) * 10, y: y + (Math.random() - .5) * 10,
    vx: (Math.random() - .5) * 5, vy: -1.5 - Math.random() * 3.5, col: cols[i % cols.length], s: 1 + (Math.random() * 3 | 0), t: 0 });
  sfx('crash'); G.shake = Math.max(G.shake, 2);
  if (p.type === 'labdrum') {   // Bio Lab : le tonneau libère une flaque de liquide toxique vert
    (G.toxics = G.toxics || []).push({ x: Math.max(30, Math.min(SW - 30, x)), t: 0, life: 360 });
    for (let i = 0; i < 18; i++) G.shards.push({ x: x + (Math.random() - .5) * 8, y: y + (Math.random() - .5) * 8, vx: (Math.random() - .5) * 4.5, vy: -1 - Math.random() * 3.5, col: ['#3aff6a', '#8aff4a', '#1ac83a', '#d0ffb0'][i % 4], s: 1 + (Math.random() * 2 | 0), t: 0 });
  }
}
// Flaques toxiques : rongent l'énergie de quiconque marche dedans
function updToxics() {
  for (const z of G.toxics || []) {
    z.t++;
    const R = Math.min(22, 6 + z.t * 1.2) * (z.t > z.life - 40 ? (z.life - z.t) / 40 : 1);
    for (const f of G.f) {
      if (f.air || f.ko || f.hp <= 0 || !G.fighting || Math.abs(f.x - z.x) > R) continue;
      f.hp = Math.max(0, f.hp - .14); f.lagT = 30; f.toxT = 8;
      if (G.frame % 4 === 0) (G.toxFx = G.toxFx || []).push({ x: f.x + (Math.random() - .5) * 20, y: GROUND - 2, t: 0, sm: Math.random() < .55 });   // fumée et bulles qui émanent du liquide
      if (G.frame % 40 === 0) addPopup(f.x, f.y - 96, 'TOXIC!', '#6aff5a');
    }
  }
  if (G.toxics) G.toxics = G.toxics.filter(z => z.t < z.life);
  for (const f of G.f) if (f.toxT > 0) f.toxT--;
  for (const p of G.toxFx || []) p.t++;
  if (G.toxFx) G.toxFx = G.toxFx.filter(p => p.t < 36);
}
function drawToxics() {
  for (const z of G.toxics || []) {   // flaque discrète, posée au sol
    const k = z.t > z.life - 40 ? (z.life - z.t) / 40 : 1, R = Math.min(22, 6 + z.t * 1.2) * k, x = z.x, y = GROUND;
    ctx.save();
    ctx.globalAlpha = .55 * k; ctx.fillStyle = '#0a3a14'; ctx.beginPath(); ctx.ellipse(x, y + 1, R, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .6 * k; ctx.fillStyle = '#1e9a38'; ctx.beginPath(); ctx.ellipse(x - 1, y + .5, R * .78, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .7 * k; ctx.fillStyle = '#7ae85a'; ctx.fillRect(Math.round(x - R * .45), y, Math.round(R * .3), 1);
    if ((G.frame + (z.x | 0)) % 50 < 6) { ctx.fillStyle = '#9aff7a'; ctx.fillRect(Math.round(x + Math.sin(z.x) * R * .5), y - 1, 2, 1); }   // bulle qui éclate
    ctx.restore();
  }
  for (const p of G.toxFx || []) {   // fumée verdâtre et bulles quand on marche dedans
    const a = 1 - p.t / 36;
    if (p.sm) { const r = 2 + p.t * .18; ctx.fillStyle = `rgba(120,170,110,${.35 * a})`; ctx.beginPath(); ctx.arc(p.x + Math.sin(p.t * .2 + p.x) * 3, p.y - p.t * .9, r, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = `rgba(150,255,120,${.85 * a})`; ctx.fillRect(Math.round(p.x), Math.round(p.y - p.t * .6), 2, 2); ctx.fillStyle = `rgba(230,255,220,${a})`; ctx.fillRect(Math.round(p.x), Math.round(p.y - p.t * .6), 1, 1); }
  }
}
function rawAtkBox(f) {
  const a = ATK[f.state]; if (!a || f.t < a.act[0] || f.t >= a.act[1]) return null;
  const [x0, y0, x1, y1] = a.box;
  return f.dir > 0 ? [f.x + x0, f.y + y0, f.x + x1, f.y + y1] : [f.x - x1, f.y + y0, f.x - x0, f.y + y1];
}
function updProps() {
  for (const p of G.props || []) {
    if (!p.alive) continue;
    if (p.held) { p.x = p.held.x + p.held.dir * 6; p.y = p.held.y - 78; if (p.held.state !== 'pthrow') breakProp(p); continue; }
    if (p.fly) {
      // l'objet file vers l'adversaire, où qu'il soit (même en l'air)
      const F = p.fly, o = F.target, tx = o.x, ty = o.y - 46;
      // courbe avec gravité, corrigée à chaque image pour suivre la cible (même en l'air)
      const left = Math.max(1, F.T - F.t);
      F.vx = (tx - p.x) / left;
      F.vy += PGRAV; const vyNeed = (ty - p.y) / left - .5 * PGRAV * left;
      F.vy += (vyNeed - F.vy) * (left < 8 ? 1 : .15);
      p.x += F.vx; p.y += F.vy; F.rot += .3 * F.spin; F.t++;
      const d = Math.hypot(tx - p.x, ty - p.y);
      // renvoi : X au bon moment quand l'objet arrive
      if (d < 70 && !F.deflected) {
        const canX = NEUTRAL.includes(o.state) || o.state === 'parry';
        const tennis = G.tut && G.tut.phase === 6 && G.tut.step === 2;   // tutoriel : le double renvoie tant que le joueur n'a pas fait 3 renvois d'affilée
        if (o.cpu && !F.aiTried && d < 55) { F.aiTried = true; if (tennis ? (G.tut.rally || 0) < 3 : rand() < [.02, .25, .45, .85][DL()]) o.ctl.buf.x = 8; }
        if (canX && (o.ctl.buf.x > 0 || (o.state === 'parry' && o.t <= 12)) && d < 60) {
          take(o.ctl, 'x'); setState(o, 'parry'); o.vx = 0;
          G.darkT = 14; G.flashT = 12; G.boltX = p.x; G.boltY = p.y; G.slowAll = 30; G.shake = 3;
          addPopup(o.x, o.y - 100, 'REFLECT!', '#7af0ff'); sfx('counter'); if (G.tut && o === G.f[0]) { G.tut.refl = true; G.tut.rally = (G.tut.rally || 0) + 1; }   // objet du décor contré
          const back = F.owner; aimProp(p, o, back); p.fly.deflected = false; p.fly.lastBy = o;
          continue;
        }
      }
      const bfb = (G.fbs || []).find(q => q.alive && q.big && q.owner !== F.owner && Math.hypot(q.x - p.x, q.y - p.y) < 22);
      if (bfb) { breakProp(p, p.x, p.y); addSpark(p.x, p.y, 'fb', bfb.owner.def.fb); continue; }   // la grosse boule de feu pulvérise l'objet et continue
      if (d < 16 || F.t >= F.T + 20) {
        breakProp(p, p.x, p.y);
        if (hurtbox(o)) { applyHit(F.owner, o, PROP_HIT, p.x, p.y, F.owner.x, true); if (G.tut && G.tut.phase === 6) { if (o === G.f[0]) G.tut.rally = 0; else if ((G.tut.rally || 0) >= 3) G.tut.cpuHit = true; } }
      }
      continue;
    }
    const box = propBox(p);
    for (const f of G.f) {
      const ab = rawAtkBox(f);
      if (ab && ab[0] < box[2] && ab[2] > box[0]) { breakProp(p); break; }           // frappé
      if ((f.state === 'fall' || (f.state === 'down' && f.t < 6)) && Math.abs(f.x - p.x) < 24) { breakProp(p); break; }   // on tombe dessus
    }
  }
  for (const s of G.shards || []) {
    s.t++; s.vy += .3; s.x += s.vx; s.y += s.vy;
    if (s.y > GROUND + 2) { s.y = GROUND + 2; s.vy *= -.35; s.vx *= .6; }
  }
  if (G.shards) G.shards = G.shards.filter(s => s.t < 55);
}
const VASE_COLS = [['#2e5a9a', '#e8eef6', '#1e3a6a'], ['#b8261c', '#e8c070', '#7a140e'], ['#2a7a5a', '#d8e8d0', '#1a4a36']];
// Palettes 5 tons : [contour, ombre, moyen, clair, reflet]
const PP = {
  wood:  ['#2a1608', '#5a3418', '#8a5a30', '#b07a44', '#d8a468'],
  woodL: ['#3a2010', '#6a4220', '#9a6a38', '#c08a50', '#e6b47a'],
  blue:  ['#0c1630', '#1e3a6a', '#2e5a9a', '#5a8ad0', '#c8dcf4'],
  red:   ['#3a0806', '#7a140e', '#b8261c', '#e0503a', '#ffb090'],
  green: ['#0a2a1c', '#1a4a36', '#2a7a5a', '#4aa880', '#c0ecd4'],
  white: ['#5a6070', '#a0a8b8', '#d8dee8', '#f4f6fa', '#ffffff'],
  gold:  ['#4a3006', '#8a6014', '#c8a030', '#e8c860', '#fff0b0'],
  terra: ['#3a1406', '#7a3a18', '#b8642e', '#d88a4a', '#f4b880'],
  leaf:  ['#0e2a0e', '#1e4a1a', '#3e7a2a', '#5c9a3a', '#9ad06a'],
  glass: ['#062a0a', '#0e4a16', '#1e7a28', '#3aa848', '#c8f4c8'],
  cone:  ['#5a1a04', '#a8380a', '#e85a14', '#ff8a3a', '#ffd0a0'],
  metal: ['#24242c', '#4a4a56', '#7a7a88', '#a8a8b8', '#e0e0ec'],
  stone: ['#24281e', '#40463a', '#62695a', '#858c7a', '#b0b6a2'],
  moss:  ['#142a0e', '#24461a', '#3a6a26', '#5a8a3a', '#8ab85a'],
  iron:  ['#0e0e12', '#1e1e24', '#34343e', '#50505c', '#80808e'],
  rust:  ['#2a0e04', '#5a220a', '#8a3a14', '#b05a24', '#d88a4a'],
  porc:  ['#7a7468', '#b0a898', '#ddd6c6', '#f2ece0', '#ffffff'],
  red2:  ['#3a0606', '#6a0e0c', '#a01c16', '#d0402a', '#f0806a'],
  yel:   ['#4a3a04', '#8a6a0a', '#c8a014', '#e8c83a', '#fff08a'],
  lab:   ['#2a3038', '#4a5662', '#7a8a96', '#a8b8c4', '#e0ecf4'],
  steel: ['#141a20', '#28323c', '#3e4a56', '#5a6874', '#8a9aa8'],   // gris bleuté du laboratoire
  orng:  ['#3a1604', '#6e2c08', '#a8480e', '#d86a1c', '#f0a050'],   // orange industriel, un peu sombre
};
function drawProp(p, x, y) {
  const F = (px, py, w, h, c) => R(x + px, y + py, w, h, c);
  // ligne horizontale d'un volume cylindrique éclairé par la gauche
  const cylRow = (py, w, pal) => {
    for (let px = -w; px <= w; px++) {
      const t = (px + w) / (2 * w || 1);
      const c = Math.abs(px) === w ? pal[0] : t < .16 ? pal[2] : t < .34 ? pal[3] : t < .4 ? pal[4] : t < .62 ? pal[2] : t < .84 ? pal[1] : pal[0];
      F(px, py, 1, 1, c);
    }
  };
  const box = (x0, y0, w, h, pal) => {   // planche/pièce de bois avec relief
    F(x0, y0, w, h, pal[2]); F(x0, y0, w, 1, pal[3]); F(x0, y0, 1, h, pal[3]);
    F(x0, y0 + h - 1, w, 1, pal[1]); F(x0 + w - 1, y0, 1, h, pal[1]);
  };
  const T = p.type;
  if (T === 'chair') {
    const P = PP.wood, L = PP.woodL;
    box(10, -46, 3, 46, P); F(10, -46, 3, 46, P[1]); F(11, -46, 1, 46, P[2]);          // montant arrière droit (dans l'ombre)
    box(-13, -46, 3, 46, L);                                                             // montant arrière gauche
    box(-13, -47, 26, 5, L); F(-12, -47, 24, 1, L[4]); F(-13, -43, 26, 1, P[0]);        // haut du dossier
    for (const yy of [-38, -32, -26]) { box(-10, yy, 20, 2, L); F(-10, yy + 2, 20, 1, P[0]); }   // barreaux + ombre portée
    F(-16, -22, 32, 3, L[3]); F(-16, -22, 32, 1, L[4]);                                  // dessus de l'assise
    F(-16, -19, 32, 3, P[2]); F(-16, -17, 32, 1, P[1]); F(-16, -16, 32, 1, P[0]);        // tranche avant
    F(-14, -15, 28, 2, 'rgba(0,0,0,.35)');                                               // ombre sous l'assise
    box(-15, -16, 3, 16, L); box(12, -16, 3, 16, P); F(13, -16, 1, 16, P[1]);           // pieds avant
    F(-12, -7, 24, 2, P[1]); F(-12, -7, 24, 1, P[2]);                                    // traverse
  } else if (T === 'crate') {
    const P = PP.woodL, D = PP.wood;
    // dessus (vue légèrement plongeante) et côté droit dans l'ombre
    F(-11, -24, 22, 4, P[3]); F(-9, -25, 22, 1, P[4]); F(-11, -24, 1, 4, P[2]);
    for (let i = 0; i < 4; i++) F(11 + (i > 1 ? 1 : 0), -24 + i, 2, 24 - i, D[1]);
    F(13, -22, 1, 22, D[0]);
    F(-11, -20, 22, 20, P[2]);
    for (const yy of [-20, -13, -6]) { F(-11, yy, 22, 1, P[3]); F(-11, yy + 6, 22, 1, D[1]); }   // 3 planches
    F(-11, -20, 2, 20, D[2]); F(9, -20, 2, 20, D[1]); F(-11, -20, 1, 20, P[4]);
    for (let i = 0; i < 16; i++) { F(-8 + i, -19 + i, 2, 1, D[1]); F(-8 + i, -18 + i, 2, 1, D[0]); }   // traverse diagonale
    for (const [nx, ny] of [[-10, -19], [8, -19], [-10, -2], [8, -2]]) F(nx, ny, 1, 1, '#c8c8d0');      // clous
    F(-11, -1, 24, 1, D[0]);
  } else if (T === 'pot') {
    const P = PP.terra, G2 = PP.leaf;
    // feuillage en dégradé (arrière sombre, avant clair)
    const leaf = (x0, y0, dx, n, pal) => { for (let i = 0; i < n; i++) { const xx = x0 + Math.round(dx * i); F(xx, y0 - i, 2, 1, i < n / 3 ? pal[1] : i < n * .75 ? pal[2] : pal[3]); F(xx + 1, y0 - i, 1, 1, pal[0]); } };
    leaf(-1, -14, -.9, 15, G2); leaf(1, -14, .9, 16, G2); leaf(-2, -14, -1.6, 10, G2); leaf(2, -14, 1.5, 11, G2);
    leaf(0, -14, -.3, 18, G2); leaf(0, -14, .35, 17, G2);
    for (let i = 0; i < 5; i++) F(-3 + i, -16 - (i % 2) * 3, 1, 1, G2[4]);
    F(-9, -15, 18, 3, P[3]); F(-9, -15, 18, 1, P[4]); F(-9, -13, 18, 1, P[1]); F(-9, -15, 1, 3, P[0]); F(8, -15, 1, 3, P[0]);   // rebord
    F(-6, -14, 12, 1, '#2a1406');                                                         // terre
    for (let r = 0; r < 12; r++) cylRow(-12 + r, 7 - Math.round(r / 6), P);
    F(-5, -1, 10, 1, P[0]);
  } else if (T === 'bottle') {
    const P = PP.glass, h = 24;
    F(-1, -24, 3, 2, '#e0c040'); F(-1, -24, 3, 1, '#fff0a0'); F(1, -23, 1, 1, '#8a6a10');   // capsule
    for (let r = 0; r < 6; r++) cylRow(-22 + r, 1, P);                                    // goulot
    for (let r = 0; r < 3; r++) cylRow(-16 + r, 2 + r, P);                                // épaule
    for (let r = 0; r < 13; r++) cylRow(-13 + r, 4, P);                                   // corps
    for (let r = 0; r < 5; r++) { const yy = -10 + r; for (let px = -4; px <= 4; px++) F(px, yy, 1, 1, Math.abs(px) === 4 ? '#6a5a30' : px < -1 ? '#fff4c8' : px < 2 ? '#e8d8a0' : '#b8a670'); }   // étiquette
    F(-2, -9, 4, 2, '#b8261c'); F(-2, -9, 4, 1, '#e04a3a');
    F(-3, -1, 7, 1, P[0]);
  } else if (T === 'cone') {
    const P = PP.cone, W5 = PP.white;
    F(-11, -4, 22, 4, '#1a1a20'); F(-11, -4, 22, 1, '#4a4a56'); F(-11, -4, 1, 4, '#3a3a44'); F(10, -4, 1, 4, '#0a0a0e');   // socle
    for (let r = 0; r < 26; r++) {
      const w = 1 + Math.round(r * 7.5 / 26), stripe = (r > 8 && r < 13) || (r > 17 && r < 21);
      cylRow(-30 + r, w, stripe ? W5 : P);
    }
    F(-1, -31, 3, 1, P[1]);
  } else if (T === 'trash') {
    const P = PP.metal;
    for (let r = 0; r < 30; r++) cylRow(-30 + r, 12 - (r < 2 ? 0 : Math.round(r / 15)), P);
    for (const xx of [-7, -2, 3, 8]) for (let r = 0; r < 26; r++) F(xx, -27 + r, 1, 1, P[1]);   // nervures
    F(-12, -16, 25, 1, P[1]); F(-12, -15, 25, 1, P[4]);                                   // cerclage
    F(-13, -34, 27, 4, P[3]); F(-13, -34, 27, 1, P[4]); F(-13, -31, 27, 1, P[0]); F(-13, -34, 1, 4, P[1]); F(13, -34, 1, 4, P[0]);   // couvercle
    F(-4, -36, 9, 2, P[2]); F(-4, -36, 9, 1, P[4]); F(-4, -35, 1, 1, P[0]); F(4, -35, 1, 1, P[0]);   // poignée
    F(-9, -38, 5, 5, '#2a5a1a'); F(-8, -38, 2, 2, '#4a8a2a'); F(-9, -34, 5, 1, '#123a0a');       // sac poubelle qui dépasse
    F(-12, -1, 25, 1, P[0]);
  } else if (T === 'lantern') {   // lanterne de pierre japonaise (tōrō) avec mousse
    const S = PP.stone, M = PP.moss;
    F(-8, -5, 16, 5, S[2]); F(-8, -5, 16, 1, S[3]); F(-8, -1, 16, 1, S[0]); F(7, -5, 1, 5, S[1]);      // socle
    for (let r = 0; r < 12; r++) cylRow(-17 + r, 2, S);                                                 // pilier
    F(-6, -21, 12, 4, S[2]); F(-6, -21, 12, 1, S[3]); F(5, -21, 1, 4, S[1]);                             // plateau
    F(-5, -28, 10, 7, S[1]); F(-3, -27, 6, 5, (G.frame >> 3) % 2 ? '#ffc860' : '#ffb040'); F(-2, -26, 4, 3, '#fff0b0');   // foyer allumé
    F(-5, -28, 2, 7, S[2]); F(3, -28, 2, 7, S[0]);
    for (let r = 0; r < 5; r++) { const hw = Math.round(3 + r * 1.6); F(-hw, -33 + r, hw * 2, 1, r < 2 ? S[3] : S[2]); }   // toit
    F(-9, -29, 18, 1, S[0]); F(-1, -36, 2, 3, S[3]); F(-2, -34, 4, 1, S[2]);
    F(-8, -31, 5, 1, M[3]); F(4, -30, 4, 1, M[2]); F(-7, -4, 4, 1, M[3]); F(3, -3, 3, 1, M[2]);           // mousse
  } else if (T === 'sake') {   // jarre à saké en porcelaine
    const P = PP.porc;
    for (let r = 0; r < 18; r++) { const t = r / 18, w = t < .12 ? 2 : Math.round(2 + Math.sin((t - .12) / .88 * Math.PI) * 5); cylRow(-18 + r, w, P); }
    F(-2, -20, 5, 2, '#7a1a14'); F(-2, -20, 5, 1, '#b8261c');                                             // bouchon rouge
    F(-3, -11, 7, 6, '#f4ecd8'); F(-2, -10, 1, 4, '#1a1a20'); F(0, -10, 2, 1, '#1a1a20'); F(1, -8, 1, 3, '#1a1a20');   // étiquette calligraphiée
    F(-5, -1, 11, 1, P[0]);
  } else if (T === 'barrel') {   // tonneau de chêne cerclé de fer
    const P = PP.wood, I = PP.iron;
    for (let r = 0; r < 26; r++) { const t = r / 26, w = Math.round(8 + Math.sin(t * Math.PI) * 2); cylRow(-26 + r, w, P); }
    for (const yy of [-23, -14, -4]) { for (let px = -10; px <= 10; px++) F(px, yy, 1, 2, Math.abs(px) > 8 ? I[1] : px < -3 ? I[4] : I[2]); }
    for (const xx of [-5, 0, 5]) for (let r = 0; r < 24; r++) F(xx, -25 + r, 1, 1, P[1]);
    F(-8, -27, 17, 2, P[3]); F(-6, -27, 13, 1, P[4]); F(-9, -1, 19, 1, P[0]);
  } else if (T === 'candle') {   // chandelier de fer forgé à trois bougies
    const I = PP.iron;
    F(-7, -3, 14, 3, I[2]); F(-7, -3, 14, 1, I[3]); F(-5, -5, 10, 2, I[1]);                              // pied
    F(-1, -30, 2, 26, I[2]); F(-1, -30, 1, 26, I[4]);                                                    // tige
    F(-8, -30, 16, 2, I[2]); F(-8, -30, 16, 1, I[3]);                                                    // bras
    for (const xx of [-7, -1, 5]) {
      F(xx, -33, 2, 3, I[3]); F(xx, -37, 2, 4, '#f0e4c0'); F(xx, -37, 1, 4, '#fff8e0');                  // bougies
      const fl = (G.frame + xx * 7) % 12 < 6; F(xx, fl ? -40 : -39, 2, fl ? 3 : 2, '#ffb040'); F(xx, -39, 1, 1, '#fff0a0');   // flammes vacillantes
    }
  } else if (T === 'drum') {   // baril de pétrole rouillé
    const P = PP.rust;
    for (let r = 0; r < 30; r++) cylRow(-30 + r, 9, P);
    for (const yy of [-27, -19, -10, -3]) for (let px = -9; px <= 9; px++) F(px, yy, 1, 1, Math.abs(px) === 9 ? P[0] : P[1]);
    F(-9, -31, 19, 2, P[3]); F(-6, -31, 12, 1, '#1a0a04'); F(3, -31, 2, 1, P[4]);
    F(-4, -22, 4, 3, '#3a1a0a'); F(2, -14, 3, 2, '#3a1a0a'); F(-6, -8, 2, 2, P[4]);                        // taches de rouille
  } else if (T === 'brazier') {   // brasero de fer avec flammes
    const I = PP.iron;
    F(-7, -2, 3, 2, I[2]); F(4, -2, 3, 2, I[2]); F(-5, -14, 2, 12, I[1]); F(3, -14, 2, 12, I[1]); F(-1, -14, 2, 12, I[2]);   // pieds
    for (let r = 0; r < 7; r++) cylRow(-20 + r, 9 - Math.round(r * .6), I);                              // coupe
    F(-9, -21, 19, 1, I[3]);
    for (let k = 0; k < 9; k++) { const fx = -7 + k * 1.8, h = 4 + ((G.frame * 3 + k * 37) % 9); F(Math.round(fx), -21 - h, 2, h, k % 2 ? '#ff6a1a' : '#ffa030'); F(Math.round(fx), -21 - h, 1, 2, '#ffe080'); }
  } else if (T === 'stool') {   // tabouret de coin de ring
    const I = PP.iron, Rd = PP.red2;
    F(-9, -22, 18, 4, Rd[2]); F(-9, -22, 18, 1, Rd[4]); F(-9, -19, 18, 1, Rd[0]);                        // assise en vinyle rouge
    F(-8, -18, 2, 18, I[3]); F(6, -18, 2, 18, I[1]); F(-4, -18, 2, 16, I[2]); F(2, -18, 2, 16, I[1]);   // pieds
    F(-7, -8, 14, 1, I[2]); F(-9, -1, 18, 1, I[0]);
  } else if (T === 'bucket') {   // seau d'eau du soigneur
    const P = PP.metal;
    for (let r = 0; r < 12; r++) cylRow(-12 + r, 7 - Math.round(r / 6), P);
    F(-6, -13, 13, 2, '#3a7ac0'); F(-4, -13, 6, 1, '#a8d8ff');                                          // eau
    for (let i = 0; i <= 10; i++) F(-6 + i + (i > 5 ? 1 : 0), -16 + Math.abs(i - 5) * .5, 1, 1, P[3]);  // anse
    F(-6, -1, 13, 1, P[0]);
  } else if (T === 'canister') {   // tube de laboratoire au liquide luminescent
    const L = PP.lab, liq = p.v ? ['#3a0a5a', '#7a2ad0', '#b06aff', '#e0c0ff'] : ['#0a4a2a', '#1aa858', '#3aff8a', '#c8ffd8'];
    F(-7, -4, 14, 4, L[1]); F(-7, -4, 14, 1, L[3]); F(-7, -32, 14, 4, L[1]); F(-7, -32, 14, 1, L[4]);   // culots métalliques
    for (let r = 0; r < 24; r++) { const yy = -28 + r, lvl = r > 5; for (let px = -6; px <= 6; px++) F(px, yy, 1, 1, Math.abs(px) === 6 ? L[2] : !lvl ? 'rgba(200,230,240,.25)' : px < -3 ? liq[3] : px < 2 ? liq[2] : liq[1]); }
    for (let b = 0; b < 3; b++) { const by = -6 - ((G.frame + b * 13) % 20); F(-2 + b * 2, by, 1, 1, '#ffffff'); }   // bulles
    F(-5, -27, 1, 20, 'rgba(255,255,255,.5)');
  } else if (T === 'labdrum') {   // tonneau métallique de laboratoire (gris acier ou orange)
    const P = p.v ? PP.orng : PP.steel, D = PP.steel;
    for (let r = 0; r < 30; r++) cylRow(-30 + r, 9, P);
    for (const yy of [-26, -15, -4]) { for (let px = -9; px <= 9; px++) F(px, yy, 1, 2, Math.abs(px) === 9 ? P[0] : px < -3 ? P[4] : P[1]); }   // cerclages
    F(-9, -31, 19, 2, P[3]); F(-9, -31, 19, 1, P[4]); F(-6, -31, 4, 1, D[0]); F(3, -31, 3, 1, D[1]);   // couvercle, bondes
    if (p.v) { F(-4, -22, 9, 5, '#1a1a20'); F(-3, -21, 7, 3, '#e8e0c8'); F(-2, -20, 5, 1, '#1a1a20'); }   // étiquette
    else { F(-5, -11, 11, 2, '#3ab8e0'); F(-5, -11, 11, 1, '#8ae8ff'); }   // bande lumineuse cyan
    F(-9, -1, 19, 1, P[0]);
  } else if (T === 'hazard') {   // fût de produit toxique (biohazard)
    const P = PP.yel;
    for (let r = 0; r < 28; r++) cylRow(-28 + r, 9, P);
    for (const yy of [-25, -3]) for (let px = -9; px <= 9; px++) F(px, yy, 1, 1, P[0]);
    F(-4, -18, 9, 9, '#1a1a20'); F(-1, -17, 3, 3, P[3]); F(-3, -13, 2, 2, P[3]); F(2, -13, 2, 2, P[3]); F(0, -14, 1, 1, '#1a1a20');   // symbole
    F(-9, -29, 19, 2, P[3]); F(-9, -29, 19, 1, P[4]);
  } else {
    const pal = [PP.blue, PP.red, PP.green][p.v] || PP.blue, tall = T === 'tallvase', h = tall ? 30 : 22;
    for (let r = 0; r < h; r++) {
      const t = r / h;
      const wv = tall ? (t < .1 ? 3 : t < .22 ? 2 : Math.round(2 + Math.sin((t - .22) / .78 * Math.PI) * 5.5))
                      : (t < .1 ? 3 : t < .2 ? 2 : Math.round(2 + Math.sin((t - .2) / .8 * Math.PI) * 4.8));
      const band = (r % 10 === 5 || r % 10 === 6) && t > .25;
      cylRow(-h + r, wv, band ? PP.gold : pal);
    }
    F(-3, -h, 7, 1, pal[0]); F(-2, -h + 1, 5, 1, '#0a0a10');   // ouverture
    F(-3, -1, 7, 1, pal[0]);
  }
}
function drawProps() {
  for (const p of G.props || []) {
    if (!p.alive) continue;
    if (p.fly) {
      ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(p.fly.rot);
      drawProp(p, 0, PROP_DIM[p.type][1] / 2); ctx.restore();
    } else {
      if (!p.held) R(p.x - PROP_DIM[p.type][0] / 2 - 1, p.y, PROP_DIM[p.type][0] + 2, 1, 'rgba(40,20,8,.45)');
      drawProp(p, Math.round(p.x), Math.round(p.y));
    }
  }
}
function drawShards() {
  for (const s of G.shards || []) {
    if (s.t > 40 && (s.t >> 1) % 2) continue;   // clignote avant de disparaître
    R(s.x, s.y, s.s, s.s, s.col);
  }
}
// Sang : gouttes projetées qui tachent le sol (désactivable dans les options)
function spawnBlood(x, y, away, dmg) {
  if (!OPT.blood) return;
  const n = 5 + Math.min(10, dmg | 0);
  for (let i = 0; i < n; i++) G.blood.push({ x, y: y + (Math.random() - .5) * 8, vx: away * (.8 + Math.random() * 2.6) + (Math.random() - .5),
    vy: -1.2 - Math.random() * 2.6, s: Math.random() < .3 ? 2 : 1, gy: GROUND - 3 + Math.random() * 9, t: 0 });
}
function updBlood() {
  for (const d of G.blood) {
    d.t++; d.vy += .28; d.x += d.vx; d.y += d.vy;
    if (d.y >= d.gy) { d.dead = true; if (G.stains.length < 160) G.stains.push({ x: d.x, y: d.gy, w: 1 + (Math.random() * 3 | 0) + d.s, a: 1 }); }
  }
  G.blood = G.blood.filter(d => !d.dead);
}
function drawStains() { for (const s of G.stains || []) { R(s.x - s.w / 2, s.y, s.w, 1, '#6a0a0a'); if (s.w > 2) R(s.x - s.w / 2 + 1, s.y - 1, s.w - 2, 1, '#8a1010'); } }
function drawBlood() { for (const d of G.blood || []) R(d.x, d.y, d.s + 1, d.s, d.s > 1 ? '#a01010' : '#c81818'); }
/* ---------- Vesper : hologramme et mines ---------- */
const HOLO_HIT = { dmg: 6, stun: 16, bstun: 12, push: 1.2, chip: 1, sfx: 'hit' };       // décharge simple (pas de paralysie)
const HOLO_PARA = { dmg: 6, stun: 80, bstun: 12, push: .6, chip: 1, sfx: 'hit' };      // 3e décharge d'affilée : paralysie (mêmes dégâts)
const HOLO_BIG = { dmg: 14, stun: 80, bstun: 16, push: 2, chip: 2, sfx: 'heavy' };   // clone chargé : plus de dégâts + paralysie
const MINE_HIT = { dmg: 8, knock: true, stun: 20, bstun: 14, push: 5, chip: 0, sfx: 'heavy', unblock: true };
function shock(att, o, data, x, y) {
  addSpark(x, y, 'parry'); G.flashT = Math.max(G.flashT, 6); G.boltX = x; G.boltY = y;
  applyHit(att, o, data, x, y, att.x, true);
  sfx('parry');
}
function updVesper() {
  for (const q of G.holos || []) {
    const o = G.f.find(f => f !== q.owner);
    q.t++; q.x += q.dir * (q.big ? 9 : 5.5);
    if (q.blue) { (q.trail = q.trail || []).unshift(q.x); if (q.trail.length > 6) q.trail.pop(); }
    if (q.x < (G.camL || 0) - 30 || q.x > (G.camL || 0) + W + 30 || q.t > 90) q.dead = true;
    if (q.dead || !o) continue;
    const hb = hurtbox(o), ab = rawAtkBox(o);
    const touch = hb && !underShot(o) && Math.abs(o.x - q.x) < 16 && o.y > q.y - 70;
    const struck = ab && ab[0] < q.x + 12 && ab[2] > q.x - 12;   // l'adversaire frappe l'hologramme
    if (touch || struck) {
      q.dead = true;
      if (!hurtbox(o)) { addSpark(q.x, q.y - 50, 'parry'); continue; }
      const n = (o.holoHitT != null && G.frame - o.holoHitT < 180 ? (o.holoHits || 0) : 0) + 1;   // touches d'affilée (moins de 3 s d'écart)
      const para = n >= 3 || q.big;   // 3e clone d'affilée, ou clone chargé : paralyse
      shock(q.owner, o, q.big ? HOLO_BIG : para ? HOLO_PARA : HOLO_HIT, q.x, q.y - 50);
      if (o.state === 'hit' || o.state === 'fall') {
        o.holoHitT = G.frame; o.holoHits = para ? 0 : n;
        if (para) { o.paraT = 80; o.paraBlue = true; addPopup(o.x, o.y - 104, 'PARALYZED!', '#7af0ff'); G.shake = Math.max(G.shake, 4); }
      } else o.holoHits = 0;   // décharge parée : la série repart à zéro
    }
  }
  if (G.holos) G.holos = G.holos.filter(q => !q.dead);
  for (const m of G.mines || []) {
    const o = G.f.find(f => f !== m.owner);
    m.t++;
    if (m.t > 420) m.dead = true;
    if (m.dead || !o || m.t < 18) continue;
    if (!o.air && Math.abs(o.x - m.x) < 14 && hurtbox(o)) { m.dead = true; shock(m.owner, o, MINE_HIT, m.x, GROUND - 10); G.shake = 5; }
  }
  if (G.mines) G.mines = G.mines.filter(m => !m.dead);
  for (const f of G.f) {   // échos derrière Vesper : coup de pied plongeant et Pas de l'Ombre (arrière + A)
    if (f.def.kit !== 'vesper') continue;
    if (f.state === 'dive' || (f.state === 'zenith' && f.air) || (f.state === 'shadow' && f.t < 16)) { (f.echo = f.echo || []).push({ x: f.x, y: f.y, state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air, roll: f.roll }); if (f.echo.length > 7) f.echo.shift(); }
    else if (f.echo && f.echo.length && f.state !== 'bflip') f.echo.shift();
  }
}
/* ---------- Grog : ondes de choc au sol ---------- */
const QUAKE_HIT = { dmg: 9, knock: true, stun: 20, bstun: 14, push: 3, chip: 0, sfx: 'heavy', low: true };   // onde de Grog : garde basse (bas + arrière)
const CRUSH_SHOCK = { dmg: 7, knock: true, stun: 20, bstun: 14, push: 4, chip: 0, sfx: 'heavy', low: true };
const RAMPART_HIT = { dmg: 6, knock: true, stun: 20, bstun: 14, push: 6, chip: 0, sfx: 'heavy', unblock: true };
/* ---------- Lord Vane : lévitation, sphères du vide, ombres ---------- */
function floatOff(f) {   // Vane flotte à ~20 cm du sol quand il est debout
  if (!f.def.float || f.air) return 0;
  if (['fall', 'down', 'held', 'throw'].includes(f.state)) return 0;
  if (f.state === 'getup') return f.t < 9 ? 0 : Math.min(9, (f.t - 9) * 1.5);   // d'abord les pieds au sol, puis il se remet à flotter
  return 9 + Math.round(Math.sin(G.frame * .07 + f.id) * 1.5);
}
const VOID_HIT = { dmg: 8, stun: 18, bstun: 12, push: .6, chip: 1, sfx: 'heavy' };   // paralyse une fraction de seconde
const VOID_BIG = { dmg: 12, stun: 20, bstun: 14, push: 1, chip: 2, sfx: 'heavy' };
function vaneDust(f, inward) {   // particules rose électrique et noires (désintégration / réintégration)
  for (let k = 0; k < 6; k++) {
    const bx = f.x + (Math.random() - .5) * 26, by = f.y - 8 - Math.random() * 80, a = Math.random() * 6.28, sp = 1 + Math.random() * 2.2;
    const p = { x: bx, y: by, vx: Math.cos(a) * sp - f.dir * 1.2, vy: Math.sin(a) * sp - .4, t: 0, pink: Math.random() < .55, alt: isAltV(f) };
    if (inward) { p.x = bx - p.vx * 12; p.y = by - p.vy * 12; }   // convergent vers le corps
    G.vdust.push(p);
  }
}
function updVane() {
  for (const p of G.vdust || []) { p.t++; p.x += p.vx; p.y += p.vy; }
  if (G.vdust) G.vdust = G.vdust.filter(p => p.t < 12);
  for (const f of G.f) {   // échos de l'Impact Météore
    if (!f.def.float) continue;
    const met = f.state === 'meteor' || f.state === 'meteorD', moving = met || (f.state === 'walk' && Math.abs(f.vx) > .1) || f.air;   // échos en marchant, en sautant et pendant l'Impact Météore
    if (moving && !met && (G.frame % 3)) continue;
    if (moving) { (f.echo = f.echo || []).push({ x: f.x, y: f.y - floatOff(f), state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air, roll: f.roll }); if (f.echo.length > 7) f.echo.shift(); }
    else if (f.echo && f.echo.length && f.state !== 'bflip') f.echo.shift();
  }
  for (const q of G.voids || []) {
    const o = G.f.find(f => f !== q.owner);
    q.t++;
    if (q.charging) {   // sphère en charge, tenue devant Vane
      const w = q.owner; if (w.state !== 'voidcast') { q.dead = true; vaneChargeStop(w); continue; }
      q.r = 10 + Math.min(1, q.ch / 90) * 28; q.x = w.x + w.dir * (26 + q.r * .9); q.y = w.y - 54 - floatOff(w) - Math.max(0, q.r - 24) * .6;
      if (q.ch >= 45) {   // dès la moitié de la charge (A encore tenu) : bouclier, annule les projectiles adverses qui la touchent, sans blesser l'adversaire
        let n = killShots(w, q.x - q.r, q.x + q.r, q.y - q.r, q.y + q.r);
        for (const s2 of G.snakes || []) if (!s2.dead && s2.owner !== w && Math.abs(s2.x - q.x) < q.r + 10 && Math.abs(s2.y - q.y) < q.r + 10) { s2.dead = true; n++; (G.clashFx = G.clashFx || []).push({ x: s2.x, y: s2.y, t: 0 }); }
        if (n) { G.flashT = Math.max(G.flashT, 3); G.shake = Math.max(G.shake, 4); sfx('parry'); sfx('heavy'); }
      }
      if (q.t % 2 === 0) for (let k = 0; k < 2; k++) { const a = Math.random() * 6.28, d = q.r * 2.4; G.vdust.push({ x: q.x + Math.cos(a) * d, y: q.y + Math.sin(a) * d, vx: -Math.cos(a) * d / 11, vy: -Math.sin(a) * d / 11, t: 0, pink: Math.random() < .7, alt: isAltV(q.owner) }); }
      continue;
    }
    if (q.t % 2 === 0) { (q.trail = q.trail || []).push([q.x, q.y]); if (q.trail.length > 7) q.trail.shift(); }   // échos roses derrière la sphère
    q.x += q.vx; q.y += q.vy;
    if (q.vy > 0 && q.y >= GROUND - q.r - 2) { q.y = GROUND - q.r - 2; q.vy = 0; q.vx = q.dir * 6; }   // touche le sol puis glisse
    if (q.x < (G.camL || 0) - 60 || q.x > (G.camL || 0) + W + 60) q.dead = true;
    if (q.dead || !o) continue;
    if (hurtbox(o) && !underShot(o) && Math.abs(o.x - q.x) < q.r + 6 && q.y + q.r * .8 > o.y - 94 && q.y - q.r * .8 < o.y + 4) {
      q.dead = true; applyHit(q.owner, o, q.big ? VOID_BIG : (q.hit || VOID_HIT), q.x, q.y, q.x - q.dir * 10, true);
      if (q.c > .5) G.shake = Math.max(G.shake, 4 + q.c * 6);
      if (o.state === 'hit' || o.state === 'fall') { if (G.frame - (o.vHitT || -9999) > 240) o.vHits = 0; o.vHitT = G.frame; o.vHits = (o.vHits || 0) + 1; const chg = (q.c || 0) > .5; if (chg || o.vHits >= 3) { o.paraT = chg ? 54 + Math.round(q.c * 30) : 22; if (!chg) o.vHits = 0; addPopup(o.x, o.y - 100, 'PARALYZED!', '#c88aff'); } }
    }
    for (const fb of G.fbs || []) if (fb.alive && fb.owner !== q.owner && Math.abs(fb.x - q.x) < 20 && Math.abs(fb.y - q.y) < 30) { const pf = shotPow(fb), pv = shotPow(q); if (pf <= pv) { fb.alive = false; if (fb.mate) fb.mate.alive = false; } if (pv <= pf) q.dead = true; addSpark(q.x, q.y, 'parry'); }
  }
  if (G.voids) G.voids = G.voids.filter(q => !q.dead);
  for (const s2 of G.shadowFx || []) s2.t++;
  if (G.shadowFx) G.shadowFx = G.shadowFx.filter(s2 => s2.t < 24);
  for (const f of G.f) { if (f.paraT > 0) f.paraT--; else f.paraBlue = false; if (f.rampT > 0) f.rampT--; }
}

// Nitro / Surge : échos, double mauve, brasier de particules
const CALM_POW = ['idle', 'crouch', 'block', 'cblock', 'down', 'getup'];
function powerTrail(f) {
  const on = f.nitroT > 0;
  (f.hist = f.hist || []).push({ x: f.x, y: f.y - floatOff(f), state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air, roll: f.roll, rushPose: f.rushPose, rushN: f.rushN, flipFin: f.flipFin, fired: f.fired });
  if (f.hist.length > 10) f.hist.shift();
  f.necho = f.necho || [];
  if (on && G.frame % 2 === 0 && (!CALM_POW.includes(f.state) || Math.abs(f.vx) > .2 || f.air)) { f.necho.push(f.hist[f.hist.length - 1]); if (f.necho.length > 6) f.necho.shift(); }
  else if (f.necho.length && (!on || G.frame % 2 === 0)) f.necho.shift();
}
function drawPowerBehind() {
  for (const f of G.f) {
    const vane = f.def.kit === 'vane' && f.surgeT > 0, surge = f.surgeT > 0;
    (f.necho || []).forEach((e, i, A) => {
      const k = (i + 1) / (A.length + 1);
      const tint = vane ? (i < A.length / 2 ? 'rgba(6,0,12,.92)' : 'rgba(170,40,255,.85)') : surge ? 'rgba(190,60,255,.85)' : 'rgba(60,255,120,.8)';
      ctx.save(); ctx.globalAlpha = .5 * k; if (!vane || i >= A.length / 2) ctx.globalCompositeOperation = 'lighter';
      drawFighter(Object.assign({}, f, e, { flash: 0, tint, ghostDraw: true }), e.x, e.y); ctx.restore();
    });
    if (f.nitroT > 0 && !f.ko) powerAura(f, vane, surge);
  }
}
function powerAura(f, vane, surge) {   // brasier léger qui émane du personnage
  const P = f.aura = f.aura || [];
  if (P.length < 34) for (let i = 0; i < 2; i++) P.push({ x: f.x + (Math.random() - .5) * 30, y: f.y - Math.random() * 70, vx: (Math.random() - .5) * .4, vy: -.6 - Math.random() * .9, t: 0, life: 18 + Math.random() * 16, s: Math.random() < .3 ? 2 : 1 });
  ctx.save();
  for (const p of P) {
    p.t++; p.x += p.vx + (f.x - (p.fx || f.x)) * 0; p.y += p.vy;
    const a = Math.max(0, 1 - p.t / p.life), px = Math.round(p.x), py = Math.round(p.y);
    if (vane) {   // Lord Vane : particules noires avec un halo mauve
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(170,40,255,${.35 * a})`; ctx.fillRect(px - 1, py - 1, p.s + 2, p.s + 2);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(8,0,14,${.9 * a})`; ctx.fillRect(px, py, p.s + 1, p.s + 1);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = surge ? `rgba(200,80,255,${.85 * a})` : `rgba(90,255,140,${.75 * a})`; ctx.fillRect(px, py, p.s, p.s);
      if (p.s > 1) { ctx.fillStyle = surge ? `rgba(150,40,255,${.3 * a})` : `rgba(40,200,90,${.3 * a})`; ctx.fillRect(px - 1, py - 1, p.s + 2, p.s + 2); }
    }
  }
  ctx.restore();
  f.aura = P.filter(p => p.t < p.life);
}
function drawSurgeGhost(f) {   // le double mauve refait le même geste une fraction de seconde après
  if (!(f.surgeT > 0) || !f.hist || f.hist.length < 8 || f.ko) return;
  const e = f.hist[f.hist.length - 8]; if (CALM_POW.includes(e.state) || ['walk', 'jump', 'land', 'hit', 'fall', 'nitroUp'].includes(e.state)) return;
  const vane = f.def.kit === 'vane', gx = e.x + e.dir * 12, col = vane ? '#a020ff' : '#c040ff';
  ctx.save(); ctx.globalAlpha = .58; drawFighter(Object.assign({}, f, e, { ghostDraw: true, flash: 0, tintKeep: col }), gx, e.y); ctx.restore();
  ctx.save(); ctx.globalAlpha = .22; ctx.globalCompositeOperation = 'lighter'; drawFighter(Object.assign({}, f, e, { ghostDraw: true, flash: 0, tint: 'rgba(200,70,255,1)' }), gx, e.y); ctx.restore();
}
function drawNitroGauge(f, x, w, left) {   // petite jauge sous l'énergie : verte (Nitro), puis la partie mauve (Surge) se remplit par-dessus
  const nv = f.nitroT > 0 ? 0 : Math.min(1, ((f.nDeal || 0) + (f.nTake || 0)) / NITRO_NEED), sv = f.surgeT > 0 ? 0 : Math.min(1, ((f.sDeal || 0) + (f.sTake || 0)) / SURGE_NEED);
  const ease = (d, v) => d == null ? v : d + Math.max(-.05, Math.min(.012, v - d));   // se remplit petit à petit
  f.gDisp = ease(f.gDisp, nv); f.sDisp = ease(f.sDisp, sv);
  const gw = Math.round(w * .4), gx = left ? x : x + w - gw, y = 22;
  const nFull = nitroFull(f) && !(f.nitroT > 0), sFull = surgeFull(f) && !(f.surgeT > 0), blink = (G.frame >> 3) % 2;
  const bar = (v, col, hi) => { const fw = Math.round(gw * v); if (left) { R(gx, y, fw, 3, col); R(gx, y, fw, 1, hi); } else { R(gx + gw - fw, y, fw, 3, col); R(gx + gw - fw, y, fw, 1, hi); } };
  R(gx - 1, y - 1, gw + 2, 5, '#000'); R(gx, y, gw, 3, '#14281a');
  bar(f.gDisp, f.nitroT > 0 ? '#1c8a44' : nFull && blink ? '#b0ffc8' : '#3cf070', '#b0ffc8');
  if (f.sDisp > 0) bar(f.sDisp, sFull && blink ? '#f0b0ff' : '#c050ff', '#f0b0ff');
  if (f.nitroT > 0) {   // temps restant du Nitro / Surge
    const rem = f.surgeT > 0 ? f.surgeT / SURGE_T : f.nitroT / NITRO_T, tw = Math.round(gw * rem);
    R(left ? gx : gx + gw - tw, y + 3, tw, 1, f.surgeT > 0 ? '#ff80ff' : '#80ffa0');
  }
  if ((sFull || nFull) && (G.frame >> 4) % 4 !== 3)
    glowText(sFull ? 'SURGE XXA' : 'NITRO XXY', left ? gx + gw + 4 : gx - 4, y - 1, sFull ? '#e080ff' : '#6aff9a', left ? 'left' : 'right');
}
function glowText(str, x, y, col, align) {   // texte pixel qui brille
  ctx.save(); ctx.globalAlpha *= .35; ctx.shadowColor = col; ctx.shadowBlur = 2; text(str, x, y, 8, col, align); ctx.restore();   // léger halo lumineux
  text(str, x, y, 8, col, align);
}
function drawVaneBehind() {   // échos derrière Vane
  for (const f of G.f) {
    if (!f.echo || !f.echo.length) continue;
    VALT = isAltV(f);
    f.echo.forEach((e, i) => {
      const a = (i + 1) / (f.echo.length + 1);
      ctx.save(); ctx.globalAlpha = .55 * a; if (i % 2 === 0) ctx.globalCompositeOperation = 'lighter'; drawFighter(Object.assign({}, f, e, { flash: 0, tint: i % 2 ? 'rgba(10,0,20,.85)' : e.state === 'bflip' ? ((f.def.fb && f.def.fb[2]) || '#ffffff') : (f.def.kit === 'vesper' ? 'rgba(58,220,255,.85)' : (f.def.twinFb || f.def.kit === 'zephyr') ? 'rgba(60,140,255,.85)' : 'rgba(255,60,200,.85)') }), e.x, e.y); ctx.restore();
    });
  }
  VALT = false;
}

let TINTC = null;
// Vane joueur 2 (2e couleur) : tous ses effets mauves / roses deviennent orange
let VALT = false;
const isAltV = o => !!(o && o.def && o.def.float && o.def.alt);
function orangeify(c) {
  let r, g, b, a = null, m;
  if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i.exec(c))) { r = parseInt(m[1], 16); g = parseInt(m[2], 16); b = parseInt(m[3], 16); if (m[4]) a = m[4]; if (!(b > g + 20)) return c; const h = v => Math.round(v).toString(16).padStart(2, '0'); return '#' + h(Math.max(r, b)) + h(Math.max(g, b * .5)) + h(Math.min(g, b) * .3) + (a || ''); }
  if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(,\s*[\d.]+\s*)?\)$/i.exec(c))) { r = +m[1]; g = +m[2]; b = +m[3]; if (!(b > g + 20)) return c; return `rgba(${Math.round(Math.max(r, b))},${Math.round(Math.max(g, b * .5))},${Math.round(Math.min(g, b) * .3)}${m[4] || ',1'})`; }
  return c;
}
for (const k of ['fillStyle', 'strokeStyle']) {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, k);
  if (d && d.set) Object.defineProperty(CanvasRenderingContext2D.prototype, k, { get() { return d.get.call(this); }, set(v) { d.set.call(this, VALT && typeof v === 'string' ? orangeify(v) : v); }, configurable: true, enumerable: d.enumerable });
}
{ const acs = CanvasGradient.prototype.addColorStop; CanvasGradient.prototype.addColorStop = function (o, c) { return acs.call(this, o, VALT && typeof c === 'string' ? orangeify(c) : c); }; }
function drawVaneGhost(f) {   // double rose électrique et noir qui frappe 20 cm devant Vane
  if (!f.def.float || !VANE_NORMALS.includes(f.state)) return;
  const gx = f.x + f.dir * 26, gy = f.y - floatOff(f); VALT = isAltV(f);
  ctx.save(); ctx.globalAlpha = .3; drawFighter(Object.assign({}, f, { ghostDraw: true, flash: 0, tint: 'rgba(8,0,16,.9)' }), gx - f.dir * 3, gy + 1); ctx.restore();   // ombre noire décalée
  ctx.save(); ctx.globalAlpha = .62; drawFighter(Object.assign({}, f, { ghostDraw: true, flash: 0, tintKeep: '#ff40c8' }), gx, gy); ctx.restore();   // copie détaillée teintée rose
  ctx.save(); ctx.globalAlpha = .18; ctx.globalCompositeOperation = 'lighter'; drawFighter(Object.assign({}, f, { ghostDraw: true, flash: 0, tint: 'rgba(255,60,210,1)' }), gx, gy); ctx.restore();   // glow
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 2; b++) { const L = []; for (let s2 = 0; s2 <= 5; s2++) L.push([gx + (Math.random() - .5) * 30, gy - 10 - s2 * 14]); elecArc(L, 'rgba(255,120,230,.8)', 1); }
  ctx.restore(); VALT = false;
}
function drawVaneFx() {
  for (const p of G.vdust || []) { VALT = !!p.alt; const a = 1 - p.t / 12; ctx.fillStyle = p.pink ? `rgba(255,70,210,${a})` : `rgba(10,0,20,${a})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
  for (const f of G.f) { VALT = isAltV(f);
    if (f.state === 'pteleport' && f.def.float) {   // glow rose autour de Vane pendant la désintégration / réintégration
      const k = f.t < 14 ? 1 - f.t / 18 : .4 + (f.t - 14) / 23, cx = f.x, cy = f.y - 46 - floatOff(f), g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 66);
      g.addColorStop(0, `rgba(255,100,230,${.9 * k})`); g.addColorStop(.5, `rgba(220,40,200,${.45 * k})`); g.addColorStop(1, 'rgba(40,0,40,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(cx - 70, cy - 70, 140, 140);
      if (f.t >= 14) { const L = []; for (let s2 = 0; s2 <= 5; s2++) L.push([cx + (Math.random() - .5) * 34, f.y - floatOff(f) - s2 * 16]); elecArc(L, 'rgba(255,130,235,.8)', 1); }
      ctx.restore();
    }
    if (f.state === 'tpstrike' && f.t < 16) {   // glow rose et noir autour du coup de pied
      const kx = f.x + f.dir * 30, ky = f.y - 44 - floatOff(f), g = ctx.createRadialGradient(kx, ky, 1, kx, ky, 20);
      g.addColorStop(0, 'rgba(255,170,240,.85)'); g.addColorStop(.5, 'rgba(255,40,190,.45)'); g.addColorStop(1, 'rgba(20,0,30,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kx, ky, 20, 0, Math.PI * 2); ctx.fill();
      for (let b = 0; b < 3; b++) { const a = Math.random() * 6.28; elecArc([[kx, ky], [kx + Math.cos(a) * 9, ky + Math.sin(a) * 9], [kx + Math.cos(a) * 18, ky + Math.sin(a) * 18]], 'rgba(255,120,230,.9)', 1.2); }
      ctx.restore();
    }
    if ((f.state === 'meteor' || f.state === 'meteorD') && f.def.float) {   // halo rose autour du corps
      const g = ctx.createRadialGradient(f.x, f.y - 40, 2, f.x, f.y - 40, 46); g.addColorStop(0, 'rgba(255,90,220,.45)'); g.addColorStop(1, 'rgba(40,0,60,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y - 40, 46, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  for (const q of G.voids || []) (q.trail || []).forEach(([tx, ty], i, A) => { VALT = isAltV(q.owner);   // échos rose et noir derrière la sphère
    const a = (i + 1) / (A.length + 1); let R = q.r * (.55 + .45 * a);
    ctx.save();
    if (i % 2) { ctx.globalAlpha = .4 * a; ctx.fillStyle = '#0a0014'; }
    else { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(tx, ty, 1, tx, ty, R * 1.5); g.addColorStop(0, `rgba(255,90,220,${.55 * a})`); g.addColorStop(1, 'rgba(120,0,120,0)'); ctx.fillStyle = g; R *= 1.5; }
    ctx.beginPath(); ctx.arc(tx, ty, i % 2 ? R * .8 : R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const q of G.voids || []) { VALT = isAltV(q.owner);   // sphère d'énergie noire crépitante
    const R = q.r, x = q.x, y = q.y, pc = q.charging ? Math.min(1, q.ch / 90) : (q.c || 0);
    if (pc > 0) { const gp = ctx.createRadialGradient(x, y, R * .4, x, y, R * (2.6 + pc)); gp.addColorStop(0, `rgba(255,80,220,${.25 + .25 * pc})`); gp.addColorStop(.5, `rgba(220,40,200,${.12 + .15 * pc})`); gp.addColorStop(1, 'rgba(60,0,60,0)'); ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(x, y, R * (2.6 + pc), 0, Math.PI * 2); ctx.fill(); }   // glow rose qui grandit avec la charge
    const g = ctx.createRadialGradient(x, y, 1, x, y, R * 2.4); g.addColorStop(0, 'rgba(200,120,255,.7)'); g.addColorStop(.4, 'rgba(138,42,208,.5)'); g.addColorStop(1, 'rgba(40,10,74,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.4, 0, Math.PI * 2); ctx.fill();
    if (q.slow) { const g2 = ctx.createRadialGradient(x, y, R, x, y, R * 3.4); g2.addColorStop(0, 'rgba(120,40,200,.45)'); g2.addColorStop(1, 'rgba(30,6,60,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, R * 3.4, 0, Math.PI * 2); ctx.fill(); }
    for (let b = 0; b < (q.slow ? 9 : 4); b++) { const a = Math.random() * 6.28, L = [[x, y]]; for (let s2 = 1; s2 <= 3; s2++) L.push([x + Math.cos(a + (Math.random() - .5) * .6) * R * (.7 + s2 * .45), y + Math.sin(a + (Math.random() - .5) * .6) * R * (.7 + s2 * .45)]); elecArc(L, 'rgba(220,160,255,.9)', 1.2); }
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(200,140,255,${.8 - k * .2})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, R * (.5 + k * .25), q.t * .3 + k * 2, q.t * .3 + k * 2 + 3.6); ctx.stroke(); }
  }
  ctx.restore();
  for (const q of G.voids || []) { VALT = isAltV(q.owner);   // cœur noir et éclairs noirs
    ctx.fillStyle = '#0a0412'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * .62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6a2ab0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * .62, 0, Math.PI * 2); ctx.stroke();
    if (q.slow) for (let b = 0; b < 4; b++) {   // éclairs noirs qui jaillissent du cœur
      const a = Math.random() * 6.28, L = [[q.x, q.y]]; for (let s2 = 1; s2 <= 4; s2++) L.push([q.x + Math.cos(a + (Math.random() - .5) * .8) * q.r * (.5 + s2 * .4), q.y + Math.sin(a + (Math.random() - .5) * .8) * q.r * (.5 + s2 * .4)]);
      elecArc(L, '#06020c', 2.2); elecArc(L, 'rgba(160,80,240,.8)', .8);
    }
    if (q.slow) { ctx.strokeStyle = 'rgba(220,170,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (.85 + Math.sin(q.t * .3) * .05), 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const s2 of G.shadowFx || []) {   // gerbe d'ombre de la téléportation
    const a = 1 - s2.t / 24;
    for (let k = 0; k < 14; k++) {
      const ang = k * .45 + s2.t * .05, rr = 6 + s2.t * 2 + (k % 3) * 4, x = s2.x + Math.cos(ang) * rr * .6, y = s2.y + Math.sin(ang) * rr - s2.t * .8;
      ctx.fillStyle = k % 2 ? `rgba(10,4,18,${.8 * a})` : `rgba(90,30,140,${.6 * a})`; ctx.beginPath(); ctx.arc(x, y, Math.max(1, 5 - s2.t * .15), 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const f of G.f) { VALT = isAltV(f);
    if (f.state === 'meteor' || f.state === 'meteorD') {   // flammes noires et violettes autour du corps
      const fy = f.y - 40;
      for (let k = 0; k < 18; k++) {
        const life = ((G.frame * 2 + k * 9) % 22) / 22, ang = k * .7 + G.frame * .2, rr = 14 + life * 10;
        const x = f.x + Math.cos(ang) * rr * .7 - (f.state === 'meteorD' ? f.dir * life * 26 : 0), y = fy + Math.sin(ang) * rr - (f.state === 'meteor' ? -life * 14 : life * 18);
        ctx.fillStyle = life < .3 ? 'rgba(200,120,255,.9)' : life < .6 ? 'rgba(90,20,150,.85)' : 'rgba(10,4,18,.8)';
        const z = Math.max(1, Math.round(5 * (1 - life))); ctx.fillRect(Math.round(x) - z, Math.round(y) - z, z * 2, z * 2);
      }
    }
    if (f.paraT > 0) {   // paralysie : éclairs violets autour de la victime (bleu clair : Vesper / Zephyr)
      const pc = (r, g, b) => f.paraBlue ? Math.round(r * .4) + ',' + Math.round(Math.max(g, b * .9)) + ',255' : r + ',' + g + ',' + b;
      const k = Math.min(1, f.paraT / 20), cy = f.y - 48, fl = .6 + Math.random() * .4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let g = ctx.createRadialGradient(f.x, cy, 4, f.x, cy, 78);   // halo de glow
      g.addColorStop(0, `rgba(${pc(255,110,240)},${.5 * k * fl})`); g.addColorStop(.45, `rgba(${pc(170,60,255)},${.3 * k * fl})`); g.addColorStop(1, `rgba(${pc(60,0,120)},0)`);
      ctx.fillStyle = g; ctx.fillRect(f.x - 80, cy - 80, 160, 160);
      if (G.frame % 4 < 2) { ctx.globalAlpha = .55 * k; drawFighter(Object.assign({}, f, { flash: 0, tint: G.frame % 8 < 4 ? `rgba(${pc(230,140,255)},.9)` : `rgba(${pc(255,255,255)},.9)` }), f.x, f.y); ctx.globalAlpha = 1; }   // silhouette électrisée
      for (let b = 0; b < 5; b++) {   // éclairs qui parcourent le corps
        const L = [], x0 = f.x + (Math.random() - .5) * 40; for (let s2 = 0; s2 <= 6; s2++) L.push([x0 + (Math.random() - .5) * 34, f.y + 2 - s2 * 15]);
        elecArc(L, `rgba(${pc(160,80,255)},.55)`, 4); elecArc(L, b % 2 ? `rgba(${pc(255,120,235)},.95)` : `rgba(${pc(230,200,255)},.95)`, 1.3);
      }
      for (let b = 0; b < 3; b++) {   // arcs qui jaillissent vers l'extérieur
        const a0 = Math.random() * 6.28, L = [[f.x, cy]]; for (let s2 = 1; s2 <= 4; s2++) L.push([f.x + Math.cos(a0) * s2 * 15 + (Math.random() - .5) * 10, cy + Math.sin(a0) * s2 * 15 + (Math.random() - .5) * 10]);
        elecArc(L, `rgba(${pc(255,170,250)},.8)`, 1);
      }
      g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 44); g.addColorStop(0, `rgba(${pc(220,120,255)},${.45 * k})`); g.addColorStop(1, `rgba(${pc(120,0,200)},0)`);   // flaque de lumière au sol
      ctx.fillStyle = g; ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, .22); ctx.fillRect(-46, -46, 92, 92); ctx.restore();
      for (let b = 0; b < 4; b++) { ctx.fillStyle = Math.random() < .5 ? (f.paraBlue ? '#d0f4ff' : '#ffd0ff') : (f.paraBlue ? '#90d8ff' : '#c890ff'); ctx.fillRect(Math.round(f.x + (Math.random() - .5) * 60), Math.round(f.y - Math.random() * 100), 2, 2); }
      ctx.restore();
    }
  }
  VALT = false;
}

/* ---------- Kael : onde sonique, gants chargés, aura plasma ---------- */
const SONIC_HIT = { dmg: 8, stun: 18, bstun: 12, push: 6.5, chip: 1, sfx: 'heavy' };
const PWALL_HIT = { dmg: 14, knock: true, lift: 5, stun: 22, bstun: 16, push: 3, chip: 3, sfx: 'heavy', unblock: true };   // électrifié, tombe en arrière
const ELEC_PAL = ['#ffffff', '#c8faff', '#5af0ff', '#1a78d0'];
const SONIC_BIG = { dmg: 15, knock: true, stun: 22, bstun: 16, push: 8, chip: 3, sfx: 'heavy' };
function updHiroEcho() {   // échos bleus derrière Hiro (glissade + shoryuken) et Zephyr (shoryuken, vrille en l'air)
  for (const f of G.f) {
    if (f.def.kit === 'zephyr') {
      if (['zslash', 'tornado', 'zdash'].includes(f.state)) { (f.echo = f.echo || []).push({ x: f.x, y: f.y, state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air, roll: f.roll }); if (f.echo.length > 7) f.echo.shift(); }
      else if (f.echo && f.echo.length && f.state !== 'bflip') f.echo.shift();
      continue;
    }
    if (!f.def.twinFb) continue;
    if (f.state === 'hslide' || f.state === 'uppercut') { (f.echo = f.echo || []).push({ x: f.x, y: f.y, state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air, roll: f.roll, apexT: f.apexT }); if (f.echo.length > 7) f.echo.shift(); }
    else if (f.echo && f.echo.length && f.state !== 'bflip') f.echo.shift();
  }
}
function updKael() {
  updHiroEcho();
  for (const q of G.sonics || []) {
    const o = G.f.find(f => f !== q.owner);
    q.t++; q.x += q.dir * 8;
    if (q.x < (G.camL || 0) - 40 || q.x > (G.camL || 0) + W + 40 || q.t > 60) q.dead = true;
    if (q.dead || !o) continue;
    if (hurtbox(o) && !underShot(o) && Math.abs(o.x - q.x) < 16 && o.y - 80 < q.y + 18 && o.y > q.y - 18) { q.dead = true; applyHit(q.owner, o, q.big ? SONIC_BIG : SONIC_HIT, q.x, q.y, q.x - q.dir * 10, true); }
    for (const fb of G.fbs || []) if (fb.alive && fb.owner !== q.owner && Math.abs(fb.x - q.x) < 22) { if (!fb.big) fb.alive = false; q.dead = true; addSpark(q.x, q.y, 'parry'); }
    for (const b of G.blades || []) if (!b.dead && b.owner !== q.owner && Math.abs(b.x - q.x) < 22) { b.dead = true; q.dead = true; addSpark(q.x, q.y, 'parry'); }
    for (const b of G.sonics) if (b !== q && !b.dead && b.owner !== q.owner && Math.abs(b.x - q.x) < 20) { b.dead = true; q.dead = true; addSpark(q.x, q.y, 'parry'); }
  }
  if (G.sonics) G.sonics = G.sonics.filter(q => !q.dead);
  for (const w of G.pwalls || []) {   // mur de plasma : touche l'adversaire collé et arrête les projectiles
    w.t++; const o = G.f.find(f => f !== w.owner), half = w.big ? 26 : 20;
    if (!w.done && o && w.t < 40 && o.state === 'rburst' && o.t <= 20 && Math.abs(o.x - w.x) < half + 60) {   // mur de plasma contre dôme de Grog : les deux s'annulent, personne n'est touché, les deux reculent
      w.done = true; w.t = Math.max(w.t, 32);
      for (const d of G.waves || []) if (d.owner === o && d.dome) d.dead = true;
      (G.clashFx = G.clashFx || []).push({ x: (w.x + o.x) / 2, y: o.y - 50, t: 0 }); G.flashT = Math.max(G.flashT, 8); G.shake = Math.max(G.shake, 6); G.freeze = Math.max(G.freeze || 0, 6); sfx('parry'); sfx('heavy');
      for (const x of [w.owner, o]) { setState(x, 'block'); x.bstun = 18; x.vx = (x.x < (w.owner === x ? o.x : w.owner.x) ? -1 : 1) * 4.5; }
    }
    if (!w.done && o && w.t < 40 && hurtbox(o) && Math.abs(o.x - w.x) < half + 10) {   // touche le champ électrique : électrifié et projeté en arrière
      w.done = true; shock(w.owner, o, w.big ? Object.assign({}, PWALL_HIT, { dmg: 20 }) : PWALL_HIT, w.x, o.y - 50); o.burn = Math.max(o.burn || 0, 70); o.burnPal = ELEC_PAL; G.shake = Math.max(G.shake, 6);
    }
    { const k = w.owner, xa = Math.min(w.x, k.x) - half - 6, xb = Math.max(w.x, k.x) + half + 6;   // annule toutes les boules de feu, clones, fioles et projectiles (entre Kael et le mur)
      killShots(k, xa, xb, -400, GROUND + 10); }
  }
  if (G.pwalls) G.pwalls = G.pwalls.filter(w => w.t < 40);
  for (const f of G.f) { if (f.kcharge > 0) f.kcharge--; if (f.def.kit === 'kael' && f.state === 'flashstep' && G.frame % 2 === 0) (f.ghosts = f.ghosts || []).push({ x: f.x, t: 0 }); if (f.ghosts) { f.ghosts.forEach(g => g.t++); f.ghosts = f.ghosts.filter(g => g.t < 12); } }
}
function drawFlipFire() {   // 4e salto de Hiro (feu bleu) / Axel (feu orange) : roue de flammes
  for (const f of G.f) {
    if (!f.ftrail2 || !(f.state === 'flipk' && f.flipFin)) continue;
    const pal = f.def.fb; ctx.save(); ctx.globalCompositeOperation = 'lighter';
    f.ftrail2.forEach((p, i) => { const k = (i + 1) / f.ftrail2.length, r = 3 + k * 7;
      for (let j = 0; j < 3; j++) { const gx = p.x + (Math.random() - .5) * 6, gy = p.y + (Math.random() - .5) * 6 - j * 2, gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        gr.addColorStop(0, pal[0]); gr.addColorStop(.35, pal[1]); gr.addColorStop(.7, pal[2]); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = .55 * k; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill(); } });
    ctx.restore();
  }
}
function drawKaelFx() {
  for (const f of G.f) {   // images rémanentes bleues de l'Esquive Éclair
    if (!f.ghosts) continue;
    for (const g of f.ghosts) { ctx.save(); ctx.globalAlpha = .4 * (1 - g.t / 12); ctx.globalCompositeOperation = 'lighter'; drawFighter(Object.assign({}, f, { flash: 0, tint: 'rgba(60,170,255,.75)' }), g.x, f.y); ctx.restore(); }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const q of G.sonics || []) {   // longue onde électrique avec halo
    const sc = q.big ? 1.6 : 1, x = q.x, y = q.y, tail = q.dir > 0 ? Math.max(q.x0, x - 190) : Math.min(q.x0, x + 190);
    const x1 = Math.min(tail, x), x2 = Math.max(tail, x), hw = 9 * sc;
    const g = ctx.createLinearGradient(0, y - hw * 2, 0, y + hw * 2);
    g.addColorStop(0, 'rgba(26,120,208,0)'); g.addColorStop(.35, 'rgba(60,170,255,.45)'); g.addColorStop(.5, 'rgba(230,250,255,.9)'); g.addColorStop(.65, 'rgba(60,170,255,.45)'); g.addColorStop(1, 'rgba(26,120,208,0)');
    const fade = ctx.createLinearGradient(tail, 0, x, 0); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(.3, 'rgba(0,0,0,1)');
    ctx.save(); ctx.fillStyle = g; ctx.globalAlpha = .9; ctx.fillRect(x1, y - hw * 2, x2 - x1, hw * 4); ctx.restore();
    for (let b = 0; b < 4; b++) {   // éclairs qui courent le long du faisceau
      const L = [], n2 = 18; for (let s2 = 0; s2 <= n2; s2++) L.push([tail + (x - tail) * s2 / n2, y + (Math.random() - .5) * hw * 1.6 * (b < 2 ? 1 : 1.8)]);
      elecArc(L, b < 2 ? '#ffffff' : 'rgba(120,220,255,.85)', b < 2 ? 1.5 : 1);
    }
    const hg = ctx.createRadialGradient(x, y, 1, x, y, 22 * sc); hg.addColorStop(0, 'rgba(255,255,255,.95)'); hg.addColorStop(.4, 'rgba(120,220,255,.6)'); hg.addColorStop(1, 'rgba(26,120,208,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, 22 * sc, 0, Math.PI * 2); ctx.fill();   // tête lumineuse
    for (let k = 0; k < 3; k++) { ctx.strokeStyle = `rgba(200,250,255,${.8 - k * .25})`; ctx.lineWidth = 2 - k * .5; ctx.beginPath(); ctx.ellipse(x - q.dir * k * 8, y, (5 + k * 2) * sc * .5, (12 + k * 3) * sc, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  for (const w of G.pwalls || []) {   // mur électrique du sol jusqu'en haut de l'écran
    const a = Math.min(1, w.t / 4, (40 - w.t) / 12), half = (w.big ? 26 : 20) * (w.t < 4 ? .4 + w.t * .15 : 1), top = -40, bot = GROUND + 2;
    const g = ctx.createLinearGradient(w.x - half * 2.2, 0, w.x + half * 2.2, 0);
    g.addColorStop(0, 'rgba(26,120,208,0)'); g.addColorStop(.25, `rgba(60,170,255,${.5 * a})`); g.addColorStop(.42, `rgba(150,225,255,${.8 * a})`); g.addColorStop(.5, `rgba(240,252,255,${.95 * a})`); g.addColorStop(.58, `rgba(150,225,255,${.8 * a})`); g.addColorStop(.75, `rgba(60,170,255,${.5 * a})`); g.addColorStop(1, 'rgba(26,120,208,0)');
    ctx.fillStyle = g; ctx.fillRect(w.x - half * 2.2, top, half * 4.4, bot - top);
    ctx.globalAlpha = a;
    for (let b = 0; b < 8; b++) {   // éclairs verticaux qui serpentent dans le mur
      const L = []; for (let s2 = 0; s2 <= 14; s2++) L.push([w.x + (Math.random() - .5) * half * 1.6, bot - (bot - top) * s2 / 14]);
      elecArc(L, b < 2 ? '#ffffff' : 'rgba(120,220,255,.9)', b < 2 ? 1.5 : 1);
    }
    for (let k = 0; k < 6; k++) { const yy = bot - ((G.frame * 9 + k * 37) % (bot - top)); ctx.fillStyle = 'rgba(220,250,255,.9)'; ctx.fillRect(Math.round(w.x + (k % 2 ? -1 : 1) * half * .7), yy, 2, 6); }   // particules qui montent
    const gg = ctx.createRadialGradient(w.x, bot, 2, w.x, bot, half * 3); gg.addColorStop(0, `rgba(200,250,255,${.8 * a})`); gg.addColorStop(1, 'rgba(26,120,208,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(w.x, bot, half * 3, 8, 0, 0, Math.PI * 2); ctx.fill();   // impact au sol
    ctx.globalAlpha = 1;
  }
  for (const f of G.f) {
    if (f.kcharge > 0 && f.handW) {   // gants chargés : étincelles bleues autour du poing
      const [hx2, hy2] = f.handW, gl = ctx.createRadialGradient(hx2, hy2, 1, hx2, hy2, 12);
      gl.addColorStop(0, 'rgba(200,250,255,.8)'); gl.addColorStop(1, 'rgba(26,120,208,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx2, hy2, 12, 0, Math.PI * 2); ctx.fill();
      for (let b = 0; b < 2; b++) { const a = Math.random() * 6.28; elecArc([[hx2, hy2], [hx2 + Math.cos(a) * 6, hy2 + Math.sin(a) * 6], [hx2 + Math.cos(a) * 12, hy2 + Math.sin(a) * 12]], 'rgba(90,240,255,.9)', 1); }
    }
    if (f.state === 'kspin' && f.t >= 2) {   // même glow et mêmes éclairs que la roulade de Grog (haut + A)
      const cx = f.x, cy = f.y - 40, g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 60);
      g.addColorStop(0, 'rgba(168,244,255,.55)'); g.addColorStop(.5, 'rgba(47,140,255,.3)'); g.addColorStop(1, 'rgba(20,60,196,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 62, cy - 62, 124, 124);
      for (let b = 0; b < 4; b++) { const a0 = Math.random() * 6.28, L = []; for (let s2 = 0; s2 <= 4; s2++) L.push([cx + Math.cos(a0 + s2 * .5) * (14 + s2 * 6), cy + Math.sin(a0 + s2 * .5) * (18 + s2 * 6)]); elecArc(L, b % 2 ? 'rgba(168,244,255,.9)' : 'rgba(47,180,255,.9)', 1.3); }
    }
    if (f.state === 'nyxspin') {   // Nyx : même glow et mêmes éclairs que Grog (haut + A), en rose
      const cx = f.x, cy = f.y - 40, g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 60);
      g.addColorStop(0, 'rgba(255,190,240,.55)'); g.addColorStop(.5, 'rgba(240,70,180,.3)'); g.addColorStop(1, 'rgba(160,20,140,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 62, cy - 62, 124, 124);
      for (let b = 0; b < 4; b++) { const a0 = Math.random() * 6.28, L = []; for (let s2 = 0; s2 <= 4; s2++) L.push([cx + Math.cos(a0 + s2 * .5) * (14 + s2 * 6), cy + Math.sin(a0 + s2 * .5) * (18 + s2 * 6)]); elecArc(L, b % 2 ? 'rgba(255,200,245,.9)' : 'rgba(255,80,200,.9)', 1.3); }
    }
    if (f.state === 'kbarrage' && f.t < 30 && f.handW) {   // rafale : éclairs devant le poing
      const [hx2, hy2] = f.handW;
      for (let b = 0; b < 3; b++) { const a = (Math.random() - .5) * 1.2; elecArc([[hx2, hy2], [hx2 + f.dir * 8, hy2 + Math.sin(a) * 6], [hx2 + f.dir * 18, hy2 + Math.sin(a) * 12]], 'rgba(160,245,255,.95)', 1.2); }
    }
    if (f.def.kit === 'kael' && f.state === 'uppercut' && f.t >= 3 && f.t < 30 && f.handW) {   // colonne de plasma autour du poing
      const [hx2, hy2] = f.handW, a = Math.min(1, (30 - f.t) / 10);
      ctx.globalAlpha = a;
      for (let k = 0; k < 14; k++) {
        const t = k / 13, y = hy2 + t * (f.y - hy2 + 6), w = 6 + t * 10 + Math.sin(G.frame * .6 + k) * 3, x = hx2 + Math.sin(G.frame * .4 + k * .8) * 3 * t;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, w); gr.addColorStop(0, 'rgba(255,255,255,.7)'); gr.addColorStop(.5, 'rgba(90,200,255,.45)'); gr.addColorStop(1, 'rgba(20,90,200,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, w, 0, Math.PI * 2); ctx.fill();
      }
      for (let b = 0; b < 3; b++) { const L = []; for (let s2 = 0; s2 <= 6; s2++) L.push([hx2 + (Math.random() - .5) * 14, hy2 + (f.y - hy2) * s2 / 6]); elecArc(L, 'rgba(200,250,255,.8)', 1.2); }
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
/* ---------- Nyx : fioles, flaques de feu, fumée, geysers ---------- */
const FLASK_HIT = { dmg: 7, stun: 16, bstun: 10, push: 1.8, chip: 1, sfx: 'hit' };
const PUDDLE_HIT = { dmg: 3, stun: 10, bstun: 6, push: .6, chip: 0, sfx: 'hit', unblock: true };
const GEYSER_HIT = { dmg: 12, knock: true, lift: 7, bstun: 14, push: 2, chip: 2, sfx: 'heavy' };
const NYX_FIRE = ['#ffffff', '#ffb0e0', '#e0306a', '#6a0a8a'];
const SMOKE_T = 120;
const FLIP_S = 1.35;   // vitesse du salto coup de pied d'Hiro / Axel (arrière + A)
const GEYSER_L = 205;   // longueur de la gerbe de flammes (haut + A) : atteint un adversaire au sommet de son saut   // la fumée de confusion ne dure que 2 secondes
function addPuddle(owner, x, done) {
  const mine = G.puddles.filter(p => p.owner === owner); if (mine.length >= 2) mine[0].t = 9999;
  G.puddles.push({ owner, x, t: 0, last: -99, done: !!done }); sfx('fb');
}
function nyxIgnite(o) { o.nyxBurnT = 180; o.burn = Math.max(o.burn || 0, 180); o.burnPal = NYX_FIRE; }   // enflammé 3 s : perd un peu d'énergie, bouge normalement
function nyxPuff(f) { (G.tpuffs = G.tpuffs || []).push({ x: f.x + (Math.random() - .5) * 26, y: f.y - 10 - Math.random() * 70, vx: (Math.random() - .5) * .8, vy: -.4 - Math.random() * .6, r: 5 + Math.random() * 6, t: 0, c: ['170,140,220', '130,190,120', '190,170,230'][Math.random() * 3 | 0] }); }
const SNAKE_HIT = { dmg: 9, stun: 18, bstun: 12, push: 4, chip: 1, sfx: 'heavy' }, SNAKE_BIG = { dmg: 15, knock: true, stun: 22, bstun: 16, push: 7, chip: 3, sfx: 'heavy' };
function updSnakes() {   // serpent électrique rose de Nyx : avance en ondulant, aussi vite que la boule de Kael
  for (const q of G.snakes || []) {
    q.t++; q.x += q.dir * 8; q.dist += 8; q.y = q.y0 + Math.sin(q.t * .28) * (q.big ? 16 : 11);
    q.pts.unshift([q.x, q.y]); if (q.pts.length > (q.big ? 26 : 18)) q.pts.pop();
    if (q.dist > q.max) { q.dead = true; (G.clashFx = G.clashFx || []).push({ x: q.x, y: q.y, t: 0 }); addSpark(q.x, q.y, 'parry'); sfx('parry'); }   // demi-serpent : petit éclat au bout quand il s'arrête
    else if (q.x < (G.camL || 0) - 120 || q.x > (G.camL || 0) + W + 120) q.dead = true;
    const o = G.f.find(g => g !== q.owner); if (q.dead || !o || o.ko) continue;
    const hb = hurtbox(o), r = q.big ? 16 : 12;
    if (hb && !underShot(o) && overlap([q.x - r, q.y - r, q.x + r, q.y + r], hb)) { q.dead = true; applyHit(q.owner, o, q.big ? SNAKE_BIG : SNAKE_HIT, q.x, q.y, q.x - q.dir * 10, true); addSpark(q.x, q.y, 'parry'); }
  }
  if (G.snakes) G.snakes = G.snakes.filter(q => !q.dead);
}
function drawSnakes() {
  for (const f of G.f) if (f.state === 'nyxcharge') {   // énergie rose qui grossit dans la main
    const k = Math.min(1, f.chargeT / 78), hx = f.x + f.dir * 20, hy = f.y - 58;
    glowAt(hx, hy, 10 + 22 * k, 'rgba(255,74,200,.95)', .4 + .4 * k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < 2 + Math.round(5 * k); i++) { let px = hx, py = hy, a = Math.random() * 6.28; const L = [[px, py]]; for (let j = 0; j < 3; j++) { a += (Math.random() - .5) * 1.4; const l = 4 + 6 * k; px += Math.cos(a) * l; py += Math.sin(a) * l; L.push([px, py]); } elecArc(L, 'rgba(255,74,200,.9)', 2); elecArc(L, '#ffe0f8', .8); }
    ctx.restore();
  }
  for (const q of G.snakes || []) {
    const P = q.pts; if (P.length < 2) continue;
    const W0 = q.big ? 13 : 9;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = P.length - 1; i >= 1; i--) {   // corps : segments de plus en plus fins vers la queue
      const k = 1 - i / P.length, wdt = 2 + W0 * k;
      ctx.strokeStyle = `rgba(200,30,160,${.35 * k + .1})`; ctx.lineWidth = wdt * 1.8; ctx.beginPath(); ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[i - 1][0], P[i - 1][1]); ctx.stroke();
      ctx.strokeStyle = `rgba(255,90,210,${.7 * k + .2})`; ctx.lineWidth = wdt; ctx.stroke();
      ctx.strokeStyle = `rgba(255,224,248,${.8 * k})`; ctx.lineWidth = Math.max(1, wdt * .3); ctx.stroke();
    }
    for (let e = 0; e < 3; e++) elecArc(P.filter((_, i) => i % 2 === 0).map(([x, y]) => [x, y + (Math.random() - .5) * W0]), e ? '#ffd0f4' : 'rgba(255,74,200,.9)', e ? .8 : 1.6);   // éclairs le long du corps
    const hx = q.x, hy = q.y, hr = W0 * .9;   // tête
    glowAt(hx, hy, hr * 3, 'rgba(255,74,200,.95)', .7);
    ctx.fillStyle = '#ff5ad2'; ctx.beginPath(); ctx.ellipse(hx + q.dir * 2, hy, hr * 1.4, hr, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#fff0fb'; ctx.beginPath(); ctx.ellipse(hx + q.dir * 4, hy - 1, hr * .8, hr * .5, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(hx + q.dir * hr * .9) - 1, Math.round(hy - hr * .5) - 1, 3, 2);   // œil
    ctx.restore();
  }
}
function updNyx() {
  updSnakes();
  for (const q of G.tpuffs || []) { q.t++; q.x += q.vx; q.y += q.vy; q.r += .35; }
  if (G.tpuffs) G.tpuffs = G.tpuffs.filter(q => q.t < 28);
  for (const q of G.flasks || []) {
    const o = G.f.find(f => f !== q.owner);
    q.t++; q.x += q.vx; q.y += q.vy; if (!q.straight) q.vy += .22;   // en cloche (au sol) ou en ligne droite (en l'air)
    for (const pr of G.props || []) if (pr.alive && pr.fly && pr.fly.owner !== q.owner && Math.hypot(pr.x - q.x, pr.y - q.y) < 18) {   // fiole contre objet du décor lancé : les deux s'annulent
      q.dead = true; breakProp(pr); (G.clashFx = G.clashFx || []).push({ x: (pr.x + q.x) / 2, y: (pr.y + q.y) / 2, t: 0 }); G.flashT = Math.max(G.flashT, 3); G.shake = Math.max(G.shake, 4); sfx('parry'); sfx('heavy'); break;
    }
    if (q.dead) continue;
    if (o && hurtbox(o) && !underShot(o) && Math.abs(o.x - q.x) < 14 && q.y > o.y - 80 && q.y < o.y) { q.dead = true; applyHit(q.owner, o, FLASK_HIT, q.x, q.y, q.x - q.vx * 4, true); addPuddle(q.owner, o.x, true); nyxIgnite(o); continue; }
    if (q.y >= GROUND - 3) { q.dead = true; addPuddle(q.owner, q.x); addSpark(q.x, GROUND - 6, 'fb', NYX_FIRE); }
    if (q.x < (G.camL || 0) - 30 || q.x > (G.camL || 0) + W + 30) q.dead = true;
  }
  if (G.flasks) G.flasks = G.flasks.filter(q => !q.dead);
  for (const p of G.puddles || []) {   // flaque de feu : brûle l'adversaire qui marche dedans
    p.t++; const o = G.f.find(f => f !== p.owner);
    if (!p.done && o && !o.air && o.state !== 'tatsu' && o.state !== 'gtatsu' && Math.abs(o.x - p.x) < 20 && hurtbox(o)) {   // le tatsumaki passe au-dessus de la flamme   // un seul coup, puis l'adversaire est enflammé
      p.done = true; applyHit(p.owner, o, PUDDLE_HIT, o.x, GROUND - 14, p.x, true); nyxIgnite(o);
    }
  }
  if (G.puddles) G.puddles = G.puddles.filter(p => p.t < 300);
  for (const f of G.f) {   // échos roses derrière Nyx quand elle plane
    if (f.def.kit !== 'nyx') continue;
    if (f.state === 'nslide' && f.t < 26) { (f.echo = f.echo || []).push({ x: f.x, y: f.y, state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air, roll: f.roll }); if (f.echo.length > 7) f.echo.shift(); }
    else if (f.state === 'nyxglide' || f.state === 'nyxspin') { if (G.frame % 2 === 0) { (f.echo = f.echo || []).push({ x: f.x, y: f.y, state: f.state, t: f.t, rotAng: f.rotAng, dir: f.dir, vx: f.vx, air: f.air, roll: f.roll }); if (f.echo.length > 7) f.echo.shift(); } }
    else if (f.echo && f.echo.length && f.state !== 'bflip') f.echo.shift();
  }
  for (const f of G.f) if (f.nyxBurnT > 0) {   // brûlure rose : petite perte d'énergie continue
    f.nyxBurnT--; f.burn = Math.max(f.burn || 0, 2); f.burnPal = NYX_FIRE;
    if (G.scene === 'fight' && f.hp > 1) { f.hp = Math.max(1, f.hp - .035); f.lagT = 30; }
  }
  for (const c of G.smokes || []) {   // nuage toxique : aveugle l'adversaire et arrête ses projectiles
    if (c.dead) continue;
    c.owner.smokeLast = G.frame;
    c.t++; if (c.t < 90) c.x += c.dir * 1.3; const o = G.f.find(f => f !== c.owner), R = 38 + Math.min(18, c.t * .7);   // la fumée avance plus loin
    if (o && !o.air && Math.abs(o.x - c.x) < R) {   // seulement au sol : en sautant on passe au-dessus sans être touché ; pas de dégât : coupe le coup spécial, 1 s au ralenti sans spécial, puis confusion
      if (!(o.confT > 0)) {
        addPopup(o.x, o.y - 100, 'CONFUSED!', '#c8a0ff'); sfx('parry');
        o.slowT = 60; o.noSpecT = 60; o.confT = 240;
      }
      if (!CALM_ST.includes(o.state)) { if (o.air) { setState(o, 'jump'); o.airAtk = true; } else setState(o, 'idle'); o.vx = 0; }   // dans la fumée : tout coup spécial s'arrête
      o.confT = Math.max(o.confT, 180);
    }   // brume : inverse directions et boutons
    // fumée contre boule de feu / clone / projectile d'énergie : les deux s'annulent
    const hitSmoke = (q, x, y) => { c.dead = true; (G.clashFx = G.clashFx || []).push({ x, y, t: 0 }); G.flashT = Math.max(G.flashT, 3); G.shake = Math.max(G.shake, 4); sfx('parry'); };
    for (const fb of G.fbs || []) if (!c.dead && fb.alive && fb.owner !== c.owner && Math.abs(fb.x - c.x) < R) { if (!fb.big) { fb.alive = false; if (fb.owner.fb === fb) fb.owner.fb = null; } hitSmoke(fb, fb.x, fb.y); }
    for (const q of G.blades || []) if (!c.dead && !q.dead && q.owner !== c.owner && Math.abs(q.x - c.x) < R) { q.dead = true; hitSmoke(q, q.x, q.y); }
    for (const q of G.holos || []) if (!c.dead && !q.dead && q.owner !== c.owner && Math.abs(q.x - c.x) < R) { q.dead = true; hitSmoke(q, q.x, q.y - 50); }
    for (const q of G.flasks || []) if (!c.dead && !q.dead && q.owner !== c.owner && Math.abs(q.x - c.x) < R) { q.dead = true; hitSmoke(q, q.x, q.y); }
    for (const q of G.voids || []) if (!c.dead && !q.dead && !q.charging && q.owner !== c.owner && Math.abs(q.x - c.x) < R + (q.r || 0)) { q.dead = true; hitSmoke(q, q.x, q.y); }
    for (const q of G.sonics || []) if (!c.dead && !q.dead && q.owner !== c.owner && Math.abs(q.x - c.x) < R) { q.dead = true; hitSmoke(q, q.x, q.y); }
  }
  if (G.smokes) G.smokes = G.smokes.filter(c => c.t < SMOKE_T && !c.dead);
  for (const f of G.f) if (f.confT > 0) f.confT--;
  for (const g of G.geysers || []) {   // gerbe de flammes en diagonale : piège ceux qui sautent
    g.t++; const o = G.f.find(f => f !== g.owner), L = Math.min(1, g.t / 9) * GEYSER_L;   // monte assez haut pour toucher ceux qui sautent
    if (!g.done && o && hurtbox(o) && g.t < 26) {
      const ex = g.x + g.dir * L * .5, ey = GROUND - L * .87, px = o.x, py = o.y - 40;
      const vx = ex - g.x, vy = ey - GROUND, k = Math.max(0, Math.min(1, ((px - g.x) * vx + (py - GROUND) * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(px - (g.x + vx * k), py - (GROUND + vy * k)) < 24) { g.done = true; applyHit(g.owner, o, GEYSER_HIT, px, py, g.x, true); o.burn = 60; o.burnPal = NYX_FIRE; }
    }
  }
  if (G.geysers) G.geysers = G.geysers.filter(g => g.t < 34);
}
function drawNyxFx() {
  for (const q of G.tpuffs || []) {   // petite fumée de téléportation (couleurs de la fumée de confusion)
    const a = .55 * (1 - q.t / 28), g = ctx.createRadialGradient(q.x, q.y, 1, q.x, q.y, q.r);
    g.addColorStop(0, `rgba(${q.c},${a})`); g.addColorStop(1, `rgba(${q.c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of G.puddles || []) {   // flaque de feu chimique au sol
    const a = Math.min(1, (300 - p.t) / 40);
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, GROUND, 2, p.x, GROUND, 26); g.addColorStop(0, 'rgba(255,90,160,.5)'); g.addColorStop(1, 'rgba(110,10,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, GROUND, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const life = ((G.frame * 1.8 + i * 11) % 30) / 30, x = p.x - 18 + i * 4.5 + Math.sin(G.frame * .3 + i) * 1.5, y = GROUND - 1 - life * 16, rr = Math.max(1, Math.round(3.5 * (1 - life)));
      ctx.fillStyle = life < .3 ? '#ffe0f0' : life < .6 ? '#ff4a9a' : '#9a2ad0'; ctx.fillRect(Math.round(x) - rr, Math.round(y) - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }
  for (const q of G.flasks || []) {   // fiole de poison rose, plus grande, qui tourne en vol
    const x = q.x, y = q.y, ang = q.t * .32 * Math.sign(q.vx || 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';   // halo rose
    const hg = ctx.createRadialGradient(x, y, 1, x, y, 16); hg.addColorStop(0, 'rgba(255,90,180,.45)'); hg.addColorStop(1, 'rgba(160,20,140,0)'); ctx.fillStyle = hg; ctx.fillRect(x - 16, y - 16, 32, 32);
    ctx.restore();
    for (let i = 1; i <= 3; i++) { ctx.save(); ctx.globalAlpha = .45 - i * .12; R(x - q.vx * i * 2.2 - 1, y - q.vy * i * 2.2 - 1, 3, 3, i % 2 ? '#ff4aa8' : '#c83aff'); ctx.restore(); }   // gouttes roses derrière
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#10141a'; ctx.beginPath(); ctx.arc(0, 2, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-3, -9, 6, 7);   // contour du verre
    ctx.fillStyle = '#ff3a9a'; ctx.beginPath(); ctx.arc(0, 2, 5.5, 0, Math.PI * 2); ctx.fill();   // poison rose
    ctx.fillStyle = '#ff9ad0'; ctx.beginPath(); ctx.arc(0, 2, 5.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();   // surface claire
    ctx.fillStyle = '#c0d8e0'; ctx.fillRect(-2, -8, 4, 6);   // goulot en verre
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-2.5, -11, 5, 3);   // bouchon
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-3.5, -1, 2, 2); ctx.fillRect(-1.5, -6, 1, 3);   // reflets
    ctx.fillStyle = '#ffe0f0'; ctx.fillRect(2 + Math.sin(q.t * .5) * 1.2, 3, 1.5, 1.5);   // bulle
    ctx.restore();
  }
  for (const c of G.smokes || []) {   // brume toxique animée : volutes douces qui ondulent et se déroulent
    const a = Math.max(0, Math.min(1, c.t / 10, (SMOKE_T - c.t) / 30)), R2 = 38 + Math.min(18, c.t * .7);
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const ph = i * 2.39, sp = .015 + (i % 5) * .004, t = c.t * sp + ph;
      const px = c.x + Math.sin(t) * R2 * .75 + Math.sin(t * 2.3 + i) * 6, py = GROUND - 8 - ((i * 13 + c.t * (.25 + (i % 3) * .1)) % 95);
      const rr = R2 * (.3 + .18 * Math.sin(t * 1.7 + i) + (i % 4) * .05), al = a * (.34 + .12 * Math.sin(t * 2 + i)) * Math.min(1, (95 - (GROUND - 8 - py)) / 30 + .2);
      const col = i % 3 === 0 ? '170,140,220' : i % 3 === 1 ? '130,190,120' : '190,170,230';
      const g = ctx.createRadialGradient(px, py, 1, px, py, rr); g.addColorStop(0, `rgba(${col},${Math.max(0, al)})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = .5 * a; ctx.strokeStyle = 'rgba(220,200,255,.7)'; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {   // fines volutes
      ctx.beginPath(); const y0 = GROUND - 20 - k * 16, ph = c.t * .05 + k;
      for (let s2 = 0; s2 <= 12; s2++) { const xx = c.x - R2 * .8 + s2 * R2 * .13, yy = y0 + Math.sin(ph + s2 * .6) * 4; s2 ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    const fg = ctx.createRadialGradient(c.x, GROUND - 4, 2, c.x, GROUND - 4, R2 * 1.1); fg.addColorStop(0, `rgba(160,200,140,${.35 * a})`); fg.addColorStop(1, 'rgba(160,200,140,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(c.x, GROUND - 4, R2 * 1.1, 12, 0, 0, Math.PI * 2); ctx.fill();   // nappe au sol
    ctx.restore();
  }
  for (const g of G.geysers || []) {   // gerbe de flammes violettes
    const L = Math.min(1, g.t / 9) * GEYSER_L, a = Math.min(1, (34 - g.t) / 10);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    for (let i = 0; i < 32; i++) {
      const k = i / 31, d2 = k * L, x = g.x + g.dir * d2 * .5 + Math.sin(G.frame * .5 + i) * 3, y = GROUND - d2 * .87, rr = 3 + (1 - k) * 7 + Math.sin(G.frame * .7 + i * 2) * 1.5;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.6); gr.addColorStop(0, 'rgba(255,220,255,.9)'); gr.addColorStop(.4, 'rgba(200,58,255,.7)'); gr.addColorStop(1, 'rgba(90,10,140,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
function drawBlind() {   // joueur humain aveuglé : l'écran s'assombrit
  for (const f of G.f) {   // confusion : spirale violette et points d'interrogation qui tournent au-dessus de la tête
    if (!(f.confT > 0)) continue;
    const cy = f.y - (f.state === 'crouch' ? 66 : 96), a = Math.min(1, f.confT / 30);
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(200,160,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = 0; k <= 30; k++) { const t = k / 30 * Math.PI * 4 + G.frame * .15, rr = 2 + k * .35; ctx.lineTo(f.x + Math.cos(t) * rr * 1.6, cy + Math.sin(t) * rr * .5); }
    ctx.stroke();
    for (let k = 0; k < 3; k++) { const t = G.frame * .08 + k * 2.1; text('?', f.x + Math.cos(t) * 14, cy - 4 + Math.sin(t) * 4, 8, k % 2 ? '#e0c0ff' : '#9adf6a', 'center'); }
    ctx.restore();
  }
}
/* ---------- Zephyr : lames d'air et bourrasques ---------- */
const BLADE_HIT = { dmg: 9, stun: 18, bstun: 12, push: 2.4, chip: 1, sfx: 'hit' };
function updZephyr() {
  for (const q of G.blades || []) {
    const o = G.f.find(f => f !== q.owner);
    q.t++; q.x += q.dir * 5.6;
    if (q.x < (G.camL || 0) - 30 || q.x > (G.camL || 0) + W + 30) q.dead = true;
    if (q.dead || !o) continue;
    const hb = hurtbox(o);
    if (hb && !underShot(o) && Math.abs(o.x - q.x) < 18 && o.y - 80 < q.y + 20 && o.y > q.y - 20) { q.dead = true; applyHit(q.owner, o, BLADE_HIT, q.x, q.y, q.x - q.dir * 10, true); }
  }
  for (const q of G.blades || []) {   // deux croissants (ou un croissant et une boule de feu) qui se croisent s'annulent
    if (q.dead) continue;
    for (const q2 of G.blades) if (q2 !== q && !q2.dead && q2.owner !== q.owner && Math.abs(q2.x - q.x) < 26 && Math.abs(q2.y - q.y) < 30) {
      q.dead = q2.dead = true; addSpark((q.x + q2.x) / 2, q.y, 'parry'); G.flashT = Math.max(G.flashT, 4); sfx('parry');
    }
    for (const fb of G.fbs || []) if (!q.dead && fb.alive && fb.owner !== q.owner && Math.abs(fb.x - q.x) < 26 && Math.abs(fb.y - q.y) < 30) {
      q.dead = true; if (!fb.big) { fb.alive = false; if (fb.owner) fb.owner.fb = null; } addSpark((q.x + fb.x) / 2, q.y, 'parry'); sfx('parry');
    }
  }
  if (G.blades) G.blades = G.blades.filter(q => !q.dead);
  for (const f of G.f) {   // Cyclone Rétrograde : aspire l'adversaire et brise son élan
    if (!(f.pullT > 0)) continue;
    f.pullT--;
    const o = G.f.find(x => x !== f);
    if (o && !o.air && Math.abs(o.x - f.x) < 230 && Math.abs(o.x - f.x) > 34 && !['down', 'held', 'throw', 'getup'].includes(o.state)) {
      o.x -= Math.sign(o.x - f.x) * 2.4;
      if (o.state === 'walk') o.vx = 0;
    }
  }
}
const SWORD_SPECIAL = ['gust', 'tornado', 'plunge', 'hover', 'cyclone', 'sink'];
function drawZephyrFx() {
  for (const f of G.f) {   // traînée du sabre : transparente sur les coups normaux, bleue sur les coups spéciaux
    if (!f.def.sword) continue;
    const swinging = f.swSeg && f.rotAng == null && (ATTACKING.includes(f.state) || ['jpunch', 'jkick', 'hover'].includes(f.state)) && !['idle', 'walk', 'tornado'].includes(f.state);
    f.swTrail = f.swTrail || [];
    if (swinging && G.frame !== f.swLastF) { f.swTrail.push(f.swSeg); f.swLastF = G.frame; }
    else if (!swinging) f.swTrail.shift();
    if (f.state === 'wallslash' && f.t > 14 && G.frame % 3) { /* la traînée reste affichée : effet de mur */ } else while (f.swTrail.length > (f.state === 'wallslash' ? 16 : 10)) f.swTrail.shift();
    const T = f.swTrail; if (T.length < 2) continue;
    const special = SWORD_SPECIAL.includes(f.state);
    ctx.save(); if (special) ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < T.length; i++) {
      const a = i / T.length;
      ctx.fillStyle = special ? `rgba(70,170,255,${.75 * a})` : `rgba(255,255,255,${.5 * a})`;
      ctx.beginPath(); ctx.moveTo(T[i - 1][0][0], T[i - 1][0][1]); ctx.lineTo(T[i - 1][1][0], T[i - 1][1][1]); ctx.lineTo(T[i][1][0], T[i][1][1]); ctx.lineTo(T[i][0][0], T[i][0][1]); ctx.closePath(); ctx.fill();
      if (special) { ctx.strokeStyle = `rgba(200,240,255,${.7 * a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(T[i - 1][1][0], T[i - 1][1][1]); ctx.lineTo(T[i][1][0], T[i][1][1]); ctx.stroke(); }
    }
    ctx.restore();
  }
  for (const f of G.f) {   // mur de lumière laissé par le grand coup de sabre
    if (!(f.wallT > 0)) continue;
    if (!G.freeze) f.wallT--;
    const a = f.wallT / 26, x = f.wallX, top = f.y - 96;
    ctx.save();
    const g = ctx.createLinearGradient(x - f.dir * 14, 0, x + f.dir * 6, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.7, `rgba(255,255,255,${.35 * a})`); g.addColorStop(1, `rgba(255,255,255,${.6 * a})`);
    ctx.fillStyle = g; ctx.fillRect(Math.min(x - f.dir * 14, x + f.dir * 6), top, 20, f.y - top);
    ctx.fillStyle = `rgba(255,255,255,${.8 * a})`; ctx.fillRect(Math.round(x + f.dir * 5) - 1, top + 4, 2, f.y - top - 4);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = `rgba(220,240,255,${.5 * a})`; ctx.fillRect(Math.round(x - f.dir * (3 + k * 3)), top + 10 + ((G.frame * 3 + k * 23) % 80), 1, 8); }
    ctx.fillStyle = `rgba(200,180,140,${.5 * a})`; ctx.fillRect(Math.round(x) - 10, f.y - 2, 20, 2);   // poussière au sol
    ctx.restore();
  }
  for (const f of G.f) {   // éclairs au sol pendant la descente / la remontée
    if (f.state !== 'sink') continue;
    const k = f.t <= 21 ? Math.min(1, f.t / 6) : Math.max(0, 1 - (f.t - 21) / 22);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const g = ctx.createRadialGradient(f.x, GROUND, 2, f.x, GROUND, 34);
    g.addColorStop(0, `rgba(200,240,255,${.6 * k})`); g.addColorStop(.5, `rgba(47,180,255,${.35 * k})`); g.addColorStop(1, 'rgba(20,88,196,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, GROUND, 34, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = k;
    for (let b = 0; b < 5; b++) {   // arcs électriques qui montent du sol autour du corps
      const bx = f.x + (Math.random() - .5) * 34, top = GROUND - 20 - Math.random() * 60 * (1 - (f.sinkK || 0) * .6), L = [];
      for (let s2 = 0; s2 <= 5; s2++) L.push([bx + (Math.random() - .5) * 8, GROUND - (GROUND - top) * s2 / 5]);
      elecArc(L, 'rgba(47,180,255,.9)', 2.5); elecArc(L, '#ffffff', 1);
    }
    const ring = []; for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI * 2; ring.push([f.x + Math.cos(t) * 24, GROUND + Math.sin(t) * 6]); }
    elecArc(ring, 'rgba(120,220,255,.9)', 1.5);
    ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const q of G.blades || []) {   // grand croissant électrique avec halo
    const cx = q.x - q.dir * 12, R = 24, a0 = q.dir > 0 ? -1.15 : Math.PI - 1.15, a1 = a0 + 2.3;
    const g = ctx.createRadialGradient(q.x, q.y, 2, q.x, q.y, 34);
    g.addColorStop(0, 'rgba(200,245,255,.45)'); g.addColorStop(.5, 'rgba(47,180,255,.25)'); g.addColorStop(1, 'rgba(20,88,196,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 34, 0, Math.PI * 2); ctx.fill();
    for (const [r2, col, lw] of [[R + 1, 'rgba(20,88,196,.8)', 8], [R, 'rgba(47,180,255,.95)', 5], [R - 1, 'rgba(168,244,255,1)', 2.5], [R - 1, '#ffffff', 1.2]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, q.y, r2, a0, a1); ctx.stroke();
    }
    const pts = []; for (let i2 = 0; i2 <= 12; i2++) { const t = a0 + i2 / 12 * 2.3; pts.push([cx + Math.cos(t) * (R + 3), q.y + Math.sin(t) * (R + 3)]); }
    elecArc(pts, 'rgba(200,245,255,.9)', 1.2);   // éclairs le long du croissant
    for (let b = 0; b < 3; b++) { const t = a0 + Math.random() * 2.3, x0 = cx + Math.cos(t) * R, y0 = q.y + Math.sin(t) * R; elecArc([[x0, y0], [x0 - q.dir * 6, y0 + (Math.random() - .5) * 8], [x0 - q.dir * 13, y0 + (Math.random() - .5) * 12]], 'rgba(120,220,255,.8)', 1); }
  }
  for (const f of G.f) {
    if (f.pullT > 0) {   // bourrasque frontale : traits de vent qui convergent vers Zephyr
      ctx.strokeStyle = `rgba(200,250,255,${.25 + .4 * f.pullT / 40})`; ctx.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) {
        const ph = ((G.frame * 6 + k * 37) % 120) / 120, len = 26;
        const x0 = f.x + f.dir * (150 - ph * 130), y0 = f.y - 14 - k * 12 + Math.sin(G.frame * .2 + k) * 3;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + f.dir * len, y0 + 2); ctx.stroke();
      }
    }
  }
  ctx.restore();
}
// Deux projectiles adverses qui se rencontrent s'écrasent et s'annulent avec un flash au milieu
function clashProjectiles() {
  const L = [];
  for (const q of G.fbs || []) if (q.alive) L.push([q, q.y, 16 * (q.sc || 1)]);
  for (const q of G.blades || []) if (!q.dead) L.push([q, q.y, 18]);
  for (const q of G.sonics || []) if (!q.dead) L.push([q, q.y, 16]);
  for (const q of G.voids || []) if (!q.dead && !q.charging) L.push([q, q.y, q.r || 14]);
  for (const q of G.flasks || []) if (!q.dead) L.push([q, q.y, 13]);
  for (const q of G.snakes || []) if (!q.dead) L.push([q, q.y, q.big ? 16 : 12]);   // serpent de Nyx   // fiole de Nyx : s'annule avec boules de feu, clones, sphères...
  for (const q of G.holos || []) if (!q.dead) L.push([q, q.y - 50, 16, 'h']);   // clone énergétique de Vesper = projectile
  for (const q of G.waves || []) if (!q.dead && !q.ring && !q.small) L.push([q, GROUND - 16, 14, 'w']);   // onde au sol de Grog : passe sous les boules de feu, s'annule avec un clone
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const [a, ay, ar, ka] = L[i], [b, by, br, kb] = L[j];
    if ((ka === 'w') !== (kb === 'w') && (ka === 'w' ? kb : ka) !== 'h') continue;
    if (!a.owner || !b.owner || a.owner === b.owner || a.dead || b.dead || a.alive === false || b.alive === false) continue;
    if (Math.abs(a.x - b.x) < ar + br && Math.abs(ay - by) < ar + br + 16) {
      const pa = shotPow(a), pb = shotPow(b);   // la plus forte continue, à force égale les deux s'annulent
      for (const q of [a, b]) { if (shotPow(q) < Math.max(pa, pb)) { /* perd */ } else if (pa !== pb) continue; if ('alive' in q) q.alive = false; q.dead = true; if (q.mate) { q.mate.alive = false; q.mate.dead = true; } if (q.owner.fb === q) q.owner.fb = null; }
      (G.clashFx = G.clashFx || []).push({ x: (a.x + b.x) / 2, y: (ay + by) / 2, t: 0 });
      G.flashT = Math.max(G.flashT, 3); G.shake = Math.max(G.shake, 4); G.freeze = Math.max(G.freeze || 0, 4); sfx('parry'); sfx('heavy');
    }
  }
  for (const c of G.clashFx || []) c.t++;
  if (G.clashFx) G.clashFx = G.clashFx.filter(c => c.t < 20);
}
function drawClashFx() {
  for (const c of G.clashFx || []) {
    const k = c.t / 20, a = 1 - k, R0 = 8 + c.t * 3.2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, R0 * 1.6); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.35, `rgba(255,230,150,${.7 * a})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R0 * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, R0, 0, Math.PI * 2); ctx.stroke();
    for (let r = 0; r < 10; r++) { const an = r * .628 + c.t * .05, l1 = R0 * .6, l2 = R0 * (1.4 + (r % 2) * .5); ctx.strokeStyle = `rgba(255,240,200,${a})`; ctx.lineWidth = r % 2 ? 1 : 2; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(an) * l1, c.y + Math.sin(an) * l1); ctx.lineTo(c.x + Math.cos(an) * l2, c.y + Math.sin(an) * l2); ctx.stroke(); }
    ctx.restore();
  }
}
function updGrog() {
  for (const g of G.f) {   // Rempart : renvoie les projectiles comme un miroir
    if (g.def.kit !== 'grog' || g.state !== 'rburst' || g.t > 18) continue;   // seule l'explosion du dôme renvoie les boules de feu
    const mir = (q, vk) => { if (q.owner === g || q.dead || q.alive === false) return; const v = vk ? q[vk] : q.dir; if (Math.sign(v) !== Math.sign(g.x - q.x) || Math.abs(q.x - g.x) > 70) return;
      if (q.owner && q.owner.fb === q) q.owner.fb = null;
      q.owner = g; q.dir = -(q.dir || Math.sign(v)); if (vk) q[vk] = -q[vk]; if ('x0' in q) q.x0 = q.x; q.x = g.x + q.dir * 38; q.t = 0;
      addSpark(q.x, q.y || g.y - 50, 'parry'); sfx('parry'); G.flashT = Math.max(G.flashT, 4); G.freeze = Math.max(G.freeze || 0, 4);
      G.waves.push({ owner: g, x: g.x, dir: g.dir, t: 0, life: 12, small: true, ring: true, done: true });
    };
    for (const q of G.fbs || []) if (!q.big) mir(q, 'vx');   // la grosse boule de feu chargée gagne contre le dôme
    for (const q of G.blades || []) mir(q, null);
    for (const q of G.sonics || []) mir(q, null);
    // la grosse sphère de Lord Vane gagne contre le dôme : pas de renvoi
  }
  for (const w of G.waves || []) {
    const o = G.f.find(f => f !== w.owner);
    w.t++; if (!w.ring) w.x += w.dir * (w.speed || (w.small ? 3 : 4.2));
    if (w.t > w.life || w.x < (G.camL || 0) - 20 || w.x > (G.camL || 0) + W + 20) w.dead = true;
    if (w.dead || w.done || !o) continue;
    // fait trébucher l'adversaire s'il n'est pas en train de sauter
    if (!o.air && Math.abs(o.x - w.x) < (w.small ? 20 : 14) && hurtbox(o)) {
      w.done = true; if (!w.small) w.dead = true;
      applyHit(w.owner, o, w.small ? CRUSH_SHOCK : QUAKE_HIT, w.x, GROUND - 12, w.x - w.dir, true);
    }
  }
  if (G.waves) G.waves = G.waves.filter(w => !w.dead);
}
function elecArc(pts, col, w) {   // trait électrique en zigzag le long d'une suite de points
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
  pts.forEach(([x, y], k) => { const jx = (Math.random() - .5) * 3, jy = (Math.random() - .5) * 3; k ? ctx.lineTo(x + jx, y + jy) : ctx.moveTo(x, y); });
  ctx.stroke();
}
function grogArm(f, i0, i1) {   // position monde d'un point de squelette
  const P = POSES[poseOf(f)] || POSES.idle0, S = K * UP * (f.def.size || 1);
  return [i0, i1].map(i => [f.x + f.dir * P[i * 2] * S, f.y + P[i * 2 + 1] * S]);
}
function drawFireTrail() {   // John : le poing enflammé laisse une traînée de feu en écho
  for (const f of G.f) {
    if (!f.ftrail || !f.ftrail.length) continue;
    if (f.state !== 'uppercut' && f.state !== 'fjump') { f.ftrail.shift(); if (!f.ftrail.length) continue; }
    const pal = f.def.fb, T = f.ftrail;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    T.forEach((p, i) => {
      const k = (i + 1) / T.length, r = 4 + k * 9;
      if (i % 3 === 0 && i < T.length - 2) { ctx.save(); ctx.globalAlpha = .22 * k; drawFighter(Object.assign({}, f, { state: p.st || 'uppercut', t: p.t, flash: 0, tint: pal[2] }), p.bx, p.by); ctx.restore(); }   // écho orangé du corps
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r * 1.8); g.addColorStop(0, pal[1] + 'dd'); g.addColorStop(.45, pal[2] + '99'); g.addColorStop(1, pal[3] + '00');
      ctx.globalAlpha = k; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x + (Math.random() - .5) * 2, p.y - k * 2, r * 1.8, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }
}
function drawGrogFx() {   // ondes électriques bleues de Grog
  for (const f of G.f) {
    if (f.def.kit !== 'grog') continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    if (f.rampT > 0 && !f.rotAng) {   // bras électrisés pendant le Rempart (3 s)
      const fade = Math.min(1, f.rampT / 20);
      for (const [a, b] of [[1, 3], [3, 4], [1, 5], [5, 6]]) {
        const [p0, p1] = grogArm(f, a, b), L = []; for (let s2 = 0; s2 <= 4; s2++) L.push([p0[0] + (p1[0] - p0[0]) * s2 / 4 + (Math.random() - .5) * 6, p0[1] + (p1[1] - p0[1]) * s2 / 4 + (Math.random() - .5) * 6]);
        ctx.globalAlpha = fade; elecArc(L, 'rgba(20,120,255,.6)', 3.5); elecArc(L, 'rgba(168,244,255,.95)', 1.1);
      }
      for (const i of [4, 6]) { const [p] = grogArm(f, i, i), g = ctx.createRadialGradient(p[0], p[1], 1, p[0], p[1], 12); g.addColorStop(0, `rgba(168,244,255,${.7 * fade})`); g.addColorStop(1, 'rgba(20,88,196,0)'); ctx.fillStyle = g; ctx.fillRect(p[0] - 12, p[1] - 12, 24, 24); }
    }
    const air = (f.state === 'crush' && f.t >= 6) || f.state === 'crushD' || f.state === 'gpound' || (f.state === 'throw' && f.throwType === 'rocket' && f.t >= 6 && f.t < 53);
    if (air) {   // glow et électricité autour du corps (roulade, plongeon, fusée)
      const cx = f.x, cy = f.y - 40, g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 60);
      g.addColorStop(0, 'rgba(168,244,255,.55)'); g.addColorStop(.5, 'rgba(47,140,255,.3)'); g.addColorStop(1, 'rgba(20,60,196,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 62, cy - 62, 124, 124);
      for (let b = 0; b < 4; b++) { const a0 = Math.random() * 6.28, L = []; for (let s2 = 0; s2 <= 4; s2++) L.push([cx + Math.cos(a0 + s2 * .5) * (14 + s2 * 6), cy + Math.sin(a0 + s2 * .5) * (18 + s2 * 6)]); elecArc(L, b % 2 ? 'rgba(168,244,255,.9)' : 'rgba(47,180,255,.9)', 1.3); }
      const tr = f.state === 'throw' ? (f.t < 34 ? 1 : f.t >= 40 ? -1 : 0) : f.state === 'gpound' ? -1 : 0;   // traînée verticale de la fusée / météorite
      if (tr) for (let b = 0; b < 3; b++) { const ox = (b - 1) * 10, L = []; for (let s2 = 0; s2 <= 5; s2++) L.push([cx + ox + (Math.random() - .5) * 6, f.y + (tr > 0 ? s2 * 16 : -60 - s2 * 16)]); elecArc(L, 'rgba(47,180,255,.7)', 3); elecArc(L, '#ffffff', 1); }
      if (f.state === 'crushD') for (let b = 0; b < 3; b++) { const L = []; for (let s2 = 0; s2 <= 4; s2++) L.push([cx - f.dir * (10 + s2 * 12), cy - s2 * 13 + (b - 1) * 10]); elecArc(L, 'rgba(120,220,255,.8)', 2); }
    }
    ctx.restore();
  }
  for (const w of G.waves || []) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (w.dome) {   // dôme électrique qui éclate depuis le sol
      const k = w.t / w.life, a = 1 - k, gk = w.big ? 1.7 : 1, rx = 18 + w.t * 5.2 * gk, ry = 16 + w.t * 4.6 * gk, cx = w.x, cy = GROUND;
      const g = ctx.createRadialGradient(cx, cy - ry * .3, 2, cx, cy, Math.max(rx, ry));
      g.addColorStop(0, `rgba(220,250,255,${.55 * a})`); g.addColorStop(.6, `rgba(47,180,255,${.3 * a})`); g.addColorStop(1, 'rgba(20,88,196,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = a;
      for (const [sc, col, lw] of [[1, 'rgba(20,88,196,.9)', 6], [1, 'rgba(47,180,255,1)', 3], [1, '#ffffff', 1.2], [.7, 'rgba(168,244,255,.8)', 1.5]]) {
        const pts = []; for (let i = 0; i <= 26; i++) { const t = Math.PI + i / 26 * Math.PI; pts.push([cx + Math.cos(t) * rx * sc, cy + Math.sin(t) * ry * sc]); }
        elecArc(pts, col, lw);
      }
      const nb = w.big ? 11 : 6;
      for (let b = 0; b < nb; b++) {   // nervures électriques du dôme
        const t = Math.PI + (b + .5) / nb * Math.PI, L = []; for (let s2 = 0; s2 <= 4; s2++) L.push([cx + Math.cos(t) * rx * s2 / 4, cy + Math.sin(t) * ry * s2 / 4]);
        elecArc(L, 'rgba(168,244,255,.85)', w.big ? 1.8 : 1.2);
      }
      if (w.big) {   // dôme géant : 2e coque intérieure, éclairs qui jaillissent vers l'extérieur, étincelles
        const pts = []; for (let i = 0; i <= 22; i++) { const t = Math.PI + i / 22 * Math.PI; pts.push([cx + Math.cos(t) * rx * .55, cy + Math.sin(t) * ry * .55]); }
        elecArc(pts, 'rgba(47,180,255,1)', 2.5); elecArc(pts, '#ffffff', 1);
        for (let b = 0; b < 7; b++) {
          const t = Math.PI + Math.random() * Math.PI, L = []; let r = 1;
          for (let s2 = 0; s2 <= 4; s2++) { L.push([cx + Math.cos(t + (Math.random() - .5) * .25) * rx * r, cy + Math.sin(t) * ry * r]); r += .1 + Math.random() * .12; }
          elecArc(L, 'rgba(47,180,255,.9)', 3); elecArc(L, '#e8fcff', 1.1);
        }
        for (let i = 0; i < 10; i++) { const t = Math.PI + Math.random() * Math.PI; ctx.fillStyle = Math.random() < .5 ? '#ffffff' : '#7af0ff'; ctx.fillRect(Math.round(cx + Math.cos(t) * rx * (1 + Math.random() * .3)), Math.round(cy + Math.sin(t) * ry * (1 + Math.random() * .3)), 2, 2); }
        glowAt(cx, cy - ry * .4, Math.max(rx, ry) * .9, 'rgba(120,220,255,.9)', .35 * a);
      }
      ctx.fillStyle = `rgba(120,220,255,${.5 * a})`; ctx.fillRect(Math.round(cx - rx * 1.2), cy - 1, Math.round(rx * 2.4), 2);
      ctx.restore(); continue;
    }
    if (w.ring) {   // Rempart de Fer : onde de choc électrique qui part du corps
      const k = w.t / w.life, a = 1 - k, rx = 12 + w.t * 5, ry = 20 + w.t * 5.5, cx = w.x, cy = GROUND - 42;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, ry);
      g.addColorStop(0, `rgba(168,244,255,${.35 * a})`); g.addColorStop(.7, `rgba(47,180,255,${.18 * a})`); g.addColorStop(1, 'rgba(20,88,196,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      const pts = []; for (let i = 0; i <= 28; i++) { const t = i / 28 * Math.PI * 2; pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); }
      ctx.globalAlpha = a; elecArc(pts, 'rgba(20,88,196,.9)', 5); elecArc(pts, 'rgba(47,180,255,1)', 2.5); elecArc(pts, '#ffffff', 1);
      for (let b = 0; b < 4; b++) {   // éclairs qui jaillissent du centre
        const t = Math.random() * Math.PI * 2, L = [[cx, cy]]; for (let s2 = 1; s2 <= 4; s2++) L.push([cx + Math.cos(t) * rx * s2 / 4, cy + Math.sin(t) * ry * s2 / 4]);
        elecArc(L, 'rgba(168,244,255,.9)', 1.2);
      }
      ctx.restore(); continue;
    }
    // Impact Sismique : demi-mur d'énergie électrique qui court au sol vers l'adversaire
    const a = Math.min(1, (w.life - w.t) / 8, w.t / 3 + .3), H = w.small ? 18 : 32, R = w.small ? 9 : 13, x = w.x, y = GROUND;
    const g = ctx.createRadialGradient(x, y - H * .45, 2, x, y - H * .4, H * 1.1);
    g.addColorStop(0, `rgba(255,255,255,${.55 * a})`); g.addColorStop(.35, `rgba(120,220,255,${.45 * a})`); g.addColorStop(1, 'rgba(20,88,196,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R * 1.9, H * 1.15, 0, Math.PI, 0); ctx.fill();
    ctx.globalAlpha = a;
    for (const [rr, hh, col, lw] of [[R * 1.25, H, 'rgba(20,88,196,.9)', 5], [R, H * .9, 'rgba(47,180,255,1)', 3], [R * .75, H * .75, '#a8f4ff', 2], [R * .5, H * .55, '#ffffff', 1.2]]) {
      const pts = []; for (let i = 0; i <= 14; i++) { const t = Math.PI + i / 14 * Math.PI; pts.push([x + Math.cos(t) * rr + w.dir * Math.sin(i / 14 * Math.PI) * 3, y + Math.sin(t) * hh]); }
      elecArc(pts, col, lw);
    }
    for (let b = 0; b < 3; b++) {   // traînée d'étincelles derrière l'onde
      const bx = x - w.dir * (8 + Math.random() * 22), by = y - Math.random() * H * .6;
      ctx.fillStyle = Math.random() < .5 ? '#a8f4ff' : '#2fb4ff'; ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
    }
    ctx.fillStyle = `rgba(47,180,255,${.35 * a})`; ctx.fillRect(Math.round(w.dir > 0 ? x - 30 : x), y - 1, 30, 2);   // sillon lumineux au sol
    ctx.restore();
  }
}
function drawDiveTrail() {   // coup de pied plongeant de Vesper : électricité chaotique tout autour d'elle (remplace l'ancien trait néon)
  for (const f of G.f) if (f.state === 'dive' && f.t >= 3) {   // même effet que la vrille de Zephyr : corps en glow bleu + petits éclairs collés
    glowAt(f.x, f.y - 38, 50, 'rgba(90,200,255,.9)', .45);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .32 + .15 * Math.random(); drawFighter(Object.assign({}, f, { flash: 0, tint: 'rgba(110,210,255,1)' }), f.x, f.y); ctx.restore();
    zapChaos(f.x, f.y - 2, 22, 72, 9, .45);
  }
  if (G.frame >= 0) return;
  for (const f of G.f) {
    if (f.state !== 'dive' || !f.trail || f.trail.length < 2) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const T = f.trail.slice(-9);   // traînée électrique zigzag (même style que les éclairs de Grog)
    for (let b = 0; b < 2; b++) {
      const L = T.map(([x, y], i) => [x + (Math.random() - .5) * 7, y + (Math.random() - .5) * 7]);
      ctx.globalAlpha = 1; elecArc(L, 'rgba(20,160,255,.6)', 3.5); elecArc(L, 'rgba(200,250,255,.95)', 1.1);
    }
    ctx.restore();
  }
}
function drawVesperFx() {
  for (const f of G.f) if (f.state === 'vcharge') {   // énergie bleue qui se charge dans ses mains
    const k = Math.min(1, f.chargeT / 60), hx = f.x + f.dir * 18, hy = f.y - 56;
    glowAt(hx, hy, 10 + 20 * k, 'rgba(58,200,255,.95)', .35 + .45 * k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let i = 0; i < 2 + Math.round(4 * k); i++) { let px = hx, py = hy, a = Math.random() * 6.28; const L = [[px, py]]; for (let j = 0; j < 3; j++) { a += (Math.random() - .5) * 1.4; px += Math.cos(a) * (4 + 6 * k); py += Math.sin(a) * (4 + 6 * k); L.push([px, py]); } elecArc(L, 'rgba(47,160,255,.9)', 2); elecArc(L, '#e0f8ff', .8); }
    ctx.restore();
  }
  for (const q of G.holos || []) {   // double holographique translucide (3e clone / clone chargé : bleu électrique avec échos)
    const fig = x => ({ def: q.owner.def, id: 9, dir: q.dir, state: 'fpunch', t: 8, flash: 0, x, y: q.y, vx: 0, air: false });
    if (q.blue) {   // 3e clone : transparent comme les autres mais bleu électrique ; clone chargé : moins transparent
      const al = q.big ? .85 : .28 + .1 * Math.sin(G.frame * .9);
      (q.trail || []).forEach((tx, i) => { if (i === 0) return; ctx.save(); ctx.globalAlpha = al * .55 * (1 - i / 6); ctx.globalCompositeOperation = 'lighter'; drawFighter(Object.assign(fig(tx), { tint: 'rgba(40,140,255,.9)' }), tx, q.y); ctx.restore(); });   // échos bleus
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; drawFighter(Object.assign(fig(q.x), { tint: 'rgba(70,190,255,.9)' }), q.x, q.y); ctx.restore();
      if (q.big) { ctx.save(); ctx.globalAlpha = .5; drawFighter(Object.assign(fig(q.x), { tint: 'rgba(120,215,255,.9)' }), q.x, q.y); ctx.restore(); }
      glowAt(q.x, q.y - 50, q.big ? 50 : 34, 'rgba(58,200,255,.9)', q.big ? .45 : .3);
      zapChaos(q.x, q.y - 2, 16, 76, q.big ? 7 : 4, .45);
    } else {
      ctx.save(); ctx.globalAlpha = .45 + .15 * Math.sin(G.frame * .9); ctx.globalCompositeOperation = 'lighter';
      drawFighter(fig(q.x), q.x, q.y);
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) R(q.x - q.dir * (8 + i * 7), q.y - 70 + ((G.frame * 3 + i * 17) % 60), 5, 1, '#3af0ff');
  }
  for (const m of G.mines || []) {   // mine magnétique : petit disque avec lumière clignotante
    const on = m.t >= 18 && (G.frame >> 3) % 2;
    R(m.x - 5, GROUND - 3, 11, 3, '#1a1a24'); R(m.x - 4, GROUND - 4, 9, 1, '#3a3a4a');
    R(m.x - 1, GROUND - 5, 3, 2, on ? '#3af0ff' : '#0a5a7a');
    if (on) { ctx.save(); ctx.globalAlpha = .35; disc(m.x, GROUND - 4, 5, '#3af0ff'); ctx.restore(); }
  }
  for (const f of G.f) if (f.state === 'dive' && f.t >= 3 && f.trail) {   // éclat néon au bout du pied
    const [x, y] = f.trail[f.trail.length - 1];
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const g = ctx.createRadialGradient(x, y, 1, x, y, 16); g.addColorStop(0, 'rgba(200,250,255,.8)'); g.addColorStop(.45, 'rgba(47,170,255,.35)'); g.addColorStop(1, 'rgba(20,88,196,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 16, y - 16, 32, 32);   // halo électrique autour du pied
    for (let b = 0; b < 3; b++) { const a = Math.random() * 6.28, r = 7 + Math.random() * 8, L = [[x, y]]; for (let s2 = 1; s2 <= 3; s2++) L.push([x + Math.cos(a) * r * s2 / 3 + (Math.random() - .5) * 4, y + Math.sin(a) * r * s2 / 3 + (Math.random() - .5) * 4]); elecArc(L, 'rgba(20,160,255,.6)', 2.5); elecArc(L, 'rgba(200,250,255,.95)', .9); }
    ctx.restore();
  }
  for (const f of G.f) {   // traînée et croissant de lame pour Pas de l'Ombre / Lame Zénith
    if (f.state === 'shadow' && f.t < 12) { ctx.save(); ctx.globalAlpha = .3; drawFighter(Object.assign({}, f, { x: f.x + f.dir * 10 }), f.x + f.dir * 10, f.y); ctx.restore(); }
    if (f.state === 'zenith' && f.air && f.t < 24) {   // traits néon qui tournent autour d'elle
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let r = 0; r < 6; r++) { const a1 = (f.rotAng || 0) + r * 1.05, rad = 22 + (r % 3) * 9; ctx.strokeStyle = r % 2 ? 'rgba(255,120,220,.75)' : 'rgba(58,240,255,.8)'; ctx.lineWidth = r % 3 === 0 ? 2 : 1;
        ctx.beginPath(); ctx.arc(f.x, f.y - 42, rad, a1, a1 + .9 * f.dir, f.dir < 0); ctx.stroke(); }
      const gl = ctx.createRadialGradient(f.x, f.y - 42, 2, f.x, f.y - 42, 46); gl.addColorStop(0, 'rgba(160,250,255,.28)'); gl.addColorStop(1, 'rgba(58,240,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(f.x, f.y - 42, 46, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (f.state === 'zenith' && f.air && f.t < 30) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(58,240,255,.8)'; ctx.lineWidth = 3;
      const a0 = (f.rotAng || 0) - Math.PI / 2;
      ctx.beginPath(); ctx.arc(f.x, f.y - 45, 30, a0 - 1.2 * f.dir, a0, f.dir < 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f.x, f.y - 45, 30, a0 - .6 * f.dir, a0, f.dir < 0); ctx.stroke();
      ctx.restore();
    }
  }
}
// Textes de combat (COUNTER!, THROW!, COMBO FINISH!...) : même style que le compteur de combo, sur le côté du joueur concerné
function addPopup(x, y, txt, col) {
  const a = G.f && G.f[0], b = G.f && G.f[1], side = !a || !b ? 0 : Math.abs(x - a.x) <= Math.abs(x - b.x) ? 0 : 1;
  feedPush(side, { txt, col });
}
function feedPush(side, it) { G.feed = G.feed || [[], []]; it.t = 0; G.feed[side].unshift(it); if (G.feed[side].length > 4) G.feed[side].length = 4; }
const FEED_LIFE = 90;
function feedCombo(att) {   // le compteur de combo est une ligne du fil : le chiffre zoome à chaque coup
  const side = G.f.indexOf(att); if (side < 0 || (att.cmbN || 0) < 2) return;
  G.feed = G.feed || [[], []];
  const it = G.feed[side].find(q => q.combo && q.t < FEED_LIFE - 16);
  if (it) { it.num = att.cmbN; it.pop = G.frame; it.t = Math.min(it.t, 10); }
  else feedPush(side, { combo: true, num: att.cmbN, pop: G.frame });
}
function drawFeed() {
  if (!G.feed) return;
  G.feed.forEach((L, side) => {
    const left = side === 0, x0 = left ? 34 : W - 34, al = left ? 'left' : 'right';
    let y = 98;
    L.forEach(it => {
      const h = it.combo ? 36 : 16; y -= h;
      it.yy = it.yy == null ? y : it.yy + (y - it.yy) * .3;   // le nouveau texte fait monter les précédents
      if (!G.paused) it.t++;
      const a = it.t, k = Math.min(1, a / 8), ek = 1 - Math.pow(1 - k, 3), ex = Math.max(0, (a - (FEED_LIFE - 16)) / 16);
      const dx = (1 - ek) * 46 * (left ? 1 : -1) - ex * ex * 150 * (left ? 1 : -1);   // entre de droite vers la gauche (P1), sort à gauche
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(ek, 1 - ex)); ctx.translate(Math.round(x0 + dx), Math.round(it.yy));
      if (it.combo) {
        const sc = 1 + .7 * Math.max(0, 1 - (G.frame - it.pop) / 6);   // zoom rapide du chiffre
        ctx.save(); ctx.scale(sc, sc); text(String(it.num), 0, -6 * (sc - 1), 24, '#ffd23a', al, '#3a0a04'); ctx.restore();
        text('COMBO', 0, 26, 8, '#ffffff', al, '#100418');
      } else text(it.txt, 0, 2, 8, it.col || '#ffffff', al, '#100418');
      ctx.restore();
    });
    for (let i = L.length - 1; i >= 0; i--) if (L[i].t > FEED_LIFE) L.splice(i, 1);
  });
}

const CLASH_HIT = { dmg: 14, knock: true, stun: 24, bstun: 20, push: 5.5, chip: 0, sfx: 'heavy' };
function startClash(f, o) {
  G.clash = { f: [f, o], g: [0, 0], t: 0 };
  if (G.tut && G.tut.phase === 3) { G.tut.clashWait = true; G.tut.clashSeen = true; }
  [f, o].forEach(x => { setState(x, 'parry'); x.vx = 0; x.slowT = 0; x.counterT = 0; x.mashShow = 0; });
  G.darkT = 50; G.flashT = 12; G.boltX = (f.x + o.x) / 2; G.boltY = f.y - 60; G.shake = 4;
  addPopup((f.x + o.x) / 2, f.y - 108, 'CLASH! MASH!', '#ffd23a'); sfx('parry');
}
function stepClash() {
  const C = G.clash; C.t++; G.darkT = 50;
  C.f.forEach((f, i) => {
    f.t = Math.min(f.t, 8);   // reste figé en garde, au ralenti
    if (f.cpu) { if (rand() < [.04, .11, .155, .22][DL()]) C.g[i] += 6; }
    else for (const b of BTNS) if (edge(f.ctl, b)) { C.g[i] += 6; break; }
  });
  if (G.flashT > 0) G.flashT--;
  const win = C.g[0] >= 100 ? 0 : C.g[1] >= 100 ? 1 : C.t > 300 ? (C.g[0] >= C.g[1] ? 0 : 1) : -1;
  if (win < 0) return;
  const w = C.f[win], l = C.f[1 - win];
  G.clash = null; G.darkT = 20;
  setState(w, 'special'); w.fired = true; w.chargeT = 0; w.charged = false; w.t = 12;
  setState(l, 'idle'); l.invuln = 0;
  const sx = l.x - w.dir * 10, sy = l.y - 60;
  addSpark(sx, sy, 'fb', w.def.fb); G.flashT = 12; G.boltX = sx; G.boltY = sy;
  applyHit(w, l, CLASH_HIT, sx, sy, w.x, true);
  addPopup(w.x, w.y - 100, 'CLASH WIN!', '#ffd23a');
}
const VSHIELD_LOW = ['ckick', 'nslide', 'hslide', 'grogroll', 'rupper'];   // coups au ras du sol : passent sous le bouclier de Vane
function applyHit(att, def, data, sx, sy, fromX, projectile) {
  if (def.state === 'voidcast' && (G.voids || []).some(q => q.owner === def && q.charging && q.ch >= 45) && !data.low && !VSHIELD_LOW.includes(att.state)) {   // sphère de Vane à mi-charge ou plus : bouclier
    const q = G.voids.find(v => v.owner === def && v.charging);
    addSpark(q.x - def.dir * q.r * .6, q.y, 'parry'); G.flashT = Math.max(G.flashT, 3); G.freeze = Math.max(G.freeze || 0, 4); sfx('parry');
    if (!projectile) { att.vx = -att.dir * 3; att.hasHit = true; }
    return;
  }
  // coups de pied bas enchaînés : le 3e qui touche d'affilée fait tomber l'adversaire

  // Contre réussi : l'attaquant est bloqué une demi-seconde
  if (att.state === 'nyxspin' && !projectile) {   // plongeon de Nyx : 3 coups, seul le 1er peut être contré, le 3e fait tomber
    att.nHits = (att.nHits || 0) + 1; att.nHitT = att.t;
    data = Object.assign({}, data, att.nHits >= 3 ? { knock: true, dmg: 8 } : { knock: false, stun: 20, dmg: 6, push: .2 });
  }
  if (def.state === 'parry' && def.t <= 12 && !(att.state === 'flipk' && att.flipFin) && !(att.state === 'nyxspin' && att.nHits >= 2)) {   // le salto en feu n'est pas contrable
    G.freeze = 10; addSpark(sx, sy, 'parry'); sfx('counter');
    if (projectile) return;
    // l'adversaire passe au ralenti pendant une seconde, éclair + fond assombri
    att.hasHit = true; att.slowT = 60;
    if (att.state === 'nyxspin') { att.rotAng = null; att.nHits = 0; setState(att, 'jump'); att.airAtk = true; att.vy = 0; att.vx = 0; }   // plongeon de Nyx contré : elle retombe
    setState(def, 'idle'); def.counterT = 60; def.vx = 0;
    G.flashT = 12; G.darkT = 60; G.boltX = sx; G.boltY = sy;
    addScore(def, SCORE_PTS.counter);   // contre réussi
    addPopup(def.x, def.y - 100, 'COUNTER!', '#7af0ff');
    return;
  }
  if (!projectile && att.def.kit === 'kael') {
    if (att.state === 'uppercut') data = Object.assign({}, data, { dmg: 16, lift: 8.5 });   // Uppercut Plasma : propulse très haut
    if (att.kcharge > 0 && ['punch', 'fpunch', 'uppercut', 'sonic', 'cpunch', 'jpunch'].includes(att.state)) {   // coup chargé par l'Esquive Éclair
      data = Object.assign({}, data, { dmg: Math.round(data.dmg * 1.8) + 2, knock: true, push: (data.push || 2) * 2 });
      att.kcharge = 0; G.flashT = Math.max(G.flashT, 8); G.shake = Math.max(G.shake, 6); addPopup(def.x, def.y - 100, 'KINETIC!', '#5af0ff');
    }
  }
  if (att.def.fireUpper && att.state === 'uppercut' && !projectile) { data = Object.assign({}, data, { dmg: 19 }); def.burn = Math.max(def.burn || 0, 70); def.burnPal = att.def.fb; }   // poing en feu : plus de dégâts, brûlure
  // Rempart de Fer : un coup normal est absorbé (l'électricité s'arrête) ; un coup spécial touche Grog normalement
  if ((def.state === 'rampart' && def.t >= 2) || (def.rampT > 0 && !def.air && !['fall', 'down', 'getup', 'held', 'throw'].includes(def.state))) {
    if (!projectile && NORMAL_ATK.includes(att.state)) { G.freeze = 6; addSpark(sx, sy, 'parry'); sfx('block'); def.rampT = 0; att.hasHit = true; return; }
    def.rampT = 0;
  }
  const away = fromX < def.x ? 1 : -1;
  if (isBlocking(def, fromX, data)) {
    setState(def, def.ctl.held.d ? 'cblock' : 'block'); def.bstun = data.bstun; def.vx = away * data.push;
    const chip = projectile ? data.chip : (data.knock ? 1 : 0);
    if (chip) { def.hp = Math.max(1, def.hp - dmgK(chip)); def.lagT = 30; }
    G.freeze = 5; addSpark(sx, sy, 'block'); sfx('block');
    nitroGain(att, def, Math.max(1, (data.dmg || 4) * .3));   // coup bloqué : les jauges montent aussi (moins qu'un coup reçu)
    return;
  }
  if (!projectile && att.state === 'ckick' && !G.ghostHit) {   // coups de pied bas enchaînés : le 4e qui touche fait tomber
    att.ckN = G.frame - (att.ckT || -999) < 60 ? (att.ckN || 0) + 1 : 1; att.ckT = G.frame;
    if (att.ckN >= 4) { att.ckN = 0; data = Object.assign({}, data, { knock: true }); }
  }
  // enchaînements : on mémorise la suite des coups qui touchent pendant que l'adversaire est sonné
  let finisher = false;
  const kind = G.ghostHit ? null : { punch: 'p', fpunch: 'p', kick: 'k', fkick: 'k', flame: 's' }[att.state];
  if (kind && !projectile) {
    att.combo = (def.state === 'hit' && G.frame - (att.comboLast || -999) < 50 ? (att.combo || '') : '') + kind;
    att.comboLast = G.frame;
    if (FINISHERS.includes(att.combo) || (att.fireState && att.fireState === att.state)) { finisher = true; att.finSeq = FINISHERS.includes(att.combo) ? att.combo : (att.lastFin || ''); att.combo = ''; data = Object.assign({}, data, { knock: true, dmg: data.dmg + 8 }); }
    else if (att.combo.length >= 4) att.combo = att.combo.slice(-3);
  }
  // 3 coups d'affilée max, puis petit temps d'arrêt (sauf pour finir un enchaînement de la liste)
  if (att.state === 'nslide' && !projectile) data = Object.assign({}, data, { knock: true });   // 3e coup de bas + B B B : la glissade fait tomber
  if (att.state === 'grogroll' && !projectile && att.t >= 27) data = Object.assign({}, data, { knock: true });   // Grog : la dernière roulade fait tomber
  if (!projectile && !G.ghostHit && !['vtripP', 'vtripK', 'gtatsu', 'ckick', 'kbarrage', 'kspin', 'flipk', 'aflip', 'grogroll'].includes(att.state)) {
    att.run = def.state === 'hit' && G.frame - (att.runLast || -999) < 50 ? (att.run || 0) + 1 : 1;
    att.runLast = G.frame;
    if (finisher) { att.run = 0; att.restT = 0; }
    else if (att.run >= 3) { att.restT = 30; att.run = 0; }
  }
  if ((att.state === 'vtripP' || att.state === 'vtripK') && !projectile) { att.vtN = (att.vtN || 0) + 1; if (att.vtN >= 5) data = Object.assign({}, data, { knock: true, dmg: 8 }); }   // 3e coup : chute
  if (att.state === 'fjump' && !projectile) { att.fjHitT = G.frame; def.burn = Math.max(def.burn || 0, 40); def.burnPal = att.def.fb; }   // saut-poing : ne fait pas tomber, haut + A enchaîne le shoryuken
  if (att.state === 'kbarrage' && !projectile) {   // 5e poing de la rafale : fait tomber
    att.barN = (att.barN || 0) + 1;
    if (att.barN >= 5) { data = Object.assign({}, data, { knock: true, dmg: 9 }); G.flashT = Math.max(G.flashT, 6); G.boltX = sx; G.boltY = sy; addPopup(def.x, def.y - 100, 'THUNDER RUSH!', '#5af0ff'); }
  }
  if (att.state === 'flipk' && !projectile) {
    if (att.flipFin) { data = Object.assign({}, data, { knock: true, dmg: 14 }); def.burn = Math.max(def.burn || 0, 100); def.burnPal = att.def.fb; G.flashT = Math.max(G.flashT, 8); G.boltX = sx; G.boltY = sy; G.shake = 6; }   // 4e salto en feu
    else att.flipHits = (att.flipHits || 0) + 1;
  }
  if (att.state === 'gtatsu' && !projectile) {
    att.spinN = def.state === 'hit' ? (att.spinN || 0) + 1 : 1;
    if (att.spinN >= 4) { data = Object.assign({}, data, { knock: true, dmg: 7 }); att.spinN = 0; }
  }
  const rushGo = finisher && att.nitroT > 0 && !projectile && !G.ghostHit;   // Nitro : l'enchaînement continue en NITRO COMBO
  if (rushGo) data = Object.assign({}, data, { knock: false, stun: 60 });
  const hpBefore = def.hp;
  if (['hit', 'fall', 'stunned'].includes(def.state) || def.paraT > 0) comboHit(att); else { att.cmbN = 1; att.cmbLast = G.frame; }   // compteur de combo
  if (att.cpu && !def.cpu && DL() === 0 && !(G.tut && G.tut.phase !== 4)) data = Object.assign({}, data, { dmg: data.dmg * .55 });   // facile : le CPU fait beaucoup moins mal
  def.hp = Math.max(G.tut && G.tut.phase !== 4 ? 30 : rushGo ? 1 : 0, def.hp - dmgK(Math.round(data.dmg * (def.def.tough || 1) * (projectile ? 1 : att.def.power || 1)))); def.lagT = 32;
  addScore(att, projectile || !NORMAL_HITS.includes(att.state) ? SCORE_PTS.special : SCORE_PTS.normal);   // coup normal / coup spécial
  nitroGain(att, def, hpBefore - def.hp);
  if (att.surgeT > 0 && !projectile && !G.ghostHit && att.state !== 'nrush' && !rushGo) (G.ghostQ = G.ghostQ || []).push({ f: G.frame + 7, hit: { att, def, data, sx, sy } });   // le double mauve refrappe
  spawnBlood(sx, sy, away, data.dmg);
  def.flash = 3;
  if (def.air || data.knock || def.hp <= 0) {
    setState(def, 'fall'); def.air = true; def.vy = -(data.lift || 4.8); def.vx = away * (data.lift ? 1.2 : 2.3);
    if (def.fb && def.state !== 'special') {}
  } else {
    setState(def, 'hit'); def.stun = data.stun; def.vx = away * data.push * (att.combo && att.combo.length >= 1 && !projectile ? .45 : 1);
  }
  G.freeze = 8; G.shake = 4;
  addSpark(sx, sy, projectile ? 'fb' : 'hit', projectile ? att.def.fb : null);
  sfx(data.sfx);
  if (finisher) {
    // enchaînement réussi : l'adversaire s'enflamme et tombe au ralenti
    def.burn = 120; def.burnPal = att.def.fb; def.slowT = 60;
    G.darkT = 60; G.flashT = 12; G.boltX = sx; G.boltY = sy; G.freeze = 10; G.shake = 7;
    addPopup(def.x, def.y - 100, rushGo ? 'NITRO RUSH!' : 'COMBO FINISH!', rushGo ? '#5aff8a' : '#ffd23a');
    sfx('fb');
    if (rushGo) { def.slowT = 0; def.burn = 0; G.darkT = 20; setState(att, 'nrush'); att.rushN = 0; att.rushDebt = 0; att.fireDash = 0; att.vx = 0; att.rushSuper = att.surgeT > 0 && att.finSeq === 'ppks'; att.vaneFin = att.surgeT > 0 && att.def.kit === 'vane' && (att.finSeq === 'ppkk' || att.finSeq === 'kkpp'); }   // Vane : Surge + Y Y B B / B B Y Y = clone qui attrape
  }
}

function addSpark(x, y, type, pal) { G.sparks.push({ x, y, t: 0, type, pal }); }

/* ---------------- IA du CPU ---------------- */
function press(a, b, up) { a.press = b; a.pressU = !!up; a.pressFrames = 2; }
function lowAttack(a, b) { a.hold = { d: true }; a.holdT = 10; press(a, b); }
// ---- CPU EXTRÊME ----
function incomingShot(f, o) {   // projectile adverse qui arrive sur f
  const L = [...(G.fbs || []).filter(q => q.alive), ...(G.sonics || []), ...(G.blades || []), ...(G.voids || []).filter(q => !q.charging), ...(G.flasks || []), ...(G.holos || [])];
  let best = null;
  for (const q of L) { if (q.dead || q.owner === f) continue; const v = q.vx != null ? q.vx : q.dir || 0, d = f.x - q.x; if (Math.sign(v) !== Math.sign(d) || Math.abs(d) > 150) continue; if (!best || Math.abs(d) < Math.abs(f.x - best.x)) best = q; }
  return best;
}
function xBrain(f, o, a, dist, fwd, back, neutral) {
  const kit = f.def.kit, sp = (hold, up) => { a.hold = hold || {}; a.holdT = 4; press(a, 's', up); };
  if (G.fighting && !a.xStart) { a.xStart = true; a.cd = 0; a.hold = { [fwd]: true }; a.holdT = 12; }   // FIGHT : part tout de suite à l'attaque
  // en l'air : spécial aérien dès que c'est utile
  if (f.state === 'jump' && !f.airAtk && !a.press && dist < 140 && f.vy > -4 && rand() < .35) { press(a, 's'); return true; }
  if (f.state === 'nyxglide' && !a.press && dist < 70) { press(a, 's'); return true; }
  if (f.state === 'nyxglide') { a.hold = { [fwd]: true }; a.holdT = 2; }
  // enchaînements : file de touches (YYBB...)
  if (a.seq && a.seq.length && !a.press && (neutral || (['punch', 'kick', 'fpunch', 'fkick'].includes(f.state) && f.t > 4))) { press(a, a.seq.shift()); return true; }
  if (!neutral || a.press) return false;
  // contre réussi : prise
  if (f.counterT > 0 && o.slowT > 0 && dist < 80) { press(a, rand() < .5 ? 'p' : 'k'); return true; }
  // projectile qui arrive : la bonne parade selon le personnage
  const q = incomingShot(f, o);
  if (q) {
    const d = Math.abs(f.x - q.x);
    if (kit === 'kael' && d < 120 && G.frame >= (f.kCd || 0)) { sp({}, true); return true; }                 // mur de plasma : annule tout
    if (kit === 'grog' && f.rampT > 0 && d < 70 && !q.big) { press(a, 's'); return true; }                 // dôme : renvoie
    if (kit === 'nyx' && d < 110 && d > 40) { sp({ d: true }); return true; }                              // glissade dessous
    if (f.def.twinFb && d < 110 && d > 40) { sp({}, true); return true; }                                   // Hiro : glissade basse
    if (kit === 'zephyr' && d < 100) { sp({ [back]: true }); return true; }                                // passe sous terre
    if (kit === 'vane' && d < 110) { sp({ [back]: true }); return true; }                                  // téléportation
    if (d < 34) { press(a, 'x'); return true; }                                                             // contre au dernier moment
    if (d < 90 && rand() < .5) { a.hold = { u: true, [fwd]: true }; a.holdT = 6; return true; }     // saute par-dessus
    return true;   // attend le bon moment
  }
  // l'adversaire prépare un coup : contre (X) juste avant l'impact, garde basse contre les coups bas
  const at = ATK[o.state];
  if (at && !o.hasHit && dist < 100 && o.t <= at.act[0] + 1) {
    if (at.low) { a.hold = { [back]: true, d: true }; a.holdT = 18; return true; }
    if (rand() < .8) { press(a, 'x'); return true; }
    a.hold = { [back]: true }; a.holdT = 16; return true;
  }
  // adversaire en l'air qui arrive : anti-aérien (haut + A)
  if (o.air && dist < 100 && o.vy > -3.5) { sp({}, true); return true; }
  if (--a.cd > 0) return true;
  a.cd = 6 + (rand() * 8 | 0);
  const r = rand();
  if (dist > 150) {
    if (r < .45 && shotOK(f)) press(a, 's');                                            // tir
    else if (r < .65) { a.hold = { u: true, [fwd]: true }; a.holdT = 6; }              // saut vers l'adversaire (spécial aérien ensuite)
    else if (kit === 'nyx' && G.smokes.some(c => c.owner === f && !c.used)) sp({ [back]: true }); // téléportation
    else { a.hold = { [fwd]: true }; a.holdT = 18; }
  } else if (dist > 70) {
    if (r < .22 && shotOK(f)) press(a, 's');
    else if (r < .38) sp({ d: true });                                                   // glissade / roulades
    else if (r < .52) sp({}, true);                                                      // haut + A
    else if (r < .64) sp({ [back]: true });                                              // arrière + A (spécial du personnage)
    else if (r < .78) { a.hold = { u: true, [fwd]: true }; a.holdT = 6; }
    else { a.hold = { [fwd]: true }; a.holdT = 10; }
  } else {
    if (r < .4) a.seq = (rand() < .5 ? ['p', 'p', 'k', 'k'] : rand() < .5 ? ['k', 'k', 'p', 'p'] : ['p', 'p', 'k', 's']);   // enchaînement à 4 coups
    else if (r < .52) { a.hold = { d: true }; a.holdT = 6; press(a, 'k'); }
    else if (r < .64) sp({}, true);
    else if (r < .74) sp({ [back]: true });
    else if (r < .84) sp({ d: true });
    else if (dist < 36 && !o.air) press(a, 'x');                                          // prise
    else press(a, 'p');
  }
  return true;
}
function aiInput(f, o) {
  if (G.tut && G.tut.phase !== 4) return tutAI(f, o);   // TUTORIAL : le double est scripté
  if (OPT.diff === 3) return {};   // entraînement, ou aveuglé par la fumée de Nyx   // entraînement : l'adversaire ne bouge pas
  const dk = [.12, 1, 1.7, 3][DL()], rnd = () => rand() / dk;   // difficulté : réactions plus ou moins fréquentes
  if (G.fighting && DL() >= 1 && NEUTRAL.includes(f.state) && rand() < .006 * dk) {   // le CPU utilise aussi Nitro / Surge
    if (!(f.nitroT > 0) && nitroFull(f)) { powerUp(f, o, false); return {}; }
    if (!(f.surgeT > 0) && surgeFull(f)) { powerUp(f, o, true); return {}; }
  }
  const a = f.ai, held = {};
  const dx = o.x - f.x, dist = Math.abs(dx), fwd = dx > 0 ? 'r' : 'l', back = dx > 0 ? 'l' : 'r';
  if (a.holdT > 0) { a.holdT--; Object.assign(held, a.hold); }
  if (a.press) {
    held[a.press] = true; if (a.pressU) held.u = true;
    if (--a.pressFrames <= 0) { a.press = null; a.pressU = false; }
  }
  if (!G.fighting) return held;
  // contré : tente de contrer le contre (X) selon la difficulté
  if (f.slowT > 38 && o.counterT > 0) { if (!a.clashTried) { a.clashTried = true; if (rand() < [.03, .35, .6, .9][DL()]) press(a, 'x'); } }
  else if (!f.slowT) a.clashTried = false;
  const neutral = NEUTRAL.includes(f.state);
  if (OPT.diff === 4 && xBrain(f, o, a, dist, fwd, back, neutral)) return held;   // EXTRÊME : agressif, utilise tous les spéciaux, connaît les parades
  if (f.state === 'jump' && !f.airAtk && !a.press) {
    if (dist < 120 && f.vy > -3 && rnd() < .06) press(a, 's');
    else if (dist < 70 && rnd() < .12) press(a, 'k');
  }
  const fb = o.fb;

  if (neutral && fb && Math.sign(fb.vx) === Math.sign(f.x - fb.x) && Math.abs(fb.x - f.x) < 120 && !a.reacted) {
    a.reacted = true;
    if (DL() === 0 && rand() < .75) return held;   // facile : réagit rarement aux boules de feu
    const r = rand();
    if (r < .35) { a.hold = { u: true, [fwd]: true }; a.holdT = 6; }
    else if (r < .82) { a.hold = { [back]: true }; a.holdT = 55; }
    else if (shotOK(f)) press(a, 's');
  }
  if (!fb) a.reacted = false;
  if (neutral && o.air && dist < 90 && o.vy > -2 && rnd() < .05) lowAttack(a, 'p');
  if (neutral && o.air && dist < 80 && o.vy > -1.5 && rnd() < .08) press(a, 's', true);
  if (neutral && ['punch', 'kick', 'cpunch'].includes(o.state) && o.t < 5 && dist < 95 && rnd() < .12) { a.hold = { [back]: true }; a.holdT = 22; }
  if (neutral && ['punch', 'kick', 'cpunch'].includes(o.state) && o.t < 3 && dist < 95 && rnd() < .07) press(a, 'x');
  if (['punch', 'kick', 'fpunch', 'fkick'].includes(f.state) && f.hasHit && !a.press && rnd() < .35) press(a, comboReady(f, o) && rnd() < .5 ? 's' : (rnd() < .5 ? 'p' : 'k'));
  if (neutral && dist > 60 && dist < 130 && !a.press && rnd() < .012) { a.hold = { [back]: true }; a.holdT = 3; press(a, 's'); }
  if (neutral && nearProp(f) && !a.press && rnd() < .03) press(a, 'x');
  if (neutral && f.counterT > 0 && o.slowT > 0 && dist < 80 && !a.press) press(a, rnd() < .5 ? 'p' : 'k');
  if (neutral && o.state === 'ckick' && o.t < 6 && dist < 95 && rnd() < .35) { a.hold = { [back]: true, d: true }; a.holdT = 26; }
  if (neutral && o.state === 'tatsu' && dist < 110 && rnd() < .08) { a.hold = { [back]: true }; a.holdT = 30; }

  if (--a.cd <= 0 && neutral && !a.press) {
    a.cd = (10 + (rand() * 20 | 0)) * [3.6, 1, .6, .3][DL()];   // facile : attaque beaucoup moins souvent
    const r = rand();
    if (dist > 150) {
      if (r < .35 && shotOK(f)) press(a, 's');
      else if (r < .85) { a.hold = { [fwd]: true }; a.holdT = 20 + (rand() * 20 | 0); }
      else { a.hold = { u: true, [fwd]: true }; a.holdT = 6; }
    } else if (dist > 72) {
      if (r < .2 && shotOK(f)) press(a, 's');
      else if (r < .6) { a.hold = { [fwd]: true }; a.holdT = 15; }
      else if (r < .72) { a.hold = { u: true, [fwd]: true }; a.holdT = 6; }
      else if (r < .85) { a.hold = { [back]: true }; a.holdT = 12; }
      else { a.hold = {}; a.holdT = 10; }
    } else {
      if (r < .25) press(a, 'p');
      else if (r < .45) press(a, 'k');
      else if (r < .55) lowAttack(a, 'k');
      else if (r < .63) lowAttack(a, 'p');
      else if (r < .71) press(a, 's', true);
      else if (r < .80) { a.hold = { [back]: true, d: true }; a.holdT = 20; }
      else if (r < .88) { a.hold = { [back]: true }; a.holdT = 20; }
      else { a.hold = { [back]: true }; a.holdT = 10; }
    }
  }
  return held;
}

/* ---------------- Déroulé des rounds ---------------- */
// 2e couleur quand le CPU prend le même personnage
const ALT = [
  { top: ['#08080c', '#18181e', '#2e2e3a', '#4c4c5c'], belt: ['#2a0404', '#4a0808', '#6e1010', '#962222'] },   // Kaito : t-shirt noir, ceinture rouge foncé
  { top: ['#5a0c0c', '#9a1818', '#d8302a', '#ff7058'] },   // Axel : 2e couleur, t-shirt rouge et jean bleu
  { top: ['#14040e', '#3a0a26', '#6a1446', '#c83a8a'], legs: ['#14040e', '#3a0a26', '#5a1240', '#a83a7a'], hair: { a: '#0a1a1a', h: '#0a5a5a', H: '#1ab8b8', L: '#8af4f4' } },   // Vesper : rose néon, cheveux turquoise
  { legs: ['#2a1608', '#4a2c14', '#6a4220', '#8a5a30'], belt: ['#2a1608', '#4a2c14', '#4a2c14', '#6a4220'], hair: { a: '#2a1a06', h: '#7a5a1a', H: '#a8803a', L: '#d8b870' }, bandP: ['#1a1a24', '#34344a', '#4e4e6a', '#6e6e8c'], eye: '#3af0ff' },   // Grog : même peau vert délavé, pantalon brun, crâne bronze, yeux cyan
  { top: ['#0a1a26', '#16324a', '#24506e', '#3a7aa0'], hair: { a: '#1a1a22', h: '#2e2e3a', H: '#4a4a5a', L: '#8a8a9c' } },   // Zephyr : kimono bleu nuit, cheveux noirs
  { top: ['#04140e', '#0a3624', '#165a3c', '#2e8a5e'], hair: { a: '#2a0606', h: '#5a0e0e', H: '#8e1a1a', L: '#d04040' } },   // Nyx : corset vert, cheveux rouges
  { vestP: ['#2a0a04', '#8a2a10', '#e0561c', '#ff9a5a'], hair: { a: '#06203a', h: '#0e4a7a', H: '#1c7ab8', L: '#5ab8f0' } },   // Kael : gilet orange, crête bleue
  { top: ['#1a0406', '#3a0a0e', '#5a1418', '#7e2428'], legs: ['#1a0406', '#3a0a0e', '#5a1418', '#7e2428'], capeP: ['#04040a', '#0c0c1e', '#16163a', '#262656'] },   // Vane : uniforme rouge, cape bleu nuit
];
const fighterDef = (i, alt) => alt ? Object.assign({}, DEFS[i], ALT[i], { idx: i, alt: true }) : Object.assign(DEFS[i], { idx: i });
const PRE_T = 110, NYX_TOP = 74;   // NYX_TOP : hauteur max du vol plané de Nyx (barre d'énergie au niveau du buste)
function startMatch(p1, p2, stage) {
  G.sc = [{ pts: 0, taken: 0 }, { pts: 0, taken: 0 }]; G.mTime = 0; G.score = null;   // score du combat
  G.hurt = [false, false];   // « PERFECT » : aucun coup encaissé de tout le combat
  if (p2 == null) p2 = G.p2 != null ? G.p2 : 1 - p1;
  G.p1 = p1; G.p2 = p2;
  G.stage = stage || G.stage || 'dojo'; BG = BGS[G.stage] || BGS.dojo;
  const vs2 = G.mode !== 'arcade' && G.mode !== 'tutorial' && p2On();   // en ARCADE, l'adversaire est toujours le CPU   // 2e manette (smartphone ou manette du PC) : joueur 2 humain au lieu du CPU
  G.f = [makeFighter(fighterDef(p1), 0, SW / 2 - 80, 1, false), makeFighter(fighterDef(p2, p2 === p1), 1, SW / 2 + 80, -1, !vs2)];
  if (vs2) G.f[1].ctl = p2ctl;
  G.f[0].ctl = pctl;
  G.round = 1;
  startRound();
  G.preT = G.tut ? 0 : PRE_T;   // début du combat : vue d'ensemble du décor, la caméra descend sur les combattants
}
function startRound() {
  const [a, b] = G.f;
  [[a, SW / 2 - 80, 1], [b, SW / 2 + 80, -1]].forEach(([f, x, d]) => {
    G.clash = null;
    Object.assign(f, { noHat: false, nitroT: 0, surgeT: 0, necho: [], hist: [], rushN: 0, dizzy: false, dizzyEnd: -9999, x, y: GROUND, vx: 0, vy: 0, dir: d, hp: 100, lag: 100, air: false, ko: false, fb: null, invuln: 0, flash: 0, counterT: 0, jumpQ: 0, slowT: 0, burn: 0, combo: '', run: 0, restT: 0, confT: 0, nyxBurnT: 0, sinkK: 0, kcharge: 0, ghosts: [], fadeK: 0, paraT: 0, echo: [], rampT: 0, ai: { cd: 30, hold: {}, holdT: 0, press: null, pressU: false, pressFrames: 0, reacted: false } });   // le CPU repart de zéro à chaque round
    setState(f, 'idle');
    f.ai.holdT = 0; f.ai.press = null; f.ai.cd = 40;
  });
  G.hats = []; G.zfloor = []; G.vclones = []; G.vblasts = []; G.props = makeProps(); G.shards = []; G.slowAll = 0; G.blood = []; G.stains = []; G.camL = EXT; G.camS = null; G.zoom = 1;
  G.rPerf = null; G.quakeT = 0; G.clashFx = []; G.toxics = []; G.toxFx = []; G.holos = []; G.mines = []; G.waves = []; G.blades = []; G.flasks = []; G.snakes = []; G.puddles = []; G.smokes = []; G.geysers = []; G.sonics = []; G.pwalls = []; G.voids = []; G.shadowFx = []; G.vdust = [];
  G.fbs = []; G.sparks = []; G.popups = []; G.feed = [[], []]; G.powerMsg = null; G.flashT = 0; G.darkT = 0; G.timer = 99; G.tick = 0; G.fighting = false;
  G.scene = 'intro'; G.t = 0; G.winner = null; G.preT = 0;
}

function endRound(winner) {
  G.fighting = false;
  if (G.sc) G.f.forEach((f, i) => { G.sc[i].taken += Math.max(0, 100 - Math.max(0, f.hp)); });   // dégâts reçus pendant le round
  G.f.forEach(f => { f.surgeT = 0; f.nitroT = 0; f.necho = []; f.rushGhost = 0; }); G.ghostQ = [];   // fin du round : le Surge / Nitro s'arrête (pas de double mauve pendant la victoire)
  G.winner = winner;
  if (winner) winner.wins++;
}

/* ---------------- Boucle principale ---------------- */
// ---------- Options (enregistrées dans le navigateur) ----------
const DL = () => OPT.diff === 4 ? 3 : Math.min(2, OPT.diff);   // niveau du CPU : 0 facile, 1 normal, 2 difficile, 3 extrême
const OPT = { zoom: 'anim', energy: 1, diff: 1, blood: true, music: 3, sfx: 4 };   // musique 75 %, bruitages 100 %
try { Object.assign(OPT, JSON.parse(localStorage.getItem('sf2opt2') || '{}')); } catch (e) {}
if (OPT.zoom === true) OPT.zoom = 'anim'; else if (OPT.zoom === false) OPT.zoom = 'normal';   // ZOOM IN GAME : ANIMATED / FAR / NORMAL / NEAR
const ZOOMS = ['anim', 'far', 'normal', 'near'], ZOOM_LBL = { anim: 'ANIMATED', far: 'FAR', normal: 'NORMAL', near: 'NEAR' }, ZOOM_FIX = { far: .88, normal: 1, near: 1.2 };
if (OPT.guides == null) OPT.guides = true;   // aides au-dessus de la tête, activées par défaut
if (OPT.full == null) OPT.full = isTouch;   // plein écran par défaut sur mobile   // nouvelle clé : zoom et sang activés par défaut
const saveOpt = () => { try { localStorage.setItem('sf2opt2', JSON.stringify(OPT)); } catch (e) {} };
// Énergie des combattants : 1 étoile = dégâts normaux, 2 et 3 étoiles = plus résistants
const DIFFS = ['EASY', 'NORMAL', 'HARD', 'TRAINING', 'EXTREME'];
const DIFF_ORDER = [0, 1, 2, 4, 3];   // EASY > NORMAL > HARD > EXTREME > TRAINING
const dmgK = d => Math.max(1, Math.round(d * [.6, .42, .3][OPT.energy - 1] * 10) / 10);   // énergie plus résistante (1 étoile = déjà plus long qu'avant)
const TITLE_ITEMS = ['ARCADE MODE', 'V.S. BATTLE', 'TUTORIAL', 'VIEW COMMANDS', 'OPTIONS'];
/* ---------------- TUTORIAL ---------------- */
// contre son double (2e couleur), dans le dojo, sans musique : 1) les boutons 2) les coups spéciaux 3) le contre et le bras de fer 4) combat libre
const TUT_BTN = [['p', 'PRESS Y TO PUNCH'], ['k', 'PRESS B TO KICK'], ['s', 'PRESS A FOR A SPECIAL MOVE'], ['x', 'PRESS X TO COUNTER']];
const st_ = n => f => f.state === n;
const TUT_SP = {
  hiro: [['A', 'FIREBALL', f => f.state === 'special' && f.fired], ['HOLD A', 'MAX FIREBALL', f => f.charged], ['UP + A', 'LOW SLIDE + MINI UPPER', st_('hslide')], ['UP + A, THEN UP + A', 'SHORYUKEN', st_('uppercut')], ['BACK + A', 'FLIP KICK', st_('flipk')], ['DOWN + A', 'SLIDE KICK', st_('nslide')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb'], ['JUMP, THEN A (x2)', 'AIR FIREBALL', st_('airfb')]],
  axel: [['A', 'GROUND FIREBALL', f => f.state === 'axgp' && f.fired], ['HOLD A', 'MAX GROUND FIREBALL', f => f.charged], ['UP + A', 'FIRE LEAP', st_('fjump')], ['UP + A, THEN UP + A', 'FIRE SHORYUKEN', st_('uppercut')], ['BACK + A', 'FLIP KICK', st_('flipk')], ['DOWN + A', 'SLIDE KICK', st_('nslide')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb'], ['JUMP, THEN A', 'AIR FLIP KICKS', st_('aflip')]],
  vesper: [['A', 'HOLO FLASH', st_('holo')], ['HOLD A 1 SEC, RELEASE', 'VOLT CLONE', f => f.state === 'holo' && G.holos.some(q => q.owner === f && q.big)], ['BACK + A', 'SHADOW STEP', st_('shadow')], ['UP + A', 'ZENITH BLADE', st_('zenith')], ['JUMP, THEN A', 'NEON DIVE', st_('dive')], ['DOWN + A', 'SLIDE KICK', st_('nslide')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb']],
  vane: [['A', 'VOID FLARE', st_('voidcast')], ['HOLD X 1 SEC, THEN A', 'PHANTOM GRASP', st_('vsrel')], ['BACK + A', 'PHANTOM TELEPORT', st_('pteleport')], ['UP + A', 'METEOR IMPACT', st_('meteor')], ['JUMP, THEN A', 'VOID BOMB', st_('airvoid')], ['JUMP, THEN DOWN + A', 'DIVE KICK', st_('vdive')], ['HOLD Y, THEN RELEASE', '5 FAST PUNCHES', st_('vtripP')], ['DOWN + A', 'SLIDE KICK', st_('nslide')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb']],
  kael: [['A', 'SONIC WAVE', st_('sonic')], ['BACK + A', 'FLASH STEP', st_('flashstep')], ['THEN Y', 'THUNDER RUSH', st_('kbarrage')], ['UP + A', 'PLASMA WALL', st_('plasmawall')], ['JUMP, THEN A', 'VOLT SPIN', st_('kspin')], ['DOWN + A', 'SLIDE KICK', st_('nslide')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb']],
  nyx: [['A', 'MAGMA FLASK', st_('flask')], ['HOLD A, RELEASE', 'VOLT SERPENT', st_('nyxsnake')], ['BACK + A', 'TOXIC MIST', st_('smokeback')], ['BACK + A AGAIN', 'SMOKE TELEPORT', st_('nyxtele')], ['UP + A', 'ALCHEMIC GEYSER', st_('geyser')], ['DOWN + A', 'SLIDE KICK', st_('nslide')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb'], ['JUMP, THEN A', 'WITCH GLIDE', st_('nyxglide')], ['WHILE GLIDING, A', 'SPIN DIVE (3 HITS)', st_('nyxspin')]],
  zephyr: [['A', 'GALE BLADE', st_('gust')], ['FWD + Y', 'HEAVEN CUT', st_('wallslash')], ['BACK + A', 'STORM PASSAGE', st_('sink')], ['UP + A', 'RISING TORNADO', st_('tornado')], ['JUMP, THEN A', 'SKY DASH', st_('zdash')], ['JUMP, THEN DOWN + A', 'SKY PLUNGE', f => f.state === 'hover' || f.state === 'plunge'], ['HOLD A 1 SEC, RELEASE', 'STORM HAT', st_('hatthrow')], ['DOWN + A', 'SLIDE KICK', st_('nslide')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb']],
  grog: [['A', 'SEISMIC IMPACT', st_('quake')], ['HOLD A, RELEASE', 'THUNDER RUSH', st_('grogrush')], ['BACK + A', 'IRON RAMPART', st_('rampart')], ['THEN A AGAIN', 'DOME BLAST', st_('rburst')], ['UP + A', 'CELESTIAL CRUSH', st_('crush')], ['JUMP, THEN A', 'GROUND POUND', st_('gpound')], ['DOWN + A', 'ROLLING ATTACK', st_('grogroll')], ['X, THEN A', 'REFLECT HIS FIREBALL', f => f.reflF != null && G.frame - f.reflF < 40 && f.state === 'bflip', 'fb']],
};
const TUT_COMBO = [['ppkk', 'Y, Y, B, B'], ['kkpp', 'B, B, Y, Y'], ['ppks', 'Y, Y, B, A'], ['kkps', 'B, B, Y, A']];
const tutSpecials = d => TUT_SP[d.kit] || (d.twinFb ? TUT_SP.hiro : TUT_SP.axel);
const tutLab = t => t.replace(/\b([YBAX])\b/g, (m0, b) => btnLabel(b));
function tutStart() { G.tut = { phase: 1, step: 0, ok: 0, t: 0 }; G.mode = 'tutorial'; startMatch(G.p1, 0, 'dojo'); }   // adversaire du tutoriel : toujours Hiro (pour lui renvoyer ses boules de feu)
function tutNext() { const T = G.tut; T.step++; T.ok = 50; T.t = 0; sfx('select'); G.f.forEach(f => { f.hp = 100; f.lag = 100; }); }
function tutStep() {   // appelé à chaque image du combat
  const T = G.tut; if (!T || !G.fighting) return;
  const [a, b] = G.f; T.t++;
  if (T.ok > 0) {
    T.ok--; if (T.ok === 0 && T.next) { T.phase = T.next; T.step = 0; T.next = 0; a.lastFin = null; if (T.phase === 6) G.props = makeProps(); }
    if (T.phase === 2 && !T.next) { const it = tutSpecials(a.def)[T.step]; if (it && it[2](a)) { tutNext(); if (T.step >= tutSpecials(a.def).length) T.next = 5; } }   // enchaînement rapide (haut + A à nouveau...) : compté même pendant « GOOD! »
    return;
  }
  if (T.phase === 1) {
    const [btn] = TUT_BTN[T.step];
    if (edge(pctl, btn)) { tutNext(); if (T.step >= TUT_BTN.length) T.next = 2; }
  } else if (T.phase === 2) {
    const L = tutSpecials(a.def), it = L[T.step];
    if (it && it[2](a)) { tutNext(); if (T.step >= L.length) T.next = 5; }
  } else if (T.phase === 5) {   // les enchaînements à 4 coups
    const it = TUT_COMBO[T.step];
    if (it && a.lastFin === it[0]) { a.lastFin = null; tutNext(); if (T.step >= TUT_COMBO.length) T.next = 3; }
  } else if (T.phase === 3) {
    if (T.step === 0 && a.state === 'throw') { tutNext(); }   // contre (X) puis contre-attaque (Y / B)
    else if (T.step === 1 && T.clashSeen && !G.clash) { tutNext(); T.next = 6; }   // bras de fer terminé
  } else if (T.phase === 6) {   // les objets du décor : les lancer, puis renvoyer celui de l'adversaire
    if (!(G.props || []).some(q => q.alive)) G.props = makeProps();
    if (T.step === 0 && (a.state === 'pthrow' || (G.props || []).some(q => q.fly && q.fly.owner === a))) { tutNext(); T.refl = false; }
    else if (T.step === 1 && T.refl) { tutNext(); T.rally = 0; T.cpuHit = false; }   // puis le « tennis »
    else if (T.step === 2 && T.cpuHit) { tutNext(); T.next = 4; }
  } else if (T.phase === 4 && !T.started) {   // combat libre : on repart d'un vrai round
    T.started = true; T.showFight = 420; OPT.diff = 1; saveOpt(); startRound();   // difficulté remise sur NORMAL
  }
}
function tutAI(f, o) {   // le double : immobile, puis il attaque (phase 3), puis il contre (phase 3, étape 2)
  const T = G.tut, a = f.ai, held = {};
  if (a.press) { held[a.press] = true; if (--a.pressFrames <= 0) a.press = null; }
  const dx = o.x - f.x, dist = Math.abs(dx), fwd = dx > 0 ? 'r' : 'l';
  if (G.fighting && (T.phase === 2 || T.phase === 5) && dist > 150 && NEUTRAL.includes(f.state)) held[fwd] = true;   // reste à portée pour les coups spéciaux
  { const it = T.phase === 2 && !T.ok ? tutSpecials(o.def)[T.step] : null;
    if (G.fighting && it && it[3] === 'fb' && NEUTRAL.includes(f.state)) {   // étape « X puis A » : Hiro lance des boules de feu à renvoyer
      held[fwd] = false; if (dist < 120) held[fwd === 'r' ? 'l' : 'r'] = true;
      else if (--a.cd <= 0 && !(G.fbs || []).some(q => q.alive)) { a.cd = 70; press(a, 's'); }
      return held;
    } }
  if (G.fighting && T.phase === 6 && T.step >= 1 && !T.ok && NEUTRAL.includes(f.state)) {   // va chercher un objet et le lance sur le joueur
    if ((G.props || []).some(q => q.fly)) { held[fwd] = false; return held; }   // un objet vole : il attend pour le renvoyer
    const pr = (G.props || []).filter(q => q.alive && !q.held && !q.fly).sort((p1, p2) => Math.abs(p1.x - f.x) - Math.abs(p2.x - f.x))[0];
    if (pr) { if (Math.abs(pr.x - f.x) < 20) { if (--a.cd <= 0) { a.cd = 40; press(a, 'x'); } } else held[pr.x > f.x ? 'r' : 'l'] = true; }
    return held;
  }
  if (!G.fighting || T.phase < 3 || T.phase === 5 || T.phase === 6 || T.ok > 0) return held;
  if (!NEUTRAL.includes(f.state)) return held;
  if (T.step === 0) {   // s'approche et donne des coups de poing : au joueur de contrer
    if (dist > 50) held[fwd] = true;
    else if (--a.cd <= 0) { a.cd = 70; press(a, 'p'); }
  } else if (['punch', 'kick', 'fpunch', 'fkick'].includes(o.state) && o.t < 3 && dist < 100) press(a, 'x');   // contre le coup du joueur
  return held;
}
function drawTut() {
  const T = G.tut; if (!T) return;
  let L1 = '', L2 = '', head = '';
  if (T.phase === 4) { if (!(T.showFight > 0)) return; T.showFight--; if (T.showFight > 220) { head = 'TUTORIAL COMPLETE'; L1 = 'NOW YOU KNOW ALL THE BASICS. FIGHT!'; L2 = 'PAUSE: CHANGE THE DIFFICULTY IN OPTIONS'; } else { head = 'GUIDES'; L1 = 'MOVE HINTS APPEAR ABOVE YOUR HEAD'; L2 = 'TO HIDE THEM: PAUSE > OPTIONS > GUIDES'; } }   // le guide au-dessus de la tête, désactivable dans OPTIONS
  else if (T.ok > 0) { head = 'GOOD!'; L1 = T.next === 2 ? 'NEXT: SPECIAL MOVES' : T.next === 5 ? 'NEXT: COMBOS' : T.next === 3 ? 'NEXT: THE COUNTER' : T.next === 6 ? 'NEXT: OBJECTS' : T.next === 4 ? 'WELL DONE!' : ''; }
  else if (T.phase === 1) { head = 'STEP 1: THE BUTTONS'; L1 = tutLab(TUT_BTN[T.step][1]); }
  else if (T.phase === 2) { const it = tutSpecials(G.f[0].def)[T.step]; head = 'STEP 2: SPECIAL MOVES'; L1 = it ? tutLab(it[0]) + ': ' + it[1] : ''; if (it && it[3] === 'fb') L2 = tutLab('PRESS X THEN A JUST BEFORE IT HITS YOU'); }
  else if (T.phase === 5) { const it = TUT_COMBO[T.step]; head = 'STEP 3: COMBOS'; L1 = it ? tutLab('PRESS ' + it[1] + ' QUICKLY') : ''; L2 = 'THE 4TH HIT DASHES FORWARD IN FIRE!'; }
  else if (T.phase === 6 && T.step === 0) { head = 'STEP 5: OBJECTS'; L1 = tutLab('WALK TO AN OBJECT AND PRESS X'); L2 = 'TO THROW IT AT THE FOE!'; }
  else if (T.phase === 6 && T.step === 2) { head = 'STEP 5: OBJECT TENNIS'; if ((T.rally || 0) >= 3) { L1 = 'WELL DONE!'; L2 = 'NOW LET IT HIT HIM!'; } else { L1 = tutLab('SEND IT BACK EVERY TIME WITH X!'); L2 = 'RALLY: ' + (T.rally || 0) + ' / 3'; } }
  else if (T.phase === 6) { head = 'STEP 5: OBJECTS'; L1 = 'THE FOE THROWS AN OBJECT AT YOU:'; L2 = tutLab('PRESS X AS IT ARRIVES TO SEND IT BACK!'); }
  else if (T.phase === 3 && T.step === 0) { head = 'STEP 4: THE COUNTER'; L1 = tutLab('WHEN THE FOE ATTACKS, PRESS X TO COUNTER'); L2 = tutLab('THEN PRESS Y OR B TO STRIKE BACK'); }
  else if (T.phase === 3) { head = 'STEP 4: THE COUNTER'; L1 = 'HIT THE FOE: HE WILL COUNTER YOU.'; L2 = tutLab('COUNTER HIM BACK FAST WITH X!'); }
  if (T.clashWait) { head = 'CLASH!'; L1 = 'MASH ANY BUTTON AS FAST AS YOU CAN!'; L2 = (G.frame >> 4) % 2 ? 'PRESS A BUTTON TO START' : ''; }
  const bw = Math.min(W - 16, 340), bx = CX - bw / 2, by = 46, bh = L2 ? 40 : 30;
  R(bx, by, bw, bh, 'rgba(8,4,16,.82)'); R(bx, by, bw, 1, '#5a3a2a'); R(bx, by + bh - 1, bw, 1, '#5a3a2a');
  text(head, CX, by + 5, 8, '#ffd23a', 'center');
  if (L1) text(L1, CX, by + 17, 8, '#ffffff', 'center');
  if (L2) text(L2, CX, by + 28, 8, '#7af0ff', 'center');
}
/* ---------------- SCORE ----------------
   Pendant le combat : coups normaux, spéciaux, contres, NITRO COMBO, NITRO SURGE COMBO.
   À la fin (vainqueur) : bonus de temps (plus on gagne vite, plus on marque) et bonus de vitalité (moins on a reçu de dégâts, plus on marque). */
const SCORE_PTS = { normal: 100, special: 300, counter: 500, nitro: 5000, surge: 10000 };
const NORMAL_HITS = ['punch', 'kick', 'fpunch', 'fkick', 'cpunch', 'ckick', 'jpunch', 'jkick', 'rupper', 'throw'];
const SC_IN = 24, SC_RUN = 120, SC_HOLD = 70;   // apparition, calcul (2 s), pause avant YOU WIN / YOU LOSE
function addScore(f, n) { if (!G.sc || G.demo || (G.tut && G.tut.phase !== 4) || !G.fighting) return; const i = G.f.indexOf(f); if (i >= 0) G.sc[i].pts += n; }
function startScore() {
  const secs = (G.mTime || 0) / 60;
  const rows = G.f.map((f, i) => {
    const won = f.wins >= 2, sc = G.sc[i];
    const time = won ? Math.max(0, Math.round(120 - secs)) * 200 : 0;
    const vit = won ? Math.max(0, 300 - Math.round(sc.taken)) * 50 : 0;
    return { pts: sc.pts, time, vit, total: sc.pts + time + vit };
  });
  if (G.mode === 'arcade' && G.arc) { G.arc.total = (G.arc.total || 0) + rows[0].total; }   // ARCADE : les scores s'additionnent
  G.score = { rows, secs };
  G.scene = 'score'; G.t = 0;
}
const fmtSc = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function drawScore() {
  const S = G.score; if (!S) return;
  const T = G.t, a = Math.min(1, T / SC_IN), p = Math.max(0, Math.min(1, (T - SC_IN) / SC_RUN));
  R(0, 0, W, H, `rgba(4,2,10,${(.72 * a).toFixed(3)})`);
  if (T < 6) return;
  const two = !(G.mode === 'arcade' && G.arc) , cols = two ? [0, 1] : [0];
  ctx.save(); ctx.globalAlpha = a;
  text('SCORE', CX, 30, 16, '#ffd23a', 'center');
  const lx = CX - 150, labels = ['HITS', 'TIME BONUS', 'VITALITY BONUS', 'TOTAL'], y0 = 66, st = 20;
  labels.forEach((l, k) => text(l, lx, y0 + k * st + (k === 3 ? 8 : 0), 8, k === 3 ? '#ffd23a' : '#ffffff', 'left'));
  R(lx, y0 + 3 * st - 1, 300, 1, 'rgba(255,255,255,.25)');
  cols.forEach(c => {
    const r = S.rows[c], x = two ? (c === 0 ? CX + 50 : CX + 145) : CX + 145, f = G.f[c];
    text(c === 0 ? 'P1' : f.cpu ? 'CPU' : 'P2', x, y0 - 18, 8, c === 0 ? '#5ac8ff' : '#ff6ae8', 'right');
    const vals = [r.pts, r.time * (1 - p), r.vit * (1 - p), r.pts + (r.time + r.vit) * p];
    vals.forEach((v, k) => text(fmtSc(v), x, y0 + k * st + (k === 3 ? 8 : 0), 8, k === 3 ? '#ffd23a' : '#ffffff', 'right'));
  });
  if (!two) {
    const tot = (G.arc.total || 0) - S.rows[0].total * (1 - p);
    text('ARCADE TOTAL', lx, y0 + 4 * st + 16, 8, '#5aff8a', 'left'); text(fmtSc(tot), CX + 145, y0 + 4 * st + 16, 8, '#5aff8a', 'right');
  }
  ctx.restore();
}
/* ---------------- ARCADE MODE ---------------- */
// Tous les personnages dans l'ordre (y compris son double), Lord Vane en dernier
function arcadeStart() {
  if (OPT.diff === 3) { OPT.diff = 1; saveOpt(); }   // pas d'entraînement en ARCADE
  const L = DEFS.map((d, i) => i).filter(i => DEFS[i].kit !== 'vane'); L.push(DEFS.findIndex(d => d.kit === 'vane'));
  G.arc = { list: L, i: 0 }; arcadeFight();
}
function arcadeFight() { const i = G.arc.i; startMatch(G.p1, G.arc.list[i], STAGES[i % STAGES.length][0]); }
const arcLast = () => G.arc && G.arc.i >= G.arc.list.length - 1;
function overItems(won) {
  if (G.mode === 'arcade' && G.arc) return won ? (arcLast() ? [] : ['NEXT FIGHT (' + btnLabel('A') + ')']) : ['CONTINUE', 'TITLE SCREEN'];
  return ['RETRY', 'SELECT CHARACTER'];
}
// Fin du mode ARCADE : fondu au noir, musique du thème, personnage qui enchaîne des coups puis lève le bras, CONGRATULATIONS !, confettis
const CONF_COL = ['#ffd23a', '#ff4a8a', '#5ac8ff', '#5ae06a', '#c88aff', '#ff8a3a', '#ffffff'];
function startEnding() {
  const f = makeFighter(fighterDef(G.p1), 0, CX, 1, false); f.state = 'idle'; f.t = 0;
  const conf = []; for (let i = 0; i < 140; i++) conf.push({ x: Math.random() * (W + 80), y: -Math.random() * H * 1.2, vy: .25 + Math.random() * .4, ph: Math.random() * 6.28, c: CONF_COL[i % CONF_COL.length], s: 1 + (Math.random() < .35) });
  G.end = { f, conf, out: 0, total: G.arc ? G.arc.total || 0 : 0 }; G.scene = 'ending'; G.t = 0; G.arc = null;
}
const END_ATK = ['punch', 'kick', 'fpunch', 'fkick', 'cpunch', 'ckick'];
function stepEnding() {
  const E = G.end; G.t++;
  if (G.t === 112 && AC) playSample('congrats', 1.5, VOX, true);   // voix « CONGRATULATIONS » (delay + réverbe)
  for (const c of E.conf) { c.y += c.vy; c.x += -.28 + Math.sin(G.t * .03 + c.ph) * .35; if (c.y > H + 4) { c.y = -4; c.x = Math.random() * (W + 80); } if (c.x < -6) c.x += W + 12; }   // chute lente, vent vers la gauche
  const f = E.f, T = G.t - 80;   // le personnage apparaît vers 80
  if (T >= 0) {
    f.t++;
    if (T < 190) { if ((f.state === 'idle' && f.t > 8) || (f.state !== 'idle' && f.t > 22)) { if (f.state === 'idle') { f.state = END_ATK[rand() * END_ATK.length | 0]; f.t = 0; sfx('whoosh'); } else { f.state = 'idle'; f.t = 0; } } }   // coups au hasard pendant ~3 s
    else if (f.state !== 'win') { f.state = 'win'; f.t = 0; sfx('select'); }   // lève le bras
  }
  if (E.out) {   // sortie : fondu au noir + musique coupée, puis écran titre
    E.out++;
    if (E.out > 45) { goTitle(); G.t = SPLASH; G.musIn = 70; BGM.currentTime = 0; }
    return;
  }
  if (G.t > 300 && (BTNS.some(b => edge(pctl, b)) || edge(pctl, 'start') || tap)) { E.out = 1; sfx('select'); }
}
function drawEnding() {
  const E = G.end, t = G.t;
  R(0, 0, W, H, '#000');
  if (t < 45) { drawOver(); R(0, 0, W, H, `rgba(0,0,0,${Math.min(1, t / 40)})`); return; }   // fondu au noir
  const a = Math.min(1, Math.max(0, (t - 70) / 30));
  ctx.save(); ctx.globalAlpha = a;
  const drawConf = front => { for (const [i, c] of E.conf.entries()) { if ((i % 3 === 0) !== front) continue; const tw = .45 + .55 * Math.abs(Math.sin(t * .12 + c.ph)); ctx.globalAlpha = a * tw; R(c.x, c.y, c.s + 1, c.s + (i % 2), (t + i) % 47 < 3 ? '#ffffff' : c.c); } ctx.globalAlpha = a; };
  drawConf(false);   // confettis derrière le personnage
  if (t >= 80) {
    ctx.save(); ctx.globalAlpha = a * .35; const g = ctx.createRadialGradient(CX, 110, 4, CX, 110, 70); g.addColorStop(0, 'rgba(255,210,58,.5)'); g.addColorStop(1, 'rgba(255,210,58,0)'); ctx.fillStyle = g; ctx.fillRect(CX - 70, 40, 140, 140); ctx.restore();
    drawFighter(E.f, CX, 142); if (E.f.def.float && typeof drawVaneGhost === 'function') drawVaneGhost(Object.assign(E.f, { x: CX, y: 142 }));
  }
  drawConf(true);   // quelques confettis devant
  if (t > 110) { const k = Math.min(1, (t - 110) / 24), e = 1 - Math.pow(1 - k, 3), sc = 1 + (1 - e) * 7; ctx.save(); ctx.globalAlpha = a * k; ctx.translate(CX, 158); ctx.scale(sc, sc); text('CONGRATULATIONS !', 0, -8, 16, (G.frame >> 4) % 2 ? '#ffd23a' : '#ffe98a', 'center'); ctx.restore(); }
  if (t > 140 && E.total) text('FINAL SCORE ' + fmtSc(E.total), CX, 178, 8, '#ffffff', 'center');
  if (t > 300 && (G.frame >> 5) % 2 === 0) text('PRESS ANY BUTTON', CX, 196, 8, '#ffffff', 'center');
  ctx.restore();
  if (E.out) R(0, 0, W, H, `rgba(0,0,0,${Math.min(1, E.out / 40)})`);   // fondu de sortie
}
function goTitle() { G.arc = null; G.tut = null; G.scene = 'title'; G.t = SPLASH + 100; G.tmenu = 30; G.tstate = 1; G.tcur = 0; G.showMoves = false; G.showOpts = false; G.paused = false; G.shake = 0; G.quakeT = 0; }
// Menus : un cran par appui ; stick maintenu = descend/monte ligne par ligne
const navHold = { u: 0, d: 0 };
function nav(b) {
  if (!pctl.held[b]) { navHold[b] = 0; return false; }
  const n = ++navHold[b];
  return n === 1 || (n > 30 && (n - 30) % 15 === 0);
}
function navStep() { const u = nav('u'), d = nav('d'); return d ? 1 : u ? -1 : 0; }
let MR_KEY = null, MR = [];
const PAGE_FACE = { 'HIRO SPECIALS': 0, 'AXEL SPECIALS': 1, 'VESPER SPECIALS': 2, 'GROG SPECIALS': 3, 'ZEPHYR SPECIALS': 4, 'NYX SPECIALS': 5, 'KAEL SPECIALS': 6, 'LORD VANE SPECIALS': 7 };   // index DEFS pour le visage de la case
const pageOfDef = d => KIT_PAGE[d.kit] || (d.twinFb ? 'HIRO SPECIALS' : 'AXEL SPECIALS');
const KIT_PAGE = { vesper: 'VESPER SPECIALS', vane: 'LORD VANE SPECIALS', kael: 'KAEL SPECIALS', nyx: 'NYX SPECIALS', zephyr: 'ZEPHYR SPECIALS', grog: 'GROG SPECIALS' };
const mlTwo = () => G.paused && G.f && G.f[1] && !G.f[1].cpu;   // deux joueurs humains : choix PLAYER 1 / PLAYER 2
// lignes affichées : la colonne des commandes (bleu) et celle des descriptions (blanc) passent sur 2 lignes si besoin, alignées à gauche
let MD_KEY = null, MD = [];
const MV_COL = () => isTouch && !padOn() ? 144 : 112;   // colonne des descriptions (mobile : plus large pour « STICK LEFT (BACK) »)
function moveDisp() {
  ctx.font = '8px "Press Start 2P", monospace'; const cw = Math.max(6, ctx.measureText('MMMMMMMMMM').width / 10);   // largeur réelle d'un caractère
  const rows = moveRows(), x0 = Math.max(16, CX - 168), px = Math.max(8, CX - 184), vc = Math.max(8, Math.floor((W - px - 14 - (x0 + MV_COL())) / cw));   // la description passe à la ligne avant le bord droit de la popup
  const lab = k => (isTouch && !padOn() ? k : k.replace('STICK ', '')).replace(/\b([YBAX])\b/g, (m0, b) => btnLabel(b));
  const key = MR_KEY + '|' + vc + '|' + W + '|' + MV_COL() + '|' + lab('Y B A X STICK');
  if (key === MD_KEY) return MD;
  MD_KEY = key; MD = [];
  const wrap = (t, n) => { if (!t) return ['']; const out = []; let cur = ''; for (const w of t.split(' ')) { if (cur && cur.length + 1 + w.length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } out.push(cur); return out; };
  for (const [k, v] of rows) {
    if (k === '#' || (!k && !v)) { MD.push([k, v]); continue; }
    if (k === '*') { for (const l of wrap(v, Math.max(8, Math.floor((W - px - 14 - x0) / cw)))) MD.push(['*', l]); continue; }   // phrase sur les deux colonnes
    const kl = wrap(k ? lab(k) : '', MV_COL() / 8 - 1), vl = wrap(v, vc), n = Math.max(kl.length, vl.length);
    for (let i = 0; i < n; i++) MD.push([kl[i] || '', vl[i] || '', true]);
  }
  return MD;
}
function mlPages() {   // cases de la mosaïque : écran titre = toutes ; combat = BASICS, SPECIALS & COUNTER, les 2 combattants, COMBOS
  const pz = G.paused && G.f && G.f.length === 2;
  let t = MOVES.map(pg => pg.title);
  if (pz) { const a = pageOfDef(G.f[0].def), b = pageOfDef(G.f[1].def); t = ['BASICS', 'SPECIALS & COUNTER', a]; if (b !== a) t.push(b); t.push('COMBOS'); }
  return t.map(x => MOVES.find(pg => pg.title === x)).filter(Boolean);
}
function moveRows() {   // lignes de la case ouverte (popup)
  const pg = MOVES.find(q => q.title === G.mlOpen) || MOVES[0], key = 'pg:' + pg.title;
  if (key !== MR_KEY) { MR_KEY = key; MR = pg.lines.slice(); }
  return MR;
}
const ML_RECTS = [], ML_POP = [0, 0, 0, 0];
function stepMoves() {
  const P = mlPages(); G.mlSel = Math.max(0, Math.min(P.length - 1, G.mlSel || 0));
  if (G.mlOpen) {   // popup : liste qui défile
    const maxS = Math.max(0, moveDisp().length * 14 - 118);
    if (pctl.held.d) G.mscroll = Math.min(maxS, (G.mscroll || 0) + 1.5);
    if (pctl.held.u) G.mscroll = Math.max(0, (G.mscroll || 0) - 1.5);
    if (backPress(pctl) || (tap && !inRect(tap, ML_POP))) { G.mlOpen = null; sfx('beep'); }
    return;
  }
  const hd = pctl.held.r ? 1 : pctl.held.l ? -1 : 0;   // direction maintenue : petite pause puis défilement continu
  if (hd !== (G.mlHoldD || 0)) { G.mlHoldD = hd; G.mlHoldT = 0; } else if (hd) G.mlHoldT = (G.mlHoldT || 0) + 1;
  const step = hd && (G.mlHoldT === 0 || (G.mlHoldT >= 18 && (G.mlHoldT - 18) % 7 === 0));
  if (step) { const ns = Math.max(0, Math.min(P.length - 1, G.mlSel + hd)); if (ns !== G.mlSel) { G.mlSel = ns; sfx('beep'); } }
  if (tap) { const i = ML_RECTS.findIndex(r => r && inRect(tap, r)); if (i >= 0) { if (i === G.mlSel) { G.mlOpen = P[i].title; G.mscroll = 0; sfx('select'); } else { G.mlSel = i; sfx('beep'); } return; } }
  if (okPress(pctl)) { G.mlOpen = P[G.mlSel].title; G.mscroll = 0; sfx('select'); return; }
  if (backPress(pctl)) { G.showMoves = false; sfx('beep'); }
}
const PAUSE_ITEMS = ['CONTINUE', 'OPTIONS', 'MOVE LIST', 'PHOTO MODE', 'CHARACTER SELECT', 'BACK TO TITLE'];
const pauseItems = () => LS.on ? ['CONTINUE', 'CHARACTER SELECT', 'BACK TO TITLE'] : isTouch ? PAUSE_ITEMS : ['CONTINUE', 'ADD CONTROLLERS', ...PAUSE_ITEMS.slice(1)];   // en ligne SYNC : même menu sur les deux téléphones   // PC / Mac : ADD CONTROLLERS sous CONTINUE (QR codes P1 / P2)   // OPTIONS juste sous CONTINUE
// ordre d'affichage : FULL SCREEN en premier ; sur PC : KEYBOARD et GAMEPAD ; en bas : installer l'application (9)
const optOrder = () => { const o = isTouch && !padOn() ? [6, 2, 1, 11, 0, 3, 10, 4, 5] : [6, 2, 1, 11, 0, 3, 10, 4, 5, 7, 8];   /* 11 : TIME 99 / OFF */   /* DIFFICULTY puis FIGHTERS ENERGY en haut (écran titre et pause) */   /* en combat : DIFFICULTY en premier */ if (installAvail()) { if (isTouch) o.unshift(9); else o.push(9); } return fsAvail() && !isTouch ? o : o.filter(i => i !== 6); };   // mobile : ADD TO HOME SCREEN toujours en premier   // mobile : pas de FULL SCREEN dans OPTIONS (choisi au premier écran)   // iPhone (navigateur) : pas de plein écran possible, option cachée
const optL = () => optOrder()[G.ocur] != null ? optOrder()[G.ocur] : -1;
const OPT_BACK = () => optOrder().length;
const optPC = () => !(isTouch && !padOn());
const BIND_ROWS = [['l', 'LEFT'], ['r', 'RIGHT'], ['u', 'UP'], ['d', 'DOWN'], ['p', 'PUNCH (Y)'], ['k', 'KICK (B)'], ['s', 'SPECIAL (A)'], ['x', 'COUNTER (X)'], ['start', 'START / PAUSE'], ['back', 'BACK']];
const bindRows = () => G.showKeys === 'pad' ? [['type', 'CONTROLLER'], ...BIND_ROWS.slice(4, 9)] : BIND_ROWS;
function stepKeys() {
  if (bindWait) return;   // en attente d'une touche
  const rows = bindRows(), N = rows.length + 2, m = navStep();
  const kc = Math.max(0, Math.min(N - 1, (G.kcur || 0) + m)); if (kc !== (G.kcur || 0)) { G.kcur = kc; sfx('beep'); }
  const ok = edge(pctl, 's') || edge(pctl, 'start');
  if (edge(pctl, 'back') || (ok && G.kcur === N - 1)) { G.showKeys = null; sfx('beep'); return; }
  if (rows[G.kcur] && rows[G.kcur][0] === 'type') {   // type de manette : < > ou A pour changer
    const l = edge(pctl, 'l'), r = edge(pctl, 'r');
    if (l || r || ok) { padType = (padType + (l ? 4 : 1)) % 5; try { localStorage.setItem('sf2padtype', padType); } catch (e) {} padApplyDefault(); padKindLast = padKind(); sfx('select'); }
    return;
  }
  if (!ok) return;
  if (G.kcur === N - 2) {   // réinitialiser
    if (G.showKeys === 'pad') { padApplyDefault(); padKindLast = padKind(); } else KEYS = Object.assign({}, KEY_DEF);
    saveKeys(); sfx('select'); return;
  }
  bindWait = { dev: G.showKeys, act: rows[G.kcur][0] }; keys.clear(); sfx('beep');
}
function stepOptions() {
  if (G.showKeys) { stepKeys(); return; }
  const OB = OPT_BACK();
  const m = navStep(), oc = Math.max(0, Math.min(OB, G.ocur + m)); if (oc !== G.ocur) { G.ocur = oc; sfx('beep'); }
  const l = edge(pctl, 'l'), r = edge(pctl, 'r'), ok = edge(pctl, 's') || edge(pctl, 'start');
  if (backPress(pctl) || (ok && G.ocur === OB)) { G.showOpts = false; sfx('beep'); return; }
  const L = G.ocur === OB ? -1 : optL();
  if (L === 6 && ok && G.fsDone !== G.frame && G.frame - (G.fsDone || -99) > 2) {   // plein écran (tactile / manette)
    OPT.full = !OPT.full; saveOpt(); sfx('select'); G.fsDone = G.frame;
    if (OPT.full) enterFS(); else exitFS();   // sur mobile, l'entrée se fait au prochain toucher si le navigateur la refuse ici
  }
  if (L === 9 && ok) { sfx('select'); doInstall(); return; }
  if (optPC() && ok && (L === 7 || L === 8)) { G.showKeys = L === 7 ? 'kb' : 'pad'; G.kcur = 0; sfx('select'); return; }
  if (L === 5 && (l || r || ok)) {
    OPT.sfx = l ? Math.max(0, OPT.sfx - 1) : r ? Math.min(4, OPT.sfx + 1) : (OPT.sfx + 1) % 5;
    saveOpt(); sfx('select');
  }
  if (L === 4 && (l || r || ok)) {
    OPT.music = l ? Math.max(0, OPT.music - 1) : r ? Math.min(4, OPT.music + 1) : (OPT.music + 1) % 5;
    saveOpt(); sfx('select');
  }
  if (L === 3 && ok) { OPT.blood = !OPT.blood; saveOpt(); sfx('select'); }
  if (L === 11 && (l || r || ok)) { OPT.time = OPT.time === false; saveOpt(); sfx('select'); }   // TIME : 99 / OFF
  if (L === 10 && (l || r || ok)) { OPT.guides = !OPT.guides; saveOpt(); sfx('select'); }   // GUIDES : SHOW / HIDE
  if (L === 2 && (l || r || ok)) {
    { const ord = G.mode === 'arcade' && G.arc ? DIFF_ORDER.filter(v => v !== 3) : DIFF_ORDER, k = Math.max(0, ord.indexOf(OPT.diff)), n = ord.length; OPT.diff = ord[(k + (l ? n - 1 : 1)) % n]; }   // ARCADE : pas de TRAINING   // en boucle : EASY, NORMAL, HARD, EXTREME, TRAINING
    saveOpt(); sfx('select');
  }
  if (L === 0 && (l || r || ok)) { const k = Math.max(0, ZOOMS.indexOf(OPT.zoom)); OPT.zoom = ZOOMS[(k + (l ? 3 : 1)) % 4]; saveOpt(); sfx('select'); }
  if (L === 1 && (l || r || ok)) {
    OPT.energy = l ? Math.max(1, OPT.energy - 1) : r ? Math.min(3, OPT.energy + 1) : OPT.energy % 3 + 1;
    saveOpt(); sfx('select');
  }
}
function stepPhoto() {   // MODE PHOTO : stick = déplacer, Y = dézoomer, X = zoomer, A = photo, B = retour au menu pause
  const P = G.photo, h = pctl.held;
  if (P.msgT > 0) { P.msgT--; if (!P.msgT) P.clean = true; return; }
  const any = BTNS.some(b => edge(pctl, b)) || edge(pctl, 'start') || ['l', 'r', 'u', 'd'].some(b => edge(pctl, b));
  if (P.clean) { if (any || P.tapped) { P.clean = false; P.tapped = false; document.body.classList.remove('photoclean'); } return; }   // n'importe quelle touche : les boutons réapparaissent
  if (backPress(pctl)) { G.photo = null; document.body.classList.remove('photoclean'); sfx('beep'); return; }
  if (edge(pctl, 's') || entKb()) { P.msgT = 60; document.body.classList.add('photoclean'); sfx('select'); return; }
  const sp = 3 / P.z; if (h.l) P.l -= sp; if (h.r) P.l += sp; if (h.u) P.t -= sp; if (h.d) P.t += sp;
  const zf = h.x ? 1.02 : h.p ? 1 / 1.02 : 1;
  if (zf !== 1) { const cx = P.l + W / P.z / 2, cy = P.t + H / P.z / 2; P.z *= zf; P.l = cx - W / P.z / 2; P.t = cy - H / P.z / 2; }
}
document.addEventListener('touchstart', () => { if (G.photo && G.photo.clean) G.photo.tapped = true; }, { passive: true });
function stepPause() {
  if (G.photo) { stepPhoto(); return; }
  if (G.pconf != null) {   // « ARE YOU SURE TO QUIT THE FIGHT ? » YES / NO
    if (edge(pctl, 'l') || edge(pctl, 'r') || navStep()) { G.pconf = 1 - G.pconf; sfx('beep'); }
    if (backPress(pctl)) { G.pconf = null; sfx('beep'); }
    else if (edge(pctl, 's') || edge(pctl, 'start')) { sfx('select'); if (G.pconf === 0) { G.pconf = null; goTitle(); } else G.pconf = null; }
    return;
  }
  if (!G.showKeys && !G.qrPop && ((edge(pctl, 'start') && !entKb()) || (edge(p2ctl, 'start') && !entRecent()))) { G.paused = false; G.showOpts = false; G.showMoves = false; sfx('beep'); return; }   // START = reprendre le combat, même depuis OPTIONS / MOVE LIST (seul A change une option)   // START (manette) / ENTRÉE (clavier) = reprendre le combat directement
  if (G.showMoves) { stepMoves(); return; }
  if (G.showOpts) { stepOptions(); return; }
  if (G.qrPop) { if (backPress(pctl) || okPress(pctl)) { G.qrPop = false; sfx('beep'); } return; }   // fenêtre ADD CONTROLLERS
  const PI = pauseItems(), n = PI.length, m = navStep();
  const pc = Math.max(0, Math.min(n - 1, G.pcur + m)); if (pc !== G.pcur) { G.pcur = pc; sfx('beep'); }
  if (backPress(pctl)) { G.paused = false; sfx('beep'); return; }   // B (ou ÉCHAP) = annuler la pause
  if (edge(pctl, 's') || entKb()) {   // A (ou ENTRÉE sur PC) = valider le choix
    sfx('select');
    const it = PI[G.pcur];
    if (it === 'ADD CONTROLLERS') { G.qrPop = true; return; }
    if (it === 'CONTINUE') G.paused = false;
    else if (it === 'OPTIONS') { G.showOpts = true; G.ocur = 0; }
    else if (it === 'MOVE LIST') { G.showMoves = true; G.mscroll = 0; G.mlP = 0; G.mlOpen = null; G.mlSel = 0; G.mlPos = 0; }
    else if (it === 'PHOTO MODE') { G.photo = { z: G.zoom || 1, l: G.camL || 0, t: H - H / (G.zoom || 1), clean: false, msgT: 0 }; }   // MODE PHOTO
    else if (it === 'CHARACTER SELECT') { G.paused = false; G.scene = 'select'; G.t = 0; G.shake = 0; G.quakeT = 0; }
    else G.pconf = 1;   // BACK TO TITLE : confirmation (NO par défaut)
  }
}
/* ---------------- Musiques ---------------- */
const BGM = new Audio(); BGM.loop = true; BGM.preload = 'auto';
const MUSIC = { title: 'music/music_title.mp3', select: 'music/music_select.mp3', dojo: 'music/music_dojo.mp3', city: 'music/music_city.mp3',
  alley: 'music/back-halley.mp3', temple: 'music/misty-temple.mp3', hall: 'music/gargoyle-hall.mp3', lab: 'music/bio-lab.mp3', terrace: 'music/inferno-terrace.mp3', ring: 'music/underground-ring.mp3' };
let bgmKey = null, bgmUnlocked = false, bgmGain = null, bgmMul = 1;
const MUSIC_MAX = .55;   // niveau maximal de la musique (les MP3 sont mixés fort)
// Le volume d'un élément <audio> est ignoré sur iPhone/iPad : on fait passer la musique par Web Audio (GainNode)
function bgmRoute() {
  if (bgmGain || location.protocol === 'file:') return;   // en local (file://) Web Audio rendrait la musique muette
  initAudio(); if (!AC) return;
  try { const src = AC.createMediaElementSource(BGM); bgmGain = AC.createGain(); src.connect(bgmGain).connect(AC.destination); BGM.volume = 1; if (CAST.dest) bgmGain.connect(CAST.dest); }
  catch (e) { bgmGain = null; }
}

/* ---------------- DÉMO (écran titre) ----------------
   2 s après le logo : fondu, 5 s de combat entre CPU, puis retour au travelling.
   Cycle de 3 démos : combat normal, Nitro + NITRO COMBO, Surge + NITRO SURGE COMBO */
const DEMO_T = 300, DEMO_FADE = 20, DEMO_WAIT = 180;   // démo : 3 s après le logo
const DEMO_PAIRS = [[0, 1], [6, 2], [3, 5], [4, 7], [1, 6], [7, 0], [5, 4], [2, 3]];
function startDemo() {
  const n = G.demoN || 0, i = n % 3, [p1, p2] = DEMO_PAIRS[n % DEMO_PAIRS.length];
  const keepDiff = OPT.diff; if (OPT.diff === 3 || OPT.diff === 0) OPT.diff = 1;
  startMatch(p1, p2, STAGES[n % STAGES.length][0]);
  G.demoDiff = keepDiff;
  const [a, b] = G.f;
  a.cpu = true; a.ctl = makeCtl(); b.cpu = true; b.ctl = makeCtl();
  a.x = SW / 2 - 46; b.x = SW / 2 + 46;
  G.preT = 0; G.scene = 'fight'; G.fighting = true; G.t = 0; G.timer = 99;
  G.demo = { i, t: 0 }; G.noWipe = true; G.fadeK = 1;
}
function endDemo(toMenu) {
  const i = G.demo ? G.demo.i : 0;
  G.demo = null; G.demoN = (G.demoN || 0) + 1; G.noWipe = true; G.fadeK = 1;
  if (G.demoDiff != null) { OPT.diff = G.demoDiff; G.demoDiff = null; }
  G.fbs = []; G.supers = []; G.ghostQ = []; G.freeze = 0; G.shake = 0; G.quakeT = 0; G.darkT = 0; G.flashT = 0; G.bigPop = null;
  G.scene = 'title'; G.paused = false; G.introNoPres = true; G.demoOut = 0;
  if (toMenu) { G.tstate = 1; G.tcur = 0; G.tmenu = 0; G.t = SPLASH + INTRO_LOGO + 200; sfx('select'); sfx('heavy'); }
  else { G.tstate = 0; G.t = SPLASH + INTRO_T0; G.logoAt = null; }
}
function stepDemo() {   // script de la démo : Nitro / Surge déclenchés puis enchaînement spectaculaire
  const D = G.demo; if (!D) return;
  D.t++;
  const [a, b] = G.f;
  if (D.t < DEMO_FADE) G.fadeK = 1 - D.t / DEMO_FADE;
  else if (D.t > DEMO_T) G.fadeK = Math.min(1, (D.t - DEMO_T) / DEMO_FADE);
  else G.fadeK = 0;
  G.timer = 99; [a, b].forEach(f => { f.hp = Math.max(f.hp, 20); });   // pas de K.O. pendant la démo
  if (D.i > 0) {
    if (D.t === 30) powerUp(a, b, D.i === 2);
    if (D.t === 85 && !a.air) {   // NITRO COMBO (et coup chargé pour le Surge)
      b.x = a.x + a.dir * 34; b.air = false; b.y = GROUND; setState(b, 'hit'); b.stun = 40; face(a, b);
      setState(a, 'nrush'); a.rushN = 0; a.rushDebt = 0; a.vx = 0; a.rushSuper = D.i === 2;
      addPopup(b.x, b.y - 100, 'NITRO RUSH!', '#5aff8a');
    }
  }
  if (D.t >= DEMO_T + DEMO_FADE) endDemo(false);
}
function musicWanted() {
  if (G.demo) return 'title';   // démo : la musique du titre continue
  if (G.scene === 'ending') return G.t < 50 ? bgmKey : 'title';   // fin ARCADE : la musique s'arrête puis le thème principal
  if (G.scene === 'title') return 'title';
  if (G.scene === 'select' || G.scene === 'stage' || G.scene === 'over') return 'select';
  return MUSIC[G.stage] ? G.stage : 'city';   // musique propre à chaque décor (sinon celle de la ville)
}
function updateMusic() {
  const want = musicWanted();
  if (want !== bgmKey) {   // fondu sortant de l'ancienne musique, puis fondu entrant de la nouvelle
    if (!BGM.src || BGM.paused || bgmMul <= 0) { bgmKey = want; BGM.src = MUSIC[want] + '?v=173'; BGM.currentTime = 0; bgmMul = 0; if (bgmUnlocked && OPT.music > 0 && !G.musicHold) BGM.play().catch(() => {}); }
    else bgmMul = Math.max(0, bgmMul - 1 / 36);
  } else bgmMul = Math.min(1, bgmMul + 1 / 60);
  let musF = 1;
  if (G.scene === 'ending') musF = G.t < 50 ? Math.max(0, 1 - G.t / 40) : G.end && G.end.out ? Math.max(0, 1 - G.end.out / 40) : 1;
  if (G.musIn > 0) { G.musIn--; musF = 1 - G.musIn / 70; }
  if (G.tut && ['intro', 'fight', 'ko', 'timeup'].includes(G.scene)) musF = 0;   // TUTORIAL : pas de musique   // retour à l'écran titre : fondu entrant
  const vol = Math.max(0, Math.min(1, OPT.music / 4 * MUSIC_MAX * (G.paused ? .4 : 1) * bgmMul * musF));
  if (bgmGain) bgmGain.gain.value = vol; else BGM.volume = vol;   // réglage appliqué en temps réel
  if (bgmGain && AC && AC.state !== 'running' && bgmUnlocked && !document.hidden) AC.resume().catch(() => {});
  if (OPT.music === 0 && !BGM.paused) BGM.pause();
  else if (OPT.music > 0 && bgmUnlocked && BGM.paused && BGM.src && !G.musicHold) BGM.play().catch(() => {});
}
// Les navigateurs n'autorisent le son qu'après une action de l'utilisateur
const unlockAudio = () => {
  if (bgmUnlocked) { if (!bgmGain) bgmRoute(); if (G.gate) G.gate = false; return; }
  bgmUnlocked = true; G.gate = false;
  bgmRoute();
  if (!BGM.src) { bgmKey = musicWanted(); BGM.src = MUSIC[bgmKey] + '?v=173'; }
  if (OPT.music > 0 && !G.musicHold) BGM.play().catch(() => { bgmUnlocked = false; });
};
['keydown', 'pointerdown', 'touchstart'].forEach(ev => addEventListener(ev, unlockAudio, { capture: true, passive: true }));
['touchend', 'click', 'keyup'].forEach(ev => addEventListener(ev, () => initAudio(), { capture: true, passive: true }));   // iPhone : le son ne se débloque qu'au relâchement du doigt
// La musique démarre avec le logo Super Rocket Games : lecture automatique tentée dès l'ouverture.
// Si le navigateur la bloque (il exige une action du joueur), un écran « PRESS ANY KEY / TAP TO START » précède le logo.
G.gate = false;
// Chargement : images (portraits, décors, titre, logos) avant de lancer le jeu ; affiché au moins 1,2 s
const LOAD_T0 = performance.now();
function loadList() { return [SRG, POSTER, LOGO_NSF, TITLE_IMG]; }   // chargement de départ : seulement l'intro, l'écran titre et sa musique (le reste en arrière-plan)
// musique du titre : on attend qu'elle soit prête (au plus 3 s : certains navigateurs mobiles ne la chargent qu'à la lecture)
const musicReady = () => BGM.readyState >= 3 || /iPhone|iPad|iPod/.test(navigator.userAgent) || performance.now() - LOAD_T0 > 3000;
let loadOk = false;
const loadProgress = () => {
  if (loadOk) return 1;
  const L = loadList(), n = L.filter(im => im.complete).length + (musicReady() ? 1 : 0), tk = Math.min(1, (performance.now() - LOAD_T0) / 400);
  const p = Math.min(n / (L.length + 1), tk);
  if (p >= 1) { loadOk = true; lazyStart(); }   // le reste se charge en arrière-plan
  return p;
};
const loadDone = () => loadProgress() >= 1;
G.musicHold = true;   // la musique démarre 1 s après l'apparition du logo
// Écran de démarrage : choix du plein écran, conseil volume, bouton START (l'appui autorise aussi le son)
G.boot = true;
const IPHONE = /iPhone|iPod/.test(navigator.userAgent);
const fsAvail = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || (document.documentElement.webkitRequestFullscreen && !IPHONE));
G.bcur = fsAvail() ? 0 : 1;   // sélecteur d'abord sur FULL SCREEN
/* ---------- Installer l'application (raccourci écran d'accueil / bureau) ---------- */
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
addEventListener('appinstalled', () => { installEvt = null; G.installed = true; G.instHelp = false; });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW && G.boot && !G.swReloaded) { G.swReloaded = true; location.reload(); } });   // nouvelle version installée pendant l'écran de démarrage : on recharge
}
const IOS = IPHONE || /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ANDROID = /Android/i.test(navigator.userAgent);
const isStandalone = () => !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches ||
  (matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement && !document.webkitFullscreenElement));
const installAvail = () => !G.installed && !isStandalone();
const INSTALL_LBL = () => isTouch ? 'ADD TO HOME SCREEN' : 'INSTALL ON DESKTOP';
function doInstall(gesture) {
  if (false && !installEvt && IPHONE && gesture && navigator.share) {   // désactivé : ce menu de partage n'a pas « Sur l'écran d'accueil »   // iPhone : ouvre le menu de partage du navigateur (« Sur l'écran d'accueil »)
    navigator.share({ title: 'Nitro Surge Fighters', url: location.origin + location.pathname }).catch(e => { if (!(e && e.name === 'AbortError')) { G.instHelp = true; G.instOpen = G.frame; } });
    return;
  }
  if (installEvt) {   // Chrome / Edge / Android : vraie fenêtre d'installation
    const e = installEvt; installEvt = null;
    try { e.prompt(); e.userChoice.then(r => { if (r && r.outcome === 'accepted') G.installed = true; }).catch(() => {}); }
    catch (err) { G.instHelp = true; G.instOpen = G.frame; }
  } else { G.instHelp = true; G.instOpen = G.frame; }   // iPhone / Safari / Firefox : mode d'emploi
}
function drawDlIcon(x, y, col) {   // icône « télécharger » (flèche vers le bas + plateau)
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 2); ctx.moveTo(x - 3.5, y - 1.5); ctx.lineTo(x, y + 2); ctx.lineTo(x + 3.5, y - 1.5);
  ctx.moveTo(x - 6, y + 2); ctx.lineTo(x - 6, y + 5); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x + 6, y + 2); ctx.stroke(); ctx.restore();
}
function drawShareIcon(x, y, col) {   // icône « partager » d'iOS (carré ouvert + flèche vers le haut)
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x - 6, y - 2); ctx.lineTo(x - 6, y + 7); ctx.lineTo(x + 6, y + 7); ctx.lineTo(x + 6, y - 2); ctx.lineTo(x + 3, y - 2);
  ctx.moveTo(x, y + 3); ctx.lineTo(x, y - 7); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x, y - 7); ctx.lineTo(x + 3, y - 4); ctx.stroke(); ctx.restore();
}
// Mobile : tutoriel « ADD TO HOME SCREEN » en 3 étapes (images défilables de gauche à droite)
const TUT_ON = () => isTouch;
let tutEl = null;
function tutBuild() {
  tutEl = document.createElement('div'); tutEl.id = 'instTut';
  const arrow = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${d < 0 ? '15 5 8 12 15 19' : '9 5 16 12 9 19'}"/></svg>`;
  tutEl.innerHTML = `<div class="tt-card"><div class="tt-head"><span>ADD TO HOME SCREEN</span><button class="tt-x" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button></div>
    <div class="tt-body"><button class="tt-nav tt-prev" aria-label="Previous">${arrow(-1)}</button><div class="tt-track">${[1, 2, 3].map(i => `<div class="tt-slide"><div class="tt-step">STEP ${i}</div><img src="tut${i}.jpg?v=1" alt="Step ${i}" draggable="false"></div>`).join('')}</div><button class="tt-nav tt-next" aria-label="Next">${arrow(1)}</button></div>
    <div class="tt-dots"><i></i><i></i><i></i></div><div class="tt-help"><span>STICK &lt; &gt; : STEP &nbsp; B : CLOSE</span></div></div>`;
  { const tc = document.getElementById('touch'); if (tc && tc.parentNode) tc.parentNode.insertBefore(tutEl, tc); else document.body.appendChild(tutEl); }   // sous la manette tactile : stick et boutons restent visibles et utilisables
  const tr = tutEl.querySelector('.tt-track');
  tr.addEventListener('scroll', () => { const k = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); tutEl.querySelectorAll('.tt-dots i').forEach((d, i) => d.classList.toggle('on', i === k)); }, { passive: true });
  tutEl.querySelector('.tt-x').addEventListener('click', () => { G.instHelp = false; G.instClosed = G.frame; sfx('beep'); });
  tutEl.querySelector('.tt-prev').addEventListener('click', () => tutGo(-1));
  tutEl.querySelector('.tt-next').addEventListener('click', () => tutGo(1));
}
window.tutIdx = tutIdx;
function tutIdx() { const tr = tutEl && tutEl.querySelector('.tt-track'); return tr ? Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)) : 0; }
function tutGo(d) { const tr = tutEl && tutEl.querySelector('.tt-track'); if (!tr) return; const k = Math.max(0, Math.min(2, tutIdx() + d)); tr.scrollTo({ left: k * tr.clientWidth, behavior: 'smooth' }); sfx('beep'); }
function tutSync() {
  const show = !!G.instHelp && TUT_ON();
  if (show && !tutEl) tutBuild();
  if (!tutEl) return;
  if (show && !tutEl.shown) { tutEl.shown = true; tutEl.style.display = 'flex'; const tr = tutEl.querySelector('.tt-track'); tr.scrollLeft = 0; tutEl.querySelectorAll('.tt-dots i').forEach((d, i) => d.classList.toggle('on', i === 0)); }
  if (!show && tutEl.shown) { tutEl.shown = false; tutEl.style.display = 'none'; }
}
function drawInstHelp() {   // mode d'emploi quand le navigateur n'a pas de fenêtre d'installation
  if (TUT_ON()) { R(0, 0, W, H, 'rgba(0,0,0,.7)'); return; }   // mobile : tutoriel en images (HTML)
  R(0, 0, W, H, 'rgba(0,0,0,.7)');
  const PW = 260, WH = '#ffffff', DIM = 'rgba(255,255,255,.55)';
  R(CX - PW / 2, 36, PW, 144, '#0e0816');
  panel(36, 144, INSTALL_LBL(), true, PW);
  const x0 = CX - PW / 2 + 22, at = G.frame - (G.instOpen || 0);
  const ap = (t0, fn) => { const k = Math.min(1, (at - t0) / 14); if (k <= 0) return; const e = 1 - Math.pow(1 - k, 3); ctx.save(); ctx.globalAlpha = e; ctx.translate(Math.round(-16 * (1 - e)), 0); fn(); ctx.restore(); };   // apparition : phrase 1, puis phrase 2, puis la suite
  if (IOS) {
    ap(6, () => { text('1. TAP THE SHARE BUTTON', x0, 68, 8, WH, 'left'); { const ix = CX + PW / 2 - 30, iy = 71; ctx.save(); ctx.strokeStyle = WH; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ix - 2, iy - 2.5); ctx.lineTo(ix - 4.5, iy - 2.5); ctx.lineTo(ix - 4.5, iy + 6.5); ctx.lineTo(ix + 4.5, iy + 6.5); ctx.lineTo(ix + 4.5, iy - 2.5); ctx.lineTo(ix + 2, iy - 2.5); ctx.moveTo(ix, iy + 3); ctx.lineTo(ix, iy - 7); ctx.moveTo(ix - 2.5, iy - 4.5); ctx.lineTo(ix, iy - 7); ctx.lineTo(ix + 2.5, iy - 4.5); ctx.stroke(); ctx.restore(); } });   // icône de partage (calque pixel)
    ap(6, () => { text('   OF THE BROWSER TOOLBAR', x0, 80, 8, DIM, 'left'); });
    ap(30, () => { text('2. ADD TO HOME SCREEN', x0, 96, 8, WH, 'left'); { const ix = CX + PW / 2 - 30, iy = 99; ctx.save(); ctx.strokeStyle = WH; ctx.lineWidth = 1; ctx.strokeRect(ix - 4.5, iy - 4.5, 9, 9); ctx.beginPath(); ctx.moveTo(ix, iy - 2.5); ctx.lineTo(ix, iy + 2.5); ctx.moveTo(ix - 2.5, iy); ctx.lineTo(ix + 2.5, iy); ctx.stroke(); ctx.restore(); } });   // icône « + » de l'écran d'accueil
    ap(30, () => { text('   (SCROLL DOWN THE MENU)', x0, 108, 8, DIM, 'left'); });
    ap(54, () => { text('THEN OPEN THE GAME FROM', CX, 126, 8, DIM, 'center'); text('ITS ICON: FULL SCREEN', CX, 138, 8, DIM, 'center'); });
  } else if (ANDROID || isTouch) {
    ap(6, () => { text('1. OPEN THE BROWSER MENU', x0, 74, 8, WH, 'left'); });
    ap(6, () => { ctx.fillStyle = WH; for (let i = 0; i < 3; i++) ctx.fillRect(CX + PW / 2 - 31, 73 + i * 4, 2, 2); });
    ap(30, () => { text('2. ADD TO HOME SCREEN', x0, 98, 8, WH, 'left'); drawDlIcon(CX + PW / 2 - 30, 101, WH); });
    ap(54, () => { text('THEN OPEN THE GAME FROM', CX, 126, 8, DIM, 'center'); text('ITS ICON: FULL SCREEN', CX, 138, 8, DIM, 'center'); });
  } else {
    ap(6, () => { text('1. OPEN THE BROWSER MENU', x0, 74, 8, WH, 'left'); });
    ap(30, () => { text('2. INSTALL THE GAME', x0, 92, 8, WH, 'left'); drawDlIcon(CX + PW / 2 - 30, 95, WH); });
    ap(30, () => { text('   (SAFARI: FILE > ADD TO DOCK)', x0, 106, 8, DIM, 'left'); });
    ap(54, () => { text('WORKS WITH CHROME, EDGE', CX, 126, 8, DIM, 'center'); text('AND SAFARI', CX, 138, 8, DIM, 'center'); });
  }
  ap(70, () => { text('PRESS ' + bootKeys()[1] + ' TO CLOSE', CX, 162, 8, '#ffffff', 'center'); });   // B (mobile) / K (PC) pour fermer
}
// écran de démarrage en 2 temps : 1) FULL SCREEN < OFF / ON > + PRESS A  2) START + PRESS A TO CONFIRM / B TO GO BACK
const bootStep = () => isStandalone() ? 1 : fsAvail() ? (G.bootStep || 0) : 1;   // lancé depuis l'icône : START / DOWNLOAD OFFLINE MODE
const bootItems = () => { const o = []; if (bootStep() === 0) { o.push(0); if (installAvail()) o.push(2); } else { o.push(1); if (isStandalone() && offAvail() && G.offState !== 'ready') o.push(3); else if (!fsAvail() && installAvail()) o.push(2); } return o; };   // iPhone : ADD TO HOME SCREEN pour le plein écran
const bootKeys = () => !isTouch && !padOn() ? [keyName(KEYS.s), keyName(KEYS.k)] : ['A', 'B'];   // PC : touches du clavier ; mobile / manette : A et B
function bootBack() { if (bootStep() === 1 && fsAvail()) { G.bootStep = 0; G.bcur = 0; sfx('beep'); } }
function bootMove(m) { const L = bootItems(); let i = L.indexOf(G.bcur); if (i < 0) i = L.length - 1; i = Math.max(0, Math.min(L.length - 1, i + m)); if (L[i] !== G.bcur) { G.bcur = L[i]; sfx('beep'); } }
// ---- MODE HORS LIGNE (app lancée depuis l'écran d'accueil) ----
const offAvail = () => 'serviceWorker' in navigator && 'caches' in window && (location.protocol === 'https:' || location.hostname === 'localhost');
G.offState = 'none'; G.offPct = 0;
if (offAvail()) caches.open('nsf-offline-v1').then(c => c.match('__offline_ready__')).then(r => { if (r) G.offState = 'ready'; }).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  const d = e.data || {}; if (d.type !== 'offline') return;
  if (d.error) { G.offState = 'err'; return; }
  G.offPct = d.total ? d.done / d.total : 0;
  if (d.ready === true) { G.offState = 'ready'; G.bcur = 1; sfx('select'); } else if (d.ready === false) G.offState = 'err';
});
function offlineDownload() {
  if (G.offState === 'dl' || G.offState === 'ready') { sfx('beep'); return; }
  G.offState = 'dl'; G.offPct = 0; sfx('select');
  const extra = (performance.getEntriesByType ? performance.getEntriesByType('resource') : []).map(r => r.name).filter(u => u.startsWith(location.origin));   // fichiers déjà chargés (avec leur ?v=)
  extra.push(location.href.split('#')[0]);
  navigator.serviceWorker.ready.then(reg => { (reg.active || navigator.serviceWorker.controller).postMessage({ type: 'download', extra }); }).catch(() => { G.offState = 'err'; });
}
const offLbl = () => G.offState === 'err' ? 'DOWNLOAD FAILED: RETRY' : 'DOWNLOAD OFFLINE MODE';
function bootOk(gesture) { if (bootStep() === 1 && G.bcur === 3) { offlineDownload(); return; } if (bootStep() === 1 && G.bcur === 2 && installAvail()) { sfx('select'); doInstall(gesture); return; } if (bootStep() === 0) { if (G.bcur === 2 && installAvail()) { sfx('select'); doInstall(gesture); } else { G.bootStep = 1; G.bcur = 1; sfx('select'); } } else bootStart(); }
function bootStart() {
  document.body.classList.remove('booting');
  if (!G.boot) return;
  G.boot = false; G.t = 0; G.volT = 0;   // puis message « monte le son », puis logo
  if (OPT.full && fsAvail()) enterFS(); else if (!OPT.full) exitFS();
  unlockAudio(); sfx('select');
}
function bootToggleFS() { OPT.full = !OPT.full; saveOpt(); sfx('beep'); if (OPT.full) enterFS(); else exitFS(); }
const bootRowY = i => { const it = bootItems()[i]; return it === 2 ? 140 : it === 1 ? 86 : 84; };   // INSTALL bien plus bas
addEventListener('keydown', e => {
  if (G.instHelp) { if (G.frame - (G.instOpen || 0) > 10 && ['Enter', 'Escape', 'Space', 'Backspace'].includes(e.code)) { G.instHelp = false; G.instClosed = G.frame; sfx('beep'); e.preventDefault(); e.stopPropagation(); } return; }
  if (!G.boot || !loadDone()) return;
  const k = e.code;
  if (k === 'Enter' || k === KEYS.s) { if (G.bootKey !== G.frame) bootOk(); G.bootKey = G.frame; }
}, true);
// Sur mobile, le navigateur n'autorise le plein écran qu'au RELÂCHEMENT du doigt (pointerup / touchend), pas à l'appui
addEventListener('pointerup', e => {
  if (G.instHelp) { if (!TUT_ON() && G.frame - (G.instOpen || 0) > 20) { G.instHelp = false; G.instClosed = G.frame; } return; }   // tutoriel mobile : on navigue avec la manette, un appui ne ferme pas
  if (G.boot && loadDone()) {
    const r = cv.getBoundingClientRect();
    const p = ROT ? { x: (e.clientY - r.top) / r.height * W, y: (r.right - e.clientX) / r.width * H } : { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    const el = document.elementFromPoint(e.clientX, e.clientY), btn = el && el.closest ? el.closest('.b') : null;
    if (btn && btn.dataset.b === 's' && G.bcur === 2 && bootItems().includes(2)) { G.bootKey = G.frame; bootOk(true); return; }   // bouton A sur ADD TO HOME SCREEN : vrai geste
    const two = bootItems().includes(2);
    if (Math.abs(p.x - CX) < 110) {
      if (bootStep() === 0) {
        if (Math.abs(p.y - 88) < 7) { G.bcur = 0; bootToggleFS(); }                          // FULL SCREEN : OFF / ON
        else if (two && Math.abs(p.y - 102) < 7) { G.bcur = 2; bootOk(true); }                // INSTALL / ADD TO HOME SCREEN
        else if (Math.abs(p.y - (two ? 130 : 118)) < 6) bootOk(true);                                      // PRESS A TO CONFIRM
      } else if (bootItems().length > 1) {
        if (Math.abs(p.y - 74) < 9) { G.bcur = 1; bootStart(); }                             // START
        else if (Math.abs(p.y - 94) < 9) { G.bcur = bootItems()[1]; bootOk(true); }                       // ADD TO HOME SCREEN
        else if (Math.abs(p.y - 128) < 7) bootOk(true);
      }
      else if (Math.abs(p.y - 94) < 14 || Math.abs(p.y - 120) < 6) bootStart();                // START
      else if (Math.abs(p.y - 132) < 6) bootBack();
    }
    return;
  }
  syncFS();
}, true);
addEventListener('touchend', () => { if (!G.boot) syncFS(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) BGM.pause(); });

function step() {
  if (LS.pending) lsBegin(LS.pending);   // début d'un combat en ligne SYNC
  if (G.guest && !LS.on) { G.frame++; guestStep(); tap = null; return; }   // Player 2 en ligne (menus) : il n'envoie que ses touches, il voit la vidéo
  let syncIn = null;
  if (SYNC.src) {   // en ligne (mode SYNC) : touches des deux joueurs pour cette image, échangées par le réseau ; null = pas encore arrivées
    syncIn = SYNC.src(inPack(readPlayer()), inPack(readP2()));
    if (LS.on) tap = null;   // les touchers de l'écran ne sont pas partagés : en ligne, seuls les boutons comptent
    if (!syncIn) { updateMusic(); return; }   // on attend les touches de l'autre téléphone (le combat ne bouge pas)
  }
  updateMusic();
  G.frame++; G.st = (G.st || 0) + 1;
  netSendState();
  if (loadDone()) netStart();   // manettes smartphone : connexion possible dès le démarrage du jeu
  const raw1 = syncIn ? inUnpack(syncIn[0]) : readPlayer(), raw2 = syncIn ? inUnpack(syncIn[1]) : readP2();
  // Menus (écran titre, options, pause, choix du stage, fin de combat) : les deux joueurs connectés peuvent les manipuler
  const menuShared = G.paused || !['intro', 'fight', 'ko', 'timeup', 'score', 'select'].includes(G.scene);
  if (menuShared) for (const b in raw2) if (raw2[b]) raw1[b] = true;
  ctlUpdate(pctl, confuse(raw1, G.f && G.f[0] && G.f[0].ctl === pctl ? G.f[0] : null));
  ctlUpdate(p2ctl, confuse(raw2, G.f && G.f[1] && G.f[1].ctl === p2ctl ? G.f[1] : null));
  if (G.instHelp && TUT_ON()) { if (edge(pctl, 'l')) tutGo(-1); else if (edge(pctl, 'r')) tutGo(1); else if (edge(pctl, 's')) { if (tutIdx() >= 2) { G.instHelp = false; G.instClosed = G.frame; sfx('beep'); } else tutGo(1); } else if (G.frame - (G.instOpen || 0) > 10 && (edge(pctl, 'back') || edge(pctl, 'k') || edge(pctl, 'start'))) { G.instHelp = false; G.instClosed = G.frame; sfx('beep'); } tap = null; return; }   // tutoriel : < > / A = étape suivante, B = fermer
  if (G.instHelp) { if (G.frame - (G.instOpen || 0) > 10 && (edge(pctl, 's') || edge(pctl, 'back') || edge(pctl, 'start') || edge(pctl, 'p') || edge(pctl, 'k'))) { G.instHelp = false; G.instClosed = G.frame; sfx('beep'); } tap = null; return; }
  if (G.instClosed != null && G.frame - G.instClosed < 3) { tap = null; return; }

  if (G.demo) {   // démo : n'importe quelle touche ramène à l'écran titre
    if (BTNS.some(b => edge(pctl, b)) || edge(pctl, 'start') || edge(pctl, 'back') || tap) { endDemo(true); tap = null; return; }
    stepDemo(); if (!G.demo) { tap = null; return; }
  }
  // Pause (bouton START) pendant le combat
  if (['intro', 'fight', 'ko', 'timeup'].includes(G.scene)) {
    if (G.paused) { stepPause(); tap = null; return; }
    if (edge(pctl, 'start') || edge(p2ctl, 'start')) { G.paused = true; G.pcur = 0; G.pconf = null; G.showMoves = false; G.showOpts = false; sfx('select'); tap = null; return; }
  }

  switch (G.scene) {
    case 'title': {
      // l'intro (logo Super Rocket Games) ne démarre qu'une fois le message "Rotate your phone" fermé
      if (G.tstate !== 1 && G.t < SPLASH && rotateShown()) { G.t = 0; break; }
      if (G.tstate !== 1 && G.t < 2 && (G.boot || !loadDone())) { G.t = 0; if (G.boot && loadDone()) { const m = navStep(); if (m) bootMove(m); if (bootStep() === 0 && G.bcur === 0 && (edge(pctl, 'l') || edge(pctl, 'r'))) bootToggleFS(); if ((edge(pctl, 's') || edge(pctl, 'start')) && G.bootKey !== G.frame && G.frame - (G.bootKey || -9) > 2 && !(isTouch && G.bcur === 2)) { G.bootKey = G.frame; bootOk(); } else if (backPress(pctl)) bootBack(); } break; }   // chargement puis écran de démarrage
      if (G.volT != null && G.volT < VOL_N) {   // message « monte le son » avant le logo (passable)
        G.volT++; G.t = 0;
        if (G.volT > 15 && (BTNS.some(b => edge(pctl, b)) || edge(pctl, 'start') || tap)) { G.volT = VOL_N; G.t = SPLASH + INTRO_T0; G.logoAt = INTRO_T0; G.introNoPres = true; sfx('select'); }   // une touche : directement le logo + PRESS ANY KEY
        tap = null; break;
      }
      if (G.musicHold && (G.t >= 60 || G.tstate === 1)) { G.musicHold = false; BGM.currentTime = 0; }   // 1 s après l'apparition du logo
      G.t++;
      if (G.showMoves) { stepMoves(); break; }
      if (G.showOpts) { stepOptions(); break; }
      const any = BTNS.some(b => edge(pctl, b)) || edge(pctl, 'start') || tap;
      if (G.tstate !== 1) {
        if (G.t <= SPLASH + INTRO_LOGO && G.logoAt == null && any && G.t > 10) { if (G.t < SPLASH + INTRO_T0) { G.t = SPLASH + INTRO_T0; G.introNoPres = true; } G.logoAt = G.t - SPLASH; sfx('select'); break; }   // une touche pendant l'intro : le logo + PRESS ANY KEY apparaissent tout de suite (le travelling continue)
        if (G.t < SPLASH) break;
        if (G.t > SPLASH + INTRO_LOGO + 40 && !any && G.t - SPLASH > INTRO_LOGO + DEMO_WAIT) {   // 2 s après le logo : fondu vers une démo
          G.demoOut = (G.demoOut || 0) + 1; G.fadeK = Math.min(1, G.demoOut / DEMO_FADE);
          if (G.demoOut >= DEMO_FADE) { startDemo(); break; }
        }
        if ((G.t > SPLASH + INTRO_LOGO || G.logoAt != null) && any) { G.demoOut = 0; G.fadeK = 0; G.tstate = 1; G.tcur = 0; G.tmenu = 0; sfx('select'); sfx('heavy'); }   // n'importe quelle touche : on atterrit sur l'écran titre
      } else {
        G.tmenu = (G.tmenu || 0) + 1;
        const tc = Math.max(0, Math.min(TITLE_ITEMS.length - 1, (G.tcur || 0) + navStep()));
        if (tc !== (G.tcur || 0)) { G.tcur = tc; sfx('beep'); }
        if (tap) { const i = Math.floor((tap.y - 136) / 10); if (i >= 0 && i < TITLE_ITEMS.length) G.tcur = i; else break; }
        if (backPress(pctl)) { G.tstate = 0; G.t = SPLASH + INTRO_T0; G.introNoPres = true; G.logoAt = null; G.tmenu = null; sfx('beep'); }   // retour : on rejoue le travelling et le logo (sans PRESENTS)
        else if (okPress(pctl) || tap) {
          sfx('select');
          if ((G.tcur || 0) <= 2) { G.mode = ['arcade', 'vs', 'tutorial'][G.tcur || 0]; G.arc = null; G.tut = null; G.scene = 'select'; G.selPhase = 0; G.t = 0; }   // ARCADE MODE / V.S. BATTLE / TUTORIAL
          else if (G.tcur === 3) { G.showMoves = true; G.mscroll = 0; G.mlOpen = null; G.mlSel = 0; G.mlPos = 0; }
          else { G.showOpts = true; G.ocur = 0; }
        }
      }
      break;
    }
    case 'select': {
      G.t++;
      netStart();   // prépare les QR codes des manettes smartphone
      if (NET.id && !QR[1] && typeof qrcode !== 'undefined') makeQRs();   // bibliothèque QR chargée après coup
      if (G.selGo) { if (G.frame >= G.selGo.f) { const go = G.selGo.go; G.selGo = null; G.pickF = null; go(); } break; }   // flash de validation, puis on continue
      const sc = G.selPhase && p2On() ? p2ctl : pctl;   // le joueur 2 choisit avec sa manette
      if (G.qrPop) {   // fenêtre ADD CONTROLLERS : B (ou ÉCHAP, ou A) pour fermer
        if (backPress(pctl) || backPress(p2ctl) || okPress(pctl) || (tap && !inRect(tap, QR_POP))) { G.qrPop = false; sfx('beep'); }
        break;
      }
      if (G.invPop) {   // fenêtre INVITE A PLAYER
        if (edge(pctl, 'l') || edge(pctl, 'r')) { G.invSel = isTouch ? 1 - (G.invSel || 0) : G.invSel === 1 ? 2 : 1; sfx('beep'); }
        if (tap) { if (!inRect(tap, INV_POP)) G.invPop = false; else if (inRect(tap, INV_L)) G.invSel = 0; else if (inRect(tap, INV_R)) G.invSel = 1; }
        if (backPress(pctl)) { G.invPop = false; sfx('beep'); }
        else if (okPress(pctl) && !isTouch && G.frame - (G.shareF || -99) > 3) { if (G.invSel === 2) doCopy(); else if (G.invSel === 1) doShare(); }   // écran tactile : le partage part au relâché du bouton A (vrai geste)
        break;
      }
      const btnOn = !isTouch;   // PC : bouton « ADD CONTROLLERS » sous la grille ; partout : « INVITE A PLAYER »
      if (btnOn && tap && inRect(tap, ADD_BTN)) { G.qrPop = true; sfx('select'); break; }
      if (tap && !NET.guest && invOK() && inRect(tap, INV_BTN)) { openInvite(); break; }
      {
        let sl = G.sel || 0;
        if (sl === 8) { if (edge(sc, 'u')) sl = G.selBack != null && G.selBack > 3 ? G.selBack : 4; else if (edge(sc, 'd') && !NET.guest && invOK()) sl = 9; }   // ADD CONTROLLERS (sous la grille) ; PC : INVITE A PLAYER juste en dessous
        else if (sl === 9 && btnOn) { if (NET.guest || edge(sc, 'u')) sl = 8; }   // PC : INVITE A PLAYER sous ADD CONTROLLERS
        else if (sl === 9) { if (NET.guest || edge(sc, 'u')) sl = G.selBack != null && G.selBack > 3 ? G.selBack : 4; }   // mobile : INVITE A PLAYER (sous la grille)
        else {
          if (edge(sc, 'l') && sl % 4 > 0) sl--;
          if (edge(sc, 'r') && sl % 4 < 3) sl++;
          if (edge(sc, 'u')) { if (sl > 3) sl -= 4; }
          if (edge(sc, 'd')) { if (sl < 4) sl += 4; else if (btnOn) { G.selBack = sl; sl = 8; } else if (!NET.guest && invOK()) { G.selBack = sl; sl = 9; } }   // mobile : INVITE A PLAYER sous la grille
        }
        if (sl !== (G.sel || 0)) { G.sel = sl; if (sl < 8) G.selAnimF = G.frame; sfx('beep'); }
      }
      if (G.sel === 8 && G.t > 10 && (okPress(sc) || (sc !== pctl && okPress(pctl)))) { G.qrPop = true; sfx('select'); break; }
      if (G.sel === 9 && !NET.guest && invOK() && G.t > 10 && (okPress(sc) || (sc !== pctl && okPress(pctl)))) { openInvite(); break; }
      if (G.t > 10 && (okPress(sc) || (sc !== pctl && okPress(pctl)))) {
        const c = ROSTER[G.sel || 0];
        if (c == null) sfx('block');
        else if (G.selGo) {}   // déjà validé : on attend la fin du flash
        else if (!G.selPhase && G.mode === 'arcade') { G.p1 = c; selPick(0); G.selGo = { f: G.frame + 22, go: arcadeStart }; }   // ARCADE : on enchaîne les combats
        else if (!G.selPhase && G.mode === 'tutorial') { G.p1 = c; selPick(0); G.selGo = { f: G.frame + 22, go: tutStart }; }   // TUTORIAL : contre son double
        else if (!G.selPhase) { G.p1 = c; G.selPhase = 1; selPick(0); }                 // 1) mon personnage
        else { G.p2 = c; selPick(1); G.selGo = { f: G.frame + 22, go: () => { G.selPhase = 0; G.scene = 'stage'; G.t = 0; } }; }    // 2) le CPU
      }
      else if (G.t > 10 && backPress(pctl)) { if (G.selPhase) { G.selPhase = 0; sfx('beep'); } else { goTitle(); sfx('beep'); } }
      break;
    }
    case 'stage': {
      G.t++;
      { const N = STAGES.length, c0 = G.scur || 0;   // grille 4 x 2
        if (edge(pctl, 'l')) { G.scur = (c0 + N - 1) % N; sfx('beep'); }
        if (edge(pctl, 'r')) { G.scur = (c0 + 1) % N; sfx('beep'); }
        if (edge(pctl, 'u') || edge(pctl, 'd')) { G.scur = (c0 + 4) % N; sfx('beep'); } }
      if (G.t > 10 && okPress(pctl)) { if (syncWanted()) lsHostGo(STAGES[G.scur || 0][0]); else startMatch(G.p1, G.p2, STAGES[G.scur || 0][0]); sfx('select'); }
      else if (G.t > 10 && backPress(pctl)) { G.scene = 'select'; G.selPhase = 1; G.t = 0; sfx('beep'); }
      break;
    }
    case 'intro': case 'fight': case 'ko': case 'timeup': case 'score':
      stepFight();
      break;
    case 'ending': stepEnding(); break;
    case 'over':
      G.t++;
      if (G.t === 20 && AC) { const [a, b] = G.f, won = a.cpu === false ? a.wins >= 2 : b.wins >= 2; playSample(won ? 'win' : 'lose', 1.4, VOX, true); }
      if (G.t === 20) { const w = G.f[0].wins >= 2 ? 0 : G.f[1].wins >= 2 ? 1 : -1; G.perfect = w >= 0 && G.hurt && !G.hurt[w]; }   // le vainqueur (joueur ou adversaire) n'a pris aucun coup
      if (G.t === 100 && G.perfect && AC) playSample('perfect', 1.5, VOX, true);   // « PERFECT » juste après « YOU WIN »   // annonceur : « YOU WIN » / « YOU LOSE »
      { const won = G.f[0].wins >= 2, items = overItems(won);
        if (G.mode === 'arcade' && G.arc && won && arcLast()) { if (G.t >= 150) startEnding(); break; }   // Lord Vane battu : fin du mode ARCADE
        if (G.t > 30) {
          const m = navStep(), oc = Math.max(0, Math.min(items.length - 1, (G.ocurOver || 0) + m));
          if (oc !== (G.ocurOver || 0)) { G.ocurOver = oc; sfx('beep'); }
          const ok = G.mode === 'arcade' && G.arc && won ? edge(pctl, 's') || edge(pctl, 'start') : okPress(pctl);   // NEXT FIGHT : bouton A
          if (ok) {
            sfx('select');
            if (G.mode === 'arcade' && G.arc) {
              if (won) { G.arc.i++; arcadeFight(); }                                   // combat suivant
              else if ((G.ocurOver || 0) === 0) arcadeFight();                         // CONTINUE : même adversaire
              else goTitle();
            }
            else if ((G.ocurOver || 0) === 0) startMatch(G.p1, G.p2, G.stage);       // RETRY : mêmes personnages, même stage
            else { G.scene = 'select'; G.selPhase = 0; G.t = 0; }
          }
        } }
      break;
  }
  tap = null;
}

function stepFight() {
  const [a, b] = G.f;
  G.t++;

  if (G.scene === 'intro' && G.preT > 0) { G.preT--; G.t = 0; }   // travelling d'ouverture avant « ROUND 1 »
  if (G.scene === 'intro') {
    if (G.t === 1 && !(AC && playSample('r' + Math.min(3, G.round), 1.3, VOX, true))) sfx('beep');   // annonceur : « ROUND 1/2/3 »
    if (G.t === 84 && !(AC && playSample('fight', 1.4, VOX, true))) sfx('go');                       // « FIGHT! »
    if (G.t >= 124) { G.scene = 'fight'; G.fighting = true; G.t = 0; }
  }

  // Entrées
  if (a.cpu && !G.noAI) ctlUpdate(a.ctl, confuse(aiInput(a, b), a));
  if (b.cpu && !G.noAI) ctlUpdate(b.ctl, confuse(aiInput(b, a), b));

  if (G.tut) tutStep();
  if (G.hurt) G.f.forEach((f, i) => { if (f.hp < 100) G.hurt[i] = true; });
  if (G.quakeT > 0) { G.quakeT--; G.shake = Math.max(G.shake, 3 + G.quakeT * .15); }   // vibration prolongée
  if (G.shake > 0) G.shake *= .8;
  if (G.shake < .3) G.shake = 0;
  if (G.freeze > 0) { G.freeze--; return; }
  if (G.slowAll > 0) { G.slowAll--; if (G.frame % 3) return; }   // ralenti général (renvoi d'objet)
  if (G.scene === 'ko' && G.t < 60 && G.t % 2) return; // ralenti du K.O.

  // ralenti : un combattant sous l'effet du contre n'avance qu'une image sur trois
  // Contre contre contre : les deux au ralenti, chacun remplit sa jauge en martelant
  if (G.clash) {
    if (G.tut && G.tut.clashWait) { if (BTNS.some(b2 => edge(pctl, b2)) || edge(pctl, 'start')) { G.tut.clashWait = false; sfx('select'); } return; }   // arrêt sur image : explication du bras de fer
    stepClash(); return;
  }
  for (const [f, o] of [[a, b], [b, a]]) {
    if (f.slowT > 35 && o.counterT > 0 && G.fighting && take(f.ctl, 'x')) { startClash(f, o); return; }
    if (f.slowT > 0 && o.counterT > 0 && G.fighting && !f.ko && take(f.ctl, 's')) startBflip(f);   // contré : A pour s'échapper (au lieu du bras de fer)
  }
  [[a, b], [b, a]].forEach(([f, o]) => {
    nitroInput(f, o);
    if (f.nitroT > 0) { if (--f.nitroT === 0) f.surgeT = 0; }
    if (f.surgeT > 0) f.surgeT--;
    if (f.noSpecT > 0) { f.noSpecT--; if (f.ctl.buf.s > 0) take(f.ctl, 's'); }   // sortie de la fumée : pas de coup spécial pendant 1 s
    if (f.slowT > 0) { f.slowT--; if (G.frame % 3) return; }
    updFighter(f, o);
    if (f.nitroT > 0 && G.frame % 2 === 0 && !f.ko && f.state !== 'nitroUp') updFighter(f, o);   // Nitro : tout va 1,5x plus vite
    powerTrail(f);
    if (f.bfEcho && f.state !== 'bflip') { if (f.echo && f.echo.length) f.echo.shift(); else f.bfEcho = false; }   // échos du bas + A qui s'effacent
    // garde-fou : un état bloqué trop longtemps (jamais terminé) remet le combattant en garde
    if (!f.ko && f.hp > 0 && G.fighting && f.t > 420 && !LONG_ST.includes(f.state)) { f.rotAng = null; f.air = f.y < GROUND - 1; if (f.air) { setState(f, 'fall'); f.vy = 1; } else { f.y = GROUND; f.vx = 0; setState(f, 'idle'); } }
    if (f.state === 'fall' && !f.air && f.t > 90 && !f.ko) { f.y = GROUND; setState(f, 'down'); }
  });
  if (G.flashT > 0) G.flashT--;
  if (G.darkT > 0) G.darkT--;
  [a, b].forEach(f => { if (f.burn > 0) f.burn--; });

  // Boules d'énergie
  for (const fb of G.fbs) {
    fb.x += fb.vx; fb.t++;
    if (fb.bounce) { fb.bvy += .25; fb.y += fb.bvy; const gy = GROUND - 10 * fb.sc; if (fb.y >= gy) { fb.y = gy; fb.bvy = -fb.bounce; addSpark(fb.x, GROUND - 3, 'fb', fb.owner.def.fb); } }   // rebonds au sol (Axel)
    else if (fb.vy) { fb.y += fb.vy; if (fb.y > GROUND - 8) { fb.alive = false; addSpark(fb.x, GROUND - 8, 'fb', fb.owner.def.fb); } }   // boule de feu en diagonale (Hiro en l'air)
    if (fb.y0 != null) fb.y = fb.y0 + Math.sin(fb.t * .16 + fb.ph) * 13;   // ondulation synchronisée des deux boules
    if (fb.x < (G.camL || 0) - 30 || fb.x > (G.camL || 0) + W + 30) fb.alive = false;
  }
  for (let i = 0; i < G.fbs.length; i++) for (let j = i + 1; j < G.fbs.length; j++) {
    const p = G.fbs[i], q = G.fbs[j];
    if (p.alive && q.alive && p.owner !== q.owner && Math.abs(p.x - q.x) < 14 * Math.max(p.sc, q.sc) && Math.abs(p.y - q.y) < 14 * Math.max(p.sc, q.sc)) {
      // la grosse boule de feu (MAX) traverse la petite et continue sa route
      if (p.sc > q.sc) q.alive = false; else if (q.sc > p.sc) p.alive = false; else p.alive = q.alive = false;
      const big = p.sc > q.sc ? p : q.sc > p.sc ? q : p;
      addSpark((p.x + q.x) / 2, p.y, 'fb', big.owner.def.fb); sfx('block');
    }
  }
  for (const fb of G.fbs) {
    if (!fb.alive) continue;
    const def = fb.owner === a ? b : a;
    const hb = underShot(def) && !(fb.bounce && fb.y > GROUND - 26 * fb.sc) ? null : hurtbox(def);   // glissade / saut-poing d'Axel : la boule passe
    if (overlap([fb.x - 12 * fb.sc, fb.y - 11 * fb.sc, fb.x + 12 * fb.sc, fb.y + 11 * fb.sc], hb)) {
      fb.alive = false;
      applyHit(fb.owner, def, fb.big ? FB_BIG : FB_HIT, fb.x + fb.dir * 4, fb.y, fb.x - fb.vx * 10, true);
    }
  }
  G.fbs = G.fbs.filter(fb => fb.alive);
  [a, b].forEach(f => { if (f.fb && !f.fb.alive) f.fb = G.fbs.find(q => q.owner === f && q.alive) || null; });

  // Coups au corps à corps
  for (const [att, def] of [[a, b], [b, a]]) {
    if (att.state === 'uppercut' && def.state === 'fjump' && def.t >= 4) continue;
    if ((att.state === 'rupper' || att.state === 'cpunch') && (def.state === 'kspin' || def.state === 'nyxspin')) continue;   // bas + Y ne contre pas ces rotations
    const hiroUp = x => x.def.twinFb && x.state === 'uppercut';
    if (att.state === 'crushD' && hiroUp(def)) continue;   // le 2e shoryuken d'Hiro gagne contre la descente de Grog
    if (def.state === 'crushD' && !hiroUp(att)) continue;
    if (def.state === 'nyxspin' && att.state !== 'nyxspin') continue;   // le plongeon de Nyx gagne contre tous les coups (seuls les projectiles l'arrêtent)
    if (NORMAL_ATK.includes(att.state) && def.state === 'bflip') continue;   // bas + A gagne contre les coups normaux
    if (NORMAL_ATK.includes(att.state) && (def.state === 'hslide' || (def.def.twinFb && def.state === 'uppercut'))) continue;   // Hiro : ses deux shoryukens gagnent contre les coups normaux   // descente diagonale de Grog : seules les boules de feu / projectiles peuvent la casser   // la roulade de Kael gagne contre bas + Y   // le saut-poing d'Axel gagne contre le shoryuken
    const ab = atkBox(att), hb = hurtbox(def) || (att.state === 'fjump' && def.state === 'uppercut' && !def.ko ? [def.x - 14, def.y - 84, def.x + 14, def.y] : null);
    if (overlap(ab, hb)) {
      att.hasHit = true;
      const sx = (Math.max(ab[0], hb[0]) + Math.min(ab[2], hb[2])) / 2;
      const sy = (Math.max(ab[1], hb[1]) + Math.min(ab[3], hb[3])) / 2;
      applyHit(att, def, ATK[att.state], sx, sy, att.x, false);
    }
  }

  // Les deux combattants restent à l'écran : écart maximal = largeur de l'écran
  { const maxD = W - 40, d = b.x - a.x;
    if (Math.abs(d) > maxD) {
      const ex = Math.abs(d) - maxD, sg = Math.sign(d);
      const am = (a.x - (a.px ?? a.x)) * -sg > 0, bm = (b.x - (b.px ?? b.x)) * sg > 0;   // qui s'éloigne ?
      if (am && !bm) a.x += ex * sg; else if (bm && !am) b.x -= ex * sg; else { a.x += ex * sg / 2; b.x -= ex * sg / 2; }
    } }
  a.px = a.x; b.px = b.x;
  // Séparation des corps
  if (Math.abs(a.y - b.y) < 56 && a.state !== 'held' && b.state !== 'held' && !['down'].includes(a.state) && !['down'].includes(b.state)) {
    const dx = b.x - a.x, minD = 30;
    if (Math.abs(dx) < minD) {
      const push = (minD - Math.abs(dx)) / 2, s = dx === 0 ? (a.dir > 0 ? 1 : -1) : Math.sign(dx);
      a.x -= push * s; b.x += push * s;
      if (a.x < 18) { b.x += 18 - a.x; a.x = 18; }
      if (b.x < 18) { a.x += 18 - b.x; b.x = 18; }
      if (a.x > SW - 18) { b.x -= a.x - (SW - 18); a.x = SW - 18; }
      if (b.x > SW - 18) { a.x -= b.x - (SW - 18); b.x = SW - 18; }
    }
  }

  surgeStep(); updSupers(); updHats(); updZFloor();
  updProps(); updBlood(); updVesper(); updGrog(); updZephyr(); updNyx(); updKael(); updVane(); clashProjectiles(); updToxics();
  // Étincelles
  G.sparks.forEach(s => s.t++);
  G.popups.forEach(pp => pp.t++);
  G.popups = G.popups.filter(pp => pp.t < 50);
  G.sparks = G.sparks.filter(s => s.t < 12);

  if (G.scene === 'fight') {
    G.mTime = (G.mTime || 0) + 1;
    if (OPT.diff !== 3 && OPT.time !== false && !(G.tut && G.tut.phase !== 4) && ++G.tick >= 45) { G.tick = 0; G.timer = Math.max(0, G.timer - 1); }   // entraînement : temps infini
    if (G.demo) { a.hp = Math.max(a.hp, 1); b.hp = Math.max(b.hp, 1); }   // démo : jamais de K.O.
    if (a.hp <= 0 || b.hp <= 0) {
      const loser = a.hp <= 0 ? a : b;
      loser.ko = true;
      endRound(a.hp <= 0 && b.hp <= 0 ? null : (loser === a ? b : a));
      G.koDelay = G.bigPop ? Math.max(0, 75 - G.bigPop.t) : 0; if (G.bigPop) G.bigPop.end = 75;   // NITRO COMBO d'abord, puis K.O.
      G.scene = 'ko'; G.t = 0; sfx('ko'); if (AC) playSample('kov', 1.4, 1, true, .25); G.freeze = 20;   // annonceur : « K.O. ! »
    } else if (G.timer <= 0) {
      endRound(a.hp === b.hp ? null : (a.hp > b.hp ? a : b));
      G.scene = 'timeup'; G.t = 0;
    }
  } else if (G.scene === 'score') {
    if (G.t - SC_IN < SC_RUN && G.t > 6 && (BTNS.some(b => edge(pctl, b) || edge(p2ctl, b)) || edge(pctl, 'start') || tap)) G.t = SC_IN + SC_RUN;   // une touche : calcul terminé tout de suite (avec le son de fin)
    const S = G.score, T = G.t - SC_IN;
    if (T >= 0 && T < SC_RUN && T % 4 === 0) sfx('tally');   // décompte : petit son rapide
    if (T === SC_RUN) sfx('select');                        // fin du calcul : trois notes
    if (G.t > SC_IN + SC_RUN + SC_HOLD) { G.scene = 'over'; G.t = 0; G.ocurOver = 0; }
  } else if (G.scene === 'ko' || G.scene === 'timeup') {
    const w = G.winner;
    if (w && G.t > 100 + (G.koDelay || 0) && !w.air && [...NEUTRAL, 'land'].includes(w.state)) {
      setState(w, 'win'); w.vx = 0;
      if (w.hp >= 100 && G.rPerf == null) { G.rPerf = G.t; if (AC) playSample('perfect', 1.5, VOX, true); }   // round gagné sans prendre de coup
    }
    if (G.t > 260 + (G.scene === 'ko' ? G.koDelay || 0 : 0)) {
      if (G.f.some(f => f.wins >= 2)) { if (G.tut || !G.sc) { G.scene = 'over'; G.t = 0; G.ocurOver = 0; } else startScore(); }
      else { G.round++; startRound(); }
    }
  }
}

/* ---------------- Rendu ---------------- */
function drawFireball(fb) {
  const vy = fb.bounce ? fb.bvy : fb.vy || 0, ang = vy ? Math.atan2(vy * fb.dir, Math.abs(fb.vx) || 1) : 0;   // la boule s'oriente selon sa trajectoire (rebond, diagonale)
  if (ang) { ctx.save(); ctx.translate(Math.round(fb.x), Math.round(fb.y)); ctx.rotate(ang); drawFireball0(fb, 0, 0); ctx.restore(); }
  else drawFireball0(fb, Math.round(fb.x), Math.round(fb.y));
}
function drawFireball0(fb, x, y) {
  const pal = fb.owner.def.fb, d = fb.dir, t = fb.t, S = fb.sc || 1;
  const pulse = 1 + Math.sin(t * .5) * .08;
  // halo lumineux (mélange additif)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 2, x, y, 30 * S * pulse);
  g.addColorStop(0, pal[1] + 'cc'); g.addColorStop(.35, pal[2] + '66'); g.addColorStop(1, pal[3] + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30 * S * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // traînée d'énergie
  for (let i = 5; i >= 1; i--) {
    const wob = Math.sin(t * .6 + i) * 2 * S;
    disc(x - d * i * 6 * S, y + wob, Math.max(2, (10 - i * 1.6) * S) | 0, i > 3 ? pal[3] : pal[2]);
  }
  // corps de la boule
  disc(x, y, 12 * S, pal[3]);
  disc(x + d * S, y, 10 * S, pal[2]);
  disc(x + d * 2 * S, y - S, 7 * S, pal[1]);
  disc(x + d * 3 * S, y - 2 * S, 4 * S, pal[0]);
  R(x + d * 2 * S - S, y - 6 * S, 3 * S, 2 * S, pal[0]);
  // étincelles qui tournent autour
  for (let i = 0; i < 6 + (S > 1 ? 4 : 0); i++) {
    const a = t * .35 + i * Math.PI * 2 / (6 + (S > 1 ? 4 : 0)), r = (13 + (i % 2) * 3) * S;
    R(x + Math.cos(a) * r - 1, y + Math.sin(a) * r * .8 - 1, 2 * S, 2 * S, i % 2 ? pal[0] : pal[1]);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = pal[1] + '55'; ctx.beginPath(); ctx.arc(x + d * 2 * S, y - S, 9 * S, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawSpark(s) {
  const r = 3 + s.t * 2;
  const col = s.type === 'parry' ? ['#ffffff', '#7af0ff'] : s.type === 'block' ? ['#ffffff', '#7ad0ff'] : s.type === 'fb' ? [s.pal[0], s.pal[2]] : ['#ffffff', '#ffd23a'];
  if (s.t > 8 && s.t % 2) return;
  for (let i = 0; i < 8; i++) {
    const ang = i / 8 * Math.PI * 2 + (s.type === 'block' ? .4 : 0);
    const len = i % 2 ? r * .6 : r;
    seg([s.x + Math.cos(ang) * r * .3, s.y + Math.sin(ang) * r * .3], [s.x + Math.cos(ang) * len, s.y + Math.sin(ang) * len], 2, col[i % 2]);
  }
  if (s.t < 4) disc(s.x, s.y, 4 - s.t, col[0]);
}

// ---------- Portraits et grille de sélection (8 cases) ----------
const PORTRAITS = ['p_kaito.jpg', 'p_john.jpg', 'p_vesper.jpg', 'p_grog.jpg', 'p_zephyr.jpg', 'p_nyx.jpg', 'p_kael.jpg', 'p_vane.jpg'].map(src => { const im = new Image(); lazySrc(im, src + '?v=178'); return im; });
const PORTRAITS_HURT = ['p_kaito_hurt.jpg', 'p_john_hurt.jpg', 'p_vesper_hurt.jpg', 'p_grog_hurt.jpg', 'p_zephyr_hurt.jpg', 'p_nyx_hurt.jpg', 'p_kael_hurt.jpg', 'p_vane_hurt.jpg'].map(src => { const im = new Image(); lazySrc(im, src + '?v=178'); return im; });
const PORTRAIT_FACE = [1, -1, 1, 1, 1, 1, 1, 1];   // sens du regard de chaque image : Kaito regarde à droite, John à gauche
// Portraits provisoires dessinés à partir du sprite (en attendant de vraies illustrations)
function makePortrait(i, hurt) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), pal = DEFS[i].fb;
  const bg = g.createRadialGradient(32, 28, 4, 32, 32, 46); bg.addColorStop(0, pal[3]); bg.addColorStop(1, '#06040c');
  g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
  const keep = ctx; ctx = g;   // on réutilise le moteur de dessin du jeu sur ce petit canvas
  try {
    g.save(); g.translate(40, 135); g.scale(1.6, 1.6);
    drawFighter({ def: Object.assign({ idx: i }, DEFS[i]), id: 0, dir: 1, state: 'idle', t: 0, flash: 0, x: 0, y: 0, vx: 0 }, 0, 0);
    g.restore();
  } finally { ctx = keep; }
  if (hurt) {
    g.fillStyle = 'rgba(120,0,0,.25)'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#b01010'; for (const [x, y, h] of [[34, 14, 6], [40, 20, 4], [26, 30, 5], [44, 34, 7]]) g.fillRect(x, y, 1, h);
    g.fillStyle = 'rgba(90,40,120,.55)'; g.fillRect(36, 12, 5, 3);
  }
  return c;
}
const FACE_HURT = [];
function portraitOf(i, hurt) {   // mêmes visages que l'écran de sélection des personnages
  const fc = typeof SEL_FACE !== 'undefined' ? SEL_FACE[i] : null;
  if (fc && fc.complete && fc.naturalWidth) {
    if (!hurt) return fc;
    if (!FACE_HURT[i]) {   // version blessée : voile rouge et traces de sang
      const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d');
      g.drawImage(fc, 0, 0, 160, 160); g.fillStyle = 'rgba(120,0,0,.28)'; g.fillRect(0, 0, 160, 160);
      g.fillStyle = '#b01010'; for (const [x, y, h] of [[85, 35, 15], [100, 50, 10], [65, 75, 12], [110, 85, 17]]) g.fillRect(x, y, 3, h);
      FACE_HURT[i] = c;
    }
    return FACE_HURT[i];
  }
  const arr = hurt ? PORTRAITS_HURT : PORTRAITS;
  if (!arr[i]) { try { arr[i] = makePortrait(i, hurt); } catch (e) { return null; } }
  return arr[i];
}
const ROSTER = [0, 1, 4, 5, 6, 2, 3, 7, null, null];   // Hiro, Axel, Zephyr, Nyx / Kael, Vesper, Grog, Lord Vane   // indices dans DEFS ; null = personnage à venir
function drawPortrait(i, x, y, sz, border, look = 1, hurt = false) {   // look : 1 = regarde à droite, -1 = à gauche
  R(x - 2, y - 2, sz + 4, sz + 4, '#000');
  R(x - 1, y - 1, sz + 2, sz + 2, border || '#c8c8d0');
  const im = i == null ? null : portraitOf(i, hurt);
  const flip = i != null && PORTRAIT_FACE[i] !== look;
  if (im && (im instanceof HTMLCanvasElement || (im.complete && im.naturalWidth))) {
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (flip) { ctx.translate(x + sz, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, sz, sz); }
    else ctx.drawImage(im, x, y, sz, sz);
    ctx.restore();
  } else {
    R(x, y, sz, sz, '#000');
    text('?', x + sz / 2, y + sz / 2 - (sz >= 40 ? 8 : 4), sz >= 40 ? 16 : 8, '#ffffff', 'center');
  }
}
function drawBar(x, w, f, left) {
  R(x - 2, 9, w + 4, 11, '#000');
  R(x - 1, 10, w + 2, 9, '#c8c8d0');
  R(x, 11, w, 7, '#8c0c0c');
  const hw = Math.round(w * f.hp / 100), lw = Math.round(w * f.lag / 100);
  const low = f.hp < 25 && (G.frame >> 3) % 2;
  const col = low ? '#fff27a' : '#f8d030';
  if (left) { R(x, 11, lw, 7, '#ff6a1a'); R(x, 11, hw, 7, col); R(x, 11, hw, 2, '#fff2a8'); }
  else { R(x + w - lw, 11, lw, 7, '#ff6a1a'); R(x + w - hw, 11, hw, 7, col); R(x + w - hw, 11, hw, 2, '#fff2a8'); }
}

function drawHUD() {
  const [a, b] = G.f;
  const PS = 26, bx = 6 + PS + 4, bw = Math.round(CX - 24 - bx);
  drawPortrait(a.def.idx, 6, 4, PS, '#5ac8ff', 1);
  drawPortrait(b.def.idx, W - 6 - PS, 4, PS, '#ff7a6a', -1);
  drawBar(bx, bw, a, true);
  drawBar(W - bx - bw, bw, b, false);
  drawNitroGauge(a, bx, bw, true); drawNitroGauge(b, W - bx - bw, bw, false);
  // Badge K.O.
  const flash = (a.hp < 25 || b.hp < 25) && (G.frame >> 4) % 2;
  R(CX - 22, 7, 44, 15, '#000');
  R(CX - 21, 8, 42, 13, flash ? '#ffffff' : '#d8261c');
  text('KO', CX, 11, 8, flash ? '#d8261c' : '#ffe14a', 'center', '#5a0a06');
  // Chrono
  if (OPT.diff !== 3 && OPT.time !== false) text(String(G.timer).padStart(2, '0'), CX, 26, 16, '#ffffff', 'center');   // TIME : OFF = pas de chrono   // entraînement : pas de chrono ni de symbole
  // Noms + victoires
  text(a.def.name, bx, 30, 8, '#ffffff', 'left');
  text(b.def.name, W - bx, 30, 8, '#ffffff', 'right');
  if (a.cpu === false) text('1P', 6, 35, 8, '#5ac8ff', 'left');
  text(b.cpu ? 'CPU' : '2P', W - 6, 35, 8, '#ff7a6a', 'right');
  drawFeed();   // compteur de combo + textes de combat animés
  for (let i = 0; i < a.wins; i++) drawMedal(bx + 18 + i * 12, 45);
  for (let i = 0; i < b.wins; i++) drawMedal(W - bx - 26 - i * 12, 45);
}
function drawMedal(x, y) {
  disc(x, y, 4, OUT); disc(x, y, 3, '#e8a820'); R(x - 1, y - 2, 2, 2, '#fff2a8');
}

function bigMsg(s, size, col, y = 84) { text(s, W / 2, y, size, col, 'center', '#3a0a04'); }

// Étourdi : étoiles qui tournent au-dessus de la tête + jauge de martelage
function shotIncoming(f) {   // un projectile adverse renvoyable arrive vers moi
  const near = (q, vk, qy) => {
    if (!q || q.owner === f || q.dead || q.alive === false || q.charging) return false;
    const dx = f.x - q.x; if (Math.abs(dx) > 150 || Math.abs(qy - (f.y - 40)) > 70) return false;
    const v = vk ? q[vk] : q.dir; return Math.sign(v) === Math.sign(dx);
  };
  return (G.fbs || []).some(q => near(q, 'vx', q.y)) || (G.blades || []).some(q => near(q, null, q.y)) || (G.sonics || []).some(q => near(q, null, q.y))
    || (G.voids || []).some(q => near(q, 'vx', q.y)) || (G.flasks || []).some(q => near(q, 'vx', q.y)) || (G.holos || []).some(q => near(q, null, q.y - 50));
}
function guideOf(f) {   // aide affichée au-dessus de la tête d'un joueur humain
  if (f.ko || f.hp <= 0) return null;
  const o = G.f[0] === f ? G.f[1] : G.f[0];
  if (f.state === 'nyxglide') return ['A', '#ff80ff'];   // Nyx plane : A pour le plongeon (bulle sous elle)
  if (f.def.kit === 'vane') {   // Vane : X → « HOLD X » pendant la charge, chargé → « A »
    if (f.vxReady > 0) return ['A', '#ff80ff'];
    if (f.state === 'vxcharge' || f.state === 'parry') return ['HOLD X', '#ff80ff'];
  }
  if ((G.props || []).some(p => p.fly && p.fly.target === f && p.fly.owner !== f)) return ['X', '#ffffff'];   // objet lancé sur moi : X pour le renvoyer
  if (!(G.props || []).some(p => p.held === f) && nearProp(f)) return ['X', '#ffffff'];
  if (shotIncoming(f)) return ['XA', '#ffffff'];   // boule de feu, clone, projectile qui arrive : X puis A pour le renvoyer   // objet à portée : X pour le lancer
  if (f.def.kit === 'nyx' && (f.state === 'smokeback' || (G.smokes || []).some(c => c.owner === f && !c.dead && !c.used))) return ['@+A', '#ff80ff'];   // fumée posée (@ = flèche vers l'arrière) : arrière + A pour s'y téléporter
  if (f.nitroT > 0) return [(G.frame / 60 | 0) % 2 ? 'YYBA' : 'YYBB', f.surgeT > 0 ? '#ff80ff' : '#5aff8a'];   // Nitro / Surge : super coup
  return null;
}
function drawGuides() {
  if (!OPT.guides || G.demo || G.scene !== 'fight' || G.paused) { G.f.forEach(f => { f.guideA = 0; }); return; }
  G.f.forEach(f => {
    const g = f.cpu ? null : guideOf(f);
    if (!g) { f.guideA = 0; f.guideTxt = null; return; }
    if (f.guideTxt !== g[0].replace(/YYB./, 'YYB')) { f.guideTxt = g[0].replace(/YYB./, 'YYB'); f.guideA = 0; }   // nouvelle bulle : elle réapparaît
    f.guideA = (f.guideA || 0) + 1;
    const k = Math.min(1, f.guideA / 10), pop = k < 1 ? 1.25 * Math.sin(k * Math.PI * .5) - .25 * Math.sin(k * Math.PI) : 1;   // apparition : zoom avec léger rebond
    const sc = Math.max(.01, pop * (1 + .06 * Math.sin(G.frame * .12)));   // puis léger zoom continu
    const below = f.state === 'nyxglide', x = Math.round(f.x + f.dir * 6), y = below ? Math.round(f.y - 14) : Math.round(f.y - (f.dizzy ? 112 : 100) - floatOff(f)), w = g[0].length * 8 + 8;   // Nyx en vol plané : bulle juste sous elle
    ctx.save(); ctx.translate(x, y + 4); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, k * 1.5);
    ctx.fillStyle = 'rgba(10,4,20,.75)'; ctx.beginPath(); ctx.arc(-w / 2 + 6, 0, 6, Math.PI / 2, Math.PI * 1.5); ctx.arc(w / 2 - 6, 0, 6, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();   // bulle en pilule, sans contour
    if (g[0][0] === '@') {   // flèche vers l'arrière (à l'opposé de l'adversaire), puis « +A »
      text(g[0].slice(1), 5, -3, 8, g[1], 'center');
      const d = -f.dir, ax = -w / 2 + 9; ctx.fillStyle = g[1];
      ctx.fillRect(ax - 3, -1, 7, 2);   // tige
      for (let i = 0; i < 4; i++) ctx.fillRect(ax + d * (4 - i) - (d < 0 ? 0 : 0), -1 - i, 1, 2 + i * 2);   // pointe
    } else text(g[0], 0, -3, 8, g[1], 'center');
    ctx.restore();
  });
}
function drawDizzy(f) {
  const hx = f.x + f.dir * 4 + Math.sin(G.frame * .15) * 2, hy = f.y - 90;
  for (let i = 0; i < 3; i++) {
    const a = G.frame * .12 + i * Math.PI * 2 / 3, x = hx + Math.cos(a) * 13, y = hy + Math.sin(a) * 4;
    drawStar(x, y, Math.sin(a) > 0 ? 4 : 3, true);
  }
  if (f.mashShow > 0 || f.mash > 0) {
    const k = Math.min(1, f.t / f.stun);
    R(hx - 16, hy - 13, 32, 5, '#1a1020'); R(hx - 15, hy - 12, Math.round(30 * k), 3, k > .7 ? '#5ae06a' : '#ffd23a');
  }
}
// Jauges du duel de contres, chacune du côté de son combattant
function drawClash() {
  const C = G.clash;
  C.f.forEach((f, i) => {
    const k = Math.min(1, C.g[i] / 100), x = f.x - f.dir * 26, y0 = f.y - 96, h = 60;
    R(x - 4, y0 - 1, 8, h + 2, '#1a1020');
    R(x - 3, y0 + h - Math.round(h * k), 6, Math.round(h * k), f.def.fb[2]);
    if (!f.cpu && (G.frame >> 3) % 2) text('MASH!', x, y0 - 12, 8, '#ffffff', 'center');
  });
}
// Flammes sur un combattant (enchaînement final) : couleur de l'attaquant
function drawBurn(f) {
  const pal = f.burnPal || f.def.fb, lying = f.state === 'fall' || f.state === 'down' || f.state === 'held';
  const hgt = lying ? 34 : 84, wid = lying ? 30 : 14;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(f.x, f.y - hgt / 2, 2, f.x, f.y - hgt / 2, hgt * .8);
  g.addColorStop(0, pal[2] + '88'); g.addColorStop(1, pal[3] + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y - hgt / 2, hgt * .8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 16; i++) {
    const life = ((G.frame * 1.6 + i * 7.3) % 40) / 40;           // 0 → 1 en montant
    const x = f.x + Math.sin(i * 2.3 + G.frame * .25) * wid * (1 - life * .5);
    const y = f.y - 4 - life * hgt;
    const r = Math.max(1, Math.round(7 * (1 - life)));
    disc(x, y, r, life < .5 ? pal[2] : pal[3]);
    if (r > 2) disc(x, y + 1, r - 2, pal[1]);
  }
}
// Frappe enflammée : boule de feu dans la main pendant la frappe
function drawAxFire(f) {   // Axel : bras en feu pendant la frappe au sol (même flamme que son shoryuken)
  let on = false;
  if (f.state === 'axgp') on = !f.fired ? f.t >= 6 : f.t - f.gpT < 12;
  else if (f.state === 'nsuper' && superKit(f) === 'axel') on = f.t >= 40 && f.t < 74;
  if (!on) return;
  const P = POSES[poseOf(f)], pal = f.def.fb;
  const k0 = f.state === 'axgp' ? (f.fired ? f.t - f.gpT : -1) : f.t - 60;
  if (k0 >= 0 && k0 < 14) {   // traînée de feu en arc de cercle, du haut vers l'avant jusqu'au sol
    const kk = Math.min(1, (k0 + 1) / 4), [ae] = gpArc(kk), A0 = POSES.gp0, B0 = POSES.gp1, m = Math.min(1, kk);
    const shx = f.x + f.dir * (A0[2] + (B0[2] - A0[2]) * m) * 1.4, shy = f.y + (A0[3] + (B0[3] - A0[3]) * m) * 1.3;
    const fade = k0 < 4 ? 1 : Math.max(0, 1 - (k0 - 3) / 10), rr = (GP_R0 + (GP_R1 - GP_R0) * kk) * 1.35;
    const map = a => f.dir > 0 ? a : Math.PI - a;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    [[26, pal[3], .45], [18, pal[2], .7], [10, pal[1], .95], [4, pal[0], 1]].forEach(([lw, col, al]) => {
      ctx.globalAlpha = al * fade; ctx.strokeStyle = col; ctx.lineWidth = lw * (.6 + .4 * fade);
      ctx.beginPath(); ctx.arc(shx, shy, rr, map(GP_A0), map(ae), f.dir < 0); ctx.stroke();
    });
    ctx.restore();
  }
  for (const [i, sz] of [[6, .6], [8, 1]]) {   // coude puis poing
    const x = f.x + f.dir * P[i] * 1.4, y = f.y + P[i + 1] * 1.3, k = sz;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 1, x, y, 18 * k + 5);
    g.addColorStop(0, pal[1] + 'ee'); g.addColorStop(1, pal[3] + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18 * k + 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    for (let j = 0; j < 6; j++) { const a = G.frame * .5 + j; disc(x + Math.cos(a) * 5 * k, y + Math.sin(a) * 4 * k - j * 1.5, Math.max(1, (5 - j) * k), j < 3 ? pal[2] : pal[3]); }
    disc(x, y, 4 * k, pal[1]); disc(x, y, 2, pal[0]);
  }
}
function drawFlameHand(f) {
  if (!f.fireState || f.state !== f.fireState) return;
  const at = ATK[f.state]; if (!at || f.t > at.act[1] + 6) return;
  const pal = f.def.fb, x = f.x + f.dir * at.box[2] * .85, y = f.y + (at.box[1] + at.box[3]) / 2;
  const k = Math.max(.35, 1 - Math.abs(f.t - at.act[0]) / 10);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 1, x, y, 22 * k + 6);
  g.addColorStop(0, pal[1] + 'ee'); g.addColorStop(1, pal[3] + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22 * k + 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 6; i++) {
    const a = G.frame * .5 + i;
    disc(x + Math.cos(a) * 5 - f.dir * i * 2, y + Math.sin(a) * 4 - i * 1.5, Math.max(1, 5 - i), i < 3 ? pal[2] : pal[3]);
  }
  disc(x, y, 4, pal[1]); disc(x, y, 2, pal[0]);
}

function drawFight() {
  const [a, b] = G.f;
  // Caméra : zoom de 100 % (distance de départ) à 120 % quand les combattants se rapprochent
  const dist = Math.abs(a.x - b.x), D0 = 160, D1 = 50;
  const zt = OPT.zoom !== 'anim' && OPT.zoom != null ? (ZOOM_FIX[OPT.zoom] || 1) : 1 + .2 * Math.max(0, Math.min(1, (D0 - dist) / (D0 - D1))) - .1 * Math.max(0, Math.min(1, (dist - 290) / 54));   // presque aux deux bouts de l'écran : léger dézoom
  G.zoom = (G.zoom || 1) + (zt - (G.zoom || 1)) * .16;
  let lift = 0;
  if (G.scene === 'intro' && G.preT > 0) {   // ouverture : décor entier vu de haut, puis la caméra descend et zoome sur les combattants
    const k = 1 - G.preT / PRE_T, e = k * k * (3 - 2 * k), z0 = W / SW;
    G.zoom = z0 + (zt - z0) * e; lift = 34 * (1 - e);
  }
  if (G.photo) {   // MODE PHOTO : caméra libre
    const P = G.photo, zmin = W / SW; P.z = Math.max(zmin, Math.min(2.6, P.z));
    const pw = W / P.z, ph = H / P.z; P.l = Math.max(0, Math.min(SW - pw, P.l)); P.t = Math.max(H - ph - 90, Math.min(H - ph, P.t));
  }
  const z = G.photo ? G.photo.z : G.zoom, vw = W / z, vh = H / z;
  const tgtL = Math.max(0, Math.min(SW - vw, (a.x + b.x) / 2 - vw / 2)), top = H - vh - lift;
  G.camS = G.camS == null || G.preT > 0 || Math.abs(tgtL - G.camS) < .5 ? tgtL : G.camS + (tgtL - G.camS) * .14;   // caméra en travelling (pas de saut d'image, ex. téléportation)
  const left = G.photo ? G.photo.l : Math.max(0, Math.min(SW - vw, G.camS));
  const top2 = G.photo ? G.photo.t : top;
  if (!G.photo) { G.camL = left; G.camW = vw; }
  ctx.save();
  ctx.scale(z, z); ctx.translate(-left, -top2);
  if (top2 < 0) ctx.drawImage(introBG(), 0, -INTRO_TOP);   // vue dézoomée : décor prolongé vers le haut
  else ctx.drawImage(BG, 0, 0);
  if (G.darkT > 0) {   // fond assombri pendant le ralenti
    const k = Math.min(1, G.darkT / 10, (60 - G.darkT) / 6 + .2);
    const sup = G.f.some(f => f.state === 'nsuper' && f.t < 60);   // coup chargé : écran presque noir
    R(left - 10, top - 10, vw + 20, vh + 20, `rgba(6,4,18,${(sup ? .92 : .62) * k})`);
  }
  drawStains();
  drawToxics();   // flaques toxiques au sol, derrière les combattants
  drawProps();
  drawShadow(a); drawShadow(b);
  const order = ATTACKING.includes(a.state) && !ATTACKING.includes(b.state) ? [b, a] : [a, b];
  drawPowerBehind();
  drawVaneBehind();
  order.forEach(f => {
    if (f.sinkK > 0) {   // Zephyr à moitié sous terre : on coupe tout ce qui passe sous le sol
      ctx.save(); ctx.beginPath(); ctx.rect(-1000, -1000, SW + 2000, GROUND + 1000 + 1); ctx.clip();
      drawFighter(f, f.x, f.y + Math.round(f.sinkK * 90)); ctx.restore(); return;
    }
    const fl = floatOff(f);
    if (f.fadeK > 0) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - f.fadeK); }
    if (G.clash && G.clash.f.includes(f)) {   // bras de fer : échos des bras qui tremblent, plus visibles quand la tension monte
      const ten = Math.min(1, Math.max(G.clash.g[0], G.clash.g[1]) / 100);
      [[3, .16 + .2 * ten], [6, .1 + .14 * ten]].forEach(([dt, al]) => { ctx.save(); ctx.globalAlpha = al; drawFighter(Object.assign({}, f, { real: f, clashPh: G.frame - dt, ghostDraw: true, flash: 0, tint: 'rgba(255,240,180,.9)' }), f.x, f.y - fl); ctx.restore(); });
    }
    drawFighter(f, f.dizzy ? f.x + Math.round(Math.sin(G.frame * .15) * 2) : f.x, f.y - fl);
    if (f.fadeK > 0) ctx.restore();
    drawVaneGhost(f);
    drawSurgeGhost(f);
  });
  G.f.forEach(f => { if (f.toxT > 0) for (let b = 0; b < 3; b++) { const ph = (G.frame * 1.3 + b * 29) % 50; R(Math.round(f.x + Math.sin(b * 2.4 + G.frame * .05) * 12), Math.round(f.y - 10 - ph * 1.6), 2, 2, `rgba(120,255,100,${1 - ph / 50})`); } });   // vapeurs toxiques sur le combattant empoisonné
  G.f.forEach(f => { if (f.burn > 0) drawBurn(f); drawFlameHand(f); drawAxFire(f); if (f.dizzy) drawDizzy(f); });
  if (G.clash) drawClash();
  G.fbs.forEach(drawFireball);
  drawSupers();
  drawDiveTrail(); drawFireTrail(); drawVesperFx(); drawGrogFx(); drawZephyrFx(); drawNyxFx(); drawBlind(); drawKaelFx(); drawFlipFire(); drawVaneFx(); drawClashFx(); drawSnakes(); drawZFloor(); drawHats();
  // énergie qui grossit entre les mains pendant la charge
  G.f.forEach(f => {
    if ((f.state !== 'special' && f.state !== 'axgp') || f.fired || !f.chargeT) return;
    const pal = f.def.fb, k = Math.min(1, f.chargeT / chargeMax(f));
    const cx = f.state === 'axgp' ? f.x + f.dir * 22 : f.x - f.dir * 14, cy = f.state === 'axgp' ? f.y - 75 : f.y - 44;
    const r = 3 + k * 7 + (f.charged ? Math.sin(G.frame * .6) * 2 : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.4);
    g.addColorStop(0, pal[1] + 'dd'); g.addColorStop(1, pal[3] + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    disc(cx, cy, r | 0, pal[2]); disc(cx, cy, Math.max(1, r * .55) | 0, pal[0]);
  });
  drawShards(); drawBlood();
  G.sparks.forEach(drawSpark);
  if (G.flashT > 0) {
    // éclat en étoile qui jaillit du point d'impact : grandit très vite en tournant puis s'efface
    const k = Math.max(0, 1 - G.flashT / 12);
    const rad = 10 + 70 * Math.sqrt(k), alpha = Math.min(1, G.flashT / 6);
    const rot = k * 1.6 + .2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(G.boltX, G.boltY, 0, G.boltX, G.boltY, rad * .6);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.3, '#bff8ff'); g.addColorStop(1, 'rgba(60,200,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(G.boltX, G.boltY, rad * .6, 0, Math.PI * 2); ctx.fill();
    ctx.translate(G.boltX, G.boltY); ctx.rotate(rot);
    for (let i = 0; i < 8; i++) {
      const L = i % 2 ? rad * .55 : rad, w = i % 2 ? 3 : 5;
      ctx.fillStyle = '#7af0ff';
      ctx.beginPath(); ctx.moveTo(0, -w); ctx.lineTo(L, 0); ctx.lineTo(0, w); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -w * .4); ctx.lineTo(L * .8, 0); ctx.lineTo(0, w * .4); ctx.closePath(); ctx.fill();
      ctx.rotate(Math.PI / 4);
    }
    ctx.restore();
  }
  if (!G.photo) drawGuides();
  ctx.restore();
  if (G.photo) {   // MODE PHOTO : aucun HUD, seulement le message de capture
    if (G.photo.msgT > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, G.photo.msgT / 10); R(0, H / 2 - 16, W, 30, 'rgba(0,0,0,.55)'); text('TAKE A SCREEN SHOT', CX, H / 2 - 4, 8, '#ffffff', 'center'); ctx.restore(); }
    return;
  }
  if (G.flashT > 9) R(0, 0, W, H, 'rgba(220,245,255,.25)');   // très bref flash d'écran
  if (G.scene === 'intro' && G.preT > 0) {   // ouverture : nom du décor seulement
    const nm = (STAGES.find(q => q[0] === G.stage) || [0, ''])[1], al = Math.min(1, (PRE_T - G.preT) / 15, G.preT / 15);
    ctx.save(); ctx.globalAlpha = al; text(nm, CX, 22, 16, '#ffffff', 'center'); ctx.restore();
    return;
  }
  drawHUD();
  if (G.bigPop) {   // NITRO COMBO / NITRO SURGE COMBO
    const P = G.bigPop; P.t++; const k = Math.min(1, P.t / 8), sc = 1 + (1 - k) * 2;
    if (P.t > (P.end || 110)) G.bigPop = null;
    else { ctx.save(); ctx.globalAlpha = Math.min(1, ((P.end || 110) - P.t) / 15); ctx.translate(CX, 70); ctx.scale(sc, sc); ctx.save(); ctx.globalAlpha *= .4; ctx.shadowColor = P.col; ctx.shadowBlur = 3; text(P.txt, 0, -8, 16, (G.frame >> 2) % 2 ? P.col : '#ffffff', 'center', '#100418'); ctx.restore(); text(P.txt, 0, -8, 16, (G.frame >> 2) % 2 ? P.col : '#ffffff', 'center', '#100418'); ctx.restore(); }
  }
  if (G.powerMsg) {   // NITRO / SURGE + nom du combattant
    const M = G.powerMsg; if (!G.paused) M.t++;
    if (M.t > 75) G.powerMsg = null;
    else { const k = Math.min(1, M.t / 10), e = 1 - Math.pow(1 - k, 3), sc = 1 + 2.4 * (1 - e), a = Math.min(1, k * 1.5, (75 - M.t) / 14);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(CX, 74); ctx.scale(sc, sc); text(M.txt, 0, -12, 24, M.col, 'center', '#100418'); text(M.name, 0, 16, 8, '#ffffff', 'center', '#100418'); ctx.restore(); }
  }
  drawTut();
  if (G.scene === 'score') drawScore();

  if (G.scene === 'intro') {
    const zm = (s2, size, col, t) => { const k = Math.min(1, t / 10), e = 1 - Math.pow(1 - k, 3), sc = 1 + 2.2 * (1 - e); ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.4); ctx.translate(W / 2, 84 + size / 2); ctx.scale(sc, sc); text(s2, 0, -size / 2, size, col, 'center', '#3a0a04'); ctx.restore(); };   // apparition en dézoom
    if (G.t < 84) zm('ROUND ' + G.round, 16, '#ffd23a', G.t);
    else zm('FIGHT!', 24, '#ff4a2a', G.t - 84);
  } else if (G.scene === 'ko') {
    const kt = G.t - (G.koDelay || 0);
    if (kt < 0) {}
    else if (kt < 120) { if ((kt >> 2) % 2 || kt > 40) bigMsg('K.O.', 32, '#ff3a2a', 76); }
    else bigMsg(G.winner ? G.winner.def.name + ' WINS!' : 'DOUBLE K.O.', 16, '#ffd23a');
    drawRoundPerfect();
  } else if (G.scene === 'timeup') {
    if (G.t < 120) bigMsg('TIME OVER', 16, '#ffd23a');
    else bigMsg(G.winner ? G.winner.def.name + ' WINS!' : 'DRAW', 16, '#ffd23a');
    drawRoundPerfect();
  }
}
function drawRoundPerfect() {   // « PERFECT » qui apparaît en dézoom quand le vainqueur lève le bras
  if (G.rPerf == null) return;
  const dt = G.t - G.rPerf, k = Math.min(1, dt / 14), e = 1 - Math.pow(1 - k, 3), sc = 1 + (1 - e) * 3.5;
  ctx.save(); ctx.globalAlpha = Math.min(1, dt / 6); ctx.translate(CX, 116); ctx.scale(sc, sc);
  text('PERFECT', 0, -12, 24, (G.frame >> 3) % 2 ? '#ffd23a' : '#ffffff', 'center'); ctx.restore();
}

// ---------- Liste des coups (3 pages) ----------
const MOVES = [
  { title: 'BASICS', lines: [
    ['STICK UP', 'JUMP (FWD/BACK = ROLL)'], ['STICK DOWN', 'CROUCH'], ['STICK LEFT (BACK)', 'MOVE BACK / BLOCK'], ['STICK RIGHT (FWD)', 'MOVE FORWARD'],   // d'abord les directions
    ['Y', 'PUNCH'], ['B', 'KICK'], ['X', 'COUNTER'], ['A', 'SPECIAL'],   // puis les 4 boutons
    ['DOWN + BACK', 'LOW BLOCK'], ['FWD + Y', 'LONG PUNCH'], ['FWD + B', 'LONG KICK'],
    ['DOWN + Y', 'RISING UPPERCUT'], ['DOWN + B', 'LOW KICK'], ['DOWN + A', 'SLIDE KICK (KNOCKS DOWN)'], ['X, THEN A', 'BACK SPIN KICK: REFLECTS SHOTS'], ['', 'BEATS NORMAL HITS, ALSO AFTER A COUNTER'] ] },
  { title: 'SPECIALS & COUNTER', lines: [
    ['X', 'COUNTER (JUST BEFORE A HIT)'], ['COUNTER > Y', 'OVERHEAD SLAM'], ['COUNTER > B', 'ROLLING THROW'],
    ['COUNTERED > X', 'CLASH: MASH TO WIN'], ['COUNTERED > A', 'ESCAPE WITH A BACK SPIN KICK'],
    ['YYBB BBYY YYBA', '4TH HIT: FIRE DASH (EVEN FROM FAR)'], ['X X Y', 'NITRO (GREEN GAUGE FULL): FASTER 8 S'], ['NITRO + YYBB', 'NITRO COMBO: 8 HITS'], ['X X A', 'SURGE (PURPLE GAUGE FULL): DOUBLE 5 S'], ['SURGE + YYBA', '8 HITS + CHARGED SUPER SHOT'],
    ['X NEAR AN OBJECT', 'THROW IT AT THE FOE'], ['X AS IT ARRIVES', 'REFLECT A THROWN OBJECT'], ['DIZZY', 'MASH ANY BUTTON'] ] },
  { title: 'HIRO SPECIALS', lines: [
    ['A', 'FIREBALL'], ['HOLD A', 'MAX FIREBALL (1.2 S)'], ['', '(HALF TIME AT 80% HP OR LESS)'], ['UP + A', 'LOW SLIDE + MINI UPPER'], ['UP + A, UP + A', 'SHORYUKEN'],
    ['BACK + A x3', 'FLIP KICKS (3 HITS = FIRE FLIP)'], ['AIR + A', 'DIAGONAL FIREBALL (x2)'] ] },
  { title: 'AXEL SPECIALS', lines: [
    ['A', 'GROUND PUNCH, BOUNCING FIREBALL'], ['HOLD A', 'MAX FIREBALL (1.2 S)'], ['', '(HALF TIME AT 80% HP OR LESS)'], ['UP + A', 'FIRE LEAP'], ['UP + A, UP + A', 'FIRE SHORYUKEN (THE LEAP MUST HIT)'],
    ['BACK + A x3', 'FLIP KICKS (3 HITS = FIRE FLIP)'], ['AIR + A', '3 AIR FLIP KICKS'] ] },
  { title: 'ZEPHYR SPECIALS', lines: [
    ['FWD + Y', 'HEAVEN CUT'], ['', 'HEAVY SLASH, HEAD TO GROUND'], ['A', 'GALE BLADE'], ['', 'SWORD SLASH, AIR CRESCENT'], ['BACK + A', 'STORM PASSAGE'], ['', 'SINKS, REAPPEARS BEHIND THE FOE'],
    ['UP + A', 'RISING TORNADO'], ['', 'SPINNING SWORD UPPERCUT'], ['JUMP + A', 'SKY PLUNGE'], ['', 'HOVERS, STABS DOWN, SHOCKWAVE'] ] },
  { title: 'NYX SPECIALS', lines: [
    ['A', 'MAGMA FLASK'], ['', 'FLASK + PINK FIRE (3 S BURN)'], ['BACK + A', 'TOXIC MIST'], ['', 'SLOWS, THEN CONFUSES, STOPS SHOTS'], ['MIST OUT > BACK + A', 'SMOKE TELEPORT'],
    ['UP + A', 'ALCHEMIC GEYSER'], ['', 'DIAGONAL PURPLE FLAMES'], ['DOWN + A', 'SHADOW SLIDE'], ['', 'SLIDES UNDER SHOTS, TRIPS THE FOE'], ['JUMP + A', 'WITCH GLIDE'], ['', 'GLIDES 1 S, DROPS A FLASK'], ['GLIDE > A', 'SPIN DIVE: 3 FAST HITS, KNOCKS DOWN'], ['', 'ONLY SHOTS CAN STOP IT'], ['GLIDE > Y / B', 'PUNCH / KICK, THEN FALLS'] ] },
  { title: 'KAEL SPECIALS', lines: [
    ['A / FWD + A', 'SONIC WAVE'], ['', 'LONG ELECTRIC WAVE, PUSHES BACK'], ['BACK + A', 'FLASH STEP'], ['', 'DODGES BACK, CHARGES THE FISTS'], ['CHARGED > Y', 'THUNDER RUSH'], ['', '5 FAST PUNCHES, 5TH KNOCKS DOWN'],
    ['UP + A', 'PLASMA WALL'], ['', 'ELECTRIC WALL, GROUND TO SKY'], ['JUMP + A', 'VOLT SPIN'], ['', '360 SPIN KICK, REFLECTS SHOTS'] ] },
  { title: 'VESPER SPECIALS', lines: [
    ['A', 'HOLO FLASH'], ['', 'UP TO 3 CLONES, 3 HITS = PARALYZED'], ['BACK + A', 'SHADOW STEP'], ['', 'DODGES BACK, LEAVES A MINE'],
    ['UP + A', 'ZENITH BLADE'], ['', 'FLIP SLASH, LANDS BEHIND THE FOE'], ['JUMP + A', 'NEON DIVE'], ['', 'FAST DIAGONAL DIVE KICK'] ] },
  { title: 'GROG SPECIALS', lines: [
    ['A', 'SEISMIC IMPACT'], ['', 'GROUND WAVE, JUMP TO DODGE'], ['BACK + A', 'IRON RAMPART'], ['', 'ELECTRIC ARMS, ABSORB ONE HIT'], ['RAMPART > A', 'DOME BLAST, REFLECTS SHOTS'],
    ['UP + A', 'CELESTIAL CRUSH'], ['', 'HUGE LEAP, FISTS-FIRST DIVE'], ['DOWN + A', 'ROLLING ATTACK'], ['', '3 FAST ROLLS, 3RD KNOCKS DOWN'] ] },
  { title: 'LORD VANE SPECIALS', lines: [
    ['A', 'VOID FLARE'], ['', 'HUGE SLOW SPHERE, 3RD HIT PARALYZES'], ['BACK + A', 'PHANTOM TELEPORT'], ['', 'APPEARS BEHIND, GUARD BREAK'],
    ['UP + A', 'METEOR IMPACT'], ['', 'FLAMING FLIP, DIAGONAL DIVE'], ['AIR + A', 'VOID BOMB'], ['', 'BIG SPHERE, DIAGONAL DOWN'], ['AIR + DOWN + A', 'DIVE KICK, BREAKS SMALL SHOTS'], ['HOLD Y, RELEASE', '5 FAST PUNCHES, 5TH KNOCKS DOWN'], ['HOLD B, RELEASE', '5 FAST KICKS, 5TH KNOCKS DOWN'] ] },
  { title: 'COMBOS', lines: [
    ['*', 'CHAIN HITS WHILE THE FOE IS STUNNED. THE 4TH HIT SETS HIM ON FIRE!'],   // * : texte sur toute la largeur ['', ''],
    ['Y Y B B', 'FIRE FINISH'], ['B B Y Y', 'FIRE FINISH'], ['Y Y B A', 'FLAME STRIKE FINISH'], ['B B Y A', 'FLAME STRIKE FINISH'] ] },
];
function drawMoves() {   // mosaïque de cases carrées qui glissent ; A ouvre la liste dans une popup
  R(0, 0, W, H, 'rgba(8,4,16,.92)');
  text('MOVE LIST', CX, 12, 8, '#ff7a3a', 'center');
  const P = mlPages(), sel = Math.max(0, Math.min(P.length - 1, G.mlSel || 0));
  G.mlPos = G.mlPos == null ? sel : G.mlPos + (sel - G.mlPos) * (G.mlHoldT > 18 ? .32 : .2);   // glissement animé (plus vif quand on reste appuyé)
  const T = 74, GAP = 16, cy = 98; ML_RECTS.length = 0;
  const wrapT = t => { const out = []; let cur = ''; for (const w of t.split(' ')) { if (cur && cur.length + 1 + w.length > 9) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } out.push(cur); return out.slice(0, 2); };
  P.forEach((pg, i) => {
    const d = i - G.mlPos, x = CX + d * (T + GAP); if (x < -T || x > W + T) return;
    const k = Math.max(0, 1 - Math.abs(d)), sc = .8 + .32 * k, on = i === sel;   // zoom sur la case choisie, les autres plus petites
    ML_RECTS[i] = [x - T * sc / 2, cy - T * sc / 2, T * sc, T * sc];
    ctx.save(); ctx.translate(Math.round(x), cy); ctx.scale(sc, sc); ctx.globalAlpha = .45 + .55 * k;
    R(-T / 2, -T / 2, T, T, '#1a1024');
    const fi = PAGE_FACE[pg.title], im = fi != null ? SEL_FACE[fi] : null;
    if (im && imgOk(im)) { ctx.imageSmoothingEnabled = true; ctx.drawImage(im, -T / 2, -T / 2, T, T); ctx.imageSmoothingEnabled = false; const g = ctx.createLinearGradient(0, 0, 0, T / 2); g.addColorStop(0, 'rgba(10,4,20,0)'); g.addColorStop(1, 'rgba(10,4,20,.92)'); ctx.fillStyle = g; ctx.fillRect(-T / 2, 0, T, T / 2); }
    const L = wrapT(pg.title), ty = im ? T / 2 - 8 - L.length * 10 : -L.length * 5;
    L.forEach((l, j) => text(l, 0, ty + j * 10, 8, on ? '#ffd23a' : '#ffffff', 'center'));
    ring(-T / 2, -T / 2, T, T, on ? 2 : 1, on ? '#ffd23a' : '#5a4a60');
    ctx.restore();
  });
  // flèches et points
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  if (sel > 0) { ctx.beginPath(); ctx.moveTo(10, cy); ctx.lineTo(18, cy - 7); ctx.lineTo(18, cy + 7); ctx.fill(); }
  if (sel < P.length - 1) { ctx.beginPath(); ctx.moveTo(W - 10, cy); ctx.lineTo(W - 18, cy - 7); ctx.lineTo(W - 18, cy + 7); ctx.fill(); }
  P.forEach((pg, i) => R(CX - P.length * 5 + i * 10 + 2, 150, i === sel ? 6 : 4, i === sel ? 6 : 4, i === sel ? '#ffd23a' : 'rgba(255,255,255,.35)'));
  const pc = !isTouch && !padOn();
  text(pc ? '< > : CHOOSE   ' + keyName(KEYS.s) + ': OPEN   ESC: BACK' : '< > : CHOOSE   A: OPEN   B: BACK', CX, 196, 8, '#d8c8a8', 'center');
  if (!G.mlOpen) return;
  // popup : la liste de la case, avec défilement
  R(0, 0, W, H, 'rgba(0,0,0,.6)');
  const px = Math.max(8, CX - 184), pw = W - 2 * px, py = 18, ph = 176; ML_POP.splice(0, 4, px, py, pw, ph);
  R(px, py, pw, ph, '#120a1c'); ring(px, py, pw, ph, 1, '#ffd23a');
  text(G.mlOpen, CX, py + 6, 8, '#ffd23a', 'center'); R(px + 10, py + 18, pw - 20, 1, '#5a3a2a');
  const x0 = Math.max(16, CX - 168), top = py + 24, bot = py + ph - 18, sc = G.mscroll || 0;
  ctx.save(); ctx.beginPath(); ctx.rect(px, top, pw, bot - top); ctx.clip();
  const rows = moveDisp();
  rows.forEach(([k, v], i) => {
    const y = top + 4 + i * 14 - sc, fa = Math.max(0, Math.min(1, (y - top + 2) / 8, (bot - 8 - y) / 8)); if (fa <= 0) return;
    ctx.globalAlpha = fa;
    if (k === '*') { text(v, x0, y, 8, '#ffffff', 'left'); return; }
    if (k) text(k, x0, y, 8, '#7af0ff', 'left');
    if (v) text(v, x0 + MV_COL(), y, 8, '#ffffff', 'left');
  });
  ctx.globalAlpha = 1; ctx.restore();
  const total = rows.length * 14, view = bot - top;
  if (total > view) { const bh = Math.max(12, view * view / total), by = top + (view - bh) * (sc / Math.max(1, total - 118)); R(px + pw - 7, top, 3, view, '#2a1e30'); R(px + pw - 7, Math.min(bot - bh, by), 3, bh, '#ffd23a'); }
  text(pc ? 'UP/DOWN: SCROLL   ESC: CLOSE' : 'UP/DOWN: SCROLL   B: CLOSE', CX, py + ph - 12, 8, '#d8c8a8', 'center');
}
function drawStar(x, y, r, on) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,.18)'; ctx.fill();
}
function panel(y0, h, title, small, w = 200) {
  R(CX - w / 2, y0, w, h, 'rgba(14,8,22,.92)');   // panneau sobre : titre jaune, texte blanc, pas de traits jaunes
  if (small) { text(title, CX, y0 + 9, 8, '#ffd23a', 'center'); R(CX - w / 2 + 14, y0 + 22, w - 28, 1, 'rgba(255,255,255,.15)'); }   // petit titre + filet
  else text(title, CX, y0 + 10, 16, '#ffd23a', 'center');
}
function drawOptions() {
  if (G.showKeys) { drawKeys(); return; }
  const OB = OPT_BACK(), pc = optPC(), PW = 236, RH = pc ? (OB > 11 ? 11 : OB > 10 ? 12 : 13) : (OB > 8 ? 14 : 16);
  panel(8, 200, 'OPTIONS', true, PW);
  const c = G.ocur, x0 = CX - PW / 2 + 22, vx = CX + PW / 2 - 40, bx = vx - 6;
  const pos = i => optOrder().indexOf(i), col = i => c === pos(i) ? '#ffd23a' : 'rgba(255,255,255,.55)';
  const Y = i => 40 + pos(i) * RH;   // lignes bien espacées
  const box = (y, on, i) => { R(bx + 1, y - 1, 10, 10, col(i)); R(bx + 2, y, 8, 8, '#0e0816'); if (on) R(bx + 3, y + 1, 6, 6, '#ffffff'); };
  const bars = (y, v) => {
    if (v === 0) { text('OFF', vx, y, 8, '#ffffff', 'center'); return; }
    for (let i = 0; i < 4; i++) R(vx - 16 + i * 9, y + 8 - (i + 1) * 2.5, 6, (i + 1) * 2.5, i < v ? '#ffffff' : 'rgba(255,255,255,.18)');
  };
  if (c < OB) { R(CX - PW / 2 + 10, 40 + c * RH - 4, PW - 20, Math.min(15, RH), 'rgba(255,255,255,.08)'); text('>', x0 - 4, 40 + c * RH, 8, '#ffd23a', 'right'); }   // ligne sélectionnée surlignée
  if (pos(6) >= 0) { text('FULL SCREEN', x0, Y(6), 8, col(6), 'left'); box(Y(6), OPT.full, 6); }
  { const zs = c === pos(0); text('ZOOM IN GAME', x0, Y(0), 8, col(0), 'left'); text((zs ? '< ' : '') + (ZOOM_LBL[OPT.zoom] || 'ANIMATED') + (zs ? ' >' : ''), zs ? vx - 8 : vx, Y(0), 8, zs ? '#ffd23a' : '#ffffff', 'center'); }
  text('FIGHTERS ENERGY', x0, Y(1), 8, col(1), 'left');
  for (let i = 0; i < 3; i++) drawStar(vx - 12 + i * 12, Y(1) + 4, 5.5, i < OPT.energy);
  text('DIFFICULTY', x0, Y(2), 8, col(2), 'left');
  const dsel = c === pos(2);
  text((dsel ? '< ' : '') + DIFFS[OPT.diff] + (dsel ? ' >' : ''), vx, Y(2), 8, dsel ? '#ffd23a' : '#ffffff', 'center');
  text('BLOOD', x0, Y(3), 8, col(3), 'left'); box(Y(3), OPT.blood, 3);
  { const ts = c === pos(11); text('TIME', x0, Y(11), 8, col(11), 'left'); text((ts ? '< ' : '') + (OPT.time === false ? 'OFF' : '99') + (ts ? ' >' : ''), vx, Y(11), 8, ts ? '#ffd23a' : '#ffffff', 'center'); }
  { const gs = c === pos(10); text('GUIDES', x0, Y(10), 8, col(10), 'left'); text((gs ? '< ' : '') + (OPT.guides ? 'SHOW' : 'HIDE') + (gs ? ' >' : ''), vx, Y(10), 8, gs ? '#ffd23a' : '#ffffff', 'center'); }
  text('MUSIC VOLUME', x0, Y(4), 8, col(4), 'left'); bars(Y(4), OPT.music);
  text('SFX VOLUME', x0, Y(5), 8, col(5), 'left'); bars(Y(5), OPT.sfx);
  if (pc) {
    text('KEYBOARD', x0, Y(7), 8, col(7), 'left'); text('SET >', vx, Y(7), 8, col(7), 'center');
    text('GAMEPAD', x0, Y(8), 8, col(8), 'left'); text(padOn() ? 'SET >' : 'NONE', vx, Y(8), 8, padOn() ? col(8) : 'rgba(255,255,255,.3)', 'center');
  }
  if (pos(9) >= 0) { text(INSTALL_LBL(), x0, Y(9), 8, col(9), 'left'); drawDlIcon(vx, Y(9) + 3, col(9)); }
  R(CX - PW / 2 + 14, 172, PW - 28, 1, 'rgba(255,255,255,.15)');
  text((c === OB ? '> ' : '') + 'BACK' + (c === OB ? ' <' : ''), CX, 178, 8, c === OB ? '#ffd23a' : 'rgba(255,255,255,.55)', 'center');
  text(isTouch ? 'A / < >: CHANGE   B: BACK' : 'ENTER / < >: CHANGE', CX, 194, 8, 'rgba(255,255,255,.35)', 'center');
}
function drawKeys() {   // écran de configuration des touches / boutons
  const pad = G.showKeys === 'pad', rows = bindRows(), N = rows.length + 2, c = G.kcur || 0;
  panel(12, 196, pad ? 'GAMEPAD' : 'KEYBOARD');
  const x0 = CX - 84, step = pad ? 14 : 12, y0 = pad ? 48 : 42;
  rows.forEach(([a, nm], i) => {
    const y = y0 + i * step, sel = c === i, waiting = bindWait && bindWait.act === a;
    if (sel) text('>', x0 - 4, y, 8, '#ffd23a', 'right');
    text(nm, x0, y, 8, sel ? '#ffd23a' : 'rgba(255,255,255,.55)', 'left');
    const v = a === 'type' ? (sel ? '< ' : '') + (padType ? PAD_TYPES[padType] : 'AUTO (' + { xbox: 'XBOX', ps: 'PS', switch: 'SWITCH', joycon: 'JOY-CON' }[padKind()] + ')') + (sel ? ' >' : '')
      : waiting ? ((G.frame >> 4) % 2 ? 'PRESS...' : '') : pad ? padName(PADB[a]) : keyName(KEYS[a]);
    text(v, CX + 62, y, 8, waiting ? '#ffffff' : '#ffffff', 'center');
  });
  const yR = y0 + rows.length * step + 6;
  text((c === N - 2 ? '> ' : '') + 'RESET DEFAULTS' + (c === N - 2 ? ' <' : ''), CX, yR, 8, c === N - 2 ? '#ffd23a' : 'rgba(255,255,255,.55)', 'center');
  text((c === N - 1 ? '> ' : '') + 'BACK' + (c === N - 1 ? ' <' : ''), CX, yR + 13, 8, c === N - 1 ? '#ffd23a' : 'rgba(255,255,255,.55)', 'center');
  text(bindWait ? (pad ? 'PRESS A BUTTON  (ESC: CANCEL)' : 'PRESS A KEY  (ESC: CANCEL)') : (pad ? padName(PADB.s) + ': CHANGE   ' + padName(PADB.back) + ': BACK' : 'ENTER: CHANGE   ESC: BACK'), CX, 196, 8, 'rgba(255,255,255,.35)', 'center');
}
function drawPause() {
  R(0, 0, W, H, 'rgba(0,0,0,.55)');
  if (G.showMoves) { drawMoves(); return; }
  if (G.showOpts) { drawOptions(); return; }
  panel(34, 148, 'PAUSE');
  const PI = pauseItems(), st = PI.length > 6 ? 13 : 15;
  PI.forEach((t, i) => {
    const sel = G.pcur === i;
    text((sel ? '> ' : '') + t + (sel ? ' <' : ''), CX, 62 + i * st, 8, sel ? '#ffd23a' : 'rgba(255,255,255,.55)', 'center');
  });
  const kb = !isTouch && !padOn();
  text(kb ? keyName(KEYS.s) + ' / ENTER: SELECT   ' + keyName(KEYS.k) + ' / BKSP: BACK' : 'A: SELECT   START: RESUME   B: BACK', CX, 166, 8, 'rgba(255,255,255,.35)', 'center');
  if (G.qrPop) drawQRPopup();   // ADD CONTROLLERS (PC / Mac) : QR codes P1 / P2
  if (G.pconf != null) {   // fenêtre de confirmation
    R(0, 0, W, H, 'rgba(0,0,0,.5)');
    const PW = 250; R(CX - PW / 2, 78, PW, 64, '#0e0816');
    text('ARE YOU SURE TO QUIT THE FIGHT ?', CX, 92, 8, '#ffffff', 'center');
    ['YES', 'NO'].forEach((t, i) => { const sel = G.pconf === i; text((sel ? '> ' : '') + t + (sel ? ' <' : ''), CX + (i ? 40 : -40), 116, 8, sel ? '#ffd23a' : 'rgba(255,255,255,.55)', 'center'); });
  }
}

const LOGO = new Image();
lazySrc(LOGO, 'logo.png?v=25');
const TITLE_IMG = new Image();
TITLE_IMG.src = 'title.jpg?v=223';
function drawCover(img, al, sc = 1, dy = 0) {   // image plein écran (recadrée)
  if (!img.complete || !img.naturalWidth) return;
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight) * sc, w = img.naturalWidth * k, h = img.naturalHeight * k;
  if (HI.width > W) {   // image nette en haute définition, dessinée sur le calque du dessous
    const r = HI.width / W;
    if (!hiUsed) { hx.setTransform(1, 0, 0, 1, 0, 0); hx.fillStyle = '#000'; hx.fillRect(0, 0, HI.width, HI.height); hiUsed = true; HI.style.visibility = 'visible'; }
    hx.save(); hx.globalAlpha = al; hx.imageSmoothingEnabled = true; hx.imageSmoothingQuality = 'high';
    hx.drawImage(img, (CX - w / 2) * r, (H / 2 - h / 2 + dy) * r, w * r, h * r); hx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();   // le canvas pixel devient transparent : on voit l'image nette dessous
    return;
  }
  ctx.save(); ctx.globalAlpha = al; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, CX - w / 2, H / 2 - h / 2 + dy, w, h); ctx.restore();
}
const SRG = new Image();
SRG.src = 'srg.jpg?v=222';
const SPLASH = 110;   // durée du logo Super Rocket Games (fondu, 1 s, fondu)
function hiText(s, x, y, size, col) {   // texte net sur le calque haute définition (centré)
  const r = HI.width / W; hx.save(); hx.font = Math.round(size * r) + 'px "Press Start 2P", monospace'; hx.textAlign = 'center'; hx.textBaseline = 'top';
  hx.fillStyle = '#000'; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) hx.fillText(s, x * r + ox * r * .6, y * r + oy * r * .6);
  hx.fillStyle = col; hx.fillText(s, x * r, y * r); hx.restore();
}
function drawImg(img, cx, cy, w, al) {
  if (!img.complete || !img.naturalWidth) return false;
  const h = w * img.naturalHeight / img.naturalWidth;
  if (HI.width > W) {   // logo net en haute définition (calque du dessous)
    const r = HI.width / W;
    if (!hiUsed) { hx.setTransform(1, 0, 0, 1, 0, 0); hx.fillStyle = '#000'; hx.fillRect(0, 0, HI.width, HI.height); hiUsed = true; HI.style.visibility = 'visible'; }
    hx.save(); hx.globalAlpha = al; hx.imageSmoothingEnabled = true; hx.imageSmoothingQuality = 'high';
    hx.drawImage(img, (cx - w / 2) * r, (cy - h / 2) * r, w * r, h * r); hx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
    return true;
  }
  ctx.save(); ctx.globalAlpha = al; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore(); return true;
}
function upDownIcons(x, y, col) {   // icônes HAUT et BAS : flèches classiques (tige + pointe), 8 px de haut
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.lineCap = 'square';
  ctx.beginPath(); ctx.moveTo(x + 3.5, y + 8); ctx.lineTo(x + 3.5, y + .5); ctx.moveTo(x + .5, y + 3.5); ctx.lineTo(x + 3.5, y + .5); ctx.lineTo(x + 6.5, y + 3.5);
  ctx.moveTo(x + 13.5, y); ctx.lineTo(x + 13.5, y + 7.5); ctx.moveTo(x + 10.5, y + 4.5); ctx.lineTo(x + 13.5, y + 7.5); ctx.lineTo(x + 16.5, y + 4.5); ctx.stroke();
  ctx.restore(); return 17;
}
function iconLine(y, txt, col) {   // ligne centrée : [HAUT][BAS] + texte
  ctx.font = '8px "Press Start 2P", monospace'; const tw = ctx.measureText(txt).width, w = 17 + 6 + tw, x = Math.round(CX - w / 2);
  upDownIcons(x, y, col); text(txt, x + 23, y, 8, col, 'left');
}
function bootUpDown(y) { iconLine(y, 'TO SELECT', 'rgba(255,255,255,.7)'); }
function drawBoot() {   // écran de démarrage : même style que le menu du titre (> CHOIX <)
  const PW = 240, items = bootItems(), c = items.includes(G.bcur) ? G.bcur : 1;
  R(0, 0, W, H, '#000');   // fond noir, sans cadre
  // apparition animée : le choix du haut descend, celui du bas monte, le texte du bas en fondu ; démarre quand l'écran est vraiment visible (après CONTINUE / rotation)
  if (typeof rotateShown === 'function' && rotateShown()) { G.bootAt = null; return; }
  if (G.bootAt == null) G.bootAt = G.frame;
  const ak = Math.min(1, (G.frame - G.bootAt) / 26), ae = 1 - Math.pow(1 - ak, 3), done = ak >= 1;
  text(VERSION, W - (isTouch ? 34 : 6), isTouch ? 8 : 6, 8, 'rgba(106,106,106,.5)', 'right');   // version : seulement sur l'écran de démarrage (avant START)
  const slide = (dy, fn) => { ctx.save(); ctx.globalAlpha = ae; ctx.translate(0, Math.round(dy * (1 - ae))); fn(); ctx.restore(); };
  ctx.save(); ctx.globalAlpha = ae;
  text('NITRO SURGE FIGHTERS', CX, 170, 10, '#7a7a7a', 'center');   // titre en bas, en gris
  text('POWERED BY SUPER ROCKET GAMES', CX, 186, 8, '#5a5a5a', 'center');
  text('ALL RIGHTS RESERVED 2026', CX, 197, 8, '#4a4a4a', 'center');
  ctx.restore();
  const [kA, kB] = bootKeys(), blink = done && ((G.frame - G.bootAt - 26) >> 5) % 2 === 0;
  const two = items.includes(2), row2 = () => { const s2 = c === 2; text((s2 ? '> ' : '') + INSTALL_LBL() + (s2 ? ' <' : ''), CX, 98, 8, s2 ? '#ffd23a' : 'rgba(255,255,255,.6)', 'center'); };
  if (bootStep() === 0) {   // FULL SCREEN < OFF / ON >, puis INSTALL juste en dessous, puis PRESS ... TO CONFIRM
    const sel = c === 0;
    slide(-90, () => text('FULL SCREEN:  ' + (sel ? '< ' : '  ') + (OPT.full ? 'ON ' : 'OFF') + (sel ? ' >' : '  '), CX, 84, 8, sel ? '#ffd23a' : 'rgba(255,255,255,.6)', 'center'));
    if (two) slide(120, row2);
    if (two && done) bootUpDown(114);
    if (blink) { const y = two ? 126 : 114; text(kA + ' TO CONFIRM', CX, y, 8, '#ffffff', 'center'); text(kB + ' TO GO BACK', CX, y + 12, 8, '#ffffff', 'center'); }
  } else if (items.length > 1) {   // iPhone dans le navigateur : START ou ADD TO HOME SCREEN ; app : START ou DOWNLOAD OFFLINE MODE (même taille), puis PRESS A TO CONFIRM
    slide(-80, () => text((c === 1 ? '> ' : '') + 'START' + (c === 1 ? ' <' : ''), CX, 68, 12, c === 1 ? '#ffd23a' : 'rgba(255,255,255,.6)', 'center'));   // START arrive du haut
    { const sec = items[1], on2 = c === sec, lb = sec === 3 ? offLbl() : INSTALL_LBL(), sz = lb.length > 18 ? 8 : 12;
      if (sec === 3 && G.offState === 'dl') {   // téléchargement : barre de chargement (comme au démarrage) + pourcentage en petit
        const bw = 140, bx = CX - bw / 2, by = 88;
        R(bx - 2, by - 2, bw + 4, 10, '#3a2e44'); R(bx, by, bw, 6, '#140a1e');
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff6a1a'); g.addColorStop(1, '#ffd23a');
        ctx.fillStyle = g; ctx.fillRect(bx, by, Math.round(bw * G.offPct), 6);
        text(Math.round(G.offPct * 100) + '%', CX, by + 12, 8, '#9a8aa0', 'center');
      } else slide(130, () => text((on2 ? '> ' : '') + lb + (on2 ? ' <' : ''), CX, 88 + (12 - sz) / 2, sz, on2 ? '#ffd23a' : 'rgba(255,255,255,.6)', 'center')); }   // ADD TO HOME SCREEN arrive du bas
    if (blink) { iconLine(112, 'TO SELECT', '#ffffff'); text(kA + ' TO CONFIRM', CX, 124, 8, '#ffffff', 'center'); if (fsAvail()) text(kB + ' TO GO BACK', CX, 136, 8, '#ffffff', 'center'); }   // une seule ligne, en blanc : icônes HAUT / BAS
  } else {
    const s1 = true;
    text('START', CX, 86, 16, '#ffd23a', 'center');
    if (blink && s1) { text(kA + ' TO CONFIRM', CX, 116, 8, '#ffffff', 'center'); if (fsAvail()) text(kB + ' TO GO BACK', CX, 128, 8, '#ffffff', 'center'); }
    if (isStandalone() && G.offState === 'ready') text('OFFLINE MODE READY', CX, 146, 8, '#5aff8a', 'center');   // mode hors ligne prêt : en petit, en bas
  }
}
const VOL_N = 130;   // message « monte le son » après START : fondu entrant, pause, fondu sortant
function drawVolumeMsg() {
  const t = G.volT, a = t < 25 ? t / 25 : t > VOL_N - 25 ? Math.max(0, (VOL_N - t) / 25) : 1, e = 1 - Math.pow(1 - Math.min(1, t / 25), 3);
  const WH = `rgba(255,255,255,${a})`, sy = 82 + (1 - e) * 8;
  ctx.save(); ctx.globalAlpha = a;
  const sx = CX - 8, pul = 1 + Math.sin(t / 6) * .5;   // haut-parleur et ondes qui pulsent
  R(sx - 8, sy + 3, 4, 6, '#ffffff'); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(sx - 4, sy + 3); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 2, sy + 14); ctx.lineTo(sx - 4, sy + 9); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  for (const r of [5, 9, 13]) { ctx.globalAlpha = a * Math.max(0, Math.min(1, pul - (r - 5) / 10)); ctx.beginPath(); ctx.arc(sx + 3, sy + 6, r, -.8, .8); ctx.stroke(); }
  ctx.restore();
  // texte qui se révèle lettre par lettre
  const T1 = 'TURN THE VOLUME ON', T2 = 'FOR THE BEST EXPERIENCE', n = Math.floor(t * 1.2);
  text(T1.slice(0, n), CX, sy + 30, 8, WH, 'center');
  text(T2.slice(0, Math.max(0, n - 8)), CX, sy + 44, 8, `rgba(255,255,255,${a * .6})`, 'center');
}
const POSTER = new Image(); POSTER.src = 'intro_poster.webp?v=1';   // chargées au démarrage (intro)
const LOGO_NSF = new Image(); LOGO_NSF.src = 'logo_nsf.webp?v=1';
let LOGO_GLOW = null;
function logoGlow() {   // halo flou du logo (réduit puis agrandi : flou compatible avec tous les navigateurs)
  if (LOGO_GLOW || !imgOk(LOGO_NSF)) return LOGO_GLOW;
  const sw = 90, sh = Math.round(sw * LOGO_NSF.naturalHeight / LOGO_NSF.naturalWidth), c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const g = c.getContext('2d'); g.drawImage(LOGO_NSF, 6, 6, sw - 12, sh - 12); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffb040'; g.fillRect(0, 0, sw, sh);
  const c2 = document.createElement('canvas'); c2.width = sw / 3 | 0; c2.height = sh / 3 | 0; c2.getContext('2d').drawImage(c, 0, 0, c2.width, c2.height);
  return LOGO_GLOW = c2;
}
const INTRO_T0 = 40, INTRO_TRAVEL = 420, INTRO_LOGO = 150;   // images : début de l'affiche, durée du travelling, apparition du logo
const EMB = [];
function drawEmbers(k) {   // petites braises en pixels qui montent du bas, légères, scintillantes
  while (EMB.length < 60) EMB.push({ x: Math.random() * W, y: Math.random() * H * 1.2, vy: .25 + Math.random() * .55, ph: Math.random() * 6.28, s: Math.random() < .3 ? 3 : 2, life: 0 });
  const hi = hiReady(), g = hi ? hx : ctx, r = hi ? HI.width / W : 1;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const e of EMB) {
    e.y -= e.vy; e.x += Math.sin(e.ph + G.frame * .035) * .25 + .05; e.life++;
    if (e.y < -4 || e.x < -4 || e.x > W + 4) { e.x = Math.random() * W; e.y = H + 2 + Math.random() * 20; e.vy = .25 + Math.random() * .55; e.life = 0; }
    const hgt = 1 - e.y / H, fade = Math.max(0, Math.min(1, 1.35 - hgt * 1.05)) * Math.min(1, e.life / 12);   // s'éteignent en montant
    const fl = .55 + .45 * Math.sin(e.ph * 3 + G.frame * .25);
    const col = e.s > 2 ? [255, 120, 20] : hgt > .55 ? [230, 60, 10] : [255, 170, 40];
    g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(k * fade * fl).toFixed(3)})`;
    const px = Math.round(e.x) * r, py = Math.round(e.y) * r, sz = e.s * r;
    g.fillRect(px, py, sz, sz);
    if (e.s > 2) { g.fillStyle = `rgba(255,120,30,${(k * fade * fl * .35).toFixed(3)})`; g.fillRect(px - r, py - r, sz + 2 * r, sz + 2 * r); }   // petit halo
  }
  g.restore();
}
function drawIntro(L) {
  R(0, 0, W, H, '#000');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
  artFill('#000');
  // affiche : du haut vers le bas
  if (L > INTRO_T0 && imgOk(POSTER)) {
    const ph = W * POSTER.naturalHeight / POSTER.naturalWidth, k = Math.min(1, (L - INTRO_T0) / INTRO_TRAVEL), e = k * k * (3 - 2 * k);
    const end = Math.max(0, Math.min(ph - H, ph * .645 - H / 2));   // s'arrête sur les bustes de Hiro et Axel
    artDraw(POSTER, 0, -end * e, W, ph, false, Math.min(1, (L - INTRO_T0) / 40));
  }
  if (L > INTRO_T0) drawEmbers(Math.min(1, (L - INTRO_T0) / 60));   // braises qui montent du bas
  // PRESENTS : fondu entrant, puis fondu sortant pendant que l'affiche apparaît
  const pa = L < 25 ? L / 25 : L < INTRO_T0 + 20 ? 1 : Math.max(0, 1 - (L - INTRO_T0 - 20) / 25);
  if (pa > 0 && !G.introNoPres) { artTextA('PRESENTS', CX, H / 2 - 6, 11, '#ffffff', pa); }
  // logo : apparaît avec un éclat lumineux, puis halo qui pulse
  const lt = L - (G.logoAt != null ? Math.min(G.logoAt, INTRO_LOGO) : INTRO_LOGO);   // logo affiché plus tôt si on a appuyé sur une touche
  if (lt > 0 && imgOk(LOGO_NSF)) {
    const lw = Math.min(W * .78, 300), lh = lw * LOGO_NSF.naturalHeight / LOGO_NSF.naturalWidth, a = Math.min(1, lt / 18);
    const sc = lt < 18 ? 1.35 - .35 * (1 - Math.pow(1 - lt / 18, 3)) : 1, w2 = lw * sc, h2 = lh * sc, cy = H / 2 - 8;   // logo au milieu de l'écran
    const gl = logoGlow();
    if (gl) { const pulse = lt < 24 ? 1.6 * (1 - lt / 24) + .5 : .45 + .2 * Math.sin(G.frame * .08); artDraw(gl, CX - w2 * .62, cy - h2 * .66, w2 * 1.24, h2 * 1.32, false, Math.min(1, pulse) * a, 'lighter'); }
    artDraw(LOGO_NSF, CX - w2 / 2, cy - h2 / 2, w2, h2, false, a);
    if (lt < 14) artFill(`rgba(255,240,200,${(.5 * (1 - lt / 14)).toFixed(3)})`);   // éclair à l'apparition
    if (((lt - 1) >> 5) % 2 === 0) artTextA('PRESS ANY KEY', CX, cy + lh / 2 + 14, 9, '#ffffff', 1);
  }
}
function artTextA(str, x, y, size, col, al) {   // texte pixel net (calque HD), avec transparence
  const hi = hiReady();
  if (!hi) { ctx.save(); ctx.globalAlpha = al; text(str, x, y, 8, col, 'center'); ctx.restore(); return; }
  hx.save(); hx.globalAlpha = al; hiText(str, x, y, size, col); hx.restore();
}
function drawTitle() {
  const t = G.t;
  R(0, 0, W, H, '#000');
  // 1) logo Super Rocket Games : fondu entrant, 1 seconde, fondu sortant
  if ((G.boot || !loadDone()) && t < 2 && G.tstate !== 1) {   // chargement, puis écran de démarrage
    const k = loadProgress(), bw = 140, bx = CX - bw / 2, by = H / 2 + 6;
    if (!loadDone()) {
      text('LOADING', CX, by - 18, 8, '#ffd23a', 'center');
      R(bx - 2, by - 2, bw + 4, 10, '#3a2e44'); R(bx, by, bw, 6, '#140a1e');
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff6a1a'); g.addColorStop(1, '#ffd23a');
      ctx.fillStyle = g; ctx.fillRect(bx, by, Math.round(bw * k), 6);
      text(Math.round(k * 100) + '%', CX, by + 14, 8, '#9a8aa0', 'center');
      return;
    }
    drawBoot(); return;
  }
  if (G.volT != null && G.volT < VOL_N) { drawVolumeMsg(); return; }
  if (t < SPLASH) {
    const al = t < 20 ? t / 20 : t < 80 ? 1 : Math.max(0, 1 - (t - 80) / 20);
    drawImg(SRG, CX, H / 2, Math.min(300, W - 40), al);
    return;
  }
  // 2) intro : PRESENTS, puis grande affiche en travelling + logo lumineux, « PRESS ANY KEY »
  if (G.tstate !== 1 && !G.showMoves && !G.showOpts) { drawIntro(t - SPLASH); return; }
  // 3) mur de briques avec le logo graffiti et le menu (on y « atterrit » en zoomant)
  const L = Math.min(t - SPLASH, G.tmenu == null ? 999 : G.tmenu);
  const k = Math.min(1, L / 30), ease = 1 - Math.pow(1 - k, 3);
  drawCover(TITLE_IMG, Math.min(1, L / 25), 1.25 - .25 * ease);   // l'image reste fixe
  if (!TITLE_IMG.complete) text('NITRO SURGE FIGHTERS', CX, 70, 12, '#ff7a3a', 'center');
  // bandeau sombre en bas pour la lisibilité
  if (hiUsed) { const r = HI.width / W, gb = hx.createLinearGradient(0, 140 * r, 0, H * r); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,.75)'); hx.fillStyle = gb; hx.fillRect(0, 140 * r, HI.width, HI.height - 140 * r); }
  else { const gb = ctx.createLinearGradient(0, 140, 0, H); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,.75)'); ctx.fillStyle = gb; ctx.fillRect(0, 140, W, H - 140); }
  if (G.showMoves) { drawMoves(); return; }
  if (G.showOpts) { R(0, 0, W, H, 'rgba(0,0,0,.55)'); drawOptions(); return; }
  if (G.tstate !== 1) {
    if (L > 40 && (G.frame >> 5) % 2 === 0) text('PRESS ANY BUTTON', CX, 176, 8, '#ffffff', 'center');
  } else {
    TITLE_ITEMS.forEach((m, i) => {
      const sel = G.tcur === i;
      text((sel ? '> ' : '') + m + (sel ? ' <' : ''), CX, 139 + i * 10, 8, sel ? '#ffd23a' : 'rgba(255,255,255,.6)', 'center');
    });
  }
  if (L > 30) {   // plus petit, détaché du menu
    const fs = Math.max(5, Math.min(8, Math.floor((W - 16) / 56)) - 1);
    if (hiUsed) hiText('POWERED BY SUPER ROCKET GAMES - ALL RIGHTS RESERVED 2026', CX, 205, fs, '#d8c8b0');   // texte net (haute définition)
    else text('POWERED BY SUPER ROCKET GAMES - ALL RIGHTS RESERVED 2026', CX, 205, fs, '#d8c8b0', 'center');
  }
  if (G.tstate === 1 && (G.tmenu || 0) < 14) R(0, 0, W, H, `rgba(255,255,255,${(.7 * (1 - (G.tmenu || 0) / 14)).toFixed(3)})`);   // atterrissage : éclair blanc
}

// Écran de sélection : personnages en entier à gauche (joueur 1) et à droite (joueur 2), grille 4 x 2 au centre
const SEL_KEYS = ['hiro', 'axel', 'vesper', 'grog', 'zephyr', 'nyx', 'kael', 'vane'];   // indices DEFS
const SEL_FACE_DIR = [-1, 1, -1, -1, 1, 1, -1, 1];   // sens du regard de chaque image en pied (indices DEFS : Hiro, Axel, Vesper, Grog, Zephyr, Nyx, Kael, Vane)
const SEL_ART = SEL_KEYS.map(k => { const im = new Image(); lazySrc(im, 'sel_' + k + '.webp?v=5'); return im; });
const SEL_FACE = SEL_KEYS.map(k => { const im = new Image(); lazySrc(im, 'face_' + k + '.jpg?v=9'); return im; });
const ADD_BTN = [0, 0, 0, 0], QR_POP = [0, 0, 0, 0];
const inRect = (t, r) => t.x >= r[0] && t.x <= r[0] + r[2] && t.y >= r[1] && t.y <= r[1] + r[3];
const imgOk = im => im && (im instanceof HTMLCanvasElement ? im.width > 0 : im.complete && im.naturalWidth);
function hiReady() {   // calque haute définition (écrans haute densité) ; sinon on dessine sur le canvas pixel
  if (!(HI.width > W)) return false;
  if (!hiUsed) { hx.setTransform(1, 0, 0, 1, 0, 0); hx.fillStyle = '#000'; hx.fillRect(0, 0, HI.width, HI.height); hiUsed = true; HI.style.visibility = 'visible'; }
  return true;
}
function artDraw(im, x, y, w, h, flip, al = 1, op) {   // image nette (calque HD si possible), retournée si besoin
  if (!imgOk(im)) return;
  const hi = hiReady(), g = hi ? hx : ctx, r = hi ? HI.width / W : 1;
  g.save(); g.globalAlpha = al; if (op) g.globalCompositeOperation = op; g.imageSmoothingEnabled = !(im === QR[1] || im === QR[2]);   /* QR codes : pixels nets pour le scan */ g.imageSmoothingQuality = 'high';
  if (flip) { g.translate((x + w) * r, y * r); g.scale(-1, 1); g.drawImage(im, 0, 0, w * r, h * r); }
  else g.drawImage(im, x * r, y * r, w * r, h * r);
  g.restore();
}
function artFill(col, x = 0, y = 0, w = W, h = H) { const hi = hiReady(), g = hi ? hx : ctx, r = hi ? HI.width / W : 1; g.save(); g.fillStyle = col; g.fillRect(x * r, y * r, w * r, h * r); g.restore(); }
function artText(str, x, y, size, col, align = 'center', grad, flat) {   // texte lisse (police système grasse), comme sur la maquette
  const hi = hiReady(), g = hi ? hx : ctx, r = hi ? HI.width / W : 1;
  g.save(); g.font = '700 ' + Math.round(size * r) + 'px Arial, Helvetica, sans-serif'; g.textAlign = align; g.textBaseline = 'top';
  if (!flat) { g.lineJoin = 'round'; g.lineWidth = Math.max(2, size * r * .14); g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(str, x * r, y * r); }
  if (grad) { const gr = g.createLinearGradient(0, y * r, 0, (y + size) * r); gr.addColorStop(0, grad[0]); gr.addColorStop(1, grad[1]); g.fillStyle = gr; } else g.fillStyle = col;
  g.fillText(str, x * r, y * r); g.restore();
}
function artCircle(x, y, rad, col) { const hi = hiReady(), g = hi ? hx : ctx, r = hi ? HI.width / W : 1; g.save(); g.beginPath(); g.arc(x * r, y * r, rad * r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = Math.max(1, r * .8); g.strokeStyle = '#ffffff'; g.stroke(); g.restore(); }
function ring(x, y, w, h, t, col) { R(x - t, y - t, w + 2 * t, t, col); R(x - t, y + h, w + 2 * t, t, col); R(x - t, y, t, h, col); R(x + w, y, t, h, col); }
const SEL_WHITE = [];
function whiteOf(i) {   // silhouette blanche du personnage (flash de validation)
  if (SEL_WHITE[i]) return SEL_WHITE[i];
  const im = SEL_ART[i], c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  c.complete = true; c.naturalWidth = c.width; c.naturalHeight = c.height;
  return SEL_WHITE[i] = c;
}
function fighterArt(i, side, k) {   // personnage en entier, collé au bord, coupé en bas
  if (i == null) return;
  const im = SEL_ART[i]; if (!imgOk(im)) return;
  const h = H * 1.42, w = h * im.naturalWidth / im.naturalHeight, cx = side < 0 ? Math.min(W * .17, 74) : W - Math.min(W * .17, 74);
  const want = side < 0 ? 1 : -1;   // joueur 1 regarde toujours à droite, joueur 2 toujours à gauche
  const pf = G.pickF && G.pickF[side < 0 ? 0 : 1] != null ? G.frame - G.pickF[side < 0 ? 0 : 1] : 99;   // choix validé : flash
  const pop = pf < 16 ? 1 + .06 * Math.sin(pf / 16 * Math.PI) : 1, ww = w * pop, hh = h * pop;
  const x = cx - ww / 2 + side * (1 - k) * 90, y = 34 + (1 - k) * 6 - (hh - h) * .4, fl = SEL_FACE_DIR[i] !== want;
  artDraw(im, x, y, ww, hh, fl, k);
  if (pf < 24) { const a = Math.pow(1 - Math.max(0, pf) / 24, 1.4); artDraw(whiteOf(i), x, y, ww, hh, fl, a); artDraw(im, x, y, ww, hh, fl, a * .6, 'lighter'); }   // silhouette blanche qui s'efface
}
function selPick(sd) { (G.pickF = G.pickF || [])[sd] = G.frame; sfx('select'); sfx('counter'); }
function drawSelect() {
  R(0, 0, W, H, '#000');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
  if (imgOk(TITLE_IMG)) { const k = Math.max(W / TITLE_IMG.naturalWidth, H / TITLE_IMG.naturalHeight), w = TITLE_IMG.naturalWidth * k, h = TITLE_IMG.naturalHeight * k; artDraw(TITLE_IMG, CX - w / 2, H / 2 - h / 2, w, h, false); }
  artFill('rgba(8,4,14,.66)');   // fond plus foncé
  const ph = G.selPhase || 0, sel = G.sel || 0, hov = ROSTER[sel < 8 ? sel : (G.selBack || 0)];
  const arc = G.mode === 'arcade' || G.mode === 'tutorial', two = !arc && p2On(), L2 = two ? 'PLAYER 2' : 'CPU';
  const p1 = ph === 0 ? hov : G.p1, p2 = ph === 1 ? hov : null;
  const e1 = ent(0), e2 = ent(1), ev = ent(3, 3, 8);
  const ka = Math.min(1, (G.frame - (G.selAnimF || -99)) / 12), ke = 1 - Math.pow(1 - ka, 3);   // nouveau personnage survolé : il glisse depuis le bord
  fighterArt(p1, -1, ph === 0 ? Math.min(e1, ke) : e1);
  if (G.mode !== 'tutorial') fighterArt(p2, 1, ph === 1 ? Math.min(e2, ke) : e2);
  const title = arc ? (G.mode === 'tutorial' ? 'TUTORIAL: SELECT YOUR FIGHTER' : 'ARCADE MODE: SELECT YOUR FIGHTER') : ph === 0 ? (two ? 'PLAYER 1: SELECT YOUR FIGHTER' : 'SELECT YOUR FIGHTER') : (two ? 'PLAYER 2: SELECT YOUR FIGHTER' : 'SELECT CPU FIGHTER');
  artText(title, CX, 7, 13, '#ffffff');
  artText('PLAYER 1', 8, 22, 9, '#2ef0f0', 'left');
  artText(p1 == null ? '???' : DEFS[p1].name, 8, 34, 15, '#ffffff', 'left');
  if (G.mode !== 'tutorial') {
    artText(L2, W - 8, 22, 9, '#ff3ae8', 'right');
    artText(p2 == null ? '???' : DEFS[p2].name + (p2 === G.p1 ? ' 2P' : ''), W - 8, 34, 15, '#ffffff', 'right');
    if (ev > 0) artText('VS', CX, isTouch ? 36 : 52, 38, '#ff9a1a', 'center', ['#ffd23a', '#ff5a0a']);
  }
  // grille 4 x 2 : nouveaux visages
  const S = 34, gap = 4, gx = CX - (4 * S + 3 * gap) / 2, gy = isTouch ? 80 : 93;   // mobile : VS et grille remontés, INVITE A PLAYER juste dessous   // PC : grille un peu plus haute, espace avant les boutons
  artFill('rgba(0,0,0,.55)', gx - 3, gy - 3, 4 * S + 3 * gap + 6, 2 * S + gap + 6);
  for (let i = 0; i < 8; i++) {
    const x = gx + (i % 4) * (S + gap), y = gy + (i >> 2) * (S + gap), c = ROSTER[i];
    const on = i === sel, blink = (G.frame >> 3) % 2, k = ent(4 + i, 2, 8);
    if (k <= 0) continue;
    if (c != null && imgOk(SEL_FACE[c])) artDraw(SEL_FACE[c], x, y, S, S, false, k); else R(x, y, S, S, '#000');
    if (!on && k >= 1) R(x, y, S, S, 'rgba(0,0,0,.18)');
    ring(x, y, S, S, on ? 2 : 1, on ? (blink ? '#ffd23a' : (ph ? '#ff3a2a' : '#ff6a1a')) : '#5a4a60');
    if (on) text(ph ? (two ? '2P' : 'CPU') : '1P', x + 2, y + 2, 8, ph ? '#ff7a6a' : '#5ac8ff', 'left');
  }
  if (!isTouch) {   // PC : bouton ADD CONTROLLERS
    const bw = 76, bh = 11, bx = Math.round(CX - bw / 2), by = 100 + 2 * S + gap + 7, on = sel === 8;
    ADD_BTN[0] = bx; ADD_BTN[1] = by; ADD_BTN[2] = bw; ADD_BTN[3] = bh;
    artFill(on ? 'rgba(255,210,58,.18)' : 'rgba(0,0,0,.45)', bx, by, bw, bh);
    ring(bx, by, bw, bh, 1, on ? '#ffd23a' : '#d8d8e0');
    artText('ADD CONTROLLERS', CX, by + 2.4, 6.5, on ? '#ffd23a' : '#ffffff');
    const ps = padSlots();
    for (const q of [1, 2]) if (remoteOn(q) || ps['p' + q] != null) {   // manette connectée : pastille P1 (bleue) à gauche, P2 (mauve) à droite
      const cx2 = q === 1 ? bx - 9 : bx + bw + 9, cy2 = by + bh / 2;
      artCircle(cx2, cy2, 6.5, q === 1 ? '#2a8cff' : '#a83ae8');
      artText('P' + q, cx2, cy2 - 2.6, 5, '#ffffff');
    }
  }
  if (!invOK()) { INV_BTN[0] = INV_BTN[1] = -999; INV_BTN[2] = INV_BTN[3] = 0; }   // TUTORIAL / ARCADE : pas d'invitation
  else {   // INVITE A PLAYER (PC : sous ADD CONTROLLERS ; mobile : seul bouton)
    const pc = !isTouch, bw = pc ? ADD_BTN[2] : 84, bh = pc ? ADD_BTN[3] : 14, bx = Math.round(CX - bw / 2), by = pc ? ADD_BTN[1] + ADD_BTN[3] + 5 : gy + 2 * S + gap + 12, on = sel === 9;   // PC : sous ADD CONTROLLERS, même taille ; mobile : sous SELECT YOUR FIGHTER
    if (NET.guest) {   // Player 2 connecté : plus de bouton, juste CONNECTED
      INV_BTN[0] = INV_BTN[1] = -999; INV_BTN[2] = INV_BTN[3] = 0;
      artCircle(CX - 30, by + bh / 2, 6.5, '#a83ae8'); artText('P2', CX - 30, by + bh / 2 - 2.6, 5, '#ffffff');
      artText('CONNECTED', CX + 8, by + (pc ? 2.4 : 3.6), pc ? 6.5 : 7, '#5aff8a');
    } else {
    INV_BTN[0] = bx; INV_BTN[1] = by; INV_BTN[2] = bw; INV_BTN[3] = bh;
    artFill(on ? 'rgba(255,210,58,.18)' : 'rgba(0,0,0,.45)', bx, by, bw, bh);
    ring(bx, by, bw, bh, 1, on ? '#ffd23a' : '#ff6ae8');
    artText('INVITE A PLAYER', CX, by + (pc ? 2.4 : 3.6), pc ? 6.5 : 7, on ? '#ffd23a' : '#ffffff');
    }
  }
  if (hov == null && sel < 8) text('COMING SOON', CX, 196, 8, '#9a8aa0', 'center');
  if (isTouch) text('A: CONFIRM   B: BACK', CX, 206, 8, 'rgba(216,200,168,.8)', 'center');
  for (const sd of [0, 1]) { const pf = G.pickF && G.pickF[sd] != null ? G.frame - G.pickF[sd] : 99; if (pf < 10) R(0, 0, W, H, `rgba(255,255,255,${(.45 * (1 - pf / 10)).toFixed(3)})`); }   // éclair blanc à la validation
  if (G.qrPop) drawQRPopup();
  if (G.invPop) drawInvitePopup();
}

// ---- INVITE A PLAYER : QR code (local) ou lien à partager (à distance) ----
const INV_BTN = [0, 0, 0, 0], INV_POP = [0, 0, 0, 0], INV_L = [0, 0, 0, 0], INV_R = [0, 0, 0, 0], INV_SHARE = [0, 0, 0, 0], INV_COPY = [0, 0, 0, 0];
const invOK = () => G.mode !== 'tutorial' && G.mode !== 'arcade';   // bouton INVITE A PLAYER : VS seulement
function openInvite() { netStart(); G.invPop = true; G.invSel = isTouch ? G.invSel || 0 : 1; G.invMsg = ''; sfx('select'); }   // PC : uniquement ONLINE (SHARE / COPY LINK)
function doCopy() {   // PC : copie du lien d'invitation
  const url = inviteURL(); G.shareF = G.frame; sfx('select');
  if (!url) { G.invMsg = 'PLEASE WAIT, CONNECTING...'; return; }
  const ok = () => { G.invMsg = 'LINK COPIED! PASTE IT IN A MESSAGE'; };
  const old = () => { try { const t = document.createElement('textarea'); t.value = url; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); ok(); } catch (e) { G.invMsg = 'COPY FAILED'; } };
  try { navigator.clipboard.writeText(url).then(ok, old); } catch (e) { old(); }
}
function doShare(gesture) {   // menu de partage du téléphone / PC (WhatsApp, Messenger...) ; sinon copie du lien
  const url = inviteURL(); G.shareF = G.frame; sfx('select');
  if (!url) { G.invMsg = 'PLEASE WAIT, CONNECTING...'; return; }
  const copy = () => { try { navigator.clipboard.writeText(url).then(() => { G.invMsg = 'LINK COPIED! PASTE IT IN A MESSAGE'; }, () => { G.invMsg = ''; }); } catch (e) { G.invMsg = ''; } };
  if (navigator.share) navigator.share({ title: 'YOU ARE INVITED AS PLAYER 2', url }).then(() => { G.invMsg = 'INVITATION SENT!'; }, e => { if (!(e && e.name === 'AbortError')) copy(); });
  else copy();
}
// le partage doit partir d'un vrai geste (clic / touche) : on l'appelle directement depuis l'événement
const evPt = e => { const r = cv.getBoundingClientRect(); return ROT ? { x: (e.clientY - r.top) / r.height * W, y: (r.right - e.clientX) / r.width * H } : { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
addEventListener('pointerup', e => {
  if (!G.invPop || G.scene !== 'select') return;
  if (inRect(evPt(e), INV_SHARE)) { G.invSel = 1; doShare(true); return; }
  if (!isTouch && inRect(evPt(e), INV_COPY)) { G.invSel = 2; doCopy(); return; }
  const el = document.elementFromPoint(e.clientX, e.clientY), b = el && el.closest ? el.closest('.b') : null;   // bouton A de l'écran tactile
  if (b && b.dataset.b === 's' && G.invSel === 1) doShare(true);
}, { passive: true });
addEventListener('keydown', e => { if (G.invPop && G.scene === 'select' && (e.code === KEYS.s || e.code === 'Enter')) { if (G.invSel === 1) doShare(true); else if (G.invSel === 2 && !isTouch) doCopy(); } });
function drawShareIcon(x, y, col) {   // icône de partage (vectorielle)
  const hi = hiReady(), g = hi ? hx : ctx, r = hi ? HI.width / W : 1;
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = .9 * r;
  const P = [[x + 3.5, y - 3.6], [x - 3.5, y], [x + 3.5, y + 3.6]];   // même hauteur que le texte SHARE
  g.beginPath(); g.moveTo(P[0][0] * r, P[0][1] * r); g.lineTo(P[1][0] * r, P[1][1] * r); g.lineTo(P[2][0] * r, P[2][1] * r); g.stroke();
  for (const [px, py] of P) { g.beginPath(); g.arc(px * r, py * r, 1.7 * r, 0, 6.29); g.fill(); }
  g.restore();
}
function drawInvitePopup() {
  if (HI.width > W) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); }
  artFill('rgba(0,0,0,.82)');
  if (!isTouch) {   // PC : uniquement ONLINE, avec SHARE et COPY LINK
    const pw = 250, ph = 150, px = Math.round(CX - pw / 2), py = Math.round(H / 2 - ph / 2); INV_POP.splice(0, 4, px, py, pw, ph);
    INV_L.fill(0); INV_R.fill(0);
    artFill('#120a1c', px, py, pw, ph); ring(px, py, pw, ph, 1, '#ffd23a');
    artText('INVITE A PLAYER', CX, py + 7, 11, '#ffd23a');
    artText('ONLINE', CX, py + 24, 9, '#ffffff');
    artText('Send an invitation link (WhatsApp, Messenger, e-mail...)', CX, py + 37, 6, '#d8c8e0');
    const sw = 84, sh = 20, sy = py + 52, s1 = CX - sw - 5, s2 = CX + 5, on1 = G.invSel !== 2, on2 = G.invSel === 2;
    INV_SHARE.splice(0, 4, s1, sy, sw, sh); INV_COPY.splice(0, 4, s2, sy, sw, sh);
    artFill(on1 ? '#ffd23a' : '#3a2a48', s1, sy, sw, sh); ring(s1, sy, sw, sh, 1, '#ffffff');
    drawShareIcon(s1 + 22, sy + sh / 2 + .5, on1 ? '#1a0a24' : '#ffffff');
    artText('SHARE', s1 + 48, sy + 5.5, 9, on1 ? '#1a0a24' : '#ffffff', 'center', null, true);
    artFill(on2 ? '#ffd23a' : '#3a2a48', s2, sy, sw, sh); ring(s2, sy, sw, sh, 1, '#ffffff');
    artText('COPY LINK', s2 + sw / 2, sy + 5.5, 9, on2 ? '#1a0a24' : '#ffffff', 'center', null, true);
    const url = inviteURL(); if (url) artText(url.replace(/^https?:\/\//, ''), CX, sy + sh + 8, 5.5, '#9a8aa0', 'center', null, true);
    if (G.invMsg) artText(G.invMsg, CX, sy + sh + 19, 6, '#5aff8a');
    artText(NET.guest ? 'PLAYER 2 CONNECTED!' : NET.id ? 'WAITING FOR PLAYER 2...' : 'CONNECTING...', CX, py + ph - 24, 6.5, NET.guest ? '#5aff8a' : '#c8b8d8');
    artText('< > : CHOOSE   ENTER: SELECT   ESC: CLOSE', CX, py + ph - 13, 6, '#ffffff');
    return;
  }
  const pw = W - 16, ph = H - 16, px = 8, py = 8; INV_POP.splice(0, 4, px, py, pw, ph);
  artFill('#120a1c', px, py, pw, ph); ring(px, py, pw, ph, 1, '#ffd23a');
  artText('INVITE A PLAYER', CX, py + 7, 11, '#ffd23a');
  const bw = Math.floor((pw - 30) / 2), bh = ph - 54, by = py + 26;
  for (const i of [0, 1]) {
    const bx = px + 10 + i * (bw + 10), on = (G.invSel || 0) === i; (i ? INV_R : INV_L).splice(0, 4, bx, by, bw, bh);
    artFill(on ? 'rgba(255,210,58,.08)' : 'rgba(255,255,255,.03)', bx, by, bw, bh); ring(bx, by, bw, bh, on ? 2 : 1, on ? '#ffd23a' : '#5a4a60');
    const cx2 = bx + bw / 2;
    if (i === 0) {   // LOCAL : QR code
      artText('LOCAL', cx2, by + 6, 9, on ? '#ffd23a' : '#ffffff');
      artText('Player 2 nearby: scan this code', cx2, by + 19, 6, '#d8c8e0');
      const q = inviteQR(), sz = Math.min(86, bh - 46);
      if (q) artDraw(q, cx2 - sz / 2, by + 30, sz, sz, false); else { artFill('#222', cx2 - sz / 2, by + 30, sz, sz); artText('...', cx2, by + 30 + sz / 2 - 4, 8, '#9a8aa0'); }
    } else {   // À DISTANCE : bouton Partager
      artText('ONLINE', cx2, by + 6, 9, on ? '#ffd23a' : '#ffffff');
      artText('Send an invitation link', cx2, by + 19, 6, '#d8c8e0');
      artText('(WhatsApp, Messenger, e-mail...)', cx2, by + 28, 6, '#d8c8e0');
      const sw = 84, sh = 22, sx = cx2 - sw / 2, sy = by + 46; INV_SHARE.splice(0, 4, sx, sy, sw, sh);
      artFill(on ? '#ffd23a' : '#3a2a48', sx, sy, sw, sh); ring(sx, sy, sw, sh, 1, '#ffffff');
      drawShareIcon(sx + 12, sy + sh / 2 + .5, on ? '#1a0a24' : '#ffffff');
      artText('TAP TO SHARE', sx + 49, sy + 7, 8, on ? '#1a0a24' : '#ffffff', 'center', null, true);
      if (G.invMsg) artText(G.invMsg, cx2, sy + sh + 8, 6, '#5aff8a');
    }
  }
  artText(NET.guest ? 'PLAYER 2 CONNECTED!' : NET.id ? 'WAITING FOR PLAYER 2...' : 'CONNECTING...', CX, py + ph - 24, 6.5, NET.guest ? '#5aff8a' : '#c8b8d8');
  artText(isTouch || padOn() ? '< > : CHOOSE   B: CLOSE' : '< > : CHOOSE   ENTER: SHARE   ESC: CLOSE', CX, py + ph - 13, 6, '#ffffff');
}
function drawQRPopup() {   // deux QR codes : joueur 1 à gauche, joueur 2 à droite ; B pour fermer
  const pw = Math.min(W - 24, 300), phh = 150, px = Math.round(CX - pw / 2), py = 30;
  QR_POP[0] = px; QR_POP[1] = py; QR_POP[2] = pw; QR_POP[3] = phh;
  if (HI.width > W) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); }   // la fenêtre passe au-dessus de la grille
  artFill('rgba(0,0,0,.6)');
  artFill('#120a1c', px, py, pw, phh);
  ring(px, py, pw, phh, 1, '#ffd23a');
  artText('ADD CONTROLLERS', CX, py + 8, 10, '#ffd23a');
  artText('Scan with your smartphone to use it as a gamepad', CX, py + 22, 6.5, '#d8c8e0');
  for (const p of [1, 2]) {
    const q = QR[p], col = p === 1 ? '#2ef0f0' : '#ff3ae8', ps = padSlots(), padP = ps['p' + p] != null && !remoteOn(p), on = remoteOn(p) || (p === 2 && padP);
    const sz = 76, x = Math.round(CX + (p === 1 ? -pw / 4 : pw / 4) - sz / 2), y = py + 44;
    artText('PLAYER ' + p, x + sz / 2, y - 11, 8, col);
    if (q) { artDraw(q, x, y, sz, sz, false, on ? .35 : 1); }
    else { artFill('#222', x, y, sz, sz); artText(NET.status === 'error' ? 'OFFLINE' : '...', x + sz / 2, y + sz / 2 - 4, 8, '#9a8aa0'); }
    artText(padP && p === 2 ? 'GAMEPAD' : on ? 'CONNECTED' : 'SCAN TO PLAY', x + sz / 2, y + sz + 4, 7, on ? '#5ae06a' : '#d8c8a8');
  }
  artText(isTouch || padOn() ? 'B: CLOSE' : 'ESC: CLOSE', CX, py + phh - 13, 8, '#ffffff');
}

const STAGES = [['dojo', 'DOJO'], ['city', 'CITY NIGHT'], ['temple', 'MISTY TEMPLE'], ['hall', 'GARGOYLE HALL'], ['ring', 'UNDERGROUND RING'], ['alley', 'BACK ALLEY'], ['lab', 'BIO LAB'], ['terrace', 'INFERNO TERRACE']];
function drawStageSelect() {
  R(0, 0, W, H, '#000'); drawCover(TITLE_IMG, 1);
  R(0, 0, W, H, 'rgba(8,4,14,.72)');
  text('SELECT STAGE', CX, 14, 8, '#ffd23a', 'center');
  const COLS = 4, gap = 8, cw = Math.floor(Math.min(104, (W - 24 - gap * (COLS - 1)) / COLS)), ch = Math.round(cw * 9 / 16), x0 = Math.round(CX - (COLS * cw + (COLS - 1) * gap) / 2);
  STAGES.forEach(([id, name], i) => {
    const x = x0 + (i % COLS) * (cw + gap), y = 34 + Math.floor(i / COLS) * (ch + 12), on = (G.scur || 0) === i, blink = (G.frame >> 3) % 2;
    popIn(ent(i, 2, 9), x + cw / 2, y + ch / 2, () => {
    R(x - 3, y - 3, cw + 6, ch + 6, on ? (blink ? '#ffd23a' : '#ff6a1a') : '#5a4a60');
    R(x - 1, y - 1, cw + 2, ch + 2, '#000');
    const bg = BGS[id];
    if (bg) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(bg, (bg.width - bg.height * 16 / 9) / 2, 0, bg.height * 16 / 9, bg.height, x, y, cw, ch); ctx.restore(); }
    if (!on) R(x, y, cw, ch, 'rgba(0,0,0,.45)');
    });
  });
  { const nm = STAGES[G.scur || 0][1], k = Math.min(1, (G.st || 0) / 1); text(nm, CX, 178, 16, '#ffd23a', 'center'); }   // seul le nom du stage sélectionné
  text(isTouch ? '< >: CHOOSE   A: FIGHT   B: BACK' : '< >: CHOOSE   ENTER: FIGHT   ESC: BACK', CX, 200, 8, '#d8c8a8', 'center');
}

// Écran de fin de combat : les deux visages, le perdant blessé ; RETRY / SELECT CHARACTER
const SEL_GRAY = [];
const LOSE_FACE = SEL_KEYS.map(k => { const im = new Image(); lazySrc(im, 'lose_' + k + '.jpg?v=1'); return im; });   // image de chaque perdant
const LOSE_DIR = [-1, -1, -1, -1, 1, 1, -1, 1];   // sens du regard des images de perdant
const LOSE_GRAY = [];
const loseGray = i => imgOk(LOSE_FACE[i]);   // l'image de défaite est utilisée (en noir et blanc)
function grayOf(i) {   // perdant : son image de défaite en noir et blanc (sinon visage en noir et blanc)
  const lose = loseGray(i), C = lose ? LOSE_GRAY : SEL_GRAY;
  if (C[i]) return C[i];
  const im = lose ? LOSE_FACE[i] : SEL_FACE[i]; if (!imgOk(im)) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  try { const d = g.getImageData(0, 0, c.width, c.height), p = d.data; for (let j = 0; j < p.length; j += 4) { const v = p[j] * .3 + p[j + 1] * .59 + p[j + 2] * .11; p[j] = (p[j] + v) / 2; p[j + 1] = (p[j + 1] + v) / 2; p[j + 2] = (p[j + 2] + v) / 2; }   /* désaturé à 50 % */ g.putImageData(d, 0, 0); } catch (e) { return im; }
  return C[i] = c;
}
function overFace(i, x, y, sz, border, look, gray) {
  artFill('#000', x - 2, y - 2, sz + 4, sz + 4); ring(x, y, sz, sz, 1, border);
  const im = gray ? grayOf(i) : SEL_FACE[i];
  if (im && imgOk(im)) artDraw(im, x, y, sz, sz, (gray && (im === LOSE_FACE[i] || im === LOSE_GRAY[i]) ? LOSE_DIR[i] : SEL_FACE_DIR[i]) !== look); else drawPortrait(i, x, y, sz, border, look, gray);
}
function drawOver() {
  R(0, 0, W, H, '#000');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
  if (imgOk(TITLE_IMG)) { const k0 = Math.max(W / TITLE_IMG.naturalWidth, H / TITLE_IMG.naturalHeight), w0 = TITLE_IMG.naturalWidth * k0, h0 = TITLE_IMG.naturalHeight * k0; artDraw(TITLE_IMG, CX - w0 / 2, H / 2 - h0 / 2, w0, h0, false); }
  artFill('rgba(6,2,10,.78)');
  const [a, b] = G.f, aw = a.wins >= 2, bw = b.wins >= 2;
  const k = Math.min(1, G.t / 25), BS = Math.min(96, Math.round((W - 80) / 2 - 20)), y0 = 22;
  const lx = Math.round(CX - 18 - BS - (1 - k) * 60), rx = Math.round(CX + 18 + (1 - k) * 60);
  overFace(a.def.idx, lx, y0, BS, aw ? '#ffd23a' : '#5a4a60', 1, !aw);   // le perdant : en noir et blanc
  overFace(b.def.idx, rx, y0, BS, bw ? '#ffd23a' : '#5a4a60', -1, !bw);
  text(a.def.name, lx + BS / 2, y0 + BS + 6, 8, '#ffffff', 'center');
  text(b.def.name, rx + BS / 2, y0 + BS + 6, 8, '#ffffff', 'center');
  text(aw ? 'WINNER' : 'LOSER', lx + BS / 2, y0 + BS + 17, 8, aw ? '#ffd23a' : '#9a6a6a', 'center');
  text(bw ? 'WINNER' : 'LOSER', rx + BS / 2, y0 + BS + 17, 8, bw ? '#ffd23a' : '#9a6a6a', 'center');
  text('VS', CX, y0 + BS / 2 - 8, 16, '#ff4a2a', 'center');
  const won = a.cpu === false ? aw : bw;
  if (G.t > 20) text(won ? 'YOU WIN!' : 'YOU LOSE...', CX, 4, 8, won ? '#ffd23a' : '#ff5a4a', 'center');
  if (G.perfect && G.t > 100) { const k = Math.min(1, (G.t - 100) / 8), sc = 1 + (1 - k) * 2; ctx.save(); ctx.globalAlpha = k; ctx.translate(CX, 162); ctx.scale(sc, sc); text('PERFECT!', 0, -8, 16, (G.frame >> 3) % 2 ? '#ffd23a' : '#ffffff', 'center'); ctx.restore(); }
  if (G.score) {   // score du combat sous chaque personnage
    text('SCORE ' + fmtSc(G.score.rows[0].total), lx + BS / 2, y0 + BS + 28, 8, '#5ac8ff', 'center');
    if (!(G.mode === 'arcade' && G.arc)) text('SCORE ' + fmtSc(G.score.rows[1].total), rx + BS / 2, y0 + BS + 28, 8, '#ff6ae8', 'center');
    else text('TOTAL ' + fmtSc(G.arc.total || 0), rx + BS / 2, y0 + BS + 28, 8, '#5aff8a', 'center');
  }
  if (G.mode === 'arcade' && G.arc && won) text('STAGE ' + (G.arc.i + 1) + ' / ' + G.arc.list.length + ' CLEAR', CX, 14, 8, '#ffffff', 'center');
  if (G.t > 30) overItems(won).forEach((m, i) => {
    const sel = (G.ocurOver || 0) === i;
    text((sel ? '> ' : '') + m + (sel ? ' <' : ''), CX, 176 + i * 13, 8, sel ? '#ffd23a' : 'rgba(255,255,255,.6)', 'center');
  });
}

function render() {
  hiUsed = false;
  if (G.guest && !LS.on) { ctx.save(); drawGuest(); ctx.restore(); if (HI.style.visibility !== 'hidden') HI.style.visibility = 'hidden'; return; }
  ctx.save();
  const grp = ['intro', 'fight', 'ko', 'timeup', 'score'].includes(G.scene) ? 'fight' : G.scene;
  if (G.noWipe) { G.noWipe = false; prevGroup = grp; }
  if (prevGroup && grp !== prevGroup) {   // changement d'écran : on garde une image de l'ancien pour le volet de transition
    SNAP.width = cv.width; SNAP.height = cv.height; { const sc2 = SNAP.getContext('2d'); if (HI.style.visibility === 'visible') sc2.drawImage(HI, 0, 0, cv.width, cv.height); sc2.drawImage(cv, 0, 0); } transT = 0; G.st = 0;
  }
  prevGroup = grp;
  if (G.shake && !G.paused && (G.scene === 'fight' || G.scene === 'intro' || G.scene === 'ko' || G.scene === 'timeup')) ctx.translate(Math.round((Math.random() - .5) * G.shake * 2), Math.round((Math.random() - .5) * G.shake * 2));   // en pause : image figée
  switch (G.scene) {
    case 'title': drawTitle(); break;
    case 'select': drawSelect(); break;
    case 'stage': drawStageSelect(); break;
    case 'over': drawOver(); break;
    case 'ending': drawEnding(); break;
    default: drawFight();
  }
  ctx.restore();
  if (G.paused && grp === 'fight' && !G.photo) drawPause();   // menu pause jamais secoué
  tutSync();
  if (G.instHelp) drawInstHelp();
  if (transT < TRANS_N) { drawTransition(transT / TRANS_N); transT++; }
  if (G.demo && (G.frame >> 5) % 2 === 0) text('PRESS ANY KEY', CX, H - 30, 8, '#ffffff', 'center');   // démo
  drawNote(); drawLsWait();
  if (G.fadeK > 0) { R(0, 0, W, H, `rgba(0,0,0,${Math.min(1, G.fadeK).toFixed(3)})`); if (!G.demo && G.scene === 'title' && !(G.demoOut > 0)) G.fadeK = Math.max(0, G.fadeK - 1 / DEMO_FADE); }   // fondus de la démo
  if (!hiUsed && HI.style.visibility !== 'hidden') HI.style.visibility = 'hidden';
  if (!LS.on) castFrame();   // image envoyée au Player 2 en ligne (inutile pendant un combat SYNC)
}
// Transition entre écrans : un volet diagonal noir bordé d'une lame de lumière balaie l'ancien écran
let prevGroup = null, transT = 99;
const TRANS_N = 26, SNAP = document.createElement('canvas');
function drawTransition(p) {
  const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, slant = H * .45;
  const ex = -slant - 30 + (W + slant + 60) * e;          // bord du volet (en bas)
  ctx.save();
  ctx.beginPath(); ctx.moveTo(ex + slant, 0); ctx.lineTo(W + 10, 0); ctx.lineTo(W + 10, H); ctx.lineTo(ex, H); ctx.closePath(); ctx.clip();
  ctx.drawImage(SNAP, 0, 0, W, H);
  ctx.fillStyle = `rgba(0,0,0,${Math.min(.6, p * 1.4)})`; ctx.fillRect(0, 0, W, H);   // l'ancien écran s'assombrit
  ctx.restore();
  ctx.save();   // bande noire + lame de lumière
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(ex + slant - 26, 0); ctx.lineTo(ex + slant + 2, 0); ctx.lineTo(ex + 2, H); ctx.lineTo(ex - 26, H); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  for (const [w, c] of [[7, 'rgba(255,90,20,.35)'], [3, 'rgba(255,170,60,.8)'], [1, '#fff4d0']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ex + slant + 2, 0); ctx.lineTo(ex + 2, H); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,120,40,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex + slant - 26, 0); ctx.lineTo(ex - 26, H); ctx.stroke();
  ctx.restore();
}
// apparition échelonnée des éléments d'un écran (0 → 1), après le volet
const ent = (i, d = 3, len = 10) => { const k = Math.max(0, Math.min(1, ((G.st || 0) - 12 - i * d) / len)); return 1 - Math.pow(1 - k, 3); };
function popIn(k, cx, cy, fn) {   // agrandit depuis le centre avec un léger rebond
  if (k <= 0) return; const sc = k < 1 ? .4 + .6 * k + Math.sin(k * Math.PI) * .12 : 1;
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); fn(); ctx.restore();
}

resize();
if (!BG) { for (const k in STAGE_IMG) BGS[k] = buildStageBG(k); BG = BGS.dojo; }

let last = performance.now(), acc = 0;
const ERRS = []; function errLog(e) { if (ERRS.length < 20) { ERRS.push(String(e && e.stack || e)); console.error(e); } }
let infightCls = null;
function loop(now) {
  { const f0 = G.guest && !LS.on ? !!G.guest.fight : ['intro', 'fight', 'ko', 'timeup'].includes(G.scene) && !G.demo && !G.boot, f = G.photo ? 'photo' : f0;   /* score / YOU WIN : boutons des menus */ if (f !== infightCls) { infightCls = f; if (f === 'photo') { document.body.classList.add('infight'); const lb = (sel, t) => { const e = document.querySelector(sel + ' small'); if (e) e.textContent = t; }; lb('.ba', 'PHOTO'); lb('.bb', 'BACK'); lb('.by', 'ZOOM -'); lb('.bx', 'ZOOM +'); } else { document.body.classList.toggle('infight', f); const lb = (sel, t) => { const e = document.querySelector(sel + ' small'); if (e) e.textContent = t; }; lb('.ba', f ? 'SPECIAL' : 'CONFIRM'); lb('.bb', f ? 'KICK' : 'BACK'); lb('.by', f ? 'PUNCH' : ''); lb('.bx', f ? 'COUNTER' : ''); } } }   // menus : A = CONFIRM, B = BACK ; combat : SPECIAL / KICK   // bouton START de la manette : seulement en combat
  acc += Math.min(100, now - last); last = now;
  requestAnimationFrame(loop);   // planifié d'abord : une erreur ne fige jamais le jeu
  while (acc >= 1000 / 60) { acc -= 1000 / 60; try { step(); lsAfterStep(); } catch (e) { errLog(e); } }
  try { render(); } catch (e) { errLog(e); try { for (let i = 0; i < 30; i++) ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0; } catch (e2) {} }
}
const go = () => requestAnimationFrame(t => { last = t; loop(t); });
if (document.fonts && document.fonts.load) {
  Promise.race([document.fonts.load('8px "Press Start 2P"'), new Promise(r => setTimeout(r, 1500))]).then(go, go);
} else go();

// Accès debug pour les tests
if (JOIN) guestStart();   // ouvert depuis un lien d'invitation : Player 2 en ligne
window.__SF = G; window.__QR = QR; window.__ERRS = ERRS; window.__sfx = n => { initAudio(); sfx(n); }; window.__NET = NET; window.__BGM = BGM; window.__bgmGain = () => bgmGain; window.__mkqr = () => makeQRs(); window.__start = (a, b, s) => startMatch(a, b, s); window.__spr = (f, skip) => { const keep = ctx; window.__skip = skip; drawFighter(f, -999, -999); window.__skip = null; return SPR.toDataURL(); };
})();
