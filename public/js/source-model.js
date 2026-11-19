(function(root,factory){
  const model=factory();
  if(typeof module==='object'&&module.exports)module.exports=model;
  if(root)root.WasslaSourceModel=model;
})(typeof window==='undefined'?globalThis:window,function(){
  const fields=['name','logo','group','raw','extra'];
  const equal=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
  const keyed=items=>{
    const map=new Map();
    items.forEach(item=>{if(item&&item.url)map.set(item.url,item)});
    return map;
  };
  function reconcileRemote(baseItems,localItems,fetchedItems,mode,preserveLegacyOverrides){
    if(mode!=='merge'&&mode!=='replace')throw new Error('Unknown source update mode');
    const base=keyed(baseItems),local=keyed(localItems),fetched=keyed(fetchedItems);
    const output=[],emitted=new Set();
    localItems.forEach(item=>{
      if(!item||!item.url||emitted.has(item.url))return;
      const baseItem=base.get(item.url),latest=fetched.get(item.url);
      if(latest){
        if(!baseItem){output.push(item);emitted.add(item.url);return}
        const merged=Object.assign({},latest);
        fields.forEach(field=>{
          const changed=preserveLegacyOverrides
            ? !equal(item[field],latest[field])
            : !equal(item[field],baseItem[field]);
          if(changed)merged[field]=item[field];
        });
        output.push(merged);emitted.add(item.url);
      }else if(!baseItem||mode==='merge'){
        output.push(item);emitted.add(item.url);
      }
    });
    fetched.forEach((item,url)=>{
      if(emitted.has(url))return;
      output.push(item);emitted.add(url);
    });
    return output;
  }
  function normalizeSelection(selectedIds,validIds,defaultAll){
    const valid=Array.isArray(validIds)?validIds.filter(Boolean):[];
    const validSet=new Set(valid);
    if(selectedIds===null||selectedIds===undefined){
      return defaultAll?[...valid]:[];
    }
    const input=Array.isArray(selectedIds)?selectedIds:[...selectedIds];
    const out=[],seen=new Set();
    for(let i=0;i<input.length;i++){
      const id=input[i];
      if(!id||!validSet.has(id)||seen.has(id))continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }
  function toggleSelection(selectedIds,id,validIds){
    const current=normalizeSelection(selectedIds,validIds,false);
    const validSet=new Set(Array.isArray(validIds)?validIds:[]);
    if(!id||!validSet.has(id))return current;
    if(current.includes(id))return current.filter(x=>x!==id);
    return current.concat(id);
  }
  function reconcileAddedSource(selectedIds,knownIds,validIds,shouldIncludeFn){
    const valid=Array.isArray(validIds)?validIds.filter(Boolean):[];
    const hasInit=Array.isArray(selectedIds);
    const known=new Set(Array.isArray(knownIds)?knownIds:[]);
    let next=normalizeSelection(selectedIds,valid,true);
    if(hasInit){
      for(let i=0;i<valid.length;i++){
        const id=valid[i];
        if(known.has(id))continue;
        if((!shouldIncludeFn||shouldIncludeFn(id))&&!next.includes(id)){
          next=next.concat(id);
        }
      }
    }
    return {selected:next,known:[...valid]};
  }
  function summarizeSelection(selectedIds,candidates,emptyText){
    const list=Array.isArray(candidates)?candidates:[];
    const selSet=new Set(Array.isArray(selectedIds)?selectedIds:[]);
    const picked=list.filter(c=>c&&selSet.has(c.id));
    if(!picked.length)return emptyText||'لا يوجد مصدر محدد';
    if(picked.length===1)return picked[0].name||'مصدر واحد';
    if(picked.length===list.length)return 'كل المصادر ('+picked.length+')';
    return picked.length+' مصادر من '+list.length;
  }
  return {
    reconcileRemote,
    normalizeSelection,
    toggleSelection,
    reconcileAddedSource,
    summarizeSelection
  };
});
