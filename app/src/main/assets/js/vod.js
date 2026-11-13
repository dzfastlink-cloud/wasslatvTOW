/* ===== مكتبة الأفلام والمسلسلات (VOD): وضع مستقل بمعزل عن البث المباشر =====
   • تعرض الأفلام والمسلسلات من روابطها المخصصة فقط (detectKind)، ولا تعرض البث المباشر.
   • المسلسلات تُجمَّع بالمواسم والحلقات من أسماء مثل S01E02 أو «الموسم 1 الحلقة 2».
   • أي مصدر جديد فيه أفلام يظهر هنا تلقائياً (إضافة مكتبات لاحقاً = إضافة مصدر).
   التنقل: ↑ ↓ بين الصفوف · ← → داخل الصف · OK فتح · رجوع خطوة للخلف. */
(function(){
  const el=$('vod'),bodyEl=$('vodb'),tabsEl=$('vtabs'),B=document.body;
  let srcId='',query='',on=false,idx=null,idxSig='',filter='all',rowsData=[],rIdx=0,cols=[],zone='rows',tIdx=0;
  let screen='home',detailReturn='home',cur=null,curEps=[],sIdx=0,eIdx=0,playing=null,lastLive=null;
  let nextTimer=null,nextCard=null,nextEpisode=null,progressTimer=null,detailScrollTop=0,detailRowScroll=[],detailIndex=0;
  const FILTERS=['all','movies','series'];
  const Model=window.WasslaVodModel;
  const progress=()=>LS.get('m3u_vod_progress',{});
  const watched=()=>LS.get('m3u_vod_watched',{});
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const toast=t=>{if(window.__rcvToast)window.__rcvToast(t)};
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
  function detailKey(k){
    const buttons=[...bodyEl.querySelectorAll('.vdetails button')];
    if(!buttons.length)return;
    if(k==='ArrowDown'||k==='ArrowRight')detailIndex=Math.min(buttons.length-1,detailIndex+1);
    else if(k==='ArrowUp'||k==='ArrowLeft')detailIndex=Math.max(0,detailIndex-1);
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
  function makeRows(){
    const candidates=[];
    if(filter!=='series')candidates.push(...idx.movies);
    if(filter!=='movies')candidates.push(...idx.series);
    const q=Model.normalizeSearch(query);
    const all=candidates.filter(c=>(!srcId||c.sourceId===srcId)&&(!q||[
      c.title,c.group,c.sourceName
    ].some(value=>Model.normalizeSearch(value).includes(q))));
    const rows=[];
    if(!all.length)return rows;
    const records=progress(),seen=watched();
    const resume=all.map(card=>{
      let record=null;
      if(card.kind==='movie')record=records[card.item.url];
      else record=cardRecord(card);
      const cardId=card.kind==='movie'?card.item.url:(card.lazy||card.sourceId+':'+card.title);
      if(seen[cardId])return null;
      return record&&Model&&Model.shouldResume(record)?Object.assign({},card,{resumeRecord:record}):null;
    }).filter(Boolean).sort((a,b)=>(b.resumeRecord.updated||0)-(a.resumeRecord.updated||0));
    if(resume.length)rows.push({title:'متابعة المشاهدة',cards:resume.slice(0,40)});
    rows.push({title:'أُضيفت حديثاً',cards:all.slice(-40).reverse()});
    const by=new Map();
    all.forEach(c=>{
      const group=c.group||'أخرى',key=Model.normalizeSearch(group)||group;
      if(!by.has(key))by.set(key,{title:group,cards:[]});
      by.get(key).cards.push(c);
    });
    [...by.values()].sort((a,b)=>b.cards.length-a.cards.length).slice(0,40)
      .forEach(row=>rows.push({title:row.title+' ('+row.cards.length+')',cards:row.cards.slice(0,60)}));
    return rows;
  }

  /* ---------- الرسم ---------- */
  function updateHero(c){
    if(!c)return;
    const img=$('vpimg');
    if(c.logo){img.src=c.logo;img.style.display=''}else img.style.display='none';
    $('vpt').textContent=c.title;
    const record=c.resumeRecord||(c.kind==='movie'?progress()[c.item.url]:c.lazy?progress()[c.lazy]:null);
    $('vps').textContent=(c.kind==='series'?'مسلسل'+(c.eps.length?' · '+c.eps.length+' حلقة':''):'فيلم')+
      (c.group?' · '+c.group:'')+(c.sourceName?' · '+c.sourceName:'')+
      (record&&Model&&Model.shouldResume(record)?' · متابعة عند '+fmt(record.position):'');
  }
  function sourceOptions(){
    const select=$('vodsource'),sources=lists.filter(l=>l.id!==FAV_LIST_ID&&l.id!=='builtin');
    if(srcId&&!sources.some(l=>l.id===srcId))srcId='';
    select.textContent='';
    const all=document.createElement('option');all.value='';all.textContent='كل المصادر';select.appendChild(all);
    sources.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;select.appendChild(o)});
    select.value=srcId;select.classList.toggle('sel',zone==='source');
  }
  function paintTabs(){
    tabsEl.textContent='';
    [['all','الكل'],['movies','🎬 أفلام'],['series','🎞 مسلسلات']].forEach(([k,l],i)=>{
      const b=document.createElement('span');
      b.className='vt'+(filter===k?' on':'')+(zone==='tabs'&&i===tIdx?' sel':'');
      b.textContent=l;
      b.onclick=()=>{filter=k;zone='rows';idxRows();paintHome()};
      tabsEl.appendChild(b);
    });
    const search=$('vodsearch');
    search.textContent=query?'🔎 '+query:'🔎 بحث';
    search.classList.toggle('sel',zone==='search');
  }
  async function searchPrompt(){
    const value=await kbPrompt('بحث في العناوين والتصنيفات والمصادر',query);
    if(value===null)return;
    query=value.trim();idxRows();paintHome();
  }
  function msgBody(t){
    bodyEl.textContent='';
    const d=document.createElement('div');d.className='vempty';d.textContent=t;bodyEl.appendChild(d);
  }
  function idxRows(){rowsData=makeRows();rIdx=0;cols=[]}
  function paintHome(){
    screen='home';paintTabs();bodyEl.textContent='';
    $('vodh').classList.remove('hide');
    sourceOptions();
    if(!rowsData.length){
      msgBody(query?'لا توجد نتائج مطابقة في المصدر والنوع المحددين.':'لا توجد أفلام أو مسلسلات في مصادرك بعد.\nأضف مصدراً فيه مكتبة (ملف أو رابط أو Xtream) من الإعدادات ← إضافة مصدر، وستظهر هنا تلقائياً.');
      return;
    }
    rowsData.forEach((r,ri)=>{
      const row=document.createElement('div');row.className='vrow';
      const t=document.createElement('div');t.className='vrt';t.textContent=r.title;row.appendChild(t);
      const cs=document.createElement('div');cs.className='vcs';
      r.cards.forEach((c,ci)=>{
        const d=document.createElement('div');d.className='vc';d.dataset.i=((c.title||'?').trim()[0])||'?';
        if(c.logo){
          const img=document.createElement('img');img.loading='lazy';img.alt='';img.src=c.logo;
          img.onerror=()=>{img.remove();d.classList.add('noimg')};
          d.appendChild(img);
        }else d.classList.add('noimg');
        const nm=document.createElement('span');nm.className='vn';nm.textContent=c.title;d.appendChild(nm);
        if(c.kind==='series'){const b=document.createElement('i');b.textContent='مسلسل';d.appendChild(b)}
        if(c.sourceName){const source=document.createElement('small');source.className='vbadge';source.textContent=c.sourceName;d.appendChild(source)}
        const rec=c.resumeRecord||(c.kind==='movie'?progress()[c.item.url]:null);
        if(rec&&Model&&Model.shouldResume(rec)){
          const bar=document.createElement('span');bar.className='vprogress';bar.style.setProperty('--progress',Model.progressPercent(rec)+'%');d.appendChild(bar);
        }
        d.onclick=()=>{rIdx=ri;cols[ri]=ci;zone='rows';markCards();showDetails(c,'home')};
        cs.appendChild(d);
      });
      row.appendChild(cs);bodyEl.appendChild(row);
    });
    markCards();
  }
  function markCards(){
    bodyEl.querySelectorAll('.vc.sel').forEach(x=>x.classList.remove('sel'));
    paintTabs();
    if(zone!=='rows'||!rowsData.length)return;
    const row=bodyEl.children[rIdx];if(!row)return;
    const c=row.querySelectorAll('.vc')[cols[rIdx]||0];
    row.scrollIntoView({block:'nearest'});
    if(c){c.classList.add('sel');c.scrollIntoView({block:'nearest',inline:'nearest'});updateHero(rowsData[rIdx].cards[cols[rIdx]||0])}
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
  function showDetails(card,returnTo){
    cur=card;detailReturn=returnTo||'home';screen='details';zone='details';
    detailScrollTop=bodyEl.scrollTop;
    detailRowScroll=[...bodyEl.querySelectorAll('.vcs')].map(row=>row.scrollLeft);
    bodyEl.textContent='';$('vodh').classList.add('hide');
    const panel=document.createElement('section');panel.className='vdetails';
    const cover=document.createElement('img');cover.className='vdetail-cover';cover.alt='';if(card.logo)cover.src=card.logo;
    cover.onerror=()=>{cover.remove()};
    const info=document.createElement('div');info.className='vdetail-info';
    const title=document.createElement('h2');title.textContent=card.title;info.appendChild(title);
    const meta=document.createElement('p');meta.textContent=(card.kind==='series'?'مسلسل':'فيلم')+' · '+(card.group||'بدون تصنيف')+' · '+(card.sourceName||'مصدر');info.appendChild(meta);
    const alternatives=idx?[...idx.movies,...idx.series].filter(other=>other!==card&&Model.sameTitle(card,other)):[];
    const key=Model.normalizeTitle(card.title),remembered=LS.get('m3u_vod_provider',{})[key];
    alternatives.sort((a,b)=>(a.sourceId===remembered?-1:0)-(b.sourceId===remembered?-1:0));
    const rec=cardRecord(card),canResume=rec&&Model.shouldResume(rec);
    if(card.kind==='series'){
      info.appendChild(addAction('اختيار الموسم والحلقة',()=>{detailReturn='home';activate(card)}));
      if(canResume)info.appendChild(addAction('▶ متابعة من '+fmt(rec.position),()=>playCard(card,rec.position),'alt'));
    }else{
      info.appendChild(addAction(canResume?'▶ متابعة من '+fmt(rec.position):'▶ تشغيل',()=>playCard(card,canResume?rec.position:0)));
      if(canResume)info.appendChild(addAction('↺ البدء من البداية',()=>playCard(card,0),'alt'));
    }
    const cardWatched=!!watched()[cardId(card)];
    info.appendChild(addAction(cardWatched?'✓ تمت المشاهدة':'○ تحديد كمشاهد',()=>setWatched(card,!cardWatched),'alt'));
    info.appendChild(addAction('← العودة إلى القائمة',()=>returnFromDetails(),'alt'));
    if(alternatives.length){
      const heading=document.createElement('h3');heading.textContent='مصادر بديلة';info.appendChild(heading);
      alternatives.forEach(other=>info.appendChild(addAction(other.sourceName+' · '+other.title,()=>{
        const providers=LS.get('m3u_vod_provider',{});providers[key]=other.sourceId;LS.set('m3u_vod_provider',providers);
        cur=other;showDetails(other,detailReturn);
      },'alt')));
    }
    panel.append(cover,info);bodyEl.appendChild(panel);
    detailIndex=0;
    const first=panel.querySelector('button');if(first)first.focus({preventScroll:true});
  }
  function returnFromDetails(){
    if(detailReturn==='series'&&cur){screen='series';zone='eps';paintSeries();return}
    $('vodh').classList.remove('hide');
    const selected=rowsData[rIdx]&&rowsData[rIdx].cards[cols[rIdx]||0];
    idxRows();
    if(selected){
      const rowIndex=rowsData.findIndex(row=>row.cards.some(card=>cardId(card)===cardId(selected)));
      if(rowIndex>=0){rIdx=rowIndex;cols[rowIndex]=rowsData[rowIndex].cards.findIndex(card=>cardId(card)===cardId(selected))}
    }
    screen='home';zone='rows';paintHome();
    requestAnimationFrame(()=>{
      bodyEl.scrollTop=detailScrollTop;
      [...bodyEl.querySelectorAll('.vcs')].forEach((row,i)=>{row.scrollLeft=detailRowScroll[i]||0});
      markCards();
    });
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
  async function playCard(card,position){
    const record=cardRecord(card);
    const ep=card.kind==='series'&&record&&record.url?card.eps.findIndex(e=>e.url===record.url):0;
    if(card.kind==='series'&&card.lazy&&!card.eps.length){
      const ok=await loadLazy(card);
      if(!ok){toast('تعذّر تحميل حلقات هذا المسلسل');return}
      playCard(card,position);return;
    }
    if(card.kind==='series'){
      const episode=card.eps[Math.max(0,ep)]||card.eps[0];
      if(!episode){toast('لا توجد حلقات لهذا المسلسل');return}
      cur=card;curEps=card.eps.filter(e=>e.s===episode.s);eIdx=Math.max(0,curEps.findIndex(e=>e.url===episode.url));
      detailReturn='details';playItem(episode.item,curEps,eIdx,card,position);
    }else{
      if(position===0){
        const marks=watched();delete marks[cardId(card)];LS.set('m3u_vod_watched',marks);
        const records=progress();if(records[card.item.url])records[card.item.url].watched=false;LS.set('m3u_vod_progress',records);
      }
      playItem(card.item,null,0,card,position);
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
    screen='series';bodyEl.textContent='';
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
    const nSeasons=bodyEl.querySelectorAll('.vs').length;
    if(zone==='seriesInfo'){
      if(k==='ArrowDown'){zone=nSeasons?'seasons':'eps';paintSeries()}
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
  function homeKey(k){
    const r=rtl(),fwd=r?'ArrowLeft':'ArrowRight',bwd=r?'ArrowRight':'ArrowLeft';
    if(zone==='search'){
      if(k==='Enter'){searchPrompt();return}
      else if(k==='ArrowUp'){zone='tabs';tIdx=FILTERS.indexOf(filter)}
      else if(k==='ArrowDown'){zone='source'}
      paintTabs();sourceOptions();return;
    }
    if(zone==='source'){
      const source=$('vodsource'),step=k===fwd?1:k===bwd?-1:0;
      if(step){source.selectedIndex=Math.max(0,Math.min(source.options.length-1,source.selectedIndex+step))}
      else if(k==='Enter'){source.dispatchEvent(new Event('change'));zone='rows';return}
      else if(k==='ArrowDown'){zone='rows'}
      else if(k==='ArrowUp'){zone='search'}
      source.classList.toggle('sel',zone==='source');paintTabs();return;
    }
    if(zone==='tabs'){
      if(k===fwd)tIdx=Math.min(FILTERS.length-1,tIdx+1);
      else if(k===bwd)tIdx=Math.max(0,tIdx-1);
      else if(k==='ArrowUp'){zone='search';$('vodsource').classList.remove('sel')}
      else if(k==='ArrowDown'){zone='rows'}
      else if(k==='Enter'){filter=FILTERS[tIdx];zone='rows';idxRows();paintHome();return}
      markCards();return;
    }
    if(!rowsData.length){if(k==='ArrowUp'){zone='tabs';tIdx=FILTERS.indexOf(filter);markCards()}return}
    const n=rowsData[rIdx].cards.length;
    if(k==='ArrowUp'){if(rIdx>0)rIdx--;else{zone='tabs';tIdx=FILTERS.indexOf(filter)}}
    else if(k==='ArrowDown'){rIdx=Math.min(rowsData.length-1,rIdx+1)}
    else if(k===fwd){cols[rIdx]=Math.min(n-1,(cols[rIdx]||0)+1)}
    else if(k===bwd){cols[rIdx]=Math.max(0,(cols[rIdx]||0)-1)}
    else if(k==='Enter'){activate(rowsData[rIdx].cards[cols[rIdx]||0]);return}
    markCards();
  }

  /* ---------- التشغيل ---------- */
  const fmt=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
  function playItem(it,eps,i,card,position){
    if(playing){
      saveProgress();
      clearInterval(progressTimer);progressTimer=null;
      stopAll();
    }
    playing={eps:eps||null,i:i||0,card:card||cur,item:it};
    screen='player';
    clearNext();
    B.classList.add('cine-play');
    const v=$('v');
    const seekTo=()=>{if(position>0&&Number.isFinite(v.duration)&&v.duration>position){v.currentTime=position}v.removeEventListener('loadedmetadata',seekTo)};
    if(position>0)v.addEventListener('loadedmetadata',seekTo);
    play(it);
    updatePlaybackActions();
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
  function stopPlay(){saveProgress();clearInterval(progressTimer);progressTimer=null;clearNext();tok++;stopAll();B.classList.remove('cine-play');playing=null;screen='details'}
  function updatePlaybackActions(){
    const c=playing&&playing.card;
    $('vodwatched').style.display=c?'':'none';
    $('vodbackdetails').style.display=c?'':'none';
    if(c)$('vodwatched').textContent=c.kind==='series'?'✓ تمت مشاهدة الحلقة':'✓ تمت المشاهدة';
  }
  function setCurrentWatched(){
    if(!playing)return;
    if(playing.card.kind==='series'){
      const v=$('v');if(Number.isFinite(v.duration)&&v.duration>0)v.currentTime=v.duration;
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
  $('vodbackdetails').onclick=()=>{
    if(!playing)return;
    const card=playing.card,backTo=detailReturn;
    stopPlay();detailReturn=backTo;showDetails(card,backTo);
  };
  $('vodwatched').onclick=setCurrentWatched;
  $('v').addEventListener('pause',saveProgress);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveProgress()});
  function seek(sec){
    const v=$('v');
    if(!isFinite(v.duration)||!v.duration){toast('لا يمكن التقديم في هذا المحتوى');return}
    v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+sec));
    toast(fmt(v.currentTime)+' / '+fmt(v.duration));
  }
  function playKey(k){
    const v=$('v');
    if(k==='Escape'&&nextCard)clearNext();
    else if(k==='Enter'){if(v.paused)v.play();else v.pause();toast(v.paused?'⏸ متوقف':'▶ تشغيل')}
    else if(k==='ArrowRight'||k==='ArrowLeft')seek(k==='ArrowRight'?10:-10);
    else if(k==='ArrowUp'||k==='ArrowDown')seek(k==='ArrowUp'?60:-60);
    else if((k==='PageDown'||k==='PageUp')&&playing&&playing.eps){
      const n=playing.i+(k==='PageDown'?1:-1);
      if(n>=0&&n<playing.eps.length){const episode=playing.eps[n];eIdx=n;playItem(episode.item,playing.eps,n,playing.card,0)}
    }
  }
  $('v').addEventListener('ended',()=>{
    if(!on||!B.classList.contains('cine-play')||!playing)return;
    saveProgress();
    if(playing.eps)offerNext();
  });
  $('vodsource').addEventListener('change',()=>{
    srcId=$('vodsource').value;idxRows();screen='home';zone='rows';paintHome();
  });
  $('vodsearch').onclick=searchPrompt;

  /* ---------- فتح وإغلاق ---------- */
  function open(){
    if(on)return;
    on=true;
    LS.set('m3u_last_was_vod',true);
    if(!LS.get('m3u_tip_vod',false)){LS.set('m3u_tip_vod',true);toast('اضغط OK لفتح التفاصيل، واختر المصدر لتصفية المكتبة دون تغيير مصدر البث الحي.')}
    lastLive=shown.find(i=>i.url===curUrl)||null;
    tok++;stopAll();
    el.classList.add('on');B.classList.add('vod');
    zone='rows';screen='home';tabsEl.textContent='';
    msgBody('جارٍ تحليل المكتبة…');
    build().then(()=>{idxRows();paintHome()}).catch(()=>msgBody('تعذّر تحليل المكتبة'));
  }
  function close(){
    if(playing)stopPlay();
    on=false;el.classList.remove('on');B.classList.remove('vod');B.classList.remove('cine-play');
    if(lastLive){const it=lastLive;lastLive=null;play(it)}
  }
  window.__openVod=function(id){srcId=(typeof id==='string')?id:'';open()};
  window.__vodBack=function(){
    if(!on)return false;
    if(B.classList.contains('cine-play')){
      const card=playing&&playing.card,backTo=detailReturn;
      stopPlay();
      if(card)showDetails(card,backTo);
      return true;
    }
    if(screen==='details'){returnFromDetails();return true}
    if(screen==='series'){zone='rows';paintHome();return true}
    close();return true;
  };
  document.addEventListener('keydown',e=>{
    if(!on||document.querySelector('dialog[open]'))return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    e.preventDefault();e.stopPropagation();
    const k=e.key;
    if(B.classList.contains('cine-play'))playKey(k);
    else if(screen==='series')seriesKey(k);
    else if(screen==='home')homeKey(k);
    else if(screen==='details')detailKey(k);
  },true);
})();
