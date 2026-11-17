// تحميل مكتبات التشغيل: النسخة المحلية أولاً (js/lib/) ثم الإنترنت (CDN) كاحتياط.
// يُتحقَّق من وجود المتغير العام فعلاً (Hls / mpegts) لا من نجاح تحميل الملف فقط،
// فلو كان الملف المحلي خاطئاً أو فارغاً يُحمَّل الاحتياطي تلقائياً.
(function(){
  var L=[{g:'Hls',local:'js/lib/hls.min.js',cdn:'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'},
         {g:'mpegts',local:'js/lib/mpegts.min.js',cdn:'https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js'}];
  function load(src,done){
    var s=document.createElement('script');s.async=true;s.src=src;
    s.onload=function(){done(true)};s.onerror=function(){done(false)};
    document.head.appendChild(s);
  }
  L.forEach(function(p){
    load(p.local,function(ok){
      if(ok&&window[p.g])return;
      load(p.cdn,function(){});
    });
  });
})();
