/* ===== WasslaPlayer: مشغّل أفلام ومسلسلات مستقل =====
   • طبقة مستقلة فوق التطبيق كله: عنصر <video> خاص به، لا يشارك #player ولا محرك البث المباشر.
   • المكتبة (vod.js) تستدعي WasslaPlayer.open({...}) وتستقبل onProgress/onPrev/onNext/onClose فقط.
   • المحركات: native ثم hls.js ثم mpegts.js (المكتبات الموجودة في js/lib) مع تبديل تلقائي عند الفشل أو التقطّع.
   • الواجهة بالنمط المعروف (شريط تقدم، تشغيل/إيقاف، ±10 ث، الصوت، السرعة، الإعدادات، PiP، ملء الشاشة) ومتوافقة مع الريموت واللمس والماوس. */
(function(){
  'use strict';
  const Pb=window.WasslaVodPlayback||null;
  const pref=(k,d)=>{try{return typeof LS!=='undefined'?LS.get(k,d):d}catch(e){return d}};
  const setPref=(k,v)=>{try{if(typeof LS!=='undefined')LS.set(k,v)}catch(e){}};
  const ic=(d,extra)=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+d+'"/>'+(extra||'')+'</svg>';
  const IC={
    play:ic('M8 5v14l11-7z'),
    pause:ic('M6 19h4V5H6v14zm8-14v14h4V5h-4z'),
    replay:ic('M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z'),
    prev:ic('M6 6h2v12H6zm3.5 6l8.5 6V6z'),
    next:ic('M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z'),
    back10:ic('M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z')+'<b class="wp-n">10</b>',
    fwd10:ic('M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z')+'<b class="wp-n">10</b>',
    vol:ic('M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z'),
    mute:ic('M3 9v6h4l5 5V4L7 9H3z','<path d="M16 9l5 6m0-6l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
    gear:ic('M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z'),
    pip:ic('M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z'),
    fs:ic('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'),
    fsx:ic('M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z'),
    back:ic('M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4L16.2 13H4z'),
    chev:ic('M15.4 7.4L14 6l-6 6 6 6 1.4-1.4L10.8 12z'),
    check:ic('M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z')
  };
  const SPEEDS=[0.5,0.75,1,1.25,1.5,2];
  const FITS=[['contain','ملائم للشاشة'],['cover','ملء الشاشة (قص الأطراف)'],['fill','تمديد']];
  const ENGINES=[['auto','تلقائي'],['native','النظام (Native)'],['hls','HLS'],['mpegts','MPEG-TS']];
  const ENG_LABEL={native:'NATIVE',hls:'HLS',mpegts:'TS'};

  function fmt(s){
    s=Math.max(0,Math.floor(Number.isFinite(s)?s:0));
    const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
    return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(x).padStart(2,'0');
  }
  function errText(code){
    if(code===403)return 'رفض السيرفر الاتصال بهذا الرابط (403). قد يكون محظورًا أو منتهي الصلاحية.';
    if(code===401)return 'بيانات الدخول لهذا الرابط غير صالحة أو منتهية (401).';
    if(code===404||code===410)return 'المحتوى غير متاح حاليًا على السيرفر ('+code+').';
    return 'تعذّر تشغيل هذا المحتوى. قد يكون الرابط متوقفًا أو بصيغة لا يدعمها الجهاز.';
  }

  let root=null,video=null,E={},built=false;
  let o=null,isOpen=false,tok=0,hls=null,mp=null,engine='',started=false,forced='auto',order=[];
  let zone='bar',zi=0,idleT=null,progT=null,stallT=null,busyT=null,hintT=null,flashT=null,pend=0,pendT=null,repeatN=0,lastSeekAt=0;
  let menu=null,menuIdx=0,msgOn=false,nextOn=false,nextDismissed=false,ended=false,lastTap=0,lastPtr='mouse',drag=false,hlsRecovered=false;
  let fsByUs=false;

  /* ---------- البناء ---------- */
  function btn(a,label,icon,extra){return '<button type="button" class="wp-btn'+(extra?' '+extra:'')+'" data-a="'+a+'" aria-label="'+label+'" title="'+label+'">'+icon+'</button>'}
  function build(){
    if(built)return;built=true;
    root=document.createElement('div');root.id='wp';root.className='wp';root.hidden=true;
    root.setAttribute('role','dialog');root.setAttribute('aria-label','مشغّل الفيديو');root.dataset.fit='contain';
    root.innerHTML=
      '<video class="wp-v" playsinline preload="auto"></video>'+
      '<div class="wp-shade t"></div><div class="wp-shade b"></div>'+
      '<div class="wp-top">'+btn('close','رجوع',IC.back,'wp-back')+
        '<div class="wp-ttl"><b></b><small></small></div><span class="wp-eng" hidden></span></div>'+
      '<div class="wp-center"><div class="wp-spin"></div><button type="button" class="wp-big" data-a="play" aria-label="تشغيل">'+IC.play+'</button><div class="wp-flash"></div></div>'+
      '<div class="wp-hint"></div>'+
      '<div class="wp-msg" hidden><p></p><div class="wp-msg-b">'+
        '<button type="button" class="wp-pill" data-a="retry">إعادة المحاولة</button>'+
        '<button type="button" class="wp-pill" data-a="switch">تبديل المحرّك</button>'+
        '<button type="button" class="wp-pill" data-a="close">إغلاق</button></div></div>'+
      '<div class="wp-next" hidden><small>الحلقة التالية</small><b></b><div class="wp-next-bar"><i></i></div>'+
        '<div class="wp-next-b"><button type="button" class="wp-pill pri" data-a="nextnow">التشغيل الآن</button>'+
        '<button type="button" class="wp-pill" data-a="nextcancel">إلغاء</button></div></div>'+
      '<div class="wp-bar">'+
        '<div class="wp-seek" role="slider" aria-label="شريط التقدم" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">'+
          '<div class="wp-track"><i class="wp-buf"></i><i class="wp-fill"></i></div><i class="wp-knob"></i><span class="wp-tip"></span></div>'+
        '<div class="wp-row"><div class="wp-g">'+
          btn('play','تشغيل / إيقاف مؤقت',IC.play,'wp-pp')+btn('prev','الحلقة السابقة',IC.prev,'wp-prev')+btn('next','الحلقة التالية',IC.next,'wp-nx')+
          btn('back10','رجوع 10 ثوانٍ',IC.back10)+btn('fwd10','تقديم 10 ثوانٍ',IC.fwd10)+
          '<span class="wp-vw">'+btn('mute','كتم الصوت',IC.vol,'wp-mute')+'<input class="wp-vol" type="range" min="0" max="1" step="0.05" value="1" aria-label="مستوى الصوت"></span>'+
          '<span class="wp-time">0:00 / 0:00</span></div>'+
        '<div class="wp-g">'+btn('settings','الإعدادات',IC.gear)+btn('pip','صورة داخل صورة',IC.pip,'wp-pipb')+btn('fs','ملء الشاشة',IC.fs,'wp-fsb')+'</div></div></div>'+
      '<div class="wp-menu" hidden></div>';
    document.body.appendChild(root);
    video=root.querySelector('.wp-v');
    E={
      title:root.querySelector('.wp-ttl b'),sub:root.querySelector('.wp-ttl small'),eng:root.querySelector('.wp-eng'),
      pp:root.querySelector('.wp-pp'),prev:root.querySelector('.wp-prev'),next:root.querySelector('.wp-nx'),
      mute:root.querySelector('.wp-mute'),vol:root.querySelector('.wp-vol'),time:root.querySelector('.wp-time'),
      seek:root.querySelector('.wp-seek'),fill:root.querySelector('.wp-fill'),buf:root.querySelector('.wp-buf'),knob:root.querySelector('.wp-knob'),tip:root.querySelector('.wp-tip'),
      big:root.querySelector('.wp-big'),flash:root.querySelector('.wp-flash'),hint:root.querySelector('.wp-hint'),
      msg:root.querySelector('.wp-msg'),menu:root.querySelector('.wp-menu'),nextc:root.querySelector('.wp-next'),
      pip:root.querySelector('.wp-pipb'),fs:root.querySelector('.wp-fsb')
    };
    const droid=!!window.Android;
    if(droid||!document.pictureInPictureEnabled)E.pip.hidden=true;
    if(droid||!root.requestFullscreen)E.fs.hidden=true;
    wire();
  }

  /* ---------- الأحداث ---------- */
  function wire(){
    root.addEventListener('pointerdown',e=>{lastPtr=e.pointerType||'mouse'});
    root.addEventListener('pointermove',()=>{if(isOpen)poke()});
    root.addEventListener('click',onClick);
    root.addEventListener('dblclick',e=>{if(lastPtr==='mouse'&&!e.target.closest('.wp-bar,.wp-top,.wp-menu,.wp-msg,.wp-next'))toggleFs()});
    // شريط التقدم: سحب بالماوس/اللمس
    const seek=E.seek;
    const ratioAt=e=>{const r=seek.getBoundingClientRect();return r.width>0?Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)):0};
    seek.addEventListener('pointerdown',e=>{
      if(!Number.isFinite(video.duration))return;
      drag=true;seek.classList.add('drag');try{seek.setPointerCapture(e.pointerId)}catch(_){}
      previewAt(ratioAt(e));e.preventDefault();
    });
    seek.addEventListener('pointermove',e=>{
      if(!Number.isFinite(video.duration))return;
      const r=ratioAt(e);
      showTip(r);if(drag)previewAt(r);
    });
    seek.addEventListener('pointerup',e=>{
      if(!drag)return;drag=false;seek.classList.remove('drag');
      if(Number.isFinite(video.duration))video.currentTime=ratioAt(e)*video.duration;
      E.tip.style.display='';poke();
    });
    seek.addEventListener('pointerleave',()=>{if(!drag)E.tip.style.display=''});
    E.vol.addEventListener('input',()=>{video.volume=+E.vol.value;video.muted=video.volume===0;setPref('m3u_vod_volume',video.volume);paintVol()});
    // أحداث الفيديو
    ['timeupdate','durationchange','progress','loadedmetadata'].forEach(n=>video.addEventListener(n,paint));
    video.addEventListener('play',()=>{paintPP();poke();ended=false});
    video.addEventListener('pause',()=>{paintPP();poke();emitProgress();clearStall()});
    video.addEventListener('seeked',()=>{emitProgress();setBusy(false)});
    video.addEventListener('seeking',()=>setBusy(true,200));
    video.addEventListener('waiting',()=>{setBusy(true,350);armStall()});
    video.addEventListener('stalled',()=>armStall());
    video.addEventListener('canplay',()=>setBusy(false));
    video.addEventListener('playing',()=>{setBusy(false);clearStall();paintPP();applySpeed()});
    video.addEventListener('volumechange',paintVol);
    video.addEventListener('ended',onEnded);
    video.addEventListener('timeupdate',onTime);
    document.addEventListener('fullscreenchange',()=>{
      const on=document.fullscreenElement===root;E.fs.innerHTML=on?IC.fsx:IC.fs;if(!on)fsByUs=false;
    });
    document.addEventListener('visibilitychange',()=>{if(isOpen&&document.hidden)emitProgress()});
    window.addEventListener('pagehide',()=>{if(isOpen)emitProgress()});
  }
  function onClick(e){
    const a=e.target.closest('[data-a]');
    if(a){act(a.dataset.a);poke();return}
    const mi=e.target.closest('.wp-mi');
    if(mi){menuIdx=+mi.dataset.i||0;menuSelect();return}
    if(e.target.closest('.wp-bar,.wp-top,.wp-menu,.wp-msg,.wp-next'))return;
    if(menu){closeMenu();return}
    const now=Date.now(),dbl=now-lastTap<320;lastTap=now;
    const r=root.getBoundingClientRect(),f=r.width?(e.clientX-r.left)/r.width:.5;
    if(lastPtr==='mouse'){toggle();return}
    if(dbl&&(f<.35||f>.65)){seekNow(f<.35?-10:10);return}
    if(root.classList.contains('wp-idle'))poke();else{hideNow()}
  }

  /* ---------- حالة الواجهة ---------- */
  function paintPP(){
    const p=video.paused||video.ended;
    E.pp.innerHTML=ended?IC.replay:(p?IC.play:IC.pause);
    E.pp.setAttribute('aria-label',p?'تشغيل':'إيقاف مؤقت');
    root.classList.toggle('wp-paused',p);
    E.big.innerHTML=ended?IC.replay:IC.play;
  }
  function paintVol(){
    const m=video.muted||video.volume===0;
    E.mute.innerHTML=m?IC.mute:IC.vol;
    E.vol.value=m?0:video.volume;
  }
  function paint(){
    const d=video.duration,t=pend?Math.max(0,Math.min(d||0,video.currentTime+pend)):video.currentTime;
    const ok=Number.isFinite(d)&&d>0;
    const pct=ok?Math.max(0,Math.min(100,t/d*100)):0;
    E.fill.style.width=pct+'%';E.knob.style.left=pct+'%';
    let b=0;
    try{const br=video.buffered;for(let i=0;i<br.length;i++){if(br.start(i)<=video.currentTime+.5&&br.end(i)>=video.currentTime){b=br.end(i);break}}}catch(_){}
    E.buf.style.width=(ok?Math.min(100,b/d*100):0)+'%';
    E.time.textContent=fmt(t)+' / '+(ok?fmt(d):'--:--');
    E.seek.setAttribute('aria-valuenow',String(Math.round(pct)));
  }
  function previewAt(r){
    const d=video.duration;if(!Number.isFinite(d))return;
    E.fill.style.width=(r*100)+'%';E.knob.style.left=(r*100)+'%';E.time.textContent=fmt(r*d)+' / '+fmt(d);showTip(r);
  }
  function showTip(r){
    const d=video.duration;if(!Number.isFinite(d))return;
    E.tip.textContent=fmt(r*d);E.tip.style.left=(r*100)+'%';E.tip.style.display='block';
  }
  function setBusy(on,delay){
    clearTimeout(busyT);
    if(!on){root.classList.remove('wp-busy');return}
    busyT=setTimeout(()=>root.classList.add('wp-busy'),delay||0);
  }
  function hint(text,ms){
    E.hint.textContent=text;E.hint.classList.add('on');clearTimeout(hintT);hintT=setTimeout(()=>E.hint.classList.remove('on'),ms||1400);
  }
  function flash(icon){
    E.flash.innerHTML=icon;E.flash.classList.remove('go');void E.flash.offsetWidth;E.flash.classList.add('go');
  }
  function paintEngine(){
    if(!engine||!started){E.eng.hidden=true;return}
    E.eng.textContent=ENG_LABEL[engine]||engine.toUpperCase();E.eng.hidden=false;
  }
  function paintNav(){
    E.prev.hidden=!(o&&o.hasPrev);E.next.hidden=!(o&&o.hasNext);
    setFocus(zone,zi);
  }

  /* ---------- إظهار وإخفاء عناصر التحكم ---------- */
  function poke(){
    root.classList.remove('wp-idle');clearTimeout(idleT);
    if(video&&!video.paused&&!menu&&!msgOn&&!drag)idleT=setTimeout(hideNow,3800);
  }
  function hideNow(){
    if(!isOpen||menu||msgOn||video.paused||drag)return;
    root.classList.add('wp-idle');
  }

  /* ---------- التركيز بالريموت ---------- */
  function rowBtns(){return [...root.querySelectorAll('.wp-row .wp-btn')].filter(b=>!b.hidden)}
  function zoneItems(z){
    if(z==='top')return [root.querySelector('.wp-back')];
    if(z==='bar')return [E.seek];
    if(z==='msg')return [...E.msg.querySelectorAll('.wp-pill')].filter(b=>!b.hidden);
    return rowBtns();
  }
  function setFocus(z,i){
    zone=z;const items=zoneItems(z);zi=Math.max(0,Math.min(items.length-1,i||0));
    root.querySelectorAll('.wp-focus').forEach(n=>n.classList.remove('wp-focus'));
    const t=items[zi];if(t)t.classList.add('wp-focus');
  }

  /* ---------- التحكم بالتشغيل ---------- */
  function toggle(){
    if(!isOpen)return;
    if(ended){replay();return}
    if(video.paused){const p=video.play();if(p&&p.catch)p.catch(()=>hint('تعذّر استئناف التشغيل'));flash(IC.play)}
    else{video.pause();flash(IC.pause)}
  }
  function replay(){ended=false;nextDismissed=false;hideNext();video.currentTime=0;const p=video.play();if(p&&p.catch)p.catch(()=>{});paintPP()}
  function seekNow(delta){
    const d=video.duration;
    if(!Number.isFinite(d)||d<=0){hint('التقديم غير متاح حتى يجهز المحتوى');return}
    video.currentTime=Math.max(0,Math.min(d,video.currentTime+delta));
    flash(delta<0?IC.back10:IC.fwd10);hint((delta>0?'+':'−')+Math.abs(delta)+' ث · '+fmt(video.currentTime),900);
  }
  function seekKey(dir){
    const d=video.duration;
    if(!Number.isFinite(d)||d<=0){hint('التقديم غير متاح حتى يجهز المحتوى');return}
    const now=Date.now();if(now-lastSeekAt>650)repeatN=0;lastSeekAt=now;repeatN++;
    const step=repeatN>16?60:repeatN>7?30:10;
    pend+=dir*step;
    const t=Math.max(0,Math.min(d,video.currentTime+pend));
    hint((pend>0?'+':'−')+Math.abs(pend)+' ث · '+fmt(t),900);paint();
    clearTimeout(pendT);pendT=setTimeout(commitSeek,420);
  }
  function commitSeek(){
    const d=video.duration;
    if(Number.isFinite(d)&&d>0)video.currentTime=Math.max(0,Math.min(d,video.currentTime+pend));
    pend=0;paint();
  }
  function toggleMute(){video.muted=!video.muted;if(!video.muted&&video.volume===0)video.volume=.5;paintVol()}
  function toggleFs(){
    if(!root.requestFullscreen||window.Android)return;
    if(document.fullscreenElement){document.exitFullscreen().catch(()=>{})}
    else{fsByUs=true;root.requestFullscreen().catch(()=>{fsByUs=false})}
  }
  async function pip(){
    try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await video.requestPictureInPicture()}
    catch(e){hint('الصورة داخل الصورة غير متاحة')}
  }
  function applySpeed(){
    const s=Number(pref('m3u_vod_speed',1));const v=SPEEDS.includes(s)?s:1;
    video.defaultPlaybackRate=v;video.playbackRate=v;
  }
  function applyFit(){
    let f=pref('m3u_vod_aspect','contain');if(f==='zoom')f='cover';
    if(!FITS.some(x=>x[0]===f))f='contain';
    root.dataset.fit=f;
  }

  /* ---------- الإجراءات ---------- */
  function act(name){
    switch(name){
      case 'play':toggle();break;
      case 'prev':if(o&&o.hasPrev&&o.onPrev)o.onPrev();break;
      case 'next':if(o&&o.hasNext&&o.onNext)o.onNext();break;
      case 'back10':seekNow(-10);break;
      case 'fwd10':seekNow(10);break;
      case 'mute':toggleMute();break;
      case 'settings':menu?closeMenu():openMenu();break;
      case 'pip':pip();break;
      case 'fs':toggleFs();break;
      case 'close':close('user');break;
      case 'retry':hideMsg();load(video.currentTime||0||(o&&o.position)||0);break;
      case 'switch':{
        const list=['native','hls','mpegts'];const i=list.indexOf(engine);
        forced=list[(i+1)%list.length];hideMsg();load(video.currentTime||(o&&o.position)||0);break;
      }
      case 'nextnow':playNextNow();break;
      case 'nextcancel':dismissNext();break;
    }
  }

  /* ---------- قائمة الإعدادات ---------- */
  function audioList(){
    if(hls&&hls.audioTracks&&hls.audioTracks.length>1)return hls.audioTracks.map((t,i)=>({label:t.name||t.lang||('مسار '+(i+1)),on:hls.audioTrack===i,set(){hls.audioTrack=i}}));
    const at=video.audioTracks;
    if(at&&at.length>1)return [...Array(at.length).keys()].map(i=>({label:at[i].label||at[i].language||('مسار '+(i+1)),on:!!at[i].enabled,set(){for(let j=0;j<at.length;j++)at[j].enabled=j===i}}));
    return [];
  }
  function subList(){
    const out=[];
    if(hls&&hls.subtitleTracks&&hls.subtitleTracks.length){
      out.push({label:'بدون ترجمة',on:hls.subtitleTrack<0,set(){hls.subtitleTrack=-1}});
      hls.subtitleTracks.forEach((t,i)=>out.push({label:t.name||t.lang||('ترجمة '+(i+1)),on:hls.subtitleTrack===i,set(){hls.subtitleTrack=i}}));
      return out;
    }
    const tt=[...(video.textTracks||[])].filter(t=>t.kind==='subtitles'||t.kind==='captions');
    if(tt.length){
      out.push({label:'بدون ترجمة',on:tt.every(t=>t.mode!=='showing'),set(){tt.forEach(t=>t.mode='disabled')}});
      tt.forEach((t,i)=>out.push({label:t.label||t.language||('ترجمة '+(i+1)),on:t.mode==='showing',set(){tt.forEach(x=>x.mode=x===t?'showing':'disabled')}}));
    }
    return out;
  }
  function menuPage(id){
    const speed=Number(pref('m3u_vod_speed',1));let fit=pref('m3u_vod_aspect','contain');if(fit==='zoom')fit='cover';
    if(id==='root'){
      const items=[
        {label:'السرعة',value:speed===1?'عادية':'×'+speed,go:'speed'},
        {label:'نسبة العرض',value:(FITS.find(f=>f[0]===fit)||FITS[0])[1],go:'fit'},
        {label:'المحرّك',value:forced==='auto'?(ENG_LABEL[engine]||'تلقائي'):ENG_LABEL[forced],go:'engine'}
      ];
      if(audioList().length)items.push({label:'الصوت',value:'',go:'audio'});
      if(subList().length)items.push({label:'الترجمة',value:'',go:'subs'});
      return {title:'الإعدادات',items};
    }
    if(id==='speed')return {title:'السرعة',items:SPEEDS.map(s=>({label:s===1?'عادية':'×'+s,on:s===speed,pick(){setPref('m3u_vod_speed',s);applySpeed();hint('السرعة '+(s===1?'عادية':'×'+s))}}))};
    if(id==='fit')return {title:'نسبة العرض',items:FITS.map(f=>({label:f[1],on:f[0]===fit,pick(){setPref('m3u_vod_aspect',f[0]);applyFit()}}))};
    if(id==='engine')return {title:'المحرّك',items:ENGINES.map(e=>({label:e[1],on:e[0]===forced,pick(){forced=e[0];load(video.currentTime||0)}}))};
    if(id==='audio')return {title:'الصوت',items:audioList().map(a=>({label:a.label,on:a.on,pick(){a.set()}}))};
    if(id==='subs')return {title:'الترجمة',items:subList().map(a=>({label:a.label,on:a.on,pick(){a.set()}}))};
    return {title:'',items:[]};
  }
  function openMenu(){menu=['root'];menuIdx=0;renderMenu();poke()}
  function closeMenu(){menu=null;E.menu.hidden=true;E.menu.innerHTML='';poke()}
  function renderMenu(){
    const id=menu[menu.length-1],pg=menuPage(id);
    menuIdx=Math.max(0,Math.min(pg.items.length-1,menuIdx));
    let h='<div class="wp-mh">'+(menu.length>1?'<span class="wp-mback">'+IC.chev+'</span>':'')+'<b>'+pg.title+'</b></div>';
    pg.items.forEach((it,i)=>{
      h+='<button type="button" class="wp-mi'+(i===menuIdx?' wp-focus':'')+'" data-i="'+i+'"><span class="wp-mi-l">'+(it.on?IC.check:'<i></i>')+it.label+'</span>'+
        (it.go?'<span class="wp-mi-v">'+(it.value||'')+IC.chev+'</span>':'')+'</button>';
    });
    E.menu.innerHTML=h;E.menu.hidden=false;
  }
  function menuSelect(){
    const id=menu[menu.length-1],pg=menuPage(id),it=pg.items[menuIdx];if(!it)return;
    if(it.go){menu.push(it.go);menuIdx=0;renderMenu();return}
    if(it.pick)it.pick();
    if(id==='engine'||id==='fit'){closeMenu();return}
    menu.pop();menuIdx=0;renderMenu();
  }
  function menuBack(){if(menu.length>1){menu.pop();menuIdx=0;renderMenu()}else closeMenu()}

  /* ---------- مفاتيح الريموت واللوحة ---------- */
  function normKey(e){
    const k=e.key;
    if(k==='OK'||k==='Select')return 'Enter';
    if(k==='GoBack'||k==='BrowserBack'||k==='SoftLeft')return 'Escape';
    return k;
  }
  function onKey(e){
    if(!isOpen||e.ctrlKey||e.altKey||e.metaKey)return;
    const k=normKey(e);
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    handleKey(k,e.repeat);
  }
  function handleKey(k,rep){
    // مفاتيح الوسائط تعمل دائمًا
    if(k==='MediaPlayPause'||k==='MediaPlay'||k==='MediaPause'){
      if(k==='MediaPlay'&&!video.paused)return;if(k==='MediaPause'&&video.paused)return;
      toggle();poke();return;
    }
    if(k==='MediaFastForward'){seekNow(30);poke();return}
    if(k==='MediaRewind'){seekNow(-10);poke();return}
    if(k==='MediaTrackNext'||k==='PageDown'){act('next');return}
    if(k==='MediaTrackPrevious'||k==='PageUp'){act('prev');return}
    if(k==='MediaStop'){close('user');return}
    if(menu){
      const pg=menuPage(menu[menu.length-1]),n=pg.items.length;
      if(k==='Escape'||k==='Backspace'||k==='ArrowLeft'&&false){menuBack();return}
      if(k==='ArrowDown'){menuIdx=Math.min(n-1,menuIdx+1);renderMenu()}
      else if(k==='ArrowUp'){menuIdx=Math.max(0,menuIdx-1);renderMenu()}
      else if(k==='Enter'||k===' '||k==='ArrowRight'||k==='ArrowLeft'){if(!rep||k!=='Enter')menuSelect()}
      return;
    }
    if(msgOn){
      if(k==='Escape'||k==='Backspace'){close('user');return}
      const n=zoneItems('msg').length;
      if(k==='ArrowLeft')setFocus('msg',zi-1);else if(k==='ArrowRight')setFocus('msg',zi+1);
      else if(k==='Enter'||k===' '){const t=zoneItems('msg')[zi];if(t)act(t.dataset.a)}
      return;
    }
    if(k==='Escape'||k==='Backspace'){back();return}
    const hidden=root.classList.contains('wp-idle');
    if(k==='m'||k==='M'){toggleMute();poke();return}
    if(k==='f'||k==='F'){toggleFs();return}
    if(k==='Enter'||k===' '){
      if(hidden&&nextOn){playNextNow();return}
      if(hidden||zone==='bar'){toggle();poke();return}
      const t=zoneItems(zone)[zi];if(t&&t.dataset.a)act(t.dataset.a);else toggle();
      poke();return;
    }
    if(k==='ArrowLeft'||k==='ArrowRight'){
      const dir=k==='ArrowRight'?1:-1;
      if(hidden||zone==='bar'){if(zone!=='bar')setFocus('bar',0);seekKey(dir);poke();return}
      if(zone==='row'){setFocus('row',zi+dir)}
      poke();return;
    }
    if(k==='ArrowUp'){
      if(hidden){setFocus('bar',0);poke();return}
      if(zone==='row')setFocus('bar',0);else if(zone==='bar')setFocus('top',0);
      poke();return;
    }
    if(k==='ArrowDown'){
      if(hidden){setFocus('bar',0);poke();return}
      if(zone==='top')setFocus('bar',0);else if(zone==='bar')setFocus('row',0);
      poke();return;
    }
    poke();
  }
  function back(){
    if(!isOpen)return false;
    if(menu){menuBack();return true}
    if(msgOn){close('user');return true}
    if(nextOn){dismissNext();return true}
    close('user');return true;
  }

  /* ---------- الحلقة التالية ---------- */
  function showNext(sec){
    if(!o||!o.hasNext||nextDismissed)return;
    nextOn=true;E.nextc.hidden=false;
    E.nextc.querySelector('b').textContent=o.nextTitle||'الحلقة التالية';
    const auto=o.autoNext!==false;
    E.nextc.querySelector('small').textContent=auto?('الحلقة التالية · خلال '+Math.max(1,Math.ceil(sec))+' ث'):'الحلقة التالية';
    const d=video.duration||1,rem=Math.max(0,d-video.currentTime);
    E.nextc.querySelector('i').style.width=Math.max(0,Math.min(100,rem/30*100))+'%';
  }
  function hideNext(){nextOn=false;if(E.nextc)E.nextc.hidden=true}
  function dismissNext(){nextDismissed=true;hideNext();hint('أُلغي التشغيل التلقائي')}
  function playNextNow(){hideNext();nextDismissed=true;if(o&&o.hasNext&&o.onNext)o.onNext()}
  function onTime(){
    if(!isOpen)return;
    if(Math.abs(video.currentTime-lastTimeSeen)>.3){lastTimeSeen=video.currentTime;clearStall()}
    if(o&&o.hasNext&&!nextDismissed&&Number.isFinite(video.duration)&&video.duration>=120){
      const rem=video.duration-video.currentTime;
      if(rem>0&&rem<=30)showNext(rem);else if(nextOn&&rem>30)hideNext();
    }
  }
  let lastTimeSeen=0;
  function onEnded(){
    if(!isOpen)return;
    ended=true;emitProgress();paintPP();root.classList.remove('wp-idle');
    if(o&&o.hasNext&&o.autoNext!==false&&!nextDismissed){playNextNow();return}
    hideNext();hint('انتهى التشغيل',2200);
  }

  /* ---------- التقدّم المحفوظ ---------- */
  function emitProgress(){
    if(!o||!o.onProgress||!video)return;
    const d=video.duration,t=video.currentTime;
    if(!Number.isFinite(d)||d<=0||!Number.isFinite(t))return;
    try{o.onProgress({position:t,duration:d,ended:!!(video.ended||ended)})}catch(e){}
  }

  /* ---------- المحركات ---------- */
  function streamMeta(){
    const raw=String((o&&o.url)||'');
    const sp=window.__splitStreamUrl?window.__splitStreamUrl(raw):{url:raw,ua:'',ref:''};
    let ua=sp.ua||'',ref=sp.ref||'';
    if(o&&Array.isArray(o.extra))o.extra.forEach(line=>{
      const a=/^#EXTVLCOPT:http-user-agent=(.+)$/i.exec(line);if(a&&!ua)ua=a[1].trim();
      const b=/^#EXTVLCOPT:http-referrer=(.+)$/i.exec(line);if(b&&!ref)ref=b[1].trim();
    });
    return {url:sp.url||raw,ua,ref};
  }
  function modesFor(url){
    if(!Pb)return ['native','hls','mpegts'];
    if(forced!=='auto')return Pb.prioritizeModes(url,forced);
    const key=Pb.sourceKey(o&&o.sourceId,url),map=pref('m3u_vod_engines',{});
    return Pb.prioritizeModes(url,key?map[key]:'');
  }
  function teardown(){
    if(hls){try{hls.destroy()}catch(e){}hls=null}
    if(mp){try{mp.destroy()}catch(e){}mp=null}
    if(video){video.onerror=null;try{video.pause()}catch(e){}video.removeAttribute('src');try{video.load()}catch(e){}}
  }
  function load(startAt){
    const my=++tok;
    teardown();started=false;hlsRecovered=false;ended=false;clearStall();hideMsg();paintEngine();paintPP();
    setBusy(true,0);
    const meta=streamMeta();
    order=modesFor(meta.url);
    let restore=startAt>1?startAt:0;
    const onMeta=()=>{
      if(restore>0&&Number.isFinite(video.duration)&&video.duration>restore){try{video.currentTime=restore}catch(e){}}
      restore=0;applySpeed();
    };
    video.addEventListener('loadedmetadata',onMeta,{once:true});
    attempt(0,my,0,meta);
  }
  function attempt(i,my,lastCode,meta){
    if(my!==tok)return;
    if(i>=order.length){fatal(lastCode);return}
    const m=order[i];engine=m;
    let settled=false,timer=null;
    const cleanup=()=>{clearTimeout(timer);video.removeEventListener('playing',onStart);video.removeEventListener('loadedmetadata',onReady);video.removeEventListener('canplay',onReady)};
    const fail=code=>{
      if(settled||my!==tok)return;
      if(started){midError(code);return}
      settled=true;cleanup();teardown();
      attempt(i+1,my,(code>=400?code:lastCode),meta);
    };
    const onStart=()=>{
      if(settled||my!==tok)return;
      settled=true;started=true;cleanup();paintEngine();
      if(Pb&&m){const key=Pb.sourceKey(o&&o.sourceId,meta.url);if(key){const map=pref('m3u_vod_engines',{});map[key]=m;setPref('m3u_vod_engines',map)}}
    };
    let pendingPlay=false;
    const onReady=()=>{
      if(my!==tok||settled||video.readyState<2||pendingPlay)return;
      pendingPlay=true;
      const p=video.play();
      if(p&&p.then)p.then(()=>{pendingPlay=false},err=>{pendingPlay=false;if(err&&err.name==='NotAllowedError'){setBusy(false);paintPP()}});
    };
    video.addEventListener('playing',onStart);
    video.addEventListener('loadedmetadata',onReady);
    video.addEventListener('canplay',onReady);
    timer=setTimeout(()=>{if(!settled&&my===tok&&!started)fail(0)},30000);
    const playUrl=window.__proxyUrl?window.__proxyUrl(meta.url,m==='hls',{ua:meta.ua,ref:meta.ref}):meta.url;
    try{
      if(m==='hls'){
        const lib=window.__mediaLibraryPromises&&window.__mediaLibraryPromises.Hls;
        if(!window.Hls&&lib&&!attempt.waited){attempt.waited=true;settled=true;cleanup();lib.then(()=>{attempt.waited=false;attempt(i,my,lastCode,meta)});return}
        if(!(window.Hls&&Hls.isSupported())){settled=true;cleanup();attempt(i+1,my,lastCode,meta);return}
        hls=new Hls({enableWorker:true});hls.loadSource(playUrl);hls.attachMedia(video);
        hls.on(Hls.Events.ERROR,(ev,d)=>{
          if(!d||!d.fatal)return;
          const code=(d.response&&d.response.code)||0;
          if(started&&d.type===Hls.ErrorTypes.MEDIA_ERROR&&!hlsRecovered){hlsRecovered=true;try{hls.recoverMediaError();return}catch(e){}}
          fail(code);
        });
      }else if(m==='mpegts'){
        const lib=window.__mediaLibraryPromises&&window.__mediaLibraryPromises.mpegts;
        if(!window.mpegts&&lib&&!attempt.waited){attempt.waited=true;settled=true;cleanup();lib.then(()=>{attempt.waited=false;attempt(i,my,lastCode,meta)});return}
        if(!(window.mpegts&&mpegts.isSupported())){settled=true;cleanup();attempt(i+1,my,lastCode,meta);return}
        if(mpegts.LoggingControl){mpegts.LoggingControl.enableAll=false}
        mp=mpegts.createPlayer({type:/\.flv(\?|$)/i.test(meta.url)?'flv':'mpegts',isLive:false,url:playUrl});
        mp.attachMediaElement(video);mp.load();
        mp.on(mpegts.Events.ERROR,(_t,_d,info)=>fail(info&&info.code));
      }else{
        video.onerror=()=>fail(0);video.src=playUrl;video.load();
      }
      onReady();
    }catch(e){fail(0)}
  }
  function fatal(code){
    setBusy(false);teardown();
    showMsg(errText(code));
  }
  function midError(code){
    // تعطّل بعد بدء التشغيل: نحاول محركًا آخر من نفس الموضع مرة واحدة ثم نعرض الرسالة
    const pos=video.currentTime||0;
    const list=['native','hls','mpegts'].filter(x=>x!==engine);
    if(list.length&&!midError.tried){midError.tried=true;forced=list[0];hint('تبديل المحرك إلى '+(ENG_LABEL[forced]||forced),1800);load(pos);return}
    setBusy(false);showMsg(code===403?errText(403):'تعذّر استكمال التشغيل. يمكنك إعادة المحاولة.');
  }
  midError.tried=false;
  function armStall(){
    if(!isOpen||!started||video.paused||video.ended)return;
    clearTimeout(stallT);
    const at=video.currentTime;
    stallT=setTimeout(()=>{
      if(!isOpen||video.paused||Math.abs(video.currentTime-at)>.35)return;
      midError(0);
    },14000);
  }
  function clearStall(){clearTimeout(stallT);stallT=null}
  function showMsg(t){
    msgOn=true;E.msg.hidden=false;E.msg.querySelector('p').textContent=t;
    root.classList.remove('wp-idle');setFocus('msg',0);
  }
  function hideMsg(){msgOn=false;if(E.msg)E.msg.hidden=true;if(zone==='msg')setFocus('bar',0)}

  /* ---------- فتح وإغلاق ---------- */
  function setTitles(){
    E.title.textContent=(o&&o.title)||'';
    E.sub.textContent=(o&&o.subtitle)||'';E.sub.hidden=!(o&&o.subtitle);
  }
  function open(opts){
    build();
    const wasOpen=isOpen;
    if(wasOpen)emitProgress();
    o=Object.assign({autoNext:true,hasPrev:false,hasNext:false,position:0},opts||{});
    isOpen=true;root.hidden=false;document.body.classList.add('wp-open');
    if(!wasOpen){
      window.addEventListener('keydown',onKey,true);
      const vol=Number(pref('m3u_vod_volume',1));video.volume=Number.isFinite(vol)?Math.max(0,Math.min(1,vol)):1;video.muted=false;
      progT=setInterval(()=>{if(isOpen&&!video.paused)emitProgress()},10000);
    }
    forced='auto';midError.tried=false;nextDismissed=false;hideNext();closeMenu();hideMsg();pend=0;lastTimeSeen=0;
    setTitles();applyFit();paintVol();paintNav();setFocus('bar',0);
    root.classList.remove('wp-idle');
    load(o.position||0);poke();
  }
  function update(p){
    if(!isOpen||!p)return;
    Object.assign(o,p);setTitles();paintNav();
  }
  function close(reason){
    if(!isOpen)return;
    emitProgress();
    const cb=o&&o.onClose;
    isOpen=false;tok++;clearInterval(progT);progT=null;clearTimeout(idleT);clearTimeout(stallT);clearTimeout(pendT);clearTimeout(busyT);
    window.removeEventListener('keydown',onKey,true);
    closeMenu();hideNext();hideMsg();teardown();
    if(document.fullscreenElement===root&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    root.hidden=true;root.classList.remove('wp-busy','wp-idle');document.body.classList.remove('wp-open');
    o=null;
    if(cb){try{cb(reason||'user')}catch(e){console.error(e)}}
  }

  window.WasslaPlayer={
    open,close,update,back,
    isOpen:()=>isOpen,
    toggle:()=>{if(isOpen)toggle()},
    seekBy:d=>{if(isOpen)seekNow(d)},
    state:()=>isOpen?{position:video.currentTime,duration:video.duration,paused:video.paused,ended:!!(video.ended||ended),engine}:null
  };
})();
