(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.WasslaVodPlayback=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function resolveUIMode(mode){
    return mode==='rcv'||mode==='home'?mode:null;
  }
  function createReadinessGate(video,timeoutMs){
    let resolveGate,rejectGate,timer,settled=false;
    const promise=new Promise((resolve,reject)=>{resolveGate=resolve;rejectGate=reject});
    const cleanup=()=>{
      clearTimeout(timer);
      video.removeEventListener('loadeddata',check);
      video.removeEventListener('canplay',ready);
      video.removeEventListener('playing',ready);
      video.removeEventListener('error',error);
    };
    const finish=(fn,value)=>{
      if(settled)return;
      settled=true;cleanup();fn(value);
    };
    const check=()=>{if(video.readyState>=2)finish(resolveGate)};
    const ready=()=>finish(resolveGate);
    const error=()=>finish(rejectGate,new Error('Media failed before playback became ready'));
    video.addEventListener('loadeddata',check);
    video.addEventListener('canplay',ready);
    video.addEventListener('playing',ready);
    video.addEventListener('error',error);
    timer=setTimeout(()=>finish(rejectGate,new Error('Timed out waiting for playable media')),timeoutMs);
    check();
    return {
      promise,
      cancel(){
        const err=new Error('Playback readiness wait cancelled');
        err.name='AbortError';
        finish(rejectGate,err);
      }
    };
  }
  function requestPlay(video){
    try{return Promise.resolve(video.play())}
    catch(error){return Promise.reject(error)}
  }
  function createEngineRegistry(definitions,loadScript,getGlobal,configure){
    const pending=new Map();
    definitions.forEach(def=>{
      let loading;
      const current=getGlobal(def.global);
      if(current)loading=Promise.resolve(current);
      else loading=loadScript(def.local).then(()=>{
        const engine=getGlobal(def.global);
        if(!engine)throw new Error(def.global+' did not register after local load');
        return engine;
      }).catch(()=>loadScript(def.cdn).then(()=>{
        const engine=getGlobal(def.global);
        if(!engine)throw new Error(def.global+' did not register after CDN load');
        return engine;
      }));
      pending.set(def.global,loading.then(engine=>{
        if(configure)configure(def.global,engine);
        return{engine,error:null};
      }).catch(error=>({engine:null,error})));
    });
    const ready=Promise.all(Array.from(pending.entries()).map(([name,promise])=>
      promise.then(result=>[name,result])
    )).then(entries=>entries.reduce((all,[name,result])=>{
      all[name]=result;
      return all;
    },{}));
    return{
      ready,
      wait(name){return pending.get(name)||Promise.resolve({engine:null,error:new Error('Unknown playback engine: '+name)})}
    };
  }
  function seekTarget(currentTime,duration,delta){
    if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(delta))return null;
    const current=Number.isFinite(currentTime)?currentTime:0;
    return Math.max(0,Math.min(duration,current+delta));
  }
  return{resolveUIMode,createReadinessGate,requestPlay,createEngineRegistry,seekTarget};
});
