/* ===== إشعار عام فوق كل الشاشات + توافق مع الاسم القديم WasslaHome =====
   الشاشة الرئيسية القديمة أُلغيت: القائمة السريعة (quickpanel.js) هي الرئيسية الآن. */
(function(){
  const nt=$('wnotify');let nT=null;
  window.WasslaNotify=function(text,opt){
    if(!nt)return;
    nt.textContent=text||'';nt.classList.toggle('err',!!(opt&&opt.err));nt.classList.add('on');
    clearTimeout(nT);nT=setTimeout(()=>nt.classList.remove('on'),(opt&&opt.ms)||4500);
  };
  window.WasslaHome={
    register(){},
    open(){if(window.__openQuick)__openQuick()},
    close(){if(window.__quickClose)__quickClose()},
    isOn:()=>false,
    shouldShow:()=>false
  };
  window.__homeOn=()=>false;
})();
