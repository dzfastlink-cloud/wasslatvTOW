/* ===== القائمة السريعة = الواجهة الرئيسية: أيقونات كبيرة فوق البث ===== */
(function(){
  const el=$('qp'),row=$('qpr'),dd=$('qpdd'),hint=$('lhint');
  let on=false,idx=0,hT=null,ddOn=false,ddIdx=0,clkT=null,cnt=null,cntKey='';
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const pad=n=>String(n).padStart(2,'0');
  const userLists=()=>(lists||[]).filter(l=>l.id!==FAV_LIST_ID);
  const notify=(t,err)=>{if(window.WasslaNotify)WasslaNotify(t,{err:!!err})};

  /* عدّاد القنوات للمصادر المؤشّر عليها في القنوات، وعدّاد المكتبة لمصادرها المستقلة */
  function counts(){
    const all=userLists();
    const liveSel=window.__liveSources?window.__liveSources.getSelected():(active?[active]:[]);
    const vodSel=window.__vodSources?window.__vodSources.getSelected():null;
    const key=liveSel.join(',')+'|'+(vodSel?vodSel.join(','):'all')+'|'+all.map(x=>x.id+':'+(x.upd||0)+':'+(x.n||0)).join(',');
    if(cnt&&cntKey===key)return cnt;
    const c={live:0,vod:0};
    all.forEach(src=>{
      if(!liveSel.includes(src.id))return;
      try{parseM3U(src.text).forEach(it=>{const k=detectKind(it);if(k!=='movie'&&k!=='series')c.live++})}catch(e){}
    });
    if(window.__vodSources&&typeof window.__vodSources.count==='function'){
      c.vod=window.__vodSources.count();
    }else{
      const vodSet=vodSel?new Set(vodSel):null;
      all.forEach(src=>{
        if(src.id==='builtin')return;
        if(vodSet&&!vodSet.has(src.id))return;
        try{parseM3U(src.text).forEach(it=>{const k=detectKind(it);if(k==='movie'||k==='series')c.vod++})}catch(e){}
      });
    }
    cnt=c;cntKey=key;return c;
  }
  const srcName=()=>window.__liveSources?window.__liveSources.summary():((lists||[]).find(l=>l.id===active)||{name:'لا يوجد مصدر'}).name;

  const close=()=>{on=false;closeDd();el.classList.remove('on');clearInterval(clkT);hintLive()};
  function closeDd(){ddOn=false;dd.classList.remove('on');dd.textContent=''}

  function syncMeta(){
    const chEl=$('qpchannel'),clk=$('qpclk');
    if(chEl){
      const nm=curUrl?((shown.find(i=>i.url===curUrl)||items.find(i=>i.url===curUrl)||{}).name||''):'';
      chEl.textContent=nm?'يُعرض الآن: '+nm:'';chEl.style.display=nm?'':'none';
    }
    const tick=()=>{const d=new Date();if(clk)clk.textContent=pad(d.getHours())+':'+pad(d.getMinutes())+' · '+d.toLocaleDateString('ar-DZ',{weekday:'long',day:'numeric',month:'long'})};
    tick();clearInterval(clkT);clkT=setInterval(tick,20000);
    const hintBar=el.querySelector('.qph');
    if(hintBar){
      hintBar.textContent=ddOn
        ?'↑ ↓ تنقل · OK تأشير / إلغاء · رجوع: إغلاق قائمة المصادر'
        :'← → تنقل · OK فتح · رجوع / Esc: إغلاق';
    }
  }

  /* ===== الأيقونات ===== */
  const items_=[
    {id:'ch',i:'📺',l:'القنوات',cls:'ch',sub:()=>counts().live+' قناة',
      run:()=>{close();if(window.__rcvOpen)__rcvOpen()}},
    {id:'src',i:'🛰',l:'مصادر القنوات',cls:'src',sub:()=>srcName(),
      run:()=>toggleDd()},
    {id:'vod',i:'🎬',l:'المكتبة',cls:'vod',sub:()=>counts().vod?counts().vod+' عنصر':'تصفّح أو أضف مصدراً',
      dim:()=>false,
      run:()=>{close();if(window.__openVod)__openVod()}},
    {id:'fav',i:'★',l:'المفضلة',cls:'fav',sub:()=>favs.size?favs.size+' قناة':'فارغة',
      dim:()=>!favs.size,
      run:()=>{
        if(!favs.size){notify('لا توجد قنوات مفضلة بعد — اضغط مطوّلاً على OK فوق أي قناة في القائمة لإضافتها');return}
        close();if(window.__rcvOpenFav)__rcvOpenFav();
      }},
    {id:'num',i:'🔢',l:'رقم القناة',cls:'num',sub:()=>'انتقال مباشر',
      run:()=>{close();if(window.__rcvNumpad)__rcvNumpad()}},
    {id:'set',i:'⚙',l:'الإعدادات',cls:'set',sub:()=>'التشغيل والمظهر',
      run:()=>{close();if(window.__openSettings)__openSettings()}},
    {id:'exit',i:'⏻',l:'خروج',cls:'exit',sub:()=>window.Android?'':'العودة للبث',
      run:()=>{if(window.Android&&Android.exitApp)Android.exitApp();else close()}}
  ];

  function paint(){
    row.textContent='';
    items_.forEach((it,k)=>{
      const b=document.createElement('button');b.type='button';
      b.className='qb '+(it.cls||'')+(k===idx&&!ddOn?' sel':'')+(it.dim&&it.dim()?' dim':'')+(it.id==='src'&&ddOn?' open':'');
      b.innerHTML='<i></i><span class="ql"></span><small class="qs"></small>';
      b.children[0].textContent=it.i;b.children[1].textContent=it.l;b.children[2].textContent=it.sub?(it.sub()||''):'';
      b.onclick=()=>{idx=k;paint();it.run()};
      row.appendChild(b);
    });
    const s=row.children[idx];if(s&&!ddOn)s.scrollIntoView({block:'nearest',inline:'nearest'});
  }

  /* ===== قائمة مصادر القنوات (تأشير متعدد مستقل عن المكتبة) ===== */
  function liveCands(){
    if(window.__liveSources)return window.__liveSources.candidates();
    return userLists().map(l=>({id:l.id,name:l.name,liveCount:l.n||0}));
  }
  function ddRows(){
    const cands=liveCands();
    const selSet=new Set(window.__liveSources?window.__liveSources.getSelected():(active?[active]:[]));
    const allChecked=cands.length>0&&cands.every(c=>selSet.has(c.id));
    const r=[];
    if(cands.length>1){
      r.push({toggleAll:true,allChecked,name:allChecked?'إلغاء تحديد كل مصادر القنوات':'تحديد كل مصادر القنوات',sub:selSet.size+' من '+cands.length});
    }
    cands.forEach(c=>{
      r.push({id:c.id,chk:true,name:c.name,sub:c.liveCount+' قناة',cur:selSet.has(c.id)});
    });
    r.push({add:true,name:'إضافة مصدر جديد',sub:'ملف · رابط · Xtream'});
    return r;
  }
  function paintDd(){
    const rs=ddRows();dd.textContent='';
    const head=document.createElement('div');head.className='qpdd-head';
    head.innerHTML='<span>📺 مصادر القنوات (تأشير متعدد)</span><small>مستقلة عن المكتبة</small>';
    dd.appendChild(head);
    rs.forEach((x,k)=>{
      const d=document.createElement('button');d.type='button';
      d.className='qd'+(x.add?' add':'')+(x.toggleAll?' all-toggle':'')+(x.cur?' cur':'')+(k===ddIdx?' sel':'');
      d.setAttribute('aria-pressed',x.cur?'true':'false');
      const mark=document.createElement('span');
      mark.className=x.chk?'qd-chk'+(x.cur?' on':''):'qd-ico';
      mark.textContent=x.chk?(x.cur?'✓':''):(x.add?'＋':(x.allChecked?'☑':'☐'));
      const nm=document.createElement('span');nm.className='qdn';nm.textContent=x.name;
      const sb=document.createElement('small');sb.className='qds';sb.textContent=x.sub||'';
      d.append(mark,nm,sb);
      d.onclick=()=>{ddIdx=k;pickDd()};
      dd.appendChild(d);
    });
    const btns=dd.querySelectorAll('.qd');
    const s=btns[ddIdx];if(s)s.scrollIntoView({block:'nearest'});
  }
  function toggleDd(){
    if(ddOn){closeDd();syncMeta();paint();return}
    ddOn=true;dd.classList.add('on');
    const rs=ddRows();
    const firstCur=rs.findIndex(x=>x.cur);
    ddIdx=firstCur>=0?firstCur:0;
    syncMeta();paintDd();paint();
  }
  function pickDd(){
    const rs=ddRows(),x=rs[ddIdx];if(!x)return;
    if(x.add){close();if(window.__openSettings)__openSettings('addsource');return}
    if(x.toggleAll){
      if(window.__liveSources){
        if(x.allChecked)window.__liveSources.clear();
        else window.__liveSources.selectAll();
      }
      cnt=null;paintDd();paint();syncMeta();
      return;
    }
    if(window.__liveSources){
      window.__liveSources.toggle(x.id);
    }else if(x.id!==active){
      openList(x.id);
    }
    cnt=null;
    paintDd();paint();syncMeta();
  }

  function open(){on=true;idx=0;ddOn=false;dd.classList.remove('on');el.classList.add('on');cnt=null;syncMeta();paint()}

  document.addEventListener('keydown',e=>{
    if(!on)return;
    if(document.querySelector('dialog[open]'))return;
    e.preventDefault();e.stopPropagation();
    const k=/^(OK|Select)$/.test(e.key)?'Enter':e.key,r=rtl(),next=r?'ArrowLeft':'ArrowRight',prev=r?'ArrowRight':'ArrowLeft';
    if(ddOn){
      const n=ddRows().length;
      if(k==='ArrowDown'){ddIdx=Math.min(n-1,ddIdx+1);paintDd()}
      else if(k==='ArrowUp'){if(ddIdx>0){ddIdx--;paintDd()}else{closeDd();syncMeta();paint()}}
      else if(k==='Enter'){if(!e.repeat)pickDd()}
      return;
    }
    if(k===next)idx=Math.min(items_.length-1,idx+1);
    else if(k===prev)idx=Math.max(0,idx-1);
    else if(k==='Home')idx=0;
    else if(k==='End')idx=items_.length-1;
    else if(k==='ArrowDown'&&items_[idx].id==='src'){toggleDd();return}
    else if(k==='Enter'){if(!e.repeat)items_[idx].run();return}
    paint();
  },true);

  document.addEventListener('wassla:lists-changed',()=>{cnt=null;if(on){if(ddOn)paintDd();paint();syncMeta()}});

  /* تلميح قصير للبث المباشر */
  function hintLive(){
    if(!hint)return;
    hint.textContent='↑ ↓ تغيير القناة   ·   OK قائمة القنوات   ·   رجوع: القائمة السريعة';
    hint.classList.add('on');clearTimeout(hT);hT=setTimeout(()=>hint.classList.remove('on'),6000);
  }
  /* رجوع واحد يغلق القائمة المنسدلة أولاً */
  window.__qpBack=()=>{if(on&&ddOn){closeDd();syncMeta();paint();return true}return false};
  window.__openQuick=open;window.__quickClose=function(dismiss){close();if(dismiss&&window.__restoreCtx)window.__restoreCtx()};window.__qpOn=()=>on;window.__hintLive=hintLive;
})();
