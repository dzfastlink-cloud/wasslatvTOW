const $=id=>document.getElementById(id);
const EDITION=window.Android&&Android.edition?Android.edition():'open';
const STORAGE_PREFIX='wassla:'+EDITION+':';
const DB={
  open(){return this._p||(this._p=new Promise((ok,no)=>{
    const r=indexedDB.open('m3u-viewer-'+EDITION,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('kv');
    r.onsuccess=()=>{
      const db=r.result;
      if(EDITION!=='open'||localStorage.getItem(STORAGE_PREFIX+'db-migrated')){ok(db);return}
      const old=indexedDB.open('m3u-viewer',1);
      old.onerror=()=>{console.warn('Could not inspect legacy local database',old.error);localStorage.setItem(STORAGE_PREFIX+'db-migrated','1');ok(db)};
      old.onsuccess=()=>{
        const legacy=old.result;
        if(!legacy.objectStoreNames.contains('kv')){
          legacy.close();localStorage.setItem(STORAGE_PREFIX+'db-migrated','1');ok(db);return;
        }
        const tx=db.transaction('kv','readwrite'),read=legacy.transaction('kv').objectStore('kv').openCursor();
        read.onsuccess=()=>{
          const cursor=read.result;
          if(cursor){tx.objectStore('kv').put(cursor.value,cursor.key);cursor.continue()}
        };
        tx.oncomplete=()=>{legacy.close();localStorage.setItem(STORAGE_PREFIX+'db-migrated','1');ok(db)};
        tx.onerror=()=>{legacy.close();this._p=null;no(tx.error)};
      };
    };
    r.onerror=()=>{this._p=null;no(r.error)};
  }))},
  async get(k){const d=await this.open();return new Promise(ok=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(null)})},
  async set(k,v){const d=await this.open();return new Promise((ok,no)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=ok;t.onerror=()=>no(t.error)})},
  async del(k){const d=await this.open();return new Promise(ok=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=ok;t.onerror=ok})}
};

