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
      if(base.has(url)&&!local.has(url))return;
      output.push(item);emitted.add(url);
    });
    return output;
  }
  return {reconcileRemote};
});
