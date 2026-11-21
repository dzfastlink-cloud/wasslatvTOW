/* ===== النمط الوحيد: الريسيفر المباشر + صوت التنقل (أنماط TiviMate وSmarters والكلاسيكي حُذفت) ===== */
(function(){
  const zs=$('zapsnd');let ac=null;
  function beep(){
    try{
      ac=ac||new(window.AudioContext||window.webkitAudioContext)();
      const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;
      o.type='sine';o.frequency.value=1400;
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.09);
      o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.1);
    }catch(e){}
  }
  window.setUIMode=function(m,silent){
    const mode=window.WasslaVodPlayback.resolveUIMode(m);
    if(!mode)throw new RangeError('Unsupported UI mode: '+m);
    window.__rcv.set(mode==='rcv',silent);
    LS.set('m3u_mode',mode);
    return mode;
  };
  zs.checked=LS.get('m3u_zap',true);zs.onchange=e=>LS.set('m3u_zap',e.target.checked);
  window.addEventListener('wassla:playrequest',e=>{
    if(e.detail&&e.detail.item&&zs.checked&&!window.__previewing&&performance.now()>4000)beep();
  });
  const saved=LS.get('m3u_mode',LS.get('m3u_rcv',true)?'rcv':'home');
  window.setUIMode(saved==='home'?'home':'rcv',true);
})();
