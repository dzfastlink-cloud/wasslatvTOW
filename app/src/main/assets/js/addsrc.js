/* ===== نافذة «إضافة القائمة»: رابط M3U · ملف M3U · Xtream · نص m3u خام · اكتشاف تلقائي ===== */
(function(){
  const dlg=$('addsrc'),grid=$('asg'),form=$('asf'),msg=$('asm'),addB=$('asadd'),A=window.Android;
  const tv=!!(A&&A.isTv&&A.isTv());
  const METHODS=[
    {id:'url',i:'🌐',t:'رابط M3U',d:'الصق رابطاً لملف .m3u أو .m3u8 بعيد',
      f:[{k:'url',l:'رابط قائمة التشغيل (m3u, m3u8)*',ltr:1,ph:'https://example.com/list.m3u'},{k:'title',l:'عنوان القائمة'},
         {k:'ua',l:'وكيل المستخدم',ltr:1,hint:'بعض خدمات IPTV قد تتطلب وكيل مستخدم محدد لتشغيل قوائمها.'}]},
    {id:'file',i:'📁',t:'ملف M3U',d:'حمّل قائمة تشغيل من جهازك',f:[{k:'title',l:'عنوان القائمة'}],file:1},
    {id:'xtream',i:'🔑',t:'بيانات اعتماد Xtream',d:'اتصل باستخدام المضيف واسم المستخدم وكلمة المرور',
      f:[{k:'host',l:'عنوان السيرفر*',ltr:1,ph:'http://domain.com:8080'},{k:'user',l:'اسم المستخدم*',ltr:1},{k:'pass',l:'كلمة المرور*',ltr:1},{k:'title',l:'عنوان القائمة'}]},
    {id:'text',i:'📝',t:'نص m3u الخام',d:'للقوائم العابرة أو عندما يتوفر لديك النص فقط',
      f:[{k:'text',l:'محتوى القائمة*',area:1,ph:'#EXTM3U\n#EXTINF:-1,قناة\nhttp://…'},{k:'title',l:'عنوان القائمة'}]},
    {id:'auto',i:'✨',t:'اكتشاف تلقائي',d:'الصق رسالة مزود الخدمة وسنكتشف نوعها',
      f:[{k:'text',l:'رسالة مزود الخدمة*',area:1,ph:'الصق الرسالة هنا: رابط M3U أو بيانات Xtream أو بوابة + MAC'},{k:'title',l:'عنوان القائمة'}]}
  ];
  let cur=METHODS[0],vals={},busy=false,picked='',pickedName='',found=null;

  const say=(t,c)=>{msg.textContent=t||'';msg.className='as-msg'+(c?' '+c:'')};
  const base=n=>String(n||'').replace(/\.[^.]+$/,'');

  /* ---------- اكتشاف نوع النص ---------- */
  function detect(text){
    text=String(text||'');
    const urls=text.match(/https?:\/\/[^\s"'<>]+/gi)||[];
    if(window.xtParseTxt){
      try{const a=window.xtParseTxt(text);if(a.length)return{type:'xtream',host:a[0].host,user:a[0].user,pass:a[0].pass,title:a[0].name}}catch(e){}
    }
    if(/#EXTM3U|#EXTINF/i.test(text))return{type:'text',text};
    const m=urls.find(u=>/\.m3u8?(\?|$)|type=m3u|get\.php/i.test(u))||(urls.length===1?urls[0]:'');
    if(m)return{type:'url',url:m};
    return null;
  }
  const NAMES={url:'رابط M3U',xtream:'Xtream',text:'نص M3U'};

  /* ---------- التحقق ---------- */
  function valid(){
    const v=vals;
    switch(cur.id){
      case 'url':return /^https?:\/\//i.test((v.url||'').trim());
      case 'file':return !!picked;
      case 'xtream':return !!((v.host||'').trim()&&(v.user||'').trim()&&(v.pass||'').trim());
      case 'text':return (v.text||'').trim().length>10;
      case 'auto':return !!found;
    }
    return false;
  }
  function sync(){addB.disabled=busy||!valid()}

  /* ---------- الرسم ---------- */
  function paintCards(){
    grid.textContent='';
    METHODS.forEach(m=>{
      const b=document.createElement('button');b.type='button';b.className='as-c'+(m===cur?' on':'');
      b.setAttribute('role','radio');b.setAttribute('aria-checked',m===cur?'true':'false');
      b.innerHTML='<i></i><b></b><small></small>';
      b.children[0].textContent=m.i;b.children[1].textContent=m.t;b.children[2].textContent=m.d;
      b.onclick=()=>{if(busy)return;choose(m)};
      grid.appendChild(b);
    });
  }
  function lock(el){if(tv){el.readOnly=true;el.setAttribute('inputmode','none')}}
  function paintForm(){
    form.textContent='';
    if(cur.file){
      const r=document.createElement('div');r.className='as-file';
      const b=document.createElement('button');b.type='button';b.className='alt';b.textContent='📁 اختيار ملف';
      const e=document.createElement('em');e.textContent=pickedName||'لم يُختر ملف بعد (M3U أو txt لحساب Xtream)';
      b.onclick=pickFile;r.append(b,e);form.appendChild(r);
    }
    cur.f.forEach(f=>{
      const w=document.createElement('label');w.className='as-f';
      const s=document.createElement('span');s.textContent=f.l;
      const inp=document.createElement(f.area?'textarea':'input');
      if(!f.area){inp.type='text';inp.autocomplete='off';inp.spellcheck=false}
      if(f.ltr)inp.classList.add('ltr');
      if(f.ph)inp.placeholder=f.ph;inp.setAttribute('aria-label',f.l);
      inp.value=vals[f.k]||'';lock(inp);
      inp.addEventListener('input',()=>{vals[f.k]=inp.value;onInput(f.k)});
      inp.addEventListener('change',()=>{vals[f.k]=inp.value;onInput(f.k)});
      w.append(s,inp);
      if(f.hint){const h=document.createElement('small');h.textContent=f.hint;w.appendChild(h)}
      form.appendChild(w);
    });
  }
  function onInput(k){
    if(cur.id==='auto'&&k==='text'){
      found=detect(vals.text);
      if(found){say('تم اكتشاف: '+NAMES[found.type]+(found.host?' — '+found.host:found.portal?' — '+found.portal:''),'ok')}
      else say(vals.text?'لم نتعرف على النوع بعد — تأكد أن الرسالة تحتوي رابطاً أو بيانات الاتصال':'');
    }else if(msg.className.indexOf('err')>=0)say('');
    sync();
  }
  function choose(m){cur=m;found=null;say('');paintCards();paintForm();sync()}
  function reset(){vals={};picked='';pickedName='';found=null;busy=false;choose(METHODS[0]);setBusy(false)}
  function setBusy(b){busy=b;[...dlg.querySelectorAll('button')].forEach(x=>{if(x.id!=='ascan')x.disabled=b});if(!b)sync()}

  /* ---------- ملف من الجهاز ---------- */
  function pickFile(){
    if(!A||!A.pickFile){say('اختيار الملفات غير متاح هنا — استعمل «نص m3u الخام» أو الرابط','err');return}
    window.__onPicked=ok=>{
      window.__onPicked=null;
      if(!ok){say('تعذّرت قراءة الملف أو أُلغي الاختيار','err');return}
      picked=A.pickedText();pickedName=A.pickedName();
      if(!vals.title)vals.title=base(pickedName);
      paintForm();sync();say(picked?'تم اختيار: '+pickedName:'الملف فارغ','');
    };
    A.pickFile();
  }
  /* على المتصفح (غير أندرويد) */
  (function(){
    if(A&&A.pickFile)return;
    const orig=pickFile;
  })();

  /* ---------- التنفيذ ---------- */
  async function run(){
    if(busy||!valid())return;
    let m=cur.id,v=Object.assign({},vals);
    if(m==='auto'){m=found.type;v=Object.assign({},found,{title:vals.title||found.title||''})}
    setBusy(true);say('جارٍ الاتصال… قد يستغرق لحظات');
    let ok=false,err='';
    try{
      const t=(v.title||'').trim();
      if(m==='url'){
        const u=v.url.trim(),host=(u.match(/^https?:\/\/([^\/:?#]+)/)||[])[1]||'قائمة',ua=(v.ua||'').trim();
        const text=await getText(u,ua);
        ok=await addList(text,t||host,u);
        if(ok&&ua){const l=lists.find(x=>x.id===active);if(l){l.ua=ua;await saveLists()}}
        if(!ok)err='لا توجد قنوات صالحة في هذا الرابط';
      }else if(m==='file'){
        ok=await addList(picked,t||base(pickedName)||'قائمة','');
        if(!ok)err='الملف لا يحتوي قنوات صالحة';
      }else if(m==='text'){
        ok=await addList(v.text,t||'قائمة','');
        if(!ok)err='النص لا يحتوي قنوات صالحة';
      }else if(m==='xtream'){
        ok=await window.xtAdd(v.host.trim(),v.user.trim(),v.pass.trim(),t||'Xtream');
        if(!ok)err='تعذّر الاتصال أو لا توجد قنوات — تحقق من العنوان والبيانات';
      }
    }catch(e){err=m==='url'?'تعذّر تنزيل القائمة من هذا الرابط (قد يتطلب وكيل مستخدم محدداً)':'حدث خطأ غير متوقع'}
    setBusy(false);
    if(ok){
      dlg.close();
      if(window.__rcvToast)__rcvToast('تمت إضافة المصدر');
    }else say(err||'تعذّرت الإضافة','err');
  }

  addB.onclick=run;
  $('ascan').onclick=()=>{if(!busy)dlg.close()};
  $('asclr').onclick=()=>{if(busy)return;vals={};picked='';pickedName='';found=null;say('');paintForm();sync()};
  dlg.addEventListener('cancel',e=>{if(busy)e.preventDefault()});

  window.__addSource=function(method){
    reset();
    const m=METHODS.find(x=>x.id===method);if(m)choose(m);
    if(!dlg.open)dlg.showModal();
    const c=grid.querySelector('.as-c.on')||grid.firstChild;if(c)c.focus({preventScroll:true});
  };
  const w=$('welcomeAdd');if(w)w.onclick=()=>window.__addSource();
  const st=$('set');if(st)st.onclick=()=>{if(window.__openSettings)window.__openSettings();else openSet()};
})();
