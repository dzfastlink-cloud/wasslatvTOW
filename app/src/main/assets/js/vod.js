/* ===== مكتبة الأفلام والمسلسلات (VOD): وضع مستقل بمعزل عن البث المباشر =====
   • تعرض الأفلام والمسلسلات من روابطها المخصصة فقط (detectKind)، ولا تعرض البث المباشر.
   • المسلسلات تُجمَّع بالمواسم والحلقات من أسماء مثل S01E02 أو «الموسم 1 الحلقة 2».
   • أي مصدر جديد فيه أفلام يظهر هنا تلقائياً (إضافة مكتبات لاحقاً = إضافة مصدر).
   التنقل: ↑ ↓ بين الصفوف · ← → داخل الصف · OK فتح · رجوع خطوة للخلف. */
(function(){
  const el=$('vod'),bodyEl=$('vodb'),tabsEl=$('vtabs'),B=document.body;
  const playerHost=$('player').parentElement;
  const Remote=window.WasslaVodRemote;
  let srcId='',query='',on=false,idx=null,idxSig='',filter='all',view=[],gi=0,cat='',rendered=0,gcols=1,gridEl=null,io=null,zone='rows',tIdx=0,scroller=null,sideEl=null,sideIdx=0,sideItems=[],sort='recent';
  let desktopShelves=new Map(),desktopRows=[],renderedDesktop=false,stopArmedAt=0;
  let screen='home',detailReturn='home',detailOrigin='home',cur=null,curEps=[],sIdx=0,eIdx=0,playing=null,lastLive=null,playerBackground='home',playerScrollTop=0;
  let nextTimer=null,nextCard=null,nextEpisode=null,progressTimer=null,trackHideTimer=null,detailScrollTop=0,detailRowScroll=[],detailIndex=0,detailToken=0,detailController=null,playerFromDetails=false,playerDetailOrigin='home',trailerFocus=null;
  const detailCache=new Map();
  const CHUNK=60;
  const Model=window.WasslaVodModel;
  const progress=()=>LS.get('m3u_vod_progress',{});
  const watched=()=>LS.get('m3u_vod_watched',{});
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const desktopLayout=()=>!!(window.matchMedia&&window.matchMedia('(min-width:1200px) and (hover:hover) and (pointer:fine)').matches)&&!B.classList.contains('tv')&&!B.classList.contains('rcv');
  const toast=t=>{if(window.__rcvToast)window.__rcvToast(t)};
  const Metadata=window.WasslaVodMetadata;
  const densityOptions=['compact','balanced','comfortable'];
  const titleSizeOptions=['small','medium','large'];
  function applyLibraryAppearance(){
    if(!el)return;
    const density=LS.get('m3u_vod_density','balanced');
    const titleSize=LS.get('m3u_vod_title_size','medium');
    el.dataset.density=densityOptions.includes(density)?density:'balanced';
    el.dataset.titleSize=titleSizeOptions.includes(titleSize)?titleSize:'medium';
  }
  window.__applyVodAppearance=applyLibraryAppearance;
  applyLibraryAppearance();
  window.__vodOn=()=>on;
  let heroCard=null;

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
  function detailKey(k){
    const buttons=[...bodyEl.querySelectorAll('.vdetails button')].filter(button=>!button.disabled&&button.getClientRects().length);
    if(!buttons.length)return;
    const isRtl=getComputedStyle(document.documentElement).direction==='rtl';
    const step=Remote?Remote.detailStep(k,isRtl):0;
    if(step>0)detailIndex=Math.min(buttons.length-1,detailIndex+1);
    else if(step<0)detailIndex=Math.max(0,detailIndex-1);
    else if(k==='Enter'){buttons[detailIndex].click();return}
    buttons.forEach((button,i)=>button.classList.toggle('sel',i===detailIndex));
    buttons[detailIndex].focus({preventScroll:true});
    buttons[detailIndex].scrollIntoView({block:'nearest'});
  }
  /* المكتبة تعتمد على التصنيف المشترك detectKind (يعتمد على نوع الرابط): الأفلام والمسلسلات فقط،
     أما /live/ والبث المباشر والقوائم المدمجة فلا تدخل المكتبة أبداً. */
  function libKind(it){const k=detectKind(it);return(k==='movie'||k==='series')?k:null}
  const sig=()=>lists.filter(l=>l.id!==FAV_LIST_ID).map(l=>l.id+':'+(l.upd||0)+':'+(l.n||0)).join('|');
  const tick=()=>new Promise(r=>setTimeout(r,0));
  /* عنوان للعرض فقط (لا يمس البحث ولا التخزين): يزيل رموز المصدر والجودة ويوحّد المسافات */
  function niceTitle(t){
    const raw=String(t||'');
    let s=raw.replace(/[._]+/g,' ');
    s=s.replace(/^\s*(?:[\[\(]\s*[A-Za-z]{2,4}\s*[\]\)]|[A-Za-z]{2,4}\s*[|｜])\s*/,'');
    s=s.replace(/[\s\[\(]*\b(?:4K|UHD|FHD|HD|SD|2160p|1080p|720p|480p|WEB-?DL|WEB-?Rip|Blu-?Ray|BRRip|HDRip|HDTV|x264|x265|HEVC)\b[\s\]\)]*/gi,' ');
    s=s.replace(/\s{2,}/g,' ').replace(/^[\s\-|:]+|[\s\-|:]+$/g,'');
    return s||raw.trim();
  }

  async function build(){
    const s=sig();if(idx&&s===idxSig)return;
    const movies=[],series=new Map();
    for(const l of lists){
      if(l.id===FAV_LIST_ID||l.id==='builtin')continue;
      const its=parseM3U(l.text);
      for(let i=0;i<its.length;i++){
        const it=its[i],k=libKind(it);
        if(k!=='movie'&&k!=='series')continue;
        if(k==='series'&&/action=get_series_info/.test(it.url)){
          series.set('xt:'+it.url,{kind:'series',title:it.name,logo:it.logo||'',group:it.group||'مسلسلات',eps:[],lazy:it.url,sourceId:l.id,sourceName:l.name});
        }else if(k==='series'){
          const ei=epInfo(it.name)||{title:it.name,s:1,e:1};
          const t=(ei.title||it.name).replace(/[._]+/g,' ').trim(),key=t.toLowerCase();
          const seriesKey=l.id+':'+key;
          let sr=series.get(seriesKey);
          if(!sr){sr={kind:'series',title:t,logo:it.logo||'',group:it.group||'مسلسلات',eps:[],sourceId:l.id,sourceName:l.name};series.set(l.id+':'+key,sr)}
          if(!sr.logo&&it.logo)sr.logo=it.logo;
          sr.eps.push({s:ei.s,e:ei.e,name:it.name,url:it.url,item:it,sourceId:l.id});
        }else movies.push({kind:'movie',title:it.name,logo:it.logo||'',group:it.group||'أفلام',item:it,sourceId:l.id,sourceName:l.name});
        if(i%1500===1499)await tick();
      }
      await tick();
    }
    series.forEach(sr=>sr.eps.sort((a,b)=>a.s-b.s||a.e-b.e));
    idx={movies,series:[...series.values()]};idxSig=s;
  }
  function ratingOf(c){
    if(c.rating!==undefined)return c.rating;
    const raw=c.kind==='movie'&&c.item&&c.item.raw,m=raw&&/tvg-rating="([^"]*)"/.exec(raw),r=m?parseFloat(m[1]):0;
    return c.rating=(r>0&&r<=10)?r:null;
  }
  let catList=[];
  function makeView(order=sort){
    const candidates=[];
    if(filter!=='series')candidates.push(...idx.movies);
    if(filter!=='movies')candidates.push(...idx.series);
    const q=Model.normalizeSearch(query);
    const all=candidates.filter(c=>(!srcId||c.sourceId===srcId)&&(!q||[
      c.title,c.group,c.sourceName
    ].some(value=>Model.normalizeSearch(value).includes(q))));
    const seen=watched();
    const filtered=filter==='watched'?all.filter(c=>!!seen[cardId(c)]):
      filter==='unwatched'?all.filter(c=>!seen[cardId(c)]):all;
    /* التصنيفات تُحسب قبل تطبيق التصنيف المختار */
    const by=new Map();
    filtered.forEach(c=>{const g=c.group||'أخرى',k=Model.normalizeSearch(g)||g;const e=by.get(k);if(e)e.n++;else by.set(k,{title:g,n:1,k})});
    catList=[...by.values()].sort((a,b)=>b.n-a.n).slice(0,300);
    if(cat&&!by.has(cat))cat='';
    if(filter==='resume'){
      const records=progress();
      return all.map(card=>{
        const record=card.kind==='movie'?records[card.item.url]:cardRecord(card);
        if(seen[cardId(card)])return null;
        return record&&Model&&Model.shouldResume(record)?Object.assign({},card,{resumeRecord:record}):null;
      }).filter(Boolean).sort((a,b)=>(b.resumeRecord.updated||0)-(a.resumeRecord.updated||0));
    }
    const list=cat?filtered.filter(c=>(Model.normalizeSearch(c.group||'أخرى')||(c.group||'أخرى'))===cat):filtered;
    const out=list.slice().reverse();                    // الأحدث إضافةً أولاً
    if(order==='az'){const cl=(typeof Intl!=='undefined'&&Intl.Collator)?new Intl.Collator('ar'):null;out.sort(cl?(a,b)=>cl.compare(a.title,b.title):(a,b)=>a.title<b.title?-1:1)}
    else if(order==='rating')out.sort((a,b)=>(ratingOf(b)||0)-(ratingOf(a)||0));
    return out;
  }

  /* ---------- الرسم ---------- */
  function updateHero(c){
    heroCard=c||null;
    const hero=$('vodh'),art=$('vpimg'),action=$('vodheroaction');
    hero.classList.toggle('empty',!c);
    if(!c){
      $('vpt').textContent='';$('vps').textContent='';action.hidden=true;art.hidden=true;art.removeAttribute('src');delete art.dataset.url;
      return;
    }
    $('vpt').textContent=niceTitle(c.title);
    const record=c.resumeRecord||cardRecord(c);
    const canResume=!!(record&&Model&&Model.shouldResume(record)&&!watched()[cardId(c)]);
    $('vps').textContent=(c.kind==='series'?'مسلسل'+(c.eps.length?' · '+c.eps.length+' حلقة':''):'فيلم')+
      (c.group?' · '+c.group:'')+(c.sourceName?' · '+c.sourceName:'')+
      (ratingOf(c)?' · ★ '+ratingOf(c).toFixed(1):'')+(canResume?' · متابعة عند '+fmt(record.position):'');
    if(desktopLayout()&&c.logo){
      if(art.dataset.url!==c.logo){art.dataset.url=c.logo;art.src=c.logo}
      art.hidden=false;art.onerror=()=>{art.hidden=true};
    }else{
      art.hidden=true;art.removeAttribute('src');delete art.dataset.url;
    }
    action.textContent=canResume?'▶ متابعة المشاهدة':'▶ عرض التفاصيل';
    action.hidden=!desktopLayout();
  }
  function sourceOptions(){
    const select=$('vodsource'),sources=lists.filter(l=>l.id!==FAV_LIST_ID&&l.id!=='builtin');
    if(srcId&&!sources.some(l=>l.id===srcId))srcId='';
    select.textContent='';
    const all=document.createElement('option');all.value='';all.textContent='كل المصادر';select.appendChild(all);
    sources.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;select.appendChild(o)});
    select.value=srcId;select.classList.toggle('sel',zone==='source');
  }
  const SORTS={recent:'الأحدث',az:'أ ← ي',rating:'الأعلى تقييماً'};
  function paintTabs(){
    tabsEl.textContent='';
    const search=$('vodsearch');
    search.textContent=query?'🔎 '+query:'🔎 بحث';
    search.classList.toggle('sel',zone==='search');
    const so=$('vodsort');so.textContent='⇅ '+SORTS[sort];so.classList.toggle('sel',zone==='sort');
    $('vodsource').classList.toggle('sel',zone==='source');
    const player=$('vodplayer'),mini=B.classList.contains('cine-mini');
    player.classList.toggle('hide',!mini);player.classList.toggle('sel',mini&&zone==='player');
  }
  function cycleSort(){sort=sort==='recent'?'az':sort==='az'?'rating':'recent';idxRows();paintHome()}
  function cycleSource(){
    const sel=$('vodsource');if(!sel.options.length)return;
    sel.selectedIndex=(sel.selectedIndex+1)%sel.options.length;sel.dispatchEvent(new Event('change'));
  }
  async function searchPrompt(){
    const value=await kbPrompt('بحث في العناوين والتصنيفات والمصادر',query);
    if(value===null)return;
    query=value.trim();idxRows();paintHome();
  }
  function msgInto(el,t){
    el.textContent='';
    const d=document.createElement('div');d.className='vempty';d.textContent=t;el.appendChild(d);
  }
  function msgBody(t){bodyEl.classList.remove('home');scroller=null;msgInto(bodyEl,t)}
  function idxRows(){
    view=makeView();gi=0;
    if(!desktopLayout())return;
    const recentView=sort==='recent'?view:makeView('recent');
    const records=progress(),marks=watched(),latestSeries=new Map();
    Object.values(records).forEach(record=>{
      if(!record||!record.seriesTitle||!Model||!Model.shouldResume(record))return;
      const key=record.sourceId+':'+record.seriesTitle,old=latestSeries.get(key);
      if(!old||(record.updated||0)>(old.updated||0))latestSeries.set(key,record);
    });
    let best=-1,bestUpdated=-1;
    for(let i=0;i<view.length;i++){
      const card=view[i],record=card.resumeRecord||
        (card.kind==='movie'?records[card.item.url]:latestSeries.get(card.sourceId+':'+card.title)||(card.lazy?records[card.lazy]:null));
      if(marks[cardId(card)]||!record||!Model||!Model.shouldResume(record))continue;
      const updated=record.updated||0;
      if(updated>bestUpdated){best=i;bestUpdated=updated}
    }
    updateHero(best>=0?view[best]:recentView[0]||null);
  }
  function loadImg(im){
    const u=im.dataset.s;if(!u)return;im.dataset.s='';im.decoding='async';
    im.onload=()=>im.classList.add('ld');
    im.onerror=()=>{const d=im.closest('.vc');im.remove();if(d)d.classList.add('noimg')};
    im.src=u;
  }
  function cardEl(c,i){
    const d=document.createElement('div');d.className='vc';d.dataset.n=i;
    const p=document.createElement('div');p.className='vp';p.dataset.i=((c.title||'?').trim()[0])||'?';
    if(c.logo){const im=document.createElement('img');im.alt='';im.dataset.s=c.logo;p.appendChild(im);if(io)io.observe(im);else loadImg(im)}else d.classList.add('noimg');
    const r=ratingOf(c);
    if(r){const b=document.createElement('span');b.className='vr';b.textContent=r.toFixed(1);p.appendChild(b)}
    if(c.kind==='series'){const b=document.createElement('i');b.textContent='مسلسل';p.appendChild(b)}
    if(watched()[cardId(c)]){const b=document.createElement('span');b.className='vwatched';b.textContent='✓ تمت المشاهدة';p.appendChild(b)}
    const rec=c.resumeRecord||(c.kind==='movie'?progress()[c.item.url]:null);
    if(rec&&Model&&Model.shouldResume(rec)){const bar=document.createElement('span');bar.className='vprogress';bar.style.setProperty('--progress',Model.progressPercent(rec)+'%');p.appendChild(bar)}
    const nm=document.createElement('div');nm.className='vn';nm.textContent=niceTitle(c.title);nm.title=c.title;
    d.append(p,nm);return d;
  }
  function renderMore(to){
    if(!gridEl)return;
    const end=Math.min(view.length,Math.max(to,rendered+CHUNK)),fr=document.createDocumentFragment();
    for(let i=rendered;i<end;i++){
      const card=view[i],node=cardEl(card,i);
      if(!renderedDesktop){fr.appendChild(node);continue}
      const title=card.group||'أخرى',key=Model.normalizeSearch(title)||title;
      let shelf=desktopShelves.get(key);
      if(!shelf){
        const section=document.createElement('section');section.className='vdshelf';
        const heading=document.createElement('h2');heading.className='vdshelf-title';heading.textContent=title;
        const track=document.createElement('div');track.className='vgrid vdshelf-grid';
        section.append(heading,track);gridEl.appendChild(section);
        shelf={track,row:desktopRows.length};desktopShelves.set(key,shelf);desktopRows.push([]);
      }
      desktopRows[shelf.row].push(i);shelf.track.appendChild(node);
    }
    if(!renderedDesktop)gridEl.appendChild(fr);
    rendered=end;calcCols();
  }
  function calcCols(){
    try{
      const target=renderedDesktop?gridEl.querySelector('.vdshelf-grid'):gridEl;
      gcols=Math.max(1,getComputedStyle(target).gridTemplateColumns.split(' ').filter(x=>x&&x!=='none').length);
    }catch(e){gcols=1}
  }
  window.addEventListener('resize',()=>{
    if(screen!=='home'||!gridEl||!gridEl.isConnected)return;
    if(renderedDesktop!==desktopLayout()){idxRows();paintHome();return}
    calcCols();markCards();
  });

  /* ---------- العمود الجانبي: النوع ثم التصنيفات بعدد كل تصنيف ---------- */
  const TYPES=[['all','🎞 الكل'],['resume','▶ متابعة المشاهدة'],['movies','🎬 أفلام'],['series','📺 مسلسلات'],['watched','✓ تمت مشاهدتها'],['unwatched','◷ لم تتم مشاهدتها']];
  function buildSide(){
    const keep=sideEl?sideEl.scrollTop:0;
    sideItems=TYPES.map(([k,l])=>({t:'type',v:k,l}));
    sideItems.push({t:'cat',v:'',l:'كل التصنيفات',n:catList.reduce((a,c)=>a+c.n,0),first:true});
    catList.forEach(c=>sideItems.push({t:'cat',v:c.k,l:c.title,n:c.n}));
    sideEl=document.createElement('div');sideEl.className='vside';
    sideItems.forEach((it,i)=>{
      const d=document.createElement('div');d.dataset.i=i;
      d.className='vsi'+(it.first?' first':'')+((it.t==='type'?filter===it.v:cat===it.v&&filter!=='resume')?' on':'');
      const s=document.createElement('span');s.textContent=it.l;d.appendChild(s);
      if(it.n!==undefined){const e=document.createElement('em');e.textContent=it.n;d.appendChild(e)}
      sideEl.appendChild(d);
    });
    sideEl.addEventListener('click',e=>{const d=e.target.closest('.vsi');if(!d)return;sideIdx=+d.dataset.i;zone='side';applySide()});
    sideEl.scrollTop=keep;
  }
  function applySide(){
    const it=sideItems[sideIdx];if(!it)return;
    if(it.t==='type'){filter=it.v;cat=''}else cat=it.v;
    idxRows();
    // يبقى التحديد في العمود الجانبي لمواصلة التنقل بين التصنيفات
    const keepIdx=sideIdx;paintHome();sideIdx=keepIdx;markCards();
  }
  function markSide(){
    if(!sideEl)return;
    [...sideEl.children].forEach((d,i)=>d.classList.toggle('sel',zone==='side'&&i===sideIdx));
    const s=sideEl.children[sideIdx];if(s&&zone==='side')s.scrollIntoView({block:'nearest'});
  }
  const FL={all:'الكل',resume:'متابعة المشاهدة',movies:'أفلام',series:'مسلسلات',watched:'تمت مشاهدتها',unwatched:'لم تتم مشاهدتها'};

  function paintHome(){
    cancelDetailRequest();el.classList.remove('vod-details');
    screen='home';paintTabs();bodyEl.textContent='';gridEl=null;
    renderedDesktop=desktopLayout();desktopShelves=new Map();desktopRows=[];
    bodyEl.classList.add('home');
    $('vodh').classList.remove('hide');
    sourceOptions();
    const catTitle=cat?((catList.find(c=>c.k===cat)||{}).title||''):'';
    $('vcount').textContent=(catTitle||FL[filter])+' · '+view.length+' عنصر';
    buildSide();
    const main=document.createElement('div');main.className='vmain';scroller=main;
    bodyEl.append(sideEl,main);
    if(!view.length){
      const empty=filter==='resume'?'لا يوجد ما تتابعه الآن.\nابدأ فيلماً أو حلقة وسيظهر هنا تلقائياً.':
        filter==='watched'?'لا توجد مواد محددة كمشاهَدة.':
        filter==='unwatched'?'لا توجد مواد غير مشاهَدة في هذا المصدر.':
        query?'لا توجد نتائج مطابقة في المصدر والنوع المحددين.':'لا توجد أفلام أو مسلسلات في مصادرك بعد.\nأضف مصدراً فيه مكتبة (ملف أو رابط أو Xtream) من الإعدادات ← إضافة مصدر، وستظهر هنا تلقائياً.';
      msgInto(main,empty);updateHero(null);
      if(zone==='rows')zone='side';
      markCards();return;
    }
    if(io)io.disconnect();
    io=('IntersectionObserver' in window)?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);loadImg(e.target)}}),{root:main,rootMargin:'600px 0px'}):null;
    gridEl=document.createElement('div');gridEl.className=renderedDesktop?'vdshelves':'vgrid';main.appendChild(gridEl);
    main.addEventListener('scroll',()=>{
      if(gridEl&&rendered<view.length&&main.scrollTop+main.clientHeight*2.5>main.scrollHeight)renderMore(rendered+CHUNK);
    },{passive:true});
    gridEl.addEventListener('scroll',e=>{
      const track=e.target;
      if(renderedDesktop&&track.classList.contains('vdshelf-grid')&&rendered<view.length&&track.scrollLeft+track.clientWidth*1.5>track.scrollWidth)renderMore(rendered+CHUNK);
    },true);
    rendered=0;renderMore(Math.max(CHUNK,gi+gcols*3));
    markCards();
  }
  bodyEl.addEventListener('click',e=>{
    if(screen!=='home'||!gridEl)return;
    const d=e.target.closest('.vc');if(!d)return;
    gi=+d.dataset.n;zone='rows';markCards();showDetails(view[gi],'home');
  });
  function keepVisible(c){
    const sc=scroller;if(!sc)return;
    if(renderedDesktop){
      const row=c.closest('.vdshelf-grid');
      if(row){
        const bounds=row.getBoundingClientRect(),cardBounds=c.getBoundingClientRect();
        if(cardBounds.left<bounds.left+18)row.scrollLeft-=bounds.left+18-cardBounds.left;
        else if(cardBounds.right>bounds.right-18)row.scrollLeft+=cardBounds.right-(bounds.right-18);
      }
    }
    const pad=18,viewport=sc.getBoundingClientRect(),card=c.getBoundingClientRect(),poster=c.querySelector('.vp');
    const posterBounds=poster&&poster.getBoundingClientRect(),top=posterBounds?Math.min(card.top,posterBounds.top):card.top;
    const bottom=posterBounds?Math.max(card.bottom,posterBounds.bottom):card.bottom;
    if(top<viewport.top+pad)sc.scrollTop-=viewport.top+pad-top;
    else if(bottom>viewport.bottom-pad)sc.scrollTop+=bottom-(viewport.bottom-pad);
  }
  function markCards(){
    if(gridEl){const o=gridEl.querySelector('.vc.sel');if(o)o.classList.remove('sel')}
    paintTabs();markSide();
    if(zone!=='rows'||!view.length||!gridEl)return;
    const c=gridEl.querySelector('.vc[data-n="'+gi+'"]');
    if(c){c.classList.add('sel');keepVisible(c);if(!desktopLayout())updateHero(view[gi])}
  }
  function cardId(c){return c.kind==='movie'?c.item.url:(c.lazy||c.sourceId+':'+c.title)}
  function cardRecord(c){
    const p=progress();
    if(c.kind==='movie')return p[c.item.url]||null;
    const records=Object.values(p).filter(x=>x&&x.seriesTitle===c.title&&x.sourceId===c.sourceId)
      .sort((a,b)=>(b.updated||0)-(a.updated||0));
    return records.find(x=>Model&&Model.shouldResume(x))||records[0]||(c.lazy?p[c.lazy]:null)||null;
  }
  function addAction(label,run,cls){
    const button=document.createElement('button');button.type='button';button.className=cls||'';
    button.textContent=label;button.onclick=run;return button;
  }
  function addPlayAction(label,run,cls){
    const button=addAction('',run,cls);button.classList.add('vplay-action');
    const icon=document.createElement('span');icon.className='vplay-icon';icon.textContent='▶';icon.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.textContent=label;
    button.append(icon,text);return button;
  }
  function cancelDetailRequest(){
    detailToken++;
    if(detailController){detailController.abort();detailController=null}
  }
  function addMetaChip(parent,label){
    const chip=document.createElement('span');chip.className='vdetail-chip';chip.textContent=label;
    parent.appendChild(chip);return chip;
  }
  function addDetailFact(parent,label){
    const row=document.createElement('div');row.className='vdetail-fact';row.hidden=true;
    const title=document.createElement('small');title.textContent=label;
    const value=document.createElement('span');row.append(title,value);parent.appendChild(row);
    return{row,value};
  }
  function renderDetailsMetadata(data,nodes){
    const chips=[];
    if(data.year)chips.push(data.year);
    if(data.genre)chips.push(data.genre);
    if(data.duration)chips.push(data.duration);
    if(data.rating&&!nodes.baseRating)chips.push('★ '+data.rating);
    chips.forEach(label=>addMetaChip(nodes.meta,label));
    if(data.overview){nodes.overview.textContent=data.overview;nodes.overview.hidden=false}
    [['cast',data.cast],['director',data.director]].forEach(([key,value])=>{
      if(value){nodes.facts[key].value.textContent=value;nodes.facts[key].row.hidden=false}
    });
    if(data.backdrop)nodes.backdrop.src=data.backdrop;
    if(data.poster&&!nodes.poster.querySelector('img')){const image=document.createElement('img');image.alt='';image.src=data.poster;image.onerror=()=>image.remove();nodes.poster.appendChild(image)}
    const trailerId=Metadata&&Metadata.youtubeId(data.trailer);
    if(trailerId){
      nodes.trailerSection.hidden=false;
      nodes.trailer.hidden=false;
      if(data.backdrop||data.poster||cur.logo)nodes.trailerImage.src=data.backdrop||data.poster||cur.logo;
      nodes.trailer.onclick=()=>openTrailer(trailerId);
    }
    return chips.length+Number(!!data.overview)+Number(!!data.cast)+Number(!!data.director)+Number(!!data.backdrop)+Number(!!data.poster)+Number(!!trailerId);
  }
  async function loadDetailsMetadata(card,nodes){
    if(!Metadata)return;
    const source=lists.find(list=>list.id===card.sourceId)||null;
    if(!Metadata.requestUrl(card,source))return;
    const token=++detailToken,key=cardId(card);
    if(detailCache.has(key)){
      const count=renderDetailsMetadata(detailCache.get(key),nodes);
      nodes.status.textContent=count?'':'لا توجد تفاصيل إضافية من المصدر';
      return;
    }
    nodes.status.textContent='جارٍ تحميل التفاصيل من المصدر…';
    detailController=typeof AbortController==='function'?new AbortController():null;
    try{
      const data=await Metadata.fetchInfo(card,source,window.fetch.bind(window),detailController&&detailController.signal);
      if(token!==detailToken||screen!=='details'||cur!==card)return;
      detailController=null;detailCache.set(key,data);
      const count=renderDetailsMetadata(data,nodes);
      nodes.status.textContent=count?'':'لا توجد تفاصيل إضافية من المصدر';
    }catch(error){
      if(token!==detailToken||error&&error.name==='AbortError')return;
      detailController=null;
      nodes.status.textContent='تعذّر تحميل التفاصيل الإضافية من المصدر';
    }
  }
  function openTrailer(id){
    if(screen!=='details')return;
    trailerFocus=document.activeElement;
    screen='trailer';
    const embedded=B.classList.contains('cine-mini')&&playerFromDetails&&B.classList.contains('vod-detail-play');
    const stage=document.createElement('div');stage.className=embedded?'vtrailer-inline':'vtrailer-stage';
    const close=document.createElement('button');close.type='button';close.className='vtrailer-close';close.textContent='→ العودة إلى التفاصيل';
    close.onclick=closeTrailer;
    const frame=document.createElement('iframe');frame.title='المقطع الدعائي · '+niceTitle(cur&&cur.title);
    frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0';
    frame.allow='autoplay; encrypted-media; picture-in-picture; web-share';
    frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
    stage.append(close,frame);
    if(embedded){
      const playerStage=el.querySelector('.vdetail-player-stage');
      if(playerStage){
        const trailerSection=playerStage.querySelector('.vdetail-trailer');
        if(trailerSection)trailerSection.hidden=true;
        playerStage.appendChild(stage);
      }else el.appendChild(stage);
    }else el.appendChild(stage);
    close.focus({preventScroll:true});
  }
  function closeTrailer(){
    const stage=el.querySelector('.vtrailer-stage,.vtrailer-inline');
    if(stage){const frame=stage.querySelector('iframe');if(frame)frame.src='about:blank';stage.remove()}
    screen='details';
    if(B.classList.contains('cine-mini')&&playerFromDetails){
      const trailerSection=el.querySelector('.vdetail-player-stage .vdetail-trailer');
      if(trailerSection&&trailerSection.querySelector('.vtrailer-card:not([hidden])'))trailerSection.hidden=false;
    }
    if(trailerFocus&&trailerFocus.isConnected)trailerFocus.focus({preventScroll:true});
    trailerFocus=null;
  }
  function showDetails(card,returnTo){
    cancelDetailRequest();
    cur=card;detailReturn=returnTo||'home';detailOrigin=detailReturn;screen='details';zone='details';
    el.classList.add('vod-details');
    if(playerFromDetails&&playing&&playing.card===card&&B.classList.contains('cine-mini'))B.classList.add('vod-detail-play');
    paintTabs();
    detailScrollTop=(scroller&&scroller.isConnected)?scroller.scrollTop:0;
    bodyEl.classList.remove('home');scroller=null;bodyEl.textContent='';$('vodh').classList.add('hide');
    const panel=document.createElement('section');panel.className='vdetails';
    const backdrop=document.createElement('img');backdrop.className='vdetail-backdrop';backdrop.alt='';backdrop.setAttribute('aria-hidden','true');if(card.logo)backdrop.src=card.logo;
    const shell=document.createElement('div');shell.className='vdetail-shell';
    let playerStage=null;
    if(playerFromDetails&&playing&&playing.card===card){
      playerStage=document.createElement('div');playerStage.className='vdetail-player-stage';
      playerStage.appendChild($('player'));
      shell.appendChild(playerStage);
    }
    const head=document.createElement('div');head.className='vdetail-head';
    const poster=document.createElement('div');poster.className='vdetail-poster';
    if(card.logo){const cover=document.createElement('img');cover.className='vdetail-cover';cover.alt='';cover.src=card.logo;cover.onerror=()=>cover.remove();poster.appendChild(cover)}
    const info=document.createElement('div');info.className='vdetail-info';
    const title=document.createElement('h2');title.textContent=niceTitle(card.title);info.appendChild(title);
    const meta=document.createElement('div');meta.className='vdetail-meta';
    addMetaChip(meta,card.kind==='series'?'مسلسل':'فيلم');
    if(card.group)addMetaChip(meta,card.group);
    if(card.sourceName)addMetaChip(meta,card.sourceName);
    if(ratingOf(card))addMetaChip(meta,'★ '+ratingOf(card).toFixed(1));
    info.appendChild(meta);
    const overview=document.createElement('p');overview.className='vdetail-overview';overview.hidden=true;
    const facts=document.createElement('div');facts.className='vdetail-facts';
    const cast=addDetailFact(facts,'الممثلون'),director=addDetailFact(facts,'المخرج');
    const status=document.createElement('small');status.className='vdetail-status';
    const extra=document.createElement('div');extra.className='vdetail-extra';extra.append(overview,facts,status);
    let summaryHeading=null;
    if(playerFromDetails&&playing&&playing.card===card){
      summaryHeading=document.createElement('h3');summaryHeading.className='vdetail-summary-heading';summaryHeading.textContent='نبذة';
      extra.prepend(summaryHeading);
    }
    const alternatives=idx?[...idx.movies,...idx.series].filter(other=>other!==card&&Model.sameTitle(card,other)):[];
    const key=Model.normalizeTitle(card.title),remembered=LS.get('m3u_vod_provider',{})[key];
    alternatives.sort((a,b)=>(a.sourceId===remembered?-1:0)-(b.sourceId===remembered?-1:0));
    const rec=cardRecord(card),canResume=rec&&Model.shouldResume(rec);
    const actions=document.createElement('div');actions.className='vdetail-actions';
    const nowPlaying=!!(playing&&playing.card===card&&playerFromDetails);
    if(nowPlaying){
      actions.appendChild(addAction('⛶ ملء الشاشة',()=>expandPlayer()));
      const vEl=(playerStage&&playerStage.querySelector('#v'))||$('v');
      const tog=addAction(vEl&&vEl.paused?'▶ استئناف':'⏸ إيقاف مؤقت',()=>togglePlayback(),'alt');tog.dataset.act='toggle';actions.appendChild(tog);
      actions.appendChild(addAction('■ إيقاف التشغيل',()=>stopInDetails(),'alt'));
      if(card.kind==='series')actions.appendChild(addAction('اختيار الموسم والحلقة',()=>{restorePlayerFromDetails();playerFromDetails=false;B.classList.remove('vod-detail-play');detailReturn='home';activate(card)},'alt'));
    }else if(card.kind==='series'){
      actions.appendChild(addAction('اختيار الموسم والحلقة',()=>{detailReturn='home';activate(card)}));
      if(canResume)actions.appendChild(addPlayAction('متابعة من '+fmt(rec.position),()=>playCard(card,rec.position,true),'alt'));
    }else{
      actions.appendChild(addPlayAction(canResume?'متابعة من '+fmt(rec.position):'تشغيل',()=>playCard(card,canResume?rec.position:0,true)));
      if(canResume)actions.appendChild(addAction('↺ البدء من البداية',()=>playCard(card,0,true),'alt'));
    }
    const cardWatched=!!watched()[cardId(card)];
    actions.appendChild(addAction(cardWatched?'✓ تمت المشاهدة':'○ تحديد كمشاهد',()=>setWatched(card,!cardWatched),'alt'));
    actions.appendChild(addAction('← العودة إلى القائمة',()=>returnFromDetails(),'alt'));
    info.appendChild(actions);
    if(alternatives.length){
      const section=document.createElement('div');section.className='vdetail-alternatives';
      const heading=document.createElement('h3');heading.textContent='مصادر بديلة';section.appendChild(heading);
      alternatives.forEach(other=>section.appendChild(addAction(other.sourceName+' · '+other.title,()=>{
        const providers=LS.get('m3u_vod_provider',{});providers[key]=other.sourceId;LS.set('m3u_vod_provider',providers);
        cur=other;showDetails(other,detailReturn);
      },'alt')));
      extra.appendChild(section);
    }
    if(playerFromDetails&&playing&&playing.card===card)info.appendChild(extra);
    const trailerSection=document.createElement('section');trailerSection.className='vdetail-trailer';
    trailerSection.hidden=true;
    const trailerHeading=document.createElement('h3');trailerHeading.textContent='المقطع الدعائي';trailerSection.appendChild(trailerHeading);
    const trailer=document.createElement('button');trailer.type='button';trailer.className='vtrailer-card';trailer.hidden=true;
    const trailerImage=document.createElement('img');trailerImage.alt='';
    const trailerLabel=document.createElement('span');trailerLabel.textContent='▶ مشاهدة العرض الدعائي';
    trailer.append(trailerImage,trailerLabel);trailerSection.appendChild(trailer);
    head.append(poster,info);
    if(playerFromDetails&&playing&&playing.card===card){
      playerStage.appendChild(trailerSection);
      shell.append(head);
    }
    else shell.append(head,extra,trailerSection);
    panel.append(backdrop,shell);bodyEl.appendChild(panel);
    detailIndex=0;
    const first=[...panel.querySelectorAll('button')].find(b=>!b.disabled&&b.getClientRects().length);
    if(first){first.classList.add('sel');first.focus({preventScroll:true})}
    loadDetailsMetadata(card,{meta,overview,facts:{cast,director},status,backdrop,poster,trailerSection,trailer,trailerImage,baseRating:!!ratingOf(card)});
  }
  function returnFromDetails(){
    cancelDetailRequest();
    restorePlayerFromDetails();
    if(playerFromDetails)B.classList.remove('vod-detail-play');
    el.classList.remove('vod-details');
    if(detailReturn==='series'&&cur){screen='series';zone='eps';paintSeries();return}
    $('vodh').classList.remove('hide');
    const selected=view[gi];
    idxRows();
    if(selected){const k=view.findIndex(card=>cardId(card)===cardId(selected));if(k>=0)gi=k}
    screen='home';zone='rows';paintHome();
    requestAnimationFrame(()=>{if(scroller)scroller.scrollTop=detailScrollTop;markCards()});
  }
  function setWatched(card,value){
    const map=watched(),id=cardId(card);
    if(value)map[id]=Date.now();else delete map[id];
    LS.set('m3u_vod_watched',map);
    const records=progress();
    if(card.kind==='movie'&&records[card.item.url])records[card.item.url].watched=!!value;
    if(card.lazy&&records[card.lazy])records[card.lazy].watched=!!value;
    if(card.kind==='series')Object.keys(records).forEach(url=>{if(records[url]&&records[url].seriesTitle===card.title&&records[url].sourceId===card.sourceId)records[url].watched=!!value});
    LS.set('m3u_vod_progress',records);
    if(screen==='details')showDetails(card,detailReturn);else paintHome();
  }
  async function playCard(card,position,fromDetails){
    const record=cardRecord(card);
    const ep=card.kind==='series'&&record&&record.url?card.eps.findIndex(e=>e.url===record.url):0;
    if(card.kind==='series'&&card.lazy&&!card.eps.length){
      const ok=await loadLazy(card);
      if(!ok){toast('تعذّر تحميل حلقات هذا المسلسل');return}
      playCard(card,position,fromDetails);return;
    }
    if(card.kind==='series'){
      const episode=card.eps[Math.max(0,ep)]||card.eps[0];
      if(!episode){toast('لا توجد حلقات لهذا المسلسل');return}
      cur=card;curEps=card.eps.filter(e=>e.s===episode.s);eIdx=Math.max(0,curEps.findIndex(e=>e.url===episode.url));
      detailReturn='details';playItem(episode.item,curEps,eIdx,card,position,fromDetails);
    }else{
      if(position===0){
        const marks=watched();delete marks[cardId(card)];LS.set('m3u_vod_watched',marks);
        const records=progress();if(records[card.item.url])records[card.item.url].watched=false;LS.set('m3u_vod_progress',records);
      }
      playItem(card.item,null,0,card,position,fromDetails);
    }
  }
  /* حلقات مسلسلات Xtream: تُحمَّل عند الفتح فقط */
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
  function activate(c){
    if(c.kind==='series'&&c.lazy&&!c.eps.length){
      loadLazy(c).then(ok=>{if(ok&&on){cur=c;sIdx=0;eIdx=0;zone='eps';paintSeries()}else if(!ok)toast('تعذّر تحميل حلقات هذا المسلسل')});
      return;
    }
    if(c.kind==='series'){cur=c;sIdx=0;eIdx=0;zone='eps';paintSeries()}
    else showDetails(c,'home');
  }

  /* ---------- شاشة المسلسل ---------- */
  function paintSeries(){
    cancelDetailRequest();el.classList.remove('vod-details');
    screen='series';paintTabs();bodyEl.classList.remove('home');scroller=null;bodyEl.textContent='';
    const seasons=[...new Set(cur.eps.map(e=>e.s))].sort((a,b)=>a-b);
    if(sIdx>=seasons.length)sIdx=0;
    const details=addAction('تفاصيل المسلسل',()=>showDetails(cur,'series'),'alt');
    details.classList.toggle('sel',zone==='seriesInfo');
    bodyEl.appendChild(details);
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
      r.onclick=()=>{eIdx=i;zone='eps';detailReturn='series';playItem(e.item,curEps,i,cur,0)};
      list.appendChild(r);
    });
    bodyEl.appendChild(bar);bodyEl.appendChild(list);
    const s=list.querySelector('.sel');if(s)s.scrollIntoView({block:'nearest'});
    updateHero(cur);
  }
  function seriesKey(k){
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    if(zone==='player'){
      const top=['search','sort','source','player'];
      if(k===fwd)zone=top[Math.min(top.length-1,top.indexOf(zone)+1)];
      else if(k===bwd)zone=top[Math.max(0,top.indexOf(zone)-1)];
      else if(k==='ArrowDown'){zone='seriesInfo';paintSeries();return}
      else if(k==='Enter'){expandPlayer();return}
      paintTabs();return;
    }
    const nSeasons=bodyEl.querySelectorAll('.vs').length;
    if(zone==='seriesInfo'){
      if(k==='ArrowDown'){zone=nSeasons?'seasons':'eps';paintSeries()}
      else if(k==='ArrowUp'&&B.classList.contains('cine-mini')){zone='player';paintTabs()}
      else if(k==='Enter')showDetails(cur,'series');
      return;
    }
    if(zone==='seasons'){
      if(k===fwd&&sIdx<nSeasons-1){sIdx++;eIdx=0;paintSeries()}
      else if(k===bwd&&sIdx>0){sIdx--;eIdx=0;paintSeries()}
      else if(k==='ArrowDown'||k==='Enter'){zone='eps';paintSeries()}
      else if(k==='ArrowUp'){zone='seriesInfo';paintSeries()}
    }else{
      if(k==='ArrowUp'){if(eIdx>0)eIdx--;else zone='seasons';paintSeries()}
      else if(k==='ArrowDown'){eIdx=Math.min(curEps.length-1,eIdx+1);paintSeries()}
      else if(k==='Enter'){const e=curEps[eIdx];if(e)playItem(e.item,curEps,eIdx)}
    }
  }

  /* ---------- الرئيسية ---------- */
  function desktopHomeKey(k){
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    if(!view.length){if(k==='ArrowUp')zone='search';else if(k===bwd)zone='side';markCards();return}
    let rowIndex=desktopRows.findIndex(row=>row.indexOf(gi)>=0);
    if(rowIndex<0)rowIndex=0;
    let row=desktopRows[rowIndex]||[],col=row.indexOf(gi);
    if(col<0)col=0;
    if(k==='Enter'){activate(view[gi]);return}
    if(((k===fwd&&col>=row.length-1)||(k==='ArrowDown'&&rowIndex>=desktopRows.length-1)||(k==='PageDown'&&rowIndex>=desktopRows.length-3))&&rendered<view.length){
      renderMore(rendered+CHUNK);
      rowIndex=desktopRows.findIndex(items=>items.indexOf(gi)>=0);
      row=desktopRows[rowIndex]||[];col=Math.max(0,row.indexOf(gi));
    }
    let target=gi;
    if(k===fwd)target=row[Math.min(row.length-1,col+1)];
    else if(k===bwd){
      if(col===0){zone='side';markCards();return}
      target=row[col-1];
    }else if(k==='ArrowDown'||k==='ArrowUp'||k==='PageDown'||k==='PageUp'){
      let nextRow=rowIndex;
      if(k==='ArrowDown')nextRow=Math.min(desktopRows.length-1,rowIndex+1);
      else if(k==='ArrowUp')nextRow=rowIndex-1;
      else nextRow=Math.max(0,Math.min(desktopRows.length-1,rowIndex+(k==='PageDown'?3:-3)));
      if(nextRow<0){zone='search';markCards();return}
      const items=desktopRows[nextRow];
      target=items[Math.min(col,items.length-1)];
    }else return;
    if(target===undefined)return;
    gi=target;
    if(gi>=rendered-4&&rendered<view.length)renderMore(rendered+CHUNK);
    markCards();
  }
  function homeKey(k){
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    const down=()=>{zone=view.length?'rows':'side'};
    const top=['search','sort','source'];
    if(B.classList.contains('cine-mini'))top.push('player');
    if(top.includes(zone)){
      const current=top.indexOf(zone);
      if(k===fwd)zone=top[Math.min(top.length-1,current+1)];
      else if(k===bwd)zone=top[Math.max(0,current-1)];
      else if(k==='ArrowDown'){down()}
      else if(k==='Enter'){
        if(zone==='search'){searchPrompt();return}
        if(zone==='sort'){cycleSort();return}
        if(zone==='player'){expandPlayer();return}
        cycleSource();return;
      }
      markCards();return;
    }
    if(zone==='side'){
      if(k==='ArrowDown')sideIdx=Math.min(sideItems.length-1,sideIdx+1);
      else if(k==='ArrowUp'){if(sideIdx>0)sideIdx--;else zone='search'}
      else if(k==='PageDown')sideIdx=Math.min(sideItems.length-1,sideIdx+8);
      else if(k==='PageUp')sideIdx=Math.max(0,sideIdx-8);
      else if(k===fwd&&view.length){
        gi=desktopLayout()?0:Math.min(Math.floor(gi/gcols)*gcols,view.length-1);zone='rows';
      }
      else if(k==='Enter'){applySide();return}
      markCards();return;
    }
    if(!view.length){if(k==='ArrowUp')zone='search';else if(k===bwd)zone='side';markCards();return}
    if(desktopLayout()){desktopHomeKey(k);return}
    const last=view.length-1,rowStart=Math.floor(gi/gcols)*gcols,rowEnd=Math.min(last,rowStart+gcols-1);let n=gi;
    if(k===fwd)n=Math.min(rowEnd,gi+1);
    else if(k===bwd){if(gi===rowStart){zone='side';markCards();return}n=gi-1}
    else if(k==='ArrowDown')n=Math.min(last,gi+gcols);
    else if(k==='ArrowUp'){if(gi<gcols){zone='search';markCards();return}n=gi-gcols}
    else if(k==='PageDown')n=Math.min(last,gi+gcols*3);
    else if(k==='PageUp')n=Math.max(0,gi-gcols*3);
    else if(k==='Enter'){activate(view[gi]);return}
    else return;
    gi=n;
    if(gi>=rendered-gcols*2&&rendered<view.length)renderMore(gi+gcols*3);
    markCards();
  }

  /* ---------- التشغيل ---------- */
  const fmt=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
  const Playback=window.WasslaVodPlayback;
  function setSeekTime(target,notify){
    const v=$('v'),time=Playback.seekTarget(0,v.duration,target);
    if(time===null){if(notify!==false)toast('التقديم غير متاح حتى يجهز المحتوى');return false}
    try{v.currentTime=time;return true}
    catch(e){if(notify!==false)toast('التقديم غير مدعوم لهذا المصدر');return false}
  }
  function showPlayerBackground(focusPlayer){
    if(playerFromDetails&&playing){
      screen='details';zone='details';showDetails(playing.card,playerDetailOrigin||detailOrigin);return;
    }
    if(playerBackground==='series'&&cur&&cur.kind==='series'){
      screen='series';zone=focusPlayer?'player':'eps';paintSeries();
    }else{
      idxRows();screen='home';zone=focusPlayer?'player':'rows';paintHome();
      requestAnimationFrame(()=>{if(scroller)scroller.scrollTop=playerScrollTop;markCards()});
    }
  }
  function expandPlayer(){
    if(!playing)return;
    restorePlayerFromDetails();
    B.classList.remove('cine-mini');B.classList.add('cine-play');screen='player';paintTrack();revealTrack();
  }
  function minimizePlayer(){
    if(!playing)return;
    clearTrackTimer();B.classList.remove('cine-play','cine-track-hidden');B.classList.add('cine-mini');showPlayerBackground(true);
  }
  function closeMiniPlayer(){
    if(!playing)return;
    stopPlay();showPlayerBackground(false);
  }
  function restorePlayerFromDetails(){
    const player=$('player');
    if(player&&player.parentElement!==playerHost)playerHost.appendChild(player);
  }
  function playItem(it,eps,i,card,position,fromDetails){
    const wasPlaying=B.classList.contains('cine-play')||B.classList.contains('cine-mini');
    const expanded=B.classList.contains('cine-play');
    if(fromDetails){playerFromDetails=true;playerDetailOrigin=detailOrigin}
    else if(!wasPlaying)playerFromDetails=false;
    if(!wasPlaying){
      playerBackground=(screen==='series'||(screen==='details'&&detailReturn==='series'))?'series':'home';
      playerScrollTop=(scroller&&scroller.isConnected)?scroller.scrollTop:detailScrollTop;
    }
    if(playing){
      saveProgress();
      clearInterval(progressTimer);progressTimer=null;
      stopAll();
    }
    playing={eps:eps||null,i:i||0,card:card||cur,item:it};
    clearNext();
    B.classList.toggle('vod-detail-play',playerFromDetails);
    const goFull=expanded||!wasPlaying;
    stopArmedAt=0;
    if(goFull){B.classList.remove('cine-mini');B.classList.add('cine-play');screen='player'}
    else{B.classList.remove('cine-play');B.classList.add('cine-mini')}
    const v=$('v');v.controls=false;
    const restorePosition=()=>{if(position>0&&Number.isFinite(v.duration)&&v.duration>position)setSeekTime(position,false);v.removeEventListener('loadedmetadata',restorePosition)};
    if(position>0)v.addEventListener('loadedmetadata',restorePosition);
    play(it);
    $('now').textContent=niceTitle(it.name||(playing.card&&playing.card.title)||'')||it.name;
    updatePlaybackActions();updatePlayPause();paintTrack();if(goFull)revealTrack();
    progressTimer=setInterval(saveProgress,15000);
  }
  function activeRecordKey(){
    return playing&&playing.item?playing.item.url:'';
  }
  function saveProgress(){
    if(!playing)return;
    const v=$('v'),url=activeRecordKey();
    if(!url||!Number.isFinite(v.duration)||v.duration<=0||!Number.isFinite(v.currentTime))return;
    const records=progress(),old=records[url]||{};
    const complete=old.watched||v.ended||v.currentTime>=v.duration*0.95;
    records[url]={
      url,title:playing.item.name||playing.card.title,seriesTitle:playing.card.kind==='series'?playing.card.title:'',
      sourceId:playing.card.sourceId||active,position:v.currentTime,duration:v.duration,
      watched:!!complete,updated:Date.now()
    };
    LS.set('m3u_vod_progress',records);
    if(playing.card.kind==='movie'&&complete){
      const marks=watched();marks[cardId(playing.card)]=Date.now();LS.set('m3u_vod_watched',marks);
    }
  }
  function clearNext(){
    clearTimeout(nextTimer);nextTimer=null;nextCard=null;nextEpisode=null;
    $('vodnext').classList.add('hide');
  }
  function stopPlay(){saveProgress();clearInterval(progressTimer);progressTimer=null;clearTrackTimer();clearNext();tok++;stopAll();B.classList.remove('cine-play','cine-mini','cine-track-hidden','vod-detail-play');restorePlayerFromDetails();playerFromDetails=false;$('v').controls=!B.classList.contains('rcv');playing=null;updatePlayPause();paintTabs()}
  function updatePlaybackActions(){
    const c=playing&&playing.card;
    $('vodwatched').style.display=c?'':'none';
    $('vodbackdetails').style.display=c?'':'none';
    if(c)$('vodwatched').textContent=c.kind==='series'?'✓ تمت مشاهدة الحلقة':'✓ تمت المشاهدة';
    paintTabs();
  }
  function updatePlayPause(){
    const p=$('v').paused;
    $('vodplaypause').textContent=p?'▶ تشغيل':'⏸ إيقاف';
    bodyEl.querySelectorAll('[data-act="toggle"]').forEach(b=>{b.textContent=p?'▶ استئناف':'⏸ إيقاف مؤقت'});
  }
  function stopInDetails(){
    const c=playing&&playing.card,origin=playerDetailOrigin||detailOrigin;
    stopPlay();if(c)showDetails(c,origin);
  }
  function togglePlayback(){
    const v=$('v');if(!playing)return;
    if(v.paused){const result=v.play();if(result&&result.catch)result.catch(()=>toast('تعذّر استئناف التشغيل'))}
    else v.pause();
    updatePlayPause();
  }
  function setCurrentWatched(){
    if(!playing)return;
    if(playing.card.kind==='series'){
      const v=$('v');if(Number.isFinite(v.duration)&&v.duration>0)setSeekTime(v.duration,false);
      saveProgress();
    }else setWatched(playing.card,true);
    updatePlaybackActions();
  }
  function offerNext(){
    if(!playing||!playing.eps||playing.i+1>=playing.eps.length)return;
    nextCard=playing.card;nextEpisode=playing.eps[playing.i+1];
    let remaining=10;
    const auto=LS.get('m3u_vod_autonext',true);
    $('vodnexttext').textContent=auto?'الحلقة التالية خلال '+remaining+' ثوانٍ':'انتهت الحلقة · اختر تشغيل الحلقة التالية';
    $('vodnext').classList.remove('hide');
    if(!auto)return;
    const tick=()=>{remaining--;if(remaining<=0){playNext();return} $('vodnexttext').textContent='الحلقة التالية خلال '+remaining+' ثوانٍ';nextTimer=setTimeout(tick,1000)};
    nextTimer=setTimeout(tick,1000);
  }
  function playNext(){
    if(!nextEpisode||!nextCard)return;
    const card=nextCard,episode=nextEpisode,eps=playing.eps,index=eps.findIndex(e=>e.url===episode.url);
    clearNext();playItem(episode.item,eps,index,card,0);eIdx=index;
  }
  $('vodnextnow').onclick=playNext;
  $('vodnextcancel').onclick=clearNext;
  $('vodplayer').onclick=expandPlayer;
  $('vodplaypause').onclick=togglePlayback;
  $('vodexpand').onclick=expandPlayer;
  $('vodmini').onclick=minimizePlayer;
  $('vodclose').onclick=closeMiniPlayer;
  $('vodbackdetails').onclick=()=>{
    if(!playing)return;
    if(playerFromDetails){
      minimizePlayer();
      return;
    }
    const card=playing.card,backTo=detailReturn;
    stopPlay();detailReturn=backTo;showDetails(card,backTo);
  };
  $('vodwatched').onclick=setCurrentWatched;
  $('v').addEventListener('pause',()=>{clearTrackTimer();B.classList.remove('cine-track-hidden');saveProgress()});
  $('v').addEventListener('play',updatePlayPause);
  $('v').addEventListener('pause',updatePlayPause);
  $('v').addEventListener('playing',revealTrack);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProgress()});
  function seek(sec){
    revealTrack();
    const v=$('v');
    const target=Playback.seekTarget(v.currentTime,v.duration,sec);
    if(target===null){toast('التقديم غير متاح حتى يجهز المحتوى');return}
    if(setSeekTime(target,false))toast(fmt(target)+' / '+fmt(v.duration));
  }
  window.__vodMediaSeek=delta=>{if(!on||!playing)return false;seek(delta);return true};
  window.__vodMediaControl=action=>{
    if(!on||!playing)return false;
    const paused=$('v').paused;
    if(action==='toggle'||(action==='play'&&paused)||(action==='pause'&&!paused))togglePlayback();
    return true;
  };
  /* ---------- مسار التشغيل (شريط التقدم) ---------- */
  const T={bar:$('vtbar'),fill:$('vtfill'),buf:$('vtbuf'),knob:$('vtknob'),cur:$('vtcur'),dur:$('vtdur'),left:$('vtleft'),st:$('vtstate')};
  function clearTrackTimer(){clearTimeout(trackHideTimer);trackHideTimer=null}
  function revealTrack(){
    if(!B.classList.contains('cine-play')&&!B.classList.contains('cine-mini'))return;
    clearTrackTimer();B.classList.remove('cine-track-hidden');
    if(B.classList.contains('cine-play')&&!$('v').paused)trackHideTimer=setTimeout(()=>{
      trackHideTimer=null;
      if(B.classList.contains('cine-play')&&!$('v').paused)B.classList.add('cine-track-hidden');
    },4000);
  }
  function paintTrack(){
    if(!B.classList.contains('cine-play')&&!B.classList.contains('vod-detail-play'))return;
    const v=$('v'),d=v.duration,c=v.currentTime||0,ok=Number.isFinite(d)&&d>0,pct=ok?Math.max(0,Math.min(100,c/d*100)):0;
    T.fill.style.width=pct+'%';T.knob.style.left=pct+'%';
    let b=0;try{if(ok&&v.buffered.length)b=Math.min(100,v.buffered.end(v.buffered.length-1)/d*100)}catch(e){}
    T.buf.style.width=b+'%';
    T.cur.textContent=fmt(c);T.dur.textContent=ok?fmt(d):'--:--';
    T.left.textContent=ok?'متبقي '+fmt(d-c):'';
    T.st.textContent=v.paused?'⏸':'▶';
  }
  ['timeupdate','play','pause','playing','seeked','durationchange','loadedmetadata','progress','emptied'].forEach(n=>$('v').addEventListener(n,paintTrack));
  T.bar.addEventListener('click',e=>{
    const v=$('v'),r=T.bar.getBoundingClientRect();
    if(!Number.isFinite(v.duration)||v.duration<=0||r.width<=0)return;
    if(setSeekTime(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*v.duration,false))paintTrack();
  });
  $('v').addEventListener('click',()=>{if(B.classList.contains('cine-play'))togglePlayback();else if(B.classList.contains('cine-mini'))expandPlayer()});
  $('player').addEventListener('pointermove',revealTrack,{passive:true});
  $('player').addEventListener('pointerdown',revealTrack,{passive:true});
  function playKey(k){
    revealTrack();
    if((k==='Escape'||k==='Backspace')&&nextCard)clearNext();
    else if(k==='Escape'||k==='Backspace')window.__vodBack();
    else if(k==='Enter')togglePlayback();
    else if(k==='ArrowRight'||k==='ArrowLeft')seek(k==='ArrowRight'?10:-10);
    else if(k==='ArrowUp'||k==='ArrowDown')seek(k==='ArrowUp'?60:-60);
    else if(k==='MediaFastForward')seek(10);
    else if(k==='MediaRewind')seek(-10);
    else if(k==='MediaPlayPause')togglePlayback();
    else if((k==='PageDown'||k==='PageUp')&&playing&&playing.eps){
      const n=playing.i+(k==='PageDown'?1:-1);
      if(n>=0&&n<playing.eps.length){const episode=playing.eps[n];eIdx=n;playItem(episode.item,playing.eps,n,playing.card,0)}
    }
  }
  $('v').addEventListener('ended',()=>{
    if(!on||(!B.classList.contains('cine-play')&&!B.classList.contains('cine-mini'))||!playing)return;
    saveProgress();revealTrack();
    if(playing.eps)offerNext();
  });
  $('v').addEventListener('pause',()=>{if(on&&playing)updatePlayPause()});
  $('v').addEventListener('play',()=>{if(on&&playing)updatePlayPause()});
  $('vodsource').addEventListener('change',()=>{
    srcId=$('vodsource').value;idxRows();screen='home';zone='rows';paintHome();
  });
  $('vodsort').onclick=cycleSort;
  $('vodsearch').onclick=searchPrompt;
  $('vodheroaction').onclick=()=>{
    const card=heroCard;if(!card)return;
    const record=cardRecord(card);
    if(record&&Model&&Model.shouldResume(record)&&!watched()[cardId(card)])playCard(card,record.position||0,false);
    else showDetails(card,screen==='series'?'series':'home');
  };

  /* ---------- فتح وإغلاق ---------- */
  function open(){
    if(on)return;
    if(window.__qpOn&&window.__qpOn()&&window.__quickClose)window.__quickClose();
    cancelDetailRequest();el.classList.remove('vod-details');
    on=true;
    LS.set('m3u_last_was_vod',true);
    if(!LS.get('m3u_tip_vod',false)){LS.set('m3u_tip_vod',true);toast('اضغط OK لفتح التفاصيل، واختر المصدر لتصفية المكتبة دون تغيير مصدر البث الحي.')}
    lastLive=shown.find(i=>i.url===curUrl)||null;
    tok++;stopAll();
    el.classList.add('on');B.classList.add('vod');
    zone='rows';screen='home';cat='';sideIdx=0;tabsEl.textContent='';
    msgBody('جارٍ تحليل المكتبة…');
    build().then(()=>{idxRows();paintHome()}).catch(()=>msgBody('تعذّر تحليل المكتبة'));
  }
  function close(){
    if(screen==='trailer')closeTrailer();
    cancelDetailRequest();el.classList.remove('vod-details');
    if(playing)stopPlay();
    on=false;el.classList.remove('on');B.classList.remove('vod','cine-play','cine-mini');
    if(lastLive){const it=lastLive;lastLive=null;play(it)}
  }
  window.__openVod=function(id){srcId=(typeof id==='string')?id:'';open()};
  /* رجوع واحد لكل الأجهزة: يغلق أعلى طبقة فقط. موسّع ← مصغّر ← مغادرة الشاشة (التشغيل مستمر) ← إيقاف المشغّل برجوع مزدوج ← خروج. */
  window.__vodBack=function(){
    if(!on)return false;
    if(screen==='trailer'){closeTrailer();return true}
    if(B.classList.contains('cine-play')){minimizePlayer();return true}
    if(screen==='details'){returnFromDetails();return true}
    if(screen==='series'){zone='rows';paintHome();return true}
    if(B.classList.contains('cine-mini')){
      const now=Date.now();
      if(now-stopArmedAt<2500){stopArmedAt=0;closeMiniPlayer();toast('تم إيقاف التشغيل')}
      else{stopArmedAt=now;zone='player';paintTabs();markCards();toast('اضغط رجوع مرة أخرى لإيقاف التشغيل')}
      return true;
    }
    close();return true;
  };
  document.addEventListener('keydown',e=>{
    if(!on||document.querySelector('dialog[open]'))return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    e.preventDefault();e.stopPropagation();
    const k=e.key;
    const route=Remote?Remote.routeKey({
      fullscreen:B.classList.contains('cine-play'),
      detailMini:B.classList.contains('cine-mini')&&playerFromDetails&&screen==='details',
      mini:B.classList.contains('cine-mini'),
      details:screen==='details',
      series:screen==='series'
    },k):null;
    if(route==='fullscreen')playKey(k);
    else if(k==='Escape'||k==='Backspace')window.__vodBack();
    else if(route==='media')playKey(k);
    else if(screen==='series')seriesKey(k);
    else if(screen==='home')homeKey(k);
    else if(screen==='details')detailKey(k);
  },true);
})();
