/* ===== الشاشة الافتتاحية: تبقى حتى يبدأ البث (أو 6 ثوانٍ كحد أقصى) ثم تُفتح القائمة السريعة كواجهة أولى ===== */
(function(){
  const sp=$('splash');if(!sp)return;
  const t0=performance.now();let done=false;
  function finish(){
    if(done)return;done=true;
    const wait=Math.max(0,1200-(performance.now()-t0));
    setTimeout(()=>{
      sp.classList.add('gone');
      if(window.__rcv&&!document.body.classList.contains('rcv'))window.__rcv.set(true,true);
      if(window.__openQuick)window.__openQuick();
      setTimeout(()=>{sp.style.display='none';if(!(window.__qpOn&&window.__qpOn())&&!(window.WasslaHome&&WasslaHome.isOn())&&window.__hintLive)window.__hintLive()},520);
    },wait);
  }
  $('v').addEventListener('playing',finish);
  window.__splashDone=finish;
  setTimeout(finish,6000);
})();
