/* ===== شاشة السكون: تظهر خلفية العلامة ما دام لا يوجد بث يعمل ===== */
(function(){
  const B=document.body,v=$('v');
  B.classList.add('is-idle');
  v.addEventListener('playing',()=>B.classList.remove('is-idle'));
  ['emptied','error','ended'].forEach(e=>v.addEventListener(e,()=>B.classList.add('is-idle')));
  window.addEventListener('wassla:playrequest',e=>{
    const it=e.detail&&e.detail.item;
    if(it&&!(it.url===curUrl&&!v.paused))B.classList.add('is-idle');
  });
})();
