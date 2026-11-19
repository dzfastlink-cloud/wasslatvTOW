/* توجيه مفاتيح الريموت دون مزج تنقل التفاصيل مع تحكم الفيديو */
(function(){
  function routeKey(state,key){
    if(state.fullscreen)return 'fullscreen';
    const media=key==='MediaFastForward'||key==='MediaRewind'||key==='MediaPlayPause';
    if(state.mini&&media)return 'media';
    if(state.detailMini&&(key==='PageDown'||key==='PageUp'))return 'media';
    if(state.details)return 'details';
    if(state.series)return 'series';
    return 'home';
  }
  function detailStep(key,isRtl){
    if(key==='ArrowDown'||(!isRtl&&key==='ArrowRight')||(isRtl&&key==='ArrowLeft'))return 1;
    if(key==='ArrowUp'||(!isRtl&&key==='ArrowLeft')||(isRtl&&key==='ArrowRight'))return -1;
    return 0;
  }
  function playerKeyAction(state,key,isRtl){
    const s=state||{};
    if(key==='MediaFastForward')return{type:'seek',delta:10};
    if(key==='MediaRewind')return{type:'seek',delta:-10};
    if(key==='MediaPlayPause')return{type:'togglePlay'};
    if(key==='PageDown')return{type:'episodeStep',delta:1};
    if(key==='PageUp')return{type:'episodeStep',delta:-1};

    if(s.optionsOpen){
      const optCount=Math.max(1,s.optCount||1);
      const curOpt=Math.max(0,Math.min(optCount-1,s.optIndex||0));
      if(key==='Escape'||key==='Backspace')return{type:'closeOptions'};
      if(key==='ArrowDown')return{type:'moveOption',index:Math.min(optCount-1,curOpt+1)};
      if(key==='ArrowUp')return{type:'moveOption',index:Math.max(0,curOpt-1)};
      if(key==='ArrowLeft'||key==='ArrowRight'||key==='Enter'||key===' '){
        const dir=key==='ArrowLeft'?(isRtl?1:-1):key==='ArrowRight'?(isRtl?-1:1):1;
        return{type:'cycleOption',index:curOpt,dir};
      }
      return{type:'noop'};
    }

    if(key==='Escape'||key==='Backspace'){
      return s.upNextVisible?{type:'dismissUpNext'}:{type:'back'};
    }

    if(s.zone==='bar'){
      const btnCount=Math.max(1,s.btnCount||1);
      const curBtn=Math.max(0,Math.min(btnCount-1,s.btnIndex||0));
      if(key==='ArrowUp')return{type:'focusVideo'};
      if(key==='ArrowLeft'||key==='ArrowRight'){
        const step=detailStep(key,!!isRtl);
        const nextBtn=Math.max(0,Math.min(btnCount-1,curBtn+step));
        return{type:'moveBar',index:nextBtn};
      }
      if(key==='Enter'||key===' ')return{type:'activateButton',index:curBtn};
      return{type:'noop'};
    }

    if(key==='ArrowRight')return{type:'seek',delta:10};
    if(key==='ArrowLeft')return{type:'seek',delta:-10};
    if(key==='ArrowDown')return{type:'focusBar'};
    if(key==='ArrowUp')return{type:'toggleOptions'};
    if(key==='Enter'||key===' ')return{type:'togglePlayOrOsd'};
    return{type:'noop'};
  }
  window.WasslaVodRemote={routeKey,detailStep,playerKeyAction};
})();
