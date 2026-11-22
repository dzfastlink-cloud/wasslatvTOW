(function(root){
  function titleDelimiter(line){
    let quoted=false,escaped=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(escaped){escaped=false;continue}
      if(ch==='\\'&&quoted){escaped=true;continue}
      if(ch==='"'){quoted=!quoted;continue}
      if(ch===','&&!quoted)return i;
    }
    return -1;
  }

  function parseM3U(text){
    const out=[],lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
    let meta=null;
    for(const raw of lines){
      const l=raw.trim();
      if(!l)continue;
      if(l.startsWith('#EXTINF')){
        const attrs={};
        l.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{attrs[k.toLowerCase()]=v});
        const i=titleDelimiter(l);
        meta={name:(i>-1?l.slice(i+1):'').trim()||attrs['tvg-name']||'',logo:attrs['tvg-logo']||'',group:attrs['group-title']||'',raw:l,extra:[]};
      }else if(l.startsWith('#EXTGRP:')&&meta){meta.group=meta.group||l.slice(8).trim();meta.extra.push(l)}
      else if(l.startsWith('#')){if(meta)meta.extra.push(l)}
      else{
        const m=meta||{name:'',logo:'',group:'',raw:'',extra:[]};
        if(!m.name)m.name=l.split('/').pop().split('?')[0]||l;
        m.url=l;out.push(m);meta=null;
      }
    }
    return out;
  }

  function setM3UName(item,name){
    item.name=name;
    if(item.raw){
      const i=titleDelimiter(item.raw);
      item.raw=(i>-1?item.raw.slice(0,i):item.raw)+','+name;
    }else item.raw='#EXTINF:-1,'+name;
  }

  function serializeM3U(items){
    return '#EXTM3U\n'+items.map(i=>(i.raw?i.raw+'\n':'')+i.extra.join('\n')+(i.extra.length?'\n':'')+i.url).join('\n')+'\n';
  }

  root.parseM3U=parseM3U;
  root.setM3UName=setM3UName;
  root.serializeM3U=serializeM3U;
  if(typeof module!=='undefined'&&module.exports)module.exports={parseM3U,setM3UName,serializeM3U};
})(typeof window!=='undefined'?window:globalThis);
