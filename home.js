(() => {
  'use strict';
  const gameUrl = 'play-nsf.html';
  const fighters = [
    {name:'Hiro', file:'hiro', pixel:'hiro-pixel-from.png', tags:['Balanced','Fire technique'], bio:'A disciplined all-rounder with reliable strikes and powerful fire-based specials.'},
    {name:'Axel', file:'axel', pixel:'axel-pixel-from.png', tags:['Pressure','Flame rush'], bio:'A hard-hitting brawler who turns close-range pressure into explosive momentum.'},
    {name:'Zephyr', file:'zephyr', pixel:'zephyr-pixel-form.png', tags:['Range','Wind projectiles'], bio:'A precise fighter who controls space with aerial movement and ranged attacks.'},
    {name:'Nyx', file:'nyx', pixel:'nyx-pixel-form.png', tags:['Mobility','Arcane fire'], bio:'A swift, elusive fighter whose movement and flame attacks keep opponents guessing.'},
    {name:'Kael', file:'kael', pixel:'kael-pixel-form.png', tags:['Power','Energy attacks'], bio:'A relentless bruiser built around heavy attacks and punishing energy strikes.'},
    {name:'Vesper', file:'vesper', pixel:'vesper-pixel-form.png', tags:['Speed','Echo attacks'], bio:'A fast technical fighter who chains acrobatic kicks into electric blue echoes.'},
    {name:'Grog', file:'grog', pixel:'grog-pixel-form.png', tags:['Heavyweight','Ground fire'], bio:'A towering powerhouse who brings crushing blows and ground-level fire.'},
    {name:'Lord Vane', file:'vane', pixel:'vane-pixel-form.png', tags:['Control','Dark energy'], bio:'A composed combatant who mixes measured strikes with controlled energy attacks.'}
  ];
  const track = document.getElementById('fighter-track');
  let fighterIndex = 0;
  const pad = n => String(n + 1).padStart(2, '0');
  function makeFighter(f, i) {
    const slide = document.createElement('article'); slide.className = 'fighter-slide'; slide.dataset.reveal = ''; slide.dataset.index = pad(i); slide.setAttribute('aria-label', `${f.name}, fighter ${i + 1} of 8`);
    const artPanel = document.createElement('div'); artPanel.className = 'fighter-art-panel';
    const art = document.createElement('img'); art.className = 'fighter-art'; art.dataset.parallax = '0.085'; art.src = `sel_${f.file}.webp?v=2`; art.alt = `${f.name} character artwork`; art.loading = i < 2 ? 'eager' : 'lazy';
    artPanel.appendChild(art);
    const copy = document.createElement('div'); copy.className = 'fighter-copy';
    const number = document.createElement('span'); number.className = 'fighter-number'; number.textContent = `FIGHTER ${pad(i)} / 08`;
    const title = document.createElement('h3'); title.textContent = f.name;
    const bio = document.createElement('p'); bio.textContent = f.bio;
    const tags = document.createElement('div'); tags.className = 'fighter-tags'; f.tags.forEach(tag => { const el = document.createElement('span'); el.textContent = tag; tags.appendChild(el); });
    const versions = document.createElement('div'); versions.className = 'fighter-versions';
    const hdCard = document.createElement('div'); hdCard.className = 'version-card'; const hdLabel = document.createElement('label'); hdLabel.textContent = 'HD ART'; hdCard.append(hdLabel);
    const pxCard = document.createElement('div'); pxCard.className = 'version-card'; const pxLabel = document.createElement('label'); pxLabel.textContent = 'PIXEL FORM';
    let pixelPreview;
    if (f.pixel) {
      pixelPreview = document.createElement('img'); pixelPreview.className = 'pixel-preview pixel-preview-sprite'; pixelPreview.src = f.pixel; pixelPreview.alt = `${f.name} pixel art`; pixelPreview.loading = 'eager';
    } else {
      pixelPreview = document.createElement('canvas'); pixelPreview.className = 'pixel-preview'; pixelPreview.width = 48; pixelPreview.height = 88; pixelPreview.setAttribute('aria-label', `${f.name} pixel art preview`);
      const paintPixel = () => { if (!art.complete || !art.naturalWidth) return; const c = pixelPreview.getContext('2d'); c.clearRect(0,0,pixelPreview.width,pixelPreview.height); c.imageSmoothingEnabled = false; c.drawImage(art,0,0,pixelPreview.width,pixelPreview.height); };
      art.addEventListener('load', paintPixel, {once:true}); if (art.complete) paintPixel();
    }
    pxCard.append(pxLabel, pixelPreview);
    versions.append(hdCard,pxCard); copy.append(number,title,bio,tags,versions);
    slide.append(artPanel,copy); return slide;
  }
  fighters.forEach((f,i) => track.appendChild(makeFighter(f,i)));
  function showFighter(n) { fighterIndex = (n + fighters.length) % fighters.length; track.style.transform = `translate3d(-${fighterIndex * 100}%,0,0)`; document.getElementById('fighter-count').textContent = `${pad(fighterIndex)} / ${pad(fighters.length-1)}`; document.getElementById('fighter-progress').style.width = `${(fighterIndex+1)/fighters.length*100}%`; }
  document.getElementById('fighter-prev').addEventListener('click', () => showFighter(fighterIndex-1));
  document.getElementById('fighter-next').addEventListener('click', () => showFighter(fighterIndex+1));
  const fighterWindow = document.querySelector('.fighter-window');
  let fighterHoverPaused = false;
  fighterWindow.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') fighterHoverPaused = true; });
  fighterWindow.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') fighterHoverPaused = false; });
  [document.getElementById('fighter-prev'), document.getElementById('fighter-next')].forEach(button => {
    button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') fighterHoverPaused = true; });
    button.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') fighterHoverPaused = false; });
  });
  const fighterSection = document.getElementById('fighters');
  let fighterSectionVisible = false;
  let fighterAutoStarted = false;
  // autoplay on desktop only (2 s); on phones / tablets the slider moves only with the arrows or a swipe
  const touchScreen = matchMedia('(hover: none), (pointer: coarse)').matches;
  const fighterAutoDelay = touchScreen ? 3000 : 2000;
  let fighterManualUntil = 0;
  const pauseFighterAuto = () => { fighterManualUntil = Date.now() + 8000; };
  ['fighter-prev','fighter-next'].forEach(id => document.getElementById(id).addEventListener('click', pauseFighterAuto));
  fighterWindow.addEventListener('touchstart', pauseFighterAuto, {passive:true});
  const fighterAutoTimer = window.setInterval(() => {
    if (touchScreen) return;
    if (fighterSectionVisible && !document.hidden && !fighterHoverPaused && Date.now() > fighterManualUntil) showFighter(fighterIndex + 1);
  }, fighterAutoDelay);
  const fighterSectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    fighterSectionVisible = entry.isIntersecting;
    if (entry.isIntersecting && !fighterAutoStarted) { fighterAutoStarted = true; showFighter(0); }
  }), {threshold:.35});
  fighterSectionObserver.observe(fighterSection);
  const specialTrack=document.getElementById('special-track');let specialIndex=0;let specialTouchX=0;
  function showSpecial(n){const slides=specialTrack.children;specialIndex=(n+slides.length)%slides.length;specialTrack.style.transform=`translate3d(-${specialIndex*100}%,0,0)`;document.getElementById('special-count').textContent=`${String(specialIndex+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;document.getElementById('special-progress').style.width=`${(specialIndex+1)/slides.length*100}%`;}
  document.getElementById('special-prev').addEventListener('click',()=>showSpecial(specialIndex-1));document.getElementById('special-next').addEventListener('click',()=>showSpecial(specialIndex+1));
  specialTrack.addEventListener('touchstart',e=>{specialTouchX=e.changedTouches[0].clientX},{passive:true});specialTrack.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-specialTouchX;if(Math.abs(dx)>45)showSpecial(specialIndex+(dx<0?1:-1))},{passive:true});
  let touchStartX = 0; track.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0].clientX},{passive:true}); track.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchStartX;if(Math.abs(dx)>45)showFighter(fighterIndex+(dx<0?1:-1))},{passive:true});

  const videoItems = (Array.isArray(window.NSF_VIDEOS) && window.NSF_VIDEOS.length) ? window.NSF_VIDEOS : [   // NSF_VIDEOS: from Supabase (site-content.js, edited in nsf-admin-n.html)
    {id:'umm4nL_4DAs', title:'GAMEPLAY VIDEO', label:'NITRO SURGE FIGHTERS', fallback:'stage_city.jpg'},
    {id:'Vdb8VXe956Y', title:'VESPER VS ZEPHYR', label:'FULL FIGHT', fallback:'stage_ring.jpg'},
    {id:null, title:'COMING SOON', label:'NEXT GAMEPLAY VIDEO', fallback:'stage_dojo.jpg'},
    {id:null, title:'COMING SOON', label:'NEXT GAMEPLAY VIDEO', fallback:'stage_terrace.jpg'},
    {id:null, title:'COMING SOON', label:'NEXT GAMEPLAY VIDEO', fallback:'stage_lab.jpg'}
  ];
  const videoTrack = document.getElementById('video-track'); let videoIndex = 0;
  videoItems.forEach((v,i)=>{const card=document.createElement('button');card.type='button';card.className='video-card';card.dataset.reveal='';card.dataset.videoIndex=String(i);card.setAttribute('aria-label',`Play ${v.title}`);const img=document.createElement('img');img.className='video-poster';img.dataset.parallax='0.035';img.src=v.id?`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`:v.fallback;img.alt='';img.loading='lazy';img.addEventListener('error',()=>{img.src=v.fallback;img.onerror=null},{once:true});const play=document.createElement('span');play.className='video-play';play.setAttribute('aria-hidden','true');play.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>';if(!v.id){card.classList.add('is-soon');card.setAttribute('aria-disabled','true');card.setAttribute('aria-label',`${v.title}: next gameplay video`);play.className='video-soon';play.textContent='COMING SOON';}const copy=document.createElement('span');copy.className='video-card-copy';const text=document.createElement('span');const small=document.createElement('small');small.textContent=v.label;const h=document.createElement('span');h.className='video-card-title';h.textContent=v.title;text.append(small,h);const number=document.createElement('small');number.textContent=`CLIP 0${i+1}`;copy.append(text,number);card.append(img,play,copy);videoTrack.appendChild(card);});
  function showVideo(n){const max=Math.max(0,videoItems.length-1);videoIndex=Math.max(0,Math.min(max,n));document.getElementById('video-count').textContent=`${String(videoIndex+1).padStart(2,'0')} / ${String(videoItems.length).padStart(2,'0')}`;const card=videoTrack.children[videoIndex];if(card){const limit=Math.max(0,videoTrack.scrollWidth-videoTrack.parentElement.clientWidth);const x=Math.min(limit,Math.max(0,card.offsetLeft-videoTrack.offsetLeft));videoTrack.style.transform=`translate3d(-${x}px,0,0)`;}}
  document.getElementById('video-prev').addEventListener('click',()=>showVideo(videoIndex-1));document.getElementById('video-next').addEventListener('click',()=>showVideo(videoIndex+1));
  let videoTouchX=0;videoTrack.addEventListener('touchstart',e=>{videoTouchX=e.changedTouches[0].clientX},{passive:true});videoTrack.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-videoTouchX;if(Math.abs(dx)>50)showVideo(videoIndex+(dx<0?1:-1))},{passive:true});addEventListener('resize',()=>showVideo(videoIndex));
  const videoModal=document.getElementById('video-modal'),videoFrame=document.getElementById('video-frame'),videoClose=document.getElementById('video-close');let videoOpener=null;
  function closeVideo(){if(videoModal.hidden)return;videoModal.hidden=true;videoModal.setAttribute('aria-hidden','true');videoFrame.src='';document.body.style.overflow='';if(videoOpener)videoOpener.focus();}
  videoTrack.addEventListener('click',e=>{const card=e.target.closest('.video-card');if(!card)return;const item=videoItems[Number(card.dataset.videoIndex)];if(!item||!item.id)return;videoOpener=card;videoFrame.title=item.title;const localFile=location.protocol==='file:';videoModal.classList.toggle('is-local-file',localFile);const thumb=document.getElementById('video-local-thumb');if(thumb){thumb.onerror=()=>{thumb.onerror=null;thumb.src=`https://img.youtube.com/vi/${item.id}/hqdefault.jpg`;};thumb.src=`https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`;}videoFrame.src=localFile?'':`https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(location.origin)}`;const ytLink=document.getElementById('video-youtube-link');if(ytLink)ytLink.href=`https://www.youtube.com/watch?v=${item.id}`;document.body.style.overflow='hidden';videoModal.hidden=false;videoModal.setAttribute('aria-hidden','false');videoClose.focus();});
  videoClose.addEventListener('click',closeVideo);videoModal.addEventListener('click',e=>{if(e.target.matches('[data-close-video]'))closeVideo();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeVideo();});

  const SB_URL='https://wjuqigklzbulqyewkdwe.supabase.co';
  const SB_KEY='sb_publishable_YBogVNeEglj0LY0B4QxrnQ_E6VT9GNW';
  const diffNames=['EASY','NORMAL','HARD','TRAINING','EXTREME'];
  const fmtScore=n=>Number(n||0).toLocaleString('en-US');
  const fmtTime=ms=>{const n=Math.max(0,Number(ms)||0);return `${String(Math.floor(n/60000)).padStart(2,'0')}:${(n%60000/1000).toFixed(2).padStart(5,'0')}`;};
  async function top(mode,limit=5){const res=await fetch(`${SB_URL}/rest/v1/rpc/nsf_top`,{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_mode:mode,p_limit:limit})});if(!res.ok)throw new Error(`Leaderboard ${mode} unavailable`);const rows=await res.json();return Array.isArray(rows)?rows:[];}
  function renderRows(card,rows,mode){fillRows(card.querySelector('.record-list'),rows,mode,5);}
  function fillRows(list,rows,mode,max){list.replaceChildren();if(!rows.length){const li=document.createElement('li');li.className='empty-row';li.textContent='No records yet — set the first one.';list.append(li);return;}rows.slice(0,max).forEach((r,i)=>{const li=document.createElement('li');li.className='record-row';const rank=document.createElement('span');rank.className='rank';rank.textContent=String(i+1).padStart(max>99?3:2,'0');const player=document.createElement('span');player.className='record-player';const name=document.createElement('span');name.className='record-name';name.textContent=r.name||'PLAYER';player.append(name);const meta=document.createElement('span');meta.className='record-meta';if(mode==='bta'){const d=Number(r.difficulty);const diff=Number.isInteger(d)?(diffNames[d]||'--'):String(r.difficulty||'--').toUpperCase();const won=r.bta_won==null?'--/8':`${Math.min(8,Math.max(0,Number(r.bta_won)||0))}/8`;meta.textContent=`${diff} · ${won} · ${fmtTime(r.bta_time_ms)}`;}else if(mode==='basket'){meta.textContent=[r.fighter?String(r.fighter).toUpperCase():'',r.best_combo?`x${r.best_combo} STREAK`:''].filter(Boolean).join(' · ');}else if(mode==='cab'&&r.fighter){meta.textContent=String(r.fighter).toUpperCase();}else if(r.fighter){meta.textContent=String(r.fighter).toUpperCase();}if(meta.textContent)player.append(meta);const value=document.createElement('strong');value.className='record-value';value.textContent=mode==='cab'?fmtTime(r.cab_time_ms):mode==='bta'?fmtScore(r.score):fmtScore(r.score);li.append(rank,player,value);list.append(li);});}
  document.querySelectorAll('.record-card').forEach(async card=>{try{const rows=await top(card.dataset.mode);renderRows(card,rows,card.dataset.mode);}catch(_){const list=card.querySelector('.record-list');list.replaceChildren();const li=document.createElement('li');li.className='empty-row';li.textContent='Records are temporarily unavailable.';list.append(li);}});
  /* ---------- Full leaderboard popup (top 100) ---------- */
  const recModal=document.getElementById('records-modal');
  if(recModal){
    const recList=document.getElementById('records-modal-list'),recThumb=recModal.querySelector('.records-bar-thumb'),recTrack=recModal.querySelector('.records-bar-track'),recBar=recModal.querySelector('.records-bar');
    const reduceRec=matchMedia('(prefers-reduced-motion: reduce)').matches;let recOpener=null,recClosing=false;
    function syncRecBar(){const max=recList.scrollHeight-recList.clientHeight;recBar.classList.toggle('is-idle',max<=2);const tr=recTrack.clientHeight,th=Math.max(28,tr*recList.clientHeight/Math.max(1,recList.scrollHeight));recThumb.style.height=`${th}px`;recThumb.style.transform=`translateY(${max>0?(tr-th)*recList.scrollTop/max:0}px)`;recModal.querySelector('[data-records-scroll="-1"]').disabled=recList.scrollTop<=1;recModal.querySelector('[data-records-scroll="1"]').disabled=recList.scrollTop>=max-1;}
    recList.addEventListener('scroll',syncRecBar,{passive:true});addEventListener('resize',()=>{if(!recModal.hidden)syncRecBar();});
    recModal.querySelectorAll('[data-records-scroll]').forEach(btn=>btn.addEventListener('click',()=>recList.scrollBy({top:Number(btn.dataset.recordsScroll)*recList.clientHeight*.6,behavior:'smooth'})));
    let drag=null;   // drag the scroll thumb
    recThumb.addEventListener('pointerdown',e=>{e.preventDefault();drag={y:e.clientY,top:recList.scrollTop};recThumb.setPointerCapture(e.pointerId);recThumb.classList.add('is-drag');});
    recThumb.addEventListener('pointermove',e=>{if(!drag)return;const max=recList.scrollHeight-recList.clientHeight,room=recTrack.clientHeight-recThumb.offsetHeight;recList.scrollTop=drag.top+(e.clientY-drag.y)*max/Math.max(1,room);});
    const endDrag=()=>{drag=null;recThumb.classList.remove('is-drag');};recThumb.addEventListener('pointerup',endDrag);recThumb.addEventListener('pointercancel',endDrag);
    recTrack.addEventListener('pointerdown',e=>{if(e.target!==recTrack)return;const r=recTrack.getBoundingClientRect();recList.scrollBy({top:(e.clientY<r.top+recThumb.offsetTop?-1:1)*recList.clientHeight*.8,behavior:'smooth'});});
    function closeRecords(){if(recModal.hidden||recClosing)return;const done=()=>{recModal.classList.remove('is-closing');recModal.hidden=true;recModal.setAttribute('aria-hidden','true');document.body.style.overflow='';recClosing=false;recOpener?.focus();};if(reduceRec)return done();recClosing=true;recModal.classList.add('is-closing');setTimeout(done,280);}
    async function openRecords(card){
      recOpener=card.querySelector('[data-record-all]');const mode=card.dataset.mode;
      document.getElementById('records-modal-title').textContent=card.querySelector('h3')?.textContent||'';
      document.getElementById('records-modal-kicker').textContent=card.querySelector('.record-kicker')?.textContent||'';
      const img=card.querySelector('.record-card-head img');document.getElementById('records-modal-img').src=img?img.getAttribute('src'):'';
      const cols=card.querySelectorAll('.record-column-label span');document.getElementById('records-modal-col1').textContent=cols[0]?.textContent||'FIGHTER';document.getElementById('records-modal-col2').textContent=cols[1]?.textContent||'SCORE';
      recList.replaceChildren();const li=document.createElement('li');li.className='loading-row';li.textContent='Loading the full leaderboard…';recList.append(li);recList.scrollTop=0;
      recModal.hidden=false;recModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.getElementById('records-modal-close').focus();
      requestAnimationFrame(syncRecBar);
      try{fillRows(recList,await top(mode,100),mode,100);}catch(_){recList.replaceChildren();const e=document.createElement('li');e.className='empty-row';e.textContent='Records are temporarily unavailable.';recList.append(e);}
      recList.scrollTop=0;syncRecBar();recBar.classList.remove('is-hint');void recBar.offsetWidth;recBar.classList.add('is-hint');   // the arrows pulse once: you can scroll
    }
    document.querySelectorAll('[data-record-all]').forEach(btn=>btn.addEventListener('click',()=>openRecords(btn.closest('.record-card'))));
    document.getElementById('records-modal-close').addEventListener('click',closeRecords);
    recModal.addEventListener('click',e=>{if(e.target.closest('[data-close-records]'))closeRecords();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!recModal.hidden)closeRecords();});
  }
  /* ---------- Nitro Coins popup (price under each Special Mode title) ---------- */
  const coinsModal=document.getElementById('coins-modal');
  if(coinsModal){
    const reduceCoins=matchMedia('(prefers-reduced-motion: reduce)').matches;let coinsOpener=null,coinsClosing=false;
    function closeCoins(){if(coinsModal.hidden||coinsClosing)return;const done=()=>{coinsModal.classList.remove('is-closing');coinsModal.hidden=true;coinsModal.setAttribute('aria-hidden','true');document.body.style.overflow='';coinsClosing=false;coinsOpener?.focus();};if(reduceCoins)return done();coinsClosing=true;coinsModal.classList.add('is-closing');setTimeout(done,280);}
    document.querySelectorAll('[data-coins-info]').forEach(btn=>btn.addEventListener('click',()=>{coinsOpener=btn;coinsModal.hidden=false;coinsModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';document.getElementById('coins-modal-close').focus();}));
    document.getElementById('coins-modal-close').addEventListener('click',closeCoins);
    coinsModal.addEventListener('click',e=>{if(e.target.closest('[data-close-coins]'))closeCoins();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!coinsModal.hidden)closeCoins();});
  }
  const footerLiveList=document.getElementById('footer-live-scores');
  async function refreshFooterScores(){if(!footerLiveList)return;try{const [arcade,cab,bta]=await Promise.all([top('arcade'),top('cab'),top('bta')]);footerLiveList.replaceChildren();for(const [mode,label,row] of [['arcade','ARCADE',arcade[0]],['cab','CYBER CAB',cab[0]],['bta','BEAT THEM ALL',bta[0]]]){const item=document.createElement('article');item.className='footer-live-item';const head=document.createElement('span');head.className='footer-live-mode';head.textContent=label;const detail=document.createElement('div');detail.className='footer-live-detail';const player=document.createElement('strong');const value=document.createElement('span');if(row){player.textContent=row.name||'PLAYER';value.textContent=mode==='cab'?fmtTime(row.cab_time_ms):fmtScore(row.score);if(mode==='bta'){const d=Number(row.difficulty);const diff=Number.isInteger(d)?(diffNames[d]||'--'):String(row.difficulty||'--').toUpperCase();const won=row.bta_won==null?'--/8':`${Math.min(8,Math.max(0,Number(row.bta_won)||0))}/8`;detail.dataset.meta=`${diff} · ${won} · ${fmtTime(row.bta_time_ms)}`;}else if(mode==='cab'&&row.fighter){detail.dataset.meta=String(row.fighter).toUpperCase();}}else{player.textContent='NO RECORD YET';value.textContent='—';}detail.append(player,value);item.append(head,detail);if(detail.dataset.meta){const meta=document.createElement('small');meta.textContent=detail.dataset.meta;item.append(meta);}footerLiveList.append(item);}}catch(_){if(!footerLiveList.children.length)footerLiveList.innerHTML='<p>Scores are temporarily unavailable.</p>';}}
  refreshFooterScores();setInterval(refreshFooterScores,15000);

  const revealExtras = '#about-nsf .about-pillar, #fighters .fighter-art-panel, #fighters .fighter-copy, #videos .video-card, #special-modes .special-shot, #special-modes .special-copy, #records .record-card, #game-experience .experience-copy, #game-experience .experience-visual, #wallpapers .wallpaper-card, #footer-contact, .footer-secondary, .final-copy';
  document.querySelectorAll(revealExtras).forEach(el => el.dataset.reveal = '');
  const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target);}}),{threshold:.14});
  const revealTargets=[...document.querySelectorAll('[data-reveal]')];
  const siblingGroups=new Map();
  revealTargets.forEach(el=>{const siblings=siblingGroups.get(el.parentElement)||[];siblings.push(el);siblingGroups.set(el.parentElement,siblings);});
  siblingGroups.forEach(siblings=>siblings.forEach((el,index)=>el.style.setProperty('--reveal-delay',`${index*140}ms`)));
  revealTargets.forEach(el=>{el.classList.add('reveal');[...el.children].forEach((child,index)=>{child.classList.add('reveal-child');child.style.setProperty('--child-delay',`${index*140}ms`);});revealObserver.observe(el);});
  const titleSelector = 'main h1, main h2, main h3, .site-footer h2, .video-card-title, .wallpaper-caption strong, .footer-play p';
  const titleObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const title = entry.target; titleObserver.unobserve(title);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { title.classList.add('is-typed'); return; }
    const revealParent=title.closest('.reveal');
    const delay=parseFloat(getComputedStyle(revealParent||title).getPropertyValue('--reveal-delay'))||0;
    window.setTimeout(()=>title.classList.add('is-typed'),delay);
  }), {threshold:.35});
  document.querySelectorAll(titleSelector).forEach(title => {
    if (title.dataset.letterReady) return;
    title.dataset.letterReady = 'true';
    const original = title.textContent.replace(/\s+/g, ' ').trim();
    title.setAttribute('aria-label', original);
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    let charIndex = 0;
    nodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      const chars = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(node.nodeValue)].map(part => part.segment) : Array.from(node.nodeValue);
      // letters are grouped per word (.title-word, no break inside) so titles wrap between words, never inside a word
      let word = null;
      chars.forEach(char => {
        if (/\s/.test(char)) { word = null; fragment.appendChild(document.createTextNode(char)); return; }
        if (!word) { word = document.createElement('span'); word.className = 'title-word'; fragment.appendChild(word); }
        const span = document.createElement('span'); span.className = 'title-letter'; span.setAttribute('aria-hidden','true'); span.style.setProperty('--letter-index',String(charIndex++)); span.textContent = char; word.appendChild(span);
      });
      node.parentNode.replaceChild(fragment,node);
    });
    title.classList.add('letter-title'); titleObserver.observe(title);
  });
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;const parallaxEls=[...document.querySelectorAll('[data-parallax]')];let raf=0;
  function parallax(){raf=0;if(reduceMotion)return;const vh=innerHeight;for(const el of parallaxEls){const box=el.parentElement.getBoundingClientRect();if(box.bottom<0||box.top>vh)continue;const amount=Number(el.dataset.parallax)||0;if(el.matches('.cyber-cab-flyover')){const progress=Math.max(0,Math.min(1,(vh-box.top)/(vh+box.height)));el.style.setProperty('--parallax-y',`${progress*74}px`);}else{const offset=(box.top-vh/2)*amount;if(el.matches('.hero-media'))el.style.transform=`translate3d(0,${Math.max(0,-box.top)*amount}px,0)`;else if(el.matches('.final-image'))el.style.transform=`translate3d(0,${offset}px,0)`;else el.style.setProperty('--parallax-y',`${offset}px`);}}}
  if(!reduceMotion){
    addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(parallax)},{passive:true});addEventListener('resize',parallax);parallax();
    document.querySelectorAll('.cyber-cab-flyover').forEach(car=>{
      const scene=car.parentElement;
      scene.addEventListener('pointermove',event=>{if(event.pointerType!=='mouse')return;const box=scene.getBoundingClientRect();const nx=((event.clientX-box.left)/box.width-.5)*2;const ny=((event.clientY-box.top)/box.height-.5)*2;car.style.setProperty('--mouse-x',`${nx*box.width*.48}px`);car.style.setProperty('--mouse-y',`${ny*box.height*.42}px`);});
      scene.addEventListener('pointerleave',()=>{car.style.setProperty('--mouse-x','0px');car.style.setProperty('--mouse-y','0px');});
    });
  }

  showSpecial(0);
  const wallpaperTrack=document.getElementById('wallpaper-track');
  const wallpaperSet=wallpaperTrack?.querySelector('.wallpaper-set');
  const wallpaperWindow=document.querySelector('.wallpaper-window');
  const wallpaperPrev=document.getElementById('wallpaper-prev');
  const wallpaperNext=document.getElementById('wallpaper-next');
  const wallpaperCards=wallpaperSet?[...wallpaperSet.querySelectorAll('.wallpaper-card')]:[];
  function syncWallpaperControls(){
    if(!wallpaperWindow||!wallpaperPrev||!wallpaperNext)return;
    wallpaperPrev.disabled=wallpaperWindow.scrollLeft<=2;
    wallpaperNext.disabled=wallpaperWindow.scrollLeft+wallpaperWindow.clientWidth>=wallpaperWindow.scrollWidth-2;
  }
  function moveWallpaper(direction){
    const card=wallpaperCards[0];if(!card||!wallpaperWindow)return;
    const gap=parseFloat(getComputedStyle(wallpaperSet).columnGap)||0;
    wallpaperWindow.scrollBy({left:direction*(card.getBoundingClientRect().width+gap),behavior:'smooth'});
  }
  wallpaperPrev?.addEventListener('click',()=>moveWallpaper(-1));
  wallpaperNext?.addEventListener('click',()=>moveWallpaper(1));
  let wallpaperScrollRaf=0;
  wallpaperWindow?.addEventListener('scroll',()=>{if(wallpaperScrollRaf)return;wallpaperScrollRaf=requestAnimationFrame(()=>{wallpaperScrollRaf=0;syncWallpaperControls();});},{passive:true});
  addEventListener('resize',syncWallpaperControls);
  syncWallpaperControls();
  const wallpaperModal=document.getElementById('wallpaper-modal');
  const wallpaperPreview=document.getElementById('wallpaper-preview');
  const wallpaperModalTitle=document.getElementById('wallpaper-modal-title');
  const wallpaperDownload=document.getElementById('wallpaper-download');
  const wallpaperModalClose=document.getElementById('wallpaper-modal-close');
  let wallpaperOpener=null;
  function closeWallpaper(){if(wallpaperModal.hidden)return;wallpaperModal.hidden=true;wallpaperModal.setAttribute('aria-hidden','true');wallpaperPreview.src='';document.body.style.overflow='';wallpaperOpener?.focus();}
  wallpaperTrack.addEventListener('click',event=>{const card=event.target.closest('.wallpaper-card');if(!card)return;if(matchMedia('(hover:none),(pointer:coarse)').matches){const im=card.querySelector('.wallpaper-image')?.getBoundingClientRect();if(im&&event.clientX&&Math.hypot(event.clientX-(im.left+im.width/2),event.clientY-(im.top+im.height/2))>44)return;}wallpaperOpener=card;wallpaperPreview.src=card.dataset.wallpaperSrc;wallpaperPreview.alt=card.dataset.wallpaperTitle;wallpaperModalTitle.textContent=card.dataset.wallpaperTitle;wallpaperDownload.href=card.dataset.wallpaperSrc;wallpaperDownload.download=card.dataset.wallpaperFile;wallpaperModal.hidden=false;wallpaperModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';wallpaperModalClose.focus();});
  wallpaperModalClose.addEventListener('click',closeWallpaper);wallpaperModal.addEventListener('click',event=>{if(event.target.matches('[data-close-wallpaper]'))closeWallpaper();});document.addEventListener('keydown',event=>{if(event.key==='Escape')closeWallpaper();});

  const contactForm=document.getElementById('contact-form');
  // Contact form: sent through the Supabase function nsf-contact (email via Resend), works on any static hosting; falls back to the mail app if the function does not answer.
  const CONTACT_URL='https://wjuqigklzbulqyewkdwe.supabase.co/functions/v1/nsf-contact';
  const contactStatus=document.getElementById('contact-status');
  const startedField=contactForm?.querySelector('input[name="started"]');if(startedField)startedField.value=String(Date.now());
  const setContactStatus=(text,state)=>{if(!contactStatus)return;contactStatus.textContent=text;contactStatus.dataset.state=state||'';};
  const mailtoFallback=(name,email,message)=>{const subject=encodeURIComponent(`Nitro Surge Fighters message from ${name}`);const body=encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);window.location.href=`mailto:nsf.helloteam@gmail.com?subject=${subject}&body=${body}`;};
  /* ---------- Anti-spam challenge: HOLD to charge NITRO -> SURGE, then type the combo Y Y B B (max 1 s between buttons) ---------- */
  const COMBO=['Y','Y','B','B'],CHARGE_MS=3200,GAP_MS=1000;
  const chargeBtn=document.getElementById('charge-btn'),comboPad=document.getElementById('combo-pad'),comboMsg=document.getElementById('combo-msg');
  const comboField=contactForm?.querySelector('input[name="combo"]'),tokenField=contactForm?.querySelector('input[name="token"]');
  let charge=0,holding=false,chargeRaf=0,lastT=0,comboStep=0,gapT=0,comboOk=false;
  const setMsg=(t,state)=>{if(comboMsg){comboMsg.innerHTML=t;comboMsg.dataset.state=state||'';}};
  // the server gives a signed, time-limited token (bots posting straight to the function don't have it)
  const loadToken=()=>{if(!tokenField||location.protocol==='file:')return;fetch(CONTACT_URL+'?token=1',{headers:{'Accept':'application/json'}}).then(r=>r.json()).then(j=>{if(j&&j.token)tokenField.value=j.token;}).catch(()=>{});};
  loadToken();
  let nitroShown=false;
  function paintCharge(){if(!chargeBtn)return;chargeBtn.style.setProperty('--charge',charge.toFixed(3));chargeBtn.classList.toggle('is-surge',charge>=.5);
    if(holding&&charge>=.5&&!nitroShown){nitroShown=true;setMsg('NITRO READY! KEEP HOLDING FOR SURGE…','nitro');chargeBtn.classList.remove('is-nitro');void chargeBtn.offsetWidth;chargeBtn.classList.add('is-nitro');}
    if(charge<.5)nitroShown=false;}
  let holdStart=0,dropStart=0,dropFrom=0;   // time based (not frame based): same speed on every device
  function startHold(){holding=true;holdStart=performance.now()-charge*CHARGE_MS;setMsg('CHARGING… KEEP HOLDING!','charging');if(!chargeRaf)chargeRaf=requestAnimationFrame(chargeLoop);}
  function chargeLoop(t){const now=performance.now();charge=holding?Math.min(1,(now-holdStart)/CHARGE_MS):Math.max(0,dropFrom-(now-dropStart)/400);paintCharge();
    if(charge>=1&&holding){holding=false;lastT=0;chargeRaf=0;surgeReady();return;}
    if(holding||charge>0)chargeRaf=requestAnimationFrame(chargeLoop);else{chargeRaf=0;lastT=0;}}
  function resetChallenge(msg){clearTimeout(gapT);stopTimer();setStep(1);comboStep=0;comboOk=false;charge=0;holding=false;paintCharge();chargeBtn?.classList.remove('is-full');if(comboPad)comboPad.hidden=true;comboPad?.querySelectorAll('.combo-slots span').forEach(x=>x.classList.remove('is-hit'));if(chargeBtn){chargeBtn.hidden=false;chargeBtn.disabled=false;chargeBtn.classList.remove('is-nitro','is-ready');if(chargeLabel)chargeLabel.textContent='HOLD TO CHARGE';}if(msg)setMsg(msg,'error');}
  const chargeLabel=chargeBtn?.querySelector('.charge-label');
  const robotTimer=document.getElementById('robot-timer'),robotStep=document.getElementById('robot-step'),COMBO_TIME=8000;let timerRaf=0,timerEnd=0;
  const setStep=n=>{if(robotStep)robotStep.textContent=`STEP - 0${n}`;};
  function stopTimer(){cancelAnimationFrame(timerRaf);timerRaf=0;if(robotTimer){robotTimer.hidden=true;robotTimer.classList.remove('is-low');}}
  function tickTimer(){const left=Math.max(0,timerEnd-performance.now());if(robotTimer){const sec=Math.floor(left/1000),cs=Math.floor(left%1000/10);robotTimer.textContent=`${String(sec).padStart(2,'0')}:${String(cs).padStart(2,'0')}`;robotTimer.classList.toggle('is-low',left<3000);}
    if(left<=0){stopTimer();resetChallenge('TIME OUT! TRY AGAIN!');return;}timerRaf=requestAnimationFrame(tickTimer);}
  function startTimer(){stopTimer();timerEnd=performance.now()+COMBO_TIME;if(robotTimer)robotTimer.hidden=false;tickTimer();}   // 8 s to do the combo
  function surgeReady(){chargeBtn.classList.add('is-full','is-ready');chargeBtn.disabled=true;if(chargeLabel)chargeLabel.textContent='SURGE READY!';setTimeout(()=>{comboPad.hidden=false;comboStep=0;setStep(2);startTimer();setMsg('TRY <b>Y Y B B</b>','try');comboPad.querySelector('.ck-y')?.focus({preventScroll:true});},260);}
  chargeBtn?.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();startHold();});
  const release=()=>{if(!holding)return;holding=false;dropStart=performance.now();dropFrom=charge;if(!chargeRaf)chargeRaf=requestAnimationFrame(chargeLoop);if(charge<1)setMsg('KEEP HOLDING UNTIL THE GAUGE IS FULL!','error');};
  chargeBtn?.addEventListener('pointerup',release);chargeBtn?.addEventListener('pointerleave',release);chargeBtn?.addEventListener('pointercancel',release);
  chargeBtn?.addEventListener('contextmenu',e=>e.preventDefault());
  chargeBtn?.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();startHold();}});
  chargeBtn?.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')release();});
  let retryT=0;
  function retryCombo(msg){clearTimeout(gapT);clearTimeout(retryT);comboStep=0;comboPad?.querySelectorAll('.combo-slots span').forEach(x=>x.classList.remove('is-hit'));setMsg(msg,'error');retryT=setTimeout(()=>{if(comboPad&&!comboPad.hidden&&comboStep===0&&!comboOk)setMsg('TRY <b>Y Y B B</b>','try');},900);}
  function pressKey(k){
    if(!comboPad||comboPad.hidden||comboOk)return;
    const el=comboPad.querySelector(`[data-key="${k}"]`);if(el){el.classList.remove('is-press');void el.offsetWidth;el.classList.add('is-press');}
    clearTimeout(gapT);
    if(k==='X'||k==='A')return resetChallenge('WRONG BUTTON! BACK TO STEP 01!');   // X or A: everything starts again (step 01)
    if(k!==COMBO[comboStep])return retryCombo('WRONG ORDER, RETRY!');
    comboPad.querySelectorAll('.combo-slots span')[comboStep]?.classList.add('is-hit');comboStep++;
    if(comboStep===COMBO.length){comboOk=true;stopTimer();setMsg('COMBO!','ok');if(comboField)comboField.value=COMBO.join('');setTimeout(()=>{document.getElementById('robot-play').hidden=true;document.getElementById('robot-win').hidden=false;document.getElementById('robot-win-close').focus();},450);return;}
    gapT=setTimeout(()=>retryCombo('TOO SLOW, RETRY!'),GAP_MS);   // more than 1 s before the next button: restart the combo (timer keeps running)
  }
  comboPad?.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-key]');if(!b)return;e.preventDefault();pressKey(b.dataset.key);});
  comboPad?.addEventListener('keydown',e=>{const k=e.key.toUpperCase();if(['X','Y','A','B'].includes(k)){e.preventDefault();pressKey(k);}else if(e.key==='Enter'||e.key===' '){const b=e.target.closest('[data-key]');if(b){e.preventDefault();pressKey(b.dataset.key);}}});
  /* I'M NOT A ROBOT -> popup with the challenge; success -> CONGRATULATIONS, SEND gets enabled and the robot button shows a check */
  const robotBtn=document.getElementById('robot-btn'),sendBtn=document.getElementById('send-btn'),robotModal=document.getElementById('robot-modal');
  let robotClosing=false,verified=false;
  function setVerified(v){verified=v;sendBtn&&(sendBtn.disabled=!v);if(robotBtn){robotBtn.classList.toggle('is-verified',v);robotBtn.disabled=v;robotBtn.setAttribute('aria-label',v?"I'm not a robot: verified":"I'm not a robot");}}
  function openRobot(){if(!robotModal||verified)return;resetChallenge();setMsg('Hold the button to charge your NITRO, then SURGE.','');document.getElementById('robot-play').hidden=false;document.getElementById('robot-win').hidden=true;robotModal.hidden=false;robotModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';setTimeout(()=>chargeBtn?.focus({preventScroll:true}),60);}
  function closeRobot(){if(!robotModal||robotModal.hidden||robotClosing)return;const ok=comboOk;const done=()=>{robotModal.classList.remove('is-closing');robotModal.hidden=true;robotModal.setAttribute('aria-hidden','true');document.body.style.overflow='';robotClosing=false;if(ok){setVerified(true);sendBtn?.focus();}else{resetChallenge();robotBtn?.focus();}};if(matchMedia('(prefers-reduced-motion: reduce)').matches)return done();robotClosing=true;robotModal.classList.add('is-closing');setTimeout(done,280);}
  robotBtn?.addEventListener('click',openRobot);
  document.getElementById('robot-modal-close')?.addEventListener('click',closeRobot);
  document.getElementById('robot-win-close')?.addEventListener('click',closeRobot);
  robotModal?.addEventListener('click',e=>{if(e.target.closest('[data-close-robot]'))closeRobot();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&robotModal&&!robotModal.hidden)closeRobot();});
  contactForm?.addEventListener('submit',async event=>{
    event.preventDefault();if(!contactForm.reportValidity())return;
    if(!verified||!comboOk){setContactStatus("CLICK « I'M NOT A ROBOT » FIRST.",'error');robotBtn?.focus();return;}
    const data=new FormData(contactForm);const name=String(data.get('name')||'').trim();const email=String(data.get('email')||'').trim();const message=String(data.get('message')||'').trim();
    const button=sendBtn||contactForm.querySelector('button[type="submit"]');
    if(location.protocol==='file:'){mailtoFallback(name,email,message);return;}
    button.disabled=true;contactForm.classList.add('is-sending');setContactStatus('SENDING…','sending');
    try{
      const res=await fetch(CONTACT_URL,{method:'POST',body:data,headers:{'Accept':'application/json'}});
      const json=await res.json().catch(()=>null);
      if(!json){mailtoFallback(name,email,message);setContactStatus('','');return;}   // function not reachable: use the mail app
      if(json.ok){contactForm.reset();if(startedField)startedField.value=String(Date.now());setContactStatus('MESSAGE SENT — THANK YOU! WE WILL REPLY SOON.','ok');}
      else if(json.error==='combo'){setContactStatus('SECURITY CHECK EXPIRED. PLEASE TRY AGAIN.','error');}
      else if(json.error==='wait'){setContactStatus('PLEASE WAIT A FEW SECONDS BEFORE SENDING ANOTHER MESSAGE.','error');}
      else if(json.error==='email'){setContactStatus('PLEASE CHECK YOUR EMAIL ADDRESS.','error');}
      else{setContactStatus('THE MESSAGE COULD NOT BE SENT. PLEASE TRY AGAIN LATER.','error');}
    }catch(_){setContactStatus('CONNECTION PROBLEM. PLEASE TRY AGAIN.','error');}
    finally{contactForm.classList.remove('is-sending');resetChallenge();if(comboField)comboField.value='';setVerified(false);loadToken();}   // a new check for the next message
  });

  // Install the same web app on desktop and mobile; the manifest opens the game directly.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  const installButton=document.getElementById('install-app');
  { const lbl=installButton?.querySelector('.install-label'); if(lbl&&matchMedia('(hover:none) and (pointer:coarse)').matches)lbl.textContent='ADD TO HOME SCREEN'; }   // phones & tablets: add the app to the home screen
  const installModal=document.getElementById('install-modal');
  const installClose=document.getElementById('install-modal-close');
  const installDescription=document.getElementById('install-description');
  const installSteps=document.getElementById('install-steps');
  let installPrompt=null;
  let installOpener=null;
  const isInstalled=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
  addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  addEventListener('appinstalled',()=>{installPrompt=null;if(installButton)installButton.hidden=true;});
  function closeInstall(){if(!installModal||installModal.hidden)return;installModal.hidden=true;installModal.setAttribute('aria-hidden','true');document.body.style.overflow='';installOpener?.focus();}
  function showInstallHelp(){
    if(!installModal)return;
    const ua=navigator.userAgent;
    const ios=/iphone|ipad|ipod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    const android=/android/i.test(ua);
    const mac=/macintosh|mac os x/i.test(ua)&&!ios;
    const safari=/safari/i.test(ua)&&!/chrome|crios|edg|android/i.test(ua);
    let description='Install Nitro Surge Fighters as an app. It will open straight into the game.';
    let steps=[];
    if(ios){description='On iPhone or iPad, add NSF to your Home Screen. iOS opens the installed app directly in the game.';steps=['Open this page in Safari.','Tap the Share button.','Choose “Add to Home Screen”, then tap “Add”.'];}
    else if(android){description='Add NSF to your Android home screen. The installed app opens directly into the game.';steps=['Open this page in Chrome.','Tap the browser menu ⋮.','Choose “Install app” or “Add to Home screen”, then confirm.'];}
    else if(mac&&safari){description='Safari on Mac can add NSF to your Dock as a web app. It opens directly into the game.';steps=['In Safari, open the File menu.','Choose “Add to Dock”.','Confirm the name, then launch NSF from the Dock.'];}
    else if(/windows/i.test(ua)){description='Install NSF as a desktop web app. It opens in its own window directly in the game.';steps=['In Chrome or Edge, use the install icon in the address bar, or open the browser menu.','Choose “Install Nitro Surge Fighters” or “Install this site as an app”.','Confirm. NSF will be available from your desktop or app launcher.'];}
    else if(mac){description='Install NSF as a desktop web app. It opens in its own window directly in the game.';steps=['In Chrome or Edge, use the install icon in the address bar, or open the browser menu.','Choose “Install Nitro Surge Fighters” or “Install this site as an app”.','Confirm. NSF will be available in your Applications folder or app launcher.'];}
    else{description='Use your browser’s install option to add NSF to this device. The installed app opens directly into the game.';steps=['Open the browser menu.','Choose “Install app” or “Add to Home Screen”.','Confirm the installation.'];}
    installDescription.textContent=description;installSteps.replaceChildren();steps.forEach(text=>{const li=document.createElement('li');li.textContent=text;installSteps.append(li);});
    installOpener=installButton;installModal.hidden=false;installModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';installClose?.focus();
  }
  installButton?.addEventListener('click',async()=>{
    if(isInstalled()){showInstallHelp();return;}
    if(installPrompt){const promptEvent=installPrompt;installPrompt=null;await promptEvent.prompt();const choice=await promptEvent.userChoice;if(choice?.outcome==='accepted'){installButton.hidden=true;return;}}
    showInstallHelp();
  });
  installClose?.addEventListener('click',closeInstall);
  installModal?.addEventListener('click',event=>{if(event.target.matches('[data-close-install]'))closeInstall();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeInstall();});

  const siteHeader=document.getElementById('site-header');
  const headerBrand=document.getElementById('header-brand');
  const headerBrandImage=headerBrand?.querySelector('img');
  const mobileMenuButton=document.getElementById('mobile-menu-toggle');
  const mobileMenu=document.getElementById('mobile-menu');
  const navLinks=[...document.querySelectorAll('.main-nav a, .mobile-menu-panel a')];
  const navSectionIds=[...new Set(navLinks.map(link=>link.getAttribute('href')?.slice(1)).filter(Boolean))];
  function setCurrentNav(id){navLinks.forEach(link=>link.classList.toggle('is-active',link.getAttribute('href')===`#${id}`));}
  function closeMobileMenu(returnFocus=false){siteHeader?.classList.remove('menu-open');document.body.classList.remove('mobile-menu-open');mobileMenuButton?.setAttribute('aria-expanded','false');mobileMenuButton?.setAttribute('aria-label','Open menu');mobileMenu?.setAttribute('aria-hidden','true');if(returnFocus)mobileMenuButton?.focus();}
  mobileMenuButton?.addEventListener('click',()=>{const opening=mobileMenuButton.getAttribute('aria-expanded')!=='true';siteHeader?.classList.toggle('menu-open',opening);document.body.classList.toggle('mobile-menu-open',opening);mobileMenuButton.setAttribute('aria-expanded',String(opening));mobileMenuButton.setAttribute('aria-label',opening?'Close menu':'Open menu');mobileMenu?.setAttribute('aria-hidden',String(!opening));});
  navLinks.forEach(link=>link.addEventListener('click',()=>{setCurrentNav(link.getAttribute('href').slice(1));closeMobileMenu();}));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobileMenuButton?.getAttribute('aria-expanded')==='true')closeMobileMenu(true);});
  let activeNavRaf=0;
  function updateCurrentNav(){activeNavRaf=0;const threshold=innerHeight*.42;let current='top',best=-Infinity;for(const id of navSectionIds){if(id==='top')continue;const section=document.getElementById(id);if(!section)continue;const rect=section.getBoundingClientRect();if(rect.top<=threshold&&rect.bottom>76&&rect.top>best){best=rect.top;current=id;}}setCurrentNav(current);}   // #top is <main> (the whole page): it only wins when no menu section has reached the upper part of the screen
  function scheduleCurrentNav(){if(!activeNavRaf)activeNavRaf=requestAnimationFrame(updateCurrentNav);}
  addEventListener('scroll',scheduleCurrentNav,{passive:true});addEventListener('resize',scheduleCurrentNav);updateCurrentNav();
  const heroLogo=document.querySelector('.hero-logo');
  const hero=document.querySelector('.hero');
  let heroIntroSettled=false;
  heroLogo?.addEventListener('animationend',event=>{if(event.animationName!=='hero-logo-appear')return;heroIntroSettled=true;heroLogo.style.opacity='1';heroLogo.style.transform='scale(1)';heroLogo.style.animation='hero-logo-pulse 3.2s ease-in-out infinite';},{once:true});
  let logoRaf=0;
  let heroLogoDocumentCenter=null;
  let heroLogoDocumentCenterX=null;
  let heroLogoBaseWidth=0;
  function updateLogoFlight(){
    logoRaf=0;
    if(!siteHeader||!headerBrandImage||!heroLogo||!hero)return;
    const headerBox=siteHeader.getBoundingClientRect();
    const destinationTop=parseFloat(getComputedStyle(headerBrand).top)||0;
    const logoBox=heroLogo.getBoundingClientRect();
    if(heroLogoDocumentCenter===null){heroLogoDocumentCenter=logoBox.top+scrollY+logoBox.height/2;heroLogoDocumentCenterX=logoBox.left+scrollX+logoBox.width/2;heroLogoBaseWidth=heroLogo.offsetWidth;}
    const targetWidth=headerBrandImage.offsetWidth||headerBrand.offsetWidth||160;
    const progress=Math.max(0,Math.min(1,scrollY/Math.max(1,hero.offsetHeight*.48)));
    const isMobileLogo=matchMedia('(max-width:700px)').matches;
    if(isMobileLogo){   // mobile: no logo flight (laggy on iPhone) - the big logo fades out, the header logo fades in already in place
      const bigOpacity=Math.max(0,1-progress/.6),hideBig=progress>0,docked=progress>.62;   // big logo follows the scroll: slowly fades out going down, back in going up
      if(hideBig&&!heroIntroSettled){heroIntroSettled=true;heroLogo.style.animation='none';heroLogo.style.opacity='1';heroLogo.style.transform='scale(1)';}
      ['--logo-flight-x','--logo-flight-y'].forEach(k=>headerBrand.style.setProperty(k,'0px'));headerBrand.style.setProperty('--logo-flight-scale','1');
      heroLogo.style.removeProperty('transform');if(heroIntroSettled)heroLogo.style.transform='scale(1)';
      if(hideBig||heroIntroSettled)heroLogo.style.setProperty('opacity',bigOpacity.toFixed(3),'important');else heroLogo.style.removeProperty('opacity');   // back at the very top: stays at 1 (its base CSS opacity is 0 for the intro)
      heroLogo.classList.toggle('m-logo-hidden',bigOpacity<=0);
      const tapHint=hero.querySelector('.hero-tap-hint');if(tapHint)tapHint.style.opacity=bigOpacity.toFixed(3);   // TAP TO PIXELATE fades with the big logo
      headerBrand.classList.add('m-logo-fade');headerBrand.classList.toggle('m-logo-shown',docked);
      siteHeader.classList.toggle('is-scrolled',docked);mobileMenuButton?.classList.toggle('is-scrolled',docked);
      return;
    }
    heroLogo.classList.remove('m-logo-hidden');headerBrand.classList.remove('m-logo-fade','m-logo-shown');
    const sourceDelta=heroLogoDocumentCenter-scrollY-(headerBox.top+destinationTop);
    const targetCenterX=isMobileLogo?(parseFloat(getComputedStyle(headerBrand).left)||16)+headerBrand.offsetWidth/2:innerWidth/2;
    const sourceDeltaX=isMobileLogo?heroLogoDocumentCenterX-targetCenterX:0;
    const sourceScale=heroLogoBaseWidth/targetWidth;
    headerBrand.style.setProperty('--logo-flight-x',`${sourceDeltaX*(1-progress)}px`);
    headerBrand.style.setProperty('--logo-flight-y',`${sourceDelta*(1-progress)}px`);
    headerBrand.style.setProperty('--logo-flight-scale',String(1+(sourceScale-1)*(1-progress)));
    headerBrand.style.setProperty('--logo-flight-opacity',String(progress));
    headerBrand.style.pointerEvents=progress>.5?'':'none';   // the invisible header logo must not catch the mouse over the banner
    if(progress>0){if(!heroIntroSettled){heroIntroSettled=true;heroLogo.style.animation='none';}heroLogo.style.setProperty('opacity',String(1-progress),'important');heroLogo.style.setProperty('transform',`translate(${ -sourceDeltaX*progress }px,${ -sourceDelta*progress }px) scale(${1+(1/sourceScale-1)*progress})`,'important');}else if(heroIntroSettled){heroLogo.style.removeProperty('opacity');heroLogo.style.removeProperty('transform');heroLogo.style.opacity='1';heroLogo.style.transform='scale(1)';heroLogo.style.animation='hero-logo-pulse 3.2s ease-in-out infinite';}else{heroLogo.style.removeProperty('opacity');heroLogo.style.removeProperty('transform');heroLogo.style.removeProperty('animation');}
    siteHeader.classList.toggle('is-scrolled',progress>.62);
    mobileMenuButton?.classList.toggle('is-scrolled',progress>.62);
  }
  function scheduleLogoFlight(){if(!logoRaf)logoRaf=requestAnimationFrame(updateLogoFlight);}
  addEventListener('scroll',scheduleLogoFlight,{passive:true});
  addEventListener('resize',()=>{heroLogoDocumentCenter=null;heroLogoDocumentCenterX=null;scheduleLogoFlight();});
  updateLogoFlight();
})();
