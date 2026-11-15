/* ===== الإعدادات: قائمة خدمات، لكل خدمة شاشتها، والتنقل بالأسهم وOK ورجوع =====
   المصادر · إضافة مصدر · تعديل القنوات · البحث عن ملفات جديدة · مكتبة الأفلام · حول */
(function(){
  const st=$('st'),body=$('stb'),title=$('stt'),msg=$('stm'),A=window.Android;
  let stack=[],tt,pendingReviewCancel=null;
  const toast=t=>{msg.textContent=t||'';clearTimeout(tt);tt=setTimeout(()=>{msg.textContent=''},4000)};
  const user=()=>lists.filter(l=>l.id!==FAV_LIST_ID);
  const rowsEls=()=>[...body.querySelectorAll('.srow')];
  const focusIdx=()=>Math.max(0,rowsEls().indexOf(document.activeElement));

  /* ---------------- معاينة البث الحي أثناء التعديل ---------------- */
  const pvBox=$('stpv');
  let pvT=null,pvOn=false,pvUrl='',liveWas=null,wantPv=false;
  function placeV(){
    const r=pvBox.getBoundingClientRect(),s=$('v').style;
    s.position='fixed';s.left=r.left+'px';s.top=r.top+'px';s.width=r.width+'px';s.height=r.height+'px';s.zIndex='96';
  }
  function pvStart(){
    if(pvOn)return;
    pvOn=true;window.__previewing=true;
    liveWas=shown.find(i=>i.url===curUrl)||null;
    st.classList.add('pv');document.body.classList.add('stprev');
    placeV();
  }
  function pvPlay(it,now){
    if(!it||pvUrl===it.url)return;
    pvStart();clearTimeout(pvT);
    pvT=setTimeout(()=>{
      pvUrl=it.url;
      const sR=recs.slice(),sL=LS.get('m3u_last',null);       // المعاينة لا تغيّر «آخر قناة» ولا المشاهَدة مؤخراً
      play(it);
      recs=sR;LS.set('m3u_recs',sR);
      if(sL)LS.set('m3u_last',sL);
    },now?0:600);
  }
  function pvStop(){
    if(!pvOn)return;
    clearTimeout(pvT);pvOn=false;pvUrl='';
    st.classList.remove('pv');document.body.classList.remove('stprev');
    $('v').style.cssText='';window.__previewing=false;
    tok++;stopAll();
    if(liveWas&&document.body.classList.contains('rcv')){const it=liveWas;liveWas=null;play(it)}
  }
  window.addEventListener('resize',()=>{if(pvOn)placeV()});

  let sec='general',nf=false;
  function show(t,rows,keep){
    if(!wantPv)pvStop();wantPv=false;
    title.textContent=t;body.textContent='';body.classList.remove('about');
    rows.forEach(r=>{
      if(r.sep!==undefined){const d=document.createElement('div');d.className='sep';d.textContent=r.sep;body.appendChild(d);return}
      if(r.para!==undefined){const b=document.createElement('button');b.type='button';b.className='srow para'+(r.small?' small':'');b.innerHTML='<span class="sx"><b class="sl"></b></span>';b.querySelector('.sl').textContent=r.para;b.onclick=()=>{if(r.run)r.run()};body.appendChild(b);return}
      const b=document.createElement('button');b.type='button';b.className='srow'+(r.danger?' danger':'');
      b.innerHTML='<i></i><span class="sx"><b class="sl"></b><small class="ss"></small></span><em class="sc"></em>';
      b.children[0].textContent=r.icon||'';b.querySelector('.sl').textContent=r.label;b.querySelector('.ss').textContent=r.sub||'';
      const c=b.querySelector('.sc');
      if(r.on!==undefined){c.className='sc sw'+(r.on?' on':'');b.setAttribute('role','switch');b.setAttribute('aria-checked',r.on?'true':'false')}
      else if(r.val!==undefined)c.textContent=r.val+' ▾';
      else c.remove();
      b.onclick=()=>{if(r.run)r.run()};
      if(r.onfocus)b.addEventListener('focus',r.onfocus);
      body.appendChild(b);
    });
    navMark();
    const f=rowsEls()[keep||0];
    if(f&&!nf)f.focus({preventScroll:true});
    body.scrollTop=0;
    if(f&&!nf)f.scrollIntoView({block:'nearest'});
  }
  const SECS=[
    {id:'general',icon:'⚙',t:'عام',fn:general},
    {id:'playback',icon:'▶',t:'التشغيل',fn:playbackSec},
    {id:'appearance',icon:'🎨',t:'المظهر',fn:appearanceSec},
    {id:'sources',icon:'📂',t:'المصادر',fn:sources},
    {id:'channels',icon:'✎',t:'القنوات',fn:channelsSec},
    {id:'library',icon:'🎬',t:'المكتبة',fn:librarySec},
    {id:'storage',icon:'💾',t:'التخزين',fn:storageSec},
    {id:'backup',icon:'☁',t:'نسخ احتياطي',fn:backupSec},
    {id:'reset',icon:'↺',t:'إعادة تعيين',fn:resetSec},
    {id:'about',icon:'ℹ',t:'حول',fn:about}
  ];
  const navEl=$('stnav');
  SECS.forEach(x=>{
    const b=document.createElement('button');b.type='button';b.dataset.s=x.id;
    b.innerHTML='<i></i><span></span>';b.children[0].textContent=x.icon;b.children[1].textContent=x.t;
    const go=()=>{if(sec===x.id&&stack.length===1)return;sec=x.id;stack=[home];nf=true;try{home()}finally{nf=false}};
    b.addEventListener('focus',go);
    b.onclick=()=>{go();const f=rowsEls()[0];if(f)f.focus({preventScroll:true})};
    navEl.appendChild(b);
  });
  function navMark(){navEl.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.s===sec))}
  function push(fn){
    const cur=stack[stack.length-1];if(cur)cur.keep=focusIdx();
    stack.push(fn);fn();
  }
  function back(){
    if(pendingReviewCancel){
      const cancel=pendingReviewCancel;
      if(!cancel())return;
      pendingReviewCancel=null;
    }
    stack.pop();
    const f=stack[stack.length-1];
    if(f)f(f.keep);else close();
  }
  function rerender(){const f=stack[stack.length-1];if(f){f.keep=focusIdx();f(f.keep)}}
  function setTop(fn,keep){stack[stack.length-1]=fn;fn(keep)}
  function open(which){
    st.classList.add('on');sec=(which==='sources'||which==='addsource')?'sources':'general';stack=[home];home();
    if(which==='addsource')push(addScreen);
    if(!LS.get('m3u_tip_settings',false)){LS.set('m3u_tip_settings',true);toast('استخدم قسم المصادر لإدارة القوائم، وقسم التشغيل لضبط تجربة المشاهدة.')}
  }
  function close(){pvStop();st.classList.remove('on');stack=[];if(document.activeElement)document.activeElement.blur()}
  window.__openSettings=open;
  window.__stOn=()=>st.classList.contains('on');
  window.__stToast=toast;
  window.__stBack=function(){if(!st.classList.contains('on'))return false;back();return true};
  $('stback').onclick=()=>back();

  /* ---------------- الرئيسية ---------------- */
  function home(keep){(SECS.find(x=>x.id===sec)||SECS[0]).fn(keep)}
  function general(keep){
    const auto=LS.get('m3u_autoscan',true);
    show('عام',[
      {icon:'🔎',label:'البحث التلقائي عن الملفات',sub:'عند فتح التطبيق: التنزيلات · الوثائق · USB',on:auto,run:()=>{LS.set('m3u_autoscan',!auto);rerender()}},
      {icon:'📂',label:'اختيار مجلد للبحث فيه',sub:'للأجهزة التي تمنع الوصول المباشر',run:()=>{
        if(A&&A.pickFolder){window.__onFolder=ok=>{window.__onFolder=null;toast(ok?'تم حفظ المجلد':'')};A.pickFolder()}else toast('غير متاح على هذا الجهاز');
      }}
    ],keep);
  }
  function playbackSec(keep){
    const zap=$('zapsnd').checked,autoNext=LS.get('m3u_vod_autonext',true);
    show('التشغيل',[
      {icon:'🔊',label:'صوت التنقل بين القنوات',sub:'نغمة قصيرة عند تغيير القناة',on:zap,run:()=>{$('zapsnd').checked=!zap;LS.set('m3u_zap',!zap);rerender()}},
      {icon:'⏭',label:'تشغيل الحلقة التالية تلقائياً',sub:'بعد عدّ تنازلي 10 ثوانٍ',on:autoNext,run:()=>{LS.set('m3u_vod_autonext',!autoNext);rerender()}}
    ],keep);
  }
  function appearanceSec(keep){
    show('المظهر',[
      {icon:'🌗',label:'السمة البصرية',sub:'تلقائي · نهاري · ليلي',val:(MTXT[theme]||'').replace(/^\S+\s/,''),run:()=>{cycleTheme();rerender()}},
      {icon:'🔠',label:'حجم الواجهة',sub:'كبير · متوسط · صغير',val:window.densityLabel(),run:()=>{window.cycleDensity();rerender()}}
    ],keep);
  }
  function channelsSec(keep){
    const RS=[['both','الاسم + الرقم + الشعار'],['num','الاسم + الرقم'],['logo','الاسم + الشعار']],rcur=LS.get('m3u_rowstyle','both'),ri=Math.max(0,RS.findIndex(x=>x[0]===rcur));
    show('القنوات',[
      {icon:'🔤',label:'شكل صف القناة في القائمة',sub:'الاسم مع الرقم، أو مع الشعار، أو معاً',val:RS[ri][1],run:()=>{LS.set('m3u_rowstyle',RS[(ri+1)%RS.length][0]);rerender()}},
      {icon:'✎',label:'تعديل القنوات',sub:'الاسم · الرابط · المجموعة · الرقم · الترتيب · الحذف',run:()=>push(editorPick)},
      {icon:'🔎',label:'البحث عن ملفات جديدة',sub:'قوائم M3U جديدة على الجهاز',run:()=>push(scanScreen)}
    ],keep);
  }
  /* التخزين: وجهة ملفات التطبيق تظهر أولاً */
  function storageSec(keep){
    show('التخزين',[
      {sep:'وجهة الملفات'},
      {icon:'📍',label:'مجلد الملفات',sub:(A&&A.appDir)?A.appDir():'—',run:()=>{}},
      {para:'النسخ الاحتياطية وملفات التصدير تُحفظ في هذا المجلد.'}
    ],keep);
  }
  function librarySec(keep){
    show('المكتبة',[{icon:'🎬',label:'مكتبة الأفلام والمسلسلات',sub:'روابط الأفلام والمسلسلات فقط (لا البث المباشر)',run:()=>{close();window.__openVod()}}],keep);
  }
  function backupSec(keep){
    const rows=user().map(l=>({icon:'💾',label:'تصدير «'+l.name+'»',sub:(l.n||0)+' قناة · ملف M3U في مجلد التطبيق',run:()=>{
      const nm='wassla-backup-'+l.name+'-'+new Date().toISOString().slice(0,10)+'.m3u';
      const p=(A&&A.saveFile)?A.saveFile(nm,l.text||''):'';toast(p?'حُفظت النسخة: '+p:'تعذّر الحفظ');
    }}));
    rows.push({sep:'الاستيراد'},{icon:'📁',label:'استيراد من ملف',sub:'استرجاع نسخة احتياطية',run:pickLocal});
    show('نسخ احتياطي',rows,keep);
  }
  function resetSec(keep){
    const u=user().filter(l=>l.id!=='builtin');
    show('إعادة تعيين',[
      {icon:'📄',label:'قوائم M3U',sub:String(u.filter(l=>!l.xt).length),run:()=>{}},
      {icon:'☁',label:'حسابات Xtream',sub:String(u.filter(l=>l.xt).length),run:()=>{}},
      {icon:'🗑',label:'حذف المصادر المضافة',sub:'القائمة المدمجة تبقى كما هي',danger:true,run:()=>push(confirmAll)},
      {icon:'🗑',label:'حذف كل المصادر حتى المدمجة',sub:'يمكن استعادة المدمجة لاحقًا من «المصادر»',danger:true,run:()=>push(confirmAllFull)}
    ],keep);
  }
  function confirmAll(){
    show('تأكيد الحذف',[
      {icon:'🗑',label:'نعم، احذف كل المصادر المضافة نهائياً',danger:true,run:async()=>{
        for(const l of user().filter(x=>x.id!=='builtin'))await deleteList(l.id);
        toast('تم الحذف');stack=[home];home();
      }},
      {icon:'↩',label:'إلغاء',run:()=>back()}
    ],1);
  }

  function confirmAllFull(){
    show('تأكيد الحذف',[
      {icon:'🗑',label:'نعم، احذف كل المصادر حتى المدمجة',sub:'يمكن استعادة المدمجة لاحقًا',danger:true,run:async()=>{
        for(const l of user())await deleteList(l.id);
        toast('تم الحذف');stack=[home];home();
      }},
      {icon:'↩',label:'إلغاء',run:()=>back()}
    ],1);
  }

  /* ---------------- المصادر ---------------- */
  function sources(keep){
    const rows=user().map(l=>({
      icon:l.id===active?'✔':'📄',label:l.name,
      sub:(l.n||0)+' قناة'+(l.url?' · من رابط':''),
      run:()=>push(k=>source(l.id,k))
    }));
    rows.push({sep:''},{icon:'➕',label:'إضافة مصدر جديد',sub:'ملف · رابط M3U · Xtream',run:()=>push(addScreen)});
    if(user().length)rows.push({icon:'🗑',label:'حذف مصدر',sub:'اختر المصدر المراد حذفه (حتى المدمج)',danger:true,run:()=>push(delPick)});
    if(!lists.find(x=>x.id==='builtin')&&window.__chRestore)rows.push({icon:'↺',label:'استعادة القائمة المدمجة',sub:'القنوات المضمّنة مع التطبيق',run:async()=>{toast('جارٍ الاستعادة…');const ok=await window.__chRestore();toast(ok?'تمت الاستعادة':'تعذّر تحميل القائمة المدمجة');rerender()}});
    show('المصادر',rows,keep);
  }
  function delPick(keep){
    show('حذف مصدر — اختر',user().map(l=>({icon:'🗑',label:l.name,sub:(l.n||0)+' قناة'+(l.id==='builtin'?' · مدمج':''),danger:true,run:()=>push(k=>confirmDel(l.id,k))})),keep);
  }
  function source(id,keep){
    const l=lists.find(x=>x.id===id);if(!l){back();return}
    const rows=[
      {icon:'▶',label:'استعمال هذا المصدر',sub:l.id===active?'مفعّل الآن':'',run:()=>{openList(id);toast('تم تفعيل «'+l.name+'»');rerender()}},
      {icon:'✎',label:'إعادة التسمية',sub:l.name,run:async()=>{
        const v=await kbPrompt('اسم المصدر',l.name);
        if(v&&v.trim()){l.name=v.trim();await saveLists();fillLists();rerender()}
      }}
    ];
    if(l.xt)rows.push({icon:'⟳',label:'مراجعة تحديث Xtream',sub:l.xt.host,run:()=>reviewSourceUpdate(id)});
    if(l.url)rows.push({icon:'⟳',label:'مراجعة تحديث الرابط',sub:l.url,run:()=>reviewSourceUpdate(id)});
    if((sourceUndo.get(id)||[]).length)rows.push({icon:'↶',label:'تراجع عن آخر تعديل',sub:'استعادة حالة المصدر السابقة',run:async()=>{await undoSource(id);rerender()}});
    if(l.xt)rows.push({icon:'📄',label:'تصدير حساب Xtream إلى TXT',sub:'يتضمن بيانات تسجيل الدخول لهذا المصدر',run:()=>{
      if(!confirm('سيحتوي الملف على كلمة مرور هذا الحساب. احفظه في مكان آمن؟'))return;
      const text='host='+l.xt.host+'\nusername='+l.xt.u+'\npassword='+l.xt.p+'\nname='+l.name+'\n';
      const p=(A&&A.saveFile)?A.saveFile('wassla-xtream-'+id+'.txt',text):'';
      toast(p?'تم حفظ ملف الحساب: '+p:'تعذّر حفظ الملف');
    }});
    if(l.remoteText)rows.push({icon:'↩',label:'استعادة نسخة الخادم الأخيرة',sub:'إلغاء التعديلات المحلية لهذا المصدر فقط',run:()=>push(k=>confirmRestoreSource(id,k))});
    rows.push({icon:'✎',label:'تعديل قنوات هذا المصدر',sub:'بالمجموعات أو البحث',run:()=>push(k=>groupsScreen(id,k))});
    rows.push({sep:'الحذف'},{icon:'🗑',label:'حذف هذا المصدر',sub:id==='builtin'?'يمكن استعادته لاحقًا من «المصادر»':'',danger:true,run:()=>push(k=>confirmDel(id,k))});
    show('المصدر: '+l.name,rows,keep);
  }
  function confirmDel(id){
    const l=lists.find(x=>x.id===id);if(!l){back();return}
    show('تأكيد الحذف',[
      {icon:'🗑',label:'نعم، احذف «'+l.name+'» نهائياً',sub:id==='builtin'?'يمكن استعادتها لاحقًا من «المصادر»':'',danger:true,run:async()=>{await deleteList(id);toast('تم الحذف');stack.pop();back()}},
      {icon:'↩',label:'إلغاء',run:()=>back()}
    ],1);
  }
  function confirmRestoreSource(id,keep){
    const l=lists.find(x=>x.id===id);if(!l){back();return}
    show('استعادة نسخة الخادم؟',[
      {icon:'↩',label:'نعم، استعد آخر نسخة من الخادم',sub:'لن يتغير سجل المشاهدة أو المفضلة',danger:true,run:async()=>{
        const items=parseM3U(l.remoteText||'');
        if(!items.length){toast('لا توجد نسخة خادم صالحة للاستعادة');return}
        rememberSource(id,l.text);
        l.text=ser(items);l.n=items.length;l.upd=Date.now();
        await saveLists();
        if(active===id)openList(id);
        toast('تمت استعادة نسخة الخادم');back();
      }},
      {icon:'↩',label:'إلغاء',run:()=>back()}
    ],keep||0);
  }
  const wnote=(t,err)=>window.WasslaNotify?WasslaNotify(t,{err:!!err}):toast(t);
  /* تحديث المصدر: دمج مباشر يحفظ تعديلاتك، ثم إشعار بالنتيجة (بلا شاشة مراجعة) */
  async function reviewSourceUpdate(id){
    const l=lists.find(x=>x.id===id);if(!l){wnote('المصدر غير موجود',1);return false}
    wnote('جارٍ تحديث «'+l.name+'»…');
    let proposal;
    try{
      proposal=l.xt?await window.xtPreview(id):await window.__fetchListUpdate(id);
    }catch(e){wnote(e&&e.message?e.message:'تعذّر جلب التحديث',1);return false}
    const existing=new Set(parseM3U(l.text||'').map(it=>it.url));
    const added=proposal.items.filter(it=>!existing.has(it.url)).length;
    const localSnapshot=l.text;
    try{
      await window.__applyListUpdate(proposal,'merge');
      rememberSource(id,localSnapshot);
      const now=lists.find(x=>x.id===id)||l;
      wnote('تم تحديث «'+l.name+'»: '+added+' جديد، المجموع '+(now.n||0));
      if(st.classList.contains('on'))rerender();
      return true;
    }catch(e){wnote(e&&e.message?e.message:'تعذّر تطبيق التحديث',1);return false}
  }
  window.__openSourceUpdateReview=reviewSourceUpdate;

  /* ---------------- إضافة مصدر ---------------- */
  function addScreen(keep){
    show('إضافة مصدر',[
      {icon:'📁',label:'من ملف على الجهاز',sub:'M3U أو ملف txt لحساب Xtream',run:pickLocal},
      {icon:'🔗',label:'من رابط M3U',sub:'يُنزَّل ويُحفظ باسم تختاره',run:addUrl},
      {icon:'🔑',label:'حساب Xtream',sub:'السيرفر · المستخدم · كلمة السر',run:addXtream},
      {icon:'🔎',label:'بحث تلقائي عن الملفات',run:()=>push(scanScreen)}
    ],keep);
  }
  function pickLocal(){
    if(!A||!A.pickFile){toast('اختيار الملفات غير متاح هنا');return}
    window.__onPicked=async(ok,why)=>{
      window.__onPicked=null;
      if(!ok){toast(why==='nohandler'?'لا يوجد تطبيق ملفات على هذا الجهاز — استعمل الرابط أو «البحث التلقائي»':(why==='cancel'?'':'تعذّرت قراءة الملف'));return}
      const name=A.pickedName(),text=A.pickedText(),base=name.replace(/\.[^.]+$/,'');
      const nm=await kbPrompt('اسم هذا المصدر',base);
      if(nm===null)return;
      toast('جارٍ إضافة المصدر…');
      const added=await addList(text,nm.trim()||base,'');
      toast(added?'تمت إضافة «'+(nm.trim()||base)+'»':'الملف لا يحتوي قنوات صالحة');
      if(added){stack=[home];home()}
    };
    A.pickFile();
  }
  async function addUrl(){
    const u=((await kbPrompt('رابط القائمة (M3U أو M3U8)','http://','en'))||'').trim();
    if(!/^https?:\/\//i.test(u)){if(u)toast('الرابط يجب أن يبدأ بـ http أو https');return}
    toast('جارٍ التنزيل…');
    let text='';
    try{text=await getText(u)}catch(e){toast('تعذّر التنزيل من هذا الرابط');return}
    const host=(u.match(/^https?:\/\/([^\/:?#]+)/)||[])[1]||'قائمة';
    const nm=await kbPrompt('اسم هذا المصدر',host);
    if(nm===null)return;
    const ok=await addList(text,nm.trim()||host,u);
    toast(ok?'تمت الإضافة':'لا توجد قنوات صالحة في هذا الرابط');
    if(ok){stack=[home];home()}
  }
  async function addXtream(){
    const host=((await kbPrompt('عنوان السيرفر','http://','en'))||'').trim();if(!host)return;
    const user_=await kbPrompt('اسم المستخدم','','en');if(user_===null)return;
    const pass=await kbPrompt('كلمة السر','','en');if(pass===null)return;
    const nm=await kbPrompt('اسم هذا المصدر','Xtream');if(nm===null)return;
    toast('جارٍ الاتصال بالسيرفر… (قد يستغرق لحظات)');
    try{
      const prepared=await window.xtPrepare(host,user_.trim(),pass.trim());
      await reviewXtreamAccounts([{name:nm.trim()||'Xtream',prepared}],[]);
    }catch(e){toast(e&&e.message?e.message:'تعذّر الاتصال أو لا يوجد محتوى صالح')}
  }
  /* حسابات Xtream: تُضاف وتُفعَّل مباشرة، والفاشل يُذكر في الإشعار */
  async function reviewXtreamAccounts(accounts,failures){
    const failed=(failures||[]).slice(),names=[];
    for(const account of accounts){
      try{
        if(await window.xtAddPrepared(account.prepared,account.name))names.push(account.name);
        else failed.push({name:account.name,reason:'تعذّرت الإضافة'});
      }catch(e){failed.push({name:account.name,reason:'تعذّرت الإضافة'})}
    }
    if(names.length>1)wnote('تمت إضافة '+names.length+' حسابات، وفُعِّل آخرها');
    if(failed.length)wnote((names.length?'أُضيف '+names.length+' · ':'')+'تعذّر '+failed.length+': '+failed.map(f=>f.name).join('، '),!names.length);
    if(st.classList.contains('on')){stack=[home];home()}
    return names.length>0;
  }
  window.__reviewXtreamAccounts=reviewXtreamAccounts;

  /* ---------------- البحث عن ملفات جديدة ---------------- */
  function scanScreen(keep){
    const auto=LS.get('m3u_autoscan',true);
    show('البحث عن ملفات جديدة',[
      {icon:'🔎',label:'ابحث الآن',sub:'التنزيلات · الوثائق · USB · مجلد التطبيق',run:runScan},
      {icon:'📂',label:'اختيار مجلد للبحث فيه',sub:'للأجهزة التي تمنع الوصول المباشر',run:()=>{
        if(A&&A.pickFolder){window.__onFolder=ok=>{window.__onFolder=null;toast(ok?'تم حفظ المجلد — اضغط «ابحث الآن»':'')};A.pickFolder()}
        else toast('غير متاح على هذا الجهاز');
      }},
      {icon:auto?'☑':'☐',label:'البحث التلقائي عند فتح التطبيق',sub:auto?'مفعّل':'معطّل',run:()=>{LS.set('m3u_autoscan',!auto);rerender()}},
      {sep:'مجلد التطبيق — انسخ ملفاتك إليه بالكمبيوتر أو USB:'},
      {icon:'📍',label:(A&&A.appDir)?A.appDir():'—',run:()=>{}}
    ],keep);
  }
  async function runScan(){
    toast('جارٍ البحث…');
    const files=window.__scanFiles?await window.__scanFiles():[];
    if(!files.length){toast('لا توجد ملفات جديدة');return}
    push(k=>found(files,k));
  }
  function found(files,keep){
    const rows=files.map(f=>({icon:'📄',label:f.name,sub:Math.round(f.size/1024)+' ك.ب',run:async()=>{
      const ok=await window.__importFile(f,true);
      if(ok){
        toast('تمت إضافة «'+f.name+'»');
        files.splice(files.indexOf(f),1);
        if(files.length)rerender();else back();
      }else toast('لم تتم الإضافة');
    }}));
    rows.push({sep:''},{icon:'🙈',label:'تجاهل هذه الملفات',run:()=>{files.forEach(f=>window.__ignoreFile(f));toast('سيتم تجاهلها');back()}});
    show('ملفات جديدة ('+files.length+')',rows,keep);
  }

  /* ---------------- تعديل القنوات ---------------- */
  const PAGE=80;
  const numOfRaw=(it,i)=>{const m=it.raw&&/channel-number="(\d+)"/.exec(it.raw);return m?+m[1]:i+1};
  const itemsOf=id=>{const l=lists.find(x=>x.id===id);return l?parseM3U(l.text):[]};
  const isBuiltin=id=>id==='builtin'&&!!window.__chKey&&!!window.__chSetMany;
  const sourceUndo=new Map();
  function rememberSource(id,text){
    const history=sourceUndo.get(id)||[];
    if(history.length&&history[history.length-1].value===text)return;
    history.push({type:'text',value:text});
    if(history.length>20)history.shift();
    sourceUndo.set(id,history);
  }
  function rememberBuiltin(){
    const history=sourceUndo.get('builtin')||[];
    history.push({type:'builtin',value:LS.get('m3u_chov',{})});
    if(history.length>20)history.shift();
    sourceUndo.set('builtin',history);
  }
  async function undoSource(id){
    const l=lists.find(x=>x.id===id),history=sourceUndo.get(id)||[];
    if(!l||!history.length)return false;
    const entry=history.pop();
    if(entry.type==='builtin'){
      LS.set('m3u_chov',entry.value);
      if(window.__chReload)await window.__chReload();
    }else{
      l.text=entry.value;l.n=parseM3U(l.text).length;l.upd=Date.now();
      await saveLists();
      if(active===id)openList(id);
    }
    toast('تم التراجع عن آخر تعديل');
    return true;
  }
  function editorPick(keep){
    show('تعديل القنوات — اختر المصدر',user().map(l=>({
      icon:l.id===active?'✔':'📄',label:l.name,sub:(l.n||0)+' قناة',run:()=>push(k=>groupsScreen(l.id,k))
    })),keep);
  }
  /* شاشة المجموعات: بحث · كل القنوات · مجموعة بمجموعة (تعديل/إعادة تسمية/حذف) */
  function groupsScreen(id,keep){
    const l=lists.find(x=>x.id===id);if(!l){back();return}
    const its=itemsOf(id),m=new Map();
    its.forEach(it=>{const g=it.group||'';m.set(g,(m.get(g)||0)+1)});
    const rows=[
      {icon:'🔎',label:'بحث عن قناة',sub:'بالاسم',run:async()=>{const v=await kbPrompt('اسم القناة','');if(v&&v.trim())push(k=>editor(id,0,k,{q:v.trim()}))}},
      {icon:'☑',label:'تحديد جماعي',sub:'حذف · نقل · مفضلة · ترتيب',run:()=>{bsel.clear();push(k=>bulk(id,0,k))}},
      {icon:'📋',label:'كل القنوات',sub:its.length+' قناة',run:()=>push(k=>editor(id,0,k))},
      {sep:'المجموعات ('+m.size+')'}
    ];
    [...m.entries()].forEach(([g,n])=>rows.push({icon:'📁',label:g||'بدون مجموعة',sub:n+' قناة',run:()=>push(k=>groupMenu(id,g,k))}));
    show(l.name+' — '+its.length+' قناة',rows,keep);
  }
  function groupMenu(id,g,keep){
    const nm=g||'بدون مجموعة';
    show('المجموعة: '+nm,[
      {icon:'☑',label:'تحديد جماعي لقنوات المجموعة',sub:'حذف · نقل · مفضلة',run:()=>{bsel.clear();push(k=>bulk(id,0,k,{g}))}},
      {icon:'✎',label:'عرض وتعديل قنوات المجموعة',run:()=>push(k=>editor(id,0,k,{g}))},
      {icon:'🏷',label:'إعادة تسمية المجموعة',sub:nm,run:()=>renameGroup(id,g)},
      {sep:'الحذف'},
      {icon:'🗑',label:'حذف المجموعة بكل قنواتها',danger:true,run:()=>push(k=>confirmGroup(id,g,k))}
    ],keep);
  }
  async function renameGroup(id,g){
    const v=await kbPrompt('اسم المجموعة الجديد',g);if(v===null)return;
    const nv=v.trim().replace(/"/g,'');
    if(!nv){toast('اكتب اسمًا للمجموعة');return}
    const its=itemsOf(id);
    if(isBuiltin(id)){
      const p=[];its.forEach(it=>{if((it.group||'')===g){const k=window.__chKey(it);if(k!=null)p.push([k,{group:nv}])}});
      rememberBuiltin();
      if(!window.__chSetMany(p)){toast('تعذّر التعديل');return}
    }else{
      its.forEach(it=>{if((it.group||'')===g)setGroup(it,nv)});
      await saveItems(id,its);
    }
    toast('تمت إعادة التسمية');back();
  }
  function confirmGroup(id,g){
    const nm=g||'بدون مجموعة';
    show('حذف المجموعة «'+nm+'»؟',[
      {icon:'🗑',label:'نعم، احذف المجموعة وكل قنواتها',danger:true,run:async()=>{
        const its=itemsOf(id);
        if(isBuiltin(id)){
          const p=[];its.forEach(it=>{if((it.group||'')===g){const k=window.__chKey(it);if(k!=null)p.push([k,{deleted:true}])}});
          rememberBuiltin();
          if(!window.__chSetMany(p)){toast('تعذّر الحذف');return}
        }else{
          await saveItems(id,its.filter(it=>(it.group||'')!==g));
        }
        toast('تم الحذف');stack.pop();back();
      }},
      {icon:'↩',label:'إلغاء',run:()=>back()}
    ],1);
  }
  function editor(id,page,keep,flt){
    const l=lists.find(x=>x.id===id);if(!l){back();return}
    const its=itemsOf(id),q=flt&&flt.q!==undefined?String(flt.q).toLowerCase():'';
    const ents=its.map((it,i)=>({it,i})).filter(e=>!flt||(flt.g!==undefined?(e.it.group||'')===flt.g:(e.it.name||'').toLowerCase().includes(q)));
    const pages=Math.max(1,Math.ceil(ents.length/PAGE));
    page=Math.min(Math.max(0,page),pages-1);
    const rows=[{icon:'☑',label:'تحديد جماعي',sub:'حذف · نقل · مفضلة · ترتيب',run:()=>{bsel.clear();push(k=>bulk(id,0,k,flt))}},{icon:'💾',label:'حفظ نسخة احتياطية بهذا الترتيب',sub:'ملف M3U في مجلد التطبيق',run:()=>{
      const nm='wassla-backup-'+l.name+'-'+new Date().toISOString().slice(0,10)+'.m3u';
      const p=(A&&A.saveFile)?A.saveFile(nm,ser(its)):'';
      toast(p?'حُفظت النسخة: '+p:'تعذّر الحفظ');
    }}];
    if((sourceUndo.get(id)||[]).length)rows.push({icon:'↶',label:'تراجع عن آخر تعديل',sub:'استعادة حالة المصدر السابقة',run:async()=>{await undoSource(id);setTop(k=>editor(id,page,k,flt),keep||0)}});
    if(page>0)rows.push({icon:'◀',label:'الصفحة السابقة',sub:(page)+' / '+pages,run:()=>setTop(k=>editor(id,page-1,k,flt),1)});
    if(!ents.length)rows.push({sep:'لا توجد قنوات مطابقة'});
    const first=rows.length;
    ents.slice(page*PAGE,page*PAGE+PAGE).forEach(({it,i})=>{
      rows.push({icon:String(numOfRaw(it,i)),label:it.name,sub:it.group||'',run:()=>push(k=>chan(id,i,k)),onfocus:()=>pvPlay(it)});
    });
    if(page<pages-1)rows.push({icon:'▶',label:'الصفحة التالية',sub:(page+2)+' / '+pages,run:()=>setTop(k=>editor(id,page+1,k,flt),1)});
    wantPv=true;
    const fl=flt?(flt.g!==undefined?' · '+(flt.g||'بدون مجموعة'):' · بحث: '+flt.q):'';
    show(l.name+fl+' — '+ents.length+' قناة'+(pages>1?' (صفحة '+(page+1)+'/'+pages+')':''),rows,keep!=null?keep:first);
  }
  /* ---------------- تحديد جماعي: حذف · نقل لمجموعة · مفضلة · ترتيب ----------------
     يُؤشَّر على القنوات (☑/☐) ثم يُنفَّذ الإجراء على كل المحدد دفعة واحدة، والتراجع متاح بعد أي حذف أو نقل. */
  const bsel=new Set();let bfocus=null;   /* بعد التأشير يبقى التركيز على القناة نفسها مهما تغيّر عدد صفوف الإجراءات */
  function bsl(id){const its=itemsOf(id),idxs=[...bsel].filter(i=>i<its.length).sort((a,b)=>a-b);return {its,idxs}}
  function bulk(id,page,keep,flt){
    const l=lists.find(x=>x.id===id);if(!l){back();return}
    const its=itemsOf(id),q=flt&&flt.q!==undefined?String(flt.q).toLowerCase():'';
    const ents=its.map((it,i)=>({it,i})).filter(e=>!flt||(flt.g!==undefined?(e.it.group||'')===flt.g:(e.it.name||'').toLowerCase().includes(q)));
    const pages=Math.max(1,Math.ceil(ents.length/PAGE));
    page=Math.min(Math.max(0,page),pages-1);
    const n=[...bsel].filter(i=>i<its.length).length,pageEnts=ents.slice(page*PAGE,page*PAGE+PAGE),isB=isBuiltin(id);
    const rows=[];
    if((sourceUndo.get(id)||[]).length)rows.push({icon:'↶',label:'تراجع عن آخر تعديل',sub:'استعادة الحالة السابقة (حذف أو نقل)',run:async()=>{await undoSource(id);bsel.clear();rerender()}});
    rows.push({icon:'☑',label:'تحديد كل القنوات المعروضة',sub:ents.length+' قناة',run:()=>{ents.forEach(e=>bsel.add(e.i));rerender()}});
    if(pages>1)rows.push({icon:'☑',label:'تحديد قنوات هذه الصفحة فقط',sub:pageEnts.length+' قناة',run:()=>{pageEnts.forEach(e=>bsel.add(e.i));rerender()}});
    if(n)rows.push({icon:'☐',label:'إلغاء التحديد',sub:n+' محددة',run:()=>{bsel.clear();rerender()}});
    if(n){
      rows.push({sep:'إجراءات على المحدد ('+n+')'});
      rows.push({icon:'🗑',label:'حذف المحدد',sub:n+' قناة — يمكن التراجع بعدها',danger:true,run:async()=>{await bulkDelete(id);rerender()}});
      rows.push({icon:'📁',label:'نقل المحدد إلى مجموعة',run:()=>push(k=>bulkMove(id,k))});
      rows.push({icon:'★',label:'إضافة المحدد إلى المفضلة',run:()=>{bulkFav(id,true);rerender()}});
      rows.push({icon:'☆',label:'إزالة المحدد من المفضلة',run:()=>{bulkFav(id,false);rerender()}});
      if(!isB){
        rows.push({icon:'⤒',label:'نقل المحدد إلى أول القائمة',run:async()=>{await bulkOrder(id,true);rerender()}});
        rows.push({icon:'⤓',label:'نقل المحدد إلى آخر القائمة',run:async()=>{await bulkOrder(id,false);rerender()}});
      }
    }
    rows.push({sep:'القنوات — OK للتأشير'});
    if(page>0)rows.push({icon:'◀',label:'الصفحة السابقة',sub:page+' / '+pages,run:()=>setTop(k=>bulk(id,page-1,k,flt),1)});
    if(!ents.length)rows.push({sep:'لا توجد قنوات مطابقة'});
    pageEnts.forEach(({it,i})=>{
      rows.push({_i:i,icon:bsel.has(i)?'☑':'☐',label:it.name,sub:(it.group||'—')+(favs.has(it.url)?' · ★':''),run:()=>{if(bsel.has(i))bsel.delete(i);else bsel.add(i);bfocus=i;rerender()}});
    });
    if(page<pages-1)rows.push({icon:'▶',label:'الصفحة التالية',sub:(page+2)+' / '+pages,run:()=>setTop(k=>bulk(id,page+1,k,flt),1)});
    const fl=flt?(flt.g!==undefined?' · '+(flt.g||'بدون مجموعة'):' · بحث: '+flt.q):'';
    let pos=-1,cnt=0;
    rows.forEach(r=>{if(r.sep!==undefined)return;if(bfocus!==null&&bfocus!=='top'&&r._i===bfocus&&pos<0)pos=cnt;cnt++});
    let k=pos>=0?pos:(bfocus==='top'?0:(keep!=null?keep:0));
    bfocus=null;k=Math.max(0,Math.min(k,cnt-1));
    show('تحديد جماعي — '+n+' من '+ents.length+fl,rows,k);
  }
  async function bulkDelete(id){
    const {its,idxs}=bsl(id);if(!idxs.length)return;
    if(isBuiltin(id)){
      const p=[];idxs.forEach(i=>{const k=window.__chKey(its[i]);if(k!=null)p.push([k,{deleted:true}])});
      if(!p.length||!window.__chSetMany){toast('تعذّر الحذف');return}
      rememberBuiltin();window.__chSetMany(p);
    }else{
      const del=new Set(idxs);
      await saveItems(id,its.filter((_,i)=>!del.has(i)));
    }
    toast('تم حذف '+idxs.length+' قناة — «تراجع» في أول القائمة');
    bsel.clear();bfocus='top';
  }
  function bulkMove(id,keep){
    const its=itemsOf(id),m=new Map();
    its.forEach(it=>{const g=it.group||'';m.set(g,(m.get(g)||0)+1)});
    const rows=[{icon:'＋',label:'مجموعة جديدة…',sub:'اكتب الاسم',run:async()=>{
      const v=await kbPrompt('اسم المجموعة الجديدة','');
      if(v===null)return;
      const nv=v.trim().replace(/"/g,'');
      if(!nv){toast('اكتب اسمًا للمجموعة');return}
      await bulkSetGroup(id,nv);
    }},{sep:'أو اختر مجموعة موجودة'}];
    [...m.entries()].forEach(([g,c])=>rows.push({icon:'📁',label:g||'بدون مجموعة',sub:c+' قناة',run:()=>bulkSetGroup(id,g)}));
    show('نقل المحدد إلى…',rows,keep);
  }
  async function bulkSetGroup(id,g){
    const {its,idxs}=bsl(id);if(!idxs.length){back();return}
    if(isBuiltin(id)){
      const p=[];idxs.forEach(i=>{const k=window.__chKey(its[i]);if(k!=null)p.push([k,{group:g}])});
      if(!p.length||!window.__chSetMany){toast('تعذّر النقل');return}
      rememberBuiltin();window.__chSetMany(p);
    }else{
      idxs.forEach(i=>setGroup(its[i],g));
      await saveItems(id,its);
    }
    toast('تم نقل '+idxs.length+' قناة إلى «'+(g||'بدون مجموعة')+'»');
    back();
  }
  function bulkFav(id,add){
    const {its,idxs}=bsl(id);let c=0;
    idxs.forEach(i=>{const u=its[i].url;if(add&&!favs.has(u)){favs.add(u);c++}else if(!add&&favs.has(u)){favs.delete(u);c++}});
    LS.set('m3u_favs',[...favs]);syncFavList();render();
    toast(c?(add?'أُضيفت '+c+' قناة إلى المفضلة':'أُزيلت '+c+' قناة من المفضلة'):'لا تغيير');
  }
  async function bulkOrder(id,top){
    const {its,idxs}=bsl(id);if(!idxs.length)return;
    const set=new Set(idxs),pick=idxs.map(i=>its[i]),rest=its.filter((_,i)=>!set.has(i));
    await saveItems(id,top?pick.concat(rest):rest.concat(pick));
    bsel.clear();bfocus='top';toast(top?'نُقلت القنوات المحددة إلى أول القائمة':'نُقلت القنوات المحددة إلى آخر القائمة');
  }
  function chan(id,idx,keep){
    const l=lists.find(x=>x.id===id);if(!l){back();return}
    const its=parseM3U(l.text),it=its[idx];if(!it){back();return}
    const isB=id==='builtin'&&window.__chKey&&window.__chKey(it)!=null;
    const rows=[
      {icon:'✎',label:'الاسم',sub:it.name,run:()=>editField(id,idx,'name')},
      {icon:'🔗',label:'الرابط',sub:it.url,run:()=>editField(id,idx,'url')},
      {icon:'📁',label:'المجموعة',sub:it.group||'—',run:()=>editField(id,idx,'group')}
    ];
    if(isB)rows.push({icon:'🔢',label:'الرقم',sub:String(numOfRaw(it,idx)),run:()=>editField(id,idx,'num')});
    const fav=favs.has(it.url);
    rows.push({icon:fav?'★':'☆',label:fav?'إزالة من المفضلة':'إضافة إلى المفضلة',run:()=>{toggleFav(it.url);rerender()}});
    if(!isB){
      if(idx>0)rows.push({icon:'⬆',label:'نقل للأعلى',run:()=>move(id,idx,-1)});
      if(idx<its.length-1)rows.push({icon:'⬇',label:'نقل للأسفل',run:()=>move(id,idx,1)});
    }
    rows.push({icon:'🗑',label:'حذف القناة',danger:true,run:()=>push(k=>confirmChan(id,idx,k))});
    wantPv=true;
    show(it.name,rows,keep);
    pvPlay(it,true);
  }
  const setName=(it,v)=>{it.name=v;if(it.raw){const i=it.raw.lastIndexOf(',');it.raw=(i>-1?it.raw.slice(0,i):it.raw)+','+v}else it.raw='#EXTINF:-1,'+v};
  function setGroup(it,g){
    g=g.replace(/"/g,'');it.group=g;
    if(!it.raw)it.raw='#EXTINF:-1,'+it.name;
    if(/group-title="[^"]*"/.test(it.raw))it.raw=it.raw.replace(/group-title="[^"]*"/,'group-title="'+g+'"');
    else it.raw=it.raw.replace(/^#EXTINF:(-?\d+)/,'#EXTINF:$1 group-title="'+g+'"');
  }
  async function saveItems(id,its){
    const l=lists.find(x=>x.id===id);
    rememberSource(id,l.text);
    l.text=ser(its);l.n=its.length;l.upd=Date.now();
    await saveLists();
    if(active===id)openList(id);
  }
  async function editField(id,idx,field){
    const its=itemsOf(id),it=its[idx];if(!it)return;
    const ttl={name:'اسم القناة',url:'رابط القناة',group:'اسم المجموعة',num:'رقم القناة (من 1 إلى 9999)'}[field];
    const cur=field==='num'?String(numOfRaw(it,idx)):(it[field]||'');
    const v=await kbPrompt(ttl,cur,field==='url'?'en':(field==='num'?'sym':undefined));
    if(v===null)return;
    const val=v.trim();
    if(field==='num'){
      const n=parseInt(val,10);
      if(!(n>=1&&n<=9999)){toast('الرقم غير صالح');return}
      if(its.some((x,j)=>j!==idx&&numOfRaw(x,j)===n)){toast('هذا الرقم مستخدم لقناة أخرى');return}
      rememberBuiltin();
      window.__chSet(window.__chKey(it),{n});toast('تم تغيير الرقم');back();return;
    }
    if(field==='url'&&!/^https?:\/\//i.test(val)){toast('الرابط يجب أن يبدأ بـ http أو https');return}
    if(!val&&field!=='group'){toast('لا يمكن ترك هذا الحقل فارغاً');return}
    if(id==='builtin'&&window.__chKey&&window.__chKey(it)!=null){
      rememberBuiltin();
      window.__chSet(window.__chKey(it),{[field]:val});
    }else{
      if(field==='name')setName(it,val);else if(field==='group')setGroup(it,val);else it.url=val;
      await saveItems(id,its);
    }
    toast('تم الحفظ');rerender();
  }
  async function move(id,idx,d){
    const its=itemsOf(id),j=idx+d;
    if(j<0||j>=its.length)return;
    const t=its[idx];its[idx]=its[j];its[j]=t;
    await saveItems(id,its);
    setTop(k=>chan(id,j,k),focusIdx());
  }
  function confirmChan(id,idx){
    const its=itemsOf(id),it=its[idx];if(!it){back();return}
    show('حذف «'+it.name+'»؟',[
      {icon:'🗑',label:'نعم، احذف القناة',danger:true,run:async()=>{
        if(id==='builtin'&&window.__chKey&&window.__chKey(it)!=null){rememberBuiltin();window.__chSet(window.__chKey(it),{deleted:true})}
        else{its.splice(idx,1);await saveItems(id,its)}
        toast('تم الحذف');stack.pop();back();
      }},
      {icon:'↩',label:'إلغاء',run:()=>back()}
    ],1);
  }

  /* ---------------- حول ---------------- */
  const SITE='https://wasslatv.blogspot.com/';
  const DISCLAIMER='«وصلة TV» مشغّل وسائط فقط. لا يستضيف التطبيق ولا يبيع ولا يملك أي قنوات أو أفلام أو مسلسلات أو أي محتوى آخر. الروابط المدمجة مجمّعة من مصادر متاحة للعموم، وكل ما تضيفه من مصادر أو اشتراكات أو ملفات هو مسؤوليتك وحدك، وعليك التأكد من أن لك الحق في مشاهدته وفق قوانين بلدك. التطبيق مقدَّم «كما هو» دون أي ضمان لتوفر القنوات أو استمرارها. لطلب إزالة أي رابط مدمج تواصل معنا عبر موقع التطبيق.';
  const DZ='https://dzfastlink.blogspot.com/#';
  function openLink(u){
    if(A&&A.openUrl)A.openUrl(u);else window.open(u,'_blank');
  }
  function about(keep){
    show('حول التطبيق',[
      {icon:'▶',label:'وصلة TV',sub:'الإصدار '+((A&&A.version)?A.version():APP_VERSION),run:()=>{}},
      {icon:'🌐',label:'زيارة موقع التطبيق',sub:SITE,run:()=>openLink(SITE)},
      {sep:'إخلاء المسؤولية'},
      {para:DISCLAIMER},
      {para:'لاسترجاع نسخة احتياطية: إضافة مصدر ← من ملف، أو البحث التلقائي.'},
      {para:'جميع الحقوق محفوظة DZ-fastlink',small:true,run:()=>openLink(DZ)}
    ],keep);
    body.classList.add('about');   /* تخطيط مضغوط: كل المحتوى ظاهر بلا تحريك */
  }

  /* تعديل سريع لقناة من قائمة المشاهدة (INFO أو الزر الأصفر) */
  window.__editChannel=function(it){
    if(!it)return false;
    const ids=[active].concat(lists.map(l=>l.id)).filter((v,i,a)=>v&&v!==FAV_LIST_ID&&a.indexOf(v)===i);
    for(const id of ids){
      const its=itemsOf(id);
      let i=its.findIndex(x=>x.url===it.url&&x.name===it.name);
      if(i<0)i=its.findIndex(x=>x.url===it.url);
      if(i>=0){
        st.classList.add('on');sec='channels';
        stack=[k=>chan(id,i,k)];stack[0]();
        return true;
      }
    }
    return false;
  };
})();
