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
  const ready = () => okCount >= 2;   // paysage confirmé 2 fois de suite (~0,5 s) : l'écran a fini de tourner

  function render() {
    button.hidden = !ready();
    button.textContent = 'CONTINUE';
    hint.innerHTML = !isLandscape() ? 'ALLOW SCREEN ROTATION<br>Turn your phone sideways'
      : !ready() ? 'ALLOW SCREEN ROTATION<br>Preparing landscape screen'
      : 'ALLOW SCREEN ROTATION<br>Press CONTINUE to play';
  }
  function poll() {
    if (phase !== PHASE.GATE) return;
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
