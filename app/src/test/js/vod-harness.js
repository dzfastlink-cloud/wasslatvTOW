/* بيئة DOM وهمية لتشغيل vod.js كما هو داخل Node (اختبار فقط). كل ما ليس معرّفاً هنا يصبح دالة فارغة. */
// Runs a vod.js file against a fake DOM and snapshots observable page state per step.
const fs=require('fs');
const path=require('path');
const ASSETS=path.join(__dirname,'../../../main/assets/js/');
function makeEnv(){
  class El{
    constructor(id){this.id=id;this.children=[];this.parentElement=null;this._c=new Set();this.dataset={};this.style={};this.attrs={};this.hidden=false;this.textContent='';this.value='';this.disabled=false;this.currentTime=0;this.duration=NaN;this.paused=true;this.controls=false;this.volume=1;this.muted=false;this.buffered={length:0};
      const self=this;
      this.classList={add:(...c)=>c.forEach(x=>self._c.add(x)),remove:(...c)=>c.forEach(x=>self._c.delete(x)),toggle:(c,f)=>{const on=f===undefined?!self._c.has(c):!!f;on?self._c.add(c):self._c.delete(c);return on},contains:c=>self._c.has(c)};}
    appendChild(ch){if(ch.parentElement)ch.parentElement.children=ch.parentElement.children.filter(x=>x!==ch);ch.parentElement=this;this.children.push(ch);return ch}
    append(...a){a.forEach(x=>this.appendChild(x))}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null}
    setAttribute(k,v){this.attrs[k]=String(v)} getAttribute(k){return this.attrs[k]??null} removeAttribute(k){delete this.attrs[k]}
    addEventListener(){} removeEventListener(){} querySelector(){return null} querySelectorAll(){return []}
    focus(){} blur(){} click(){} scrollIntoView(){} closest(){return null} contains(){return false}
    getBoundingClientRect(){return{left:0,top:0,width:100,height:50,right:100,bottom:50}} getClientRects(){return[1]}
    play(){this.paused=false;return Promise.resolve()} pause(){this.paused=true} load(){}
    get children_(){return this.children}
  }
  const els=new Map();
  const get=id=>{if(!els.has(id))els.set(id,new El(id));return els.get(id)};
  // layout the live-TV host the way index.html does
  const host=get('__playerhost');get('player');host.appendChild(get('player'));
  ['library-view','player-overlay','vod','vod-player-overlay','vod-player-frame','vodb','vtabs','vodnext','vodopts','vodtouchzones','vodseekpill','vodtrack','vtbar','vtfill','vtbuf','vtknob','vtcur','vtdur','vtleft','vtstate','v','now','vodplaypause','vodh'].forEach(get);
  get('vod-player-overlay').parentElement=get('player-overlay');
  const body=new El('body');
  const doc={body,documentElement:Object.assign(new El('html'),{}),getElementById:get,createElement:t=>new El(t),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},fullscreenElement:null,activeElement:null,exitFullscreen:()=>Promise.resolve()};
  const win={Android:undefined,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},removeEventListener(){},console,
    WasslaVodMetadata:{}};
  return {els,get,body,doc,win};
}
function load(){
  const E=makeEnv();
  ['vod-state.js','source-model.js','vod-model.js','vod-remote.js'].forEach(f=>new Function('window',fs.readFileSync(ASSETS+f,'utf8'))(E.win));
  E.win.WasslaVodMetadata=E.win.WasslaVodMetadata||{};
  let src=fs.readFileSync(ASSETS+'vod.js','utf8');
  const idx=src.lastIndexOf('})();');
  // test-only hook: expose internals; never shipped
  src=src.slice(0,idx)+"\nwindow.__t={playItem,expandPlayer,minimizePlayer,stopPlay,closePlayer,open,close,getScreen:()=>screen};\n"+src.slice(idx);
  const real=globalThis;
  const defined={
    $:E.get,LS:{get:(k,d)=>d,set(){},del(){}},lists:[],FAV_LIST_ID:'fav',shown:[],curUrl:'',
    window:E.win,document:E.doc,getComputedStyle:()=>({direction:'rtl'}),
    requestAnimationFrame:f=>{f();return 1},cancelAnimationFrame(){},
    /* مؤقتات غير مانعة لإنهاء Node (مثل حفظ التقدم كل 10 ثوان) */
    setInterval:(f,ms)=>{const id=setInterval(f,ms);if(id&&id.unref)id.unref();return id},
    setTimeout:(f,ms)=>{const id=setTimeout(f,ms);if(id&&id.unref)id.unref();return id},
    play(){},stopAll(){},tok:0,
    isVodPlayback:()=>E.body.classList.contains('cine-play')||E.body.classList.contains('cine-mini'),
    parseM3U:()=>[],detectKind:()=>null,active:null,
  };
  const env=new Proxy(defined,{
    has:(t,k)=>typeof k==='string'&&(k in t||!(k in real)),
    get:(t,k)=>{if(k===Symbol.unscopables)return undefined;if(k in t)return t[k];return function(){return undefined}}
  });
  new Function('env','with(env){'+src+'\n}')(env);
  return {E,t:E.win.__t,W:E.win};
}
function snap(E,t){
  const cls=[...E.body._c].filter(c=>/^(cine-|vod-)/.test(c)).sort();
  const pl=E.get('player');
  return {body:cls.join(' '),playerIn:pl.parentElement&&pl.parentElement.id,
    libraryDisplay:E.get('library-view').style.display||'',overlayDisplay:E.get('player-overlay').style.display||'',
    overlayOpen:E.get('vod-player-overlay')._c.has('is-open'),overlayAria:E.get('player-overlay').attrs['aria-hidden']??null,
    vodAria:E.get('vod').attrs['aria-hidden']??null,screen:t.getScreen()};
}
module.exports={load,snap};
