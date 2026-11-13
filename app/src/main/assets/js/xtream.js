/* ===== Xtream Codes: بث مباشر + أفلام + مسلسلات بفئاتها الحقيقية =====
   • المجموعات تأخذ أسماء فئات السيرفر («أفلام | أكشن»، «مسلسلات | دراما»…).
   • المسلسلات تُضاف كعناصر خفيفة، وحلقاتها تُحمَّل عند فتح المسلسل فقط (get_series_info). */
(function(){
  const clean=s=>String(s==null?'':s).replace(/"/g,"'").replace(/[\r\n]+/g,' ').trim();
  const nm=s=>clean(s).replace(/,/g,'،');
  async function api(host,u,p,action){
    const url=host+'/player_api.php?username='+encodeURIComponent(u)+'&password='+encodeURIComponent(p)+'&action='+action;
    try{const r=await fetch(url);if(!r.ok)return null;return await r.json()}catch(e){return null}
  }
  const catMap=arr=>{const m={};(Array.isArray(arr)?arr:[]).forEach(c=>{m[c.category_id]=clean(c.category_name)});return m};
  const arr=x=>Array.isArray(x)?x:[];

  async function build(host,u,p){
    host=host.trim().replace(/\/+$/,'');
    if(!/^https?:\/\//i.test(host))host='http://'+host;
    const acts=['get_live_categories','get_live_streams','get_vod_categories','get_vod_streams','get_series_categories','get_series'];
    const [lc,live,vc,vod,sc,ser]=await Promise.all(acts.map(a=>api(host,u,p,a)));
    const L=catMap(lc),V=catMap(vc),S=catMap(sc);
    const out=['#EXTM3U'];let n=0;
    arr(live).forEach(c=>{
      out.push('#EXTINF:-1 tvg-id="'+clean(c.epg_channel_id)+'" tvg-logo="'+clean(c.stream_icon)+'" group-title="'+(L[c.category_id]||'قنوات مباشرة')+'",'+nm(c.name));
      out.push(host+'/live/'+u+'/'+p+'/'+c.stream_id+'.m3u8');n++;
    });
    arr(vod).forEach(m=>{
      out.push('#EXTINF:-1 tvg-logo="'+clean(m.stream_icon)+'" group-title="أفلام | '+(V[m.category_id]||'عام')+'",'+nm(m.name));
      out.push(host+'/movie/'+u+'/'+p+'/'+m.stream_id+'.'+(m.container_extension||'mp4'));n++;
    });
    arr(ser).forEach(s=>{
      out.push('#EXTINF:-1 tvg-logo="'+clean(s.cover)+'" group-title="مسلسلات | '+(S[s.category_id]||'عام')+'",'+nm(s.name));
      out.push(host+'/player_api.php?username='+encodeURIComponent(u)+'&password='+encodeURIComponent(p)+'&action=get_series_info&series_id='+s.series_id);n++;
    });
    return{text:out.join('\n')+'\n',count:n,host};
  }

  window.xtPrepare=async function(host,u,p){
    const r=await build(host,u,p);
    if(!r.count)throw new Error('لم يُرجع الحساب محتوى صالحًا');
    return{xt:{host:r.host,u,p},text:r.text,count:r.count};
  };
  window.xtAddPrepared=async function(prepared,name){
    if(!prepared||!prepared.xt||!prepared.text)return false;
    const existing=new Set(lists.map(l=>l.id));
    const ok=await addList(prepared.text,name||'Xtream','');
    if(ok){
      const l=lists.find(x=>!existing.has(x.id));
      if(l){l.xt=prepared.xt;l.remoteText=prepared.text;await saveLists()}
    }
    return ok;
  };
  /* إضافة سيرفر جديد: يعيد true عند النجاح */
  window.xtAdd=async function(host,u,p,name){
    const prepared=await window.xtPrepare(host,u,p);
    return await window.xtAddPrepared(prepared,name);
  };
  window.xtPreview=async function(id){
    const l=lists.find(x=>x.id===id);
    if(!l||!l.xt)throw new Error('حساب Xtream غير متاح');
    const r=await build(l.xt.host,l.xt.u,l.xt.p);
    if(!r.count)throw new Error('لم يُرجع حساب Xtream أي محتوى');
    return{id,kind:'xtream',sourceKey:JSON.stringify(l.xt),items:parseM3U(r.text),remoteText:r.text};
  };
  /* تحديث مصدر Xtream موجود */
  window.xtRefresh=async function(l){
    if(!l||!l.xt)return false;
    const proposal=await window.xtPreview(l.id);
    return await window.__applyListUpdate(proposal,'merge');
  };
})();
