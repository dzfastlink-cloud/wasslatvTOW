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
  window.WasslaVodRemote={routeKey,detailStep};
})();
