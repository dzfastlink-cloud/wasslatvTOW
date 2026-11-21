/* ===== حالة انتظار البث والتوقف: لا نغيّر القناة تلقائياً ولا نتدخل في انتهاء أفلام المكتبة ===== */
(function(){
  const box=$('ldg'),v=$('v'),nm=$('ldgn'),st=$('ldgs'),lg=$('ldgl'),hintEl=box?box.querySelector('.ldh'):null,nextBtn=$('ldgx'),backBtn=$('ldgb');
  let cur=null,slow=null,gone=null,stallTimer=null,watchdog=null,lastTime=0,lastAdvance=0,hasPlayed=false,autoReconnectUsed=false;
  const isVod=()=>!!(window.__vodOn&&window.__vodOn());
  const clearWait=()=>{clearTimeout(slow);clearTimeout(gone);clearTimeout(stallTimer);slow=gone=stallTimer=null};
  const hide=()=>{
    box.classList.remove('on','bad');
    clearWait();
  };
  function syncLabels(){
    const vod=isVod();
    if(hintEl)hintEl.style.display=vod?'none':'';
    if(nextBtn)nextBtn.style.display=vod?'none':'';
    if(backBtn)backBtn.textContent=vod?'↩ رجوع للتفاصيل':'↩ رجوع للقنوات';
  }
  function bad(msg){
    clearWait();
    syncLabels();
    st.textContent=msg;
    box.classList.add('on','bad');
  }
  function failed(msg){
    if(!cur)return;
    if(isVod()){bad(msg);return}
    if(autoReconnectUsed){if(!gone)bad(msg);return}
    autoReconnectUsed=true;
    st.textContent='جارٍ إعادة الاتصال تلقائيًا…';
    const it=cur;
    show(it);
    play(it);
  }
  function show(it){
    if(!cur||cur.url!==it.url)autoReconnectUsed=false;
    cur=it;hasPlayed=false;lastTime=0;lastAdvance=Date.now();
    syncLabels();
    nm.textContent=it.name;
    if(it.logo){lg.src=it.logo;lg.style.display=''}else lg.style.display='none';
    st.textContent='';
    box.classList.remove('bad');box.classList.add('on');
    clearWait();
    const vod=isVod();
    slow=setTimeout(()=>{if(box.classList.contains('on')&&!box.classList.contains('bad'))st.textContent='الاتصال بطيء…';},vod?10000:12000);
    gone=setTimeout(()=>{gone=null;failed(vod?'تعذّر تشغيل المحتوى':'تعذّر تشغيل القناة')},vod?18000:(autoReconnectUsed?12000:8000));
  }
  lg.onerror=()=>{lg.style.display='none'};
  v.addEventListener('playing',()=>{
    hasPlayed=true;lastTime=v.currentTime;lastAdvance=Date.now();hide();
  });
  function buffering(){
    if(!cur||v.paused||v.ended||v.seeking)return;
    clearTimeout(stallTimer);
    stallTimer=setTimeout(()=>{
      if(cur&&!v.paused&&!v.ended&&!v.seeking&&v.readyState<3)failed(isVod()?'تعذّر استكمال التشغيل':'توقف البث');
    },isVod()?15000:10000);
  }
  v.addEventListener('waiting',buffering);
  v.addEventListener('stalled',buffering);
  v.addEventListener('error',()=>{if(cur&&!window.__playTrying)failed(isVod()?'تعذّر تشغيل المحتوى':'تعذّر تشغيل القناة')});
  v.addEventListener('ended',()=>{
    if(!cur)return;
    if(isVod()){hide();return}
    failed('انتهى البث');
  });
  v.addEventListener('timeupdate',()=>{
    if(!cur||v.paused||v.ended)return;
    if(v.currentTime!==lastTime){lastTime=v.currentTime;lastAdvance=Date.now();}
  });
  watchdog=setInterval(()=>{
    if(!cur||!hasPlayed||v.paused||v.ended||v.seeking||box.classList.contains('bad'))return;
    if(Date.now()-lastAdvance>(isVod()?22000:15000))failed(isVod()?'توقف التشغيل':'توقف البث');
  },3000);
  const _p=play;
  play=function(it){
    if(!(it&&it.url===curUrl&&!v.paused))show(it);
    return _p(it);
  };
  const _m=window.setMsg;
  window.setMsg=function(t,err){
    _m(t,err);
    if(err&&box.classList.contains('on'))bad(t||(isVod()?'تعذّر تشغيل المحتوى':'تعذّر تشغيل القناة'));
  };
  $('ldgr').onclick=()=>{if(cur){autoReconnectUsed=false;show(cur);play(cur)}};
  $('ldgb').onclick=()=>{
    hide();
    if(isVod()&&window.__vodBack){window.__vodBack();return}
    if(window.__rcvOpen)window.__rcvOpen();
    else if(window.__openQuick)window.__openQuick();
  };
  window.__ldgBad=()=>box.classList.contains('bad');
  window.__ldgRetry=()=>{if(cur)play(cur)};
  window.__ldgHide=()=>{cur=null;hide()};
  $('ldgx').onclick=()=>{if(!isVod()&&typeof window.step==='function')step(1)};
  window.addEventListener('beforeunload',()=>clearInterval(watchdog),{once:true});
})();
