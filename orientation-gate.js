(() => {
  'use strict';
  const touchDevice = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window) || /[?&]touch/.test(location.search);
  if (!touchDevice) return;

  const body = document.body;
  const button = document.getElementById('rotateOk');
  const hint = document.getElementById('rotateHint');
  if (!button || !hint) return;

  const PHASE = { GATE: 'gate', PLAYING: 'playing' };
  let phase = PHASE.GATE;
  let viewportStable = false;
  let settleTimer = 0;
  const isLandscape = () => {
    const visual = window.visualViewport;
    return matchMedia('(orientation: landscape)').matches ||
      window.innerWidth > window.innerHeight ||
      !!visual && visual.width > visual.height;
  };

  function render() {
    const ready = isLandscape() && viewportStable;
    button.hidden = !ready;
    button.textContent = 'CONTINUE';
    if (!isLandscape()) {
      hint.innerHTML = 'ALLOW SCREEN ROTATION<br>Turn your phone sideways';
    } else if (!viewportStable) {
      hint.innerHTML = 'ALLOW SCREEN ROTATION<br>Preparing landscape screen';
    } else {
      hint.innerHTML = 'ALLOW SCREEN ROTATION<br>Press CONTINUE to play';
    }
  }

  function enterGate() {
    if (phase !== PHASE.PLAYING) return;
    phase = PHASE.GATE;
    viewportStable = false;
    body.classList.add('orientation-gated');
    body.classList.remove('rotok');
    render();
    window.dispatchEvent(new Event('resize'));
    settleViewport();
  }

  function settleViewport() {
    window.clearTimeout(settleTimer);
    viewportStable = false;
    render();
    settleTimer = window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        viewportStable = isLandscape();
        render();
      }));
    }, 300);
  }

  function onOrientationChange() {
    if (phase === PHASE.PLAYING && !isLandscape()) {
      enterGate();
      return;
    }
    if (phase === PHASE.GATE) settleViewport();
  }

  body.classList.add('orientation-gated');
  body.classList.remove('rotok');
  render();
  settleViewport();
  window.addEventListener('orientationchange', onOrientationChange, { passive: true });
  window.addEventListener('resize', onOrientationChange, { passive: true });
  window.visualViewport?.addEventListener('resize', onOrientationChange, { passive: true });

  button.addEventListener('click', event => {
    if (phase !== PHASE.GATE) return;
    if (!isLandscape() || !viewportStable) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    phase = PHASE.PLAYING;
    body.classList.remove('orientation-gated');
    // Let the original game handler confirm the landscape layout and start the game.
  }, true);
})();
