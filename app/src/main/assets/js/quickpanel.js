/* ===== القائمة السريعة = الواجهة الرئيسية: أيقونات كبيرة فوق البث ===== */
(function(){
  const el=$('qp'),row=$('qpr'),dd=$('qpdd'),hint=$('lhint');
  let on=false,idx=0,hT=null,ddOn=false,ddIdx=0,clkT=null,cnt=null,cntKey='';
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const pad=n=>String(n).padStart(2,'0');
  const userLists=()=>(lists||[]).filter(l=>l.id!==FAV_LIST_ID);
  const notify=(t,err)=>{if(window.WasslaNotify)WasslaNotify(t,{err:!!err})};

  /* عدّاد القنوات والأفلام للمصدر المفعّل (يُخزَّن حتى يتغير المصدر) */
  function counts(){
    const l=(lists||[]).find(x=>x.id===active);if(!l)return {live:0,vod:0};
    const key=l.id+':'+(l.upd||0)+':'+(l.n||0);
    if(cnt&&cntKey===key)return cnt;
    const c={live:0,vod:0};
    try{parseM3U(l.text).forEach(it=>{const k=detectKind(it);if(k==='movie'||k==='series')c.vod++;else c.live++})}catch(e){}
    cnt=c;cntKey=key;return c;
  }
  const srcName=()=>((lists||[]).find(l=>l.id===active)||{name:'لا يوجد مصدر'}).name;

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
  }

  /* ===== الأيقونات ===== */
  const items_=[
    {id:'ch',i:'📺',l:'القنوات',cls:'ch',sub:()=>counts().live+' قناة',
      run:()=>{close();if(window.__rcvOpen)__rcvOpen()}},
    {id:'src',i:'🛰',l:'المصدر',cls:'src',sub:()=>srcName(),
      run:()=>toggleDd()},
    {id:'vod',i:'🎬',l:'المكتبة',cls:'vod',sub:()=>counts().vod?counts().vod+' عنصر':'لا يوجد محتوى بعد',
      dim:()=>!counts().vod,
      run:()=>{if(!counts().vod){notify('لا توجد أفلام أو مسلسلات في هذا المصدر بعد');return}close();if(window.__openVod)__openVod()}},
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
    {id:'exit',i:'⏻',l:'خروج',cls:'exit',sub:()=>'',
      run:()=>{if(window.Android&&Android.exitApp)Android.exitApp()}}
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

  /* ===== قائمة المصادر المنسدلة ===== */
  function ddRows(){
    const r=userLists().map(l=>({id:l.id,name:l.name,sub:(l.n||0)+' قناة',cur:l.id===active}));
    r.push({add:true,name:'إضافة مصدر',sub:'ملف · رابط · Xtream'});
    return r;
  }
  function paintDd(){
    const rs=ddRows();dd.textContent='';
    rs.forEach((x,k)=>{
      const d=document.createElement('button');d.type='button';
      d.className='qd'+(x.add?' add':'')+(x.cur?' cur':'')+(k===ddIdx?' sel':'');
      d.innerHTML='<em></em><span class="qdn"></span><small class="qds"></small>';
      d.children[0].textContent=x.add?'＋':(x.cur?'✓':'');
      d.children[1].textContent=x.name;d.children[2].textContent=x.sub||'';
      d.onclick=()=>{ddIdx=k;pickDd()};
      dd.appendChild(d);
    });
    const s=dd.children[ddIdx];if(s)s.scrollIntoView({block:'nearest'});
  }
  function toggleDd(){
    if(ddOn){closeDd();paint();return}
    ddOn=true;dd.classList.add('on');
    const rs=ddRows();ddIdx=Math.max(0,rs.findIndex(x=>x.cur));
    paintDd();paint();
  }
  function pickDd(){
    const x=ddRows()[ddIdx];if(!x)return;
    if(x.add){close();if(window.__openSettings)__openSettings('addsource');return}
    if(x.id!==active)openList(x.id);       /* تفعيل فوري بلا تأكيد: العلامة ✓ تنتقل إلى المصدر */
    ddIdx=ddRows().findIndex(r=>r.id===x.id);
    paintDd();paint();syncMeta();
  }

  function open(){on=true;idx=0;ddOn=false;dd.classList.remove('on');el.classList.add('on');syncMeta();paint()}

  document.addEventListener('keydown',e=>{
    if(!on)return;
    if(document.querySelector('dialog[open]'))return;
    e.preventDefault();e.stopPropagation();
    const k=/^(OK|Select)$/.test(e.key)?'Enter':e.key,r=rtl(),next=r?'ArrowLeft':'ArrowRight',prev=r?'ArrowRight':'ArrowLeft';
    if(ddOn){
      const n=ddRows().length;
      if(k==='ArrowDown'){ddIdx=Math.min(n-1,ddIdx+1);paintDd()}
      else if(k==='ArrowUp'){if(ddIdx>0){ddIdx--;paintDd()}else{closeDd();paint()}}
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

  /* تلميح قصير للبث المباشر */
  function hintLive(){
    if(!hint)return;
    hint.textContent='↑ ↓ تغيير القناة   ·   OK قائمة القنوات   ·   رجوع: القائمة السريعة';
    hint.classList.add('on');clearTimeout(hT);hT=setTimeout(()=>hint.classList.remove('on'),6000);
  }
  /* رجوع واحد يغلق القائمة المنسدلة أولاً */
  window.__qpBack=()=>{if(on&&ddOn){closeDd();paint();return true}return false};
  window.__openQuick=open;window.__quickClose=close;window.__qpOn=()=>on;window.__hintLive=hintLive;
})();
