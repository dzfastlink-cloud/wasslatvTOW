(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WasslaVodPlayback=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ENGINES=['native','hls','mpegts'];
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
  function sourceKey(sourceId,url){
    const sid=String(sourceId||'').trim();
    if(sid)return 'src:'+sid;
    try{
      const parsed=new URL(String(url||''));
      if(parsed.host)return 'host:'+parsed.host.toLowerCase();
    }catch{}
    return '';
  }
  function prioritizeModes(url,preferredMode){
    const base=playbackModes(url);
    if(!preferredMode||ENGINES.indexOf(preferredMode)<0)return base;
    if(base.indexOf(preferredMode)<0)return [preferredMode].concat(base);
    return [preferredMode].concat(base.filter(m=>m!==preferredMode));
  }
  function createSeekAccumulator(onCommit,delayMs){
    const wait=Number.isFinite(delayMs)&&delayMs>=0?delayMs:350;
    let totalDelta=0,timer=null;
    function cancel(){
      if(timer){clearTimeout(timer);timer=null}
      totalDelta=0;
    }
    function flush(){
      if(timer){clearTimeout(timer);timer=null}
      const d=totalDelta;
      totalDelta=0;
      if(d!==0&&typeof onCommit==='function')onCommit(d);
      return d;
    }
    function push(delta){
      if(!Number.isFinite(delta)||delta===0)return totalDelta;
      totalDelta+=delta;
      if(timer)clearTimeout(timer);
      timer=setTimeout(flush,wait);
      return totalDelta;
    }
    return{push,flush,cancel,total:()=>totalDelta};
  }
  function createSeekScrubber(onCommit){
    let active=null;
    function begin(pointerId,currentTime,duration){
      if(!Number.isFinite(duration)||duration<=0)return null;
      active={pointerId,time:Math.max(0,Math.min(duration,Number.isFinite(currentTime)?currentTime:0)),duration};
      return active.time;
    }
    function update(pointerId,ratio){
      if(!active||active.pointerId!==pointerId||!Number.isFinite(ratio))return null;
      active.time=Math.max(0,Math.min(active.duration,ratio*active.duration));
      return active.time;
    }
    function finish(pointerId){
      if(!active||active.pointerId!==pointerId)return null;
      const time=active.time;
      active=null;
      if(typeof onCommit==='function')onCommit(time);
      return time;
    }
    function cancel(pointerId){
      if(!active||active.pointerId!==pointerId)return false;
      active=null;
      return true;
    }
    return{begin,update,finish,cancel,isActive:()=>active!==null};
  }
  function formatFinishClock(remainingSec,nowMs){
    if(!Number.isFinite(remainingSec)||remainingSec<=0)return '';
    const base=Number.isFinite(nowMs)?nowMs:Date.now();
    const end=new Date(base+remainingSec*1000);
    const hh=String(end.getHours()).padStart(2,'0');
    const mm=String(end.getMinutes()).padStart(2,'0');
    return hh+':'+mm;
  }
  return{seekTarget,playbackModes,sourceKey,prioritizeModes,createSeekAccumulator,createSeekScrubber,formatFinishClock};
});
