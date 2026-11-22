// تحميل مكتبات التشغيل: النسخة المحلية أولاً (js/lib/) ثم الإنترنت (CDN) كاحتياط.
// يُتحقَّق من وجود المتغير العام فعلاً (Hls / mpegts) لا من نجاح تحميل الملف فقط،
// فلو كان الملف المحلي خاطئاً أو فارغاً يُحمَّل الاحتياطي تلقائياً.
(function(){
  var localBase=location.protocol==='file:'?'js/lib/':'/js/lib/';
  var L=[{g:'Hls',local:localBase+'hls.min.js',cdn:'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'},
         {g:'mpegts',local:localBase+'mpegts.min.js',cdn:'https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js'}];
  function configure(name){
    if(name==='mpegts'&&window.mpegts&&window.mpegts.LoggingControl){
      var lc=window.mpegts.LoggingControl;
      lc.enableAll=false;lc.enableError=false;lc.enableWarn=false;lc.enableInfo=false;lc.enableDebug=false;lc.enableVerbose=false;
    }
  }
  function load(src,done){
    var s=document.createElement('script'),finished=false,timer=setTimeout(function(){finish(false)},8000);
    function finish(ok){if(finished)return;finished=true;clearTimeout(timer);done(ok)}
    s.async=true;s.src=src;
    s.onload=function(){finish(true)};s.onerror=function(){finish(false)};
    document.head.appendChild(s);
  }
  window.__mediaLibraryPromises=Object.create(null);
  L.forEach(function(p){
    window.__mediaLibraryPromises[p.g]=new Promise(function(resolve){
      load(p.local,function(ok){
        if(ok&&window[p.g]){configure(p.g);resolve(true);return}
        load(p.cdn,function(cdnOk){configure(p.g);resolve(!!cdnOk&&!!window[p.g])});
      });
    });
  });
})();
