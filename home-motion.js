/* ==========================================================================
   NSF — Motion layer (runs after home.js, used by index-motion.html)
   ========================================================================== */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobileLite = matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)').matches;   // phones / tablets: lighter scroll effects
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Injected layers ---------- */
  const progress = document.createElement('div');
  progress.className = 'motion-progress'; progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  document.body.prepend(progress);

  if (!reduce) {
    const grain = document.createElement('div');
    grain.className = 'motion-grain'; grain.setAttribute('aria-hidden', 'true');
    document.body.append(grain);
  }

  const hero = document.querySelector('.hero');
  if (hero && !reduce) {
    const streaks = document.createElement('div');
    streaks.className = 'hero-streaks'; streaks.setAttribute('aria-hidden', 'true');
    streaks.innerHTML = '<i></i><i></i><i></i><i></i>';
    (hero.querySelector('.hero-dim') || hero.querySelector('.hero-shade'))?.after(streaks);
  }

  /* ---------- Cursor tip (desktop): a small pixel message that follows the mouse ----------
     set(owner, label): show / hide the invitation of a zone (banner: CLICK TO PIXELATE, fighters: CLICK ON THE FIGHTER),
     retyped every 2 s. shout(): each click answers with the next message (YEEEEAH! ...), which also follows the mouse. */
  const cursorTip = (() => {
    const off = { set() {}, shout() {}, say() {} };
    if (reduce) return off;
    const touch = !matchMedia('(hover: hover) and (pointer: fine)').matches;   // phones / tablets: no invitation, the messages pop where you tap
    const el = document.createElement('div'); el.className = 'hero-hint cursor-tip'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span></span>'; document.body.append(el);
    const txt = el.firstChild, SHOUTS = (Array.isArray(window.NSF_SHOUTS) && window.NSF_SHOUTS.length) ? window.NSF_SHOUTS : ['YEEEEAH!', 'WOW! DID YOU SEE THAT?!', 'SO COOOL!', "LET'S PIXEL FIGHT!", 'PIXEL FOREVER!'];   // NSF_SHOUTS: Mouse Answers from the admin panel
    let owner = null, label = null, step = 0, shoutN = 0, shouting = false, shoutT = 0, cycleT = 0;
    const place = (x, y) => {
      if (!touch) { el.style.transform = `translate(${Math.round(x + 24)}px, ${Math.round(y + 18)}px)`; return; }
      const w = el.offsetWidth || 160;                           // above the finger, kept inside the screen
      el.style.transform = `translate(${Math.round(Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)))}px, ${Math.round(Math.max(8, y - 64))}px)`;
    };
    if (!touch) addEventListener('pointermove', e => place(e.clientX, e.clientY), { passive: true });
    const retype = () => { txt.style.animation = 'none'; void txt.offsetWidth; txt.style.animation = ''; };
    function render() {
      clearInterval(cycleT);
      if (shouting) return;
      if (label) {
        const list = Array.isArray(label) ? label : [label], cur = () => list[step % list.length];
        if (txt.textContent !== cur() || !el.classList.contains('is-on')) { txt.textContent = cur(); el.classList.add('is-on'); retype(); }
        cycleT = setInterval(() => { step++; txt.textContent = cur(); retype(); }, 2000);   // next message (or the same one retyped) every 2 s
      }
      else el.classList.remove('is-on');
    }
    return {
      set(who, text) {
        if (touch) return;
        if (!text && owner !== who) return;
        if (owner === who && label === text) return;
        owner = text ? who : null; label = text || null; step = 0; render();
      },
      say(list, x, y) {                                          // phones: a list of messages above the finger, 2 s each, then gone
        if (!touch) return;
        clearInterval(cycleT); clearTimeout(shoutT); shouting = true; let n = 0;
        el.classList.remove('is-shout', 'is-alt', 'is-out'); el.classList.add('is-say', 'is-on');
        const show = () => { txt.textContent = list[n]; place(x, y); retype(); };
        show();
        cycleT = setInterval(() => {
          if (++n < list.length) return show();
          clearInterval(cycleT); el.classList.remove('is-on');
          shoutT = setTimeout(() => { el.classList.remove('is-say'); shouting = false; }, 260);
        }, 2000);
      },
      shout(x, y) {
        if (!touch && !label && !shouting) return;               // desktop: only where an invitation is shown
        txt.textContent = SHOUTS[shoutN % SHOUTS.length]; el.classList.toggle('is-alt', shoutN % 2 === 1); shoutN++;
        if (touch && x != null) { el.classList.add('is-shout'); place(x, y); }
        if (touch) document.body.classList.add('tip-busy');   // phones: TAP TO PIXELATE steps aside while YEEEEAH! & co are shown
        shouting = true; clearInterval(cycleT); clearTimeout(shoutT);
        el.classList.remove('is-on', 'is-shout', 'is-out', 'is-say'); void el.offsetWidth; el.classList.add('is-on', 'is-shout');
        shoutT = setTimeout(() => { el.classList.add('is-out'); shoutT = setTimeout(() => {
          el.classList.remove('is-on', 'is-shout', 'is-out', 'is-alt'); shouting = false; render();
          if (touch) {                                           // ...then it plays again from the start
            document.body.classList.remove('tip-busy');
            const th = document.querySelector('.hero-tap-hint span');
            if (th) { th.style.animation = 'none'; void th.offsetWidth; th.style.animation = 'tap-hint-in .4s ease both, tap-hint-loop 3.2s infinite, hint-blink 1s steps(1) infinite'; }
          }
        }, 260); }, 1500);
      }
    };
  })();

  /* ---------- Header: the World records link zaps every 3 s (green / purple + shake) and shows a message under it ----------
     Messages: Header Messages in the admin panel (window.NSF_NAV_TIPS), defaults below. Mobile burger: the zap only. */
  (() => {
    const links = [...document.querySelectorAll('.main-nav a[href="#records"], .mobile-menu-panel a[href="#records"]')];
    if (!links.length || reduce) return;
    const TIPS = (Array.isArray(window.NSF_NAV_TIPS) && window.NSF_NAV_TIPS.length) ? window.NSF_NAV_TIPS : ["CHECK WHO'S NUMBER ONE!", 'CAN YOU BEAT THE TOP 100?', 'YOUR NAME BELONGS HERE!'];
    const deskLink = links.find(a => a.closest('.main-nav'));
    const tip = document.createElement('div'); tip.className = 'nav-tip'; tip.setAttribute('aria-hidden', 'true'); tip.innerHTML = '<span></span>'; document.body.append(tip);
    let n = 0, hideT = 0;
    const loop = (ms) => setTimeout(tick, ms);
    function tick() {
      // already on the World records section: no animation, the link just stays purple (active)
      if (document.hidden || links.some(a => a.classList.contains('is-active'))) { tip.classList.remove('is-on'); return loop(1000); }
      const menuOpen = document.body.classList.contains('mobile-menu-open');
      links.forEach(a => { if (a.closest('.mobile-menu-panel')) return; a.classList.remove('is-nav-zap'); void a.offsetWidth; a.classList.add('is-nav-zap'); });   // burger link: only while the menu is open
      const r = deskLink && deskLink.getBoundingClientRect();
      if (r && r.width && getComputedStyle(deskLink).visibility !== 'hidden' && !document.body.classList.contains('mobile-menu-open')) {
        tip.firstChild.textContent = TIPS[n++ % TIPS.length]; tip.classList.toggle('is-alt', n % 2 === 0);
        tip.style.left = `${Math.round(r.left + r.width / 2)}px`; tip.style.top = `${Math.round(r.bottom + 10)}px`;
        tip.classList.remove('is-on'); void tip.offsetWidth; tip.classList.add('is-on');
        clearTimeout(hideT); hideT = setTimeout(() => tip.classList.remove('is-on'), 2200);
        return loop(2200 + 5000);                                // next one 5 s after the message has gone
      }
      loop(5000);
    }
    setTimeout(tick, 2500);
    // mobile burger menu open: the World records link blinks every second (not when you are already on the section)
    setInterval(() => {
      if (document.hidden || !document.body.classList.contains('mobile-menu-open')) return;
      links.forEach(a => { if (!a.closest('.mobile-menu-panel') || a.classList.contains('is-active')) return; a.classList.remove('is-nav-zap'); void a.offsetWidth; a.classList.add('is-nav-zap'); });
    }, 1000);
  })();

  /* Special modes price: invitation next to the cursor (desktop) */
  document.querySelectorAll('.special-price').forEach(btn => {
    btn.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') cursorTip.set('price', 'SEE HOW TO EARN NITRO COINS'); });
    btn.addEventListener('pointerleave', () => cursorTip.set('price', null));
    btn.addEventListener('click', () => cursorTip.set('price', null));
  });

  /* NSF experience cards: when they appear, each one plays its hover animation for 1 s, one after the other (with its charging line) */
  (() => {
    const cards = [...document.querySelectorAll('.about-pillar')], wrap = document.querySelector('.about-pillars');
    if (!cards.length || !wrap || reduce) return;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      cards.forEach((card, i) => setTimeout(() => {
        card.classList.add('is-intro');
        setTimeout(() => card.classList.remove('is-intro'), 1000);
      }, 150 + i * 200));                                        // same rhythm as the lines (0 / .2 / .4 / .6 s)
    }, { threshold: .35 });
    io.observe(wrap);
  })();

  /* ---------- NSF experience cards: power messages next to the cursor (desktop) ---------- */
  const POWER_TIPS = {
    'about-nitro': ['ACTIVATE NITRO POWER', 'MAKE YOUR BEST COMBO', 'TRY YYBB / YYBA'],
    'about-surge': ['ACTIVATE SURGE POWER', 'MAKE YOUR BEST COMBO', 'TRY YYBB / YYBA'],
    'about-rage': ['ACTIVATE RAGE POWER', 'MAKE YOUR BEST COMBO', 'TRY YYBB / YYBA'],
    'about-more': ['COMING SOON']
  };
  document.querySelectorAll('.about-pillar').forEach(card => {
    const key = Object.keys(POWER_TIPS).find(k => card.classList.contains(k)); if (!key) return;
    card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') cursorTip.set('power', POWER_TIPS[key]); });
    card.addEventListener('pointerleave', () => cursorTip.set('power', null));
    let tapT = 0;   // phones: a tap plays the hover animation for 3 s
    card.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      document.querySelectorAll('.about-pillar.is-tap').forEach(c => { if (c !== card) c.classList.remove('is-tap'); });
      const list = POWER_TIPS[key];
      card.classList.add('is-tap'); clearTimeout(tapT); tapT = setTimeout(() => card.classList.remove('is-tap'), Math.max(3000, list.length * 2000));
      cursorTip.say(list, e.clientX, e.clientY);
    }, { passive: true });
  });

  /* ---------- Hero: pixel light under the cursor (desktop) ----------
     The 20% black film is drawn on a tiny canvas (1 canvas pixel = 1 cell the size of the square cursor, scaled up pixelated).
     Under the mouse, a circular, pixelated zone clears the film; it opens fast and closes slowly (light trail), the cells
     at its edge glow nitro green / surge purple, and a click sends a ring of light. */
  if (hero && !matchMedia('(hover: hover) and (pointer: fine)').matches)
    hero.addEventListener('pointerdown', e => { if (!e.target.closest('a, button')) cursorTip.shout(e.clientX, e.clientY); }, { passive: true });
  const heroDim = hero && hero.querySelector('.hero-dim');
  if (hero && !reduce) {   // click / tap on the banner: the artwork punches in (zoom + quick flash) and settles back, with the pixel wave
    const heroMedia = hero.querySelector('.hero-media');
    hero.addEventListener('pointerdown', e => {
      if (!heroMedia || e.target.closest('a, button')) return;
      const r = heroMedia.getBoundingClientRect();   // zoom centred on the click / tap point
      heroMedia.style.transformOrigin = `${Math.round(e.clientX - r.left)}px ${Math.round(e.clientY - r.top)}px`;
      heroMedia.classList.remove('is-punch'); void heroMedia.offsetWidth; heroMedia.classList.add('is-punch');
    }, { passive: true });
    heroMedia?.addEventListener('animationend', e => { if (e.animationName === 'hero-punch') heroMedia.classList.remove('is-punch'); });
  }
  const heroFine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (heroDim && !reduce) {   // PC: light follows the mouse; phones: a tap sends the pixel wave
    const CELL = 26, FILM = .3, RADIUS = 150;
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    heroDim.append(cv); heroDim.classList.add('is-pixel');
    let cols = 0, rows = 0, light = new Float32Array(0), noise = new Float32Array(0), img = null;
    let tapT = 0, overUi = false, mx = -1e4, my = -1e4, inside = false, reach = 0, ring = -1, raf = 0, last = 0, moved = 0, idleK = 0, nextWave = 0; const waves = [];
    function size() {
      const r = hero.getBoundingClientRect();
      cols = Math.ceil(r.width / CELL) + 1; rows = Math.ceil(r.height / CELL) + 1;
      cv.width = cols; cv.height = rows; cv.style.width = cols * CELL + 'px'; cv.style.height = rows * CELL + 'px';
      light = new Float32Array(cols * rows); noise = new Float32Array(cols * rows).map(() => Math.random());
      img = g.createImageData(cols, rows); paint();
    }
    function paint() {
      const d = img.data;
      for (let n = 0; n < cols * rows; n++) {
        const L = Math.round(light[n] * 4) / 4;                // 5 steps: retro, pixelated fade
        const edge = light[n] > .12 && light[n] < .72 ? 1 - Math.abs(light[n] - .42) / .3 : 0;   // frontier cells glow
        const purple = noise[n] > .5, o = n * 4;
        d[o] = purple ? 168 * edge : 120 * edge; d[o + 1] = purple ? 23 * edge : 239 * edge; d[o + 2] = purple ? 239 * edge : 54 * edge;
        d[o + 3] = Math.round(255 * Math.max(FILM * (1 - L), edge * .16));
      }
      g.putImageData(img, 0, 0);
    }
    function tick(now) {
      raf = 0;
      const dt = Math.min(50, now - (last || now)); last = now;
      reach += ((inside ? 1 : 0) - reach) * Math.min(1, dt / (inside ? 140 : 260));   // radius grows in on enter, shrinks on leave
      if (ring >= 0) ring += dt * .9;
      // mouse at rest: the light breathes and sends soft pixel waves around the cursor
      const idle = inside && now - moved > 450;
      idleK += ((idle ? 1 : 0) - idleK) * Math.min(1, dt / 400);
      if (idle && now >= nextWave) { waves.push(now); nextWave = now + 1300; }
      if (!idle) nextWave = now + 250;
      while (waves.length && now - waves[0] > 1700) waves.shift();
      const r = hero.getBoundingClientRect(), px = mx - r.left, py = my - r.top, R = RADIUS * reach * (1 + .05 * idleK * Math.sin(now / 520));
      let busy = inside || reach > .01 || ring >= 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const n = y * cols + x, cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
        const dist = Math.hypot(cx - px, cy - py) + (noise[n] - .5) * CELL * 1.4;   // ragged, pixel edge
        let t = R > 0 ? Math.min(1, Math.max(0, (R - dist) / (R * .45))) : 0;
        if (ring >= 0) { const rd = Math.abs(dist - ring); if (rd < CELL * 1.6) t = Math.max(t, 1 - rd / (CELL * 1.6)); }
        for (const w0 of waves) {                                   // soft wave: leaves the edge of the light, fades as it grows
          const age = now - w0, wr = R * .82 + age * .075, rd = Math.abs(dist - wr);
          if (rd < CELL * 1.2) t = Math.max(t, .36 * idleK * (1 - age / 1700) * (1 - rd / (CELL * 1.2)));
        }
        const k = t > light[n] ? Math.min(1, dt / 45) : Math.min(1, dt / 520);      // opens fast, closes slowly
        light[n] += (t - light[n]) * k;
        if (light[n] > .005) busy = true; else light[n] = 0;
      }
      if (ring > Math.max(r.width, r.height) * 1.2) ring = -1;
      paint();
      if (busy) raf = requestAnimationFrame(tick); else last = 0;
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    if (heroFine) hero.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; inside = true; moved = performance.now(); overUi = !!e.target.closest('a, button'); cursorTip.set('hero', overUi ? null : 'CLICK TO PIXELATE'); wake(); }, { passive: true });
    if (heroFine) hero.addEventListener('pointerleave', () => { inside = false; cursorTip.set('hero', null); wake(); });
    hero.addEventListener('pointerdown', e => { if (e.target.closest('a, button')) return; mx = e.clientX; my = e.clientY; ring = 0; moved = performance.now();
      if (heroFine) cursorTip.shout(e.clientX, e.clientY);
      else { inside = true; clearTimeout(tapT); tapT = setTimeout(() => { inside = false; wake(); }, 260); }   // tap: light flash where the finger is, then it closes slowly
      wake(); });
    addEventListener('scroll', () => { if (inside && hero.getBoundingClientRect().bottom < my) { inside = false; cursorTip.set('hero', null); wake(); } }, { passive: true });   // scrolled away without moving the mouse
    addEventListener('resize', size); size();
  }

  /* ---------- Section dots (desktop) ---------- */
  const dotSections = [
    ['top', 'HOME'], ['about-nsf', 'ABOUT'], ['fighters', 'FIGHTERS'], ['videos', 'VIDEOS'],
    ['special-modes', 'MODES'], ['records', 'RECORDS'], ['game-experience', 'EXPERIENCE'], ['wallpapers', 'WALLPAPERS'], ['footer-contact', 'CONTACT']
  ].filter(([id]) => document.getElementById(id));
  const dots = document.createElement('nav');
  dots.className = 'motion-dots'; dots.setAttribute('aria-label', 'Section progress');
  dotSections.forEach(([id, label]) => {
    const a = document.createElement('a'); a.href = `#${id}`; a.setAttribute('aria-label', label);
    const s = document.createElement('span'); s.textContent = label; a.append(s); dots.append(a);
  });
  document.body.append(dots);
  const dotLinks = [...dots.children];

  /* ---------- Curtain sections ---------- */
  const curtains = [...document.querySelectorAll('main > section:not(.hero)')];
  curtains.forEach(s => s.setAttribute('data-curtain', ''));

  /* ---------- Marquees ---------- */
  const marquees = [...document.querySelectorAll('.motion-marquee')].map(el => {
    const track = el.querySelector('.motion-marquee-track');
    const first = track?.firstElementChild;
    if (first) { for (let i = 0; i < 3; i++) { const c = first.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.append(c); } }
    return { el, track, dir: Number(el.dataset.direction) || -1, x: 0, visible: false };
  });
  const mqObserver = new IntersectionObserver(entries => entries.forEach(e => {
    const m = marquees.find(q => q.el === e.target); if (m) m.visible = e.isIntersecting;
  }));
  marquees.forEach(m => mqObserver.observe(m.el));

  /* ---------- Main scroll / frame loop ---------- */
  let lastY = scrollY, velocity = 0, skew = 0, lastT = performance.now();
  function frame(t) {
    const dt = Math.min(64, t - lastT); lastT = t;
    const y = scrollY, vh = innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    root.style.setProperty('--scroll-p', (y / max).toFixed(4));

    // velocity (px per frame, smoothed)
    const raw = y - lastY; lastY = y;
    velocity = lerp(velocity, raw, .18);
    skew = lerp(skew, clamp(velocity * -.18, -7, 7), .12);
    root.style.setProperty('--vel-skew', `${skew.toFixed(2)}deg`);

    if (!reduce) {
      // hero scroll-out
      if (hero && !mobileLite) {                                 // no hero scroll effects on phones (smooth scrolling)
        const h = hero.offsetHeight;
        hero.style.setProperty('--hero-out', clamp(y / (h * .85)).toFixed(3));
      }
      // curtains
      if (innerWidth > 900) {
        for (const s of curtains) {
          const r = s.getBoundingClientRect();
          if (r.top > vh || r.bottom < 0) continue;
          const p = clamp((vh - r.top) / (vh * .62));
          const eased = 1 - Math.pow(1 - p, 3);
          s.style.setProperty('--curtain', (1 - eased).toFixed(3));
        }
      }
      // marquees: constant drift + scroll boost
      for (const m of marquees) {
        if (!m.visible || !m.track) continue;
        const w = m.track.firstElementChild.offsetWidth || 1;
        m.x += m.dir * (dt * .06 + Math.abs(velocity) * .9);
        if (m.x <= -w) m.x += w; if (m.x > 0) m.x -= w;
        m.track.style.setProperty('--mq-x', `${m.x.toFixed(1)}px`);
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Active dot ---------- */
  function updateDots() {
    const mid = innerHeight * .45; let current = 0;
    dotSections.forEach(([id], i) => { const r = document.getElementById(id).getBoundingClientRect(); if (r.top <= mid) current = i; });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) current = dotSections.length - 1;   // bottom of the page: CONTACT
    dotLinks.forEach((a, i) => a.classList.toggle('is-active', i === current));
    dots.classList.toggle('is-on', scrollY > innerHeight * .5);
  }
  let dotRaf = 0;
  addEventListener('scroll', () => { if (!dotRaf) dotRaf = requestAnimationFrame(() => { dotRaf = 0; updateDots(); }); }, { passive: true });
  updateDots();

  /* ---------- Slider switch flash ---------- */
  function flashOnChange(counterId, windowSel) {
    const counter = document.getElementById(counterId), win = document.querySelector(windowSel);
    if (!counter || !win || reduce) return;
    let timer = 0, last = counter.textContent;
    new MutationObserver(() => {
      if (counter.textContent === last) return; last = counter.textContent;
      win.classList.remove('is-switching'); void win.offsetWidth; win.classList.add('is-switching');
      clearTimeout(timer); timer = setTimeout(() => win.classList.remove('is-switching'), 1100);
    }).observe(counter, { childList: true, characterData: true, subtree: true });
  }
  flashOnChange('fighter-count', '.fighter-window');
  flashOnChange('special-count', '.special-window');

  /* ---------- Records: staggered rows + count-up ---------- */
  function animateValue(el) {
    const txt = el.textContent.trim();
    if (!/^[\d,]+$/.test(txt) || reduce) return;
    const target = Number(txt.replace(/,/g, '')); if (!target) return;
    const start = performance.now(), dur = 1200;
    const step = now => {
      const p = clamp((now - start) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(target * e).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  document.querySelectorAll('.record-list').forEach(list => {
    const apply = () => list.querySelectorAll('.record-row').forEach((row, i) => {
      if (row.dataset.motion) return; row.dataset.motion = '1';
      row.style.setProperty('--row', i);
      const v = row.querySelector('.record-value'); if (v) animateValue(v);
    });
    new MutationObserver(apply).observe(list, { childList: true }); apply();
  });

  /* ---------- Fighter move previews: IDLE / HIT COMBO / SPECIAL ----------
     Sprite sheets in fighter-moves/<key>.png (120x86 frames, transparent, from NSF_Sprites/vue_droite).
     The special projectile is a port of the game's drawFireball0 with each fighter's palette. */
  const MOVES = {
    hiro:   { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','upper_0','special_0','special_1'], cx: 59.5, fb: ['#ffffff','#a8f4ff','#2fb4ff','#1458c4'], tips: { punch_1:[83,48], kick_1:[87,50], fpunch_1:[84,46], special_1:[80,50] } },
    axel:   { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','upper_0','special_0','special_1','crouch','fjump','walk_0','walk_1','walk_2','walk_3','walk_4','walk_5','walk_6','walk_7'], cx: 62.5, special: 'fireleap', fb: ['#ffffff','#fff2a0','#ff9c2c','#c64812'], tips: { punch_1:[83,48], kick_1:[88,49], fpunch_1:[84,46], special_1:[80,50], fjump:[84,46] } },
    zephyr: { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_1','upper_0','special_0','special_1','punch_0__gust','punch_1__gust'], cx: 67.5, special: 'galeblade', fb: ['#ffffff','#d8fbff','#7ae8f0','#2a9aaa'], tips: { punch_1:[101,44], kick_1:[88,50], fpunch_1:[84,46], special_1:[98,48] } },
    nyx:    { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','upper_0','special_0','special_1'], cx: 61.5, fb: ['#ffffff','#ffb0e0','#c83aff','#6a0a8a'], tips: { punch_1:[83,48], kick_1:[88,50], fpunch_1:[84,46], special_1:[80,50] } },
    kael:   { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','upper_0','special_0','special_1'], cx: 62,   fb: ['#ffffff','#c8f8ff','#5af0ff','#1a78d0'], tips: { punch_1:[83,48], kick_1:[88,50], fpunch_1:[84,46], special_1:[80,50] } },
    vesper: { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','upper_0','special_0','special_1'], cx: 60.5, fb: ['#ffffff','#c8f8ff','#3af0ff','#c83aff'], tips: { punch_1:[83,48], kick_1:[88,50], fpunch_1:[84,46], special_1:[80,50] } },
    grog:   { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','upper_0','special_0','special_1'], cx: 62.5, fb: ['#ffffff','#a8f4ff','#2fb4ff','#1458c4'], tips: { punch_1:[85,44], kick_1:[89,46], fpunch_1:[87,44], special_1:[82,48] } },
    vane:   { f: ['idle_0','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','upper_0','special_0','special_1'], cx: 61,   fb: ['#ffffff','#e0b0ff','#8a2ad0','#2a0a4a'], tips: { punch_1:[83,48], kick_1:[88,50], fpunch_1:[84,46], special_1:[80,50] } }
  };
  const VIEW_TOP = 18, VIEW_H = 76 - VIEW_TOP + 5;            // feet are on row 75 of each frame           // sprite rows shown (head room → feet + floor)
  const SEQ = {
    idle:    { w: 52, off: .5,  steps: [['idle_0', 420], ['idle_1', 420]] },
    combo:   { w: 76, off: .38, steps: [['idle_0', 520], ['punch_0', 90], ['punch_1', 150, 1], ['punch_0', 90], ['punch_1', 150, 1], ['kick_0', 110], ['kick_1', 230, 1], ['fpunch_0', 100], ['fpunch_1', 210, 1], ['upper_0', 360], ['idle_0', 640]] },
    special: { w: 124, off: .2, steps: [['idle_0', 560], ['special_0', 300], ['special_1', 720], ['idle_0', 1300]] }
  };
  const FB_SPEED = .2;                                       // sprite px per ms (≈ in-game speed)
  function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function disc(g, x, y, r, c) {
    g.fillStyle = c; x = Math.round(x); y = Math.round(y); r = Math.round(r);
    for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * .6)); g.fillRect(x - dx, y + dy, dx * 2 + 1, 1); }
  }
  function drawFireball(g, pal, x, y, t, S = 1) {           // port of game.src.js drawFireball0 (dir = 1)
    const pulse = 1 + Math.sin(t * .5) * .08;
    g.save(); g.globalCompositeOperation = 'lighter';
    const grad = g.createRadialGradient(x, y, 2, x, y, 30 * S * pulse);
    grad.addColorStop(0, pal[1] + 'cc'); grad.addColorStop(.35, pal[2] + '66'); grad.addColorStop(1, pal[3] + '00');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, 30 * S * pulse, 0, Math.PI * 2); g.fill(); g.restore();
    for (let i = 5; i >= 1; i--) { const wob = Math.sin(t * .6 + i) * 2 * S; disc(g, x - i * 6 * S, y + wob, Math.max(2, (10 - i * 1.6) * S) | 0, i > 3 ? pal[3] : pal[2]); }
    disc(g, x, y, 12 * S, pal[3]); disc(g, x + S, y, 10 * S, pal[2]); disc(g, x + 2 * S, y - S, 7 * S, pal[1]); disc(g, x + 3 * S, y - 2 * S, 4 * S, pal[0]);
    px(g, x + 2 * S - S, y - 6 * S, 3 * S, 2 * S, pal[0]);
    for (let i = 0; i < 6; i++) { const a = t * .35 + i * Math.PI * 2 / 6, r = (13 + (i % 2) * 3) * S; px(g, x + Math.cos(a) * r - 1, y + Math.sin(a) * r * .8 - 1, 2 * S, 2 * S, i % 2 ? pal[0] : pal[1]); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = pal[1] + '55'; g.beginPath(); g.arc(x + 2 * S, y - S, 9 * S, 0, Math.PI * 2); g.fill(); g.restore();
  }
  function drawSpark(g, x, y, age) {                         // port of the game's hit spark
    const r = 3 + age * 2; if (age > 8 && age % 2) return;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, len = i % 2 ? r * .6 : r, c = i % 2 ? '#ffd23a' : '#ffffff';
      const ax = x + Math.cos(a) * r * .3, ay = y + Math.sin(a) * r * .3, bx = x + Math.cos(a) * len, by = y + Math.sin(a) * len;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let k = 0; k <= n; k++) px(g, Math.round(ax + (bx - ax) * k / n) - 1, Math.round(ay + (by - ay) * k / n) - 1, 2, 2, c);
    }
    if (age < 4) disc(g, x, y, 4 - age, '#ffffff');
  }

  const movePlayers = [];
  document.querySelectorAll('.fighter-slide').forEach(slide => {
    const key = (slide.querySelector('.fighter-art')?.getAttribute('src') || '').match(/sel_([a-z]+)\./)?.[1];
    const data = MOVES[key]; const versions = slide.querySelector('.fighter-versions');
    if (!data || !versions) return;
    const sheet = new Image(); sheet.src = `fighter-moves/${key}.png?v=4`;
    const pxCard = versions.querySelectorAll('.version-card')[1];
    const makeCard = (mode, label, card) => {
      // Axel's special is his FIRE LEAP (game state 'fjump'): a small hop on the spot, fist forward in flames
      const seq = mode === 'special' && data.special === 'fireleap'
        // 4th value = horizontal offset (number) or [from, to] travel: he leaps forward in flames, then walks backwards to his spot
        ? { w: 124, off: .26, steps: [['idle_0', 520, 0, 0], ['crouch', 170, 0, 0], ['fjump', 640, 0, [0, 34]], ['crouch', 170, 0, 34], ['idle_0', 380, 0, 34],
                                      ['walkback', 820, 0, [34, 0]], ['idle_0', 420, 0, 0]] }
        : mode === 'special' && data.special === 'galeblade'
        ? { w: 124, off: .3, steps: [['idle_0', 620], ['special_0', 170], ['punch_1__gust', 300], ['punch_0__gust', 280], ['idle_0', 1250]] }
        : SEQ[mode];
      card = card || document.createElement('div');
      card.className = `version-card move-card move-${mode}`; card.replaceChildren();
      const lab = document.createElement('label'); lab.textContent = label;
      const cv = document.createElement('canvas'); cv.className = 'move-canvas'; cv.width = seq.w; cv.height = VIEW_H;
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', `${key} ${label.toLowerCase()} pixel animation`);
      card.append(lab, cv);
      const steps = seq.steps.map(s => [...s]).filter(s => s[0] === 'walkback' || data.f.includes(s[0]) || (s[0] === 'idle_1' && (s[0] = 'idle_0')));
      const total = steps.reduce((a, s) => a + s[1], 0);
      const player = { mode, cv, g: cv.getContext('2d'), seq, steps, total, data, sheet, visible: false, start: performance.now() + Math.random() * 300, trail: [] };
      player.g.imageSmoothingEnabled = false;
      movePlayers.push(player); return card;
    };
    if (pxCard) makeCard('idle', 'PIXEL · IDLE', pxCard);
    versions.append(makeCard('combo', 'HIT COMBO'), makeCard('special', 'SPECIAL'));
  });

  function renderMove(p, now) {
    const { g, cv, seq, steps, total, data, sheet } = p;
    if (!sheet.complete || !sheet.naturalWidth) return;
    let t = (now - p.start) % total; if (t < 0) t += total;
    const tLoop = t; let i = 0, acc = 0;
    while (i < steps.length - 1 && t >= acc + steps[i][1]) { acc += steps[i][1]; i++; }
    let [frame, , impact] = steps[i];
    if (frame === 'walkback') frame = `walk_${7 - Math.floor((t - acc) / 95) % 8}`;   // walk cycle played backwards
    const fi = data.f.indexOf(frame);
    const ox = Math.round(cv.width * seq.off - data.cx);        // sprite x → canvas x
    g.clearRect(0, 0, cv.width, cv.height);
    // floor line + soft shadow
    px(g, 0, 76 - VIEW_TOP, cv.width, 1, '#ffffff14');
    // fire leap: small hop on the spot (sprite px)
    let jx = 0, jy = 0;
    const mv = steps[i][3];
    if (Array.isArray(mv)) {                                    // travelling leap (eased), with a hop arc
      const k = Math.min(1, (t - acc) / steps[i][1]), leap = steps[i][0] === 'fjump';
      const e = leap ? (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) : k;   // the walk back is linear, no hop
      jx = Math.round(mv[0] + (mv[1] - mv[0]) * e); jy = leap ? Math.round(Math.sin(Math.PI * k) * 14) : 0;
    } else if (typeof mv === 'number') jx = mv;
    else if (frame === 'fjump') { const k = Math.min(1, (t - acc) / steps[i][1]), h = Math.sin(Math.PI * k); jy = Math.round(h * 13); jx = Math.round(h * 4); }
    g.fillStyle = '#00000059'; g.beginPath(); g.ellipse(ox + data.cx + jx, 76 - VIEW_TOP - 1, 13 * (1 - jy / 40), 2, 0, 0, Math.PI * 2); g.fill();
    const bob = (data.f.indexOf('idle_1') < 0 && frame === 'idle_0' && Math.floor(tLoop / 420) % 2) ? 1 : 0;
    if (frame === 'fjump' && data.special === 'fireleap' && !reduce) {   // fire trail drawn BEHIND Axel: from the fist, back past his body
      const tick = now / 16.67, [fx0, fy0] = data.tips.fjump, x = ox + jx + fx0 - 3, y = fy0 - VIEW_TOP - jy;
      g.save(); g.globalCompositeOperation = 'lighter';               // additive: the trail glows like real fire
      p.trail.forEach(([tx, ty], n) => { const a = (n + 1) / p.trail.length; g.globalAlpha = a * .55; disc(g, tx - 2, ty, Math.max(1, Math.round(3 * a + 1)), data.fb[2]); });
      g.globalAlpha = 1;
      // fire trail streaming back from the fist (tapered, flickering, layered like the game's flame colours)
        for (let n = 14; n >= 1; n--) {
          const wob = Math.sin(tick * .7 + n * .9) * (1 + n * .18), lift = -n * .35;
          const tx = x - 2 - n * 3.6, ty = y + wob + lift, r = Math.max(1, Math.round(5 - n * .33));
          g.globalAlpha = Math.max(.15, 1 - n / 15);
          disc(g, tx, ty, r + 1, data.fb[3]);
          if (n < 10) disc(g, tx + 1, ty, r, data.fb[2]);
          if (n < 5) disc(g, tx + 1.5, ty - .5, Math.max(1, r - 2), data.fb[1]);
        }
        for (let n = 0; n < 4; n++) {                              // embers peeling off the trail
          const ph = (tick * .35 + n * 1.7) % 6, ex = x - 8 - ph * 7, ey = y - 2 - ph * 2.2 + Math.sin(tick + n) * 1.5;
          g.globalAlpha = Math.max(0, 1 - ph / 6); px(g, Math.round(ex), Math.round(ey), 1, 1, n % 2 ? data.fb[1] : data.fb[0]);
        }
      g.globalAlpha = 1; g.restore();
    }
    if (fi >= 0) g.drawImage(sheet, fi * 120, VIEW_TOP - bob, 120, VIEW_H, ox + jx, -jy, 120, VIEW_H);
    // hit spark on impact frames
    if (impact && data.tips[frame] && !reduce) { const [x, y] = data.tips[frame]; drawSpark(g, ox + x + 3, y - VIEW_TOP, Math.floor((t - acc) / 16)); }
    // special: charge glow, then the projectile flies across the card
    if (p.mode === 'special' && !reduce && data.special === 'galeblade') {
      const launch = steps[0][1] + steps[1][1] + 30, SPEED = .15;           // ≈ game speed (5.6 world px / frame)
      if (tLoop >= launch) {
        const k = .7, dir = 1;                                   // world → sprite scale
        const x = ox + 92 + (tLoop - launch) * SPEED, y = 44 - VIEW_TOP;
        if (x < cv.width + 40) {
          const cx = x - dir * 12 * k, R = 24 * k, a0 = -1.15, a1 = a0 + 2.3;
          g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
          const hg = g.createRadialGradient(x, y, 1, x, y, 34 * k);
          hg.addColorStop(0, 'rgba(200,245,255,.45)'); hg.addColorStop(.5, 'rgba(47,180,255,.25)'); hg.addColorStop(1, 'rgba(20,88,196,0)');
          g.fillStyle = hg; g.beginPath(); g.arc(x, y, 34 * k, 0, Math.PI * 2); g.fill();
          for (const [r2, col, lw] of [[R + 1, 'rgba(20,88,196,.8)', 8], [R, 'rgba(47,180,255,.95)', 5], [R - 1, 'rgba(168,244,255,1)', 2.5], [R - 1, '#ffffff', 1.2]]) {
            g.strokeStyle = col; g.lineWidth = lw * k; g.beginPath(); g.arc(cx, y, r2, a0, a1); g.stroke();
          }
          const zig = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach(([px2, py2], n) => { const jx = (Math.random() - .5) * 2, jy = (Math.random() - .5) * 2; n ? g.lineTo(px2 + jx, py2 + jy) : g.moveTo(px2, py2); }); g.stroke(); };
          const arcPts = []; for (let n = 0; n <= 12; n++) { const a = a0 + n / 12 * 2.3; arcPts.push([cx + Math.cos(a) * (R + 2), y + Math.sin(a) * (R + 2)]); }
          zig(arcPts, 'rgba(200,245,255,.9)', .9);               // lightning along the crescent
          for (let b = 0; b < 3; b++) { const a = a0 + Math.random() * 2.3, x0 = cx + Math.cos(a) * R, y0 = y + Math.sin(a) * R; zig([[x0, y0], [x0 - 4, y0 + (Math.random() - .5) * 6], [x0 - 9, y0 + (Math.random() - .5) * 8]], 'rgba(120,220,255,.8)', .8); }
          g.restore();
        }
      }
      if (frame === 'special_0') {                               // wind gathering on the blade before the slash
        const k2 = (t - acc) / steps[i][1], gx = ox + 70, gy = 50 - VIEW_TOP;
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(gx, gy, 0, gx, gy, 3 + k2 * 9); gr.addColorStop(0, 'rgba(200,245,255,.9)'); gr.addColorStop(1, 'rgba(47,180,255,0)');
        g.fillStyle = gr; g.fillRect(gx - 14, gy - 14, 28, 28); g.restore();
      }
    } else if (p.mode === 'special' && !reduce && data.special === 'fireleap') {
      // flaming fist (port of the game's drawFlameHand) with a short echo trail while he is in the air
      const tick = now / 16.67;
      if (frame === 'fjump') {
        const [fx0, fy0] = data.tips.fjump, x = ox + jx + fx0 - 3, y = fy0 - VIEW_TOP - jy;
        p.trail.push([x, y]); if (p.trail.length > 7) p.trail.shift();
        g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1;
        const kf = Math.max(.45, 1 - Math.abs((t - acc) / steps[i][1] - .45) * 1.2);
        const gr = g.createRadialGradient(x, y, 1, x, y, 20 * kf + 5);
        gr.addColorStop(0, data.fb[1] + 'ee'); gr.addColorStop(1, data.fb[3] + '00');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, 20 * kf + 5, 0, Math.PI * 2); g.fill();
        g.restore();
        for (let n = 0; n < 6; n++) { const a = tick * .5 + n; disc(g, x + Math.cos(a) * 5 - n * 2, y + Math.sin(a) * 4 - n * 1.5, Math.max(1, 5 - n), n < 3 ? data.fb[2] : data.fb[3]); }
        disc(g, x, y, 4, data.fb[1]); disc(g, x, y, 2, data.fb[0]);
      } else if (frame === 'crouch' && steps[i + 1] && steps[i + 1][0] === 'fjump') {   // embers gathering in the fist before each leap
        const k = (t - acc) / steps[i][1], x = ox + jx + 74, y = 62 - VIEW_TOP;
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(x, y, 0, x, y, 3 + k * 8); gr.addColorStop(0, data.fb[1] + 'dd'); gr.addColorStop(1, data.fb[3] + '00');
        g.fillStyle = gr; g.fillRect(x - 12, y - 12, 24, 24); g.restore();
        p.trail.length = 0;
      } else p.trail.length = 0;
    } else if (p.mode === 'special' && !reduce) {
      const launch = steps[0][1] + steps[1][1];
      const [hx, hy] = data.tips.special_1 || [80, 50];
      const tick = now / 16.67;
      if (frame === 'special_0') {
        const k = (t - steps[0][1]) / steps[1][1];
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(ox + hx - 6, hy - VIEW_TOP, 0, ox + hx - 6, hy - VIEW_TOP, 4 + k * 10);
        gr.addColorStop(0, data.fb[1] + 'ee'); gr.addColorStop(1, data.fb[3] + '00');
        g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); g.restore();
      }
      if (tLoop >= launch) {
        const fx = ox + hx + 6 + (tLoop - launch) * FB_SPEED;
        if (fx < cv.width + 34) drawFireball(g, data.fb, fx, hy - VIEW_TOP, tick);
      }
    }
  }
  const moveObserver = new IntersectionObserver(entries => entries.forEach(e => {
    const p = movePlayers.find(q => q.cv === e.target); if (p) p.visible = e.isIntersecting;
  }), { threshold: .1 });
  movePlayers.forEach(p => { moveObserver.observe(p.cv); p.sheet.addEventListener('load', () => renderMove(p, performance.now()), { once: true }); });
  if (reduce) movePlayers.forEach(p => { p.steps = [['idle_0', 1]]; p.total = 1; });
  else (function animateMoves(now) { for (const p of movePlayers) if (p.visible) renderMove(p, now); requestAnimationFrame(animateMoves); })(performance.now());

  /* ---------- Choose your fighter: depth parallax (scroll + mouse) and hover power-up ----------
     Layers: big slide number (far), aura (middle), HD fighter art (near, 3D tilt toward the pointer).
     Hover: art pop + glow outline, aura/ring/rising pixel sparks, and the name shakes + blinks green/purple for 1 s in the fighter's own fireball palette. */
  (() => {
    const panels = [];
    document.querySelectorAll('.fighter-slide').forEach(slide => {
      const panel = slide.querySelector('.fighter-art-panel'), art = slide.querySelector('.fighter-art');
      if (!panel || !art) return;
      const key = (art.getAttribute('src') || '').match(/sel_([a-z]+)\./)?.[1];
      const pal = (MOVES[key] && MOVES[key].fb) || ['#ffffff', '#c6ff5c', '#78ef36', '#a817ef'];
      panel.style.setProperty('--fa-c0', pal[1]); panel.style.setProperty('--fa-c1', pal[2]); panel.style.setProperty('--fa-c2', pal[3]);
      const mk = cls => { const e = document.createElement('span'); e.className = cls; e.setAttribute('aria-hidden', 'true'); return e; };
      const aura = mk('fa-aura'), ring = mk('fa-ring'), sparks = mk('fa-sparks');
      const nameEl = slide.querySelector('.fighter-copy h3');
      for (let i = 0; i < 12; i++) {
        const sp = document.createElement('i');
        sp.style.setProperty('--x', `${12 + Math.random() * 76}%`); sp.style.setProperty('--d', `${(Math.random() * 1.8).toFixed(2)}s`);
        sp.style.setProperty('--s', `${3 + Math.round(Math.random() * 4)}px`); sp.style.setProperty('--t', `${(1.3 + Math.random() * 1.1).toFixed(2)}s`);
        sparks.append(sp);
      }
      panel.prepend(aura, ring); panel.append(sparks);
      panel.addEventListener('pointerenter', () => cursorTip.set('fighter', 'CLICK ON THE FIGHTER'));
      panel.addEventListener('pointerleave', () => cursorTip.set('fighter', null));
      panel.addEventListener('pointerdown', e => cursorTip.shout(e.clientX, e.clientY));
      art.dataset.parallax = '0.05';                               // the fighter stays grounded; depth comes from the layers behind
      const p = { slide, panel, mx: 0, my: 0, tx: 0, ty: 0, hot: false, timer: 0, zap: 0 };
      panels.push(p);
      function zapName() {                                         // the fighter's name shakes and blinks green / purple for 1 s
        if (!nameEl || reduce) return;
        nameEl.classList.remove('is-zap'); void nameEl.offsetWidth; nameEl.classList.add('is-zap');
        clearTimeout(p.zap); p.zap = setTimeout(() => nameEl.classList.remove('is-zap'), 1000);
      }
      function flashArt() {                                        // white flash + pop on the HD art
        if (reduce) return;
        panel.classList.remove('fa-enter'); void panel.offsetWidth; panel.classList.add('fa-enter');
        clearTimeout(p.timer); p.timer = setTimeout(() => panel.classList.remove('fa-enter'), 900);
      }
      // click (PC) or tap (mobile) on the fighter replays the flash and the name blink; on touch the aura + pixels show for 1.6 s
      panel.addEventListener('click', () => {
        flashArt(); zapName();
        if (!finePointer && !reduce) { panel.classList.add('is-hot'); clearTimeout(p.hotT); p.hotT = setTimeout(() => panel.classList.remove('is-hot'), 1600); }
      });
      if (!finePointer || reduce) return;
      panel.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse') return;
        p.hot = true; panel.classList.add('is-hot');
        flashArt(); zapName();
      });
      panel.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = panel.getBoundingClientRect();
        p.tx = ((e.clientX - r.left) / r.width - .5) * 2; p.ty = ((e.clientY - r.top) / r.height - .5) * 2;
      });
      panel.addEventListener('pointerleave', () => { p.hot = false; p.tx = 0; p.ty = 0; panel.classList.remove('is-hot'); });
    });
    if (!panels.length || reduce) return;
    const section = document.getElementById('fighters'); let on = false;
    new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(section);
    (function depth() {
      if (on) {
        const vh = innerHeight;
        for (const p of panels) {
          const r = p.panel.getBoundingClientRect();
          if (r.right < 0 || r.left > innerWidth) continue;          // only the slide on screen
          p.mx += (p.tx - p.mx) * .12; p.my += (p.ty - p.my) * .12;
          const sp = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
          p.slide.style.setProperty('--mx', p.mx.toFixed(3)); p.slide.style.setProperty('--my', p.my.toFixed(3));
          p.slide.style.setProperty('--sp', sp.toFixed(3));
        }
      }
      requestAnimationFrame(depth);
    })();
  })();

  /* ---------- Cyber Cab: physics-driven hover flight ----------
     Spring follow with inertia, banking from velocity, turns around to face its direction of travel,
     idle hover bob, thruster glow and ground shadow that track speed/height, click = turbo dash. */
  document.querySelectorAll('.special-shot-main .cyber-cab-flyover').forEach(car => {
    if (reduce) return;
    const scene = car.parentElement;
    scene.classList.add('cab-scene');
    const glow = document.createElement('span'); glow.className = 'cab-thrusters'; glow.setAttribute('aria-hidden', 'true');
    const shadow = document.createElement('span'); shadow.className = 'cab-ground-shadow'; shadow.setAttribute('aria-hidden', 'true');
    scene.insertBefore(shadow, car); scene.insertBefore(glow, car);
    car.classList.add('cab-physics');
    const st = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, face: 1, faceS: 1, rot: 0, hover: false, turbo: 0, visible: false, wander: Math.random() * 10 };
    new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; }).observe(scene);
    scene.addEventListener('pointermove', e => {
      const r = scene.getBoundingClientRect();
      st.tx = ((e.clientX - r.left) / r.width - .5) * r.width * .46;
      st.ty = ((e.clientY - r.top) / r.height - .5) * r.height * .42;
      st.hover = true;
    });
    scene.addEventListener('pointerleave', () => { st.hover = false; });
    /* ---- TAP TO DESTROY: knock the cab down, then smash it with the game's damage art (cab_L1→L3 front, cab_R1→R2 rear,
       cab_fin, cab_open + cab_door flying off) until it is completely destroyed; then a new cab flies back in. */
    const IMG = {}; ['off', 'L1', 'L2', 'L3', 'R1', 'R2', 'fin', 'open', 'door'].forEach(k => { const im = new Image(); im.src = `cab_${k}.png?v=1`; IMG[k] = im; });
    const BB = { off: [0, 0], L1: [2, 2], L2: [2, 3], L3: [2, 3], R1: [2, 1], R2: [2, 0], fin: [0, 0], open: [0, 0] };   // bbox left/top of each sprite, used to align them
    const SPLIT = 230;                                         // source x where the front (L) art meets the rear (R) art
    const wcv = document.createElement('canvas'); wcv.className = 'cab-wreck'; wcv.setAttribute('aria-hidden', 'true');
    car.after(wcv);
    const wg = wcv.getContext('2d');
    const label = document.createElement('span'); label.className = 'punch-label cab-label'; label.textContent = 'TAP TO DESTROY !'; label.setAttribute('aria-hidden', 'true');
    const banner = document.createElement('div'); banner.className = 'bta-banner'; banner.setAttribute('aria-hidden', 'true');
    scene.append(label, banner);
    const w = { x: 0, y: 0, vy: 0, rot: 0, L: 0, R: 0, shake: 0, flash: 0, alpha: 1, blink: false, door: null };
    let mode = 'fly', parts = [], SW = 0, SH = 0, dpr = 1, emitT = 0;
    st.mode = 'fly';
    function sizeW() { const r = scene.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); SW = r.width; SH = r.height; wcv.width = Math.round(SW * dpr); wcv.height = Math.round(SH * dpr); }
    sizeW(); addEventListener('resize', sizeW);
    const bodyW = () => SW * .82 * 406 / 428;                 // the damaged sprites are 400 px wide, the flying one 428 (with thrusters)
    const kpx = () => bodyW() / 400;
    const bodyH = () => 164 * kpx();
    const groundY = () => SH * .88 - bodyH() / 2;
    function inBody(px, py) { const bw = bodyW(), bh = bodyH(); return Math.abs(px - w.x) < bw / 2 && Math.abs(py - w.y) < bh / 2; }
    function setBanner(text) { banner.textContent = text; banner.className = 'bta-banner is-destroyed'; void banner.offsetWidth; banner.classList.add('is-on'); }
    function burst(x, y, big) {
      const n = big ? 46 : 18;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - .5) * (big ? 6.2 : 2.6), sp = (big ? 1.2 : .7) + Math.random() * (big ? 3.2 : 2);
        parts.push({ kind: 'smoke', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4 + Math.random() * (big ? 12 : 7), grow: .1 + Math.random() * .22, life: 0, max: 40 + Math.random() * (big ? 60 : 36),
          c: ['#e6dccb', '#cfc4b2', '#b3a996', '#8f877b', '#efe7d8'][i % 5] });
      }
      for (let i = 0; i < (big ? 26 : 12); i++) {
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * (big ? 6 : 4.5);
        parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 0, max: 18 + Math.random() * 20, c: ['#fff6c8', '#ffd23a', '#ff9c2c'][i % 3] });
      }
      parts.push({ kind: 'flash', x, y, life: 0, max: 8 });
    }
    function knockDown(px, py) {
      const r = car.getBoundingClientRect(), sr = scene.getBoundingClientRect();
      w.x = r.left - sr.left + r.width / 2; w.y = r.top - sr.top + r.height / 2 - 17.5 * (r.width / 428);
      w.vy = SH * .004; w.rot = st.rot; w.L = 0; w.R = 0; w.alpha = 1; w.blink = false; w.door = null; w.shake = 1; w.flash = 1;
      mode = 'fall'; st.mode = 'down'; car.style.opacity = '0'; glow.style.opacity = '0';
      burst(inBody(px, py) ? px : w.x, inBody(px, py) ? py : w.y, false);
    }
    function smash(px, py) {
      const splitX = w.x - bodyW() / 2 + SPLIT * kpx();
      let side = px < splitX ? 'L' : 'R';
      if (side === 'L' && w.L >= 3) side = 'R'; if (side === 'R' && w.R >= 2) side = w.L < 3 ? 'L' : 'R';
      if (side === 'L') w.L = Math.min(3, w.L + 1); else w.R = Math.min(2, w.R + 1);
      w.shake = 1; w.flash = 1; w.vy = -SH * .011; burst(px, py, false);
      if (w.L >= 3 && w.R >= 2) {
        mode = 'final';
        setTimeout(() => {                                      // the door is ripped off
          const k = kpx();
          w.door = { x: w.x - bodyW() / 2 + (214.6 + 46.5) * k, y: w.y - bodyH() / 2 + (34.5 + 47.5) * k, vx: SW * .012, vy: -SH * .028, rot: 0, vr: .22 };
          w.shake = 1.6; w.flash = 1; burst(w.door.x, w.door.y, true); setBanner('DESTROYED!');
        }, 420);
        setTimeout(() => { w.blink = true; }, 2900);
        setTimeout(() => { banner.classList.remove('is-on'); respawn(); }, 3800);
      }
    }
    function respawn() {
      mode = 'fly'; st.mode = 'fly'; w.blink = false; w.door = null;
      st.x = SW * .75; st.y = -SH * .55; st.vx = -12; st.vy = 6;   // the new cab flies in nose first from the top right
      car.style.opacity = ''; glow.style.opacity = '';
    }
    let lastPtr = null;
    function updateHover() {
      if (!lastPtr) { scene.classList.remove('is-hover'); return; }
      const sr = scene.getBoundingClientRect(), px = lastPtr[0] - sr.left, py = lastPtr[1] - sr.top;
      const on = mode === 'fly' || (mode === 'ground' && inBody(px, py));
      scene.classList.toggle('is-hover', on);
      label.style.left = `${px}px`; label.style.top = `${py}px`;
    }
    scene.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { lastPtr = [e.clientX, e.clientY]; updateHover(); } });
    scene.addEventListener('pointerleave', () => { lastPtr = null; updateHover(); });
    scene.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const sr = scene.getBoundingClientRect(), px = e.clientX - sr.left, py = e.clientY - sr.top;
      label.style.left = `${px}px`; label.style.top = `${py}px`;
      label.classList.remove('is-pop'); void label.offsetWidth; label.classList.add('is-pop');
      if (mode === 'fly') { e.preventDefault(); knockDown(px, py); }
      else if (mode === 'ground' && inBody(px, py)) { e.preventDefault(); smash(px, py); }
      updateHover();
    });
    function pixelDisc(g, x, y, r, P) {                        // chunky pixel-art disc (P = pixel size)
      const cx = Math.round(x / P), cy = Math.round(y / P), rr = Math.max(1, Math.round(r / P));
      for (let dy = -rr; dy <= rr; dy++) { const dx = Math.floor(Math.sqrt(rr * rr - dy * dy + rr * .6)); g.fillRect((cx - dx) * P, (cy + dy) * P, (dx * 2 + 1) * P, P); }
    }
    function drawBody() {
      const k = kpx(), bw = bodyW(), bh = bodyH();
      wg.save();
      wg.translate(w.x + (w.shake ? (Math.random() - .5) * 8 * w.shake : 0), w.y + (w.shake ? (Math.random() - .5) * 4 * w.shake : 0));
      wg.rotate(w.rot * Math.PI / 180);
      const parts2 = [];
      if (mode === 'final') parts2.push([w.door ? 'open' : 'fin', 0, null]);
      else { parts2.push([w.L ? `L${w.L}` : 'off', 0, SPLIT]); parts2.push([w.R ? `R${w.R}` : 'off', SPLIT, null]); }
      const paint = () => {
        for (const [key, sx0, sx1] of parts2) {
          const im = IMG[key]; if (!im.complete || !im.naturalWidth) continue;
          const [bx, by] = BB[key], end = sx1 == null ? im.naturalWidth : sx1 + bx;
          const srcX = sx0 + (sx0 ? bx : 0);
          wg.drawImage(im, srcX, 0, end - srcX, im.naturalHeight, -bw / 2 + (srcX - bx) * k, -bh / 2 - by * k, (end - srcX) * k, im.naturalHeight * k);
        }
      };
      paint();
      if (w.flash > 0) { wg.globalCompositeOperation = 'lighter'; wg.globalAlpha = w.flash * .55; paint(); wg.globalCompositeOperation = 'source-over'; wg.globalAlpha = 1; }
      wg.restore();
    }
    function stepWreck(dt, now) {
      wg.setTransform(dpr, 0, 0, dpr, 0, 0); wg.clearRect(0, 0, SW, SH);
      if (mode !== 'fly') {
        if (mode === 'fall' || w.vy !== 0 || w.y < groundY() - .5) {
          w.vy += SH * .0016 * dt; w.y += w.vy * dt;
          if (w.y >= groundY()) {
            w.y = groundY();
            if (Math.abs(w.vy) > SH * .006) { w.vy = -w.vy * .3; w.shake = Math.max(w.shake, mode === 'fall' ? 1 : .5); if (mode === 'fall') burst(w.x, w.y + bodyH() * .4, false); }
            else { w.vy = 0; if (mode === 'fall') { mode = 'ground'; updateHover(); } }
          }
        }
        w.x += (SW / 2 - w.x) * .06 * dt; w.rot += (0 - w.rot) * .12 * dt;
        w.shake = Math.max(0, w.shake - .06 * dt); w.flash = Math.max(0, w.flash - .09 * dt);
        if (!(w.blink && Math.floor(now / 85) % 2)) drawBody();
        // damaged sides keep smoking
        emitT -= dt;
        if (emitT <= 0 && (w.L >= 2 || w.R >= 1 || mode === 'final')) {
          emitT = mode === 'final' ? 4 : 10;
          const fromL = w.L >= 2 && (Math.random() < .5 || w.R < 1);
          const sx = w.x - bodyW() / 2 + (fromL ? 70 + Math.random() * 90 : 280 + Math.random() * 90) * kpx();
          parts.push({ kind: 'smoke', x: sx, y: w.y - bodyH() * .2, vx: (Math.random() - .5) * .4, vy: -.6 - Math.random() * .6, r: 3 + Math.random() * 4, grow: .14, life: 0, max: 60 + Math.random() * 40, c: ['#6f6a64', '#59554f', '#87817a'][Math.floor(Math.random() * 3)], soft: true });
        }
        // shadow under the wreck
        shadow.style.setProperty('--cab-x', `${(w.x - SW / 2).toFixed(1)}px`);
        shadow.style.setProperty('--shadow-s', '1.2'); shadow.style.setProperty('--shadow-o', w.blink ? '.3' : '.85');
      }
      // flying door
      if (w.door) {
        const d = w.door; d.vy += SH * .0016 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
        const im = IMG.door, k = kpx();
        if (im.complete && im.naturalWidth) { wg.save(); wg.translate(d.x, d.y); wg.rotate(d.rot); wg.drawImage(im, -46.5 * k, -47.5 * k, 93 * k, 95 * k); wg.restore(); }
        if (d.y > SH + 100) w.door = { ...d, x: -9999, vy: 0, vx: 0, vr: 0 };
      }
      // particles (pixel smoke, sparks, impact flash)
      const P = Math.max(2, Math.round(SH / 170));
      parts = parts.filter(p => (p.life += dt) < p.max);
      for (const p of parts) {
        const t = p.life / p.max;
        if (p.kind === 'flash') { const s = (1 - t) * 26; wg.fillStyle = '#ffffff'; wg.fillRect(p.x - s, p.y - P / 2, s * 2, P); wg.fillRect(p.x - P / 2, p.y - s, P, s * 2); wg.fillStyle = '#fff2c4'; wg.fillRect(p.x - P * 2, p.y - P * 2, P * 4, P * 4); continue; }
        if (p.kind === 'spark') { p.vy += .25 * dt; p.x += p.vx * dt; p.y += p.vy * dt; wg.globalAlpha = 1 - t; wg.fillStyle = p.c; wg.fillRect(Math.round(p.x / P) * P, Math.round(p.y / P) * P, P, P); continue; }
        p.vx *= Math.pow(.95, dt); p.vy = p.vy * Math.pow(.95, dt) - .02 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.grow * dt;
        wg.globalAlpha = (p.soft ? .55 : .9) * Math.min(1, (1 - t) * 1.6); wg.fillStyle = p.c; pixelDisc(wg, p.x, p.y, p.r, P);
      }
      wg.globalAlpha = 1;
    }
    let last = performance.now();
    (function fly(now) {
      const dt = Math.min(2.2, (now - last) / 16.67); last = now;
      if (st.visible) stepWreck(dt, now);
      if (st.visible && st.mode === 'fly') {
        const r = scene.getBoundingClientRect();
        if (!st.hover) {                                       // gentle autonomous drift when idle
          st.wander += .006 * dt;
          st.tx = Math.sin(st.wander * 1.3) * r.width * .12;
          st.ty = Math.sin(st.wander * 2.1) * r.height * .05;
        }
        // critically-damped-ish spring with a little overshoot
        const k = st.hover ? .055 : .03, damp = .84;
        st.vx = (st.vx + (st.tx - st.x) * k * dt) * Math.pow(damp, dt);
        st.vy = (st.vy + (st.ty - st.y) * k * dt) * Math.pow(damp, dt);
        st.x += st.vx * dt; st.y += st.vy * dt;
        // face the direction of travel (hysteresis so it doesn't flicker)
        // the cab always keeps its original heading (nose to the left): no turn-around
        st.faceS = 1;
        // banking: nose dips when accelerating forward, lifts when climbing
        const forward = -st.vx * st.face;                      // >0 when moving the way the nose points
        const targetRot = Math.max(-12, Math.min(12, -forward * .55 + st.vy * .35 * st.face));
        st.rot += (targetRot - st.rot) * .18 * dt;
        st.turbo = Math.max(0, st.turbo - .03 * dt);
        const speed = Math.min(1, Math.hypot(st.vx, st.vy) / 18);
        const bob = Math.sin(now / 420) * 5 + Math.sin(now / 173) * 1.2;
        const squash = 1 + Math.min(.06, Math.abs(st.vy) * .004);
        const flipX = Math.abs(st.faceS) < .08 ? .08 * Math.sign(st.faceS || 1) : st.faceS;  // squeeze through the turn
        car.style.setProperty('--cab-x', `${st.x.toFixed(1)}px`);
        car.style.setProperty('--cab-y', `${(st.y + bob).toFixed(1)}px`);
        car.style.setProperty('--cab-rot', `${(st.rot * Math.sign(flipX)).toFixed(2)}deg`);
        car.style.setProperty('--cab-sx', (flipX * (1 + st.turbo * .06) / squash).toFixed(3));
        car.style.setProperty('--cab-sy', (squash * (1 - st.turbo * .03)).toFixed(3));
        const height = Math.max(0, Math.min(1, .5 - (st.y + bob) / r.height));  // 0 = low, 1 = high
        glow.style.setProperty('--parallax-y', car.style.getPropertyValue('--parallax-y') || '0px');
        glow.style.setProperty('--cab-x', `${st.x.toFixed(1)}px`);
        glow.style.setProperty('--cab-y', `${(st.y + bob).toFixed(1)}px`);
        glow.style.setProperty('--glow', (.45 + speed * .45 + st.turbo * .6 + Math.sin(now / 60) * .05).toFixed(3));
        shadow.style.setProperty('--cab-x', `${st.x.toFixed(1)}px`);
        shadow.style.setProperty('--shadow-s', (1.15 - height * .55).toFixed(3));
        shadow.style.setProperty('--shadow-o', (.75 - height * .45).toFixed(3));
      }
      requestAnimationFrame(fly);
    })(last);
  });

  /* ---------- Punching Ball: chain, TAP TO PUNCH!, swing physics + beige impact smoke ---------- */
  document.querySelectorAll('.special-punch-shot').forEach(shot => {
    const bag = shot.querySelector('.punching-ball-art'); if (!bag) return;
    // bag bounding box inside punching-ball-01.png (1407x768): x 654→757, y 271→611, ring centre ≈ y 278
    const IMG_W = 1407, IMG_H = 768, BX0 = 654, BX1 = 757, BY0 = 286, BY1 = 611, RING_Y = 278;
    const rig = document.createElement('div'); rig.className = 'punch-rig';
    const mount = document.createElement('span'); mount.className = 'punch-mount'; mount.setAttribute('aria-hidden', 'true');
    const chain = document.createElement('span'); chain.className = 'punch-chain'; chain.setAttribute('aria-hidden', 'true');
    bag.before(rig); rig.append(chain, bag); shot.append(mount);
    const label = document.createElement('span'); label.className = 'punch-label'; label.textContent = 'TAP TO PUNCH !'; label.setAttribute('aria-hidden', 'true');
    const fx = document.createElement('canvas'); fx.className = 'punch-fx'; fx.setAttribute('aria-hidden', 'true');
    shot.append(fx, label);
    const bagShadow = document.createElement('span'); bagShadow.className = 'punch-shadow'; bagShadow.setAttribute('aria-hidden', 'true');
    rig.before(bagShadow);
    const phud = document.createElement('div'); phud.className = 'punch-hud'; phud.setAttribute('aria-hidden', 'true');
    phud.innerHTML = '<div class="punch-hud-bars"><div class="hud-life is-p1"><span class="punch-hp" style="width:100%"></span></div></div>' +
      '<div class="punch-hud-name">PUNCHING BALL</div>';
    const pbanner = document.createElement('div'); pbanner.className = 'bta-banner'; pbanner.setAttribute('aria-hidden', 'true');
    shot.append(phud, pbanner);
    const hpEl = phud.querySelector('.punch-hp');
    const g = fx.getContext('2d'); const PX = 3;                 // smoke drawn at 1/3 resolution → pixel-art puffs
    let parts = [], theta = 0, omega = 0, shake = 0, visible = false, running = false;
    // after BREAK_HITS punches the chain snaps: the bag spins down, lands lying on the floor, kicks up floor dust, then a new bag is lowered
    const BREAK_HITS = 8; let hits = 0, state = 'hang';            // hang | fall | down | respawn
    const F = { x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, landed: 0 };
    const floorY = () => shot.getBoundingClientRect().height * .9;    // floor line where the bag's shadow sits
    function setEnergy() {
      hpEl.style.width = `${Math.max(0, 1 - hits / BREAK_HITS) * 100}%`;
      hpEl.classList.toggle('is-critical', hits >= BREAK_HITS - 2 && hits < BREAK_HITS);
    }
    function placeShadow() {                                      // soft ellipse on the floor under the bag (hanging, falling or lying)
      if (!rest) return;
      const W = shot.getBoundingClientRect().width, Lb = rest.y1 - rest.y0, wb = rest.x1 - rest.x0, fy = floorY();
      let x, w, o;
      if (state === 'fall' || state === 'down') {
        const rr = F.r * Math.PI / 180, half = Math.abs(Math.cos(rr)) * Lb / 2 + Math.abs(Math.sin(rr)) * wb / 2;
        const bottom = (rest.y0 + rest.y1) / 2 + F.y + half, gap = Math.max(0, fy - bottom);
        x = F.x; w = (Math.abs(Math.cos(rr)) * wb + Math.abs(Math.sin(rr)) * Lb) * 1.08; o = Math.max(.25, .85 - gap / (fy * .6));
      } else {
        const a = theta * Math.PI / 180; x = -rest.y1 * Math.sin(a); w = wb * 1.5; o = .55;
      }
      bagShadow.style.left = `${W / 2 + x}px`; bagShadow.style.top = `${fy}px`; bagShadow.style.width = `${w}px`; bagShadow.style.opacity = String(o);
    }
    function setBagTransform() { bag.style.setProperty('transform', `translate(-50%,-57%) translate(${F.x.toFixed(1)}px,${F.y.toFixed(1)}px) rotate(${F.r.toFixed(2)}deg)`, 'important'); }
    function dust(x, y, dir, n) {                                 // floor dust: low, wide puffs pushed sideways
      for (let i = 0; i < n; i++) {
        const sp = .6 + Math.random() * 2.4, d = dir || (Math.random() < .5 ? -1 : 1);
        parts.push({ x: x / PX + (Math.random() - .5) * 6, y: y / PX - Math.random() * 2, vx: d * sp, vy: -Math.random() * .5, r: 1.6 + Math.random() * 3, grow: .06 + Math.random() * .1,
          life: 0, max: 40 + Math.random() * 40, c: ['#e9dcc0', '#d6c4a0', '#c4ae86', '#b09a74', '#f2e8d4'][i % 5], floor: true });
      }
    }
    function breakBag(side) {
      if (!rest) measure();
      state = 'fall'; shot.classList.remove('is-over-bag');
      // pull the bag out of the rig, keeping where the swing had put it
      const a = theta * Math.PI / 180, cy = (rest.y0 + rest.y1) / 2, L = cy;   // pivot is the top centre of the shot
      F.x = -L * Math.sin(a); F.y = L * (Math.cos(a) - 1); F.r = theta;
      F.vx = (side < 0 ? 1 : -1) * (1.5 + Math.random()) - omega * .6; F.vy = -2.5; F.vr = (side < 0 ? 1 : -1) * (7 + Math.random() * 4); F.landed = 0;
      // spin around the bag's own centre (not the PNG's centre) so it lands exactly on its shadow
      bag.style.transformOrigin = `${((BX0 + BX1) / 2 / IMG_W * 100).toFixed(2)}% ${((BY0 + BY1) / 2 / IMG_H * 100).toFixed(2)}%`;
      bag.style.transition = 'none'; shot.insertBefore(bag, fx); setBagTransform();
      omega += (side < 0 ? -1 : 1) * 4;                           // the broken chain whips around
      chain.classList.add('is-broken');
      pbanner.textContent = 'K.O.'; pbanner.className = 'bta-banner is-ko'; void pbanner.offsetWidth; pbanner.classList.add('is-on');
    }
    function respawn() {
      state = 'respawn';
      bag.style.removeProperty('transform'); bag.style.transformOrigin = ''; bag.style.transition = ''; bag.style.opacity = '';
      rig.append(bag); chain.classList.remove('is-broken');
      theta = 0; omega = 0; hits = 0; setEnergy(); pbanner.classList.remove('is-on');
      rig.classList.remove('is-respawn'); void rig.offsetWidth; rig.classList.add('is-respawn');
      setTimeout(() => { rig.classList.remove('is-respawn'); state = 'hang'; measure(); }, 900);
    }

    let rest = null;                                              // bag geometry at rest, relative to the shot
    function measure() {
      if (state !== 'hang' && state !== 'respawn' && rest) return;
      const keep = rig.style.transform; rig.style.transform = 'none';
      const sr = shot.getBoundingClientRect(), b = bag.getBoundingClientRect(); rig.style.transform = keep;
      if (!b.height) return;
      const k = b.height / IMG_H;
      rest = { x0: b.left - sr.left + BX0 * k, x1: b.left - sr.left + BX1 * k, y0: b.top - sr.top + BY0 * k, y1: b.top - sr.top + BY1 * k, ringY: b.top - sr.top + RING_Y * k };
      chain.style.height = `${Math.max(10, rest.ringY + 1)}px`;
      placeShadow();
    }
    function geom() {
      if (!rest) measure();
      const s = shot.getBoundingClientRect(), R0 = rest || { x0: 0, x1: 0, y0: 0, y1: 0 };
      return { s, pivotX: s.left + s.width / 2, pivotY: s.top, x0: s.left + R0.x0, x1: s.left + R0.x1, y0: s.top + R0.y0, y1: s.top + R0.y1 };
    }
    const layoutChain = measure;
    function hitTest(cx, cy) {                                   // rotate the pointer back into the bag's rest frame
      const G = geom(), a = -theta * Math.PI / 180;
      const dx = cx - G.pivotX, dy = cy - G.pivotY;
      const lx = G.pivotX + dx * Math.cos(a) - dy * Math.sin(a), ly = G.pivotY + dx * Math.sin(a) + dy * Math.cos(a);
      const pad = (G.x1 - G.x0) * .12;
      return { inside: lx > G.x0 - pad && lx < G.x1 + pad && ly > G.y0 && ly < G.y1, side: lx < (G.x0 + G.x1) / 2 ? -1 : 1, G };
    }
    function sizeFx() { const r = shot.getBoundingClientRect(); fx.width = Math.ceil(r.width / PX); fx.height = Math.ceil(r.height / PX); }
    sizeFx(); addEventListener('resize', () => { sizeFx(); layoutChain(); });
    if (bag.complete) layoutChain(); else bag.addEventListener('load', layoutChain, { once: true });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { layoutChain(); start(); } }).observe(shot);

    let lastPtr = null;
    function updateHover() {
      if (!lastPtr || state !== 'hang') { if (state !== 'hang') shot.classList.remove('is-over-bag'); return; } const h = hitTest(lastPtr[0], lastPtr[1]);
      shot.classList.toggle('is-over-bag', h.inside);
      if (h.inside) { const r = shot.getBoundingClientRect(); label.style.left = `${lastPtr[0] - r.left}px`; label.style.top = `${lastPtr[1] - r.top}px`; }
    }
    shot.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') lastPtr = [e.clientX, e.clientY];
      if (state !== 'hang') return;
      const h = hitTest(e.clientX, e.clientY);
      shot.classList.toggle('is-over-bag', h.inside);
      if (h.inside) { const r = shot.getBoundingClientRect(); label.style.left = `${e.clientX - r.left}px`; label.style.top = `${e.clientY - r.top}px`; }
    });
    shot.addEventListener('pointerleave', () => { lastPtr = null; shot.classList.remove('is-over-bag'); });
    shot.addEventListener('pointerdown', e => {
      if (state !== 'hang') return;
      const h = hitTest(e.clientX, e.clientY); if (!h.inside) return;
      e.preventDefault();
      // hit on the left side pushes the bag to the right (counter-clockwise around the chain), and vice-versa
      omega += (h.side < 0 ? -1 : 1) * (reduce ? 0 : 2.3 + Math.random() * .6);
      shake = 1;
      rig.classList.remove('is-hit'); void rig.offsetWidth; rig.classList.add('is-hit');
      label.classList.remove('is-pop'); void label.offsetWidth; label.classList.add('is-pop');
      const r = shot.getBoundingClientRect(), x = (e.clientX - r.left) / PX, y = (e.clientY - r.top) / PX;
      const away = -h.side;                                       // smoke bursts out of the struck side, back toward the puncher
      const n = reduce ? 6 : 26;
      for (let i = 0; i < n; i++) {
        const a = (away > 0 ? 0 : Math.PI) + (Math.random() - .5) * 2.1;
        const sp = .35 + Math.random() * 1.5;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - .25, r: 1.5 + Math.random() * 2.8, grow: .05 + Math.random() * .09,
          life: 0, max: 34 + Math.random() * 34, c: ['#efe2c6', '#e2d0aa', '#d2bb8f', '#c4aa7c', '#f6eedc'][i % 5] });
      }
      for (let i = 0; i < 10; i++) {                              // small dust specks
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.2;
        parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: .6, grow: 0, life: 0, max: 18 + Math.random() * 14, c: '#fff6e2', speck: true });
      }
      parts.push({ x, y, flash: true, life: 0, max: 7 });
      if (++hits >= BREAK_HITS) breakBag(h.side);
      setEnergy();
      start();
    });

    function start() { if (!running) { running = true; requestAnimationFrame(step); } }
    let last = performance.now();
    function step(now) {
      const dt = Math.min(2.2, (now - last) / 16.67); last = now;
      // pendulum: restoring force + damping (degrees per frame)
      omega += (-.016 * theta - .045 * omega) * dt;
      theta = Math.max(-34, Math.min(34, theta + omega * dt));
      shake = Math.max(0, shake - .08 * dt);
      const jx = shake ? (Math.random() - .5) * 4 * shake : 0;
      rig.style.transform = `translateX(${jx.toFixed(1)}px) rotate(${theta.toFixed(2)}deg)`;
      updateHover();
      placeShadow();
      if (state === 'fall' || state === 'down') {
        const Lb = rest.y1 - rest.y0, wb = rest.x1 - rest.x0, restCy = (rest.y0 + rest.y1) / 2, fy = floorY();
        if (state === 'fall') {
          F.vy += .55 * dt; F.x += F.vx * dt; F.y += F.vy * dt; F.r += F.vr * dt;
          const rr = F.r * Math.PI / 180, half = Math.abs(Math.cos(rr)) * Lb / 2 + Math.abs(Math.sin(rr)) * wb / 2;
          if (restCy + F.y + half >= fy) {
            F.y = fy - half - restCy;
            const impact = Math.abs(F.vy);
            const cx = shot.getBoundingClientRect().width / 2 + F.x;
            if (impact > 3) { dust(cx - half * .6, fy, -1, F.landed ? 10 : 22); dust(cx + half * .6, fy, 1, F.landed ? 10 : 22); shake = Math.min(1.4, impact / 8); }
            F.landed++;
            F.vy = impact > 3 ? -impact * .32 : 0; F.vx *= .55; F.vr *= .45;
            if (impact <= 3 || F.landed > 3) {                      // settle lying on its side
              state = 'down'; F.vy = 0;
              F.target = Math.round(F.r / 90) * 90; if (Math.abs(F.target % 180) === 0) F.target += F.r > F.target ? 90 : -90;
              setTimeout(() => { bag.style.transition = 'opacity .5s steps(4)'; bag.style.opacity = '0'; }, 2600);
              setTimeout(respawn, 3200);
            }
          }
        } else {
          F.r += (F.target - F.r) * .2 * dt; F.x += F.vx * dt; F.vx *= Math.pow(.86, dt);
          const rr = F.r * Math.PI / 180, half = Math.abs(Math.cos(rr)) * Lb / 2 + Math.abs(Math.sin(rr)) * wb / 2;
          F.y = fy - half - restCy;
        }
        const lim = shot.getBoundingClientRect().width / 2 - Lb * .62 - 14;   // keep the lying bag (straps included) inside the picture
        if (F.x < -lim) { F.x = -lim; F.vx = Math.abs(F.vx) * .4; } else if (F.x > lim) { F.x = lim; F.vx = -Math.abs(F.vx) * .4; }
        setBagTransform();
      }
      // smoke
      g.clearRect(0, 0, fx.width, fx.height);
      parts = parts.filter(p => (p.life += dt) < p.max);
      for (const p of parts) {
        const t = p.life / p.max;
        if (p.flash) {                                            // white impact star
          const s = (1 - t) * 9;
          g.fillStyle = '#ffffff'; g.fillRect(Math.round(p.x - s), Math.round(p.y) , Math.round(s * 2), 1); g.fillRect(Math.round(p.x), Math.round(p.y - s), 1, Math.round(s * 2));
          g.fillStyle = '#fff2c4'; g.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 4, 4);
          continue;
        }
        p.vx *= Math.pow(p.floor ? .95 : .93, dt); p.vy = p.vy * Math.pow(.93, dt) - (p.floor ? .006 : .012) * dt;   // slow down, smoke rises a little (floor dust stays low)
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.grow * dt;
        g.globalAlpha = (p.speck ? 1 - t : Math.min(1, (1 - t) * 1.6)) * .9;
        g.fillStyle = p.c;
        const r = Math.max(1, Math.round(p.r)), cx = Math.round(p.x), cy = Math.round(p.y);
        for (let dy = -r; dy <= r; dy++) { const dx = Math.floor(Math.sqrt(r * r - dy * dy + r * .6)); g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1); }
      }
      g.globalAlpha = 1;
      const settled = state === 'hang' && Math.abs(theta) < .02 && Math.abs(omega) < .02 && !parts.length && !shake;
      if (settled) { theta = 0; omega = 0; rig.style.transform = ''; placeShadow(); running = false; return; }
      requestAnimationFrame(step);
    }
  });

  /* ---------- Beat Them All: pixel fight in the main image (auto demo + click to play) ----------
     Hiro (vue_droite) vs Axel (3 hits) → Zephyr (4 hits) → Vesper (6 hits), then loop.
     Auto demo: Hiro attacks, opponents punch/kick and Hiro blocks.
     Click: Hiro throws the next hit (punch → kick → strong punch); two quick clicks = fireball.
     While the player is in control, opponents swing in the air near Hiro.
     KO: fall, lie down, arcade blink, vanish, next fighter walks in. Sheets: fighter-moves/bta-<key>.png. */
  (() => {
    const bgImg = document.querySelector('.special-shot-main img[src*="stage_city"]');
    if (!bgImg || reduce) return;
    const shot = bgImg.closest('.special-shot');
    shot.classList.add('bta-scene');
    const ROSTER = {
      hiro:   { f: ['idle_0','idle_1','punch_0','punch_1','kick_0','kick_1','fpunch_0','fpunch_1','special_0','special_1','block','win','walk_0','walk_1','walk_2','walk_3','hit'], cx: 59.5 },
      axel:   { name: 'AXEL',   hits: 3, cx: 58.5 },
      zephyr: { name: 'ZEPHYR', hits: 4, cx: 58 },
      vesper: { name: 'VESPER', hits: 6, cx: 60.5 }
    };
    const OPP_F = ['idle_0','idle_1','walk_0','walk_1','walk_2','walk_3','walk_4','walk_5','walk_6','walk_7','punch_0','punch_1','kick_0','kick_1','hit','fall','down','block'];
    ['axel','zephyr','vesper'].forEach(k => ROSTER[k].f = OPP_F);
    Object.keys(ROSTER).forEach(k => { const im = new Image(); im.src = `fighter-moves/bta-${k}.png?v=2`; ROSTER[k].sheet = im; });
    const HIRO_FB = ['#ffffff', '#a8f4ff', '#2fb4ff', '#1458c4'];
    const ORDER = ['axel', 'zephyr', 'vesper'];
    const ROTATION = ['punch', 'kick', 'fpunch'];

    // ---- DOM layers
    const cv = document.createElement('canvas'); cv.className = 'bta-fx'; cv.setAttribute('aria-hidden', 'true');
    const hud = document.createElement('div'); hud.className = 'bta-hud'; hud.setAttribute('aria-hidden', 'true');
    hud.innerHTML =
      '<img class="hud-face is-p1" src="face_hiro.jpg" alt="">' +
      '<div class="hud-center">' +
        '<div class="hud-bars">' +
          '<div class="hud-life is-p1"><span class="bta-hiro-hp" style="width:100%"></span></div>' +
          '<div class="hud-ko">KO</div>' +
          '<div class="hud-life is-cpu"><span class="bta-opp-hp" style="width:100%"></span></div>' +
        '</div>' +
        '<div class="hud-meters"><div class="hud-meter is-p1"><span class="bta-hiro-meter"></span></div><div class="hud-meter is-cpu"><span class="bta-opp-meter"></span></div></div>' +
        '<div class="hud-timer">99</div>' +
      '</div>' +
      '<img class="hud-face is-cpu bta-opp-face" src="face_axel.jpg" alt="">' +
      '<div class="hud-name is-p1"><em>1P</em> HIRO</div>' +
      '<div class="hud-name is-cpu"><b class="bta-opp-name">AXEL</b> <em>CPU</em></div>';
    const banner = document.createElement('div'); banner.className = 'bta-banner'; banner.setAttribute('aria-hidden', 'true');
    const combo = document.createElement('div'); combo.className = 'bta-combo'; combo.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.className = 'punch-label bta-label'; label.textContent = 'TAP TO FIGHT !'; label.setAttribute('aria-hidden', 'true');
    shot.append(cv, hud, banner, combo, label);
    const g = cv.getContext('2d');
    const oppName = hud.querySelector('.bta-opp-name'), oppHp = hud.querySelector('.bta-opp-hp'), hiroBar = hud.querySelector('.bta-hiro-hp');
    const oppFace = hud.querySelector('.bta-opp-face'), timerEl = hud.querySelector('.hud-timer'), hiroMeter = hud.querySelector('.bta-hiro-meter'), oppMeter = hud.querySelector('.bta-opp-meter');
    let timer = 99, fightStart = 0, loopHits = 0;
    const LH = 130; let W = 120;
    function resize() { const r = shot.getBoundingClientRect(); if (!r.height) return; W = Math.round(r.width / (r.height / LH)); cv.width = W; cv.height = LH; g.imageSmoothingEnabled = false; }
    resize(); addEventListener('resize', resize);
    const ground = () => LH * .9;
    const FEET = 76;                       // feet sit on row 75 of every 120x86 frame; a lying 'down' body rests on row 79 (only hair hangs lower)
    const hiroX = () => Math.round(W * .34);
    const fightX = () => hiroX() + 38;

    // ---- state
    const H = { f: 'idle', dx: 0, act: null }, O = { key: 'axel', f: 'idle', x: 0, act: null, reactT: -1, koT: -1, koX: 0, blink: false, visible: false };
    let clock = 0, visible = false, sparks = [], fireball = null, shake = 0, round = 0, hitsDone = 0, rot = 0;
    let phase = 'intro', lastClick = -1e9, pending = null, nextAuto = 0, nextAir = 0;
    let hiroHp = 1, oppLanded = false;                          // survival: Hiro's health carries over from one opponent to the next
    function setHiroHp(v) { hiroHp = v; hiroBar.style.width = `${Math.round(v * 100)}%`; hiroBar.classList.toggle('is-low', v <= .5); hiroBar.classList.toggle('is-critical', v <= .3); }
    const manual = () => clock - lastClick < 5000;
    const q = []; let cur = null, curT = 0;
    const step = (d, on, tick) => q.push({ d, on, tick });
    function showBanner(text, cls = '') { banner.textContent = text; banner.className = `bta-banner ${cls}`; void banner.offsetWidth; banner.classList.add('is-on'); }
    function hideBanner() { banner.classList.remove('is-on'); }
    function showCombo(n) { combo.textContent = `${n} HIT${n > 1 ? 'S' : ''}`; combo.classList.remove('is-on'); void combo.offsetWidth; combo.classList.add('is-on'); }

    // a "move" is a list of [frame, ms, onStart?]
    function play(who, seq) { who.act = { seq, i: -1, t: 0 }; advance(who); }
    function advance(who) {
      const a = who.act; a.i++; a.t = 0;
      if (a.i >= a.seq.length) { who.act = null; who.f = 'idle'; if (who === H) H.dx = 0; return; }
      const [f, , fn] = a.seq[a.i]; who.f = f; fn?.();
    }
    function tickMove(who, dt) { if (!who.act) return; who.act.t += dt; while (who.act && who.act.t >= who.act.seq[who.act.i][1]) { const over = who.act.t - who.act.seq[who.act.i][1]; advance(who); if (who.act) who.act.t = over; } }

    function landHit() {
      if (phase !== 'fight' || O.koT >= 0) return;
      const R = ROSTER[O.key]; hitsDone++;
      oppHp.style.width = `${Math.max(0, 1 - hitsDone / R.hits) * 100}%`;
      sparks.push({ x: O.x - 9, y: ground() - FEET + 47, t0: clock }); shake = 1; showCombo(hitsDone);
      loopHits++; hiroMeter.style.width = `${Math.min(100, loopHits / 13 * 100)}%`;
      O.act = null; O.f = 'idle';
      if (hitsDone >= R.hits) { O.koT = clock; O.koX = O.x; phase = 'ko'; koSequence(); }
      else O.reactT = clock;
    }
    function hiroAttack(kind) {
      if (phase !== 'fight') return;
      if (!oppLanded && hitsDone >= ROSTER[O.key].hits - 1) {   // every opponent lands one hit before going down
        pending = kind; if (!O.act) oppAttack(false); return;
      }
      if (kind === 'special') {
        play(H, [['special_0', 260], ['special_1', 380, () => { fireball = { x: hiroX() - ROSTER.hiro.cx + 86, y: ground() - FEET + 50 }; }], ['idle', 160]]);
        return;
      }
      const a = { punch: [80, 150], kick: [110, 200], fpunch: [110, 200] }[kind];
      play(H, [[`${kind}_0`, a[0], () => { H.dx = 3; }], [`${kind}_1`, a[1], () => { H.dx = 6; landHit(); }], ['idle', 120, () => { H.dx = 2; }]]);
    }
    function hurtHiro() {
      oppLanded = true; H.act = null; fireball = null;
      play(H, [['hit', 340, () => { H.dx = -7; }], ['idle', 140]]);
      sparks.push({ x: hiroX() + 6, y: ground() - FEET + 46, t0: clock }); shake = 1.2;
      setHiroHp(Math.max(.1, hiroHp - .25)); oppMeter.style.width = '45%';
    }
    function oppAttack(blocked) {
      const kind = Math.random() < .5 ? 'punch' : 'kick';
      play(O, [[`${kind}_0`, 120, () => { if (oppLanded && blocked && !H.act) H.f = 'block'; }],
               [`${kind}_1`, 220, () => {
                 if (!oppLanded) hurtHiro();
                 else if (blocked && H.f === 'block') sparks.push({ x: hiroX() + 13, y: ground() - FEET + 47, t0: clock, small: true });
               }],
               ['idle', 200, () => { if (H.f === 'block') H.f = 'idle'; }]]);
    }
    function koSequence() {
      // the fight step ends; queue the KO beats then the next round
      step(700, () => {});
      step(1150, () => { O.blink = true; H.act = null; H.dx = 0; H.f = 'win'; showBanner('K.O.', 'is-ko'); });
      step(250, () => { O.visible = false; O.blink = false; hideBanner(); });
      step(420, () => { H.f = 'idle'; round++; buildRound(); });
      if (cur) cur.d = curT;   // finish the open-ended fight step now
    }
    function buildRound() {
      const key = ORDER[round % ORDER.length], R = ROSTER[key];
      step(10, () => { phase = 'intro'; O.key = key; O.f = 'walk'; O.act = null; O.x = W + 34; O.koT = -1; O.reactT = -1; O.blink = false; O.visible = true; hitsDone = 0; rot = 0; fireball = null; pending = null; oppLanded = false;
        if (round % ORDER.length === 0) setHiroHp(1);
        oppName.textContent = R.name; oppFace.src = `face_${key}.jpg`; oppHp.style.width = '100%'; H.f = 'idle'; H.act = null;
        timer = 99; timerEl.textContent = '99'; oppMeter.style.width = '12%'; if (round % ORDER.length === 0) { loopHits = 0; hiroMeter.style.width = '0%'; }
        showBanner(round % ORDER.length === 0 ? 'SURVIVAL MODE' : `ROUND ${round % ORDER.length + 1}`, round % ORDER.length === 0 ? 'is-survival' : ''); });
      let from = 0, roundShown = round % ORDER.length !== 0;
      step(0, () => { from = O.x; cur.d = Math.max(400, (from - fightX()) / .05); }, t => { O.x = from + (fightX() - from) * Math.min(1, t / cur.d); if (!roundShown && t > 1000) { roundShown = true; showBanner('ROUND 1'); } });
      step(380, () => { O.f = 'idle'; O.x = fightX(); showBanner('FIGHT!', 'is-fight'); });
      step(Infinity, () => { phase = 'fight'; fightStart = clock; nextAuto = clock + 700; nextAir = clock + 900; setTimeout(hideBanner, 420); }, () => fightTick());
    }
    function fightTick() {
      if (phase !== 'fight') return;
      const R = ROSTER[O.key], remaining = R.hits - hitsDone;
      // queued input (double-click → fireball)
      if (pending && !H.act) { const k = pending; pending = null; hiroAttack(k); return; }
      if (manual()) {
        // player in control: opponent swings in the air near Hiro every so often
        if (!O.act && clock > nextAir && !(O.reactT >= 0 && clock - O.reactT < 300)) { oppAttack(false); nextAir = clock + 1100 + Math.random() * 900; }
        return;
      }
      // auto demo
      if (H.act || O.act || clock < nextAuto || (O.reactT >= 0 && clock - O.reactT < 300)) return;
      if (!oppLanded && hitsDone >= 1) { oppAttack(true); nextAuto = clock + 900; return; }
      if (hitsDone > 0 && Math.random() < .3) { oppAttack(true); nextAuto = clock + 760; return; }
      const kind = remaining === 1 || (R.hits >= 6 && hitsDone === 3) ? 'special' : ROTATION[rot++ % 3];
      hiroAttack(kind); nextAuto = clock + (kind === 'special' ? 1100 : 620);
    }
    buildRound();

    // ---- input
    function onPointer(e) {
      const r = shot.getBoundingClientRect(); label.style.left = `${e.clientX - r.left}px`; label.style.top = `${e.clientY - r.top}px`;
    }
    shot.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { shot.classList.add('is-hover'); onPointer(e); } });
    shot.addEventListener('pointerleave', () => shot.classList.remove('is-hover'));
    shot.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.preventDefault(); onPointer(e);
      label.classList.remove('is-pop'); void label.offsetWidth; label.classList.add('is-pop');
      const quick = clock - lastClick < 300; lastClick = clock;
      if (phase === 'intro' && O.f !== 'walk') { pending = quick ? 'special' : (pending || ROTATION[rot++ % 3]); return; }
      if (phase !== 'fight') return;
      if (quick) { pending = 'special'; return; }   // fires right after the current hit
      if (H.act) { pending = pending || ROTATION[rot++ % 3]; return; }
      hiroAttack(ROTATION[rot++ % 3]);
    });

    // ---- drawing
    function frameOf(R, name) { const i = R.f.indexOf(name); return i < 0 ? 0 : i; }
    function drawFighter(R, name, x, yOff = 0) {
      if (!R.sheet.complete || !R.sheet.naturalWidth) return;
      g.drawImage(R.sheet, frameOf(R, name) * 120, 0, 120, 86, Math.round(x - R.cx), Math.round(ground() - (name === 'down' ? 80 : FEET) + yOff), 120, 86);
    }
    function shadowAt(x, w = 13) { g.fillStyle = '#00000066'; g.beginPath(); g.ellipse(Math.round(x), Math.round(ground() - 1), w, 2.2, 0, 0, Math.PI * 2); g.fill(); }
    function render() {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      if (shake > 0) g.setTransform(1, 0, 0, 1, Math.round((Math.random() - .5) * 2 * shake), Math.round((Math.random() - .5) * 2 * shake));
      const idleF = Math.floor(clock / 420) % 2 ? 'idle_1' : 'idle_0';
      if (O.visible) {
        const R = ROSTER[O.key];
        let name = O.f === 'idle' ? idleF : O.f, x = O.x, y = 0;
        if (O.f === 'walk') name = `walk_${Math.floor(clock / 95) % 8}`;
        if (O.reactT >= 0 && clock - O.reactT < 260) { name = 'hit'; x += 5 * (1 - (clock - O.reactT) / 260); }
        if (O.koT >= 0) {
          const t = clock - O.koT;
          if (t < 560) { name = 'fall'; x = O.koX + 18 * (t / 560); y = -Math.sin(Math.PI * t / 560) * 16; }
          else { name = 'down'; x = O.koX + 18; }
        }
        const blinkHide = O.blink && Math.floor(clock / 85) % 2;
        if (!blinkHide) { const lying = name === 'down'; shadowAt(lying ? x + 9 : x, lying ? 24 : 12); drawFighter(R, name, x, y); }
      }
      const hx = hiroX() + Math.round(H.dx);
      shadowAt(hx, 14);
      drawFighter(ROSTER.hiro, H.f === 'idle' ? idleF : H.f, hx);
      if (H.f === 'special_0') {
        const cx = hx - ROSTER.hiro.cx + 74, cy = ground() - FEET + 50;
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 9 + Math.sin(clock / 40) * 2);
        gr.addColorStop(0, '#a8f4ffee'); gr.addColorStop(1, '#1458c400'); g.fillStyle = gr; g.fillRect(cx - 14, cy - 14, 28, 28); g.restore();
      }
      if (fireball) drawFireball(g, HIRO_FB, fireball.x, fireball.y, clock / 16.67, .72);
      sparks = sparks.filter(s => clock - s.t0 < 220);
      for (const s of sparks) { const age = Math.floor((clock - s.t0) / 33); if (s.small && age > 5) continue; drawSpark(g, Math.round(s.x), Math.round(s.y), Math.min(5, age)); }
    }

    // ---- loop (the clock only runs while the image is on screen)
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) resize(); }, { threshold: .2 }).observe(shot);
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(50, now - last); last = now;
      if (visible) {
        clock += dt; shake = Math.max(0, shake - dt / 140);
        if (phase === 'fight') { const t = Math.max(0, 99 - Math.floor((clock - fightStart) / 1000)); if (t !== timer) { timer = t; timerEl.textContent = String(t).padStart(2, '0'); } }
        H.dx += ((H.act ? H.dx : 0) - H.dx) * .25;
        tickMove(H, dt); tickMove(O, dt);
        if (fireball) { fireball.x += .12 * dt; if (fireball.x >= O.x - 10) { fireball = null; landHit(); } }
        if (!cur) { cur = q.shift(); curT = 0; cur?.on?.(); }
        if (cur) {
          curT += dt; cur.tick?.(curT);
          while (cur && curT >= cur.d) {
            const over = cur.d === Infinity ? 0 : curT - cur.d; cur = q.shift(); curT = over;
            if (cur) { cur.on?.(); cur.tick?.(curT); }
          }
        }
        render();
      }
      requestAnimationFrame(loop);
    })(last);
  })();

  /* ---------- Wallpapers popup: animated close (the open animation is pure CSS) ----------
     home.js hides the modal instantly; we intercept close (button, backdrop, Escape), play the exit animation, then let it close. */
  (() => {
    const wm = document.getElementById('wallpaper-modal'), closeBtn = document.getElementById('wallpaper-modal-close');
    if (!wm || !closeBtn || reduce) return;
    let closing = false, bypass = false;
    function animateClose(run) {
      if (closing || wm.hidden) return; closing = true; wm.classList.add('is-closing');
      setTimeout(() => { wm.classList.remove('is-closing'); closing = false; bypass = true; run(); bypass = false; }, 280);
    }
    closeBtn.addEventListener('click', e => { if (bypass) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
    wm.addEventListener('click', e => { if (bypass || !e.target.closest('[data-close-wallpaper]')) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
    document.addEventListener('keydown', e => { if (bypass || e.key !== 'Escape' || wm.hidden) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
  })();

  /* ---------- Install popup: animated close (CRT collapse; the opening is pure CSS) ---------- */
  (() => {
    const im = document.getElementById('install-modal'), closeBtn = document.getElementById('install-modal-close');
    if (!im || !closeBtn || reduce) return;
    let closing = false, bypass = false;
    function animateClose(run) {
      if (closing || im.hidden) return; closing = true; im.classList.add('is-closing');
      setTimeout(() => { im.classList.remove('is-closing'); closing = false; bypass = true; run(); bypass = false; }, 300);
    }
    closeBtn.addEventListener('click', e => { if (bypass) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
    im.addEventListener('click', e => { if (bypass || !e.target.closest('[data-close-install]')) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
    document.addEventListener('keydown', e => { if (bypass || e.key !== 'Escape' || im.hidden) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
  })();

  /* ---------- Gameplay video popup: animated close (open animation is CSS) ---------- */
  (() => {
    const vm = document.getElementById('video-modal'), closeBtn = document.getElementById('video-close');
    if (!vm || !closeBtn || reduce) return;
    let closing = false, bypass = false;
    function animateClose(run) {
      if (closing || vm.hidden) return; closing = true; vm.classList.add('is-closing');
      setTimeout(() => { vm.classList.remove('is-closing'); closing = false; bypass = true; run(); bypass = false; }, 280);
    }
    closeBtn.addEventListener('click', e => { if (bypass) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
    vm.addEventListener('click', e => { if (bypass || !e.target.closest('[data-close-video]')) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
    document.addEventListener('keydown', e => { if (bypass || e.key !== 'Escape' || vm.hidden) return; e.stopImmediatePropagation(); animateClose(() => closeBtn.click()); }, true);
  })();

  /* ---------- Special modes: play gate ----------
     Each playable image starts "locked" with a centred TAP TO … button. When the mouse enters, the same green/purple diagonal
     slash as the fighter slider sweeps across and the image becomes playable; leaving the image locks it again.
     On touch, the first tap unlocks (and is not counted as a hit). */
  [['.cab-scene', 'TAP TO DESTROY'], ['.special-punch-shot', 'TAP TO PUNCH'], ['.bta-scene', 'TAP TO FIGHT']].forEach(([sel, text]) => {
    const scene = document.querySelector(sel); if (!scene) return;
    scene.classList.add('is-locked', 'play-scene');
    const gateEl = document.createElement('div'); gateEl.className = 'play-gate'; gateEl.setAttribute('aria-hidden', 'true');
    gateEl.innerHTML = `<span class="play-gate-btn"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>${text} !</span>`;
    const slash = document.createElement('span'); slash.className = 'gate-slash'; slash.setAttribute('aria-hidden', 'true');
    scene.append(gateEl, slash);
    let timer = 0;
    const locked = () => scene.classList.contains('is-locked');
    function unlock() {
      if (!locked() || scene.classList.contains('is-unlocking')) return;
      scene.classList.add('is-unlocking'); void slash.offsetWidth;
      timer = setTimeout(() => scene.classList.remove('is-locked', 'is-unlocking'), reduce ? 0 : 430);
    }
    function lock() { clearTimeout(timer); scene.classList.remove('is-unlocking'); scene.classList.add('is-locked'); }
    scene.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') unlock(); });
    scene.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') lock(); });
    // capture phase: while locked, a press only opens the gate and never reaches the game handlers
    scene.addEventListener('pointerdown', e => { if (locked()) { e.stopImmediatePropagation(); e.preventDefault(); unlock(); } }, true);
  });

  if (reduce || !finePointer) return; // everything below is mouse-only

  /* ---------- Hero mouse depth ---------- */
  hero?.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    hero.style.setProperty('--hero-mx', (((e.clientX - r.left) / r.width - .5) * 2).toFixed(3));
    hero.style.setProperty('--hero-my', (((e.clientY - r.top) / r.height - .5) * 2).toFixed(3));
  });
  hero?.addEventListener('pointerleave', () => { hero.style.setProperty('--hero-mx', 0); hero.style.setProperty('--hero-my', 0); });

  /* ---------- 3D tilt + glare ---------- */
  document.querySelectorAll('.record-card, .video-card, .wallpaper-card, .about-pillar').forEach(card => {
    card.classList.add('motion-tilt');
    const glare = document.createElement('span'); glare.className = 'motion-glare'; glare.setAttribute('aria-hidden', 'true');
    card.append(glare);
    const strength = card.matches('.video-card') ? 5 : 8;
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
      card.style.setProperty('--ry', `${((nx - .5) * strength).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${((.5 - ny) * strength).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${(nx * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(ny * 100).toFixed(1)}%`);
      card.classList.add('is-tilting');
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  });

  /* ---------- Magnetic buttons ---------- */
  document.querySelectorAll('.button-primary, .icon-button, .install-app-button').forEach(btn => {
    btn.classList.add('motion-magnetic');
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mag-x', `${((e.clientX - r.left - r.width / 2) * .28).toFixed(1)}px`);
      btn.style.setProperty('--mag-y', `${((e.clientY - r.top - r.height / 2) * .38).toFixed(1)}px`);
    });
    btn.addEventListener('pointerleave', () => { btn.style.setProperty('--mag-x', '0px'); btn.style.setProperty('--mag-y', '0px'); });
  });

  /* ---------- Cursor ring ---------- */
  const cursor = document.createElement('div');
  cursor.className = 'motion-cursor'; cursor.setAttribute('aria-hidden', 'true');
  document.body.append(cursor);
  let cx = -200, cy = -200, tx = -200, ty = -200;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY; cursor.classList.add('is-on');
    cursor.classList.toggle('is-hover', !!e.target.closest('a, button, .wallpaper-card, .video-card, input, textarea'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
  addEventListener('pointerdown', () => { cursor.classList.add('is-down'); cursor.classList.remove('is-click'); void cursor.offsetWidth; cursor.classList.add('is-click'); });
  addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  (function follow() {
    cx = lerp(cx, tx, .2); cy = lerp(cy, ty, .2);
    root.style.setProperty('--cursor-x', `${cx.toFixed(1)}px`);
    root.style.setProperty('--cursor-y', `${cy.toFixed(1)}px`);
    requestAnimationFrame(follow);
  })();
})();
