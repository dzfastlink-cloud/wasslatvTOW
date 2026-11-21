(function(root,factory){
  const model=factory();
  if(typeof module==='object'&&module.exports)module.exports=model;
  if(root)root.WasslaVodModel=model;
})(typeof window==='undefined'?globalThis:window,function(){
  const MIN_RESUME_SECONDS=15;
  const AUTO_COMPLETE_RATIO=0.92;
  function normalizeSearch(value){
    return String(value||'').normalize('NFKC').toLowerCase().replace(/\p{M}/gu,'')
      .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
  }
  function normalizeTitle(title){
    return normalizeSearch(title).replace(/\b(?:19|20)\d{2}\b/g,' ').trim().replace(/\s+/g,' ');
  }
  function yearOf(title){
    const m=String(title||'').match(/\b((?:19|20)\d{2})\b|\(\s*((?:19|20)\d{2})\s*\)/);
    return m?Number(m[1]||m[2]):null;
  }
  function sameTitle(a,b){
    if(!a||!b||a.kind!==b.kind)return false;
    const an=normalizeTitle(a.title),bn=normalizeTitle(b.title);
    if(!an||an!==bn)return false;
    const ay=yearOf(a.title),by=yearOf(b.title);
    return ay==null||by==null||ay===by;
  }
  function progressPercent(record){
    if(!record||record.watched||!Number.isFinite(record.position)||!Number.isFinite(record.duration)||record.duration<=0||record.position<=0)return 0;
    return Math.max(1,Math.min(99,Math.round(record.position/record.duration*100)));
  }
  function shouldAutoComplete(position,duration){
    return Number.isFinite(duration)&&duration>0&&Number.isFinite(position)&&position>=duration*AUTO_COMPLETE_RATIO;
  }
  function shouldResume(record){
    return !!record&&!record.watched&&Number.isFinite(record.position)&&record.position>=MIN_RESUME_SECONDS&&
      Number.isFinite(record.duration)&&record.duration>0&&record.position<record.duration*AUTO_COMPLETE_RATIO;
  }
  return {
    MIN_RESUME_SECONDS,
    AUTO_COMPLETE_RATIO,
    normalizeSearch,
    normalizeTitle,
    yearOf,
    sameTitle,
    progressPercent,
    shouldAutoComplete,
    shouldResume
  };
});
