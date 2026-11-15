/* ===== الريسيفر: البث المباشر بملء الشاشة + قائمة القنوات (قائمة وشاشة فقط) =====
   البث:   ↑ القناة الأعلى رقماً، ↓ القناة الأدنى رقماً، ← → تقديم/تأخير، OK قائمة القنوات
   القائمة: ↑ ↓ القنوات، ← → الفئات، رجوع إلى البث */
(function(){
  const rb=$('rbanner'),rn=$('rnum'),rt=$('rtoast'),rm=$('rmenu'),rows=rm.querySelector('.rows'),pv=rm.querySelector('.pv'),
        rx=$('rexit'),v=$('v'),im=rb.querySelector('img'),
        headEl=$('rhead'),hintEl=$('rhint'),np=$('npad'),npv=$('npv');
  let lastG=null,glowT=null,lpAt=0,lpT=null,lpFired=false,lpArmed=false,noSeekUrl='',on=false,buf='',bufT,banT,clkT,toastT,xT,open=false,sel=0,curIt=null,zone='rows',hIdx=0;
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const numOf=(it,i)=>{const m=it&&it.raw&&/channel-number="(\d+)"/.exec(it.raw);return m?+m[1]:i+1};
  const pad=n=>String(n).padStart(2,'0');
  const hm=()=>{const d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())};
  const stOn=()=>window.__stOn&&window.__stOn();
  im.onerror=()=>{im.style.display='none'};

  /* ===== المصادر ← التصنيفات ← القنوات (ثلاثة مستويات، رجوع يتراجع خطوة) ===== */
  let level='rows',nav=[],panel=[];
  const kcache=new Map();
  function kindsOf(l){
    const key=l.id+':'+(l.upd||0)+':'+(l.n||0);let c=kcache.get(key);if(c)return c;
    c={live:0,vod:0,groups:new Map()};
    try{parseM3U(l.text).forEach(it=>{
      const k=detectKind(it);
      if(k==='movie'||k==='series')c.vod++;
      else{c.live++;const g=it.group||'بدون مجموعة';c.groups.set(g,(c.groups.get(g)||0)+1)}
    })}catch(e){}
    kcache.set(key,c);return c;
  }
  let cdK='',cdV=null;
  function catData(){
    const l0=(lists||[]).find(x=>x.id===active),key=active+'|'+(l0?(l0.upd||0)+':'+(l0.n||0)+':'+((l0.text||'').length):'')+'|'+items.length+'|'+favs.size+'|'+recs.length;
    if(cdV&&cdK===key)return cdV;
    const v=catData0();cdK=key;cdV=v;return v;
  }
  function catData0(){
    const l=(lists||[]).find(x=>x.id===active),k=l?kindsOf(l):{live:items.length,vod:0,groups:new Map()},out=[];
    const IC={'أخبار':'📰','MBC':'📺','دينية':'🕌','موسيقى':'🎵','إذاعات':'📻','الجزائر':'📍','رياضة':'⚽','أطفال':'🧸','أفلام':'🎬','وثائقي':'🌍'};
    out.push({v:'',ic:'📺',nm:'كل القنوات',ct:(k.live||items.length)+' قناة'});
    const nf=items.filter(i=>favs.has(i.url)).length;if(nf)out.push({v:'__fav',ic:'★',nm:'المفضلة',ct:nf+' قناة'});
    const nr=recs.filter(u=>items.some(i=>i.url===u)).length;if(nr)out.push({v:'__rec',ic:'🕘',nm:'آخر ما شاهدت',ct:nr+' قناة'});
    k.groups.forEach((c,g)=>out.push({v:g,ic:IC[g]||'📁',nm:g,ct:c+' قناة'}));
    return out;
  }
  function buildPanel(){
    rows.textContent='';
    const fr=document.createDocumentFragment();
    panel.forEach((p,i)=>{
      const r=document.createElement('div');r.className='r pn'+(p.v!==undefined&&p.v===$('grp').value?' cur':'');
      r.innerHTML='<span class="n"></span><span class="t"><span class="chname"></span></span><span class="s"></span>';
      r.children[0].textContent=p.ic||'›';r.children[1].firstChild.textContent=p.nm;r.children[2].textContent=p.ct||'';
      r.onclick=e=>{e.stopPropagation();sel=i;mark();pickPanel()};
      fr.appendChild(r);
    });
    rows.appendChild(fr);
    const mg0=rm.querySelector('.mg');if(mg0)mg0.textContent='‹ التصنيفات › — '+panel.length+' تصنيف';
  }
  function showCats(){panel=catData();level='cats';buildPanel()}
  function openCats(){
    if(level==='cats'){setZone('rows');return}
    nav.push(level);showCats();
    const i=panel.findIndex(p=>p.v!==undefined&&p.v===$('grp').value);sel=Math.max(0,i);setZone('rows');
  }
  function pickPanel(){
    const p=panel[sel];if(!p||level!=='cats')return;
    $('grp').value=p.v;render();nav=['cats'];level='rows';build();sel=0;setZone('rows');
  }
  function goBack(){
    if($('grp').value==='__fav'){$('grp').value='';render();lastG=null;build();sel=Math.max(0,shown.findIndex(i=>i.url===curUrl));setZone('rows');toast('كل القنوات');return}
    closeL();
  }
  /* ===== بطاقات التصنيفات: شريط أفقي فوق القائمة، يمين ويسار للتنقل، OK للدخول ===== */
  function buildCards(){
    const cats=catData(),cur=$('grp').value;
    headEl.textContent='';
    cats.forEach((c,i)=>{
      const d=document.createElement('span');d.className='h card'+(c.v===cur?' cur':'');d.dataset.v=c.v;
      d.innerHTML='<i></i><b></b><small></small>';
      d.children[0].textContent=c.ic;d.children[1].textContent=c.nm;d.children[2].textContent=c.ct||'';
      d.onclick=e=>{e.stopPropagation();hIdx=i;pickCard(c.v)};
      headEl.appendChild(d);
    });
    if(hIdx>=headEl.children.length)hIdx=Math.max(0,headEl.children.length-1);
    const cc=headEl.querySelector('.card.cur');if(cc&&zone!=='head')cc.scrollIntoView({block:'nearest',inline:'nearest'});
    renderHead();
  }
  function pickCard(v){$('grp').value=v;render();lastG=null;build();sel=0;setZone('rows');groupFx(1)}
  /* توهّج خفيف لبطاقة التصنيف عند العبور إلى قناة من تصنيف جديد */
  function glowCard(g){
    const c=[...headEl.children].find(x=>x.dataset.v===g);if(!c)return;
    c.scrollIntoView({block:'nearest',inline:'nearest'});
    c.classList.remove('glow');void c.offsetWidth;c.classList.add('glow');
    clearTimeout(glowT);glowT=setTimeout(()=>c.classList.remove('glow'),1100);
  }

  function badges(it){
    const h=v.videoHeight,w=v.videoWidth,u=((it&&it.url)||'').toLowerCase(),a=[];
    if(h)a.push((h>=1080?'FHD':h>=720?'HD':'SD')+' '+w+'×'+h);
    a.push(/\.m3u8?(\?|$)/.test(u)?'HLS':/\.ts(\?|$)/.test(u)?'TS':'IPTV');
    if(it&&favs.has(it.url))a.push('★');
    rb.querySelector('.bg').innerHTML=a.map(x=>'<i>'+x+'</i>').join('');
  }
  function clock(){rb.querySelector('.rc').textContent=hm();rm.querySelector('.mc').textContent=hm();const md=rm.querySelector('.md');if(md)md.textContent=new Date().toLocaleDateString('ar-DZ',{weekday:'long',day:'numeric',month:'long'})}
  function banner(it){
    curIt=it;const i=shown.findIndex(x=>x.url===it.url);
    rb.querySelector('.rn').textContent=i>=0?numOf(it,i):'–';
    rb.querySelector('b').textContent=it.name;rb.querySelector('small').textContent=it.group||'';
    rb.querySelector('.dt').textContent=new Date().toLocaleDateString('ar-DZ',{weekday:'long',day:'numeric',month:'long'});
    if(it.logo){im.src=it.logo;im.style.display=''}else im.style.display='none';
    badges(it);clock();rb.classList.add('on');clearInterval(clkT);clkT=setInterval(clock,20000);
    clearTimeout(banT);banT=setTimeout(()=>{rb.classList.remove('on');clearInterval(clkT)},4500);
  }
  ['resize','loadedmetadata'].forEach(ev=>v.addEventListener(ev,()=>{if(rb.classList.contains('on')&&curIt)badges(curIt)}));
  function toast(t){rt.textContent=t;rt.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>rt.classList.remove('on'),1800)}

  function digit(d){if(buf.length>=4)buf='';buf+=d;rn.textContent=buf;rn.style.display='block';clearTimeout(bufT);bufT=setTimeout(commit,1500)}
  function commit(){
    clearTimeout(bufT);const n=parseInt(buf,10);buf='';rn.style.display='none';if(!n)return;
    const hit=shown.find((x,i)=>numOf(x,i)===n);
    if(!hit){toast('القناة '+n+' غير موجودة');return}play(hit);
  }
  np.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{if(npv.textContent.length<4)npv.textContent+=b.dataset.d});
  $('npdel').onclick=()=>{npv.textContent=npv.textContent.slice(0,-1)};
  $('npgo').onclick=()=>{buf=npv.textContent;np.close();commit()};
  $('npcan').onclick=()=>np.close();
  function openNumpad(){npv.textContent='';np.showModal()}

  function place(){if(!open)return;const r=pv.getBoundingClientRect(),s=v.style;s.position='fixed';s.left=r.left+'px';s.top=r.top+'px';s.width=r.width+'px';s.height=r.height+'px'}
  window.addEventListener('resize',place);
  /* الصفوف تُبنى على دفعات: الأولى فوراً (مع الصف الحالي)، والباقي في الخلفية، فلا يلتصق التبديل بين التصنيفات */
  let bT=0;
  function rowEl(it,i){
    const r=document.createElement('div');r.className='r'+(it.url===curUrl?' cur':'');
    r.innerHTML='<span class="n">'+numOf(it,i)+'</span><span class="t"></span><span class="s"></span>';
    const t=r.children[1];
    if(it.logo){
      const logo=document.createElement('img');
      logo.loading='lazy';logo.decoding='async';logo.alt='';
      logo.src=it.logo;
      logo.onerror=()=>{logo.remove();};
      t.appendChild(logo);
    }
    const name=document.createElement('span');name.textContent=it.name;name.className='chname';t.appendChild(name);
    r.children[2].textContent=favs.has(it.url)?'★':'';
    r.onclick=e=>{e.stopPropagation();closeL();play(it)};
    return r;
  }
  function build(){
    updateHeaderMeta();buildCards();
    if(level==='cats'){panel=catData();return buildPanel()}
    const my=++bT,total=Math.min(shown.length,1500);
    rows.textContent='';
    const add=(a,b)=>{const fr=document.createDocumentFragment();for(let i=a;i<b;i++)fr.appendChild(rowEl(shown[i],i));rows.appendChild(fr)};
    const ci=shown.findIndex(i=>i.url===curUrl),first=Math.min(total,Math.max(100,ci+60));
    add(0,first);
    let at=first;
    (function more(){
      if(my!==bT||at>=total)return;
      const to=Math.min(total,at+150);add(at,to);at=to;
      if(at<total)setTimeout(more,16);
    })();
  }
  function mark(){
    [...rows.children].forEach((r,i)=>r.classList.toggle('sel',i===sel));
    const r=rows.children[sel];if(r)r.scrollIntoView({block:'nearest'});
    rows.querySelectorAll('.mq').forEach(x=>{x.classList.remove('mq');x.parentNode.classList.remove('mqc')});
    if(r){const tt=r.querySelector('.t'),sp=tt&&tt.querySelector('.chname');if(sp){const d=sp.scrollWidth-sp.clientWidth;if(d>2){sp.style.setProperty('--mq',(rtl()?d+8:-d-8)+'px');sp.classList.add('mq');tt.classList.add('mqc')}}}
    if(level!=='rows')return;
    const it=shown[sel];
    if(it&&zone==='rows'&&open&&!/^__/.test($('grp').value)){const gg=it.group||'بدون مجموعة';if(gg!==lastG){lastG=gg;glowCard(gg)}}
  }
  function updateHeaderMeta(){
    const sn=rm.querySelector('.source-name');if(sn){const l=(lists||[]).find(x=>x.id===active);sn.textContent=l?l.name:'';sn.style.display=l?'':'none'}
    const cats=catData(),cur=$('grp').value,i=cats.findIndex(x=>x.v===cur);
    const catName=rm.querySelector('.category-name'),catCount=rm.querySelector('.category-count');
    if(catName)catName.textContent=i>=0?cats[i].nm:'كل القنوات';
    if(catCount){catCount.textContent=cats.length>1&&i>=0?(i+1)+'/'+cats.length:'';catCount.style.display=cats.length>1?'inline-flex':'none'}
  }
  function renderHead(){[...headEl.children].forEach((h,i)=>h.classList.toggle('sel',zone==='head'&&i===hIdx));if(zone==='head'){const c=headEl.children[hIdx];if(c)c.scrollIntoView({block:'nearest',inline:'center'})}}
  function renderHint(){
    const c=window.__caps||{};let h;
    if(zone==='head')h=['← → التصنيفات','OK دخول','↓ القنوات'];
    else h=['↑ ↓ القنوات','OK مشاهدة','OK مطوّلاً: مفضلة','← → التصنيف','↑ من الأول: التصنيفات'];
    hintEl.innerHTML=h.map(x=>'<span>'+x+'</span>').join('');
  }
  document.addEventListener('caps',renderHint);
  function setZone(z){const was=zone;zone=z;if(z==='head'&&was!=='head'){const k=[...headEl.children].findIndex(c=>c.classList.contains('cur'));hIdx=Math.max(0,k)}rm.classList.toggle('z-rows',z==='rows');rm.classList.toggle('z-head',z==='head');renderHead();mark();renderHint();updateHeaderMeta();}
  function openL(){open=true;level='rows';nav=[];hIdx=0;lastG=null;rm.dataset.rs=LS.get('m3u_rowstyle','both');build();sel=Math.max(0,shown.findIndex(i=>i.url===curUrl));document.body.classList.add('menu');rm.classList.add('on');v.classList.add('pvid');rb.classList.remove('on');clock();place();setZone('rows');updateHeaderMeta();}
  function closeL(){open=false;rm.classList.remove('on');document.body.classList.remove('menu');v.classList.remove('pvid');v.style.cssText=''}
  function favSel(){const it=shown[sel];if(!it)return;const s=sel;toggleFav(it.url);toast(favs.has(it.url)?'★ أُضيفت إلى المفضلة':'☆ أُزيلت من المفضلة');build();sel=Math.min(s,Math.max(0,rows.children.length-1));mark()}
  function editSel(){const it=shown[sel];if(!it)return;closeL();if(!(window.__editChannel&&window.__editChannel(it)))toast('تعذّر فتح التعديل')}
  function cycleGroup(d){
    const vals=catData().map(x=>x.v);if(vals.length<2)return;
    let i=vals.indexOf($('grp').value);if(i<0)i=0;
    i=(i+d+vals.length)%vals.length;
    $('grp').value=vals[i];render();lastG=null;build();sel=0;setZone('rows');groupFx(d);
  }
  /* إحساس الانتقال بين التصنيفات: انزلاق + تلاشي للقائمة، ونبضة لاسم التصنيف (transform/opacity فقط لتخفيف الحمل) */
  function groupFx(d){
    try{
      if(!rows.animate||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
      const fromRight=rtl()?d<0:d>0,dx=(fromRight?1:-1)*28;
      rows.getAnimations().forEach(a=>a.cancel());
      rows.animate([{opacity:0,transform:'translateX('+dx+'px)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.2,.7,.3,1)'});
      rm.querySelectorAll('.category-name,.category-count').forEach(e=>{e.getAnimations().forEach(a=>a.cancel());
        e.animate([{opacity:.3,transform:'translateY(-4px) scale(.96)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'})});
    }catch(e){}
  }
  function openSettings(section){closeL();if(window.__openSettings)window.__openSettings(section)}
  function seekBy(sec){const sk=v.seekable;if(!sk||!sk.length){if(noSeekUrl!==curUrl){noSeekUrl=curUrl;toast('هذه القناة لا تدعم التقديم والتأخير')}return}const a=sk.start(0),b=sk.end(sk.length-1),t=Math.min(b,Math.max(a,v.currentTime+sec)),behind=Math.round(b-t);v.currentTime=t;toast(behind>3?'⏪ متأخر '+behind+' ث عن المباشر':'● مباشر')}

  /* OK: ضغطة قصيرة تشغّل القناة (عند رفع الإصبع)، والمطوّلة تضيفها للمفضلة أو تزيلها */
  function enterDown(repeat){
    if(repeat)return;
    if(lpArmed&&Date.now()-lpAt<2000)return;
    lpArmed=true;lpFired=false;lpAt=Date.now();clearTimeout(lpT);
    lpT=setTimeout(()=>{if(!lpArmed||!open||level!=='rows')return;lpFired=true;favSel()},650);
  }
  function enterUp(){
    clearTimeout(lpT);lpArmed=false;
    if(lpFired){lpFired=false;return}
    if(!open||level!=='rows')return;
    const it=shown[sel];if(it){closeL();play(it)}
  }
  document.addEventListener('keyup',e=>{
    if(!lpArmed)return;
    const k=/^(OK|Select)$/.test(e.key)?'Enter':e.key;
    if(k!=='Enter')return;
    e.preventDefault();e.stopPropagation();enterUp();
  },true);

  function menuKey(k,repeat){
    const r=rtl(),next=r?'ArrowLeft':'ArrowRight',prev=r?'ArrowRight':'ArrowLeft';
    if(zone==='rows'){
      const n=rows.children.length;
      if(k==='ArrowUp'){if(repeat)setZone('head');else if(sel>0){sel--;mark()}else setZone('head')}
      else if(k==='ArrowDown'){sel=Math.min(Math.max(0,n-1),sel+1);mark()}
      else if(k==='PageUp'||k==='Home')setZone('head');
      else if(k==='PageDown') {sel=Math.min(Math.max(0,n-1),sel+8);mark()}
      else if(k===next){if(level==='rows')cycleGroup(1)}
      else if(k===prev){if(level==='rows')cycleGroup(-1)}
      else if(k==='Enter'){enterDown(repeat)}
      else if(k==='Escape'||k==='Backspace')goBack();
      else if(k==='F1'&&level==='rows')favSel();
      else if((k==='F3'||k==='i'||k==='I'||k==='ContextMenu')&&level==='rows')editSel();
    }else{
      if(k===next){hIdx=Math.min(headEl.children.length-1,hIdx+1);renderHead()}
      else if(k===prev){hIdx=Math.max(0,hIdx-1);renderHead()}
      else if(k==='ArrowDown')setZone('rows');
      else if(k==='Enter'){
        const c=headEl.children[hIdx];if(c&&!repeat)pickCard(c.dataset.v);
      }else if(k==='Escape'||k==='Backspace')setZone('rows');
    }
  }

  /* ↑ = القناة الأعلى رقماً، ↓ = الأدنى رقماً (مثل الريسيفر الحقيقي) مع التفاف عند الطرفين */
  function zapByNumber(dir){
    if(!shown.length)return;
    const ci=Math.max(0,shown.findIndex(it=>it.url===curUrl)),cn=numOf(shown[ci],ci);
    const c=shown.map((it,i)=>({it,n:numOf(it,i)}));
    const up=c.filter(x=>x.n>cn).sort((a,b)=>a.n-b.n),down=c.filter(x=>x.n<cn).sort((a,b)=>b.n-a.n);
    const t=dir>0?(up[0]||c.slice().sort((a,b)=>a.n-b.n)[0]):(down[0]||c.slice().sort((a,b)=>b.n-a.n)[0]);
    if(t)play(t.it);
  }
  function setMode(m,silent){on=m;document.body.classList.toggle('rcv',m);LS.set('m3u_rcv',m);v.controls=!m;closeL();rb.classList.remove('on');if(m){$('q').value='';$('grp').value='';render();if(!silent&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})}else if(document.fullscreenElement===document.documentElement)document.exitFullscreen().catch(()=>{})}
  rx.onclick=e=>{e.stopPropagation();if(window.WasslaHome)WasslaHome.open()};
  $('player').addEventListener('click',()=>{if(on)open?closeL():openL()});
  document.addEventListener('mousemove',()=>{if(!on)return;rx.classList.add('on');clearTimeout(xT);xT=setTimeout(()=>rx.classList.remove('on'),3000)});
  document.addEventListener('keydown',e=>{
    const t=e.target.tagName;
    if(/INPUT|TEXTAREA|SELECT/.test(t)||document.querySelector('dialog[open]')||stOn()||(window.WasslaHome&&WasslaHome.isOn())||(window.__vodOn&&window.__vodOn())||(window.__qpOn&&window.__qpOn())||e.ctrlKey||e.altKey||e.metaKey)return;
    const k=/^(OK|Select)$/.test(e.key)?'Enter':e.key,stop=()=>{e.preventDefault();e.stopPropagation()};
    if(/^[0-9]$/.test(k)){stop();digit(k);return}
    if(!on)return;
    if(open){menuKey(k,e.repeat);stop();return}
    if(k==='Enter'){stop();if(buf)commit();else openL()}
    else if(k==='Escape'){if(buf){stop();clearTimeout(bufT);buf='';rn.style.display='none'}}
    else if(k==='ArrowLeft'||k==='ArrowRight'){stop();seekBy(k==='ArrowRight'?10:-10)}
    else if(k==='ArrowUp'||k==='ArrowDown'){stop();zapByNumber(k==='ArrowUp'?1:-1)}
    else if(e.code==='KeyI'){stop();const it=shown.find(i=>i.url===curUrl);if(it)banner(it)}
  },true);
  const _play=play;play=function(it){_play(it);if(on)banner(it)};
  window.__rcv={set:setMode};window.__rcvState=()=>({on,open,zone});window.__rcvOpen=function(){if($('grp').value==='__fav'){$('grp').value='';render()}openL()};window.__rcvOpenFav=function(){if(!favs.size){toast('لا توجد قنوات مفضلة');return}$('grp').value='__fav';render();lastG=null;openL();toast('وضع المفضلة — رجوع للخروج منه')};window.__rcvOpenCats=function(){openL();setZone('head')};window.__rcvOpenSources=window.__rcvOpenCats;window.__rcvNumpad=function(){closeL();openNumpad()};window.__rcvClose=closeL;window.__rcvToast=toast;window.__zapNum=zapByNumber;
  window.__rcvRefresh=()=>{if(open){build();sel=Math.min(sel,Math.max(0,rows.children.length-1));mark()}};

  const syncFav=()=>document.body.classList.toggle('favmode',$('grp').value==='__fav');
  const _render=render;render=function(){const r=_render.apply(this,arguments);syncFav();return r};
})();
