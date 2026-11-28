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
      : 'ALLOW SCREEN ROTATION<br>Tap CONTINUE to play';
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
  const sSt = document.createElement('style');   // v633 : icône plus grande qui monte en place en apparaissant, texte plus grand qui « respire »
  sSt.textContent = '@keyframes nsfIconIn{0%{opacity:0;transform:translateY(60px) scale(.82)}70%{opacity:1;transform:translateY(-6px) scale(1.03)}100%{opacity:1;transform:translateY(0) scale(1)}}' +
    '@keyframes nsfPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}' +
    '#nsfSplash img{width:min(250px,46vmin);height:min(250px,46vmin);border-radius:22%;object-fit:cover;display:block;box-shadow:0 0 50px #ff8a3a66;opacity:0;animation:nsfIconIn .9s cubic-bezier(.2,.8,.25,1) .15s forwards}' +
    '#nsfSplash p{margin:30px 18px 0;font:13px/1.9 \'Press Start 2P\',monospace;color:#ffd23a;text-align:center;text-shadow:0 0 14px #ff8a3a88;opacity:0;transition:opacity .5s;animation:nsfPulse 1.6s ease-in-out infinite}';
  document.head.appendChild(sSt);
  splash.innerHTML = '<img src="icon-maskable-512.png?v=6" alt=""><p>HOLD YOUR PHONE UPRIGHT</p>';
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
    if (portraitCount >= 8) {   // v634 : icône affichée ~2 s en portrait (2× plus longtemps), puis ALLOW SCREEN ROTATION
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

  // v633 : après la rotation, iOS décale parfois la zone de toucher du bouton (le bouton est visible mais ne réagit pas).
  // Dès que CONTINUE est prêt, un appui N'IMPORTE OÙ sur l'écran de rotation lance le jeu.
  const tapAnywhere = e => {
    if (phase !== PHASE.GATE || splashOn || !ready() || button.hidden) return;
    if (e.target === button) return;   // appui direct sur le bouton : son propre clic s'en charge
    e.preventDefault(); button.click();
  };
  ['pointerup', 'touchend'].forEach(t => document.addEventListener(t, tapAnywhere, { capture: true, passive: false }));
  button.addEventListener('click', () => {
    if (phase !== PHASE.GATE) return;
    phase = PHASE.PLAYING; clearInterval(pollT);
    body.classList.remove('orientation-gated');
    // le jeu (main.js) ajoute « rotok » et recalcule l'écran ; on le recalcule encore un peu après, le temps que la taille réelle arrive
    [60, 300, 800, 1600].forEach(ms => setTimeout(() => window.dispatchEvent(new Event('resize')), ms));
  }, true);
})();
