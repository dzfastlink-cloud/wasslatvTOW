(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WasslaVodPlayback=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function seekTarget(currentTime,duration,delta){
    if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(delta))return null;
    const current=Number.isFinite(currentTime)?currentTime:0;
    return Math.max(0,Math.min(duration,current+delta));
  }
  function playbackModes(url){
    const u=String(url||'');
    if(/\.m3u8?(?:[?#]|$)/i.test(u))return['hls','native'];
    if(/\/(?:movie|series)\/[^/]+\/[^/]+\/[^/]+/i.test(u))return['native','hls','mpegts'];
    if(/\.(?:mp4|mkv|webm|mov|m4v|avi)(?:[?#]|$)/i.test(u))return['native','hls'];
    if(/\.(?:ts|flv)(?:[?#]|$)/i.test(u))return['mpegts','hls','native'];
    return['mpegts','hls','native'];
  }
  return{seekTarget,playbackModes};
});
