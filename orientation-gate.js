(() => {
  'use strict';
  // v630 : écran « ALLOW SCREEN ROTATION » fiable, quelle que soit la façon de tenir le téléphone au lancement.
  // - l'orientation vient d'abord du capteur (screen.orientation / window.orientation) : au lancement en paysage, certains
  //   téléphones (appli installée sur l'écran d'accueil) donnent encore une taille d'écran « portrait » pendant un moment ;
  // - l'écran se vérifie tout seul toutes les 250 ms (pas seulement sur les événements, qui ne viennent pas toujours) ;
  // - quand le bouton CONTINUE est affiché, il marche toujours.
  const touchDevice = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window) || /[?&]touch/.test(location.search);
  if (!touchDevice) return;

  const body = document.body;
  const button = document.getElementById('rotateOk');
  const hint = document.getElementById('rotateHint');
  if (!button || !hint) return;

  const PHASE = { GATE: 'gate', PLAYING: 'playing' };
  let phase = PHASE.GATE, okCount = 0, pollT = 0;

  const isLandscape = () => {
    if (typeof window.nsfLandscape === 'function') return window.nsfLandscape();
    const so = screen.orientation && screen.orientation.type;
    if (so) return so.indexOf('landscape') === 0;
    if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90;
    return matchMedia('(orientation: landscape)').matches || window.innerWidth > window.innerHeight;
  };
  // v631 : bug d'iOS (WebKit 301994) — appli installée lancée en paysage : iOS garde en haut la place de la barre d'état du mode
  // portrait (~59 px) et pousse le jeu vers le bas (bande noire). Impossible à corriger depuis la page ; tourner le téléphone
  // en portrait puis en paysage la fait disparaître. On le détecte et on le demande avant CONTINUE (bouton rendu après 8 s quoi qu'il arrive).
  const iosApp = navigator.standalone === true;
  const topGap = () => {
    if (!iosApp || !isLandscape()) return false;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    return Math.min(screen.width, screen.height) - h > 24;
  };
  let gapT0 = 0;
  const gapWait = () => { if (!topGap()) { gapT0 = 0; return false; } if (!gapT0) gapT0 = Date.now(); return Date.now() - gapT0 < 8000; };
  const ready = () => okCount >= 2 && !gapWait();   // paysage confirmé 2 fois de suite (~0,5 s) : l'écran a fini de tourner

  function render() {
    button.hidden = !ready();
    button.textContent = 'CONTINUE';
    hint.innerHTML = !isLandscape() ? 'ALLOW SCREEN ROTATION<br>Turn your phone sideways'
      : okCount >= 2 && topGap() && gapWait() ? 'ALMOST READY<br>Turn your phone to portrait,<br>then back to landscape'
      : !ready() ? 'ALLOW SCREEN ROTATION<br>Preparing landscape screen'
      : 'ALLOW SCREEN ROTATION<br>Press CONTINUE to play';
  }
  function poll() {
    if (phase !== PHASE.GATE) return;
    if (splashOn) { okCount = 0; button.hidden = true; return; }   // écran d'accueil portrait encore affiché
    okCount = isLandscape() ? okCount + 1 : 0;
    render();
  }
  function enterGate() {
    if (phase !== PHASE.GATE) { phase = PHASE.GATE; okCount = 0; }
    body.classList.add('orientation-gated');
    body.classList.remove('rotok');
    render();
    clearInterval(pollT); pollT = setInterval(poll, 250);
    window.dispatchEvent(new Event('resize'));
  }
  function onOrientationChange() {
    if (phase === PHASE.PLAYING) { if (!isLandscape()) enterGate(); return; }
    okCount = 0; render();   // l'écran bouge encore : on reconfirme
  }

  // v632 : au lancement, écran d'accueil OBLIGATOIREMENT en portrait : l'icône du jeu au milieu. Si le téléphone est tenu en paysage,
  // cet écran est affiché de côté (comme une appli bloquée en portrait) : le joueur tourne son téléphone en portrait, puis vient
  // l'animation ALLOW SCREEN ROTATION. Partir du portrait évite aussi la bande noire d'iOS (appli installée lancée en paysage).
  const angle = () => {
    if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
    if (typeof window.orientation === 'number') return (window.orientation + 360) % 360;
    return isLandscape() ? 90 : 0;
  };
  const splash = document.createElement('div');
  splash.id = 'nsfSplash';
  splash.innerHTML = '<img src="icon-512.png?v=6" alt="" width="128" height="128" style="width:128px;height:128px;border-radius:28px;box-shadow:0 0 40px #ff8a3a55">' +
    '<p style="margin:26px 18px 0;font:9px/1.9 \'Press Start 2P\',monospace;color:#ffd23a;text-align:center;opacity:0;transition:opacity .4s">HOLD YOUR PHONE UPRIGHT</p>';
  splash.style.cssText = 'position:fixed;left:50%;top:50%;z-index:20;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .45s';
  body.appendChild(splash);
  const sTxt = splash.querySelector('p');
  let portraitCount = 0, splashOn = true;
  function layoutSplash() {   // toujours dessiné « en portrait » par rapport au téléphone
    const a = angle(), land = isLandscape();
    const w = land ? Math.max(innerWidth, innerHeight) : Math.min(innerWidth, innerHeight), h = land ? Math.min(innerWidth, innerHeight) : Math.max(innerWidth, innerHeight);
    splash.style.width = (land ? h : w) + 'px'; splash.style.height = (land ? w : h) + 'px';
    splash.style.transform = 'translate(-50%,-50%) rotate(' + (land ? (a === 270 ? 90 : -90) : 0) + 'deg)';
    sTxt.style.opacity = land ? '1' : '0';
  }
  function splashTick() {
    if (!splashOn) return;
    layoutSplash();
    portraitCount = isLandscape() ? 0 : portraitCount + 1;
    if (portraitCount >= 4) {   // tenu en portrait ~1 s : place à ALLOW SCREEN ROTATION
      splashOn = false; splash.style.opacity = '0';
      setTimeout(() => { splash.remove(); }, 500);
      okCount = 0; render();
      return;
    }
    setTimeout(splashTick, 250);
  }
  const hasSensor = (screen.orientation && typeof screen.orientation.angle === 'number') || typeof window.orientation === 'number';
  if (hasSensor) splashTick(); else { splashOn = false; splash.remove(); }

  enterGate(); poll();
  window.addEventListener('orientationchange', onOrientationChange, { passive: true });
  window.addEventListener('resize', onOrientationChange, { passive: true });
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', onOrientationChange);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onOrientationChange, { passive: true });
  window.addEventListener('pageshow', () => { if (phase === PHASE.GATE) { okCount = 0; render(); } });

  button.addEventListener('click', () => {
    if (phase !== PHASE.GATE) return;
    phase = PHASE.PLAYING; clearInterval(pollT);
    body.classList.remove('orientation-gated');
    // le jeu (main.js) ajoute « rotok » et recalcule l'écran ; on le recalcule encore un peu après, le temps que la taille réelle arrive
    [60, 300, 800, 1600].forEach(ms => setTimeout(() => window.dispatchEvent(new Event('resize')), ms));
  }, true);
})();
