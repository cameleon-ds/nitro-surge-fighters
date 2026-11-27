/* NSF account sync: restores Nitro Coins, bonus stage and bought special modes from the server
   (progress saved on another domain/browser), and saves new purchases to the account. Load before main.js. */
(function () {
  var URL = 'https://wjuqigklzbulqyewkdwe.supabase.co/rest/v1/rpc/', KEY = 'sb_publishable_YBogVNeEglj0LY0B4QxrnQ_E6VT9GNW';
  var LS = window.localStorage; if (!LS) return;
  function rpc(fn, args) {
    return fetch(URL + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
      .then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  function player() { try { var p = JSON.parse(LS.getItem('nsfPlayer')) || {}; return p.id && p.secret ? p : null; } catch (e) { return null; } }
  var setItem = Storage.prototype.setItem, busy = false;
  function set(k, v) { setItem.call(LS, k, v); }

  // pull: server → this browser (once per page load, and right after logging in)
  function restore(reloadIfChanged) {
    var p = player(); if (!p || busy) return; busy = true;
    rpc('nsf_my_best', { p_id: p.id, p_secret: p.secret }).then(function (b) {
      busy = false; if (!b || b.error) return;
      var changed = false;
      if (LS.getItem('nsfSpecialPurchaseVersion') !== '2') set('nsfSpecialPurchaseVersion', '2');   // keep the game from wiping restored modes
      var ck = 'nsfCoins_' + p.id, local = +LS.getItem(ck) || 0;
      if ((+b.coins || 0) > local) { set(ck, String(b.coins)); changed = true; }
      if (b.unlocked && LS.getItem('nsfSpecial') !== '1') { set('nsfSpecial', '1'); changed = true; }
      if (b.cab_owned && LS.getItem('nsfMode_cab') !== '1') { set('nsfMode_cab', '1'); set('nsfCabOwned', '1'); changed = true; }
      if (b.punch_owned && LS.getItem('nsfMode_punch') !== '1') { set('nsfMode_punch', '1'); changed = true; }
      if (b.bta_owned && LS.getItem('nsfMode_bta') !== '1') { set('nsfMode_bta', '1'); changed = true; }
      if (b.modes_reset) {   // account corrected on the server: drop local modes it does not own (once)
        [['cab', b.cab_owned], ['punch', b.punch_owned], ['bta', b.bta_owned]].forEach(function (m) {
          if (!m[1] && LS.getItem('nsfMode_' + m[0]) === '1') { LS.removeItem('nsfMode_' + m[0]); if (m[0] === 'cab') LS.removeItem('nsfCabOwned'); changed = true; }
        });
        rpc('nsf_sync_modes', { p_id: p.id, p_secret: p.secret, p_reset_done: true });
      }
      // push: purchases made in this browser but not yet on the account
      var cab = LS.getItem('nsfMode_cab') === '1' || LS.getItem('nsfCabOwned') === '1', punch = LS.getItem('nsfMode_punch') === '1', bta = LS.getItem('nsfMode_bta') === '1', sp = LS.getItem('nsfSpecial') === '1';
      if ((cab && !b.cab_owned) || (punch && !b.punch_owned) || (bta && !b.bta_owned) || (sp && !b.unlocked)) rpc('nsf_sync_modes', { p_id: p.id, p_secret: p.secret, p_cab: cab, p_punch: punch, p_bta: bta, p_unlocked: sp });
      if (changed && reloadIfChanged) {
        try { if (sessionStorage.getItem('nsfSyncReload')) return; sessionStorage.setItem('nsfSyncReload', '1'); } catch (e) { return; }
        location.reload();   // the game reads coins at start: reload once so it shows the restored total
      }
    });
  }

  // push new purchases / unlocks as soon as the game saves them
  Storage.prototype.setItem = function (k, v) {
    setItem.call(this, k, v);
    if (this !== LS) return;
    if (k === 'nsfPlayer') { setTimeout(function () { restore(true); }, 1500); return; }   // just logged in on this browser
    if ((k === 'nsfMode_cab' || k === 'nsfMode_punch' || k === 'nsfMode_bta' || k === 'nsfCabOwned' || k === 'nsfSpecial') && v === '1') {
      var p = player(); if (p) rpc('nsf_sync_modes', { p_id: p.id, p_secret: p.secret, p_cab: k === 'nsfMode_cab' || k === 'nsfCabOwned', p_punch: k === 'nsfMode_punch', p_bta: k === 'nsfMode_bta', p_unlocked: k === 'nsfSpecial' });
    }
  };
  restore(true);
})();
