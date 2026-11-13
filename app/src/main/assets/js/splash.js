/* ===== الشاشة الافتتاحية: تبقى حتى يبدأ البث (أو 6 ثوانٍ كحد أقصى) ===== */
(function(){
  const sp=$('splash');if(!sp)return;
  const t0=performance.now();let done=false;
  function finish(){
    if(done)return;done=true;
    const wait=Math.max(0,1200-(performance.now()-t0));
    setTimeout(()=>{
      sp.classList.add('gone');
      if(window.WasslaHome&&WasslaHome.shouldShow())WasslaHome.open(true);
      setTimeout(()=>{sp.style.display='none';if(!(window.WasslaHome&&WasslaHome.isOn())&&window.__hintLive)window.__hintLive()},520);
    },wait);
  }
  $('v').addEventListener('playing',finish);
  window.__splashDone=finish;
  setTimeout(finish,6000);
})();
