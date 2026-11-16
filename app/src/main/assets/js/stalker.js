/* ===== بوابات Stalker / Ministra (MAG): المصدر = رابط البوابة + عنوان MAC =====
   • الاستيراد: handshake ← get_profile ← get_genres + get_all_channels، وتُحوَّل القنوات إلى قائمة M3U عادية
     (المجموعات = تصنيفات البوابة) فتعمل معها المفضلة والبحث وإدارة القنوات كأي مصدر.
   • التشغيل: روابط Stalker مؤقتة وتتغير لكل جلسة، لذا تُخزَّن القناة بصيغة stalker://<مفتاح البوابة>/<cmd>
     وتُحوَّل إلى رابط البث الفعلي (create_link) لحظة التشغيل فقط.
   • الشبكة: رؤوس Cookie وUser-Agent وAuthorization يمنعها fetch في المتصفح، فتمر عبر Android.httpGet (WebActivity.kt). */
(function(){
  const A=window.Android;
  /* ---------- طبقة HTTP: أصلية على أندرويد، وfetch احتياطي ---------- */
  let seq=0;const pend={};
  window.__onHttp=function(id,ok,code){
    const f=pend[id];if(!f)return;delete pend[id];
    let body='';try{body=A.httpBody(id)}catch(e){}
    f({ok:!!ok,code:code|0,body});
  };
  function nativeGet(url,headers){
    return new Promise(res=>{
      const id='h'+(++seq);pend[id]=res;
      setTimeout(()=>{if(pend[id]){delete pend[id];res({ok:false,code:0,body:''})}},45000);
      try{A.httpGet(id,url,JSON.stringify(headers||{}))}catch(e){delete pend[id];res({ok:false,code:0,body:''})}
    });
  }
  window.__httpGet=async function(url,headers){
    if(A&&A.httpGet)return nativeGet(url,headers);
    try{const r=await fetch(url,{cache:'no-store'});return{ok:r.ok,code:r.status,body:await r.text()}}
    catch(e){return{ok:false,code:0,body:''}}
  };

  /* ---------- أدوات ---------- */
  const UA='Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3';
  const MACRE=/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
  const normMac=m=>{m=String(m||'').trim().toUpperCase().replace(/-/g,':');return MACRE.test(m)?m:''};
  const clean=s=>String(s==null?'':s).replace(/"/g,"'").replace(/[\r\n]+/g,' ').trim();
  const nm=s=>clean(s).replace(/,/g,'،');
  function jparse(t){
    if(!t)return null;
    try{return JSON.parse(t)}catch(e){}
    const a=t.indexOf('{'),b=t.lastIndexOf('}');
    if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch(e){}}
    return null;
  }
  function baseOf(u){
    u=String(u||'').trim();if(!u)return '';
    if(!/^https?:\/\//i.test(u))u='http://'+u;
    try{
      const x=new URL(u);let p=x.pathname.replace(/\/+$/,'').replace(/\/server\/load\.php$/i,'').replace(/\/c$/i,'');
      return x.origin+p;
    }catch(e){return ''}
  }
  const keyOf=(portal,mac)=>{let h=5381;const s=portal+'|'+mac;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(16)};
  const reg=()=>LS.get('m3u_stalker',{});
  const saveReg=(k,v)=>{const r=reg();r[k]=v;LS.set('m3u_stalker',r)};
  const hdr=(mac,token)=>{
    const h={'Cookie':'mac='+mac+'; stb_lang=en; timezone=Europe%2FParis','User-Agent':UA,'X-User-Agent':'Model: MAG250; Link: WiFi','Accept':'*/*'};
    if(token)h['Authorization']='Bearer '+token;return h;
  };
  const sessions={};   // key → {ep,token,ts}

  async function call(sess,mac,qs){
    const r=await window.__httpGet(sess.ep+'?'+qs+'&JsHttpRequest=1-xml',hdr(mac,sess.token));
    return r.ok?jparse(r.body):null;
  }
  /* handshake: يجرّب مسارات load.php الشائعة ويعيد الجلسة أو سبب الفشل */
  async function connect(portal,mac){
    const base=baseOf(portal);if(!base)return{err:'portal'};
    const eps=[base+'/server/load.php'];
    if(!/stalker_portal/i.test(base))eps.push(base+'/stalker_portal/server/load.php');
    let reached=false;
    for(const ep of eps){
      const r=await window.__httpGet(ep+'?type=stb&action=handshake&token=&JsHttpRequest=1-xml',hdr(mac,''));
      if(r.code)reached=true;
      const j=r.ok?jparse(r.body):null;
      const tk=j&&j.js&&j.js.token;
      if(tk){
        const sess={ep,token:tk,ts:Date.now()};
        // الملف الشخصي يفعّل الجلسة في كثير من البوابات (يُتجاهل فشله)
        await call(sess,mac,'type=stb&action=get_profile&hd=1&num_banks=2&stb_type=MAG250&client_type=STB&image_version=218&video_out=hdmi&auth_second_step=1&hw_version=1.7-BD-00&not_valid_token=0&api_signature=262');
        return{sess};
      }
    }
    return{err:reached?'denied':'network'};
  }
  const rows=j=>{
    if(!j||!j.js)return [];
    const d=j.js.data!==undefined?j.js.data:j.js;
    return Array.isArray(d)?d:[];
  };

  async function fetchChannels(sess,mac){
    const gj=await call(sess,mac,'type=itv&action=get_genres');
    const G={};rows(gj).forEach(g=>{if(g&&g.id!=null)G[String(g.id)]=clean(g.title||g.name)});
    let list=rows(await call(sess,mac,'type=itv&action=get_all_channels'));
    if(!list.length){
      // بوابات تمنع get_all_channels: قراءة صفحية
      for(let p=1;p<=80;p++){
        const j=await call(sess,mac,'type=itv&action=get_ordered_list&genre=*&force_ch_link_check=&fav=0&sortby=number&hd=0&p='+p);
        const part=rows(j);if(!part.length)break;list=list.concat(part);
        const tot=+(j&&j.js&&j.js.total_items)||0,per=+(j&&j.js&&j.js.max_page_items)||part.length;
        if(tot&&p*per>=tot)break;
      }
    }
    return{list,G};
  }
  function toM3U(key,list,G){
    const nums=list.map(c=>parseInt(c.number,10)||0),uniq=new Set(nums.filter(n=>n>0));
    const useNum=uniq.size===nums.length&&nums.every(n=>n>0);    // أرقام البوابة تُستعمل إن كانت فريدة وكاملة
    const out=['#EXTM3U'];let n=0;
    list.forEach((c,i)=>{
      const cmd=String(c.cmd||'').trim();if(!cmd)return;
      const g=G[String(c.tv_genre_id)]||'قنوات';
      out.push('#EXTINF:-1'+(useNum?' channel-number="'+nums[i]+'"':'')+' tvg-logo="'+clean(c.logo)+'" group-title="'+g+'",'+nm(c.name));
      out.push('stalker://'+key+'/'+encodeURIComponent(cmd));n++;
    });
    return{text:out.join('\n')+'\n',count:n};
  }
  const WHY={portal:'رابط البوابة غير صالح',mac:'عنوان MAC غير صالح (الصيغة: 00:1A:79:XX:XX:XX)',network:'تعذّر الوصول إلى البوابة — تحقق من الرابط والاتصال',
             denied:'رفضت البوابة الاتصال — تحقق من عنوان MAC واشتراكك',empty:'لا توجد قنوات في هذه البوابة'};
  window.stWhy=c=>WHY[c]||'تعذّر الاتصال بالبوابة';

  async function build(portal,mac){
    mac=normMac(mac);if(!mac)return{err:'mac'};
    const c=await connect(portal,mac);if(c.err)return c;
    const key=keyOf(baseOf(portal),mac),{list,G}=await fetchChannels(c.sess,mac);
    const m=toM3U(key,list,G);if(!m.count)return{err:'empty'};
    sessions[key]={...c.sess};saveReg(key,{portal:baseOf(portal),mac});
    return{text:m.text,count:m.count,key,mac,portal:baseOf(portal)};
  }
  /* إضافة بوابة جديدة: يعيد {ok:true} أو {ok:false,err} */
  window.stAdd=async function(portal,mac,name){
    const r=await build(portal,mac);if(r.err)return{ok:false,err:r.err};
    const ok=await addList(r.text,name||'Stalker','');
    if(ok){const l=lists.find(x=>x.id===active);if(l){l.st={portal:r.portal,mac:r.mac};await saveLists()}}
    return{ok:!!ok,err:ok?'':'empty'};
  };
  window.stRefresh=async function(l){
    if(!l||!l.st)return false;
    const r=await build(l.st.portal,l.st.mac);if(r.err)return false;
    const its=parseM3U(r.text);
    l.text=ser(its);l.n=its.length;l.upd=Date.now();await saveLists();
    if(active===l.id)openList(l.id);return true;
  };

  /* ---------- التشغيل: stalker://key/cmd ← رابط البث الفعلي ---------- */
  const direct=s=>{const m=String(s||'').match(/https?:\/\/[^\s]+/i);return m?m[0]:''};
  async function session(key,force){
    const rg=reg()[key];if(!rg)return null;
    let s=sessions[key];
    if(!force&&s&&Date.now()-s.ts<20*60*1000)return{rg,s};
    const c=await connect(rg.portal,rg.mac);if(c.err)return null;
    s=sessions[key]={...c.sess};return{rg,s};
  }
  window.__resolveUrl=async function(u){
    const m=/^stalker:\/\/([^\/]+)\/(.+)$/i.exec(u||'');if(!m)return u;
    const key=m[1];let cmd;try{cmd=decodeURIComponent(m[2])}catch(e){cmd=m[2]}
    for(let attempt=0;attempt<2;attempt++){
      const ss=await session(key,attempt>0);if(!ss)break;
      const j=await call(ss.s,ss.rg.mac,'type=itv&action=create_link&cmd='+encodeURIComponent(cmd)+'&series=&forced_storage=undefined&disable_ad=0&download=0&force_ch_link_check=0');
      const got=direct(j&&j.js&&j.js.cmd);
      if(got)return got;
    }
    return direct(cmd)||null;       // بعض البوابات تضع الرابط المباشر في cmd نفسه
  };
})();
