/* ===== مكتبة الأفلام والمسلسلات (VOD): شبكة ملصقات بشارة تقييم =====
   • تعرض الأفلام والمسلسلات من روابطها المخصصة فقط (detectKind)، ولا تعرض البث المباشر.
   • المسلسلات تُجمَّع بالمواسم والحلقات من أسماء مثل S01E02 أو «الموسم 1 الحلقة 2».
   • الأداء: لا صفوف أفقية متعددة ولا صورة كبيرة تتبدل مع كل ضغطة؛ الشبكة تُرسم على دفعات (60 بطاقة)،
     والصور تُحمَّل عند الاقتراب من الشاشة فقط، والتحديد يلمس عنصرين فقط في كل ضغطة (بلا إعادة رسم).
   التنقل: ← → ↑ ↓ داخل الشبكة · ↑ من الصف الأول: شريط التصفية · OK فتح · رجوع خطوة للخلف. */
(function(){
  const el=$('vod'),bodyEl=$('vodb'),barEl=$('vbar'),B=document.body,infoT=$('vit'),infoS=$('vis'),pickEl=$('vpick');
  const STEP=60;
  let srcId='',on=false,idx=null,idxSig='',all=[],view=[],gi=0,rendered=0,cols=1,grid=null,io=null;
  let filter='all',cat='',sort='recent',q='',zone='grid',bi=0,barItems=[];
  let screen='home',cur=null,curEps=[],sIdx=0,eIdx=0,playing=null,lastLive=null,saved=null;
  let pickOn=false,pickRows=[],pi=0,pickKind='';
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const toast=t=>{if(window.__rcvToast)window.__rcvToast(t)};
  const coll=(typeof Intl!=='undefined'&&Intl.Collator)?new Intl.Collator('ar'):null;
  window.__vodOn=()=>on;

  /* ---------- التحليل والتصنيف ---------- */
  const EP1=/^(.*?)[\s._-]*[sS](\d{1,2})[\s._-]*[eE](\d{1,3})/;
  const EP2=/^(.*?)\s*(?:الموسم|موسم|season)\s*(\d+)\s*(?:الحلقة|حلقة|episode|ep)\s*(\d+)/i;
  const EP3=/^(.*?)\s*(?:الحلقة|حلقة|episode|ep)\s*[:.-]?\s*(\d+)/i;
  function epInfo(name){
    let m=EP1.exec(name);if(m)return{title:m[1].trim(),s:+m[2],e:+m[3]};
    m=EP2.exec(name);if(m)return{title:m[1].trim(),s:+m[2],e:+m[3]};
    m=EP3.exec(name);if(m)return{title:m[1].trim(),s:1,e:+m[2]};
    return null;
  }
  function libKind(it){const k=detectKind(it);return(k==='movie'||k==='series')?k:null}
  function rateOf(it){
    const m=it&&it.raw&&/tvg-rating="([^"]*)"/.exec(it.raw);if(!m)return null;
    const r=parseFloat(m[1]);return r>0&&r<=10?r:null;
  }
  const sig=()=>lists.filter(l=>l.id!==FAV_LIST_ID).map(l=>l.id+':'+(l.upd||0)+':'+(l.n||0)).join('|');
  const tick=()=>new Promise(r=>setTimeout(r,0));

  async function build(){
    const s=sig()+'|'+srcId;if(idx&&s===idxSig)return;
    const movies=[],series=new Map();let ord=0;
    for(const l of lists){
      if(l.id===FAV_LIST_ID||l.id==='builtin')continue;
      if(srcId&&l.id!==srcId)continue;
      const its=parseM3U(l.text);
      for(let i=0;i<its.length;i++){
        const it=its[i],k=libKind(it);
        if(k!=='movie'&&k!=='series')continue;
        if(k==='series'&&/action=get_series_info/.test(it.url)){
          series.set('xt:'+it.url,{kind:'series',title:it.name,logo:it.logo||'',group:it.group||'مسلسلات',rating:rateOf(it),eps:[],lazy:it.url,ord:ord++});
        }else if(k==='series'){
          const ei=epInfo(it.name)||{title:it.name,s:1,e:1};
          const t=(ei.title||it.name).replace(/[._]+/g,' ').trim(),key=t.toLowerCase();
          let sr=series.get(key);
          if(!sr){sr={kind:'series',title:t,logo:it.logo||'',group:it.group||'مسلسلات',rating:rateOf(it),eps:[],ord:ord++};series.set(key,sr)}
          if(!sr.logo&&it.logo)sr.logo=it.logo;
          sr.eps.push({s:ei.s,e:ei.e,name:it.name,url:it.url,item:it});
        }else movies.push({kind:'movie',title:it.name,logo:it.logo||'',group:it.group||'أفلام',rating:rateOf(it),item:it,ord:ord++});
        if(i%1500===1499)await tick();
      }
      await tick();
    }
    series.forEach(sr=>sr.eps.sort((a,b)=>a.s-b.s||a.e-b.e));
    idx={movies,series:[...series.values()]};idxSig=s;
    all=movies.concat(idx.series);
  }

  /* ---------- التصفية والترتيب ---------- */
  function groupsOf(){
    const m=new Map();
    all.forEach(c=>{if(filter==='movies'&&c.kind!=='movie')return;if(filter==='series'&&c.kind!=='series')return;const g=c.group||'أخرى';m.set(g,(m.get(g)||0)+1)});
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }
  function makeView(){
    const ql=q.trim().toLowerCase();
    let a=all.filter(c=>(filter==='all'||(filter==='movies'?c.kind==='movie':c.kind==='series'))&&(!cat||(c.group||'أخرى')===cat)&&(!ql||c.title.toLowerCase().includes(ql)));
    if(sort==='az')a.sort(coll?(x,y)=>coll.compare(x.title,y.title):(x,y)=>x.title<y.title?-1:1);
    else if(sort==='rating')a.sort((x,y)=>(y.rating||0)-(x.rating||0)||y.ord-x.ord);
    else a.sort((x,y)=>y.ord-x.ord);                      // الأحدث إضافةً أولاً (آخر المصدر)
    view=a;gi=0;
  }
  const SORTS={recent:'الأحدث',az:'أ ← ي',rating:'الأعلى تقييماً'};
  function paintBar(){
    barItems=[
      {k:'f',v:'all',l:'الكل'},{k:'f',v:'movies',l:'🎬 أفلام'},{k:'f',v:'series',l:'🎞 مسلسلات'},{dv:1},
      {k:'cat',l:'🗂 '+(cat||'كل التصنيفات')+' ▾'},{k:'sort',l:'⇅ '+SORTS[sort]},
      {k:'q',l:q?'🔍 «'+q+'» ✕':'🔍 بحث'}
    ];
    barEl.textContent='';
    barItems.forEach((b,i)=>{
      const d=document.createElement('span');d.dataset.i=i;
      if(b.dv){d.className='vt dv';barEl.appendChild(d);return}
      d.className='vt'+((b.k==='f'&&filter===b.v)?' on':'')+(zone==='bar'&&bi===i?' sel':'');
      d.textContent=b.l;barEl.appendChild(d);
    });
  }
  function markBar(){
    [...barEl.children].forEach((d,i)=>d.classList.toggle('sel',zone==='bar'&&bi===i));
    const s=barEl.querySelector('.sel');if(s)s.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function barAct(i){
    const b=barItems[i];if(!b||b.dv)return;
    if(b.k==='f'){filter=b.v;cat='';refresh()}
    else if(b.k==='cat')openPick('cat');
    else if(b.k==='sort')openPick('sort');
    else if(b.k==='q'){
      if(q){q='';refresh();return}
      if(!window.kbPrompt)return;
      kbPrompt('بحث في المكتبة','').then(v=>{if(v!==null){q=v.trim();refresh()}});
    }
  }

  /* ---------- الرسم (الشبكة) ---------- */
  function ensureIO(){
    if(io||!('IntersectionObserver' in window))return;
    io=new IntersectionObserver(es=>{es.forEach(e=>{if(!e.isIntersecting)return;const im=e.target;io.unobserve(im);loadImg(im)})},{root:bodyEl,rootMargin:'500px 0px'});
  }
  function loadImg(im){
    const u=im.dataset.s;if(!u)return;im.dataset.s='';
    im.decoding='async';
    im.onload=()=>im.classList.add('ld');
    im.onerror=()=>{const c=im.closest('.vc');im.remove();if(c)c.classList.add('noimg')};
    im.src=u;
  }
  function cardEl(c,i){
    const d=document.createElement('div');d.className='vc';d.dataset.i=i;
    const p=document.createElement('div');p.className='vp';p.dataset.i=((c.title||'?').trim()[0])||'?';
    if(c.logo){
      const im=document.createElement('img');im.alt='';im.dataset.s=c.logo;p.appendChild(im);
      if(io)io.observe(im);else loadImg(im);
    }else d.classList.add('noimg');
    if(c.rating){const r=document.createElement('span');r.className='vr';r.textContent=c.rating.toFixed(1);p.appendChild(r)}
    if(c.kind==='series'){const k=document.createElement('span');k.className='vk';k.textContent='مسلسل';p.appendChild(k)}
    const n=document.createElement('div');n.className='vn';n.textContent=c.title;
    d.append(p,n);return d;
  }
  function renderMore(to){
    if(!grid)return;
    const end=Math.min(view.length,Math.max(to,rendered+STEP)),fr=document.createDocumentFragment();
    for(let i=rendered;i<end;i++)fr.appendChild(cardEl(view[i],i));
    const more=grid.querySelector('.vmore');if(more)more.remove();
    grid.appendChild(fr);rendered=end;
    if(rendered<view.length){const m=document.createElement('div');m.className='vmore';m.textContent='…';grid.appendChild(m)}
    calcCols();
  }
  function calcCols(){
    try{const n=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(x=>x&&x!=='none').length;cols=Math.max(1,n)}catch(e){cols=1}
  }
  function msgBody(t){
    bodyEl.textContent='';grid=null;
    const d=document.createElement('div');d.className='vempty';d.textContent=t;bodyEl.appendChild(d);
  }
  function paintHome(keepScroll){
    screen='home';paintBar();
    $('vcount').textContent=view.length+' عنصر';
    $('vhint').textContent='↑ ↓ ← → تنقل · OK فتح · رجوع';
    if(!all.length){msgBody('لا توجد أفلام أو مسلسلات في مصادرك بعد.\nأضف مصدراً فيه مكتبة (ملف أو رابط أو Xtream أو Stalker) من الإعدادات ← المصادر ← إضافة مصدر، وستظهر هنا تلقائياً.');infoT.textContent='';infoS.textContent='';return}
    if(!view.length){msgBody('لا نتائج مطابقة.\nغيّر التصنيف أو امسح البحث.');infoT.textContent='';infoS.textContent='';return}
    bodyEl.textContent='';
    if(io){io.disconnect()}
    ensureIO();
    grid=document.createElement('div');grid.className='vgrid';bodyEl.appendChild(grid);
    rendered=0;renderMore(Math.max(STEP,gi+cols*3));
    if(!keepScroll)bodyEl.scrollTop=0;
    markSel();
  }
  function refresh(){makeView();zone=view.length?'grid':'bar';paintHome()}

  function markSel(){
    if(!grid){markBar();return}
    const old=grid.querySelector('.vc.sel');if(old)old.classList.remove('sel');
    if(zone!=='grid'){markBar();updateInfo();return}
    const c=grid.children[gi];
    if(c&&c.classList.contains('vc')){c.classList.add('sel');keepVisible(c)}
    markBar();updateInfo();
  }
  function keepVisible(c){
    const pad=26,top=c.offsetTop,h=c.offsetHeight,st=bodyEl.scrollTop,ch=bodyEl.clientHeight;
    if(top-pad<st)bodyEl.scrollTop=Math.max(0,top-pad);
    else if(top+h+pad>st+ch)bodyEl.scrollTop=top+h+pad-ch;
  }
  function updateInfo(){
    const c=(zone==='grid')?view[gi]:null;
    if(!c){infoT.textContent=view.length?'':'';infoS.textContent='';return}
    infoT.textContent=c.title;
    infoS.textContent=(c.kind==='series'?'مسلسل'+(c.eps.length?' · '+c.eps.length+' حلقة':''):'فيلم')+(c.group?' · '+c.group:'')+(c.rating?' · ★ '+c.rating.toFixed(1):'');
  }

  /* ---------- منتقي التصنيف / الترتيب ---------- */
  function openPick(kind){
    pickKind=kind;pickOn=true;pickRows=[];
    if(kind==='sort'){
      $('vpt').textContent='ترتيب العرض';
      Object.keys(SORTS).forEach(k=>pickRows.push({v:k,l:SORTS[k],cur:sort===k}));
    }else{
      $('vpt').textContent='التصنيف';
      pickRows.push({v:'',l:'كل التصنيفات',n:all.filter(c=>filter==='all'||(filter==='movies'?c.kind==='movie':c.kind==='series')).length,cur:!cat});
      groupsOf().slice(0,500).forEach(([g,n])=>pickRows.push({v:g,l:g,n,cur:cat===g}));
    }
    pi=Math.max(0,pickRows.findIndex(r=>r.cur));
    const L=$('vpl');L.textContent='';
    pickRows.forEach((r,i)=>{
      const d=document.createElement('div');d.className='vpi'+(r.cur?' cur':'');d.dataset.i=i;
      const s=document.createElement('span');s.textContent=r.l;d.appendChild(s);
      if(r.n!==undefined){const e=document.createElement('em');e.textContent=r.n;d.appendChild(e)}
      L.appendChild(d);
    });
    pickEl.classList.add('on');markPick();
  }
  function markPick(){
    const L=$('vpl');[...L.children].forEach((d,i)=>d.classList.toggle('sel',i===pi));
    const s=L.children[pi];if(s)s.scrollIntoView({block:'nearest'});
  }
  function closePick(){pickOn=false;pickEl.classList.remove('on')}
  function pickDo(){
    const r=pickRows[pi];if(!r)return;closePick();
    if(pickKind==='sort'){sort=r.v}else cat=r.v;
    refresh();
  }
  pickEl.addEventListener('click',e=>{
    const d=e.target.closest('.vpi');
    if(d){pi=+d.dataset.i;pickDo();return}
    if(e.target===pickEl)closePick();
  });

  /* ---------- أحداث النقر (فأرة/لمس) ---------- */
  bodyEl.addEventListener('click',e=>{
    if(screen!=='home')return;
    const c=e.target.closest('.vc');if(!c)return;
    gi=+c.dataset.i;zone='grid';markSel();activate(view[gi]);
  });
  barEl.addEventListener('click',e=>{const d=e.target.closest('.vt');if(!d||d.classList.contains('dv'))return;bi=+d.dataset.i;zone='bar';markBar();barAct(bi)});
  bodyEl.addEventListener('scroll',()=>{
    if(screen!=='home'||!grid||rendered>=view.length)return;
    if(bodyEl.scrollTop+bodyEl.clientHeight>bodyEl.scrollHeight-bodyEl.clientHeight*1.5)renderMore(rendered+STEP);
  },{passive:true});
  window.addEventListener('resize',()=>{if(on&&grid)calcCols()});

  /* ---------- حلقات مسلسلات Xtream: تُحمَّل عند الفتح فقط ---------- */
  async function loadLazy(c){
    toast('جارٍ تحميل الحلقات…');
    try{
      const r=await fetch(c.lazy);if(!r.ok)return false;
      const j=await r.json(),u=new URL(c.lazy),base=u.origin,usr=u.searchParams.get('username'),pw=u.searchParams.get('password');
      const eps=[],E=j&&j.episodes;
      const add=(e,season)=>{
        if(!e||!e.id)return;
        const url=base+'/series/'+usr+'/'+pw+'/'+e.id+'.'+(e.container_extension||'mp4');
        const title=e.title||('الحلقة '+(e.episode_num||''));
        eps.push({s:+(e.season||season)||1,e:+e.episode_num||eps.length+1,name:title,url,item:{name:title,url,logo:c.logo,group:c.group,raw:'',extra:[]}});
      };
      if(Array.isArray(E))E.forEach(a=>Array.isArray(a)?a.forEach(e=>add(e,0)):add(a,0));
      else if(E&&typeof E==='object')Object.keys(E).forEach(sk=>{if(Array.isArray(E[sk]))E[sk].forEach(e=>add(e,+sk))});
      if(!eps.length)return false;
      eps.sort((a,b)=>a.s-b.s||a.e-b.e);c.eps=eps;return true;
    }catch(e){return false}
  }
  function openSeries(c){saved={gi,sc:bodyEl.scrollTop};cur=c;sIdx=0;eIdx=0;zone='eps';paintSeries()}
  function activate(c){
    if(!c)return;
    if(c.kind==='series'&&c.lazy&&!c.eps.length){
      loadLazy(c).then(ok=>{if(ok&&on)openSeries(c);else if(!ok)toast('تعذّر تحميل حلقات هذا المسلسل')});
      return;
    }
    if(c.kind==='series')openSeries(c);
    else playItem(c.item,null,0);
  }

  /* ---------- شاشة المسلسل ---------- */
  function paintSeries(){
    screen='series';bodyEl.textContent='';grid=null;
    $('vhint').textContent='↑ ↓ حلقات · ← → مواسم · OK تشغيل · رجوع';
    infoT.textContent=cur.title;infoS.textContent='';
    const seasons=[...new Set(cur.eps.map(e=>e.s))].sort((a,b)=>a-b);
    if(sIdx>=seasons.length)sIdx=0;
    const head=document.createElement('div');head.className='vser';
    if(cur.logo){const im=document.createElement('img');im.alt='';im.src=cur.logo;im.onerror=()=>im.remove();head.appendChild(im)}
    const tx=document.createElement('div');const t=document.createElement('b'),m=document.createElement('small');
    t.textContent=cur.title;m.textContent='مسلسل · '+cur.eps.length+' حلقة'+(cur.group?' · '+cur.group:'')+(cur.rating?' · ★ '+cur.rating.toFixed(1):'');
    tx.append(t,m);head.appendChild(tx);
    const bar=document.createElement('div');bar.className='vseas';
    seasons.forEach((s,i)=>{
      const b=document.createElement('span');b.className='vs'+(i===sIdx?' on':'')+(zone==='seasons'&&i===sIdx?' sel':'');
      b.textContent='الموسم '+s;b.onclick=()=>{sIdx=i;eIdx=0;zone='eps';paintSeries()};
      bar.appendChild(b);
    });
    const list=document.createElement('div');list.className='veps';
    curEps=cur.eps.filter(e=>e.s===seasons[sIdx]);
    curEps.forEach((e,i)=>{
      const r=document.createElement('div');r.className='ve'+(zone==='eps'&&i===eIdx?' sel':'');
      r.innerHTML='<span class="n"></span><span class="t"></span>';
      r.children[0].textContent='الحلقة '+e.e;r.children[1].textContent=e.name;
      r.onclick=()=>{eIdx=i;zone='eps';playItem(e.item,curEps,i)};
      list.appendChild(r);
    });
    bodyEl.append(head,bar,list);
    const s=list.querySelector('.sel');if(s)s.scrollIntoView({block:'nearest'});
  }
  function seriesKey(k){
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    const nSeasons=bodyEl.querySelectorAll('.vs').length;
    if(k===fwd&&sIdx<nSeasons-1){sIdx++;eIdx=0;paintSeries();return}
    if(k===bwd&&sIdx>0){sIdx--;eIdx=0;paintSeries();return}
    if(zone==='seasons'){
      if(k==='ArrowDown'||k==='Enter'){zone='eps';paintSeries()}
    }else{
      if(k==='ArrowUp'){if(eIdx>0)eIdx--;else zone='seasons';paintSeries()}
      else if(k==='ArrowDown'){eIdx=Math.min(curEps.length-1,eIdx+1);paintSeries()}
      else if(k==='Enter'){const e=curEps[eIdx];if(e)playItem(e.item,curEps,eIdx)}
    }
  }
  function leaveSeries(){
    zone='grid';
    paintHome(true);
    if(saved){gi=Math.min(saved.gi,Math.max(0,view.length-1));renderMore(gi+cols*2);bodyEl.scrollTop=saved.sc;markSel()}
  }

  /* ---------- لوحة المفاتيح: الشبكة ---------- */
  function homeKey(k){
    if(pickOn){
      if(k==='ArrowDown')pi=Math.min(pickRows.length-1,pi+1);
      else if(k==='ArrowUp')pi=Math.max(0,pi-1);
      else if(k==='PageDown')pi=Math.min(pickRows.length-1,pi+6);
      else if(k==='PageUp')pi=Math.max(0,pi-6);
      else if(k==='Enter'){pickDo();return}
      else if(k==='Escape'||k==='Backspace'){closePick();return}
      markPick();return;
    }
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    if(zone==='bar'){
      const n=barItems.length;
      if(k===fwd){let i=bi+1;while(i<n&&barItems[i].dv)i++;if(i<n)bi=i}
      else if(k===bwd){let i=bi-1;while(i>=0&&barItems[i].dv)i--;if(i>=0)bi=i}
      else if(k==='ArrowDown'&&view.length){zone='grid'}
      else if(k==='Enter'){barAct(bi);return}
      markSel();return;
    }
    if(!view.length){if(k==='ArrowUp'){zone='bar'}markSel();return}
    const last=view.length-1;let n=gi;
    if(k===fwd)n=Math.min(last,gi+1);
    else if(k===bwd)n=Math.max(0,gi-1);
    else if(k==='ArrowDown')n=Math.min(last,gi+cols);
    else if(k==='ArrowUp'){if(gi<cols){zone='bar';markSel();return}n=gi-cols}
    else if(k==='PageDown')n=Math.min(last,gi+cols*3);
    else if(k==='PageUp')n=Math.max(0,gi-cols*3);
    else if(k==='Home')n=0;
    else if(k==='End')n=last;
    else if(k==='Enter'){activate(view[gi]);return}
    else return;
    gi=n;
    if(gi>=rendered-cols*2&&rendered<view.length)renderMore(gi+cols*3);
    markSel();
  }

  /* ---------- التشغيل ---------- */
  const fmt=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
  function playItem(it,eps,i){
    playing=eps?{eps,i}:null;
    B.classList.add('cine-play');
    play(it);
  }
  function stopPlay(){tok++;stopAll();B.classList.remove('cine-play');playing=null}
  function seek(sec){
    const v=$('v');
    if(!isFinite(v.duration)||!v.duration){toast('لا يمكن التقديم في هذا المحتوى');return}
    v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+sec));
    toast(fmt(v.currentTime)+' / '+fmt(v.duration));
  }
  function playKey(k){
    const v=$('v');
    if(k==='Enter'){if(v.paused)v.play();else v.pause();toast(v.paused?'⏸ متوقف':'▶ تشغيل')}
    else if(k==='ArrowRight'||k==='ArrowLeft')seek(k==='ArrowRight'?10:-10);
    else if(k==='ArrowUp'||k==='ArrowDown')seek(k==='ArrowUp'?60:-60);
    else if((k==='PageDown'||k==='PageUp')&&playing){
      const n=playing.i+(k==='PageDown'?1:-1);
      if(n>=0&&n<playing.eps.length){playing.i=n;eIdx=n;play(playing.eps[n].item)}
    }
  }
  $('v').addEventListener('ended',()=>{
    if(!on||!B.classList.contains('cine-play')||!playing)return;
    const n=playing.i+1;
    if(n<playing.eps.length){playing.i=n;eIdx=n;play(playing.eps[n].item)}
  });

  /* ---------- فتح وإغلاق ---------- */
  function open(){
    if(on)return;
    on=true;
    lastLive=shown.find(i=>i.url===curUrl)||null;
    tok++;stopAll();
    el.classList.add('on');B.classList.add('vod');
    zone='grid';screen='home';pickOn=false;pickEl.classList.remove('on');
    $('vsrc').textContent=srcId?((lists.find(l=>l.id===srcId)||{}).name||''):'';
    barEl.textContent='';$('vcount').textContent='';infoT.textContent='';infoS.textContent='';
    msgBody('جارٍ تحليل المكتبة…');
    build().then(()=>{if(!on)return;filter='all';cat='';q='';sort='recent';bi=0;makeView();zone='grid';paintHome()}).catch(()=>msgBody('تعذّر تحليل المكتبة'));
  }
  function close(){
    on=false;el.classList.remove('on');B.classList.remove('vod');B.classList.remove('cine-play');
    if(io){io.disconnect()}grid=null;
    if(lastLive){const it=lastLive;lastLive=null;play(it)}
  }
  window.__openVod=function(id){srcId=(typeof id==='string')?id:'';open()};
  window.__vodBack=function(){
    if(!on)return false;
    if(B.classList.contains('cine-play')){stopPlay();return true}
    if(pickOn){closePick();return true}
    if(screen==='series'){leaveSeries();return true}
    close();return true;
  };
  document.addEventListener('keydown',e=>{
    if(!on||document.querySelector('dialog[open]'))return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    e.preventDefault();e.stopPropagation();
    const k=/^(OK|Select)$/.test(e.key)?'Enter':e.key;
    if(B.classList.contains('cine-play')){playKey(k);return}
    if(screen==='series'){
      if(k==='Escape'||k==='Backspace'){leaveSeries();return}
      seriesKey(k);return;
    }
    if(!pickOn&&(k==='Escape'||k==='Backspace')){close();return}
    homeKey(k);
  },true);
})();
