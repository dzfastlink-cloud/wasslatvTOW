/* ===== غلاف أندرويد: الرجوع، تتبّع النمط، OK على القناة العاملة ===== */
(function(){
  if(!window.Android)return;
  const B=document.body,tv=Android.isTv();
  B.classList.add('android');
  if(tv)B.classList.add('tv');

  window.__zap=function(d){if(window.__caps){__caps.ch=true}if(window.__zapNum&&document.body.classList.contains('rcv'))__zapNum(d);else if(window.step)step(d)};

  /* OK على القناة التي تعمل = ملء الشاشة (وضع الريسيفر) */
  window.addEventListener('wassla:beforeplay',e=>{
    const it=e.detail&&e.detail.item;
    const inVod=window.__vodOn&&window.__vodOn();
    const same=it&&it.url===curUrl&&!$('v').paused&&!B.classList.contains('rcv')&&!inVod;
    if(tv&&same){e.preventDefault();window.setUIMode('rcv')}
  });
})();
