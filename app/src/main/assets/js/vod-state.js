/* آلة حالات المكتبة (VOD): مصدر الحقيقة الوحيد لـ «أين أنا؟» و«ماذا يفعل زر الرجوع؟».
   دوال نقية بلا DOM، لذلك تُختبر بالكامل في Node.

   مفهومان منفصلان:
   • الشاشة (screen): home · series · details · trailer · player   ← ما يراه المستخدم خلف المشغّل
   • وضع المشغّل (player mode): closed · mini · full              ← حالة المشغّل نفسه

   ملاحظة توافق: app.js و nav.js و tvnav.js تقرأ الكلاسين cine-play / cine-mini من <body>
   (مثل isVodPlayback)، لذلك نُبقيهما كإسقاط (projection) من وضع المشغّل،
   ولا يكتبهما أي كود آخر. عند توحيد باقي الواجهة يمكن حذف هذا الإسقاط. */
(function(){
  const SCREENS=['home','series','details','trailer','player'];
  const PLAYER_MODES=['closed','mini','full'];

  /* الانتقالات المسموحة بين الشاشات. الانتقال إلى home مسموح من أي شاشة (فتح المكتبة/العودة). */
  const SCREEN_EDGES={
    home:['series','details','player'],
    series:['home','details','player'],
    details:['home','series','trailer','player'],
    trailer:['details'],
    player:['home','series','details']
  };

  function canGo(from,to){
    if(!SCREENS.includes(to))return false;
    if(from===to||to==='home')return true;
    return (SCREEN_EDGES[from]||[]).includes(to);
  }

  /* إسقاط وضع المشغّل على كلاسات <body> القديمة + الطبقات.
     next/prev: وضع المشغّل الجديد والسابق.
     classes: كلاسات تُضبط true/false.  remove: كلاسات تُحذف عند مغادرة وضع.
     layers: أي طبقة ظاهرة. */
  function projectPlayer(next,prev){
    const full=next==='full',mini=next==='mini',closed=next==='closed';
    const remove=[];
    /* مغادرة الشاشة الكاملة تُسقط حالة شريط التتبع المخفي وأوضاع ملاءمة الصورة */
    if(prev==='full'&&!full)remove.push('cine-track-hidden','vod-fit-contain','vod-fit-cover','vod-fit-zoom');
    /* الإغلاق يمسح كل ما يخص التشغيل */
    if(closed)remove.push('cine-track-hidden','vod-detail-play','vod-fit-contain','vod-fit-cover','vod-fit-zoom','vod-sub-large');
    return{
      classes:{'cine-play':full,'cine-mini':mini,'vod-player-open':full},
      remove:remove,
      layers:{library:!full,playerOverlay:full}
    };
  }

  /* ماذا يفعل زر الرجوع الآن؟ — بنفس ترتيب الأولوية المعتمد: يغلق أعلى طبقة فقط.
     ctx: {on, srcPopOpen, screen, mode, optsOpen, upNextVisible, stopArmed} */
  function backAction(ctx){
    const c=ctx||{};
    if(!c.on)return'none';
    if(c.srcPopOpen)return'closeSourcePop';
    if(c.screen==='trailer')return'closeTrailer';
    if(c.mode==='full'){
      if(c.optsOpen)return'closeOptions';
      if(c.upNextVisible)return'dismissUpNext';
      return'minimize';
    }
    if(c.screen==='details')return'returnFromDetails';
    if(c.screen==='series')return'seriesToHome';
    if(c.mode==='mini')return c.stopArmed?'stopPlayer':'armStop';
    return'exit';
  }

  /* الحالة التي يحتاجها WasslaVodRemote.routeKey */
  function keyRouteState(s){
    const x=s||{};
    const mini=x.mode==='mini';
    return{
      fullscreen:x.mode==='full',
      detailMini:mini&&!!x.playerFromDetails&&x.screen==='details',
      mini:mini,
      details:x.screen==='details',
      series:x.screen==='series'
    };
  }

  window.WasslaVodState={SCREENS,PLAYER_MODES,SCREEN_EDGES,canGo,projectPlayer,backAction,keyRouteState};
})();
