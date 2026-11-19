(function(root){
  function safeText(value){
    if(Array.isArray(value))return value.map(safeText).filter(Boolean).join('، ');
    if(value&&typeof value==='object'){
      if(typeof value.name==='string')return value.name.trim();
      return '';
    }
    return value==null?'':String(value).trim();
  }

  function firstUrl(value){
    if(Array.isArray(value)){
      for(const entry of value){
        const u=firstUrl(entry);
        if(u)return u;
      }
      return '';
    }
    const text=safeText(value);
    return /^https?:\/\//i.test(text)?text:'';
  }

  function durationText(value){
    const seconds=Number(value);
    if(!Number.isFinite(seconds)||seconds<=0)return '';
    const total=Math.floor(seconds),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),rest=total%60;
    return hours?String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(rest).padStart(2,'0'):minutes+':'+String(rest).padStart(2,'0');
  }

  function extractYear(value){
    const text=safeText(value);
    if(!text)return '';
    const matches=text.match(/(?:^|[^\d])((?:19|20)\d{2})(?:$|[^\d])/g);
    if(!matches)return '';
    for(const token of matches){
      const m=/((?:19|20)\d{2})/.exec(token);
      if(!m)continue;
      const y=Number(m[1]);
      if(y>=1900&&y<=2035)return String(y);
    }
    return '';
  }

  function normalizeScore(value,isFiveBased){
    if(value==null||value==='')return '';
    const str=String(value).replace(/,/g,'.').trim();
    const m=/(\d+(?:\.\d+)?)/.exec(str);
    if(!m)return '';
    let num=parseFloat(m[1]);
    if(!Number.isFinite(num)||num<=0)return '';
    if(isFiveBased){
      if(num>5)return '';
      num=num*2;
    }
    if(num>10)return '';
    return (Math.round(num*10)/10).toFixed(1);
  }

  function normalizeImdbId(value){
    const text=safeText(value);
    const m=/\b(tt\d{5,10})\b/i.exec(text);
    return m?m[1].toLowerCase():'';
  }

  function normalizeRating(info,movie){
    const srcInfo=info&&typeof info==='object'?info:{};
    const srcMovie=movie&&typeof movie==='object'?movie:{};
    const explicitImdb=
      normalizeScore(srcInfo.imdb_rating,false)||
      normalizeScore(srcInfo.imdbRating,false)||
      normalizeScore(srcInfo.imdb,false)||
      normalizeScore(srcMovie.imdb_rating,false)||
      normalizeScore(srcMovie.imdbRating,false);
    const general=
      normalizeScore(srcInfo.rating,false)||
      normalizeScore(srcMovie.rating,false)||
      normalizeScore(srcInfo.rating_5based,true)||
      normalizeScore(srcMovie.rating_5based,true);
    const imdbId=
      normalizeImdbId(srcInfo.imdb_id||srcInfo.imdbId||srcInfo.imdb)||
      normalizeImdbId(srcMovie.imdb_id||srcMovie.imdbId);
    const score=explicitImdb||general;
    return{rating:score,imdbRating:score,imdbId};
  }

  function parseCast(value){
    if(!value)return[];
    let rawItems=[];
    if(Array.isArray(value)){
      rawItems=value.map(entry=>typeof entry==='object'&&entry&&entry.name?String(entry.name):String(entry==null?'':entry));
    }else{
      const cleaned=safeText(value)
        .replace(/^\s*(?:cast|actors|starring|stars|الممثلون|الممثلين|بطولة|طاقم التمثيل)\s*[:\-–—]\s*/i,'');
      if(!cleaned)return[];
      rawItems=cleaned.split(/[,،;•|\n]+/);
    }
    const out=[],seen=new Set();
    for(const part of rawItems){
      const name=String(part||'').replace(/\s+/g,' ').replace(/^[\s\-–—·]+|[\s\-–—·]+$/g,'').trim();
      if(!name||name.length<2)continue;
      if(/^(?:n\/a|none|null|unknown|غير متوفر|لا يوجد|-+)$/i.test(name))continue;
      const key=name.toLowerCase();
      if(seen.has(key))continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }

  function actorInitials(name){
    const words=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!words.length)return '★';
    if(words.length===1)return words[0].slice(0,2).toUpperCase();
    return (words[0][0]+words[words.length-1][0]).toUpperCase();
  }

  function parseAttrs(raw){
    const attrs={};
    if(!raw||typeof raw!=='string')return attrs;
    raw.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{attrs[k.toLowerCase()]=v.trim()});
    return attrs;
  }

  function qualityFromVideo(video){
    if(!video||typeof video!=='object')return '';
    const h=Number(video.height||video.coded_height);
    if(!Number.isFinite(h)||h<=0)return '';
    if(h>=2000)return '4K UHD';
    if(h>=1000)return '1080p FHD';
    if(h>=700)return '720p HD';
    return h+'p';
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
      const host=(xt&&xt.host?xt.host:stream.origin).replace(/\/+$/,'')+'/';
      const username=xt&&xt.u?xt.u:parts[marker+1];
      const password=xt&&xt.p?xt.p:parts[marker+2];
      if(!host||!username||!password)return '';
      const api=new URL('player_api.php',host);
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
    const released=safeText(info.releasedate||info.release_date||info.releaseDate||movie.releasedate||movie.release_date);
    const epMins=Number(info.episode_run_time);
    const rawDuration=safeText(info.duration);
    const duration=(rawDuration&&rawDuration!=='00:00:00'&&rawDuration!=='0')
      ?rawDuration
      :(durationText(info.duration_secs)||(Number.isFinite(epMins)&&epMins>0?epMins+' دقيقة':''));
    const scores=normalizeRating(info,movie);
    const castList=parseCast(info.cast||info.actors||movie.cast||movie.actors);
    const year=extractYear(info.year||info.release_year||movie.year)||extractYear(released)||extractYear(info.name||movie.name);
    return{
      overview:safeText(info.plot||info.description||info.overview||movie.plot),
      cast:castList.join('، '),
      castList,
      director:safeText(info.director||movie.director),
      genre:safeText(info.genre||movie.genre),
      year,
      releaseDate:released,
      country:safeText(info.country),
      age:safeText(info.age||info.mpaa_rating||info.certification),
      duration,
      rating:scores.rating,
      imdbRating:scores.imdbRating,
      imdbId:scores.imdbId,
      quality:qualityFromVideo(info.video),
      backdrop:firstUrl(info.backdrop_path)||firstUrl(info.cover_big),
      trailer:safeText(info.youtube_trailer||info.trailer),
      poster:firstUrl(info.movie_image)||firstUrl(info.cover_big)||firstUrl(info.cover)||firstUrl(movie.stream_icon)
    };
  }

  /* استخراج معلومات تعريفية إضافية من وسم #EXTINF واسم الفيلم ورابطه لقوائم M3U أو قبل رد خادم Xtream */
  function extractFromItem(card){
    const rawTitle=String((card&&card.title)||'');
    const url=String((card&&card.item&&card.item.url)||'');
    const rawLine=String((card&&card.item&&card.item.raw)||'');
    const attrs=parseAttrs(rawLine);

    const year=
      extractYear(attrs['tvg-year']||attrs['year']||attrs['release-year']||attrs['release_date']||attrs['releasedate'])||
      extractYear(rawTitle);

    const titleImdbMatch=/\bimdb[\s:_-]*(\d(?:\.\d)?)\b/i.exec(rawTitle);
    const imdbRating=
      normalizeScore(attrs['imdb-rating']||attrs['imdb_rating']||attrs['imdb'],false)||
      normalizeScore(attrs['tvg-rating']||attrs['rating'],false)||
      (titleImdbMatch?normalizeScore(titleImdbMatch[1],false):'');
    const imdbId=normalizeImdbId(attrs['imdb-id']||attrs['imdb_id']||attrs['imdb']||rawTitle);

    const castList=parseCast(attrs['tvg-cast']||attrs['cast']||attrs['actors']||attrs['starring']);
    const director=safeText(attrs['tvg-director']||attrs['director']);
    const genre=safeText(attrs['tvg-genre']||attrs['genre']);
    const overview=safeText(attrs['tvg-plot']||attrs['plot']||attrs['description']);
    const country=safeText(attrs['tvg-country']||attrs['country']);
    const age=safeText(attrs['tvg-age']||attrs['age']||attrs['mpaa-rating']);

    let quality='';
    if(/\b(?:4K|2160p|UHD)\b/i.test(rawTitle))quality='4K UHD';
    else if(/\b(?:1080p|FHD)\b/i.test(rawTitle))quality='1080p FHD';
    else if(/\b(?:720p|HD)\b/i.test(rawTitle))quality='720p HD';
    else if(/\b(?:480p|SD)\b/i.test(rawTitle))quality='480p SD';

    const sourceTag=(rawTitle.match(/\b(WEB-?DL|WEB-?Rip|Blu-?Ray|BRRip|HDRip|HEVC|x265)\b/i)||[])[1]||'';
    if(sourceTag)quality=quality?quality+' · '+sourceTag.toUpperCase():sourceTag.toUpperCase();

    let language='';
    if(/مدبلج/.test(rawTitle))language='مدبلج';
    else if(/مترجم/.test(rawTitle))language='مترجم';
    else if(/^\s*[\[(]?\s*AR\s*[\])|]/i.test(rawTitle))language='عربي';
    else if(/^\s*[\[(]?\s*FR\s*[\])|]/i.test(rawTitle))language='فرنسي';
    else if(/^\s*[\[(]?\s*EN\s*[\])|]/i.test(rawTitle))language='إنجليزي';

    const extMatch=url.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
    const ext=extMatch?extMatch[1].toUpperCase():'';
    const format=ext==='M3U8'?'HLS':(/^(MP4|MKV|AVI|MOV|WEBM|M4V|TS|FLV)$/.test(ext)?ext:'');

    return{
      year,
      imdbRating,
      imdbId,
      rating:imdbRating,
      cast:castList.join('، '),
      castList,
      director,
      genre,
      overview,
      country,
      age,
      quality,
      language,
      format
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

  const api={requestUrl,normalize,extractFromItem,parseCast,actorInitials,extractYear,youtubeId,fetchInfo};
  root.WasslaVodMetadata=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
