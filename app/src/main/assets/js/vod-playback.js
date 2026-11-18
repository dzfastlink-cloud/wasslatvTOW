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
  function deferPositionRestore(video,position,restore,onComplete){
    if(!Number.isFinite(position)||position<=0)return null;
    let active=true;
    const cleanup=()=>{
      if(!active)return;
      active=false;
      video.removeEventListener('loadedmetadata',onMetadata);
      if(onComplete)onComplete();
    };
    const onMetadata=()=>{
      try{
        if(Number.isFinite(video.duration)&&video.duration>position)restore(position);
      }finally{cleanup()}
    };
    video.addEventListener('loadedmetadata',onMetadata);
    return cleanup;
  }
  return{seekTarget,deferPositionRestore};
});
