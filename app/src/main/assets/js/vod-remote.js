/* توجيه مفاتيح الريموت دون مزج تنقل التفاصيل مع تحكم الفيديو */
(function(){
  function routeKey(state,key){
    if(state.fullscreen)return 'fullscreen';
    if(state.detailMini){
      if(key==='Escape'||key==='Backspace')return 'leave-details';
      if(key==='MediaFastForward'||key==='MediaRewind'||key==='MediaPlayPause'||key==='PageDown'||key==='PageUp')return 'media';
    }
    if(state.details)return 'details';
    if(state.series)return 'series';
    return 'home';
  }
  function detailStep(key,isRtl){
    if(key==='ArrowDown'||(!isRtl&&key==='ArrowRight')||(isRtl&&key==='ArrowLeft'))return 1;
    if(key==='ArrowUp'||(!isRtl&&key==='ArrowLeft')||(isRtl&&key==='ArrowRight'))return -1;
    return 0;
  }
  window.WasslaVodRemote={routeKey,detailStep};
})();
