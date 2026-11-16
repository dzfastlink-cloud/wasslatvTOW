/* ===== القائمة السريعة: أول رجوع من البث ===== */
(function(){
  const el=$('qp'),row=$('qpr'),hint=$('lhint');
  let on=false,idx=0,hT=null;
  const close=()=>{on=false;el.classList.remove('on');hintLive()};
  const cnt=()=>window.__rcvCount?__rcvCount():0;
  const srcName=()=>{const l=(typeof lists!=='undefined'&&lists||[]).find(x=>x.id===active);return l?(l.id===FAV_LIST_ID?'المفضلة':l.name):''};
  const items=[
    {g:'nav',ic:'tv',l:'القنوات',sub:()=>cnt()?cnt()+' قناة':'',run:()=>{close();if(window.__rcvOpen)__rcvOpen()}},
    {g:'nav',ic:'dish',l:'المصادر',sub:srcName,run:()=>{close();if(window.__rcvOpenSources)__rcvOpenSources()}},
    {g:'nav',ic:'hash',l:'رقم القناة',sub:()=>window.__rcvNum?String(__rcvNum()||''):'',run:()=>{close();if(window.__rcvNumpad)__rcvNumpad()}},
    {g:'fav',ic:'star',l:'المفضلة',dyn:()=>curUrl&&favs.has(curUrl)?{f:1,l:'إزالة من المفضلة'}:{f:0,l:'أضف للمفضلة'},run:()=>{close();if(curUrl){toggleFav(curUrl);if(window.__rcvToast)__rcvToast(favs.has(curUrl)?'أُضيفت إلى المفضلة':'أُزيلت من المفضلة')}}},
    {g:'lib',ic:'film',l:'المكتبة',run:()=>{close();if(window.__openVod)__openVod()}},
    {g:'sys',ic:'sliders',l:'الإعدادات',run:()=>{close();if(window.__openSettings)__openSettings()}},
    {g:'out',ic:'power',l:'خروج',run:()=>{if(window.Android&&Android.exitApp)Android.exitApp()}}
  ];
  function paint(){
    row.textContent='';let pg=null;
    items.forEach((it,k)=>{
      const d=it.dyn?Object.assign({},it,it.dyn()):it;
      if(pg&&pg!==it.g){const s=document.createElement('div');s.className='qsep';row.appendChild(s)}pg=it.g;
      const b=document.createElement('div');b.className='qb'+(k===idx?' sel':'');b.dataset.g=it.g;
      b.innerHTML='<i></i><span></span><small></small>';
      b.children[0].innerHTML=WI.ico(d.ic,d.f?'f':'');b.children[1].textContent=d.l;
      let sub='';try{sub=d.sub?d.sub():''}catch(e){}
      b.children[2].textContent=sub;if(!sub)b.children[2].style.display='none';
      b.onclick=()=>{idx=k;it.run()};
      row.appendChild(b);
    });
  }
  function open(){on=true;idx=0;el.classList.add('on');paint()}
  document.addEventListener('keydown',e=>{
    if(!on)return;
    e.preventDefault();e.stopPropagation();
    const k=e.key,rtl=getComputedStyle(document.documentElement).direction==='rtl';
    const next=rtl?'ArrowLeft':'ArrowRight',prev=rtl?'ArrowRight':'ArrowLeft';
    if(k===next)idx=Math.min(items.length-1,idx+1);
    else if(k===prev)idx=Math.max(0,idx-1);
    else if(k==='Enter'){items[idx].run();return}
    paint();
  },true);

  /* تلميح قصير للبث المباشر */
  function hintLive(){
    if(!hint)return;
    hint.textContent='↑ ↓ تغيير القناة   ·   OK قائمة القنوات   ·   رجوع: القائمة السريعة';
    hint.classList.add('on');clearTimeout(hT);hT=setTimeout(()=>hint.classList.remove('on'),6000);
  }
  window.__openQuick=open;window.__quickClose=close;window.__qpOn=()=>on;window.__hintLive=hintLive;
})();
