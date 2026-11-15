/* طبقة HTTP: على أندرويد عبر Android.httpGet (يسمح بتحديد وكيل المستخدم User-Agent الذي يمنعه fetch)، وfetch احتياطياً. */
(function(){
  const A=window.Android;let seq=0;const pend={};
  window.__onHttp=function(id,ok,code){
    const f=pend[id];if(!f)return;delete pend[id];
    let body='';try{body=A.httpBody(id)}catch(e){}
    f({ok:!!ok,code:code|0,body});
  };
  function nativeGet(url,headers){
    return new Promise(res=>{
      const id='h'+(++seq);pend[id]=res;
      setTimeout(()=>{if(pend[id]){delete pend[id];res({ok:false,code:0,body:''})}},45000);
      try{A.httpGet(id,url,JSON.stringify(headers||{}))}catch(e){delete pend[id];res({ok:false,code:0,body:''})}
    });
  }
  window.__httpGet=async function(url,headers){
    if(A&&A.httpGet)return nativeGet(url,headers);
    try{const r=await fetch(url,{cache:'no-store'});return{ok:r.ok,code:r.status,body:await r.text()}}
    catch(e){return{ok:false,code:0,body:''}}
  };
})();
