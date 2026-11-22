/* ===== مكتبة الأفلام والمسلسلات (VOD): وضع مستقل بمعزل عن البث المباشر =====
   • تعرض الأفلام والمسلسلات من روابطها المخصصة فقط (detectKind)، ولا تعرض البث المباشر.
   • المسلسلات تُجمَّع بالمواسم والحلقات من أسماء مثل S01E02 أو «الموسم 1 الحلقة 2».
   • أي مصدر جديد فيه أفلام يظهر هنا تلقائياً (إضافة مكتبات لاحقاً = إضافة مصدر).
   التنقل: ↑ ↓ بين الصفوف · ← → داخل الصف · OK فتح · رجوع خطوة للخلف. */
(function(){
  const el=$('vod'),bodyEl=$('vodb'),tabsEl=$('vtabs'),B=document.body,playerOverlay=$('vod-player-overlay'),playerFrame=$('vod-player-frame');
  const playerHost=$('player').parentElement;
  const Remote=window.WasslaVodRemote;
  const SourceModel=window.WasslaSourceModel;
  let vodSelected=[],vodSrcOpen=false,vodSrcIdx=0,vodSrcRows=[],query='',on=false,idx=null,idxSig='',filter='all',view=[],gi=0,cat='',rendered=0,gcols=1,gridEl=null,io=null,zone='rows',tIdx=0,scroller=null,sideEl=null,sideIdx=0,sideItems=[],sort='recent';
  let desktopShelves=new Map(),desktopRows=[],renderedDesktop=false,stopArmedAt=0;
  let continueShelfEl=null,continueCards=[],ci=0,heroBtnIdx=0;
  let osdZone='video',barIdx=0,optsOpen=false,optIdx=0,activeEngine='',manualEngineOverride='',nativeFullscreen=false,nativeFullscreenExitedAt=0;
  let seekAnchor=null,seekPillTimer=null,stallTimer=null,stallStage=0,stallSince=0,lastPlayTime=0,nextOfferedUrl='',nextDismissedUrl='',scrub=null;
  let screen='home',detailReturn='home',detailOrigin='home',cur=null,curEps=[],sIdx=0,eIdx=0,playing=null,lastLive=null,playerBackground='home',playerScrollTop=0;
  let nextTimer=null,nextCard=null,nextEpisode=null,progressTimer=null,trackHideTimer=null,detailScrollTop=0,detailRowScroll=[],detailIndex=0,detailToken=0,detailController=null,detailOverlay=null,playerFromDetails=false,playerDetailOrigin='home',trailerFocus=null,pendingRestore=null;
  let libraryScrollTop=0;
  const detailCache=new Map();
  const recCache=new Map();
  let recState={sig:'',loading:false,error:'',data:null},recController=null,recToken=0,recInlineHost=null;
  const CHUNK=60;
  const Model=window.WasslaVodModel;
  const isVodSrcOn=id=>vodSelected.includes(id);
  const progress=()=>LS.get('m3u_vod_progress',{});
  const watched=()=>LS.get('m3u_vod_watched',{});
  const vodFavs=()=>LS.get('m3u_vod_favorites',{});
  const isVodFav=c=>!!(c&&vodFavs()[cardId(c)]);
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const desktopLayout=()=>!!(window.matchMedia&&window.matchMedia('(min-width:1200px) and (hover:hover) and (pointer:fine)').matches)&&!B.classList.contains('tv');
  const useShelves=()=>(desktopLayout()||B.classList.contains('tv'))&&!cat&&!query&&(filter==='all'||filter==='movies'||filter==='series');
  const toast=t=>{if(window.WasslaNotify)WasslaNotify(t,{ms:3200});else if(window.__rcvToast)window.__rcvToast(t)};
  const Metadata=window.WasslaVodMetadata;
  const densityOptions=['compact','balanced','comfortable'];
  const titleSizeOptions=['small','medium','large'];
  function applyLibraryAppearance(){
    if(!el)return;
    const density=LS.get('m3u_vod_density','compact');
    const titleSize=LS.get('m3u_vod_title_size','medium');
    el.dataset.density=densityOptions.includes(density)?density:'compact';
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
    const root=detailOverlay||bodyEl;
    const buttons=[...root.querySelectorAll('.vdetails button')].filter(button=>!button.disabled&&button.getClientRects().length);
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
          series.set('xt:'+it.url,{kind:'series',title:it.name,logo:it.logo||'',group:it.group||'مسلسلات',eps:[],lazy:it.url,item:it,sourceId:l.id,sourceName:l.name});
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
    const seriesList=[...series.values()];
    const bySource=new Map();
    movies.forEach(m=>{const s=bySource.get(m.sourceId)||{movies:0,series:0};s.movies++;bySource.set(m.sourceId,s)});
    seriesList.forEach(sr=>{const s=bySource.get(sr.sourceId)||{movies:0,series:0};s.series++;bySource.set(sr.sourceId,s)});
    idx={movies,series:seriesList,bySource};idxSig=s;
    syncVodSelection();
  }
  function ratingOf(c){
    if(c.rating!==undefined)return c.rating;
    const raw=c.item&&c.item.raw||'';
    const attrMatch=/(?:imdb[-_]?rating|tvg-rating|rating)="([^"]*)"/i.exec(raw);
    let r=attrMatch?parseFloat(String(attrMatch[1]).replace(',','.')):0;
    if(!(r>0&&r<=10)){
      const titleMatch=/\bimdb[\s:_-]*(\d(?:\.\d)?)\b/i.exec(c.title||'');
      if(titleMatch)r=parseFloat(titleMatch[1]);
    }
    return c.rating=(r>0&&r<=10)?r:null;
  }
  let catList=[];
  function makeView(order=sort){
    if(filter==='recommended'){
      catList=[];cat='';
      const favCards=getFavoriteCards();
      const sig=recSignature(favCards);
      const cached=recCache.get(sig)||(recState.sig===sig?recState.data:null);
      if(!cached||!cached.libraryPicks||!cached.libraryPicks.length)return[];
      const q=Model.normalizeSearch(query);
      const picks=cached.libraryPicks.map(p=>Object.assign({},p.card,{recMeta:p}));
      return q?picks.filter(c=>[c.title,c.group,c.sourceName,c.recMeta.matchedGenre,c.recMeta.reason].some(v=>Model.normalizeSearch(v).includes(q))):picks;
    }
    const candidates=[];
    if(filter!=='series')candidates.push(...idx.movies);
    if(filter!=='movies')candidates.push(...idx.series);
    const q=Model.normalizeSearch(query);
    const all=candidates.filter(c=>isVodSrcOn(c.sourceId)&&(!q||[
      c.title,c.group,c.sourceName
    ].some(value=>Model.normalizeSearch(value).includes(q))));
    const seen=watched(),favMap=vodFavs();
    const filtered=filter==='favorites'?all.filter(c=>!!favMap[cardId(c)]):
      filter==='watched'?all.filter(c=>!!seen[cardId(c)]):
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
    else if(filter==='favorites')out.sort((a,b)=>(favMap[cardId(b)]||0)-(favMap[cardId(a)]||0));
    return out;
  }

  /* ---------- الرسم ---------- */
  function updateHero(c){
    heroCard=c||null;
    const hero=$('vodh'),art=$('vpimg'),action=$('vodheroaction'),detailsBtn=$('vodherodetails'),progWrap=$('vodheroprog'),progFill=$('vodherofill');
    hero.classList.toggle('empty',!c);
    if(!c){
      $('vpt').textContent='';$('vps').textContent='';
      action.hidden=true;if(detailsBtn)detailsBtn.hidden=true;if(progWrap)progWrap.hidden=true;
      art.hidden=true;art.removeAttribute('src');delete art.dataset.url;
      return;
    }
    $('vpt').textContent=niceTitle(c.title);
    const record=c.resumeRecord||cardRecord(c);
    const canResume=!!(record&&Model&&Model.shouldResume(record)&&!watched()[cardId(c)]);
    const heroMeta=Metadata&&Metadata.extractFromItem?Metadata.extractFromItem(c):null;
    const heroYear=heroMeta&&heroMeta.year?heroMeta.year:'';
    const heroRating=ratingOf(c);
    $('vps').textContent=(c.kind==='series'?'مسلسل'+(c.eps.length?' · '+c.eps.length+' حلقة':''):'فيلم')+
      (heroYear?' · '+heroYear:'')+
      (c.group?' · '+c.group:'')+(c.sourceName?' · '+c.sourceName:'')+
      (heroRating?' · IMDb ★ '+heroRating.toFixed(1):'')+(canResume?' · متابعة عند '+fmt(record.position):'');
    if(c.logo){
      if(art.dataset.url!==c.logo){art.dataset.url=c.logo;art.src=c.logo}
      art.hidden=false;art.onerror=()=>{art.hidden=true};
    }else{
      art.hidden=true;art.removeAttribute('src');delete art.dataset.url;
    }
    if(progWrap&&progFill){
      const pct=canResume&&Model?Model.progressPercent(record):0;
      progWrap.hidden=!(canResume&&pct>0);
      progFill.style.width=pct+'%';
    }
    action.textContent=canResume?'▶ متابعة المشاهدة':'▶ تشغيل الآن';
    action.hidden=false;
    if(detailsBtn)detailsBtn.hidden=false;
  }
  function getVodCandidateSources(){
    const out=[];
    for(const l of (lists||[])){
      if(!l||l.id===FAV_LIST_ID||l.id==='builtin')continue;
      let movies=0,series=0;
      if(idx&&idxSig===sig()&&idx.bySource){
        const counts=idx.bySource.get(l.id);
        if(counts){movies=counts.movies||0;series=counts.series||0}
      }else if(window.__sourceStatsOf){
        const st=window.__sourceStatsOf(l);
        if(st){movies=st.movies||0;series=st.series||0}
      }else{
        try{parseM3U(l.text).forEach(it=>{const k=libKind(it);if(k==='movie')movies++;else if(k==='series')series++})}catch(e){}
      }
      if(movies+series>0)out.push({id:l.id,name:l.name,movies,series});
    }
    return out;
  }
  function syncVodSelection(forceIncludeId){
    const cands=getVodCandidateSources();
    const validIds=cands.map(c=>c.id);
    const stored=LS.get('m3u_vod_sources',null);
    const known=LS.get('m3u_vod_known_sources',[]);
    if(SourceModel){
      const res=SourceModel.reconcileAddedSource(stored,known,validIds);
      vodSelected=res.selected;
      LS.set('m3u_vod_known_sources',res.known);
    }else{
      vodSelected=stored===null?validIds.slice():(Array.isArray(stored)?stored.filter(id=>validIds.includes(id)):[]);
      LS.set('m3u_vod_known_sources',validIds);
    }
    if(forceIncludeId&&validIds.includes(forceIncludeId)&&!vodSelected.includes(forceIncludeId)){
      vodSelected=vodSelected.concat(forceIncludeId);
    }
    LS.set('m3u_vod_sources',vodSelected);
    return cands;
  }
  function vodSourcesSummary(){
    const cands=syncVodSelection();
    if(!cands.length)return 'لا توجد مصادر';
    if(SourceModel)return SourceModel.summarizeSelection(vodSelected,cands,'غير محدد');
    if(!vodSelected.length)return 'غير محدد';
    return vodSelected.length===1?(cands.find(c=>c.id===vodSelected[0])?.name||'مصدر'):'كل المصادر ('+vodSelected.length+')';
  }
  function formatVodMeta(c){
    const p=[];
    if(c.movies)p.push(c.movies+' فيلم');
    if(c.series)p.push(c.series+' مسلسل');
    return p.join(' · ');
  }
  function renderVodSourcePop(){
    const pop=$('vodsrcpop');if(!pop)return;
    const cands=syncVodSelection();
    const selSet=new Set(vodSelected);
    pop.textContent='';
    const head=document.createElement('div');head.className='vsrc-head';
    const title=document.createElement('span');title.textContent='🎬 مصادر المكتبة (تأشير متعدد)';
    const closeBtn=document.createElement('button');closeBtn.type='button';closeBtn.className='vsrc-close';closeBtn.textContent='✕';
    closeBtn.onclick=e=>{e.stopPropagation();closeVodSourcePop()};
    head.append(title,closeBtn);
    const sub=document.createElement('div');sub.className='vsrc-subnote';
    sub.textContent='اختيارك هنا مستقل تماماً عن مصادر القنوات المباشرة';
    pop.append(head,sub);
    vodSrcRows=[];
    if(!cands.length){
      const empty=document.createElement('div');empty.className='vsrc-subnote';
      empty.textContent='لا توجد مصادر تحتوي على أفلام أو مسلسلات حالياً.';
      pop.appendChild(empty);
      return;
    }
    const allChecked=cands.length>0&&cands.every(c=>selSet.has(c.id));
    if(cands.length>1){
      const btn=document.createElement('button');btn.type='button';
      btn.className='vsrc-item all-toggle'+(vodSrcIdx===0?' sel':'');
      const ico=document.createElement('span');ico.className='vsrc-ico';ico.textContent=allChecked?'☑':'☐';
      const nm=document.createElement('span');nm.className='vsrc-name';nm.textContent=allChecked?'إلغاء تحديد كل المصادر':'تحديد كل مصادر المكتبة';
      const meta=document.createElement('span');meta.className='vsrc-meta';meta.textContent=selSet.size+' من '+cands.length;
      btn.append(ico,nm,meta);
      const run=()=>{
        if(allChecked)window.__vodSources.clear();
        else window.__vodSources.selectAll();
      };
      btn.onclick=e=>{e.stopPropagation();vodSrcIdx=0;run()};
      pop.appendChild(btn);
      vodSrcRows.push({btn,run});
    }
    cands.forEach(c=>{
      const checked=selSet.has(c.id);
      const idxRow=vodSrcRows.length;
      const btn=document.createElement('button');btn.type='button';
      btn.className='vsrc-item'+(checked?' on':'')+(vodSrcIdx===idxRow?' sel':'');
      btn.setAttribute('aria-pressed',checked?'true':'false');
      const chk=document.createElement('span');chk.className='vsrc-chk'+(checked?' on':'');chk.textContent=checked?'✓':'';
      const nm=document.createElement('span');nm.className='vsrc-name';nm.textContent=c.name;
      const meta=document.createElement('span');meta.className='vsrc-meta';meta.textContent=formatVodMeta(c);
      btn.append(chk,nm,meta);
      const run=()=>{window.__vodSources.toggle(c.id)};
      btn.onclick=e=>{e.stopPropagation();vodSrcIdx=idxRow;run()};
      pop.appendChild(btn);
      vodSrcRows.push({btn,run});
    });
    if(vodSrcIdx>=vodSrcRows.length)vodSrcIdx=Math.max(0,vodSrcRows.length-1);
    vodSrcRows.forEach((r,i)=>r.btn.classList.toggle('sel',i===vodSrcIdx));
    if(vodSrcOpen&&vodSrcRows[vodSrcIdx])vodSrcRows[vodSrcIdx].btn.scrollIntoView({block:'nearest'});
  }
  function openVodSourcePop(){
    const pop=$('vodsrcpop'),btn=$('vodsource');
    if(!pop)return;
    vodSrcOpen=true;vodSrcIdx=0;
    pop.classList.remove('hide');
    if(btn){btn.classList.add('open');btn.setAttribute('aria-expanded','true')}
    renderVodSourcePop();
  }
  function closeVodSourcePop(){
    vodSrcOpen=false;
    const pop=$('vodsrcpop'),btn=$('vodsource');
    if(pop)pop.classList.add('hide');
    if(btn){btn.classList.remove('open');btn.setAttribute('aria-expanded','false')}
  }
  function toggleVodSourcePop(){
    if(vodSrcOpen)closeVodSourcePop();
    else openVodSourcePop();
  }
  function vodSourcePopKey(k){
    if(!vodSrcOpen)return false;
    if(k==='ArrowDown'){vodSrcIdx=Math.min(Math.max(0,vodSrcRows.length-1),vodSrcIdx+1);renderVodSourcePop();return true}
    if(k==='ArrowUp'){
      if(vodSrcIdx>0){vodSrcIdx--;renderVodSourcePop()}
      else{closeVodSourcePop();zone='source';markCards()}
      return true;
    }
    if(k==='Enter'){const r=vodSrcRows[vodSrcIdx];if(r)r.run();return true}
    return false;
  }
  function sourceOptions(){
    const btn=$('vodsource');
    if(!btn)return;
    const sum=vodSourcesSummary();
    btn.textContent='📂 المصادر: '+sum;
    btn.classList.toggle('open',vodSrcOpen);
    btn.classList.toggle('sel',zone==='source');
    btn.setAttribute('aria-expanded',vodSrcOpen?'true':'false');
  }
  window.__vodSources={
    candidates:()=>getVodCandidateSources(),
    getSelected:()=>{syncVodSelection();return vodSelected.slice()},
    isSelected:id=>{syncVodSelection();return vodSelected.includes(id)},
    toggle(id){
      syncVodSelection();
      const validIds=getVodCandidateSources().map(c=>c.id);
      vodSelected=SourceModel?SourceModel.toggleSelection(vodSelected,id,validIds):(vodSelected.includes(id)?vodSelected.filter(x=>x!==id):vodSelected.concat(id));
      LS.set('m3u_vod_sources',vodSelected);
      if(on){idxRows();if(screen==='home')paintHome();else sourceOptions();if(vodSrcOpen)renderVodSourcePop()}
      return vodSelected.slice();
    },
    selectAll(){
      const validIds=getVodCandidateSources().map(c=>c.id);
      vodSelected=validIds.slice();
      LS.set('m3u_vod_sources',vodSelected);
      if(on){idxRows();if(screen==='home')paintHome();else sourceOptions();if(vodSrcOpen)renderVodSourcePop()}
      return vodSelected.slice();
    },
    clear(){
      vodSelected=[];
      LS.set('m3u_vod_sources',vodSelected);
      if(on){idxRows();if(screen==='home')paintHome();else sourceOptions();if(vodSrcOpen)renderVodSourcePop()}
      return[];
    },
    summary:()=>vodSourcesSummary(),
    count:()=>{
      syncVodSelection();
      const set=new Set(vodSelected);
      return getVodCandidateSources().reduce((sum,c)=>set.has(c.id)?sum+c.movies+c.series:sum,0);
    }
  };
  const SORTS={recent:'الأحدث',az:'أ ← ي',rating:'الأعلى تقييماً'};
  /* «مقترح لك» يحتاج خادم الويب (/api/vod/recommendations) ولا يعمل داخل تطبيق الأندرويد (file:) فيُخفى هناك */
  const REC_OK=location.protocol!=='file:';
  const TOP_TABS=[['all','الكل'],['movies','أفلام'],['series','مسلسلات'],['favorites','★ المفضلة'],['recommended','✨ مقترح لك']].filter(t=>REC_OK||t[0]!=='recommended');
  function countVodFavs(){
    if(!idx)return 0;
    const favMap=vodFavs();
    let count=0;
    for(const c of idx.movies){if(isVodSrcOn(c.sourceId)&&favMap[cardId(c)])count++}
    for(const c of idx.series){if(isVodSrcOn(c.sourceId)&&favMap[cardId(c)])count++}
    return count;
  }
  function getFavoriteCards(){
    if(!idx)return[];
    const favMap=vodFavs(),out=[];
    for(const c of idx.movies){if(isVodSrcOn(c.sourceId)&&favMap[cardId(c)])out.push(c)}
    for(const c of idx.series){if(isVodSrcOn(c.sourceId)&&favMap[cardId(c)])out.push(c)}
    out.sort((a,b)=>(favMap[cardId(b)]||0)-(favMap[cardId(a)]||0));
    return out;
  }
  function recSignature(favCards){
    return vodSelected.join(',')+'|'+(idxSig||'')+'|'+favCards.map(cardId).sort().join('||');
  }
  function cancelRecRequest(){
    recToken++;
    if(recController){recController.abort();recController=null}
  }
  function serializeCardForRec(c){
    const lm=Metadata&&Metadata.extractFromItem?Metadata.extractFromItem(c):{};
    return{
      id:cardId(c),
      title:niceTitle(c.title)||c.title,
      kind:c.kind==='series'?'series':'movie',
      group:c.group||'',
      genre:lm.genre||'',
      year:lm.year||'',
      rating:ratingOf(c)
    };
  }
  function extractGenreTokens(text){
    const norm=Model?Model.normalizeSearch(text):String(text||'').toLowerCase();
    return norm.split(/[\s|\/,&\-–—،]+/).filter(tok=>tok.length>=2&&!/^(?:افلام|أفلام|فيلم|مسلسلات|مسلسل|movies?|series|vod|عام|all|arabic|عربي|اجنبي|أجنبي|مترجم|مدبلج)$/i.test(tok));
  }
  function buildRecPayload(favCards){
    const favIds=new Set(favCards.map(cardId));
    const favItems=favCards.slice(0,25).map(serializeCardForRec);
    const favTokens=new Set();
    favItems.forEach(item=>{
      extractGenreTokens(item.group).forEach(t=>favTokens.add(t));
      extractGenreTokens(item.genre).forEach(t=>favTokens.add(t));
    });
    const moviePool=idx?idx.movies.filter(c=>isVodSrcOn(c.sourceId)&&!favIds.has(cardId(c))):[];
    let pool=moviePool;
    if(pool.length<20&&idx){
      const seriesExtra=idx.series.filter(c=>isVodSrcOn(c.sourceId)&&!favIds.has(cardId(c)));
      pool=[...moviePool,...seriesExtra];
    }
    const scored=pool.map((c,pos)=>{
      const lm=Metadata&&Metadata.extractFromItem?Metadata.extractFromItem(c):{};
      const tokens=[...extractGenreTokens(c.group),...extractGenreTokens(lm.genre)];
      let overlap=0;
      tokens.forEach(t=>{if(favTokens.has(t))overlap++});
      const r=ratingOf(c)||0;
      return{c,overlap,r,pos};
    });
    const matched=scored.filter(x=>x.overlap>0).sort((a,b)=>b.overlap-a.overlap||b.r-a.r||b.pos-a.pos);
    const rest=scored.filter(x=>x.overlap===0).sort((a,b)=>b.r-a.r||b.pos-a.pos);
    const selected=[];
    const pickedIds=new Set();
    const take=(list,limit)=>{
      for(const x of list){
        if(selected.length>=limit)break;
        const id=cardId(x.c);
        if(pickedIds.has(id))continue;
        pickedIds.add(id);
        selected.push(x.c);
      }
    };
    take(matched,65);
    take(rest,100);
    if(selected.length<100)take(matched,100);
    const cardLookup=new Map();
    const catalog=selected.map(c=>{
      const id=cardId(c);
      cardLookup.set(id,c);
      return serializeCardForRec(c);
    });
    return{payload:{favorites:favItems,catalog},cardLookup};
  }
  async function loadRecommendations(force){
    if(!idx)return;
    const favCards=getFavoriteCards();
    if(!favCards.length){
      cancelRecRequest();
      recState={sig:'',loading:false,error:'',data:null};
      refreshRecommendationsUi();
      return;
    }
    const sig=recSignature(favCards);
    if(!force&&recCache.has(sig)){
      recState={sig,loading:false,error:'',data:recCache.get(sig)};
      refreshRecommendationsUi();
      return;
    }
    if(!force&&recState.loading&&recState.sig===sig)return;
    cancelRecRequest();
    const token=++recToken;
    recController=typeof AbortController==='function'?new AbortController():null;
    recState={sig,loading:true,error:'',data:null};
    refreshRecommendationsUi();
    const {payload,cardLookup}=buildRecPayload(favCards);
    try{
      const res=await fetch('/api/vod/recommendations',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        signal:recController?recController.signal:undefined
      });
      const json=await res.json().catch(()=>({}));
      if(token!==recToken)return;
      recController=null;
      if(!res.ok){
        throw new Error((json&&json.error)||'تعذّر جلب اقتراحات الأفلام المشابهة حالياً.');
      }
      const libraryPicks=[];
      if(Array.isArray(json.libraryPicks)){
        for(const p of json.libraryPicks){
          const card=p&&cardLookup.get(p.catalogId);
          if(!card)continue;
          libraryPicks.push({
            card,
            matchedGenre:p.matchedGenre||'',
            matchScore:p.matchScore||88,
            reason:p.reason||''
          });
        }
      }
      const data={
        detectedGenres:Array.isArray(json.detectedGenres)?json.detectedGenres:[],
        summary:typeof json.summary==='string'?json.summary:'',
        libraryPicks,
        externalSuggestions:Array.isArray(json.externalSuggestions)?json.externalSuggestions:[]
      };
      recCache.set(sig,data);
      recState={sig,loading:false,error:'',data};
      refreshRecommendationsUi();
    }catch(err){
      if(token!==recToken||(err&&err.name==='AbortError'))return;
      recController=null;
      recState={sig,loading:false,error:(err&&err.message)||'تعذّر الاتصال بخدمة الاقتراحات.',data:null};
      refreshRecommendationsUi();
    }
  }
  function refreshRecommendationsUi(){
    if(!on||screen!=='home')return;
    if(filter==='recommended'){
      idxRows();
      paintHome();
      return;
    }
    if(filter==='favorites'&&recInlineHost&&recInlineHost.isConnected){
      renderInlineRecShelf(recInlineHost);
    }
  }
  function selectTab(key,i){
    tIdx=typeof i==='number'?i:Math.max(0,TOP_TABS.findIndex(t=>t[0]===key));
    if(screen!=='home'){
      cancelDetailRequest();
      restorePlayerFromDetails();
      playerFromDetails=false;
      B.classList.remove('vod-detail-play');
      el.classList.remove('vod-details');
      $('vodh').classList.remove('hide');
    }
    filter=key;cat='';zone='rows';idxRows();paintHome();
  }
  function paintTabs(){
    tabsEl.textContent='';
    const favCount=countVodFavs();
    TOP_TABS.forEach(([key,label],i)=>{
      const b=document.createElement('button');
      b.type='button';
      const activeTab=screen==='home'&&filter===key;
      b.className='vt'+(key==='favorites'?' vt-fav':key==='recommended'?' vt-rec':'')+(activeTab?' on':'')+(zone==='tabs'&&tIdx===i?' sel':'');
      b.setAttribute('aria-pressed',activeTab?'true':'false');
      b.textContent=label;
      if(key==='favorites'&&favCount>0){
        const badge=document.createElement('span');
        badge.className='vt-count';
        badge.textContent=String(favCount);
        b.appendChild(badge);
      }
      b.onclick=()=>selectTab(key,i);
      tabsEl.appendChild(b);
    });
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
    toggleVodSourcePop();
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
  function getContinueCards(){
    if(!idx||cat||query||(filter!=='all'&&filter!=='movies'&&filter!=='series'))return[];
    const records=progress(),marks=watched(),latestSeries=new Map(),out=[];
    Object.values(records).forEach(rec=>{
      if(!rec||!rec.seriesTitle||!Model||!Model.shouldResume(rec))return;
      const key=(rec.sourceId||'')+':'+rec.seriesTitle,old=latestSeries.get(key);
      if(!old||(rec.updated||0)>(old.updated||0))latestSeries.set(key,rec);
    });
    const pool=[];
    if(filter!=='series')pool.push(...idx.movies);
    if(filter!=='movies')pool.push(...idx.series);
    for(const card of pool){
      if(!isVodSrcOn(card.sourceId))continue;
      if(marks[cardId(card)])continue;
      const rec=card.kind==='movie'?records[card.item.url]:(latestSeries.get(card.sourceId+':'+card.title)||(card.lazy?records[card.lazy]:null));
      if(rec&&Model&&Model.shouldResume(rec))out.push(Object.assign({},card,{resumeRecord:rec}));
    }
    out.sort((a,b)=>(b.resumeRecord.updated||0)-(a.resumeRecord.updated||0));
    return out.slice(0,20);
  }
  function idxRows(){
    view=makeView();gi=0;
    continueCards=getContinueCards();
    if(ci>=continueCards.length)ci=Math.max(0,continueCards.length-1);
    const recentView=sort==='recent'?view:makeView('recent');
    updateHero(continueCards[0]||recentView[0]||view[0]||null);
  }
  function loadImg(im){
    const u=im.dataset.s;if(!u)return;im.dataset.s='';im.decoding='async';
    im.onload=()=>im.classList.add('ld');
    im.onerror=()=>{const d=im.closest('.vc');im.remove();if(d)d.classList.add('noimg')};
    im.src=u;
  }
  function buildProgressLookup(){
    const records=progress(),marks=watched(),favs=vodFavs(),seriesMap=new Map();
    Object.values(records).forEach(rec=>{
      if(!rec||!rec.seriesTitle)return;
      const key=(rec.sourceId||'')+':'+rec.seriesTitle;
      const prev=seriesMap.get(key);
      const recResume=!!(Model&&Model.shouldResume(rec));
      const prevResume=!!(prev&&Model&&Model.shouldResume(prev));
      if(!prev||(recResume&&!prevResume)||(recResume===prevResume&&(rec.updated||0)>(prev.updated||0))){
        seriesMap.set(key,rec);
      }
    });
    return{records,marks,favs,seriesMap};
  }
  function lookupCardRecord(c,cache){
    if(c.resumeRecord)return c.resumeRecord;
    const records=cache?cache.records:progress();
    if(c.kind==='movie')return records[c.item.url]||null;
    if(cache)return cache.seriesMap.get((c.sourceId||'')+':'+c.title)||(c.lazy?records[c.lazy]:null)||null;
    return cardRecord(c);
  }
  function buildCardProgressEl(rec){
    if(!rec||!Model||!Model.shouldResume(rec))return null;
    const pct=Model.progressPercent(rec);
    if(pct<=0)return null;
    const rem=Number.isFinite(rec.duration)?Math.max(0,rec.duration-rec.position):0;
    const wrap=document.createElement('div');
    wrap.className='vc-progress';
    wrap.setAttribute('role','progressbar');
    wrap.setAttribute('aria-valuemin','0');
    wrap.setAttribute('aria-valuemax','100');
    wrap.setAttribute('aria-valuenow',String(pct));
    wrap.title='توقّفت عند '+fmt(rec.position)+' من '+fmt(rec.duration)+' ('+pct+'%)';
    const track=document.createElement('div');track.className='vc-ptrack';
    const fill=document.createElement('span');fill.className='vc-pfill';fill.style.width=pct+'%';
    track.appendChild(fill);
    const meta=document.createElement('div');meta.className='vc-pmeta';
    const pctEl=document.createElement('span');pctEl.className='vc-ppct';pctEl.textContent=pct+'%';
    const timeEl=document.createElement('span');timeEl.className='vc-ptime';
    timeEl.textContent=rem>0?'متبقي '+fmt(rem):'عند '+fmt(rec.position);
    meta.append(pctEl,timeEl);
    wrap.append(track,meta);
    return wrap;
  }
  function syncCardProgress(card){
    if(!card||!gridEl||!gridEl.isConnected)return;
    const id=cardId(card);
    const isWatched=!!watched()[id];
    const rec=isWatched?null:cardRecord(card);
    for(const node of gridEl.querySelectorAll('.vc')){
      const idxNum=+node.dataset.n;
      const item=view[idxNum];
      if(!item||cardId(item)!==id)continue;
      const poster=node.querySelector('.vp');
      const titleNode=node.querySelector('.vn');
      if(poster){
        let badge=poster.querySelector('.vwatched');
        if(isWatched&&!badge){badge=document.createElement('span');badge.className='vwatched';badge.textContent='✓ تمت المشاهدة';poster.appendChild(badge)}
        else if(!isWatched&&badge){badge.remove()}
      }
      const oldBar=node.querySelector('.vc-progress');
      const newBar=isWatched?null:buildCardProgressEl(rec);
      if(oldBar)oldBar.remove();
      if(newBar){
        if(titleNode)node.insertBefore(newBar,titleNode);
        else node.appendChild(newBar);
      }
    }
  }
  function cardEl(c,i,cache){
    const d=document.createElement('div');d.className='vc';d.dataset.n=i;d.dataset.cid=cardId(c);
    const p=document.createElement('div');p.className='vp';p.dataset.i=((c.title||'?').trim()[0])||'?';
    if(c.logo){const im=document.createElement('img');im.alt='';im.dataset.s=c.logo;p.appendChild(im);if(io)io.observe(im);else loadImg(im)}else d.classList.add('noimg');
    const r=ratingOf(c);
    if(r){const b=document.createElement('span');b.className='vr';b.textContent=r.toFixed(1);p.appendChild(b)}
    if(c.kind==='series'){const b=document.createElement('i');b.textContent='مسلسل';p.appendChild(b)}
    const isWatched=!!(cache?cache.marks:watched())[cardId(c)];
    if(isWatched){const b=document.createElement('span');b.className='vwatched';b.textContent='✓ تمت المشاهدة';p.appendChild(b)}
    const isFav=!!(cache?cache.favs:vodFavs())[cardId(c)];
    const favBtn=document.createElement('button');
    favBtn.type='button';
    favBtn.className='vfav-btn'+(isFav?' on':'');
    favBtn.textContent=isFav?'★':'☆';
    favBtn.setAttribute('aria-pressed',isFav?'true':'false');
    favBtn.setAttribute('aria-label',isFav?'إزالة من المفضلة':'إضافة إلى المفضلة');
    favBtn.title=isFav?'إزالة من المفضلة':'إضافة إلى المفضلة';
    favBtn.onclick=e=>{e.stopPropagation();toggleVodFav(c)};
    p.appendChild(favBtn);
    const rec=isWatched?null:lookupCardRecord(c,cache);
    const progEl=buildCardProgressEl(rec);
    const nm=document.createElement('div');nm.className='vn';nm.textContent=niceTitle(c.title);nm.title=c.title;
    if(progEl)d.append(p,progEl,nm);
    else d.append(p,nm);
    if(c.recMeta){
      const match=document.createElement('div');match.className='vc-rec-meta';
      const pill=document.createElement('span');pill.className='vc-match';
      pill.textContent=(c.recMeta.matchScore?c.recMeta.matchScore+'% · ':'')+(c.recMeta.matchedGenre||'مقترح');
      match.appendChild(pill);
      if(c.recMeta.reason){
        const rsn=document.createElement('div');rsn.className='vc-reason';rsn.textContent=c.recMeta.reason;rsn.title=c.recMeta.reason;
        match.appendChild(rsn);
      }
      d.appendChild(match);
    }
    return d;
  }
  function renderMore(to){
    if(!gridEl)return;
    const end=Math.min(view.length,Math.max(to,rendered+CHUNK)),fr=document.createDocumentFragment();
    const cache=buildProgressLookup();
    for(let i=rendered;i<end;i++){
      const card=view[i],node=cardEl(card,i,cache);
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
      const target=renderedDesktop?(gridEl&&gridEl.querySelector('.vdshelf-grid')):gridEl;
      if(!target){gcols=1;return}
      gcols=Math.max(1,getComputedStyle(target).gridTemplateColumns.split(' ').filter(x=>x&&x!=='none').length);
    }catch(e){gcols=1}
  }
  window.addEventListener('resize',()=>{
    if(screen!=='home'||!gridEl||!gridEl.isConnected)return;
    if(renderedDesktop!==useShelves()){idxRows();paintHome();return}
    calcCols();markCards();
  });

  /* ---------- العمود الجانبي: الفلاتر الإضافية ثم التصنيفات ---------- */
  const SIDE_FILTERS=[['resume','▶ متابعة المشاهدة'],['watched','✓ تمت مشاهدتها'],['unwatched','◷ لم تتم مشاهدتها']];
  function buildSide(){
    const keep=sideEl?sideEl.scrollTop:0;
    sideItems=SIDE_FILTERS.map(([k,l])=>({t:'type',v:k,l}));
    catList.forEach(c=>sideItems.push({t:'cat',v:c.k,l:c.title,n:c.n}));
    sideIdx=Math.min(sideIdx,Math.max(0,sideItems.length-1));
    sideEl=document.createElement('div');sideEl.className='vside';
    const addHeading=label=>{
      const heading=document.createElement('div');
      heading.className='vside-heading';
      heading.setAttribute('role','heading');
      heading.setAttribute('aria-level','2');
      heading.textContent=label;
      sideEl.appendChild(heading);
    };
    sideItems.forEach((it,i)=>{
      if(i===0&&SIDE_FILTERS.length)addHeading('تصفية');
      if(i===SIDE_FILTERS.length&&catList.length)addHeading('التصنيفات');
      const d=document.createElement('div');d.dataset.i=i;
      if(it.t==='type')d.dataset.type=it.v;
      d.className='vsi'+((it.t==='type'?filter===it.v:cat===it.v&&filter!=='resume'&&filter!=='recommended')?' on':'');
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
    const items=sideEl.querySelectorAll('.vsi');
    [...items].forEach((d,i)=>d.classList.toggle('sel',zone==='side'&&i===sideIdx));
    const s=items[sideIdx];if(s&&zone==='side')s.scrollIntoView({block:'nearest'});
  }
  const FL={all:'الكل',favorites:'المفضلة',recommended:'مقترح لك',resume:'متابعة المشاهدة',movies:'أفلام',series:'مسلسلات',watched:'تمت مشاهدتها',unwatched:'لم تتم مشاهدتها'};

  function buildRecSkeleton(count){
    const grid=document.createElement('div');grid.className='vrec-skel-grid';
    for(let i=0;i<count;i++){
      const item=document.createElement('div');item.className='vrec-skel-card';
      const poster=document.createElement('div');poster.className='vrec-skel-poster';
      const line1=document.createElement('div');line1.className='vrec-skel-line';
      const line2=document.createElement('div');line2.className='vrec-skel-line short';
      item.append(poster,line1,line2);
      grid.appendChild(item);
    }
    return grid;
  }
  function buildExternalSuggestionsEl(list){
    const sec=document.createElement('section');sec.className='vrec-external';
    const heading=document.createElement('h3');heading.className='vrec-ext-title';
    heading.textContent='🎬 أفلام سينمائية مشابهة لذوقك';
    sec.appendChild(heading);
    const grid=document.createElement('div');grid.className='vrec-ext-grid';
    list.forEach(item=>{
      const card=document.createElement('div');card.className='vrec-ext-card';
      const top=document.createElement('div');top.className='vrec-ext-top';
      const name=document.createElement('strong');name.className='vrec-ext-name';name.textContent=item.title;
      top.appendChild(name);
      if(item.imdbRating){
        const im=document.createElement('span');im.className='vrec-ext-imdb';im.textContent='IMDb ★ '+item.imdbRating;
        top.appendChild(im);
      }
      const tags=document.createElement('div');tags.className='vrec-ext-tags';
      if(item.genre){const g=document.createElement('span');g.textContent=item.genre;tags.appendChild(g)}
      if(item.year){const y=document.createElement('span');y.textContent=item.year;tags.appendChild(y)}
      const reason=document.createElement('p');reason.className='vrec-ext-reason';reason.textContent=item.reason||'';
      const searchBtn=addAction('🔎 بحث في المكتبة',()=>{
        query=item.title;filter='all';cat='';idxRows();paintHome();
      },'vrec-ext-btn');
      card.append(top,tags,reason,searchBtn);
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    return sec;
  }
  function renderInlineRecShelf(host){
    host.textContent='';
    const favCards=getFavoriteCards();
    if(!favCards.length){host.hidden=true;return}
    host.hidden=false;
    const sig=recSignature(favCards);
    const data=recCache.get(sig)||(recState.sig===sig?recState.data:null);
    const loading=recState.loading&&recState.sig===sig;
    const errText=(!loading&&recState.sig===sig)?recState.error:'';

    const head=document.createElement('div');head.className='vrec-inline-head';
    const titleWrap=document.createElement('div');titleWrap.className='vrec-inline-titlewrap';
    const heading=document.createElement('h3');heading.className='vrec-inline-title';
    heading.textContent='✨ أفلام مشابهة بناءً على مفضلاتك';
    titleWrap.appendChild(heading);
    if(data&&data.detectedGenres&&data.detectedGenres.length){
      const genres=document.createElement('div');genres.className='vrec-genres';
      data.detectedGenres.forEach(g=>{const s=document.createElement('span');s.className='vrec-genre-chip';s.textContent=g;genres.appendChild(s)});
      titleWrap.appendChild(genres);
    }
    const btns=document.createElement('div');btns.className='vrec-inline-actions';
    const refreshBtn=addAction(loading?'جارٍ التحليل…':'🔄 تحديث',()=>loadRecommendations(true),'vrec-btn');
    refreshBtn.disabled=loading;
    const allBtn=addAction('عرض الكل ⟵',()=>selectTab('recommended'),'vrec-btn primary');
    btns.append(refreshBtn,allBtn);
    head.append(titleWrap,btns);
    host.appendChild(head);

    if(loading){
      const status=document.createElement('div');status.className='vrec-loading-msg';
      status.textContent='جارٍ تحليل أنواع أفلامك المفضلة عبر واجهة برمجة التطبيقات واقتراح أعمال مشابهة…';
      host.append(status,buildRecSkeleton(5));
      return;
    }
    if(errText){
      const box=document.createElement('div');box.className='vrec-error';
      const p=document.createElement('p');p.textContent=errText;
      const retry=addAction('↺ إعادة المحاولة',()=>loadRecommendations(true),'vrec-btn primary');
      box.append(p,retry);
      host.appendChild(box);
      return;
    }
    if(!data){
      loadRecommendations(false);
      return;
    }
    if(data.summary){
      const sum=document.createElement('p');sum.className='vrec-summary';sum.textContent=data.summary;
      host.appendChild(sum);
    }
    if(data.libraryPicks&&data.libraryPicks.length){
      const strip=document.createElement('div');strip.className='vrec-strip';
      const cache=buildProgressLookup();
      data.libraryPicks.slice(0,8).forEach((pick,i)=>{
        const enriched=Object.assign({},pick.card,{recMeta:pick});
        const node=cardEl(enriched,i,cache);
        node.onclick=e=>{if(e.target.closest('.vfav-btn'))return;showDetails(pick.card,'home')};
        strip.appendChild(node);
      });
      host.appendChild(strip);
    }else if(data.externalSuggestions&&data.externalSuggestions.length){
      host.appendChild(buildExternalSuggestionsEl(data.externalSuggestions.slice(0,4)));
    }else{
      const empty=document.createElement('div');empty.className='vrec-inline-empty';
      empty.textContent='أضف المزيد من الأفلام إلى مكتبتك أو مفضلتك لتحسين دقة الاقتراحات.';
      host.appendChild(empty);
    }
  }
  function paintRecommended(main){
    const favCards=getFavoriteCards();
    if(!favCards.length){
      $('vcount').textContent=FL.recommended+' · 0 عنصر';
      msgInto(main,'لا توجد أفلام في المفضلة بعد لتوليد اقتراحات مشابهة.\nاضغط على ★ في بطاقة أي فيلم أو مسلسل وسيتم اقتراح أفلام مشابهة لنوعه تلقائياً.');
      const wrap=main.querySelector('.vempty');
      if(wrap){
        const btn=addAction('🎬 تصفح الأفلام',()=>selectTab('movies',1),'vempty-btn');
        wrap.appendChild(document.createElement('br'));
        wrap.appendChild(btn);
      }
      updateHero(null);
      if(zone==='rows')zone='side';
      markCards();
      return;
    }

    const sig=recSignature(favCards);
    const data=recCache.get(sig)||(recState.sig===sig?recState.data:null);
    const loading=recState.loading&&recState.sig===sig;
    const errText=(!loading&&recState.sig===sig)?recState.error:'';

    const banner=document.createElement('section');banner.className='vrec-banner';
    const bInfo=document.createElement('div');bInfo.className='vrec-banner-info';
    const bTitle=document.createElement('h2');bTitle.className='vrec-banner-title';
    bTitle.textContent='✨ أفلام مقترحة مشابهة لمفضلاتك';
    bInfo.appendChild(bTitle);
    const bSub=document.createElement('p');bSub.className='vrec-summary';
    bSub.textContent=data&&data.summary?data.summary:('بناءً على '+favCards.length+' عنصر في مفضلتك لتحليل الأنواع المشابهة واقتراح أفضل الأفلام لك.');
    bInfo.appendChild(bSub);
    if(data&&data.detectedGenres&&data.detectedGenres.length){
      const genres=document.createElement('div');genres.className='vrec-genres';
      const gLbl=document.createElement('span');gLbl.className='vrec-genre-lbl';gLbl.textContent='الأنواع المفضلة لديك:';
      genres.appendChild(gLbl);
      data.detectedGenres.forEach(g=>{const s=document.createElement('span');s.className='vrec-genre-chip';s.textContent=g;genres.appendChild(s)});
      bInfo.appendChild(genres);
    }
    const bActions=document.createElement('div');bActions.className='vrec-banner-actions';
    const refBtn=addAction(loading?'جارٍ التحديث…':'🔄 تحديث الاقتراحات',()=>loadRecommendations(true),'vrec-btn primary');
    refBtn.disabled=loading;
    bActions.appendChild(refBtn);
    banner.append(bInfo,bActions);
    main.appendChild(banner);

    if(loading){
      $('vcount').textContent=FL.recommended+' · جارٍ التحليل…';
      const status=document.createElement('div');status.className='vrec-loading-msg';
      status.textContent='جارٍ تحليل أنواع أفلامك المفضلة عبر واجهة برمجة التطبيقات واقتراح أفلام مشابهة…';
      main.append(status,buildRecSkeleton(8));
      updateHero(null);
      markCards();
      return;
    }
    if(errText){
      $('vcount').textContent=FL.recommended+' · تعذّر التحميل';
      const box=document.createElement('div');box.className='vrec-error';
      const p=document.createElement('p');p.textContent=errText;
      const retry=addAction('↺ إعادة المحاولة',()=>loadRecommendations(true),'vrec-btn primary');
      box.append(p,retry);
      main.appendChild(box);
      updateHero(null);
      markCards();
      return;
    }
    if(!data){
      loadRecommendations(false);
      return;
    }

    const totalCount=view.length+(data.externalSuggestions?data.externalSuggestions.length:0);
    $('vcount').textContent=FL.recommended+' · '+totalCount+' اقتراح';

    if(view.length){
      if(io)io.disconnect();
      io=('IntersectionObserver' in window)?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);loadImg(e.target)}}),{root:main,rootMargin:'600px 0px'}):null;
      gridEl=document.createElement('div');gridEl.className='vgrid vrec-grid';main.appendChild(gridEl);
      rendered=0;renderMore(view.length);
    }else if(!data.externalSuggestions||!data.externalSuggestions.length){
      const empty=document.createElement('div');empty.className='vempty';
      empty.textContent=query?'لا توجد نتائج مطابقة داخل المقترحات.':'لم نعثر على أفلام إضافية مشابهة في هذا المصدر حالياً.';
      main.appendChild(empty);
      updateHero(null);
    }
    if(data.externalSuggestions&&data.externalSuggestions.length){
      main.appendChild(buildExternalSuggestionsEl(data.externalSuggestions));
    }
    markCards();
  }

  function renderContinueShelf(main){
    continueShelfEl=null;
    if(!continueCards.length)return;
    const shelf=document.createElement('section');shelf.className='vcontinue-shelf';
    const head=document.createElement('div');head.className='vcontinue-head';
    const title=document.createElement('h2');title.className='vcontinue-title';title.textContent='▶ متابعة المشاهدة';
    const count=document.createElement('span');count.className='vcontinue-count';count.textContent=continueCards.length+' عمل';
    head.append(title,count);
    const track=document.createElement('div');track.className='vcontinue-track';
    const cache=buildProgressLookup();
    continueCards.forEach((card,i)=>{
      const node=cardEl(card,i,cache);
      node.classList.add('vc-continue');
      delete node.dataset.n;
      node.dataset.cont=i;
      track.appendChild(node);
    });
    shelf.append(head,track);
    main.appendChild(shelf);
    continueShelfEl=shelf;
  }
  function paintHome(){
    cancelDetailRequest();clearDetailsOverlay();el.classList.remove('vod-details');
    screen='home';paintTabs();bodyEl.textContent='';gridEl=null;continueShelfEl=null;recInlineHost=null;
    renderedDesktop=useShelves();desktopShelves=new Map();desktopRows=[];
    bodyEl.classList.add('home');
    $('vodh').classList.remove('hide');
    sourceOptions();
    const catTitle=cat?((catList.find(c=>c.k===cat)||{}).title||''):'';
    $('vcount').textContent=(catTitle||FL[filter])+' · '+view.length+' عنصر';
    buildSide();
    const main=document.createElement('div');main.className='vmain';scroller=main;
    bodyEl.append(sideEl,main);
    if(filter==='recommended'){
      paintRecommended(main);
      return;
    }
    if(!view.length){
      const hasVodCandidates=getVodCandidateSources().length>0;
      const noneSelected=hasVodCandidates&&vodSelected.length===0;
      const empty=noneSelected?'لم يتم تحديد أي مصدر للمكتبة حالياً.\nاضغط على «📂 المصادر» للتأشير على مصدر واحد أو أكثر.':
        filter==='favorites'?(query?'لا توجد نتائج مطابقة داخل المفضلة.':'قائمة المفضلة فارغة حالياً.\nاضغط على ★ في بطاقة أي فيلم أو مسلسل لإضافته إلى المفضلة والوصول إليه بسهولة لاحقاً.'):
        filter==='resume'?'لا يوجد ما تتابعه الآن.\nابدأ فيلماً أو حلقة وسيظهر هنا تلقائياً.':
        filter==='watched'?'لا توجد مواد محددة كمشاهَدة.':
        filter==='unwatched'?'لا توجد مواد غير مشاهَدة في هذا المصدر.':
        query?'لا توجد نتائج مطابقة في المصادر المحددة والنوع المختار.':'لا توجد أفلام أو مسلسلات في مصادرك بعد.\nأضف مصدراً فيه مكتبة (ملف M3U أو رابط أو سيرفر Xtream) وستظهر أفلامك ومسلسلاتك هنا تلقائياً.';
      msgInto(main,empty);
      if(noneSelected){
        const wrap=main.querySelector('.vempty');
        if(wrap){
          const btn=addAction('📂 اختيار مصادر المكتبة',()=>openVodSourcePop(),'vempty-btn');
          wrap.appendChild(document.createElement('br'));
          wrap.appendChild(btn);
        }
      }else if(!query&&filter==='all'){
        const wrap=main.querySelector('.vempty');
        if(wrap){
          const btn=addAction('➕ إضافة مصدر (M3U / Xtream)',()=>{close();if(window.__openSettings)window.__openSettings('addsource')},'vempty-btn');
          wrap.appendChild(document.createElement('br'));
          wrap.appendChild(btn);
        }
      }else if(!query&&filter==='favorites'){
        const wrap=main.querySelector('.vempty');
        if(wrap){
          const btn=addAction('🎬 تصفح المكتبة',()=>selectTab('all',0),'vempty-btn');
          wrap.appendChild(document.createElement('br'));
          wrap.appendChild(btn);
        }
      }
      updateHero(null);
      if(zone==='rows'||zone==='continue'||zone==='hero')zone='side';
      markCards();return;
    }
    if(io)io.disconnect();
    io=('IntersectionObserver' in window)?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);loadImg(e.target)}}),{root:main,rootMargin:'600px 0px'}):null;
    renderContinueShelf(main);
    gridEl=document.createElement('div');gridEl.className=renderedDesktop?'vdshelves':'vgrid';main.appendChild(gridEl);
    main.addEventListener('scroll',()=>{
      if(gridEl&&rendered<view.length&&main.scrollTop+main.clientHeight*2.5>main.scrollHeight)renderMore(rendered+CHUNK);
    },{passive:true});
    gridEl.addEventListener('scroll',e=>{
      const track=e.target;
      if(renderedDesktop&&track.classList.contains('vdshelf-grid')&&rendered<view.length&&track.scrollLeft+track.clientWidth*1.5>track.scrollWidth)renderMore(rendered+CHUNK);
    },true);
    rendered=0;renderMore(Math.max(CHUNK,gi+gcols*3));
    if(filter==='favorites'&&!query){
      recInlineHost=document.createElement('section');
      recInlineHost.className='vrec-inline-section';
      main.appendChild(recInlineHost);
      renderInlineRecShelf(recInlineHost);
    }
    markCards();
  }
  bodyEl.addEventListener('click',e=>{
    if(screen!=='home'||!gridEl)return;
    if(e.target.closest('.vfav-btn')||e.target.closest('.vrec-strip'))return;
    const cont=e.target.closest('.vc-continue');
    if(cont){
      ci=+cont.dataset.cont||0;zone='continue';markCards();
      if(continueCards[ci])showDetails(continueCards[ci],'home');
      return;
    }
    const d=e.target.closest('.vc');if(!d)return;
    gi=+d.dataset.n;zone='rows';markCards();showDetails(view[gi],'home');
  });
  function keepVisible(c){
    const sc=scroller;if(!sc)return;
    const row=c.closest('.vdshelf-grid,.vcontinue-track');
    if(row){
      const bounds=row.getBoundingClientRect(),cardBounds=c.getBoundingClientRect();
      if(cardBounds.left<bounds.left+18)row.scrollLeft-=bounds.left+18-cardBounds.left;
      else if(cardBounds.right>bounds.right-18)row.scrollLeft+=cardBounds.right-(bounds.right-18);
    }
    const pad=18,viewport=sc.getBoundingClientRect(),card=c.getBoundingClientRect(),poster=c.querySelector('.vp');
    const posterBounds=poster&&poster.getBoundingClientRect(),top=posterBounds?Math.min(card.top,posterBounds.top):card.top;
    const bottom=posterBounds?Math.max(card.bottom,posterBounds.bottom):card.bottom;
    if(top<viewport.top+pad)sc.scrollTop-=viewport.top+pad-top;
    else if(bottom>viewport.bottom-pad)sc.scrollTop+=bottom-(viewport.bottom-pad);
  }
  function markCards(){
    if(gridEl){const o=gridEl.querySelector('.vc.sel');if(o)o.classList.remove('sel')}
    if(continueShelfEl){const o=continueShelfEl.querySelector('.vc.sel');if(o)o.classList.remove('sel')}
    const hAct=$('vodheroaction'),hDet=$('vodherodetails');
    if(hAct)hAct.classList.toggle('sel',zone==='hero'&&heroBtnIdx===0);
    if(hDet)hDet.classList.toggle('sel',zone==='hero'&&heroBtnIdx===1);
    paintTabs();markSide();
    if(zone==='hero'&&heroCard){
      if(scroller)scroller.scrollTop=0;
      return;
    }
    if(zone==='continue'&&continueShelfEl&&continueCards.length){
      const cc=continueShelfEl.querySelector('.vc[data-cont="'+ci+'"]');
      if(cc){cc.classList.add('sel');keepVisible(cc);updateHero(continueCards[ci])}
      return;
    }
    if(zone!=='rows'||!view.length||!gridEl)return;
    const c=gridEl.querySelector('.vc[data-n="'+gi+'"]');
    if(c){c.classList.add('sel');keepVisible(c);updateHero(view[gi])}
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
    button.setAttribute('aria-label',label);
    button.title=label;
    const icon=document.createElement('span');icon.className='vplay-icon';icon.textContent='▶';icon.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.textContent=label;
    text.className='vplay-label';button.append(icon,text);return button;
  }
  function cancelDetailRequest(){
    detailToken++;
    if(detailController){detailController.abort();detailController=null}
  }
  function addMetaChip(parent,label,accent,seen){
    const text=String(label||'').trim();
    if(!text)return null;
    const norm=text.toLowerCase();
    if(seen&&seen.has(norm))return null;
    if(seen)seen.add(norm);
    const chip=document.createElement('span');chip.className='vdetail-chip'+(accent?' accent':'');chip.textContent=text;
    parent.appendChild(chip);return chip;
  }
  function addDetailFact(parent,label,cls){
    const row=document.createElement('div');row.className='vdetail-fact'+(cls?' '+cls:'');row.hidden=true;
    const title=document.createElement('small');title.textContent=label;
    const value=document.createElement('span');row.append(title,value);parent.appendChild(row);
    const set=text=>{
      const clean=String(text||'').trim();
      value.textContent=clean;
      row.hidden=!clean;
    };
    return{row,value,set};
  }
  function syncFactsVisibility(factsEl){
    if(!factsEl)return;
    const anyVisible=[...factsEl.children].some(child=>!child.hidden);
    factsEl.hidden=!anyVisible;
  }
  function syncCardSummaryVisibility(nodes){
    if(!nodes||!nodes.cardSummary)return;
    nodes.cardSummary.hidden=nodes.summaryImdb.hidden&&nodes.summaryYear.hidden;
  }
  function setImdbDisplay(nodes,score,imdbId){
    const cleanScore=String(score||'').trim();
    if(!cleanScore)return false;
    const cleanId=String(imdbId||'').trim();
    if(nodes.imdbBadge){
      nodes.imdbBadge.hidden=false;
      nodes.imdbScoreEl.textContent=cleanScore;
      nodes.imdbBadge.title=cleanId?'تقييم IMDb ('+cleanId+')':'تقييم IMDb';
    }
    if(nodes.summaryImdb){
      nodes.summaryImdb.hidden=false;
      nodes.summaryImdbVal.textContent=cleanScore;
    }
    if(nodes.facts&&nodes.facts.imdb){
      const valEl=nodes.facts.imdb.value;
      valEl.textContent='';
      const wrap=document.createElement('span');wrap.className='vdetail-imdb-inline';
      const tag=document.createElement('b');tag.className='vimdb-tag';tag.textContent='IMDb';
      const star=document.createElement('em');star.className='vimdb-star';star.textContent='★';
      const num=document.createElement('strong');num.textContent=cleanScore;
      const den=document.createElement('i');den.textContent='/10';
      wrap.append(tag,star,num,den);
      valEl.appendChild(wrap);
      nodes.facts.imdb.row.hidden=false;
      nodes.facts.imdb.row.title=cleanId?'IMDb: '+cleanId:'';
    }
    syncCardSummaryVisibility(nodes);
    return true;
  }
  function setYearDisplay(nodes,year){
    const cleanYear=String(year||'').trim();
    if(!cleanYear)return false;
    if(nodes.yearBadge){
      nodes.yearBadge.hidden=false;
      nodes.yearValueEl.textContent=cleanYear;
    }
    if(nodes.summaryYear){
      nodes.summaryYear.hidden=false;
      nodes.summaryYearVal.textContent=cleanYear;
    }
    if(nodes.facts&&nodes.facts.year){
      nodes.facts.year.set(cleanYear);
    }
    syncCardSummaryVisibility(nodes);
    return true;
  }
  function formatCastCount(n){
    if(n===1)return 'ممثل واحد';
    if(n===2)return 'ممثلان';
    return n<=10?n+' ممثلين':n+' ممثل';
  }
  function renderShortCast(nodes,castInput){
    if(!nodes||!nodes.shortCast||!nodes.shortCastList)return;
    const actors=Metadata&&Metadata.parseCast?Metadata.parseCast(castInput).slice(0,3):[];
    nodes.shortCastList.textContent='';
    nodes.shortCast.hidden=!actors.length;
    actors.forEach(name=>{
      const item=document.createElement('span');item.className='vdetail-short-actor';
      const avatar=document.createElement('span');avatar.className='vdetail-short-avatar';
      avatar.setAttribute('aria-hidden','true');
      avatar.textContent=Metadata&&Metadata.actorInitials?Metadata.actorInitials(name):name.slice(0,2);
      const label=document.createElement('span');label.className='vdetail-short-name';label.textContent=name;
      item.append(avatar,label);nodes.shortCastList.appendChild(item);
    });
  }
  function renderQuickMeta(nodes,values){
    if(!nodes||!nodes.quickMeta)return;
    const parts=[
      ['year',values.year],
      ['genre',values.genre],
      ['category',values.category],
      ['director',values.director]
    ].filter(([,value])=>String(value||'').trim());
    nodes.quickMeta.textContent='';
    parts.forEach(([kind,value])=>{
      const item=document.createElement('span');item.className='vdetail-quick-item vdetail-quick-'+kind;
      item.textContent=kind==='director'?'إخراج: '+value:String(value);
      nodes.quickMeta.appendChild(item);
    });
    nodes.quickMeta.hidden=!parts.length;
  }
  function renderCastSection(nodes,castInput){
    if(!nodes||!nodes.castSection)return false;
    const actors=Metadata&&Metadata.parseCast?Metadata.parseCast(castInput):[];
    if(!actors.length)return false;
    nodes.castList.textContent='';
    nodes.castCount.textContent=formatCastCount(actors.length);
    const LIMIT=10;
    const extraItems=[];
    actors.forEach((name,idx)=>{
      const item=document.createElement('div');
      item.className='vcast-item';
      const avatar=document.createElement('span');
      avatar.className='vcast-avatar';
      avatar.setAttribute('aria-hidden','true');
      avatar.textContent=Metadata&&Metadata.actorInitials?Metadata.actorInitials(name):name.slice(0,2);
      const label=document.createElement('span');
      label.className='vcast-name';
      label.textContent=name;
      item.append(avatar,label);
      if(idx>=LIMIT){item.hidden=true;extraItems.push(item)}
      nodes.castList.appendChild(item);
    });
    if(nodes.castMoreBtn){
      if(extraItems.length){
        let expanded=false;
        nodes.castMoreBtn.hidden=false;
        nodes.castMoreBtn.textContent='عرض كل الممثلين (+'+extraItems.length+')';
        nodes.castMoreBtn.onclick=()=>{
          expanded=!expanded;
          extraItems.forEach(item=>{item.hidden=!expanded});
          nodes.castMoreBtn.textContent=expanded?'عرض أقل':'عرض كل الممثلين (+'+extraItems.length+')';
        };
      }else{
        nodes.castMoreBtn.hidden=true;
        nodes.castMoreBtn.onclick=null;
      }
    }
    nodes.castSection.hidden=false;
    return true;
  }
  function setBackdropImage(img,url){
    if(!img)return;
    const clean=String(url||'').trim();
    if(!clean){img.hidden=true;img.classList.remove('ld');img.removeAttribute('src');return}
    img.hidden=true;img.classList.remove('ld');
    img.onload=()=>{img.hidden=false;img.classList.add('ld')};
    img.onerror=()=>{img.hidden=true;img.classList.remove('ld');img.removeAttribute('src')};
    img.src=clean;
  }
  function setPosterImage(posterEl,url,titleText){
    if(!posterEl)return;
    posterEl.dataset.i=((String(titleText||'?').trim()[0])||'?');
    const clean=String(url||'').trim();
    if(!clean){
      posterEl.querySelectorAll('img').forEach(im=>im.remove());
      posterEl.classList.add('noimg');
      return;
    }
    const cover=document.createElement('img');
    cover.className='vdetail-cover';
    cover.alt='';
    cover.onload=()=>{
      posterEl.querySelectorAll('img').forEach(im=>{if(im!==cover)im.remove()});
      cover.classList.add('ld');
      posterEl.classList.remove('noimg');
    };
    cover.onerror=()=>{
      cover.remove();
      if(!posterEl.querySelector('img'))posterEl.classList.add('noimg');
    };
    if(!posterEl.querySelector('img'))posterEl.classList.add('noimg');
    posterEl.appendChild(cover);
    cover.src=clean;
  }
  function renderDetailsMetadata(data,nodes){
    if(!data)return 0;
    let added=0;
    const addChip=(val,accent)=>{if(val&&addMetaChip(nodes.meta,val,accent,nodes.chipSet))added++};
    const score=data.imdbRating||data.rating||'';
    if(score&&setImdbDisplay(nodes,score,data.imdbId))added++;
    if(data.year&&setYearDisplay(nodes,data.year))added++;
    if(data.quality)addChip(data.quality,true);
    if(data.duration)addChip(data.duration,false);
    if(data.age)addChip(data.age,false);
    if(data.genre)addChip(data.genre,false);

    if(data.overview){nodes.overview.textContent=data.overview;nodes.overview.hidden=false;added++}
    if(data.genre&&(!nodes.baseGroup||data.genre.toLowerCase()!==nodes.baseGroup.toLowerCase())){nodes.facts.genre.set(data.genre);added++}
    if(data.releaseDate&&data.releaseDate!==data.year){nodes.facts.releaseDate.set(data.releaseDate);added++}
    if(data.duration){nodes.facts.duration.set(data.duration);added++}
    if(data.quality){
      const fmtVal=nodes.localMeta&&nodes.localMeta.format;
      const merged=[data.quality,fmtVal].filter(Boolean).join(' · ');
      nodes.facts.quality.set(merged);added++;
    }
    if(data.country){nodes.facts.country.set(data.country);added++}
    if(data.age){nodes.facts.age.set(data.age);added++}
    if(data.director){nodes.facts.director.set(data.director);added++}
    const castVal=(data.castList&&data.castList.length)?data.castList:data.cast;
    if(castVal&&renderCastSection(nodes,castVal))added++;
    if(castVal)renderShortCast(nodes,castVal);
    renderQuickMeta(nodes,{
      year:data.year||(nodes.localMeta&&nodes.localMeta.year),
      genre:data.genre||(nodes.localMeta&&nodes.localMeta.genre),
      category:nodes.baseGroup,
      director:data.director||(nodes.localMeta&&nodes.localMeta.director)
    });
    syncFactsVisibility(nodes.factsEl);

    if(data.backdrop){setBackdropImage(nodes.backdrop,data.backdrop);added++}
    if(data.poster){setPosterImage(nodes.poster,data.poster,cur&&cur.title);added++}
    const trailerId=Metadata&&Metadata.youtubeId(data.trailer);
    if(trailerId){
      nodes.trailerSection.hidden=false;
      nodes.trailer.hidden=false;
      const thumb=data.backdrop||data.poster||(cur&&cur.logo)||'';
      if(thumb){
        nodes.trailerImage.hidden=false;
        nodes.trailerImage.onerror=()=>{nodes.trailerImage.hidden=true};
        nodes.trailerImage.src=thumb;
      }else nodes.trailerImage.hidden=true;
      nodes.trailer.onclick=()=>openTrailer(trailerId);
      added++;
    }
    return added;
  }
  async function loadDetailsMetadata(card,nodes){
    if(!Metadata)return;
    const source=lists.find(list=>list.id===card.sourceId)||null;
    if(!Metadata.requestUrl(card,source))return;
    const token=++detailToken,key=cardId(card);
    if(detailCache.has(key)){
      renderDetailsMetadata(detailCache.get(key),nodes);
      nodes.status.textContent='';
      return;
    }
    nodes.status.textContent='جارٍ تحميل تفاصيل إضافية من المصدر…';
    detailController=typeof AbortController==='function'?new AbortController():null;
    try{
      const data=await Metadata.fetchInfo(card,source,window.fetch.bind(window),detailController&&detailController.signal);
      if(token!==detailToken||screen!=='details'||cur!==card)return;
      detailController=null;detailCache.set(key,data);
      renderDetailsMetadata(data,nodes);
      nodes.status.textContent='';
    }catch(error){
      if(token!==detailToken||error&&error.name==='AbortError')return;
      detailController=null;
      nodes.status.textContent='تعذّر جلب التفاصيل الإضافية من المصدر (تُعرض البيانات المحلية المتاحة).';
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
    clearDetailsOverlay();
    cur=card;detailReturn=returnTo||'home';detailOrigin=detailReturn;screen='details';zone='details';
    el.classList.add('vod-details');
    const nowPlaying=!!(playing&&playing.card===card&&playerFromDetails);
    if(nowPlaying&&B.classList.contains('cine-mini'))B.classList.add('vod-detail-play');
    paintTabs();
    detailScrollTop=(scroller&&scroller.isConnected)?scroller.scrollTop:0;

    const overlay=document.createElement('div');overlay.className='vdetail-overlay';
    overlay.setAttribute('role','presentation');
    const panel=document.createElement('section');panel.className='vdetails';
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    panel.setAttribute('aria-label',card.kind==='series'?'تفاصيل المسلسل':'تفاصيل الفيلم');
    const backdrop=document.createElement('img');backdrop.className='vdetail-backdrop';backdrop.alt='';backdrop.setAttribute('aria-hidden','true');backdrop.hidden=true;
    setBackdropImage(backdrop,card.logo);

    const shell=document.createElement('div');shell.className='vdetail-shell';

    const topbar=document.createElement('div');topbar.className='vdetail-topbar';
    const backLabel=detailReturn==='series'?'→ العودة إلى الحلقات':'→ العودة إلى القائمة';
    topbar.appendChild(addAction(backLabel,()=>returnFromDetails(),'vdetail-back'));
    const topTag=document.createElement('span');topTag.className='vdetail-topbar-tag';
    topTag.textContent=(card.kind==='series'?'📺 بطاقة المسلسل':'🎬 بطاقة الفيلم')+(card.sourceName?' · '+card.sourceName:'');
    topbar.appendChild(topTag);
    shell.appendChild(topbar);

    let playerStage=null;
    if(nowPlaying){
      playerStage=document.createElement('div');playerStage.className='vdetail-player-stage';
      playerStage.appendChild($('player'));
      shell.appendChild(playerStage);
    }

    const head=document.createElement('div');head.className='vdetail-head';
    const poster=document.createElement('div');poster.className='vdetail-poster';
    setPosterImage(poster,card.logo,card.title);

    const info=document.createElement('div');info.className='vdetail-info';
    const title=document.createElement('h2');title.textContent=niceTitle(card.title);info.appendChild(title);

    const localMeta=Metadata&&Metadata.extractFromItem?Metadata.extractFromItem(card):{year:'',imdbRating:'',imdbId:'',castList:[],director:'',genre:'',overview:'',country:'',age:'',quality:'',language:'',format:''};
    const quickMeta=document.createElement('div');quickMeta.className='vdetail-quick-meta';
    const shortCast=document.createElement('section');shortCast.className='vdetail-short-cast';shortCast.hidden=true;
    const shortCastHeading=document.createElement('h3');shortCastHeading.textContent='بطولة';
    const shortCastList=document.createElement('div');shortCastList.className='vdetail-short-cast-list';
    shortCast.append(shortCastHeading,shortCastList);
    renderQuickMeta({quickMeta},{
      year:localMeta.year,
      genre:localMeta.genre,
      category:card.group,
      director:localMeta.director
    });
    const chipSet=new Set();
    const meta=document.createElement('div');meta.className='vdetail-meta';

    /* شارة تقييم IMDb الاحترافية (تظهر عند توفر التقييم) */
    const imdbBadge=document.createElement('span');imdbBadge.className='vdetail-imdb';imdbBadge.hidden=true;
    const imdbTag=document.createElement('b');imdbTag.className='vimdb-tag';imdbTag.textContent='IMDb';
    const imdbStar=document.createElement('span');imdbStar.className='vimdb-star';imdbStar.setAttribute('aria-hidden','true');imdbStar.textContent='★';
    const imdbScoreEl=document.createElement('strong');imdbScoreEl.className='vimdb-score';
    const imdbDen=document.createElement('small');imdbDen.className='vimdb-den';imdbDen.textContent='/10';
    imdbBadge.append(imdbTag,imdbStar,imdbScoreEl,imdbDen);
    meta.appendChild(imdbBadge);

    /* شارة سنة الإنتاج */
    const yearBadge=document.createElement('span');yearBadge.className='vdetail-year';yearBadge.hidden=true;
    const yearLabel=document.createElement('small');yearLabel.textContent='سنة الإنتاج';
    const yearValueEl=document.createElement('strong');
    yearBadge.append(yearLabel,yearValueEl);
    meta.appendChild(yearBadge);

    addMetaChip(meta,card.kind==='series'?'مسلسل':'فيلم',false,chipSet);
    const baseRating=ratingOf(card);
    if(localMeta.quality)addMetaChip(meta,localMeta.quality,true,chipSet);
    if(localMeta.language)addMetaChip(meta,localMeta.language,false,chipSet);
    if(localMeta.format)addMetaChip(meta,localMeta.format,false,chipSet);
    if(localMeta.age)addMetaChip(meta,localMeta.age,false,chipSet);
    if(localMeta.genre)addMetaChip(meta,localMeta.genre,false,chipSet);
    let seriesCountText='';
    if(card.kind==='series'&&card.eps&&card.eps.length){
      const seasonCount=new Set(card.eps.map(e=>e.s)).size;
      seriesCountText=(seasonCount>1?seasonCount+' مواسم · ':'')+card.eps.length+' حلقة';
      addMetaChip(meta,seriesCountText,false,chipSet);
    }
    if(card.group)addMetaChip(meta,card.group,false,chipSet);
    info.append(meta,quickMeta);
    renderShortCast({shortCast,shortCastList},localMeta.castList);

    const rec=cardRecord(card),cardWatched=!!watched()[cardId(card)];
    const canResume=!!(rec&&Model&&Model.shouldResume(rec)&&!cardWatched);
    if(canResume){
      const pct=Model.progressPercent(rec);
      const rem=Number.isFinite(rec.duration)?Math.max(0,rec.duration-rec.position):0;
      const pWrap=document.createElement('div');pWrap.className='vdetail-progress-wrap';
      const pLabel=document.createElement('div');pLabel.className='vdetail-progress-label';
      const pLeft=document.createElement('span');pLeft.textContent='متابعة المشاهدة · '+pct+'%';
      const pRight=document.createElement('span');pRight.textContent=rem>0?'متبقي '+fmt(rem):'عند '+fmt(rec.position);
      pLabel.append(pLeft,pRight);
      const pBar=document.createElement('div');pBar.className='vdetail-progress';pBar.style.setProperty('--progress',pct+'%');
      pWrap.append(pLabel,pBar);
      info.appendChild(pWrap);
    }

    const actions=document.createElement('div');actions.className='vdetail-actions';
    actions.appendChild(addPlayAction(canResume?'متابعة':'تشغيل',()=>playCard(card,canResume?rec.position:0,true)));
    const cardFav=isVodFav(card);
    const favBtn=addAction('',()=>toggleVodFav(card),'alt vfav-action'+(cardFav?' on':''));
    const favIcon=document.createElement('span');favIcon.className='vfav-icon';favIcon.textContent=cardFav?'★':'☆';favIcon.setAttribute('aria-hidden','true');
    favBtn.appendChild(favIcon);
    favBtn.setAttribute('aria-label',cardFav?'إزالة من المفضلة':'إضافة إلى المفضلة');
    favBtn.setAttribute('title',cardFav?'إزالة من المفضلة':'إضافة إلى المفضلة');
    favBtn.dataset.act='vod-fav';
    favBtn.setAttribute('aria-pressed',cardFav?'true':'false');
    actions.appendChild(favBtn);

    const extra=document.createElement('div');extra.className='vdetail-extra';
    extra.id='vdetail-extra';
    extra.hidden=true;
    const cardBox=document.createElement('div');cardBox.className='vdetail-card-box';

    const cardHead=document.createElement('div');cardHead.className='vdetail-card-head';
    const cardHeading=document.createElement('h3');cardHeading.className='vdetail-card-heading';
    cardHeading.textContent=card.kind==='series'?'بطاقة المسلسل':'بطاقة الفيلم';
    const cardSummary=document.createElement('div');cardSummary.className='vdetail-card-summary';cardSummary.hidden=true;
    const summaryImdb=document.createElement('span');summaryImdb.className='vsummary-pill vimdb-mini';summaryImdb.hidden=true;
    const sImdbTag=document.createElement('b');sImdbTag.className='vimdb-tag';sImdbTag.textContent='IMDb';
    const sImdbStar=document.createElement('em');sImdbStar.className='vimdb-star';sImdbStar.textContent='★';
    const summaryImdbVal=document.createElement('strong');
    summaryImdb.append(sImdbTag,sImdbStar,summaryImdbVal);
    const summaryYear=document.createElement('span');summaryYear.className='vsummary-pill vyear-mini';summaryYear.hidden=true;
    const sYearLbl=document.createElement('small');sYearLbl.textContent='الإنتاج';
    const summaryYearVal=document.createElement('strong');
    summaryYear.append(sYearLbl,summaryYearVal);
    cardSummary.append(summaryImdb,summaryYear);
    cardHead.append(cardHeading,cardSummary);

    const overview=document.createElement('p');overview.className='vdetail-overview';overview.hidden=true;
    const factsEl=document.createElement('div');factsEl.className='vdetail-facts';
    const facts={
      imdb:addDetailFact(factsEl,'تقييم IMDb','accent-imdb'),
      year:addDetailFact(factsEl,'سنة الإنتاج','accent-year'),
      director:addDetailFact(factsEl,'المخرج'),
      genre:addDetailFact(factsEl,'النوع'),
      group:addDetailFact(factsEl,'التصنيف'),
      releaseDate:addDetailFact(factsEl,'تاريخ الإصدار'),
      duration:addDetailFact(factsEl,'المدة'),
      quality:addDetailFact(factsEl,'الجودة والصيغة'),
      language:addDetailFact(factsEl,'اللغة'),
      episodes:addDetailFact(factsEl,'الحلقات'),
      country:addDetailFact(factsEl,'البلد'),
      age:addDetailFact(factsEl,'التصنيف العمري'),
      source:addDetailFact(factsEl,'المصدر')
    };

    /* قسم قائمة الممثلين المنظّم */
    const castSection=document.createElement('div');castSection.className='vdetail-cast-section';castSection.hidden=true;
    const castHead=document.createElement('div');castHead.className='vdetail-cast-head';
    const castTitle=document.createElement('h4');castTitle.className='vdetail-cast-title';castTitle.textContent='🎭 قائمة الممثلين';
    const castCount=document.createElement('span');castCount.className='vdetail-cast-count';
    castHead.append(castTitle,castCount);
    const castList=document.createElement('div');castList.className='vdetail-cast-list';
    const castMoreBtn=document.createElement('button');castMoreBtn.type='button';castMoreBtn.className='vcast-more';castMoreBtn.hidden=true;
    castSection.append(castHead,castList,castMoreBtn);

    const detailNodes={
      meta,chipSet,overview,facts,factsEl,backdrop,poster,quickMeta,shortCast,shortCastList,
      imdbBadge,imdbScoreEl,yearBadge,yearValueEl,
      cardSummary,summaryImdb,summaryImdbVal,summaryYear,summaryYearVal,
      castSection,castCount,castList,castMoreBtn,
      baseGroup:card.group||'',localMeta
    };

    facts.group.set(card.group);
    facts.source.set(card.sourceName);
    facts.quality.set([localMeta.quality,localMeta.format].filter(Boolean).join(' · '));
    facts.language.set(localMeta.language);
    facts.episodes.set(seriesCountText);
    if(localMeta.overview){overview.textContent=localMeta.overview;overview.hidden=false}
    if(localMeta.director)facts.director.set(localMeta.director);
    if(localMeta.genre&&(!card.group||localMeta.genre.toLowerCase()!==card.group.toLowerCase()))facts.genre.set(localMeta.genre);
    if(localMeta.country)facts.country.set(localMeta.country);
    if(localMeta.age)facts.age.set(localMeta.age);
    const initialScore=localMeta.imdbRating||(baseRating?baseRating.toFixed(1):'');
    if(initialScore)setImdbDisplay(detailNodes,initialScore,localMeta.imdbId);
    if(localMeta.year)setYearDisplay(detailNodes,localMeta.year);
    if(localMeta.castList&&localMeta.castList.length)renderCastSection(detailNodes,localMeta.castList);
    syncFactsVisibility(factsEl);

    const status=document.createElement('small');status.className='vdetail-status';
    cardBox.append(cardHead,overview,factsEl,castSection,status);
    extra.appendChild(cardBox);

    const alternatives=idx?[...idx.movies,...idx.series].filter(other=>other!==card&&Model.sameTitle(card,other)):[];
    const key=Model.normalizeTitle(card.title),remembered=LS.get('m3u_vod_provider',{})[key];
    alternatives.sort((a,b)=>(a.sourceId===remembered?-1:0)-(b.sourceId===remembered?-1:0));
    if(alternatives.length){
      const section=document.createElement('div');section.className='vdetail-alternatives';
      const heading=document.createElement('h3');heading.textContent='مصادر بديلة';section.appendChild(heading);
      alternatives.forEach(other=>section.appendChild(addAction(other.sourceName+' · '+niceTitle(other.title),()=>{
        const providers=LS.get('m3u_vod_provider',{});providers[key]=other.sourceId;LS.set('m3u_vod_provider',providers);
        cur=other;showDetails(other,detailReturn);
      },'alt')));
      extra.appendChild(section);
    }

    const trailerSection=document.createElement('section');trailerSection.className='vdetail-trailer';
    trailerSection.hidden=true;
    const trailerHeading=document.createElement('h3');trailerHeading.textContent='المقطع الدعائي';trailerSection.appendChild(trailerHeading);
    const trailer=document.createElement('button');trailer.type='button';trailer.className='vtrailer-card';trailer.hidden=true;
    const trailerImage=document.createElement('img');trailerImage.alt='';
    const trailerLabel=document.createElement('span');trailerLabel.textContent='▶ مشاهدة العرض الدعائي';
    trailer.append(trailerImage,trailerLabel);trailerSection.appendChild(trailer);
    actions.appendChild(trailerSection);
    const moreBtn=addAction('المزيد',()=>{
      const expanded=moreBtn.getAttribute('aria-expanded')==='true';
      moreBtn.setAttribute('aria-expanded',expanded?'false':'true');
      moreBtn.textContent=expanded?'المزيد':'أقل';
      extra.hidden=expanded;
      if(!expanded)requestAnimationFrame(()=>extra.scrollIntoView({block:'nearest',behavior:'smooth'}));
    },'vdetail-more');
    moreBtn.setAttribute('aria-expanded','false');
    moreBtn.setAttribute('aria-controls',extra.id);
    actions.appendChild(moreBtn);
    info.append(actions,shortCast);

    head.append(poster,info);
    if(nowPlaying&&playerStage){
      shell.append(head,playerStage,extra);
    }else{
      shell.append(head,extra);
    }
    panel.append(backdrop,shell);overlay.appendChild(panel);el.appendChild(overlay);detailOverlay=overlay;
    overlay.addEventListener('click',e=>{if(e.target===overlay)returnFromDetails()});

    const allBtns=[...overlay.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length);
    const primaryBtn=actions.querySelector('button');
    const primaryIdx=primaryBtn?allBtns.indexOf(primaryBtn):0;
    detailIndex=primaryIdx>=0?primaryIdx:0;
    const initialBtn=allBtns[detailIndex];
    if(initialBtn){initialBtn.classList.add('sel');initialBtn.focus({preventScroll:true})}

    detailNodes.status=status;
    detailNodes.trailerSection=trailerSection;
    detailNodes.trailer=trailer;
    detailNodes.trailerImage=trailerImage;
    loadDetailsMetadata(card,detailNodes);
  }
  function clearDetailsOverlay(){
    if(!detailOverlay)return;
    restorePlayerFromDetails();
    detailOverlay.remove();
    detailOverlay=null;
  }
  function returnFromDetails(){
    cancelDetailRequest();
    if(playerFromDetails&&B.classList.contains('cine-mini')){
      stopPlay();
    }else{
      restorePlayerFromDetails();
    }
    playerFromDetails=false;
    clearDetailsOverlay();
    B.classList.remove('vod-detail-play');
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
    if(screen==='details')showDetails(card,detailReturn);
    else if(screen==='home')paintHome();
    else updatePlaybackActions();
  }
  function syncCardFav(card){
    if(!card)return;
    const id=cardId(card),fav=!!vodFavs()[id];
    if(bodyEl&&bodyEl.isConnected){
      for(const node of bodyEl.querySelectorAll('.vc')){
        if(node.dataset.cid!==id)continue;
        const btn=node.querySelector('.vfav-btn');
        if(btn){
          btn.classList.toggle('on',fav);
          btn.textContent=fav?'★':'☆';
          btn.setAttribute('aria-pressed',fav?'true':'false');
          btn.setAttribute('aria-label',fav?'إزالة من المفضلة':'إضافة إلى المفضلة');
          btn.title=fav?'إزالة من المفضلة':'إضافة إلى المفضلة';
        }
      }
    }
    if(screen==='details'&&cur&&cardId(cur)===id){
      const dBtn=(detailOverlay||bodyEl).querySelector('[data-act="vod-fav"]');
      if(dBtn){
        dBtn.classList.toggle('on',fav);
        const icon=dBtn.querySelector('.vfav-icon');
        if(icon)icon.textContent=fav?'★':'☆';
        dBtn.setAttribute('aria-label',fav?'إزالة من المفضلة':'إضافة إلى المفضلة');
        dBtn.title=fav?'إزالة من المفضلة':'إضافة إلى المفضلة';
        dBtn.setAttribute('aria-pressed',fav?'true':'false');
      }
    }
    paintTabs();
    updatePlaybackActions();
  }
  function setVodFav(card,value){
    if(!card)return;
    const map=vodFavs(),id=cardId(card);
    if(value)map[id]=Date.now();else delete map[id];
    LS.set('m3u_vod_favorites',map);
    const label=niceTitle(card.title)||card.title||'العنصر';
    toast(value?'★ تمت إضافة «'+label+'» إلى المفضلة':'تمت إزالة «'+label+'» من المفضلة');
    if(screen==='home'&&filter==='favorites'){
      const keepScroll=scroller?scroller.scrollTop:0;
      const keepIdx=gi;
      idxRows();
      gi=Math.min(keepIdx,Math.max(0,view.length-1));
      paintHome();
      requestAnimationFrame(()=>{if(scroller)scroller.scrollTop=keepScroll;markCards()});
      updatePlaybackActions();
      return;
    }
    syncCardFav(card);
  }
  function toggleVodFav(card){if(card)setVodFav(card,!isVodFav(card))}
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
      if(!/^(?:https?:)?\/\//i.test(String(episode.item&&episode.item.url||''))){toast('رابط الحلقة غير صالح للتشغيل');return}
      cur=card;curEps=card.eps.filter(e=>e.s===episode.s);eIdx=Math.max(0,curEps.findIndex(e=>e.url===episode.url));
      detailReturn='details';playItem(episode.item,curEps,eIdx,card,position,fromDetails);
    }else{
      if(!/^(?:https?:)?\/\//i.test(String(card.item&&card.item.url||''))){toast('رابط الفيلم غير صالح للتشغيل');return}
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
      const j=await r.json(),u=new URL(c.lazy),base=c.lazy.replace(/\/player_api\.php[\s\S]*$/i,'')||u.origin,usr=encodeURIComponent(u.searchParams.get('username')||''),pw=encodeURIComponent(u.searchParams.get('password')||'');
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
    cancelDetailRequest();clearDetailsOverlay();el.classList.remove('vod-details');
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
    if(vodSrcOpen&&vodSourcePopKey(k))return;
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
      else if(k==='Enter'){const e=curEps[eIdx];if(e){detailReturn='series';playItem(e.item,curEps,eIdx,cur,0,false)}}
    }
  }

  /* ---------- الرئيسية ---------- */
  function focusTopTabs(){
    const activeTab=TOP_TABS.findIndex(t=>t[0]===filter);
    tIdx=activeTab>=0?activeTab:0;
    zone='tabs';
  }
  function desktopHomeKey(k){
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    if(!view.length){if(k==='ArrowUp')focusTopTabs();else if(k===bwd)zone='side';markCards();return}
    let rowIndex=desktopRows.findIndex(row=>row.indexOf(gi)>=0);
    if(rowIndex<0)rowIndex=0;
    let row=desktopRows[rowIndex]||[],col=row.indexOf(gi);
    if(col<0)col=0;
    if(k==='Enter'){showDetails(view[gi],'home');return}
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
      if(nextRow<0){
        if(continueCards.length)zone='continue';
        else if(heroCard)zone='hero';
        else focusTopTabs();
        markCards();return;
      }
      const items=desktopRows[nextRow];
      target=items[Math.min(col,items.length-1)];
    }else return;
    if(target===undefined)return;
    gi=target;
    if(gi>=rendered-4&&rendered<view.length)renderMore(rendered+CHUNK);
    markCards();
  }
  function homeKey(k){
    if(vodSrcOpen&&vodSourcePopKey(k))return;
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    const downFromTop=()=>{
      if(heroCard){zone='hero';heroBtnIdx=0}
      else if(continueCards.length)zone='continue';
      else if(view.length)zone='rows';
      else zone='side';
    };
    if(zone==='tabs'){
      if(k===fwd){
        if(tIdx<TOP_TABS.length-1)tIdx++;
        else zone='search';
      }else if(k===bwd){
        if(tIdx>0)tIdx--;
      }else if(k==='ArrowDown'){downFromTop()}
      else if(k==='Enter'){selectTab(TOP_TABS[tIdx][0],tIdx);return}
      markCards();return;
    }
    const top=['search','sort','source'];
    if(B.classList.contains('cine-mini'))top.push('player');
    if(top.includes(zone)){
      const current=top.indexOf(zone);
      if(k===fwd)zone=top[Math.min(top.length-1,current+1)];
      else if(k===bwd){
        if(current===0){zone='tabs';tIdx=TOP_TABS.length-1}
        else zone=top[current-1];
      }else if(k==='ArrowDown'){downFromTop()}
      else if(k==='Enter'){
        if(zone==='search'){searchPrompt();return}
        if(zone==='sort'){cycleSort();return}
        if(zone==='player'){expandPlayer();return}
        cycleSource();return;
      }
      markCards();return;
    }
    if(zone==='hero'){
      if(k===fwd)heroBtnIdx=1;
      else if(k===bwd){if(heroBtnIdx===0)zone='side';else heroBtnIdx=0}
      else if(k==='ArrowUp')focusTopTabs();
      else if(k==='ArrowDown'){zone=continueCards.length?'continue':(view.length?'rows':'side')}
      else if(k==='Enter'){
        const targetBtn=$(heroBtnIdx===1?'vodherodetails':'vodheroaction');
        if(targetBtn&&!targetBtn.hidden)targetBtn.click();
        return;
      }
      markCards();return;
    }
    if(zone==='continue'){
      if(!continueCards.length){zone=view.length?'rows':'side';markCards();return}
      if(k===fwd)ci=Math.min(continueCards.length-1,ci+1);
      else if(k===bwd){if(ci===0)zone='side';else ci=Math.max(0,ci-1)}
      else if(k==='ArrowDown')zone=view.length?'rows':'side';
      else if(k==='ArrowUp'){if(heroCard){zone='hero';heroBtnIdx=0}else focusTopTabs()}
      else if(k==='Enter'){if(continueCards[ci])showDetails(continueCards[ci],'home');return}
      markCards();return;
    }
    if(zone==='side'){
      if(k==='ArrowDown')sideIdx=Math.min(sideItems.length-1,sideIdx+1);
      else if(k==='ArrowUp'){if(sideIdx>0)sideIdx--;else focusTopTabs()}
      else if(k==='PageDown')sideIdx=Math.min(sideItems.length-1,sideIdx+8);
      else if(k==='PageUp')sideIdx=Math.max(0,sideIdx-8);
      else if(k===fwd){
        if(continueCards.length)zone='continue';
        else if(view.length){gi=renderedDesktop?0:Math.min(Math.floor(gi/gcols)*gcols,view.length-1);zone='rows'}
      }
      else if(k==='Enter'){applySide();return}
      markCards();return;
    }
    if(!view.length){if(k==='ArrowUp')focusTopTabs();else if(k===bwd)zone='side';markCards();return}
    if(renderedDesktop){desktopHomeKey(k);return}
    const last=view.length-1,rowStart=Math.floor(gi/gcols)*gcols,rowEnd=Math.min(last,rowStart+gcols-1);let n=gi;
    if(k===fwd)n=Math.min(rowEnd,gi+1);
    else if(k===bwd){if(gi===rowStart){zone='side';markCards();return}n=gi-1}
    else if(k==='ArrowDown')n=Math.min(last,gi+gcols);
    else if(k==='ArrowUp'){
      if(gi<gcols){
        if(continueCards.length)zone='continue';
        else if(heroCard){zone='hero';heroBtnIdx=0}
        else focusTopTabs();
        markCards();return;
      }
      n=gi-gcols;
    }
    else if(k==='PageDown')n=Math.min(last,gi+gcols*3);
    else if(k==='PageUp')n=Math.max(0,gi-gcols*3);
    else if(k==='Enter'){showDetails(view[gi],'home');return}
    else return;
    gi=n;
    if(gi>=rendered-gcols*2&&rendered<view.length)renderMore(gi+gcols*3);
    markCards();
  }

  /* ---------- التشغيل: واجهة ربط بالمشغّل المستقل (js/wassla-player.js) ----------
     المكتبة لا تعرف شيئًا عن عنصر الفيديو أو المحركات أو أزرار التحكم. تمرّر الرابط والعنوان والموضع فقط،
     وتستقبل التقدّم المحفوظ وطلبات الحلقة السابقة/التالية والإغلاق. */
  const fmt=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
  const Playback=window.WasslaVodPlayback;
  let skipAfterClose=false;
  function activeRecordKey(){
    return playing&&playing.item?playing.item.url:'';
  }
  function saveProgressFor(card,item,info){
    if(!card||!item||!info)return;
    const url=item.url,dur=info.duration,pos=info.position;
    if(!url||!Number.isFinite(dur)||dur<=0||!Number.isFinite(pos))return;
    const records=progress(),old=records[url]||{};
    const minSec=Model&&Model.MIN_RESUME_SECONDS?Model.MIN_RESUME_SECONDS:15;
    if(pos<minSec&&!old.watched&&!info.ended)return;
    const complete=old.watched||info.ended||(Model&&Model.shouldAutoComplete?Model.shouldAutoComplete(pos,dur):pos>=dur*0.92);
    records[url]={
      url,title:item.name||card.title,seriesTitle:card.kind==='series'?card.title:'',
      sourceId:card.sourceId||active,position:pos,duration:dur,
      watched:!!complete,updated:Date.now()
    };
    LS.set('m3u_vod_progress',records);
    if(card.kind==='movie'&&complete){
      const marks=watched();marks[cardId(card)]=Date.now();LS.set('m3u_vod_watched',marks);
    }
    syncCardProgress(card);
  }
  function saveProgress(){
    const P=window.WasslaPlayer,s=P&&P.state();
    if(!playing||!s)return;
    saveProgressFor(playing.card,playing.item,{position:s.position,duration:s.duration,ended:s.ended});
  }
  function playerOpts(position){
    const c=playing.card,it=playing.item,eps=playing.eps,i=playing.i;
    const nx=eps&&eps[i+1];
    const epTitle=(e,name)=>(c.kind==='series'&&e&&Number.isFinite(e.e)&&epInfo(name||''))?('الموسم '+e.s+' · الحلقة '+e.e):(niceTitle(name||'')||(e&&Number.isFinite(e.e)?'الحلقة '+e.e:''));
    return {
      url:it.url,extra:it.extra||[],sourceId:c.sourceId||active,
      title:epTitle(eps&&eps[i],it.name)||niceTitle(c.title||'')||'تشغيل',
      subtitle:c.kind==='series'?niceTitle(c.title||''):(c.group||''),
      position:position||0,
      hasPrev:!!(eps&&i>0),hasNext:!!nx,
      nextTitle:nx?epTitle(nx,nx.name):'',
      autoNext:LS.get('m3u_vod_autonext',true),
      onProgress:info=>saveProgressFor(c,it,info),
      onPrev:()=>stepEpisode(-1),
      onNext:()=>stepEpisode(1),
      onClose:playerClosed
    };
  }
  function playItem(it,eps,i,card,position,fromDetails){
    const P=window.WasslaPlayer;
    if(!P){toast('تعذّر تحميل المشغّل');return}
    if(fromDetails)playerDetailOrigin=detailOrigin;
    playing={eps:eps||null,i:i||0,card:card||cur,item:it};
    P.open(playerOpts(position));
  }
  function playerClosed(){
    if(skipAfterClose)return;
    const c=playing&&playing.card;
    playing=null;
    if(!on)return;
    if(screen==='details'&&c)showDetails(c,detailOrigin);
    else if(screen==='series'&&cur)paintSeries();
    else{if(c)syncCardProgress(c);markCards()}
  }
  function stopPlay(){
    const P=window.WasslaPlayer;
    if(P&&P.isOpen()){skipAfterClose=true;try{P.close('lib')}finally{skipAfterClose=false}}
    playing=null;
  }
  function stepEpisode(delta){
    if(!playing||!playing.eps)return;
    const n=playing.i+delta;
    if(n>=0&&n<playing.eps.length){
      const episode=playing.eps[n];
      eIdx=n;playItem(episode.item,playing.eps,n,playing.card,0);
    }
  }
  /* دوال قديمة ما زالت تُستدعى من شاشات المكتبة: لم يعد هناك مشغّل مصغّر أو منطقة تحكم داخل المكتبة */
  function updatePlaybackActions(){paintTabs()}
  function restorePlayerFromDetails(){}
  function clearNext(){}
  function closeQuickOptions(){}
  function expandPlayer(){}
  function minimizePlayer(){}
  function closeMiniPlayer(){stopPlay()}
  function playKey(){}
  window.__closeVodPlayer=stopPlay;
  window.__vodMediaSeek=delta=>{const P=window.WasslaPlayer;if(!on||!P||!P.isOpen())return false;P.seekBy(delta);return true};
  window.__vodMediaControl=action=>{
    const P=window.WasslaPlayer;if(!on||!P||!P.isOpen())return false;
    const s=P.state();
    if(action==='toggle'||(action==='play'&&s&&s.paused)||(action==='pause'&&s&&!s.paused))P.toggle();
    return true;
  };

  /* ---------- فتح وإغلاق ---------- */
  function open(focusSourceId){
    if(on)return;
    if(window.__qpOn&&window.__qpOn()&&window.__quickClose)window.__quickClose();
    cancelDetailRequest();clearDetailsOverlay();el.classList.remove('vod-details');closeVodSourcePop();
    on=true;
    const libraryView=$('library-view');
    if(libraryView)libraryView.style.display='block';
    const playerOuter=$('player-overlay');
    if(playerOuter){playerOuter.style.display='none';playerOuter.setAttribute('aria-hidden','true')}
    LS.set('m3u_last_was_vod',true);
    if(!LS.get('m3u_tip_vod',false)){LS.set('m3u_tip_vod',true);toast('اضغط OK لفتح التفاصيل، واختر المصادر بالتأشير دون التأثير على القنوات.')}
    lastLive=shown.find(i=>i.url===curUrl)||null;
    tok++;stopAll();
    if(window.__ldgHide)window.__ldgHide();
    el.classList.add('on');B.classList.add('vod');
    zone='rows';screen='home';cat='';sideIdx=0;tabsEl.textContent='';
    msgBody('جارٍ تحليل المكتبة…');
    build().then(()=>{syncVodSelection(focusSourceId);idxRows();paintHome()}).catch(()=>msgBody('تعذّر تحليل المكتبة'));
  }
  function close(){
    if(screen==='trailer')closeTrailer();
    closeVodSourcePop();
    cancelDetailRequest();cancelRecRequest();clearDetailsOverlay();el.classList.remove('vod-details');
    if(playing)stopPlay();
    if(window.__ldgHide)window.__ldgHide();
    on=false;el.classList.remove('on');B.classList.remove('vod','cine-play','cine-mini','vod-detail-play');
    const libraryView=$('library-view');
    if(libraryView)libraryView.style.display='block';
    const playerOuter=$('player-overlay');
    if(playerOuter){playerOuter.style.display='none';playerOuter.setAttribute('aria-hidden','true')}
    if(lastLive){const it=lastLive;lastLive=null;play(it)}
  }
  window.__openVod=function(id){open((typeof id==='string'&&id)?id:'')};
  /* رجوع واحد لكل الأجهزة: يغلق أعلى طبقة فقط. موسّع ← مصغّر ← مغادرة الشاشة (التشغيل مستمر) ← إيقاف المشغّل برجوع مزدوج ← خروج. */
  window.__vodBack=function(){
    if(!on)return false;
    if(window.WasslaPlayer&&WasslaPlayer.isOpen())return WasslaPlayer.back();
    if(vodSrcOpen){closeVodSourcePop();zone='source';markCards();return true}
    if(screen==='trailer'){closeTrailer();return true}
    if(screen==='details'){returnFromDetails();return true}
    if(screen==='series'){zone='rows';paintHome();return true}
    close();return true;
  };
  document.addEventListener('keydown',e=>{
    if(!on||document.querySelector('dialog[open]'))return;
    if(window.WasslaPlayer&&WasslaPlayer.isOpen())return;
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
