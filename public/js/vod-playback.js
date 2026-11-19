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
  return{seekTarget};
});