function detectKind(item){
  const g=(item.group||'').toLowerCase();
  const u=(item.url||'').toLowerCase();
  const n=(item.name||'').toLowerCase();
  // 1) الروابط المخصصة للأفلام والمسلسلات (Xtream) صراحةً
  if(/action=get_series_info/.test(u)||/\/series\/[^/]+\/[^/]+\/[^/]+/.test(u))return 'series';
  if(/\/movie\/[^/]+\/[^/]+\/[^/]+/.test(u))return 'movie';
  // 2) الراديو
  if(/radio|راديو/.test(g)||/\.(mp3|aac|ogg|m4a)(\?|$)/.test(u))return 'radio';
  // 3) البث المباشر لا يُصنَّف فيلماً أو مسلسلاً أبداً مهما كان اسم مجموعته
  if(/\/live\//.test(u))return 'live';
  // 4) ملفات فيديو مباشرة (وليست m3u8): فيلم، أو مسلسل إن دلّ الاسم أو المجموعة
  if(/\.(mp4|mkv|avi|mov|wmv|webm|m4v)(\?|$)/.test(u)){
    return (/مسلسل|مسلسلات|series|season|episode|حلقة/.test(g)||/مسلسل|حلقة\s*\d|s\d{1,2}e\d{1,2}/.test(n))?'series':'movie';
  }
  return 'live';
}
const KIND_ICON={live:'📺',movie:'🎬',series:'🎞️',radio:'📻'};
const KIND_NAME={live:'قنوات',movie:'أفلام',series:'مسلسلات',radio:'راديو'};

const LS={
  get(k,d){
    try{
      let v=localStorage.getItem(STORAGE_PREFIX+k);
      if(v==null&&EDITION==='open'){
        v=localStorage.getItem(k);
        if(v!=null)localStorage.setItem(STORAGE_PREFIX+k,v);
      }
      return v==null?d:JSON.parse(v);
    }catch(e){return d}
  },
  set(k,v){try{localStorage.setItem(STORAGE_PREFIX+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem(STORAGE_PREFIX+k)}catch(e){}}
};
let lists=[],active='',liveSelected=[],liveParseCache=new Map(),items=[],shown=[],hls=null,mp=null,curUrl='',tok=0,mergeTarget='',playbackAttemptCleanup=null;
let favs=new Set(LS.get('m3u_favs',[])),recs=LS.get('m3u_recs',[]);
const FAV_LIST_ID='__fav_list__';
const FAV_LIST_NAME='⭐ المفضلة';

const ser=serializeM3U;
function merge(oldI,newI,strict){
  const nm=new Map(newI.map(i=>[i.url,i])),seen=new Set(),out=[];
  oldI.forEach(i=>{if(nm.has(i.url)){if(!seen.has(i.url)){out.push(nm.get(i.url));seen.add(i.url)}}else if(!strict)out.push(i)});
  newI.forEach(i=>{if(!seen.has(i.url)){out.push(i);seen.add(i.url)}});
  return out;
}
function setMsg(t,err){const m=$('msg');m.textContent=t||'';m.className=err?'err':'';m.style.color = err ? '#c4452d' : '#fff';}
function saveLists(){return DB.set('lists',{lists,active}).catch(()=>{})}
function notifyListsChanged(){try{document.dispatchEvent(new CustomEvent('wassla:lists-changed'))}catch(e){}}
async function getText(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw 0;return await r.text()}

async function syncFavList(){
  const storedMeta=LS.get('m3u_fav_meta',{});
  const allFavItems=[];
  favs.forEach(u=>{
    const fromCurrent=items.find(i=>i.url===u);
    if(fromCurrent){
      allFavItems.push(fromCurrent);
      storedMeta[u]={name:fromCurrent.name,logo:fromCurrent.logo,group:fromCurrent.group,raw:fromCurrent.raw,extra:fromCurrent.extra||[]};
    }else if(storedMeta[u]){
      allFavItems.push({...storedMeta[u],url:u});
    }else{
      allFavItems.push({name:u.split('/').pop()||u,logo:'',group:'المفضلة',raw:'',extra:[],url:u});
    }
  });
  LS.set('m3u_fav_meta',storedMeta);
  const text=ser(allFavItems);
  let favList=lists.find(l=>l.id===FAV_LIST_ID);
  if(favList){
    favList.text=text;favList.n=allFavItems.length;favList.upd=Date.now();
  }else if(allFavItems.length){
    favList={id:FAV_LIST_ID,name:FAV_LIST_NAME,text,url:'',n:allFavItems.length,upd:Date.now(),isFav:true};
    lists.push(favList);
  }
  await saveLists();
  fillLists();
}

const MODES=['auto','light','dark'],MTXT={auto:'🌓 تلقائي',light:'☀ نهاري',dark:'🌙 ليلي'};
let theme=LS.get('m3u_theme','auto');if(MODES.indexOf(theme)<0)theme='auto';
/* السمة الفعلية: «تلقائي» تتبع نظام الجهاز على الهاتف، وتبقى ليلية على التلفاز (لا يوجد وضع نهاري للتلفاز في النظام) */
function effTheme(){
  if(theme!=='auto')return theme;
  if(window.Android&&Android.isTv&&Android.isTv())return 'dark';
  try{return matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}catch(e){return 'dark'}
}
function applyTheme(){
  const h=document.documentElement,e=effTheme();
  if(theme==='auto')h.removeAttribute('data-theme');else h.setAttribute('data-theme',theme);
  h.setAttribute('data-eff',e);                     // كل الشاشات تقرأ هذه السمة (ليلي/نهاري) لا اختيار المستخدم الخام
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=e==='light'?'#e9f3f1':'#030d0b';
  $('theme').textContent=MTXT[theme];
  document.dispatchEvent(new CustomEvent('themechange',{detail:{theme,eff:e}}));
}
function setTheme(t){if(MODES.indexOf(t)<0)return;theme=t;LS.set('m3u_theme',theme);applyTheme()}
function cycleTheme(){setTheme(MODES[(MODES.indexOf(theme)+1)%3])}
$('theme').onclick=cycleTheme;applyTheme();
try{const mq=matchMedia('(prefers-color-scheme: light)');(mq.addEventListener?mq.addEventListener.bind(mq,'change'):mq.addListener.bind(mq))(()=>{if(theme==='auto')applyTheme()})}catch(e){}

const DENSITIES=['large','medium','small'],DENSITY_LABEL={large:'كبير',medium:'متوسط',small:'صغير'},DENSITY_ZOOM={large:'1.08',medium:'1',small:'0.92'};
let density=LS.get('m3u_density','large');
if(!DENSITIES.includes(density))density='large';
function applyDensity(){const z=DENSITY_ZOOM[density];document.documentElement.style.zoom=z;document.documentElement.style.setProperty('--ui-zoom',z)}
function cycleDensity(){density=DENSITIES[(DENSITIES.indexOf(density)+1)%DENSITIES.length];LS.set('m3u_density',density);applyDensity()}
window.cycleDensity=cycleDensity;window.densityLabel=()=>DENSITY_LABEL[density];
applyDensity();

function parseListCached(l){
  if(!l||!l.text)return[];
  const key=l.id+':'+(l.upd||0)+':'+(l.n||0)+':'+l.text.length;
  const hit=liveParseCache.get(l.id);
  if(hit&&hit.key===key)return hit.items;
  const parsed=parseM3U(l.text);
  liveParseCache.set(l.id,{key,items:parsed});
  return parsed;
}
function liveStatsOf(l){
  const st=sourceStatsOf(l);
  if(st)return st;
  const arr=parseListCached(l);
  let live=0,radio=0,movies=0,series=0;
  for(let i=0;i<arr.length;i++){
    const k=detectKind(arr[i]);
    if(k==='movie')movies++;
    else if(k==='series')series++;
    else if(k==='radio')radio++;
    else live++;
  }
  return {total:arr.length,live,radio,movies,series};
}
function getLiveCandidateSources(){
  return lists.filter(l=>{
    if(!l||l.id===FAV_LIST_ID)return false;
    if(l.id==='builtin')return true;
    const st=liveStatsOf(l);
    if((st.live||0)+(st.radio||0)>0)return true;
    return (st.movies||0)+(st.series||0)===0;
  });
}
function persistLiveSelection(ids){
  const validIds=getLiveCandidateSources().map(l=>l.id);
  const Model=window.WasslaSourceModel;
  liveSelected=Model?Model.normalizeSelection(ids,validIds,false):[...new Set((Array.isArray(ids)?ids:[]).filter(id=>validIds.includes(id)))];
  LS.set('m3u_live_sources',liveSelected);
  LS.set('m3u_live_known_sources',validIds);
  active=liveSelected[0]||'';
}
function syncLiveSelection(preferredFallbackId){
  const cands=getLiveCandidateSources();
  const validIds=cands.map(l=>l.id);
  const stored=LS.get('m3u_live_sources',null);
  const Model=window.WasslaSourceModel;
  if(stored===null){
    const initId=(preferredFallbackId&&validIds.includes(preferredFallbackId))
      ? preferredFallbackId
      : (active&&validIds.includes(active)?active:(validIds[0]||''));
    liveSelected=initId?[initId]:[];
    LS.set('m3u_live_sources',liveSelected);
    LS.set('m3u_live_known_sources',validIds);
    active=liveSelected[0]||'';
    return;
  }
  liveSelected=Model?Model.normalizeSelection(stored,validIds,false):stored.filter(id=>validIds.includes(id));
  active=liveSelected[0]||'';
}
function fillLists(){
  const visible=lists.filter(l=>l.id!==FAV_LIST_ID||l.n>0);
  const s=$('lists');
  s.classList.toggle('hide', !visible.length);
  s.innerHTML=visible.map(l=>'<option value="'+l.id+'"'+(liveSelected.includes(l.id)||l.id===active?' selected':'')+'>'+esc(l.name)+(liveSelected.includes(l.id)&&liveSelected.length>1?' ✓':'')+'</option>').join('');
}
function fillGroups(keep){
  const prev=$('grp').value,g=[...new Set(items.map(i=>i.group||'بدون مجموعة'))];
  const availCount=items.filter(i=>i.url&&i.url.trim()).length;
  const kinds={live:0,movie:0,series:0,radio:0};
  items.forEach(it=>{kinds[detectKind(it)]++});
  let kindOpts='';
  ['movie','series','live','radio'].forEach(k=>{if(kinds[k])kindOpts+='<option value="__k_'+k+'">'+KIND_ICON[k]+' '+KIND_NAME[k]+' ('+kinds[k]+')</option>'});
  $('grp').innerHTML='<option value="">كل المجموعات ('+items.length+')</option><option value="__fav">★ المفضلة</option><option value="__rec">🕘 آخر ما شاهدت</option><option value="__avail">✅ الروابط المتاحة ('+availCount+')</option>'
    +(kindOpts?'<optgroup label="النوع">'+kindOpts+'</optgroup>':'')
    +'<optgroup label="المجموعات">'+g.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('')+'</optgroup>';
  if(keep&&[...$('grp').options].some(o=>o.value===prev))$('grp').value=prev;
}
function showWelcome(){items=[];shown=[];$('side').classList.add('hide');$('player').classList.add('hide');$('load').classList.remove('hide')}
/* التجوّل بين المصادر والمجموعات دون اختيار قناة يغيّر المصدر/المجموعة الحاليين، فيصبح ↑↓ (القناة التالية/السابقة)
   يعمل داخل المنطقة الخطأ. هذه الدالة تعيد التطبيق إلى منطقة القناة التي تعمل فعلاً. */
function restoreCtx(){
  const c=window.__playCtx;if(!c)return false;
  if(c.listId&&!liveSelected.includes(c.listId)&&lists.some(l=>l.id===c.listId))openList(c.listId);
  if(c.grp!==undefined&&[...$('grp').options].some(o=>o.value===c.grp))$('grp').value=c.grp;
  $('q').value=c.q||'';render();return true;
}
window.__restoreCtx=restoreCtx;
function rebuildLiveItems(keep){
  const picked=lists.filter(l=>l.id!==FAV_LIST_ID&&liveSelected.includes(l.id));
  const combined=[];
  for(const l of picked){
    const arr=parseListCached(l);
    for(let i=0;i<arr.length;i++){
      combined.push(Object.assign({},arr[i],{_listId:l.id,_sourceName:l.name}));
    }
  }
  items=combined;
  active=liveSelected[0]||'';
  fillGroups(keep);
  if(!curUrl&&recs.length&&items.some(i=>i.url===recs[0]))curUrl=recs[0];
  const hasAnyList=lists.some(l=>l.id!==FAV_LIST_ID);
  if(!hasAnyList){showWelcome();fillLists();saveLists();if(window.__rcvRefresh)window.__rcvRefresh();return}
  $('load').classList.add('hide');$('side').classList.remove('hide');$('player').classList.remove('hide');
  const singleUrl=picked.length===1&&picked[0].url;
  $('upd').style.display=singleUrl?'':'none';
  fillLists();render();saveLists();
  if(!picked.length){setMsg('لا يوجد مصدر محدد للقنوات — فعّل مصدراً من القائمة السريعة ← المصدر')}
  else if($('msg')&&$('msg').textContent&&!$('msg').classList.contains('err')){setMsg('')}
  if(window.__rcvRefresh)window.__rcvRefresh();
}
function openList(id){
  const l=lists.find(x=>x.id===id);if(!l)return;
  if(id===FAV_LIST_ID){
    const same=(id===active);active=id;items=parseM3U(l.text);fillGroups(same);
    if(!curUrl&&recs.length&&items.some(i=>i.url===recs[0]))curUrl=recs[0];
    $('load').classList.add('hide');$('side').classList.remove('hide');$('player').classList.remove('hide');
    $('upd').style.display='none';
    fillLists();render();saveLists();
    return;
  }
  const same=(liveSelected.length===1&&liveSelected[0]===id);
  persistLiveSelection([id]);
  rebuildLiveItems(same);
}
window.__liveSources={
  candidates:()=>getLiveCandidateSources().map(l=>{
    const st=liveStatsOf(l);
    return{id:l.id,name:l.name,liveCount:(st.live||0)+(st.radio||0),stats:st,list:l};
  }),
  getSelected:()=>liveSelected.slice(),
  isSelected:id=>liveSelected.includes(id),
  toggle(id){
    const validIds=getLiveCandidateSources().map(l=>l.id);
    const Model=window.WasslaSourceModel;
    const next=Model?Model.toggleSelection(liveSelected,id,validIds):(liveSelected.includes(id)?liveSelected.filter(x=>x!==id):liveSelected.concat(id));
    persistLiveSelection(next);
    rebuildLiveItems(true);
    return next;
  },
  include(id){
    if(!liveSelected.includes(id)){
      persistLiveSelection(liveSelected.concat(id));
      rebuildLiveItems(true);
    }
    return liveSelected.slice();
  },
  selectAll(){
    const validIds=getLiveCandidateSources().map(l=>l.id);
    persistLiveSelection(validIds);
    rebuildLiveItems(true);
    return validIds;
  },
  clear(){
    persistLiveSelection([]);
    rebuildLiveItems(true);
    return[];
  },
  summary(){
    const cands=getLiveCandidateSources();
    if(!cands.length)return 'لا توجد مصادر';
    const Model=window.WasslaSourceModel;
    return Model?Model.summarizeSelection(liveSelected,cands,'غير محدد'):(liveSelected.length?liveSelected.length+' مصادر':'غير محدد');
  },
  refreshIfActive(id){
    if(id==='builtin'||liveSelected.includes(id)){
      syncLiveSelection();
      rebuildLiveItems(true);
    }
    notifyListsChanged();
  }
};
function kindSummary(arr){
  const c={live:0,movie:0,series:0,radio:0};
  arr.forEach(i=>{const k=detectKind(i);if(k==='movie'||k==='series'||k==='radio')c[k]++;else c.live++});
  const p=[];if(c.live)p.push(c.live+' قناة');if(c.movie)p.push(c.movie+' فيلم');if(c.series)p.push(c.series+' مسلسل');if(c.radio)p.push(c.radio+' راديو');
  return p.join('، ');
}
function sourceStatsOf(l){
  if(!l)return null;
  const Loader=window.WasslaSourceLoader;
  if(!Loader)return null;
  if(l.stats&&typeof l.stats.total==='number')return l.stats;
  if(!l.text)return null;
  const parsed=parseM3U(l.text);
  l.stats=Loader.compactStats(Loader.analyzeItems(parsed,{bytes:new Blob([l.text]).size}));
  return l.stats;
}
window.__sourceStatsOf=sourceStatsOf;
async function addList(text,name,url,opts){
  const o=opts||{};
  const Loader=window.WasslaSourceLoader;
  const externalSession=o.session||null;
  const silentLoader=!!o.silentLoader;
  const mode=o.mode||(url?'url':'file');
  const bytes=o.bytes||new Blob([String(text||'')]).size;
  const session=externalSession||(!silentLoader&&Loader?Loader.begin({
    mode,
    title:(name||'مصدر جديد')+(bytes?' · '+Loader.formatBytes(bytes):'')
  }):null);
  const ownedSession=!!(session&&!externalSession);
  const canFinishSession=!!(session&&!o.keepSessionOpen);
  const isXtreamSteps=mode==='xtream';

  try{
    if(session&&!isXtreamSteps){
      if(ownedSession&&mode==='file'){
        session.setStep('read','done','تمت قراءة الملف ('+Loader.formatBytes(bytes)+')');
      }
      session.setStep('parse','active','جاري قراءة أسطر القائمة واستخراج الروابط…');
      session.setProgress(mode==='url'?52:20,'جاري تحليل ملف القائمة…');
    }
    const n=Loader
      ? await Loader.parseM3UProgress(text,{
          signal:session?session.signal:undefined,
          onProgress(p){
            if(!session||session.aborted)return;
            if(!isXtreamSteps){
              const basePct=mode==='url'?50:18;
              const spanPct=mode==='url'?30:52;
              session.setProgress(basePct+Math.round((p.pct/100)*spanPct),'تم تحليل '+Loader.formatNum(p.parsedLines)+' من '+Loader.formatNum(p.totalLines)+' سطر · '+Loader.formatNum(p.itemsCount)+' عنصر');
              session.setStep('parse','active','تم استخراج '+Loader.formatNum(p.itemsCount)+' عنصر حتى الآن…');
              session.setStats({
                total:p.itemsCount,
                live:p.live,
                movies:p.movies,
                series:p.series,
                seriesEntries:p.seriesEntries,
                radio:p.radio,
                groups:p.groups,
                bytes
              });
            }
          }
        })
      : parseM3U(text);

    if(session&&session.aborted)return false;
    if(!n.length){
      const emptyErr='لم يتم العثور على قنوات. تأكد أن الملف بصيغة M3U، أو ملف txt فيه بيانات Xtream (السيرفر والمستخدم وكلمة السر).';
      setMsg(emptyErr,true);
      if(canFinishSession&&!session.closed)session.fail(emptyErr,'parse');
      return false;
    }

    if(session&&!isXtreamSteps){
      session.setStep('parse','done','تم استخراج '+Loader.formatNum(n.length)+' عنصر من القائمة');
      session.setStep('analyze','active','جاري تصنيف القنوات والأفلام والمسلسلات وحساب التصنيفات…');
      session.setProgress(84,'تصنيف المحتوى وإعداد الإحصائيات…');
    }
    const stats=Loader?Loader.analyzeItems(n,{bytes}):null;
    if(session&&stats){
      session.setStats(stats);
      if(!isXtreamSteps){
        session.setStep('analyze','done',Loader.formatStatsLine(stats,n.length));
      }
      session.setStep('save','active','جاري حفظ المصدر وتفعيله في التطبيق…');
      session.setProgress(93,'حفظ البيانات محلياً…');
    }

    let l=url?lists.find(x=>x.url===url):null;
    let delta=null;
    if(l){
      const prevItems=parseM3U(l.text);
      const prevUrls=new Set(prevItems.map(i=>i.url));
      const out=merge(prevItems,n,false);
      const addedCount=n.filter(i=>!prevUrls.has(i.url)).length;
      l.text=ser(out);l.remoteText=ser(n);l.n=out.length;l.upd=Date.now();
      const mergedStats=Loader?Loader.analyzeItems(out,{bytes:new Blob([l.text]).size}):null;
      if(mergedStats)l.stats=Loader.compactStats(mergedStats);
      delta={added:addedCount,kept:prevItems.length};
    }else{
      l={
        id:'l'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
        name:name||('قائمة '+(lists.filter(x=>x.id!==FAV_LIST_ID).length+1)),
        text:ser(n),
        remoteText:url?ser(n):'',
        url:url||'',
        n:n.length,
        upd:Date.now(),
        stats:stats&&Loader?Loader.compactStats(stats):null
      };
      lists.push(l);
    }

    const finalStats=Loader?Loader.analyzeItems(parseM3U(l.text),{bytes:new Blob([l.text]).size}):stats;
    if(finalStats&&Loader)l.stats=Loader.compactStats(finalStats);
    const hasLiveContent=!finalStats||((finalStats.live||0)+(finalStats.radio||0)>0);
    if(hasLiveContent&&!liveSelected.includes(l.id)){
      persistLiveSelection(liveSelected.concat(l.id));
    }
    if(hasLiveContent||!items.length)rebuildLiveItems(true);
    else{fillLists();saveLists()}
    mgr();
    notifyListsChanged();
    setMsg('تمت إضافة «'+l.name+'» ('+l.n+' عنصر).');
    if(window.WasslaNotify)WasslaNotify('تمت إضافة «'+l.name+'» — '+kindSummary(n));

    if(canFinishSession&&!session.closed){
      session.setStep('save','done','تم حفظ وتفعيل «'+l.name+'»');
      session.succeed({
        title:l.name,
        stats:finalStats||stats,
        delta,
        sourceId:l.id,
        note:delta?('تم دمج المصدر الموجود وحفظ '+Loader.formatNum(l.n)+' عنصر.'):'تم حفظ المصدر وتفعيله بنجاح.'
      });
    }
    return true;
  }catch(e){
    if(e&&e.name==='AbortError')return false;
    if(canFinishSession&&!session.closed){
      session.fail((e&&e.message)||'تعذّر تحليل وحفظ هذا المصدر.','parse');
    }
    throw e;
  }
}

// دالة لجلب قنوات Xtream Codes (Extreme)
async function loadXtreamCodes(host, username, password, name) {
  try {
    setMsg('جارٍ الاتصال بسيرفر Extreme...');
    host = host.replace(/\/$/, ""); // إزالة السلاش الأخير إن وجد
    
    const liveUrl = `${host}/player_api.php?username=${username}&password=${password}&action=get_live_streams`;
    const vodUrl = `${host}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`;

    const [liveRes, vodRes] = await Promise.all([
      fetch(liveUrl).catch(()=>null),
      fetch(vodUrl).catch(()=>null)
    ]);

    let m3uText = '#EXTM3U\n';
    let added = 0;

    if (liveRes && liveRes.ok) {
      const liveData = await liveRes.json();
      if(Array.isArray(liveData)){
        liveData.forEach(ch => {
          m3uText += `#EXTINF:-1 tvg-id="${ch.epg_channel_id||''}" tvg-name="${ch.name}" tvg-logo="${ch.stream_icon||''}" group-title="قنوات مباشرة",${ch.name}\n`;
          m3uText += `${host}/live/${username}/${password}/${ch.stream_id}.m3u8\n`;
          added++;
        });
      }
    }

    if (vodRes && vodRes.ok) {
      const vodData = await vodRes.json();
      if(Array.isArray(vodData)){
        vodData.forEach(movie => {
          m3uText += `#EXTINF:-1 tvg-name="${movie.name}" tvg-logo="${movie.stream_icon||''}" group-title="أفلام",${movie.name}\n`;
          m3uText += `${host}/movie/${username}/${password}/${movie.stream_id}.${movie.container_extension||'mp4'}\n`;
          added++;
        });
      }
    }

    if(added === 0) throw new Error("لم يتم العثور على قنوات في هذا السيرفر.");
    
    await addList(m3uText, name || 'سيرفر Extreme', null);
    $('dlg').close();
    setMsg('تم إضافة سيرفر Extreme بنجاح ('+added+' عنصر).');
  } catch (e) {
    setMsg('فشل الاتصال بسيرفر Xtream. تأكد من صحة البيانات والرابط.', true);
  }
}

async function updateList(id){
  if(window.__openSourceUpdateReview){
    if($('dlg').open)$('dlg').close();
    return window.__openSourceUpdateReview(id);
  }
  const proposal=await fetchListUpdate(id);
  await applyListUpdate(proposal,'merge');
  return true;
}
async function fetchListUpdate(id,opts){
  if(id===FAV_LIST_ID)throw new Error('قائمة المفضلة لا تُحدَّث من رابط');
  const l=lists.find(x=>x.id===id);
  if(!l)throw new Error('لا توجد قائمة لتحديثها');
  if(!l.url)throw new Error('«'+l.name+'» بلا رابط تحديث');
  setMsg('جارٍ تحديث «'+l.name+'»...');
  const Loader=window.WasslaSourceLoader;
  let text='',bytes=0;
  if(Loader){
    const dl=await Loader.fetchTextProgress(l.url,{
      signal:opts&&opts.signal,
      onProgress:opts&&opts.onDownload
    });
    text=dl.text;bytes=dl.bytes;
  }else{
    text=await getText(l.url);
    bytes=new Blob([text]).size;
  }
  const parsed=Loader
    ? await Loader.parseM3UProgress(text,{signal:opts&&opts.signal,onProgress:opts&&opts.onParse})
    : parseM3U(text);
  if(!parsed.length)throw new Error('لم يحتوِ الرابط على قنوات صالحة');
  return {id,kind:'url',sourceKey:l.url,items:parsed,remoteText:ser(parsed),bytes};
}
async function applyListUpdate(proposal,mode){
  const l=proposal&&lists.find(x=>x.id===proposal.id);
  if(!l||!window.WasslaSourceModel)throw new Error('تعذّر العثور على المصدر أو أداة التحديث');
  const sourceKey=proposal.kind==='xtream'&&l.xt?JSON.stringify(l.xt):l.url;
  if(!proposal.sourceKey||proposal.sourceKey!==sourceKey)throw new Error('تغير المصدر أثناء المراجعة؛ أعد المحاولة');
  const local=parseM3U(l.text||''),hasBaseline=!!l.remoteText;
  const base=parseM3U(hasBaseline?l.remoteText:l.text||'');
  const items=window.WasslaSourceModel.reconcileRemote(base,local,proposal.items,mode,!hasBaseline);
  l.remoteText=proposal.remoteText;l.text=ser(items);l.n=items.length;l.upd=Date.now();
  const Loader=window.WasslaSourceLoader;
  if(Loader)l.stats=Loader.compactStats(Loader.analyzeItems(items,{bytes:new Blob([l.text]).size}));
  await saveLists();
  if(liveSelected.includes(l.id))rebuildLiveItems(true);
  mgr();
  notifyListsChanged();
  setMsg('تم التحديث: '+items.length+' عنصر بعد '+(mode==='replace'?'الاستبدال':'الدمج')+'.');
  return true;
}
window.__fetchListUpdate=fetchListUpdate;
window.__applyListUpdate=applyListUpdate;
async function deleteList(id){
  if(id===FAV_LIST_ID){setMsg('لا يمكن حذف قائمة المفضلة.',true);return}
  if(id==='builtin')LS.set('m3u_builtin_off',true);   // لا تعود القائمة المدمجة وحدها إلا بزر «استعادة»
  lists=lists.filter(x=>x.id!==id);
  liveParseCache.delete(id);
  const nextLive=liveSelected.filter(x=>x!==id);
  persistLiveSelection(nextLive);
  if(lists.some(l=>l.id!==FAV_LIST_ID)){
    rebuildLiveItems(true);
  }else{
    tok++;stopAll();active='';showWelcome();fillLists();saveLists();
  }
  mgr();
  notifyListsChanged();
}
function mgr(){
  const b=$('mgr');b.textContent='';
  const normalLists=lists.filter(l=>l.id!==FAV_LIST_ID);
  if(!normalLists.length){b.innerHTML='<p class="small">لا توجد قوائم بعد. أضف قائمة من الأعلى.</p>';return}
  const Loader=window.WasslaSourceLoader;
  normalLists.forEach(l=>{
    const d=document.createElement('div');d.className='lrow'+(liveSelected.includes(l.id)?' cur':'');
    const summary=Loader?Loader.formatStatsLine(sourceStatsOf(l),l.n):((l.n||0)+' قناة');
    d.innerHTML='<input class="ln" value="'+esc(l.name)+'"><input class="lu" type="url" placeholder="رابط التحديث (اختياري)" value="'+esc(l.url||'')+'"><div class="lb"><button class="alt o">'+(liveSelected.includes(l.id)?'✓ في القنوات':'تفعيل للقنوات')+'</button><button class="alt st-btn">📊 إحصائيات</button><button class="alt m">دمج ملف</button><button class="alt u">🔄 تحديث</button><button class="alt x">حذف</button></div><small>'+esc(summary)+(l.upd?' · '+new Date(l.upd).toLocaleDateString('ar'):'')+'</small>';
    const q=s=>d.querySelector(s);
    q('.ln').onchange=e=>{l.name=e.target.value.trim()||l.name;fillLists();saveLists();notifyListsChanged()};
    q('.lu').onchange=e=>{l.url=e.target.value.trim();saveLists()};
    q('.o').onclick=()=>{if(window.__liveSources)window.__liveSources.toggle(l.id);else openList(l.id);mgr()};
    q('.st-btn').onclick=()=>{if(Loader)Loader.showInspect(l)};
    q('.m').onclick=()=>{mergeTarget=l.id;$('mfile').click()};
    q('.u').onclick=()=>updateList(l.id);
    let armed=0;const x=q('.x');
    x.onclick=()=>{if(armed){deleteList(l.id);return}armed=1;x.textContent='تأكيد؟';setTimeout(()=>{armed=0;x.textContent='حذف'},3000)};
    b.appendChild(d);
  });
}

function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function render(){
  const q=$('q').value.trim().toLowerCase(),g=$('grp').value;
  let base=items;
  if(g==='__fav')base=items.filter(i=>favs.has(i.url));
  else if(g==='__rec')base=recs.map(u=>items.find(i=>i.url===u)).filter(Boolean);
  else if(g==='__avail')base=items.filter(i=>i.url&&i.url.trim());
  else if(g.startsWith('__k_')){const k=g.slice(4);base=items.filter(i=>detectKind(i)===k)}
  else if(g)base=items.filter(i=>(i.group||'بدون مجموعة')===g);
  // واجهة القنوات للبث المباشر فقط: الأفلام والمسلسلات تُعرض في المكتبة
  if(document.body.classList.contains('rcv')&&!g.startsWith('__k_'))base=base.filter(i=>{const k=i._k||(i._k=detectKind(i));return k!=='movie'&&k!=='series'});
  shown=base.filter(i=>!q||i.name.toLowerCase().includes(q));
  $('count').textContent='يعرض '+shown.length+' من '+items.length;
  if(document.body.classList.contains('rcv')){favBtn();return}   // قائمة الصفحة مخفية في وضع الريسيفر: لا حاجة لبناء مئات العناصر عند كل تبديل
  const box=$('list');box.textContent='';
  const frag=document.createDocumentFragment();
  shown.slice(0,1500).forEach(it=>{
    const pic=it.logo?'<img loading="lazy" alt="" src="'+esc(it.logo)+'" onerror="this.outerHTML=\'<span class=ph>'+esc((it.name[0]||'?').replace(/[<>&"']/g,''))+'</span>\'">':'<span class="ph">'+esc(it.name[0]||'?')+'</span>';
    const kind=detectKind(it);
    const w=document.createElement('div');w.className='rw';
    const b=document.createElement('button');b.className='ch'+(it.url===curUrl?' on':'');b.type='button';b._it=it;
    b.innerHTML=pic+'<div><b>'+KIND_ICON[kind]+' '+esc(it.name)+'</b><small>'+esc(it.group||'بدون مجموعة')+'</small></div>';
    b.onclick=()=>play(it);
    const s=document.createElement('button');s.type='button';s.className='st'+(favs.has(it.url)?' on':'');s.textContent=favs.has(it.url)?'★':'☆';s._u=it.url;s.title='المفضلة';s.onclick=()=>toggleFav(it.url);
    w.append(b,s);frag.appendChild(w);
  });
  box.appendChild(frag);
  if(shown.length>1500){const d=document.createElement('div');d.className='count';d.textContent='تم عرض أول 1500 نتيجة. استخدم البحث لتضييق القائمة.';box.appendChild(d)}
  favBtn();
}
function markOn(){document.querySelectorAll('#list .ch').forEach(b=>b.classList.toggle('on',!!b._it&&b._it.url===curUrl))}
function favBtn(){const on=curUrl&&favs.has(curUrl);$('pf').textContent=on?'★ في المفضلة':'☆ أضف للمفضلة'}
function toggleFav(u){
  if(!u)return;
  if(favs.has(u))favs.delete(u);else favs.add(u);
  LS.set('m3u_favs',[...favs]);
  document.querySelectorAll('#list .st').forEach(s=>{const on=favs.has(s._u);s.classList.toggle('on',on);s.textContent=on?'★':'☆'});
  favBtn();if($('grp').value==='__fav')render();
  syncFavList();
}
$('pf').onclick=()=>toggleFav(curUrl);

function stopAll(){
  if(playbackAttemptCleanup){playbackAttemptCleanup();playbackAttemptCleanup=null}
  if(hls){try{hls.destroy()}catch(e){}hls=null}
  if(mp){try{mp.destroy()}catch(e){}mp=null}
  const v=$('v');v.onerror=null;v.removeAttribute('src');v.load();
}
function streamMeta(it){
  const rawUrl=String((it&&it.url)||'');
  const split=window.__splitStreamUrl?window.__splitStreamUrl(rawUrl):{url:rawUrl,ua:'',ref:''};
  let ua=split.ua||'',ref=split.ref||'';
  if(it&&Array.isArray(it.extra)){
    it.extra.forEach(line=>{
      const mUa=/^#EXTVLCOPT:http-user-agent=(.+)$/i.exec(line);
      if(mUa&&!ua)ua=mUa[1].trim();
      const mRef=/^#EXTVLCOPT:http-referrer=(.+)$/i.exec(line);
      if(mRef&&!ref)ref=mRef[1].trim();
    });
  }
  return{url:split.url||rawUrl,ua,ref};
}
function modesFor(u,it,forcedMode){
  const Playback=window.WasslaVodPlayback;
  if(forcedMode&&Playback&&Playback.prioritizeModes)return Playback.prioritizeModes(u,forcedMode);
  if(isVodPlayback()&&window.__vodPreferredModes)return window.__vodPreferredModes(u,it);
  return Playback?Playback.playbackModes(u):['native','hls','mpegts'];
}
function isVodPlayback(){return document.body.classList.contains('cine-play')||document.body.classList.contains('cine-mini')}
function formatPlayError(code){
  if(code===403)return 'رفض السيرفر الاتصال بهذا الرابط (403) — قد يكون محظوراً أو منتهي الصلاحية أو مقيّداً.';
  if(code===401)return 'بيانات الدخول لهذا الرابط غير صالحة أو منتهية (401).';
  if(code===404||code===410)return 'القناة أو المحتوى غير متاح حالياً على السيرفر ('+code+').';
  return 'تعذر تشغيل هذا الرابط. قد يكون متوقفاً أو محجوباً أو بصيغة لا يدعمها المتصفح.';
}
function play(it,opts){
  const playOpts=opts||{};
  curUrl=it.url;
  recs=[it.url].concat(recs.filter(u=>u!==it.url)).slice(0,30);LS.set('m3u_recs',recs);
  if(isVodPlayback()){
    LS.set('m3u_last_was_vod',true);
  }else{
    LS.set('m3u_last_was_vod',false);
    const listId=it._listId||active;
    LS.set('m3u_last',{url:it.url,name:it.name,listId,ts:Date.now()});
    window.__playCtx={listId,grp:$('grp').value,q:$('q').value};   // منطقة القناة العاملة: المصدر + المجموعة + البحث
  }
  $('now').textContent=it.name||'تشغيل';
  setMsg(isVodPlayback()?'جارٍ تشغيل المحتوى…':'');favBtn();
  $('resumebar').classList.add('hide');

  // Keep the receiver OSD name-only for live TV only.
  const osd = $('osd');
  if(osd && !isVodPlayback()) {
    osd.textContent = it.name;
    osd.style.display = 'block';
    clearTimeout(window.__osdTimer);
    window.__osdTimer=setTimeout(() => { osd.style.display = 'none'; }, 5000);
  } else if(osd) {
    osd.style.display = 'none';
  }

  const plEl=$('player');if(plEl)plEl.classList.remove('hide');
  const meta=streamMeta(it);
  const v=$('v'),my=++tok,baseModes=modesFor(meta.url,it,playOpts.forcedMode);
  const attempts=baseModes.map(mode=>({mode,direct:false}));
  const canTryDirect=/^https:\/\//i.test(meta.url);
  let directQueued=false,lastCode=0,i=0,started=false,attemptTimer=null;
  window.__playTrying=true;
  window.__vodActiveEngine=baseModes[0]||'native';

  const next=()=>{
    if(my!==tok)return;
    if(i>=attempts.length){
      window.__playTrying=false;
      const errMsg=formatPlayError(lastCode);
      setMsg(errMsg,true);
      if(isVodPlayback()&&window.WasslaNotify)WasslaNotify(errMsg,{ms:4500});
      return;
    }
    const step=attempts[i],m=step.mode;
    const libraryName=m==='hls'?'Hls':m==='mpegts'?'mpegts':'';
    const libraryReady=libraryName&&window.__mediaLibraryPromises&&window.__mediaLibraryPromises[libraryName];
    if(libraryReady&&!window[libraryName]&&!step.libraryWaited){
      step.libraryWaited=true;
      libraryReady.then(()=>{if(my===tok)next()});
      return;
    }
    i++;
    stopAll();
    window.__vodActiveEngine=m;
    let settled=false;
    const onStarted=()=>{
      if(settled||my!==tok)return;
      started=true;
      clearTimeout(attemptTimer);attemptTimer=null;
      window.__playTrying=false;
      setMsg('');
      if(isVodPlayback()&&window.__vodOnEngineStarted)window.__vodOnEngineStarted(it,m,playOpts);
      cleanup();
    };
    let playPending=false;
    const requestPlay=()=>{
      if(my!==tok||settled||playPending)return;
      playPending=true;
      const request=v.play();
      if(request&&request.then)request.then(()=>{playPending=false},err=>{
        playPending=false;
        if(my!==tok||started)return;
        if(err&&err.name==='NotAllowedError'||v.readyState>=2)fail(0);
      });
    };
    const onReady=()=>{
      if(my!==tok||settled||!v.src&&!hls&&!mp)return;
      if(v.readyState<2)return;
      requestPlay();
    };
    const cleanup=()=>{
      clearTimeout(attemptTimer);attemptTimer=null;
      v.removeEventListener('playing',onStarted);
      v.removeEventListener('loadedmetadata',onReady);
      v.removeEventListener('canplay',onReady);
      if(playbackAttemptCleanup===cleanup)playbackAttemptCleanup=null;
    };
    playbackAttemptCleanup=cleanup;
    v.addEventListener('playing',onStarted,{once:true});
    v.addEventListener('loadedmetadata',onReady);
    v.addEventListener('canplay',onReady);
    const fail=(httpCode)=>{
      if(settled||my!==tok)return;
      settled=true;
      cleanup();
      const code=Number(httpCode)||0;
      if(code>=400)lastCode=code;
      if(isVodPlayback()&&started){
        window.__playTrying=false;
        const message=code===403?formatPlayError(403):'تعذّر استكمال تشغيل المحتوى. حاول التقديم مجدداً أو أعد تشغيله.';
        if(window.WasslaNotify)WasslaNotify(message,{ms:4200});else if(window.__rcvToast)window.__rcvToast(message);else setMsg(message,true);
        return;
      }
      if((code===401||code===403||code===404||code===410)&&!step.direct){
        if(canTryDirect&&!directQueued&&code===403){
          directQueued=true;
          attempts.splice(i,attempts.length-i,{mode:baseModes[0],direct:true});
          if(baseModes[0]!=='native')attempts.push({mode:'native',direct:true});
        }else{
          attempts.length=i;
        }
      }
      next();
    };
    const skip=()=>{if(settled)return;settled=true;cleanup();next()};
    attemptTimer=setTimeout(()=>{
      if(!settled&&my===tok&&!started)fail(1800);
    },45000);
    try{
      const playUrl=(!step.direct&&window.__proxyUrl)?window.__proxyUrl(meta.url,m==='hls',{ua:meta.ua,ref:meta.ref}):meta.url;
      if(m==='hls'){
        if(!(window.Hls&&Hls.isSupported()))return skip();
        hls=new Hls({enableWorker:true});hls.loadSource(playUrl);hls.attachMedia(v);
        hls.on(Hls.Events.ERROR,(e,d)=>{
          if(d&&d.fatal){
            const code=(d.response&&d.response.code)||0;
            fail(code);
          }
        });
      }else if(m==='mpegts'){
        if(!(window.mpegts&&mpegts.isSupported()))return skip();
        if(mpegts.LoggingControl){
          mpegts.LoggingControl.enableAll=false;
          mpegts.LoggingControl.enableError=false;
          mpegts.LoggingControl.enableWarn=false;
          mpegts.LoggingControl.enableInfo=false;
          mpegts.LoggingControl.enableDebug=false;
          mpegts.LoggingControl.enableVerbose=false;
        }
        mp=mpegts.createPlayer({type:/\.flv(\?|$)/i.test(meta.url)?'flv':'mpegts',isLive:!isVodPlayback(),url:playUrl});
        mp.attachMediaElement(v);mp.load();
        mp.on(mpegts.Events.ERROR,(_type,_detail,info)=>fail(info&&info.code));
      }else{
        v.onerror=()=>fail(0);v.src=playUrl;v.load();
      }
      requestPlay();
    }catch(e){fail(0)}
  };
  next();
  markOn();
}
window.__vodPlayWithOpts=(it,opts)=>play(it,opts);
window.__vodGetHls=()=>hls;
window.__vodGetMpegts=()=>mp;
function step(d){
  if(!shown.length)return;
  const k=shown.findIndex(i=>i.url===curUrl);
  play(shown[k<0?0:(k+d+shown.length)%shown.length]);
}
$('prev').onclick=()=>step(-1);$('nextb').onclick=()=>step(1);
function fs(){
  const target=isVodPlayback()?($('player')||$('v')):$('v');
  if(document.fullscreenElement)document.exitFullscreen();
  else if(target&&target.requestFullscreen)target.requestFullscreen().catch(()=>{$('v').requestFullscreen&&$('v').requestFullscreen().catch(()=>{})});
}
async function pip(){try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await $('v').requestPictureInPicture()}catch(e){setMsg('وضع صورة داخل صورة غير متاح الآن.',true)}}
$('fsb').onclick=fs;$('pipb').onclick=pip;

$('unmute').onclick=()=>{const v=$('v');v.muted=false;v.volume=1;$('resumebar').classList.add('hide')};
$('resumex').onclick=()=>$('resumebar').classList.add('hide');

async function tryResume(){
  if(!LS.get('m3u_resume',true))return false;
  if(LS.get('m3u_last_was_vod',false))return false;
  const last=LS.get('m3u_last');
  if(!last||!last.listId||!last.url)return false;
  const list=lists.find(l=>l.id===last.listId);
  if(!list)return false;
  const parsed=parseM3U(list.text);
  const item=parsed.find(i=>i.url===last.url);
  if(!item||detectKind(item)!=='live')return false;
  if(!liveSelected.includes(list.id)){persistLiveSelection(liveSelected.concat(list.id));rebuildLiveItems(true)}
  play(item);
  const v=$('v');
  try{
    v.muted=false;
    await v.play();
  }catch(e){
    v.muted=true;
    try{await v.play()}catch(e2){}
    $('resumebar').classList.remove('hide');
  }
  setMsg('▶ استئناف: '+item.name);
  return true;
}

const resumeChk=$('resume');
resumeChk.checked=LS.get('m3u_resume',true);
resumeChk.onchange=e=>LS.set('m3u_resume',e.target.checked);

document.addEventListener('keydown',e=>{
  const t=e.target.tagName;
  if(/INPUT|TEXTAREA|SELECT/.test(t)||document.querySelector('dialog[open]')||e.ctrlKey||e.altKey||e.metaKey)return;
  const k=e.key.toLowerCase(),v=$('v');
  if(k==='f')fs();
  else if(k==='p')pip();
  else if(k==='m')v.muted=!v.muted;
  else if(k==='b')toggleFav(curUrl);
  else if(k==='t')cycleTheme();
  else if(k==='/'){e.preventDefault();$('q').focus()}
  else if(k==='arrowup'||k==='pageup'){e.preventDefault();step(-1)}
  else if(k==='arrowdown'||k==='pagedown'){e.preventDefault();step(1)}
  else if(k===' '&&t!=='BUTTON'&&t!=='VIDEO'){e.preventDefault();v.paused?v.play().catch(()=>{}):v.pause()}
  // دعم أرقام الريموت (0-9) للتنقل السريع
  else if (k >= '0' && k <= '9') {
    const idx = parseInt(k);
    if (shown[idx]) {
      play(shown[idx]);
    }
  }
});

function openSet(){$('cf').value='';$('forget').disabled=true;mgr();$('dlg').showModal()}
$('set').onclick=openSet;$('welcomeAdd').onclick=openSet;$('close').onclick=()=>$('dlg').close();
$('upd').onclick=()=>updateList(active);
$('lists').onchange=e=>openList(e.target.value);
function readText(f){return new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>ok('');r.readAsText(f,'UTF-8')})}
async function addFiles(fs_){
  const Loader=window.WasslaSourceLoader;
  let okAny=false;
  for(const f of fs_){
    const baseName=f.name.replace(/\.[^.]+$/,'');
    const session=Loader?Loader.begin({mode:'file',title:baseName+(f.size?' · '+Loader.formatBytes(f.size):'')}):null;
    try{
      if(session){
        session.setStep('read','active','جاري قراءة «'+f.name+'» ('+Loader.formatBytes(f.size)+')…');
        session.setProgress(10,'قراءة الملف من الجهاز…');
      }
      const text=await readText(f);
      if(session&&session.aborted)break;
      if(!text){
        if(session)session.fail('تعذّرت قراءة الملف أو أن الملف فارغ.','read');
        continue;
      }
      if(session)session.setStep('read','done','تمت قراءة الملف ('+Loader.formatBytes(f.size||new Blob([text]).size)+')');
      const added=await addList(text,baseName,'',{session,mode:'file',bytes:f.size||new Blob([text]).size});
      if(added)okAny=true;
    }catch(e){
      if(session&&!session.closed)session.fail((e&&e.message)||'تعذّرت إضافة الملف.','parse');
    }
  }
  if(okAny&&$('dlg').open)$('dlg').close();
}
$('file').onchange=e=>{const a=[...e.target.files];e.target.value='';a.length&&addFiles(a)};
$('mfile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';const l=lists.find(x=>x.id===mergeTarget);if(!f||!l)return;
  const Loader=window.WasslaSourceLoader;
  const session=Loader?Loader.begin({mode:'merge',title:l.name+' ← '+f.name}):null;
  try{
    if(session){
      session.setStep('read','active','جاري قراءة «'+f.name+'» ('+Loader.formatBytes(f.size)+')…');
      session.setProgress(12,'قراءة ملف الدمج…');
    }
    const text=await readText(f);
    if(session&&session.aborted)return;
    if(session){
      session.setStep('read','done','تمت قراءة الملف ('+Loader.formatBytes(f.size)+')');
      session.setStep('parse','active','جاري تحليل العناصر الجديدة ومقارنتها…');
    }
    const n=Loader
      ? await Loader.parseM3UProgress(text,{
          signal:session?session.signal:undefined,
          onProgress(p){
            if(!session||session.aborted)return;
            session.setProgress(20+Math.round((p.pct/100)*55),'تم تحليل '+Loader.formatNum(p.itemsCount)+' عنصر…');
            session.setStats({total:p.itemsCount,live:p.live,movies:p.movies,series:p.series,seriesEntries:p.seriesEntries,radio:p.radio,groups:p.groups,bytes:f.size});
          }
        })
      : parseM3U(text);
    if(session&&session.aborted)return;
    if(!n.length){
      setMsg('الملف لا يحتوي قائمة M3U مقروءة.',true);
      if(session)session.fail('الملف لا يحتوي قائمة M3U مقروءة.','parse');
      return;
    }
    const old=parseM3U(l.text),had=new Set(old.map(i=>i.url)),out=merge(old,n,false);
    const addedCount=n.filter(i=>!had.has(i.url)).length;
    if(session){
      session.setStep('parse','done','تم تحليل '+Loader.formatNum(n.length)+' عنصر ('+Loader.formatNum(addedCount)+' جديد)');
      session.setStep('save','active','جاري دمج العناصر وحفظ المصدر…');
      session.setProgress(90,'حفظ القائمة المدمجة…');
    }
    l.text=ser(out);l.n=out.length;l.upd=Date.now();
    const finalStats=Loader?Loader.analyzeItems(out,{bytes:new Blob([l.text]).size}):null;
    if(finalStats&&Loader)l.stats=Loader.compactStats(finalStats);
    await saveLists();
    if(liveSelected.includes(l.id))rebuildLiveItems(true);
    mgr();notifyListsChanged();
    setMsg('تم دمج الملف في «'+l.name+'»: '+addedCount+' عنصر جديد، المجموع '+out.length+'.');
    if(session){
      session.setStep('save','done','تم الدمج بنجاح في «'+l.name+'»');
      session.succeed({
        heading:'اكتمل دمج الملف بنجاح',
        title:l.name,
        stats:finalStats,
        delta:{added:addedCount,kept:old.length},
        sourceId:l.id,
        note:'تمت إضافة '+Loader.formatNum(addedCount)+' عنصر جديد إلى «'+l.name+'».'
      });
    }
  }catch(err){
    if(err&&err.name==='AbortError')return;
    if(session&&!session.closed)session.fail((err&&err.message)||'تعذّر دمج الملف.','parse');
  }
};
$('fetch').onclick=async()=>{
  const u=$('url').value.trim();if(!u){setMsg('أدخل رابط القائمة أولاً.',true);return}
  let nm='';
  try{nm=new URL(u).hostname}catch(e){}
  const Loader=window.WasslaSourceLoader;
  const session=Loader?Loader.begin({mode:'url',title:nm||u}):null;
  setMsg('جارٍ الجلب...');
  try{
    if(session){
      session.setStep('fetch','active','جاري الاتصال بـ '+(nm||u)+' وتنزيل القائمة…');
      session.setProgress(null,'بانتظار استجابة الخادم…');
    }
    let text='',bytes=0;
    if(Loader){
      const dl=await Loader.fetchTextProgress(u,{
        signal:session?session.signal:undefined,
        onProgress(p){
          if(!session||session.aborted)return;
          const pct=p.pct!=null?Math.max(4,Math.round(p.pct*0.48)):null;
          const note=p.totalBytes
            ? ('تم تنزيل '+Loader.formatBytes(p.loadedBytes)+' من '+Loader.formatBytes(p.totalBytes))
            : ('تم تنزيل '+Loader.formatBytes(p.loadedBytes)+'…');
          session.setProgress(pct,note);
          session.setStep('fetch','active',note);
        }
      });
      text=dl.text;bytes=dl.bytes;
    }else{
      text=await getText(u);bytes=new Blob([text]).size;
    }
    if(session&&session.aborted)return;
    if(session){
      session.setStep('fetch','done','تم تنزيل '+Loader.formatBytes(bytes)+' بنجاح');
      session.setProgress(50,'اكتمل التنزيل ('+Loader.formatBytes(bytes)+')');
    }
    if(await addList(text,nm,u,{session,bytes,mode:'url'})){
      $('url').value='';
      if($('dlg').open)$('dlg').close();
    }
  }catch(e){
    if(e&&e.name==='AbortError')return;
    const errMsg=(e&&e.message)?e.message:'تعذر جلب الرابط (قد يمنعه المتصفح أو الموقع).';
    setMsg(errMsg,true);
    if(session&&!session.closed)session.fail(errMsg,'fetch');
  }
};

// زر إضافة Extreme
$('xt_add').onclick = () => {
  const host = $('xt_host').value.trim();
  const user = $('xt_user').value.trim();
  const pass = $('xt_pass').value.trim();
  if(host && user && pass) {
    if(window.xtAdd){
      setMsg('جارٍ الاتصال بالسيرفر… (قد يستغرق لحظات)');
      window.xtAdd(host, user, pass, 'سيرفر Extreme').then(ok=>{
        if(ok){if($('dlg').open)$('dlg').close();setMsg('تمت إضافة السيرفر: قنوات وأفلام ومسلسلات.')}
        else setMsg('فشل الاتصال بسيرفر Xtream. تأكد من صحة البيانات والرابط.', true);
      }).catch(()=>setMsg('فشل الاتصال بسيرفر Xtream. تأكد من صحة البيانات والرابط.', true));
    } else loadXtreamCodes(host, user, pass, 'سيرفر Extreme');
  } else {
    setMsg('يرجى ملء جميع الحقول الخاصة بالسيرفر.', true);
  }
};

$('cf').oninput=e=>{$('forget').disabled=e.target.value.trim()!=='مسح'};
$('forget').onclick=async()=>{
  tok++;stopAll();await DB.del('lists');await DB.del('list');
  LS.del('m3u_favs');LS.del('m3u_recs');LS.del('m3u_fav_meta');LS.del('m3u_last');LS.del('m3u_skip_upd');
  favs=new Set();recs=[];lists=[];active='';curUrl='';
  fillLists();showWelcome();$('dlg').close();setMsg('تم مسح كل القوائم والمفضلة.');
};
let qT;$('q').oninput=()=>{clearTimeout(qT);qT=setTimeout(render,120)};
let gT;$('grp').onchange=()=>{clearTimeout(gT);gT=setTimeout(render,80)};
['dragover','dragenter'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();$('drop').classList.add('over')}));
['dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();$('drop').classList.remove('over')}));
document.addEventListener('drop',e=>{const a=[...e.dataTransfer.files];a.length&&addFiles(a)});

/* ---------- فحص التحديثات من المدونة ---------- */
const APP_VERSION=(window.Android&&Android.version())||'16.0.0';
const UPDATE_PAGE='https://wasslatv.blogspot.com/p/version.html';

$('ver').textContent=APP_VERSION;$('ver2').textContent=APP_VERSION;$('fv').textContent=APP_VERSION;

function compareVer(a,b){
  const pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){
    const x=pa[i]||0,y=pb[i]||0;
    if(x>y)return 1;
    if(x<y)return -1;
  }
  return 0;
}

