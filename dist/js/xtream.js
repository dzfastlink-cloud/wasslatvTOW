/* ===== Xtream Codes: بث مباشر + أفلام + مسلسلات بفئاتها الحقيقية =====
   • المجموعات تأخذ أسماء فئات السيرفر («أفلام | أكشن»، «مسلسلات | دراما»…).
   • المسلسلات تُضاف كعناصر خفيفة، وحلقاتها تُحمَّل عند فتح المسلسل فقط (get_series_info). */
(function(){
  const clean=s=>String(s==null?'':s).replace(/"/g,"'").replace(/[\r\n]+/g,' ').trim();
  const nm=s=>clean(s).replace(/,/g,'،');
  async function api(host,u,p,action,signal){
    const url=host+'/player_api.php?username='+encodeURIComponent(u)+'&password='+encodeURIComponent(p)+'&action='+action;
    try{
      const r=await fetch(url,signal?{signal}:undefined);
      if(!r.ok)return null;
      return await r.json();
    }catch(e){
      if(e&&e.name==='AbortError')throw e;
      return null;
    }
  }
  const catMap=arr=>{const m={};(Array.isArray(arr)?arr:[]).forEach(c=>{m[c.category_id]=clean(c.category_name)});return m};
  const arr=x=>Array.isArray(x)?x:[];
  const rt=x=>{let r=parseFloat(x&&(x.imdb_rating||x.rating));if(!(r>0)){const f=parseFloat(x&&x.rating_5based);if(f>0)r=f*2}return r>0?(Math.round(Math.min(r,10)*10)/10):''};
  const yr=x=>{const raw=clean(x&&(x.year||x.releaseDate||x.release_date||x.releasedate));const m=/\b((?:19|20)\d{2})\b/.exec(raw);return m?m[1]:''};
  const optAttr=(k,v)=>{const c=clean(v);return c?' '+k+'="'+c+'"':''};

  async function build(host,u,p,hooks){
    host=host.trim().replace(/\/+$/,'');
    if(!/^https?:\/\//i.test(host))host='http://'+host;
    const signal=hooks&&hooks.signal;
    const onProgress=hooks&&typeof hooks.onProgress==='function'?hooks.onProgress:null;
    const acts=['get_live_categories','get_live_streams','get_vod_categories','get_vod_streams','get_series_categories','get_series'];
    const state={completed:0,total:acts.length,live:0,movies:0,series:0,liveCats:0,vodCats:0,seriesCats:0,done:{}};
    const emit=action=>{
      if(!onProgress)return;
      const groups=state.liveCats+state.vodCats+state.seriesCats;
      onProgress({
        action,
        completed:state.completed,
        total:state.total,
        pct:Math.round((state.completed/state.total)*78),
        done:Object.assign({},state.done),
        counts:{
          live:state.live,
          movies:state.movies,
          series:state.series,
          liveCats:state.liveCats,
          vodCats:state.vodCats,
          seriesCats:state.seriesCats,
          groups,
          total:state.live+state.movies+state.series
        }
      });
    };
    if(onProgress)emit('start');
    const results=await Promise.all(acts.map(a=>api(host,u,p,a,signal).then(data=>{
      state.completed++;
      state.done[a]=true;
      const len=Array.isArray(data)?data.length:0;
      if(a==='get_live_categories')state.liveCats=len;
      else if(a==='get_live_streams')state.live=len;
      else if(a==='get_vod_categories')state.vodCats=len;
      else if(a==='get_vod_streams')state.movies=len;
      else if(a==='get_series_categories')state.seriesCats=len;
      else if(a==='get_series')state.series=len;
      emit(a);
      return data;
    })));
    if(signal&&signal.aborted)throw new DOMException('Aborted','AbortError');
    const [lc,live,vc,vod,sc,ser]=results;
    const L=catMap(lc),V=catMap(vc),S=catMap(sc);
    const out=['#EXTM3U'];let n=0;
    arr(live).forEach(c=>{
      out.push('#EXTINF:-1 tvg-id="'+clean(c.epg_channel_id)+'" tvg-logo="'+clean(c.stream_icon)+'" group-title="'+(L[c.category_id]||'قنوات مباشرة')+'",'+nm(c.name));
      out.push(host+'/live/'+u+'/'+p+'/'+c.stream_id+'.m3u8');n++;
    });
    arr(vod).forEach(m=>{
      const extra=optAttr('tvg-year',yr(m))+optAttr('imdb-id',m.imdb_id)+optAttr('tvg-cast',m.cast)+optAttr('tvg-director',m.director)+optAttr('tvg-genre',m.genre);
      out.push('#EXTINF:-1 tvg-logo="'+clean(m.stream_icon)+'" tvg-rating="'+rt(m)+'"'+extra+' group-title="أفلام | '+(V[m.category_id]||'عام')+'",'+nm(m.name));
      out.push(host+'/movie/'+u+'/'+p+'/'+m.stream_id+'.'+(m.container_extension||'mp4'));n++;
    });
    arr(ser).forEach(s=>{
      const extra=optAttr('tvg-year',yr(s))+optAttr('imdb-id',s.imdb_id)+optAttr('tvg-cast',s.cast)+optAttr('tvg-director',s.director)+optAttr('tvg-genre',s.genre);
      out.push('#EXTINF:-1 tvg-logo="'+clean(s.cover)+'" tvg-rating="'+rt(s)+'"'+extra+' group-title="مسلسلات | '+(S[s.category_id]||'عام')+'",'+nm(s.name));
      out.push(host+'/player_api.php?username='+encodeURIComponent(u)+'&password='+encodeURIComponent(p)+'&action=get_series_info&series_id='+s.series_id);n++;
    });
    const text=out.join('\n')+'\n';
    return{
      text,
      count:n,
      host,
      counts:{
        live:arr(live).length,
        movies:arr(vod).length,
        series:arr(ser).length,
        groups:Object.keys(L).length+Object.keys(V).length+Object.keys(S).length
      }
    };
  }

  /* ربط أحداث تقدم Xtream بجلسة WasslaSourceLoader تلقائياً */
  function bindXtreamSession(session,host){
    if(!session)return null;
    const F=window.WasslaSourceLoader;
    const num=n=>F?F.formatNum(n):String(n);
    return{
      signal:session.signal,
      onProgress(ev){
        if(session.aborted)return;
        const c=ev.counts;
        if(ev.action==='start'){
          session.setStep('connect','active','جاري الاتصال بـ '+host+' وجلب فئات المحتوى…');
          session.setStep('live','active','جاري طلب قائمة القنوات المباشرة…');
          session.setStep('vod','active','جاري طلب مكتبة الأفلام والمسلسلات…');
          session.setProgress(8,'إرسال 6 طلبات متوازية لواجهة Xtream API…');
          return;
        }
        const catsDone=ev.done.get_live_categories&&ev.done.get_vod_categories&&ev.done.get_series_categories;
        if(catsDone){
          session.setStep('connect','done','تم جلب '+num(c.groups)+' تصنيف ('+num(c.liveCats)+' قنوات · '+num(c.vodCats)+' أفلام · '+num(c.seriesCats)+' مسلسلات)');
        }else if(ev.action.endsWith('_categories')){
          session.setStep('connect','active','تم جلب '+num(c.groups)+' تصنيف حتى الآن…');
        }
        if(ev.done.get_live_streams){
          session.setStep('live','done','تم تحميل '+num(c.live)+' قناة مباشرة');
        }
        const vodDone=ev.done.get_vod_streams&&ev.done.get_series;
        if(vodDone){
          session.setStep('vod','done','تم تحميل '+num(c.movies)+' فيلم و '+num(c.series)+' مسلسل');
        }else if(ev.done.get_vod_streams){
          session.setStep('vod','active','تم تحميل '+num(c.movies)+' فيلم — جاري استكمال المسلسلات…');
        }else if(ev.done.get_series){
          session.setStep('vod','active','تم تحميل '+num(c.series)+' مسلسل — جاري استكمال الأفلام…');
        }
        session.setProgress(Math.max(12,ev.pct),'استجابة '+ev.completed+' من '+ev.total+' واجهات Xtream');
        session.setStats({
          total:c.total,
          live:c.live,
          movies:c.movies,
          series:c.series,
          seriesEntries:c.series,
          groups:c.groups
        });
      }
    };
  }
  window.__bindXtreamSession=bindXtreamSession;

  window.xtPrepare=async function(host,u,p,hooks){
    const r=await build(host,u,p,hooks);
    if(!r.count)throw new Error('لم يُرجع الحساب محتوى صالحًا');
    return{xt:{host:r.host,u,p},text:r.text,count:r.count,counts:r.counts};
  };
  window.xtAddPrepared=async function(prepared,name,opts){
    if(!prepared||!prepared.xt||!prepared.text)return false;
    const existing=new Set(lists.map(l=>l.id));
    const ok=await addList(prepared.text,name||'Xtream','',opts);
    if(ok){
      const l=lists.find(x=>!existing.has(x.id));
      if(l){l.xt=prepared.xt;l.remoteText=prepared.text;await saveLists()}
    }
    return ok;
  };
  /* إضافة سيرفر جديد: يعيد true عند النجاح */
  window.xtAdd=async function(host,u,p,name,opts){
    const Loader=window.WasslaSourceLoader;
    const externalSession=opts&&opts.session;
    const useLoader=!externalSession&&!(opts&&opts.silentLoader)&&!!Loader;
    const session=externalSession||(useLoader?Loader.begin({mode:'xtream',title:(name||'سيرفر Xtream')+' · '+host}):null);
    try{
      const hooks=session?bindXtreamSession(session,host):undefined;
      const prepared=await window.xtPrepare(host,u,p,hooks);
      if(session&&session.aborted)return false;
      if(session){
        session.setStep('save','active','جاري بناء القائمة وتصنيف المحتوى وحفظ المصدر…');
        session.setProgress(86,'حفظ '+Loader.formatNum(prepared.count)+' عنصر محلياً…');
      }
      return await window.xtAddPrepared(prepared,name,{session,keepSessionOpen:!!externalSession,mode:'xtream'});
    }catch(e){
      if(e&&e.name==='AbortError')return false;
      if(session&&!externalSession&&!session.closed){
        session.fail((e&&e.message)||'تعذّر الاتصال بسيرفر Xtream. تحقق من العنوان واسم المستخدم وكلمة السر.','connect');
      }
      throw e;
    }
  };
  window.xtPreview=async function(id,hooks){
    const l=lists.find(x=>x.id===id);
    if(!l||!l.xt)throw new Error('حساب Xtream غير متاح');
    const r=await build(l.xt.host,l.xt.u,l.xt.p,hooks);
    if(!r.count)throw new Error('لم يُرجع حساب Xtream أي محتوى');
    const parsed=window.WasslaSourceLoader
      ? await window.WasslaSourceLoader.parseM3UProgress(r.text,{signal:hooks&&hooks.signal})
      : parseM3U(r.text);
    return{id,kind:'xtream',sourceKey:JSON.stringify(l.xt),items:parsed,remoteText:r.text,bytes:new Blob([r.text]).size};
  };
  /* تحديث مصدر Xtream موجود */
  window.xtRefresh=async function(l){
    if(!l||!l.xt)return false;
    const proposal=await window.xtPreview(l.id);
    return await window.__applyListUpdate(proposal,'merge');
  };
})();
