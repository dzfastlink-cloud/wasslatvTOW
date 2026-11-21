/* ===== نافذة «إضافة القائمة»: رابط M3U · ملف M3U · حساب Xtream =====
   بطاقات الطرق في الأعلى ثم حقول تتبدل حسب الطريقة. على التلفاز الحقول للقراءة فقط:
   OK على الحقل يفتح لوحة المفاتيح داخل التطبيق (kbPrompt/kbEdit) بدل لوحة النظام. */
(function(){
  const dlg=$('addsrc'),grid=$('asg'),form=$('asf'),msg=$('asm'),addB=$('asadd'),A=window.Android;
  const tv=!!(A&&A.isTv&&A.isTv());
  const METHODS=[
    {id:'url',i:'🌐',t:'رابط M3U',d:'الصق رابطاً لملف .m3u أو .m3u8 بعيد',
      f:[{k:'url',l:'رابط قائمة التشغيل (m3u, m3u8)*',ltr:1,ph:'http://example.com/list.m3u'},{k:'title',l:'عنوان القائمة'},
         {k:'ua',l:'وكيل المستخدم',ltr:1,hint:'بعض خدمات IPTV قد تتطلب وكيل مستخدم محدد لتشغيل قوائمها.'}]},
    {id:'file',i:'📁',t:'ملف M3U',d:'حمّل قائمة تشغيل من جهازك (M3U أو txt لحساب Xtream)',f:[{k:'title',l:'عنوان القائمة'}],file:1},
    {id:'xtream',i:'🔑',t:'بيانات اعتماد Xtream',d:'اتصل باستخدام المضيف واسم المستخدم وكلمة المرور',
      f:[{k:'host',l:'عنوان السيرفر*',ltr:1,ph:'http://domain.com:8080'},{k:'user',l:'اسم المستخدم*',ltr:1},{k:'pass',l:'كلمة المرور*',ltr:1},{k:'title',l:'عنوان القائمة'}]}
  ];
  let cur=METHODS[0],vals={},busy=false,picked='',pickedName='';
  const say=(t,c)=>{msg.textContent=t||'';msg.className='as-msg'+(c?' '+c:'')};
  const base=n=>String(n||'').replace(/\.[^.]+$/,'');

  function valid(){
    const v=vals;
    if(cur.id==='url')return /^https?:\/\//i.test((v.url||'').trim());
    if(cur.id==='file')return !!picked;
    return !!((v.host||'').trim()&&(v.user||'').trim()&&(v.pass||'').trim());
  }
  function sync(){addB.disabled=busy||!valid()}

  function paintCards(){
    grid.textContent='';
    METHODS.forEach(m=>{
      const b=document.createElement('button');b.type='button';b.className='as-c'+(m===cur?' on':'');
      b.setAttribute('role','radio');b.setAttribute('aria-checked',m===cur?'true':'false');
      b.innerHTML='<i></i><b></b><small></small>';
      b.children[0].textContent=m.i;b.children[1].textContent=m.t;b.children[2].textContent=m.d;
      b.onclick=()=>{if(!busy)choose(m)};
      grid.appendChild(b);
    });
  }
  function paintForm(){
    form.textContent='';
    if(cur.file){
      const r=document.createElement('div');r.className='as-file';
      const b=document.createElement('button');b.type='button';b.className='alt';b.textContent='📁 اختيار ملف';
      const e=document.createElement('em');e.textContent=pickedName||'لم يُختر ملف بعد';
      b.onclick=pickFile;r.append(b,e);form.appendChild(r);
    }
    cur.f.forEach(f=>{
      const w=document.createElement('label');w.className='as-f';
      const s=document.createElement('span');s.textContent=f.l;
      const inp=document.createElement('input');inp.type='text';inp.autocomplete='off';inp.spellcheck=false;
      if(f.ltr)inp.classList.add('ltr');
      if(f.ph)inp.placeholder=f.ph;inp.setAttribute('aria-label',f.l);
      inp.value=vals[f.k]||'';
      if(tv){inp.readOnly=true;inp.setAttribute('inputmode','none')}
      const upd=()=>{vals[f.k]=inp.value;if(msg.className.indexOf('err')>=0)say('');sync()};
      inp.addEventListener('input',upd);inp.addEventListener('change',upd);
      w.append(s,inp);
      if(f.hint){const h=document.createElement('small');h.textContent=f.hint;w.appendChild(h)}
      form.appendChild(w);
    });
  }
  function choose(m){cur=m;say('');paintCards();paintForm();sync()}
  function setBusy(b){busy=b;[...dlg.querySelectorAll('button')].forEach(x=>{if(x.id!=='ascan')x.disabled=b});if(!b)sync()}

  function pickFile(){
    if(!A||!A.pickFile){say('اختيار الملفات غير متاح هنا — استعمل الرابط','err');return}
    window.__onPicked=(ok,why)=>{
      window.__onPicked=null;
      if(!ok){say(why==='cancel'?'':why==='nohandler'?'لا يوجد تطبيق ملفات على هذا الجهاز — استعمل الرابط':'تعذّرت قراءة الملف',why==='cancel'?'':'err');return}
      picked=A.pickedText();pickedName=A.pickedName();
      if(!vals.title)vals.title=base(pickedName);
      paintForm();sync();say(picked?'تم اختيار: '+pickedName:'الملف فارغ','');
    };
    A.pickFile();
  }

  async function run(){
    if(busy||!valid())return;
    const v=vals,t=(v.title||'').trim();
    setBusy(true);say('جارٍ الاتصال… قد يستغرق لحظات');
    let ok=false,err='';
    try{
      if(cur.id==='url'){
        const u=v.url.trim(),host=(u.match(/^https?:\/\/([^\/:?#]+)/)||[])[1]||'قائمة',ua=(v.ua||'').trim();
        const text=await getText(u,ua);
        ok=await addList(text,t||host,u);
        if(ok&&ua){const l=lists.find(x=>x.id===active);if(l){l.ua=ua;await saveLists()}}
        if(!ok)err='لا توجد قنوات صالحة في هذا الرابط';
      }else if(cur.id==='file'){
        ok=await addList(picked,t||base(pickedName)||'قائمة','');
        if(!ok)err='الملف لا يحتوي قنوات صالحة';
      }else{
        const prepared=await window.xtPrepare(v.host.trim(),v.user.trim(),v.pass.trim());
        ok=await window.xtAddPrepared(prepared,t||'Xtream');
        if(!ok)err='تعذّرت الإضافة — تحقق من بيانات الاتصال';
      }
    }catch(e){err=e&&e.message?e.message:(cur.id==='url'?'تعذّر تنزيل القائمة (قد يتطلب وكيل مستخدم محدداً)':'تعذّر الاتصال أو لا يوجد محتوى صالح')}
    setBusy(false);
    if(ok){
      dlg.close();
      if(window.__rcvToast)__rcvToast('تمت إضافة المصدر');
      if(window.__stRefresh)__stRefresh();
    }else say(err||'تعذّرت الإضافة','err');
  }

  addB.onclick=run;
  $('ascan').onclick=()=>{if(!busy)dlg.close()};
  $('asclr').onclick=()=>{if(busy)return;vals={};picked='';pickedName='';say('');paintForm();sync()};
  dlg.addEventListener('cancel',e=>{if(busy)e.preventDefault()});

  window.__addSource=function(method){
    vals={};picked='';pickedName='';busy=false;
    const m=METHODS.find(x=>x.id===method)||METHODS[0];
    choose(m);setBusy(false);
    if(!dlg.open)dlg.showModal();
    const c=grid.querySelector('.as-c.on')||grid.firstChild;if(c)c.focus({preventScroll:true});
  };
})();