async function checkUpdates(silent){
  try{
    let update=null;
    try{
      if(window.WasslaUpdateManifest)update=await window.WasslaUpdateManifest.fetchLatest();
    }catch(error){console.warn('GitHub update manifest unavailable; trying the legacy update page.',error)}
    if(!update){
      const r=await fetch(UPDATE_PAGE+'?t='+Date.now(),{cache:'no-store'});
      if(!r.ok){if(!silent)setMsg('تعذر الوصول لصفحة التحديثات.',true);return false}
      const text=await r.text();
      const get=id=>{
        const m=text.match(new RegExp('id=["\']'+id+'["\'][^>]*>([\\s\\S]*?)<','i'));
        return m?m[1].trim():'';
      };
      const version=get('ver'),apkUrl=get('dl'),notes=get('notes');
      if(!version||!apkUrl){if(!silent)setMsg('صفحة التحديثات لا تحتوي بيانات صحيحة.',true);return false}
      update={version,apkUrl,notes};
    }
    const{version:ver,apkUrl:dl,notes}=update;
    if(compareVer(ver,APP_VERSION)<=0){
      if(!silent)setMsg('✓ لديك أحدث إصدار ('+APP_VERSION+')');
      return false;
    }
    if(LS.get('m3u_skip_upd')===ver){
      if(!silent)setMsg('يوجد إصدار '+ver+' (تجاهلته سابقاً).');
      return true;
    }
    $('updver').textContent=ver;
    $('updnotes').textContent=notes||'';
    $('updlink').href=dl;
    $('updbar').classList.remove('hide');
    if(!silent)setMsg('إصدار جديد '+ver+' متاح.');
    return true;
  }catch(e){
    if(!silent)setMsg('تعذر فحص التحديثات (قد يمنع المتصفح الاتصال).',true);
    return false;
  }
}

