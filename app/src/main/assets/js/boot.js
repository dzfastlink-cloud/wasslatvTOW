(function(){var edition=window.Android&&Android.edition?Android.edition():'open',k='wassla:'+edition+':m3u_bgphoto',h=document.documentElement,c=document.getElementById('bgphoto'),v=null;
try{v=localStorage.getItem(k);if(v==null&&edition==='open'){v=localStorage.getItem('m3u_bgphoto');if(v!=null)localStorage.setItem(k,v)}}catch(e){}
var on=v!=='0';h.classList.toggle('nophoto',!on);c.checked=on;
c.onchange=function(){h.classList.toggle('nophoto',!c.checked);try{localStorage.setItem(k,c.checked?'1':'0')}catch(e){}};})();
