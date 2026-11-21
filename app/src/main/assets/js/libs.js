(function(){
  const defs=[
    {global:'Hls',local:'js/lib/hls.min.js',cdn:'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'},
    {global:'mpegts',local:'js/lib/mpegts.min.js',cdn:'https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js'}
  ];
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');let settled=false;
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;s.onload=s.onerror=null;s.remove();
        reject(new Error('Timed out loading '+src));
      },10000);
      s.async=true;s.src=src;
      s.onload=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve()};
      s.onerror=()=>{if(settled)return;settled=true;clearTimeout(timer);reject(new Error('Failed to load '+src))};
      document.head.appendChild(s);
    });
  }
  window.WasslaPlayerEngines=window.WasslaVodPlayback.createEngineRegistry(
    defs,loadScript,name=>window[name]
  );
})();
