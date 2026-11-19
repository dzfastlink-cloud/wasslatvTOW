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
  function deferPositionRestore(video,position,onRestore){
    if(!video || !Number.isFinite(position) || position<=0){
      return ()=>{};
    }
    let active=true;
    const listener=()=>{
      if(!active)return;
      active=false;
      video.removeEventListener('loadedmetadata',listener);
      if(Number.isFinite(video.duration)&&video.duration>position){
        if(typeof onRestore==='function')onRestore(position);
      }
    };
    video.addEventListener('loadedmetadata',listener);
    return ()=>{
      if(!active)return;
      active=false;
      video.removeEventListener('loadedmetadata',listener);
    };
  }
  return{seekTarget,deferPositionRestore};
});
