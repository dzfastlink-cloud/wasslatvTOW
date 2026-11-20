/* ===== إضافة حساب Xtream من ملف txt =====
   يعمل مع كل طرق الإدخال التي تمر عبر addList: منتقي الملفات، السحب والإفلات،
   البحث التلقائي عن الملفات الجديدة، والمجلد المختار.
   الصيغ المدعومة داخل الملف (يمكن وضع أكثر من حساب، يفصل بينها سطر فارغ):
     1) مفاتيح:        host=http://domain.com:8080   (أو server / url / سيرفر)
                       username=USER                 (أو user / المستخدم)
                       password=PASS                 (أو pass / كلمة السر)
                       name=اسم اختياري
     2) رابط get.php:  http://domain.com:8080/get.php?username=U&password=P&type=m3u_plus
     3) ثلاثة أسطر:    السيرفر ثم المستخدم ثم كلمة السر (وسطر رابع للاسم اختياري)
     4) سطر واحد:      http://domain.com:8080 | USER | PASS
   أما ملفات M3U العادية فلا تتأثر. */
(function(){
  const origAdd=window.addList;
  if(typeof origAdd!=='function'||typeof window.xtAdd!=='function')return;

  const KEYS={
    host:['host','server','url','portal','link','dns','xtream url','server url','سيرفر','السيرفر','الرابط','رابط','عنوان السيرفر','عنوان'],
    user:['username','user','login','usr','user name','المستخدم','مستخدم','اسم المستخدم'],
    pass:['password','pass','pwd','passwd','كلمة السر','كلمة المرور','كلمة سر','كلمة مرور','باسورد'],
    name:['name','title','الاسم','اسم']
  };
  const keyOf=k=>{
    k=String(k).toLowerCase().replace(/[\s_\-.]+/g,' ').trim();
    for(const t in KEYS)if(KEYS[t].includes(k))return t;
    return '';
  };
  const strip=s=>String(s==null?'':s).trim().replace(/^["'`]+|["'`,;]+$/g,'').trim();
  const dec=s=>{try{return decodeURIComponent(s)}catch(e){return s}};
  const LOOKS_HOST=/^(https?:\/\/)?(([a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(\.\d{1,3}){3}|localhost)(:\d+)?(\/[^\s]*)?$/i;

  // يعيد http(s)://host:port فقط (يحذف المسار)
  function hostOf(h){
    h=strip(h);if(!h)return '';
    if(!/^https?:\/\//i.test(h))h='http://'+h;
    try{const u=new URL(h);return u.host?u.protocol+'//'+u.host:''}catch(e){return ''}
  }
  function fromUrl(line){
    const m=line.match(/https?:\/\/[^\s"'<>]+/i);if(!m)return null;
    const raw=m[0];const host=hostOf(raw);if(!host)return null;
    const qu=raw.match(/[?&]username=([^&#\s]*)/i),qp=raw.match(/[?&]password=([^&#\s]*)/i);
    if(qu&&qp)return{host,user:dec(qu[1]),pass:dec(qp[1]),src:'explicit'};
    const p=raw.match(/\/(?:live|movie|series)\/([^\/?#]+)\/([^\/?#]+)\/[^\/?#]+$/i);
    if(p)return{host,user:dec(p[1]),pass:dec(p[2]),src:'stream'};
    return{host,user:'',pass:'',src:'explicit'};
  }

  function parse(text){
    const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/);
    const out=[];let cur={};
    const flush=()=>{
      if(cur.host&&cur.user&&cur.pass)out.push({host:cur.host,user:cur.user,pass:cur.pass,name:cur.name||'',src:cur.src||'explicit'});
      cur={};
    };
    for(const raw of lines){
      const l=raw.trim();
      if(!l){flush();continue}
      if(/^(#|\/\/)/.test(l))continue;
      if(/^https?:\/\//i.test(l)){
        const r=fromUrl(l);if(!r)continue;
        if(r.user&&r.pass){flush();out.push({host:r.host,user:r.user,pass:r.pass,name:'',src:r.src})}
        else{if(cur.host)flush();cur.host=r.host}
        continue;
      }
      const m=l.match(/^([^:=：]{1,30}?)\s*[:=：]\s*(.+)$/);
      if(!m)continue;
      const k=keyOf(m[1]);if(!k)continue;
      const v=strip(m[2]);
      if(k==='host'){
        const nh=hostOf(v);if(!nh)continue;
        if(cur.host)flush();
        cur.host=nh;
        const r=/^https?:/i.test(v)?fromUrl(v):null;
        if(r&&r.user&&r.pass){cur.user=r.user;cur.pass=r.pass}
      }else cur[k]=v;
    }
    flush();

    // احتياطي: ثلاثة أسطر أو سطر واحد بالترتيب (سيرفر، مستخدم، كلمة سر، [اسم])
    if(!out.length){
      const ls=lines.map(s=>s.trim()).filter(s=>s&&!/^(#|\/\/)/.test(s));
      if(!ls.slice(1).some(s=>/^https?:\/\//i.test(s))){
        let t=[];
        if(ls.length>=3&&ls.length<=4)t=ls;
        else if(ls.length===1)t=ls[0].split(/\s*[|,;\t]\s*|\s+/).filter(Boolean);
        if(t.length>=3&&LOOKS_HOST.test(strip(t[0]))){
          const h=hostOf(t[0]),u=strip(t[1]),p=strip(t[2]);
          if(h&&u&&p)out.push({host:h,user:u,pass:p,name:strip(t[3]||''),src:'explicit'});
        }
      }
    }
    // إزالة المكرر
    const seen=new Set();
    return out.filter(a=>{const k=a.host+'|'+a.user+'|'+a.pass;if(seen.has(k))return false;seen.add(k);return true});
  }
  window.xtParseTxt=parse;

  window.addList=async function(text,name,url,opts){
    // M3U حقيقي أو رابط تنزيل أو نص كبير: المسار الأصلي مع تمرير الخيارات
    if(url||!text||text.length>20000||/#EXTM3U|#EXTINF/i.test(text))return origAdd(text,name,url,opts);
    let acc=[];
    try{acc=parse(text)}catch(e){}
    if(!acc.length){
      if(/\.txt$/i.test(String(name||''))){
        window.__lastImportError='لم يتم التعرف على بيانات Xtream في الملف النصي. تأكد من كتابة السيرفر والمستخدم وكلمة السر بصيغة صحيحة.';
      }
      return origAdd(text,name,url,opts);
    }

    const Loader=window.WasslaSourceLoader;
    const externalSession=opts&&opts.session;
    const silentLoader=!!(opts&&opts.silentLoader);
    const session=externalSession||(!silentLoader&&Loader?Loader.begin({
      mode:'xtream',
      title:(name||'ملف حسابات Xtream')+(acc.length>1?' ('+acc.length+' حسابات)':'')
    }):null);
    if(session&&externalSession){
      session.setSteps(Loader.defaultSteps('xtream'));
      session.setTitle((name||'ملف حسابات Xtream')+(acc.length>1?' ('+acc.length+' حسابات)':''));
    }

    const valid=[],failed=[];
    for(let i=0;i<acc.length;i++){
      if(session&&session.aborted)return false;
      const a=acc[i];
      let nm=a.name||name||a.host.replace(/^https?:\/\//,'');
      if(acc.length>1&&!a.name)nm=(name||'Xtream')+' '+(i+1);
      if(session&&acc.length>1){
        session.setHeading('جارٍ تحميل الحساب '+(i+1)+' من '+acc.length);
        session.setTitle(nm+' · '+a.host);
      }
      try{
        const hooks=session&&window.__bindXtreamSession?window.__bindXtreamSession(session,a.host):undefined;
        const prepared=await window.xtPrepare(a.host,a.user,a.pass,hooks);
        valid.push({name:nm,prepared});
      }catch(e){
        if(e&&e.name==='AbortError')return false;
        failed.push({name:nm,reason:'فشل الاتصال أو لا يوجد محتوى صالح'});
      }
    }
    const keepSessionOpen=!!(opts&&opts.keepSessionOpen);
    if(session&&session.aborted)return false;
    if(valid.length&&window.__reviewXtreamAccounts){
      return window.__reviewXtreamAccounts(valid,failed,{session,keepSessionOpen});
    }
    if(valid.length){
      let ok=0,lastSourceId='';
      const allItems=[];
      let totalBytes=0;
      if(session){
        session.setStep('save','active','جاري حفظ المصادر المستوردة وتفعيلها…');
        session.setProgress(88,'تخزين '+valid.length+' حساب محلياً…');
      }
      for(const account of valid){
        try{
          const before=new Set(lists.map(l=>l.id));
          if(await window.xtAddPrepared(account.prepared,account.name,{silentLoader:true})){
            ok++;
            const added=lists.find(l=>!before.has(l.id));
            if(added)lastSourceId=added.id;
            totalBytes+=new Blob([account.prepared.text||'']).size;
            parseM3U(account.prepared.text||'').forEach(it=>allItems.push(it));
          }
        }catch(e){failed.push({name:account.name,reason:'تعذّرت الإضافة'})}
      }
      if(session&&!keepSessionOpen){
        if(ok>0){
          const stats=Loader.analyzeItems(allItems,{bytes:totalBytes});
          session.setStep('save','done','تم حفظ وتفعيل '+ok+' مصدر بنجاح');
          session.succeed({
            title:valid[valid.length-1].name,
            stats,
            sourceId:lastSourceId,
            note:failed.length?('تمت إضافة '+ok+' حساب، وتعذّر '+failed.length+'.'):'تم استيراد حساب Xtream وتفعيله بنجاح.'
          });
        }else{
          session.fail('تعذّرت إضافة حسابات Xtream المستخرجة من الملف.','save');
        }
      }
      if(failed.length&&typeof setMsg==='function')setMsg('تم التحقق من الحسابات؛ تعذّرت إضافة بعض الحسابات.',true);
      return ok>0;
    }
    const failMsg='تعذّر الاتصال بسيرفر Xtream الموجود في الملف. تحقق من العنوان واسم المستخدم وكلمة السر.';
    window.__lastImportError=failMsg;
    if(session&&!keepSessionOpen&&!session.closed)session.fail(failMsg,'connect');
    if(typeof setMsg==='function')setMsg(failMsg,true);
    return false;
  };
})();
