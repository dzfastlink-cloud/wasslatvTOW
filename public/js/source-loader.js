/* ===== آلية تحميل المصادر وإحصائيات المحتوى =====
   يعرض خطوات التحميل الفعلية (اتصال · تنزيل · تحليل · تصنيف · حفظ)
   مع إحصائيات حية ومفصّلة للمحتوى (قنوات مباشرة · أفلام · مسلسلات · تصنيفات · أكبر المجموعات). */
(function(root){
  const EP1=/^(.*?)[\s._-]*[sS](\d{1,2})[\s._-]*[eE](\d{1,3})/;
  const EP2=/^(.*?)\s*(?:الموسم|موسم|season)\s*(\d+)\s*(?:الحلقة|حلقة|episode|ep)\s*(\d+)/i;
  const EP3=/^(.*?)\s*(?:الحلقة|حلقة|episode|ep)\s*[:.-]?\s*(\d+)/i;

  function fallbackDetectKind(item){
    const g=(item.group||'').toLowerCase();
    const u=(item.url||'').toLowerCase();
    const n=(item.name||'').toLowerCase();
    if(/action=get_series_info/.test(u)||/\/series\/[^/]+\/[^/]+\/[^/]+/.test(u))return 'series';
    if(/\/movie\/[^/]+\/[^/]+\/[^/]+/.test(u))return 'movie';
    if(/radio|راديو/.test(g)||/\.(mp3|aac|ogg|m4a)(\?|$)/.test(u))return 'radio';
    if(/\/live\//.test(u))return 'live';
    if(/\.(mp4|mkv|avi|mov|wmv|webm|m4v)(\?|$)/.test(u)){
      return (/مسلسل|مسلسلات|series|season|episode|حلقة/.test(g)||/مسلسل|حلقة\s*\d|s\d{1,2}e\d{1,2}/.test(n))?'series':'movie';
    }
    return 'live';
  }
  function kindOf(item){
    return typeof root.detectKind==='function'?root.detectKind(item):fallbackDetectKind(item);
  }
  function seriesTitleOf(item){
    const url=String((item&&item.url)||'');
    if(/action=get_series_info/.test(url))return 'xt:'+url;
    const name=String((item&&item.name)||'');
    const m=EP1.exec(name)||EP2.exec(name)||EP3.exec(name);
    const title=((m&&m[1])||name).replace(/[._]+/g,' ').trim().toLowerCase();
    return title||url;
  }
  function formatBytes(bytes){
    const n=Number(bytes)||0;
    if(n<=0)return '';
    if(n<1024)return n+' بايت';
    if(n<1024*1024)return (n/1024).toFixed(n<10240?1:0)+' ك.ب';
    return (n/(1024*1024)).toFixed(2)+' م.ب';
  }
  function formatNum(n){
    try{return Number(n||0).toLocaleString('en-US')}catch(e){return String(n||0)}
  }
  function formatDuration(ms){
    const sec=Math.max(0.1,(Number(ms)||0)/1000);
    return sec<60?sec.toFixed(1)+' ث':Math.floor(sec/60)+' د '+Math.round(sec%60)+' ث';
  }

  /* تحليل شامل لمحتوى القائمة (قنوات · أفلام · مسلسلات · راديو · تصنيفات · شعارات · تقييمات) */
  function analyzeItems(items,extra){
    const arr=Array.isArray(items)?items:[];
    let live=0,movies=0,seriesEntries=0,radio=0,withLogos=0,withRatings=0;
    const seriesSet=new Set();
    const groupsMap=new Map();
    for(let i=0;i<arr.length;i++){
      const it=arr[i];
      if(!it)continue;
      const k=kindOf(it);
      if(k==='movie')movies++;
      else if(k==='series'){seriesEntries++;seriesSet.add(seriesTitleOf(it))}
      else if(k==='radio')radio++;
      else live++;
      if(it.logo&&String(it.logo).trim())withLogos++;
      if(it.raw&&/(?:imdb[-_]?rating|tvg-rating|rating)="\s*[1-9]/i.test(it.raw))withRatings++;
      const g=String(it.group||'بدون مجموعة').trim()||'بدون مجموعة';
      groupsMap.set(g,(groupsMap.get(g)||0)+1);
    }
    const topGroups=[...groupsMap.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,5)
      .map(([name,count])=>({name,count}));
    return {
      total:arr.length,
      live,
      movies,
      series:seriesSet.size,
      seriesEntries,
      radio,
      groups:groupsMap.size,
      topGroups,
      withLogos,
      withRatings,
      bytes:(extra&&extra.bytes)||0
    };
  }

  /* ملخص نصي قصير لعرضه في قائمة المصادر */
  function formatStatsLine(stats,fallbackTotal){
    if(!stats)return formatNum(fallbackTotal||0)+' عنصر';
    const parts=[];
    if(stats.live)parts.push(formatNum(stats.live)+' قناة');
    if(stats.movies)parts.push(formatNum(stats.movies)+' فيلم');
    if(stats.series)parts.push(formatNum(stats.series)+' مسلسل');
    if(stats.radio)parts.push(formatNum(stats.radio)+' راديو');
    if(!parts.length)parts.push(formatNum(stats.total||fallbackTotal||0)+' عنصر');
    if(stats.groups)parts.push(formatNum(stats.groups)+' تصنيف');
    return parts.join(' · ');
  }

  function compactStats(stats){
    if(!stats)return null;
    return {
      total:stats.total||0,
      live:stats.live||0,
      movies:stats.movies||0,
      series:stats.series||0,
      seriesEntries:stats.seriesEntries||0,
      radio:stats.radio||0,
      groups:stats.groups||0,
      withLogos:stats.withLogos||0,
      withRatings:stats.withRatings||0,
      bytes:stats.bytes||0,
      topGroups:Array.isArray(stats.topGroups)?stats.topGroups.slice(0,5):[]
    };
  }

  function titleDelimiter(line){
    let quoted=false,escaped=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(escaped){escaped=false;continue}
      if(ch==='\\'&&quoted){escaped=true;continue}
      if(ch==='"'){quoted=!quoted;continue}
      if(ch===','&&!quoted)return i;
    }
    return -1;
  }

  /* محلل M3U متدرّج على دفعات مع تحديث فوري للعدادات دون تجميد الواجهة */
  async function parseM3UProgress(text,opts){
    const rawText=String(text||'');
    const onProgress=opts&&opts.onProgress;
    const signal=opts&&opts.signal;
    const lines=rawText.replace(/^\uFEFF/,'').split(/\r?\n/);
    const totalLines=lines.length||1;
    const CHUNK=3000;
    const out=[];
    let meta=null;
    let live=0,movies=0,seriesEntries=0,radio=0;
    const seriesSet=new Set();
    const groupsSet=new Set();

    for(let idx=0;idx<lines.length;idx++){
      if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
      const l=lines[idx].trim();
      if(l){
        if(l.startsWith('#EXTINF')){
          const attrs={};
          l.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{attrs[k.toLowerCase()]=v});
          const i=titleDelimiter(l);
          meta={name:(i>-1?l.slice(i+1):'').trim()||attrs['tvg-name']||'',logo:attrs['tvg-logo']||'',group:attrs['group-title']||'',raw:l,extra:[]};
        }else if(l.startsWith('#EXTGRP:')&&meta){
          meta.group=meta.group||l.slice(8).trim();
          meta.extra.push(l);
        }else if(l.startsWith('#')){
          if(meta)meta.extra.push(l);
        }else{
          const m=meta||{name:'',logo:'',group:'',raw:'',extra:[]};
          if(!m.name)m.name=l.split('/').pop().split('?')[0]||l;
          m.url=l;
          out.push(m);
          const k=kindOf(m);
          if(k==='movie')movies++;
          else if(k==='series'){seriesEntries++;seriesSet.add(seriesTitleOf(m))}
          else if(k==='radio')radio++;
          else live++;
          groupsSet.add(String(m.group||'بدون مجموعة').trim()||'بدون مجموعة');
          meta=null;
        }
      }
      if(idx>0&&idx%CHUNK===0){
        if(onProgress){
          onProgress({
            parsedLines:idx,
            totalLines,
            pct:Math.min(99,Math.round((idx/totalLines)*100)),
            itemsCount:out.length,
            live,movies,series:seriesSet.size,seriesEntries,radio,groups:groupsSet.size
          });
        }
        await new Promise(r=>setTimeout(r,0));
      }
    }
    if(onProgress){
      onProgress({
        parsedLines:totalLines,
        totalLines,
        pct:100,
        itemsCount:out.length,
        live,movies,series:seriesSet.size,seriesEntries,radio,groups:groupsSet.size
      });
    }
    return out;
  }

  /* تنزيل نص عبر fetch مع قراءة متدفقة لحساب الحجم المنزّل فعلياً */
  async function fetchTextProgress(url,opts){
    const signal=opts&&opts.signal;
    const onProgress=opts&&opts.onProgress;
    const res=await fetch(url,{cache:'no-store',signal});
    if(!res.ok){
      const err=new Error('رفض الخادم الطلب (رمز الحالة '+res.status+')');
      err.status=res.status;
      throw err;
    }
    const contentLength=Number(res.headers.get('content-length')||0);
    if(!res.body||typeof res.body.getReader!=='function'){
      const text=await res.text();
      const bytes=new Blob([text]).size;
      if(onProgress)onProgress({loadedBytes:bytes,totalBytes:bytes,pct:100});
      return {text,bytes};
    }
    const reader=res.body.getReader();
    const decoder=new TextDecoder('utf-8');
    let loadedBytes=0,chunks=[],lastEmit=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(value){
        loadedBytes+=value.byteLength;
        chunks.push(decoder.decode(value,{stream:true}));
        const now=Date.now();
        if(onProgress&&(now-lastEmit>=90)){
          lastEmit=now;
          const pct=contentLength>0?Math.min(99,Math.round((loadedBytes/contentLength)*100)):null;
          onProgress({loadedBytes,totalBytes:contentLength,pct});
        }
      }
    }
    chunks.push(decoder.decode());
    const text=chunks.join('');
    if(onProgress)onProgress({loadedBytes,totalBytes:contentLength||loadedBytes,pct:100});
    return {text,bytes:loadedBytes||new Blob([text]).size};
  }

  /* قوالب مراحل التحميل حسب نوع المصدر */
  const MODE_LABEL={
    url:'رابط M3U',
    file:'ملف محلي',
    xtream:'حساب Xtream',
    update:'تحديث مصدر',
    merge:'دمج ملف',
    inspect:'ملخص المصدر'
  };
  function defaultSteps(mode){
    if(mode==='xtream'){
      return [
        {id:'connect',label:'الاتصال بالسيرفر وجلب الفئات',detail:'التحقق من بيانات الحساب وفئات القنوات والمكتبة'},
        {id:'live',label:'تحميل القنوات المباشرة',detail:'بانتظار استجابة قائمة البث المباشر'},
        {id:'vod',label:'تحميل الأفلام والمسلسلات',detail:'بانتظار مكتبة الأفلام والمسلسلات وتصنيفاتها'},
        {id:'save',label:'بناء القائمة وتفعيل المصدر',detail:'تصنيف المحتوى وحفظه محلياً'}
      ];
    }
    if(mode==='file'){
      return [
        {id:'read',label:'قراءة الملف من الجهاز',detail:'فحص حجم الملف وتحديد الصيغة'},
        {id:'parse',label:'تحليل القائمة والروابط',detail:'استخراج القنوات والبيانات التعريفية'},
        {id:'analyze',label:'تصنيف المحتوى واستخراج الإحصائيات',detail:'فرز القنوات والأفلام والمسلسلات والتصنيفات'},
        {id:'save',label:'الحفظ والتفعيل',detail:'حفظ المصدر في القوائم وتحديث الواجهة'}
      ];
    }
    if(mode==='merge'){
      return [
        {id:'read',label:'قراءة ملف الدمج',detail:'فحص حجم الملف ومحتواه'},
        {id:'parse',label:'تحليل العناصر الجديدة',detail:'قراءة الروابط ومقارنتها بالقائمة الحالية'},
        {id:'save',label:'دمج العناصر وحفظ المصدر',detail:'إضافة الجديد دون تكرار وتحديث الإحصائيات'}
      ];
    }
    if(mode==='update'){
      return [
        {id:'fetch',label:'جلب النسخة الأحدث من المصدر',detail:'الاتصال بالخادم وتنزيل البيانات المحدّثة'},
        {id:'parse',label:'تحليل ومقارنة التغييرات',detail:'رصد العناصر الجديدة والمحدّثة مع حفظ تعديلاتك'},
        {id:'save',label:'تطبيق التحديث وتحديث الإحصائيات',detail:'حفظ القائمة المحدّثة وتفعيلها'}
      ];
    }
    return [
      {id:'fetch',label:'الاتصال بالرابط وتنزيل القائمة',detail:'جلب ملف M3U من الخادم'},
      {id:'parse',label:'تحليل الروابط وقراءة البيانات',detail:'استخراج أسماء القنوات والمجموعات والشعارات'},
      {id:'analyze',label:'تصنيف المحتوى واستخراج الإحصائيات',detail:'فرز القنوات والأفلام والمسلسلات والراديو'},
      {id:'save',label:'الحفظ والتفعيل',detail:'تخزين المصدر محلياً وتفعيله فوراً'}
    ];
  }

  /* إدارة نافذة #srcloader */
  let activeSession=null;

  function ensureDialog(){
    let dlg=document.getElementById('srcloader');
    if(!dlg){
      dlg=document.createElement('dialog');
      dlg.id='srcloader';
      dlg.className='srcloader';
      document.body.appendChild(dlg);
    }
    return dlg;
  }

  function stepStatusText(st){
    if(st==='done')return 'تم';
    if(st==='active')return 'جارٍ التنفيذ…';
    if(st==='error')return 'فشل';
    return 'قيد الانتظار';
  }

  function createUI(dlg,config){
    dlg.textContent='';
    const shell=document.createElement('div');
    shell.className='sl-shell';
    shell.dataset.state=config.inspectOnly?'done':'loading';

    /* الرأس */
    const head=document.createElement('div');head.className='sl-head';
    const headMain=document.createElement('div');headMain.className='sl-head-main';
    const titleEl=document.createElement('h2');titleEl.id='sl-title';titleEl.className='sl-title';
    titleEl.textContent=config.inspectOnly?('إحصائيات المصدر: '+(config.title||'')):(config.heading||'جارٍ تحميل المصدر');
    const subEl=document.createElement('p');subEl.id='sl-sub';subEl.className='sl-sub';
    const modeTag=MODE_LABEL[config.mode]||'مصدر';
    subEl.textContent=config.title?(modeTag+' · '+config.title):modeTag;
    headMain.append(titleEl,subEl);

    const stateMeta=document.createElement('div');stateMeta.className='sl-state-meta';
    const stateLabel=document.createElement('span');stateLabel.className='sl-state-label';
    stateLabel.textContent=config.inspectOnly?'جاهز للاستخدام':'جارٍ التحميل';
    const elapsedEl=document.createElement('span');elapsedEl.className='sl-elapsed';
    elapsedEl.textContent=config.inspectOnly?(config.updatedText||''):'0.0 ث';
    stateMeta.append(stateLabel,elapsedEl);
    head.append(headMain,stateMeta);

    /* المحتوى */
    const body=document.createElement('div');body.className='sl-body';

    /* كتلة التقدم */
    const progBlock=document.createElement('div');progBlock.className='sl-progress-block';
    const progHead=document.createElement('div');progHead.className='sl-progress-head';
    const progText=document.createElement('span');progText.className='sl-progress-text';
    progText.textContent='تهيئة عملية التحميل…';
    const progPct=document.createElement('span');progPct.className='sl-progress-pct';
    progPct.textContent='0%';
    progHead.append(progText,progPct);
    const track=document.createElement('div');track.className='sl-track indeterminate';
    const fill=document.createElement('span');fill.className='sl-fill';
    track.appendChild(fill);
    const transferNote=document.createElement('div');transferNote.className='sl-transfer-note';
    progBlock.append(progHead,track,transferNote);
    if(!config.inspectOnly)body.appendChild(progBlock);

    /* مراحل آلية التحميل */
    const stepsWrap=document.createElement('div');stepsWrap.className='sl-steps-wrap';
    const stepsHeading=document.createElement('h3');stepsHeading.className='sl-section-title';
    stepsHeading.textContent='آلية التحميل';
    const stepsList=document.createElement('ol');stepsList.className='sl-steps';
    const stepNodes=new Map();
    const steps=config.steps||defaultSteps(config.mode);
    steps.forEach((s,idx)=>{
      const li=document.createElement('li');li.className='sl-step';li.dataset.status='pending';
      const ico=document.createElement('span');ico.className='sl-step-ico';ico.textContent=String(idx+1);
      const copy=document.createElement('div');copy.className='sl-step-copy';
      const row=document.createElement('div');row.className='sl-step-row';
      const name=document.createElement('span');name.className='sl-step-name';name.textContent=s.label;
      const st=document.createElement('span');st.className='sl-step-status';st.textContent=stepStatusText('pending');
      row.append(name,st);
      const det=document.createElement('span');det.className='sl-step-detail';det.textContent=s.detail||'';
      copy.append(row,det);
      li.append(ico,copy);
      stepsList.appendChild(li);
      stepNodes.set(s.id,{li,ico,st,det,index:idx+1,label:s.label});
    });
    stepsWrap.append(stepsHeading,stepsList);
    if(!config.inspectOnly)body.appendChild(stepsWrap);

    /* صندوق الخطأ */
    const errorBox=document.createElement('div');errorBox.className='sl-error-box';errorBox.hidden=true;
    body.appendChild(errorBox);

    /* قسم إحصائيات المحتوى */
    const statsSec=document.createElement('div');statsSec.className='sl-stats-section';
    const statsHeading=document.createElement('h3');statsHeading.className='sl-section-title';
    const statsHeadingLabel=document.createElement('span');statsHeadingLabel.textContent='إحصائيات المحتوى';
    const statsTotalEl=document.createElement('span');statsTotalEl.textContent='بانتظار البيانات…';
    statsHeading.append(statsHeadingLabel,statsTotalEl);

    const kpiGrid=document.createElement('div');kpiGrid.className='sl-kpi-grid';
    const makeKpi=(kind,label)=>{
      const cell=document.createElement('div');cell.className='sl-kpi';cell.dataset.kind=kind;
      const lb=document.createElement('span');lb.className='sl-kpi-label';lb.textContent=label;
      const val=document.createElement('strong');val.className='sl-kpi-val';val.textContent='0';
      const sub=document.createElement('span');sub.className='sl-kpi-sub';sub.textContent='—';
      cell.append(lb,val,sub);
      kpiGrid.appendChild(cell);
      return {val,sub};
    };
    const kpis={
      live:makeKpi('live','قنوات مباشرة'),
      movies:makeKpi('movies','أفلام (VOD)'),
      series:makeKpi('series','مسلسلات'),
      groups:makeKpi('groups','التصنيفات')
    };

    const distWrap=document.createElement('div');distWrap.className='sl-dist-wrap';distWrap.hidden=true;
    const distBar=document.createElement('div');distBar.className='sl-dist-bar';
    const segLive=document.createElement('span');segLive.className='sl-dist-seg live';
    const segMovies=document.createElement('span');segMovies.className='sl-dist-seg movies';
    const segSeries=document.createElement('span');segSeries.className='sl-dist-seg series';
    const segRadio=document.createElement('span');segRadio.className='sl-dist-seg radio';
    distBar.append(segLive,segMovies,segSeries,segRadio);
    const distLegend=document.createElement('div');distLegend.className='sl-dist-legend';
    distWrap.append(distBar,distLegend);

    const deltaLine=document.createElement('div');deltaLine.className='sl-delta-line';deltaLine.hidden=true;
    const metaLine=document.createElement('div');metaLine.className='sl-meta-line';metaLine.hidden=true;

    const groupsWrap=document.createElement('div');groupsWrap.className='sl-groups-wrap';groupsWrap.hidden=true;
    const groupsTitle=document.createElement('div');groupsTitle.className='sl-section-title';groupsTitle.textContent='أكبر التصنيفات في المصدر';
    const groupsList=document.createElement('div');groupsList.className='sl-groups-list';
    groupsWrap.append(groupsTitle,groupsList);

    statsSec.append(statsHeading,kpiGrid,distWrap,deltaLine,metaLine,groupsWrap);
    body.appendChild(statsSec);

    /* التذييل */
    const foot=document.createElement('div');foot.className='sl-foot';
    const footNote=document.createElement('div');footNote.className='sl-foot-note';
    footNote.textContent=config.inspectOnly?'يمكنك العودة لقائمة المصادر أو فتح المكتبة مباشرة.':'جارٍ التحقق من المحتوى وتنظيمه…';
    const footActions=document.createElement('div');footActions.className='sl-foot-actions';
    foot.append(footNote,footActions);

    shell.append(head,body,foot);
    dlg.appendChild(shell);

    return {
      shell,titleEl,subEl,stateLabel,elapsedEl,
      progText,progPct,track,fill,transferNote,
      stepNodes,errorBox,
      statsTotalEl,kpis,distWrap,segLive,segMovies,segSeries,segRadio,distLegend,
      deltaLine,metaLine,groupsWrap,groupsList,
      footNote,footActions
    };
  }

  function renderStats(ui,stats,opts){
    if(!stats)return;
    const live=Number(stats.live)||0;
    const movies=Number(stats.movies)||0;
    const series=Number(stats.series)||0;
    const seriesEntries=Number(stats.seriesEntries)||series;
    const radio=Number(stats.radio)||0;
    const groups=Number(stats.groups)||0;
    const total=Number(stats.total)||(live+movies+seriesEntries+radio);
    const shareOf=n=>total>0?Math.round((n/total)*100)+'%':'0%';

    ui.statsTotalEl.textContent=total>0?('الإجمالي: '+formatNum(total)+' عنصر'):'بانتظار البيانات…';
    ui.kpis.live.val.textContent=formatNum(live);
    ui.kpis.live.sub.textContent=total>0?(shareOf(live)+' من المحتوى'):'—';

    ui.kpis.movies.val.textContent=formatNum(movies);
    ui.kpis.movies.sub.textContent=total>0?(shareOf(movies)+' من المحتوى'):'—';

    ui.kpis.series.val.textContent=formatNum(series);
    ui.kpis.series.sub.textContent=seriesEntries>series?(formatNum(seriesEntries)+' حلقة'):(total>0?shareOf(seriesEntries)+' من المحتوى':'—');

    ui.kpis.groups.val.textContent=formatNum(groups);
    ui.kpis.groups.sub.textContent=radio>0?('إضافةً إلى '+formatNum(radio)+' إذاعة راديو'):(groups>0?'مجموعة وفئة':'—');

    if(total>0){
      ui.distWrap.hidden=false;
      ui.segLive.style.flexGrow=String(live);ui.segLive.hidden=live<=0;
      ui.segMovies.style.flexGrow=String(movies);ui.segMovies.hidden=movies<=0;
      ui.segSeries.style.flexGrow=String(seriesEntries);ui.segSeries.hidden=seriesEntries<=0;
      ui.segRadio.style.flexGrow=String(radio);ui.segRadio.hidden=radio<=0;

      ui.distLegend.textContent='';
      const items=[];
      if(live>0)items.push({cls:'live',txt:'قنوات '+shareOf(live)});
      if(movies>0)items.push({cls:'movies',txt:'أفلام '+shareOf(movies)});
      if(seriesEntries>0)items.push({cls:'series',txt:'مسلسلات '+shareOf(seriesEntries)});
      if(radio>0)items.push({cls:'radio',txt:'راديو '+shareOf(radio)});
      items.forEach((it,idx)=>{
        if(idx>0){
          const sep=document.createElement('span');sep.className='sl-leg-sep';sep.textContent='·';
          ui.distLegend.appendChild(sep);
        }
        const wrap=document.createElement('span');wrap.className='sl-leg-item';
        const sw=document.createElement('span');sw.className='sl-swatch '+it.cls;sw.setAttribute('aria-hidden','true');
        const tx=document.createElement('span');tx.textContent=it.txt;
        wrap.append(sw,tx);
        ui.distLegend.appendChild(wrap);
      });
    }else{
      ui.distWrap.hidden=true;
    }

    /* تفاصيل إضافية (شعارات · تقييمات · حجم · مدة) */
    const metaParts=[];
    if(stats.withLogos>0&&total>0){
      const logoPct=Math.round((stats.withLogos/total)*100);
      metaParts.push(['شعارات وبوسترات',formatNum(stats.withLogos)+' ('+logoPct+'%)']);
    }
    if(stats.withRatings>0){
      metaParts.push(['تقييمات IMDb',formatNum(stats.withRatings)]);
    }
    if(stats.bytes>0){
      metaParts.push(['حجم البيانات',formatBytes(stats.bytes)]);
    }
    if(opts&&opts.durationMs>0){
      metaParts.push(['مدة التحميل',formatDuration(opts.durationMs)]);
    }
    if(metaParts.length){
      ui.metaLine.hidden=false;
      ui.metaLine.textContent='';
      metaParts.forEach(([k,v],idx)=>{
        if(idx>0){
          const sep=document.createElement('span');sep.className='sl-leg-sep';sep.textContent='·';
          ui.metaLine.appendChild(sep);
        }
        const sp=document.createElement('span');
        sp.append(document.createTextNode(k+': '));
        const st=document.createElement('strong');st.textContent=v;
        sp.appendChild(st);
        ui.metaLine.appendChild(sp);
      });
    }else{
      ui.metaLine.hidden=true;
    }

    /* تغييرات الدمج أو التحديث */
    if(opts&&opts.delta){
      const d=opts.delta;
      const dParts=[];
      if(typeof d.added==='number')dParts.push('عناصر جديدة مضافة: +'+formatNum(d.added));
      if(typeof d.kept==='number')dParts.push('عناصر محفوظة: '+formatNum(d.kept));
      if(typeof d.removed==='number'&&d.removed>0)dParts.push('محذوفة: '+formatNum(d.removed));
      if(dParts.length){
        ui.deltaLine.hidden=false;
        ui.deltaLine.textContent=dParts.join(' · ');
      }else ui.deltaLine.hidden=true;
    }else{
      ui.deltaLine.hidden=true;
    }

    /* أكبر التصنيفات */
    const topGroups=Array.isArray(stats.topGroups)?stats.topGroups:[];
    if(topGroups.length){
      ui.groupsWrap.hidden=false;
      ui.groupsList.textContent='';
      const maxCnt=Math.max(1,topGroups[0].count||1);
      topGroups.forEach(g=>{
        const row=document.createElement('div');row.className='sl-grp-row';
        const nm=document.createElement('span');nm.className='sl-grp-name';nm.textContent=g.name;nm.title=g.name;
        const tr=document.createElement('div');tr.className='sl-grp-track';
        const fl=document.createElement('span');fl.className='sl-grp-fill';
        fl.style.width=Math.max(4,Math.round((g.count/maxCnt)*100))+'%';
        tr.appendChild(fl);
        const cnt=document.createElement('span');cnt.className='sl-grp-cnt';cnt.textContent=formatNum(g.count);
        row.append(nm,tr,cnt);
        ui.groupsList.appendChild(row);
      });
    }else{
      ui.groupsWrap.hidden=true;
    }
  }

  function makeBtn(label,cls,run){
    const b=document.createElement('button');
    b.type='button';
    b.className='sl-btn'+(cls?' '+cls:'');
    b.textContent=label;
    b.onclick=run;
    return b;
  }

  function begin(config){
    const cfg=Object.assign({mode:'url',title:'',heading:'',steps:null,inspectOnly:false},config||{});
    if(activeSession&&!activeSession.closed)activeSession.close();
    const dlg=ensureDialog();
    const ui=createUI(dlg,cfg);
    const startedAt=Date.now();
    const controller=typeof AbortController==='function'?new AbortController():null;
    let closed=false,finished=!!cfg.inspectOnly,timer=null;
    let currentStats={total:0,live:0,movies:0,series:0,seriesEntries:0,radio:0,groups:0,withLogos:0,withRatings:0,bytes:0,topGroups:[]};

    const stopTimer=()=>{if(timer){clearInterval(timer);timer=null}};
    const close=()=>{
      if(closed)return;
      closed=true;
      stopTimer();
      if(!finished&&controller)try{controller.abort()}catch(e){}
      if(dlg.open)dlg.close();
      if(activeSession===session)activeSession=null;
    };

    const onDialogCancel=e=>{
      e.preventDefault();
      if(!finished){
        if(cfg.onCancel)try{cfg.onCancel()}catch(err){}
      }
      close();
    };
    dlg.oncancel=onDialogCancel;
    dlg.onclose=()=>{
      if(!closed){
        if(!finished&&cfg.onCancel)try{cfg.onCancel()}catch(err){}
        close();
      }
    };

    if(!cfg.inspectOnly){
      timer=setInterval(()=>{
        if(closed||finished){stopTimer();return}
        ui.elapsedEl.textContent=formatDuration(Date.now()-startedAt);
      },180);
      ui.footActions.appendChild(makeBtn('إلغاء التحميل','danger',()=>{
        if(cfg.onCancel)try{cfg.onCancel()}catch(err){}
        close();
      }));
    }

    if(!dlg.open)dlg.showModal();

    const session={
      get signal(){return controller?controller.signal:undefined},
      get closed(){return closed},
      get aborted(){return !!(controller&&controller.signal.aborted)||closed},
      setTitle(name,extraSub){
        if(closed)return;
        const modeTag=MODE_LABEL[cfg.mode]||'مصدر';
        const parts=[modeTag];
        if(name)parts.push(name);
        if(extraSub)parts.push(extraSub);
        ui.subEl.textContent=parts.join(' · ');
      },
      setHeading(text){
        if(!closed&&text)ui.titleEl.textContent=text;
      },
      setSteps(newSteps){
        if(closed||!Array.isArray(newSteps))return;
        const list=dlg.querySelector('.sl-steps');
        if(!list)return;
        list.textContent='';
        ui.stepNodes.clear();
        newSteps.forEach((s,idx)=>{
          const li=document.createElement('li');li.className='sl-step';li.dataset.status='pending';
          const ico=document.createElement('span');ico.className='sl-step-ico';ico.textContent=String(idx+1);
          const copy=document.createElement('div');copy.className='sl-step-copy';
          const row=document.createElement('div');row.className='sl-step-row';
          const name=document.createElement('span');name.className='sl-step-name';name.textContent=s.label;
          const st=document.createElement('span');st.className='sl-step-status';st.textContent=stepStatusText('pending');
          row.append(name,st);
          const det=document.createElement('span');det.className='sl-step-detail';det.textContent=s.detail||'';
          copy.append(row,det);
          li.append(ico,copy);
          list.appendChild(li);
          ui.stepNodes.set(s.id,{li,ico,st,det,index:idx+1,label:s.label});
        });
      },
      setStep(id,status,detail){
        if(closed)return;
        const node=ui.stepNodes.get(id);
        if(!node)return;
        node.li.dataset.status=status;
        node.st.textContent=stepStatusText(status);
        if(status==='done')node.ico.textContent='✓';
        else if(status==='error')node.ico.textContent='✕';
        else if(status==='active')node.ico.textContent='';
        else node.ico.textContent=String(node.index);
        if(detail!==undefined)node.det.textContent=detail;
        if(status==='active')ui.progText.textContent=node.label;
      },
      setProgress(pct,transferText){
        if(closed)return;
        if(typeof pct==='number'&&Number.isFinite(pct)){
          const clamped=Math.max(0,Math.min(100,Math.round(pct)));
          ui.track.classList.remove('indeterminate');
          ui.fill.style.transform='scaleX('+(clamped/100)+')';
          ui.progPct.textContent=clamped+'%';
        }else{
          ui.track.classList.add('indeterminate');
          ui.progPct.textContent='…';
        }
        if(transferText!==undefined)ui.transferNote.textContent=transferText;
      },
      setStats(partial,opts){
        if(closed)return;
        currentStats=Object.assign({},currentStats,partial||{});
        renderStats(ui,currentStats,opts);
      },
      succeed(result){
        if(closed)return;
        finished=true;
        stopTimer();
        const elapsedMs=Date.now()-startedAt;
        const res=result||{};
        ui.shell.dataset.state='done';
        ui.titleEl.textContent=res.heading||'اكتمل تحميل المصدر بنجاح';
        if(res.title)session.setTitle(res.title,res.stats&&res.stats.bytes?formatBytes(res.stats.bytes):'');
        ui.stateLabel.textContent='مكتمل';
        ui.elapsedEl.textContent=formatDuration(elapsedMs);
        ui.track.classList.remove('indeterminate');
        ui.fill.style.transform='scaleX(1)';
        ui.progPct.textContent='100%';
        ui.progText.textContent=res.summaryText||'المصدر جاهز للمشاهدة والتصفح';
        ui.stepNodes.forEach((node)=>{
          if(node.li.dataset.status!=='done'){
            node.li.dataset.status='done';
            node.ico.textContent='✓';
            node.st.textContent='تم';
          }
        });
        if(res.stats)currentStats=Object.assign({},currentStats,res.stats);
        renderStats(ui,currentStats,{durationMs:elapsedMs,delta:res.delta});

        ui.footNote.textContent=res.note||'تم حفظ المصدر وتفعيله تلقائياً.';
        ui.footActions.textContent='';
        const hasVod=(currentStats.movies>0||currentStats.series>0)&&typeof root.__openVod==='function';
        if(hasVod){
          const vodBtn=makeBtn('🎬 فتح المكتبة (VOD)','',()=>{
            close();
            const dlgEl=document.getElementById('dlg');
            if(dlgEl&&dlgEl.open)dlgEl.close();
            const stEl=document.getElementById('st');
            if(stEl&&stEl.classList.contains('on')&&root.__stBack){
              stEl.classList.remove('on');
            }
            root.__openVod(res.sourceId||'');
          });
          ui.footActions.appendChild(vodBtn);
        }
        const doneBtn=makeBtn(res.primaryLabel||'▶ بدء المشاهدة','primary',()=>{
          close();
          if(typeof res.onPrimary==='function')res.onPrimary();
        });
        ui.footActions.appendChild(doneBtn);
        requestAnimationFrame(()=>{try{doneBtn.focus()}catch(e){}});
      },
      fail(message,failedStepId,retryFn){
        if(closed)return;
        finished=true;
        stopTimer();
        const elapsedMs=Date.now()-startedAt;
        ui.shell.dataset.state='error';
        ui.titleEl.textContent='تعذّر تحميل المصدر';
        ui.stateLabel.textContent='فشل التحميل';
        ui.elapsedEl.textContent=formatDuration(elapsedMs);
        ui.track.classList.remove('indeterminate');
        ui.progText.textContent='توقفت عملية التحميل';
        let marked=false;
        if(failedStepId&&ui.stepNodes.has(failedStepId)){
          session.setStep(failedStepId,'error',message);
          marked=true;
        }else{
          ui.stepNodes.forEach((node,id)=>{
            if(!marked&&node.li.dataset.status==='active'){
              session.setStep(id,'error',message);
              marked=true;
            }
          });
        }
        ui.errorBox.hidden=false;
        ui.errorBox.textContent=message||'حدث خطأ غير متوقع أثناء تحميل المصدر.';
        ui.footNote.textContent='تحقق من صحة الرابط أو بيانات السيرفر ثم أعد المحاولة.';
        ui.footActions.textContent='';
        if(typeof retryFn==='function'){
          ui.footActions.appendChild(makeBtn('↺ إعادة المحاولة','',()=>{
            close();
            retryFn();
          }));
        }
        const closeBtn=makeBtn('إغلاق','primary',close);
        ui.footActions.appendChild(closeBtn);
        requestAnimationFrame(()=>{try{closeBtn.focus()}catch(e){}});
      },
      close
    };

    activeSession=session;
    return session;
  }

  /* عرض إحصائيات مصدر محفوظ مسبقاً بنقرة واحدة */
  function showInspect(source){
    if(!source)return;
    const parsed=typeof root.parseM3U==='function'?root.parseM3U(source.text||''):[];
    const bytes=source.text?new Blob([source.text]).size:0;
    const stats=analyzeItems(parsed,{bytes});
    const mode=source.xt?'xtream':source.url?'url':'file';
    const updatedText=source.upd?('آخر تحديث: '+new Date(source.upd).toLocaleDateString('ar')):'';
    const session=begin({
      mode,
      title:source.name||'',
      inspectOnly:true,
      updatedText
    });
    session.setStats(stats,{});
    const dlg=document.getElementById('srcloader');
    const footActions=dlg.querySelector('.sl-foot-actions');
    footActions.textContent='';
    if((stats.movies>0||stats.series>0)&&typeof root.__openVod==='function'){
      footActions.appendChild(makeBtn('🎬 فتح المكتبة (VOD)','',()=>{
        session.close();
        const stEl=document.getElementById('st');
        if(stEl)stEl.classList.remove('on');
        root.__openVod(source.id);
      }));
    }
    const closeBtn=makeBtn('إغلاق','primary',()=>session.close());
    footActions.appendChild(closeBtn);
    requestAnimationFrame(()=>{try{closeBtn.focus()}catch(e){}});
    return session;
  }

  const api={
    begin,
    showInspect,
    analyzeItems,
    compactStats,
    formatStatsLine,
    formatBytes,
    formatNum,
    parseM3UProgress,
    fetchTextProgress,
    defaultSteps,
    isOpen:()=>!!(activeSession&&!activeSession.closed)
  };
  root.WasslaSourceLoader=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
