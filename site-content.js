/* NSF — editable site content (videos + wallpapers), managed from nsf-admin-n.html and stored in Supabase.
   Loads the content (max 1.5 s), applies it, then starts home.js and home-motion.js so every effect binds to the final cards.
   If Supabase is slow or offline, the content written in index.html / home.js is kept. */
(() => {
  'use strict';
  const SB_URL = 'https://wjuqigklzbulqyewkdwe.supabase.co', SB_KEY = 'sb_publishable_YBogVNeEglj0LY0B4QxrnQ_E6VT9GNW';
  const SCRIPTS = ['home.js?v=75', 'home-motion.js?v=58'];
  const get = path => fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY } }).then(r => r.ok ? r.json() : Promise.reject(r.status));
  const timeout = new Promise(res => setTimeout(() => res(null), 1500));
  const load = Promise.all([
    get('site_videos?select=youtube_id,title,label,fallback&visible=eq.true&order=position.asc,id.asc'),
    get('site_wallpapers?select=title,image_url,file_name&visible=eq.true&order=position.asc,id.asc'),
    get('site_mouse_answers?select=text&visible=eq.true&order=position.asc,id.asc').catch(() => []),
    get('site_nav_messages?select=text&visible=eq.true&order=position.asc,id.asc').catch(() => [])
  ]).then(([videos, wallpapers, answers, navMsgs]) => ({ videos, wallpapers, answers, navMsgs })).catch(() => null);

  function applyWallpapers(list) {
    const set = document.querySelector('#wallpaper-track .wallpaper-set');
    if (!set || !Array.isArray(list) || !list.length) return;
    set.textContent = '';
    list.forEach(w => {
      const ext = (String(w.image_url).split('?')[0].match(/\.(jpe?g|png|webp)$/i) || ['.jpg'])[0].toLowerCase();
      const file = w.file_name || ('nsf-' + String(w.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + ext);
      const card = document.createElement('button'); card.className = 'wallpaper-card'; card.type = 'button';
      card.dataset.wallpaperSrc = w.image_url; card.dataset.wallpaperFile = file; card.dataset.wallpaperTitle = w.title;
      const box = document.createElement('span'); box.className = 'wallpaper-image';
      const img = document.createElement('img'); img.src = w.image_url; img.alt = `Nitro Surge Fighters ${w.title.toLowerCase()} wallpaper`; img.loading = 'lazy'; box.append(img);
      const cap = document.createElement('span'); cap.className = 'wallpaper-caption';
      const strong = document.createElement('strong'); strong.textContent = w.title;
      const small = document.createElement('small'); small.textContent = 'VIEW WALLPAPER +';
      cap.append(strong, small); card.append(box, cap); set.append(card);
    });
  }

  function start(content) {
    if (content) {
      if (Array.isArray(content.videos) && content.videos.length)
        window.NSF_VIDEOS = content.videos.map((v, i) => ({ id: v.youtube_id || null, title: v.title, label: v.label, fallback: v.fallback || ['stage_city.jpg', 'stage_ring.jpg', 'stage_dojo.jpg', 'stage_terrace.jpg', 'stage_lab.jpg'][i % 5] }));
      applyWallpapers(content.wallpapers);
      if (Array.isArray(content.answers) && content.answers.length) window.NSF_SHOUTS = content.answers.map(a => a.text);
      if (Array.isArray(content.navMsgs) && content.navMsgs.length) window.NSF_NAV_TIPS = content.navMsgs.map(a => a.text);
    }
    SCRIPTS.forEach(src => { const s = document.createElement('script'); s.src = src; s.async = false; document.body.append(s); });
  }
  Promise.race([load, timeout]).then(start);
})();