$('updskip').onclick=()=>{
  const v=$('updver').textContent;
  if(v)LS.set('m3u_skip_upd',v);
  $('updbar').classList.add('hide');
};
$('checkupd').onclick=()=>checkUpdates(false);

/* ---------- startup ---------- */
(async()=>{
  let d=null;try{d=await DB.get('lists')}catch(e){}
  if(d&&d.lists && d.lists.length > 0){
    lists=d.lists;active=d.active;
  } else if(LS.get('m3u_builtin_off',false)){
    // المستخدم حذف القائمة المدمجة عمداً: لا تُعاد تلقائياً
    lists=[];active='';
  } else {
    // قائمة مؤقتة حتى تُحمّل بيانات القنوات المعبأة من الأصول.
    lists=[{id:'builtin',name:'القنوات',text:'#EXTM3U\n',url:'',n:0,upd:Date.now()}];
    active='builtin';saveLists();
  }
  if(favs.size&&!lists.find(l=>l.id===FAV_LIST_ID)){
    await syncFavList();
  }
  if(active===FAV_LIST_ID)active=lists.find(l=>l.id!==FAV_LIST_ID)?.id||'';
  const normals=lists.filter(l=>l.id!==FAV_LIST_ID);
  const lastPlayed=LS.get('m3u_last',null),lastId=lastPlayed&&lastPlayed.listId;
  syncLiveSelection(normals.some(l=>l.id===lastId)?lastId:(normals.some(l=>l.id===active)?active:''));
  if(normals.length)rebuildLiveItems(false);
  else if(lists.find(l=>l.id===FAV_LIST_ID))openList(FAV_LIST_ID);
  else showWelcome();
  notifyListsChanged();
  setTimeout(()=>tryResume(),250);
  setTimeout(()=>checkUpdates(true),1500);
  if(window.Android&&Android.readAsset){
    try{
      const config=JSON.parse(Android.readAsset('source-config.json')||'{}');
      const done=LS.get('m3u_packaged_sources',[]);
      for(const account of (Array.isArray(config.accounts)?config.accounts:[])){
        if(!account||!account.id||done.includes(account.id))continue;
        const imported=await addList(account.content,account.name||'Xtream','',{silentLoader:true});
        if(imported){done.push(account.id);LS.set('m3u_packaged_sources',done)}
      }
    }catch(e){setMsg('تعذّر تحميل إعدادات المصادر المضمّنة.',true)}
  }
})();
