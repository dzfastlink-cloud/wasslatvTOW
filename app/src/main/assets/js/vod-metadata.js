(function(root){
  function safeText(value){
    if(Array.isArray(value))return value.map(safeText).filter(Boolean).join(', ');
    return value==null?'':String(value).trim();
  }

  function durationText(value){
    const seconds=Number(value);
    if(!Number.isFinite(seconds)||seconds<=0)return '';
    const total=Math.floor(seconds),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),rest=total%60;
    return hours?String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(rest).padStart(2,'0'):minutes+':'+String(rest).padStart(2,'0');
  }

  function requestUrl(card,source){
    if(!card)return '';
    if(card.kind==='series'&&card.lazy){
      try{
        const url=new URL(card.lazy);
        if(!/^https?:$/.test(url.protocol)||url.searchParams.get('action')!=='get_series_info')return '';
        return url.toString();
      }catch(e){return ''}
    }
    if(card.kind!=='movie'||!card.item||!card.item.url)return '';
    try{
      const stream=new URL(card.item.url);
      if(!/^https?:$/.test(stream.protocol))return '';
      const parts=stream.pathname.split('/').filter(Boolean).map(part=>decodeURIComponent(part));
      const marker=parts.lastIndexOf('movie');
      if(marker<0||parts.length<=marker+3)return '';
      const idMatch=/^(\d+)(?:\.[^/]*)?$/.exec(parts[marker+3]);
      if(!idMatch)return '';
      const xt=source&&source.xt;
      const host=xt&&xt.host?xt.host:stream.origin;
      const username=xt&&xt.u?xt.u:parts[marker+1];
      const password=xt&&xt.p?xt.p:parts[marker+2];
      if(!host||!username||!password)return '';
      const api=new URL('/player_api.php',host);
      api.searchParams.set('username',username);
      api.searchParams.set('password',password);
      api.searchParams.set('action','get_vod_info');
      api.searchParams.set('vod_id',idMatch[1]);
      return api.toString();
    }catch(e){return ''}
  }

  function normalize(payload){
    const info=payload&&payload.info&&typeof payload.info==='object'?payload.info:{};
    const movie=payload&&payload.movie_data&&typeof payload.movie_data==='object'?payload.movie_data:{};
    const released=safeText(info.releasedate||info.release_date);
    const backdrop=Array.isArray(info.backdrop_path)?info.backdrop_path[0]:info.backdrop_path;
    return{
      overview:safeText(info.plot||info.description||info.overview),
      cast:safeText(info.cast||info.actors),
      director:safeText(info.director),
      genre:safeText(info.genre),
      year:safeText(info.year)||(released.match(/\b\d{4}\b/)||[])[0]||'',
      duration:safeText(info.duration)||durationText(info.duration_secs),
      rating:safeText(info.rating),
      backdrop:safeText(backdrop),
      trailer:safeText(info.youtube_trailer||info.trailer),
      poster:safeText(info.movie_image||movie.stream_icon)
    };
  }

  function youtubeId(value){
    const text=safeText(value);
    if(/^[A-Za-z0-9_-]{11}$/.test(text))return text;
    try{
      const url=new URL(text);
      const host=url.hostname.toLowerCase().replace(/^www\./,'');
      if(host==='youtu.be'){
        const id=url.pathname.split('/').filter(Boolean)[0]||'';
        return /^[A-Za-z0-9_-]{11}$/.test(id)?id:'';
      }
      if(host!=='youtube.com'&&host!=='youtube-nocookie.com')return '';
      const path=url.pathname.split('/').filter(Boolean);
      const id=url.searchParams.get('v')||(path[0]==='embed'||path[0]==='shorts'?path[1]:'');
      return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:'';
    }catch(e){return ''}
  }

  async function fetchInfo(card,source,fetcher,signal){
    const url=requestUrl(card,source);
    if(!url)return null;
    const send=fetcher||root.fetch;
    if(typeof send!=='function')throw new Error('Fetch is unavailable');
    const response=await send(url,{signal,credentials:'omit'});
    if(!response||!response.ok)throw new Error('Xtream metadata request failed');
    return normalize(await response.json());
  }

  const api={requestUrl,normalize,youtubeId,fetchInfo};
  root.WasslaVodMetadata=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
