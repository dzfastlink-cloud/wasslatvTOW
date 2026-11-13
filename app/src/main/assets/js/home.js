/* ===== الشاشة الرئيسية: تظهر بعد الشعار وتجمع مداخل التطبيق =====
   للتوسعة مستقبلاً: WasslaHome.register({id,order,icon,label,sub,cls,run})
   - sub(peek) يعيد نصاً صغيراً تحت الاسم (peek=true: بلا حساب ثقيل)
   - الصوت يُكتم خلف الرئيسية ويُعاد عند الدخول إلى البث */
(function(){
  const el=$('home'),box=$('hmtiles'),clk=$('hmclock'),nt=$('wnotify');
  if(!el)return;
  const v=$('v'),tiles=[];
  let on=false,want=false,idx=0,savedMuted=null,clkT=null,nT=null,cnt=null,cntKey='';
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const pad=n=>String(n).padStart(2,'0');
  const vodOn=()=>!!(window.__vodOn&&window.__vodOn());
  const userLists=()=>(lists||[]).filter(l=>l.id!==FAV_LIST_ID);

  /* إشعار عام فوق كل الشاشات */
  window.WasslaNotify=function(text,opt){
    if(!nt)return;
    nt.textContent=text||'';nt.classList.toggle('err',!!(opt&&opt.err));nt.classList.add('on');
    clearTimeout(nT);nT=setTimeout(()=>nt.classList.remove('on'),(opt&&opt.ms)||4500);
  };
  const notify=(t,err)=>window.WasslaNotify(t,{err:!!err});

  function counts(peek){
    const key=(lists||[]).map(l=>l.id+':'+(l.upd||0)+':'+(l.n||0)).join('|');
    if(cnt&&cntKey===key)return cnt;
    if(peek)return null;
    const c={live:0,vod:0};
    userLists().forEach(l=>{try{parseM3U(l.text).forEach(it=>{const k=detectKind(it);if(k==='movie'||k==='series')c.vod++;else c.live++})}catch(e){}});
    cnt=c;cntKey=key;return c;
  }

  function register(t){
    const i=tiles.findIndex(x=>x.id===t.id);
    if(i>=0)tiles.splice(i,1);
    tiles.push(t);tiles.sort((a,b)=>(a.order||50)-(b.order||50));
    if(on)paint();
  }

  function paint(){
    box.textContent='';
    tiles.forEach((t,i)=>{
      const b=document.createElement('button');
      b.type='button';b.className='hm-tile '+(t.cls||'')+(i===idx?' sel':'')+(t.dim&&t.dim()?' dim':'');
      b.style.setProperty('--i',i);
      b.innerHTML='<span class="hm-ic"></span><span class="hm-lb"></span><span class="hm-sub"></span>';
      b.children[0].textContent=t.icon;b.children[1].textContent=t.label;
      b.children[2].textContent=t.sub?(t.sub(true)||''):'';
      b.onclick=()=>{idx=i;mark();run()};
      box.appendChild(b);
    });
  }
  function refreshSubs(){
    [...box.children].forEach((b,i)=>{const t=tiles[i];if(t&&t.sub)b.children[2].textContent=t.sub(false)||'';b.classList.toggle('dim',!!(t&&t.dim&&t.dim()))});
  }
  function mark(){[...box.children].forEach((b,i)=>b.classList.toggle('sel',i===idx));const b=box.children[idx];if(b)b.focus({preventScroll:true})}
  function move(d){if(!tiles.length)return;idx=(idx+d+tiles.length)%tiles.length;mark()}
  function run(){const t=tiles[idx];if(t&&t.run)t.run()}

  function startClock(){const tick=()=>{const d=new Date();clk.textContent=pad(d.getHours())+':'+pad(d.getMinutes())+' · '+d.toLocaleDateString('ar-DZ',{weekday:'long',day:'numeric',month:'long'})};tick();clearInterval(clkT);clkT=setInterval(tick,20000)}
  function setVisible(show,fromSplash){
    if(show===on)return;
    on=show;el.classList.toggle('on',show);el.setAttribute('aria-hidden',show?'false':'true');document.body.classList.toggle('home',show);
    if(show){
      if(savedMuted===null)savedMuted=v.muted;
      v.muted=true;
      el.classList.remove('enter');
      if(fromSplash){void el.offsetWidth;el.classList.add('enter')}
      startClock();paint();mark();setTimeout(refreshSubs,80);
    }else{
      if(savedMuted!==null){v.muted=savedMuted;savedMuted=null}
      clearInterval(clkT);el.classList.remove('enter');
    }
  }
  function open(fromSplash){want=true;if(!vodOn())setVisible(true,!!fromSplash)}
  function leave(){want=false;setVisible(false)}
  function enterLive(){
    leave();
    if(window.__rcv&&!document.body.classList.contains('rcv'))window.__rcv.set(true,true);
    if(window.__hintLive)window.__hintLive();
  }

  /* المكتبة والإعدادات تفتحان فوق الرئيسية: تُخفى الرئيسية أثناء مكتبة الأفلام وتعود بعدها */
  const sync=()=>{if(!want)return;if(vodOn()&&on)setVisible(false);else if(!vodOn()&&!on)setVisible(true)};
  ['vod','st'].forEach(id=>{const n=$(id);if(n)new MutationObserver(sync).observe(n,{attributes:true,attributeFilter:['class']})});

  document.addEventListener('keydown',e=>{
    if(!on)return;
    if(document.querySelector('dialog[open]')||(window.__stOn&&window.__stOn())||(window.__qpOn&&window.__qpOn())||vodOn())return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    const k=/^(OK|Select)$/.test(e.key)?'Enter':e.key,r=rtl(),next=r?'ArrowLeft':'ArrowRight',prev=r?'ArrowRight':'ArrowLeft';
    e.preventDefault();e.stopImmediatePropagation();
    if(k==='Enter'){if(!e.repeat)run()}
    else if(k===next||k==='ArrowDown')move(1);
    else if(k===prev||k==='ArrowUp')move(-1);
    else if(k==='Home'){idx=0;mark()}
    else if(k==='End'){idx=tiles.length-1;mark()}
  },true);

  register({id:'live',order:10,icon:'📺',label:'البث المباشر',cls:'live',
    sub:p=>{const c=counts(p);return c?c.live+' قناة':''},run:enterLive});
  register({id:'vod',order:20,icon:'🎬',label:'المكتبة',cls:'vod',
    sub:p=>{const c=counts(p);return c?(c.vod?c.vod+' عنصر':'لا يوجد محتوى بعد'):''},
    dim:()=>{const c=counts(true);return !!c&&!c.vod},
    run:()=>{const c=counts();if(!c.vod){notify('لا توجد أفلام أو مسلسلات في مصادرك بعد');return}if(window.__openVod)window.__openVod()}});
  register({id:'sources',order:30,icon:'🛰',label:'المصادر',cls:'src',
    sub:()=>userLists().length+' مصدر',run:()=>{if(window.__openSettings)window.__openSettings('sources')}});
  register({id:'settings',order:40,icon:'⚙',label:'الإعدادات',cls:'set',
    sub:()=>'التشغيل والمظهر',run:()=>{if(window.__openSettings)window.__openSettings()}});

  window.WasslaHome={register,open,close:leave,isOn:()=>on,shouldShow:()=>LS.get('m3u_home',true)!==false};
  window.__homeOn=()=>on;
})();
