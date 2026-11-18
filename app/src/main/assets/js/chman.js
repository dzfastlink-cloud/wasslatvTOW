/* ===== إدارة القنوات والمجموعات: شاشة واحدة لكل مصدر =====
   عمودان: المجموعات | قنوات المجموعة المحددة.  OK على أي عنصر ← قائمة إجراءات:
   نقل للأعلى/الأسفل · «تحريك بالأسهم» (↑↓ ثم OK) · نقل إلى مجموعة · إعادة تسمية · تعديل الرابط · حذف.
   الحفظ تلقائي (بعد كل تغيير بنصف ثانية) ويعمل مع القوائم العادية والقائمة المدمجة (ترقيم القنوات).
   المفاتيح: ↑↓ داخل العمود · ←/→ بين العمودين · رجوع: إغلاق. */
(function(){
  const root=$('cm'),gl=$('cmgl'),cl=$('cmcl'),menuEl=$('cmenu'),ml=$('cmml'),mt=$('cmmt'),foot=$('cmf'),stEl=$('cmst');
  const H=56;
  let on=false,id='',L=null,builtin=false,groups=[],others=[],removed=[],gi=0,ci=0,zone='g',grab=null;
  let menu=null,mi=0,saveT=null,saving=false,again=false;
  const rtl=()=>getComputedStyle(document.documentElement).direction==='rtl';
  const NOG='بدون مجموعة';
  const numOfRaw=it=>{const m=it.raw&&/channel-number="(\d+)"/.exec(it.raw);return m?+m[1]:0};
  const gname=g=>g.name||NOG;

  /* ---------- أدوات تعديل عنصر M3U ---------- */
  function setName(it,v){it.name=v;if(it.raw){const i=it.raw.lastIndexOf(',');it.raw=(i>-1?it.raw.slice(0,i):it.raw)+','+v}else it.raw='#EXTINF:-1,'+v}
  function setGroup(it,g){
    g=g.replace(/"/g,'');it.group=g;
    if(!it.raw)it.raw='#EXTINF:-1,'+it.name;
    if(/group-title="[^"]*"/.test(it.raw))it.raw=it.raw.replace(/group-title="[^"]*"/,'group-title="'+g+'"');
    else it.raw=it.raw.replace(/^#EXTINF:(-?\d+)/,'#EXTINF:$1 group-title="'+g+'"');
  }

  /* ---------- بناء النموذج ---------- */
  function load(){
    L=lists.find(x=>x.id===id);if(!L)return false;
    builtin=id==='builtin'&&!!window.__chKey&&!!window.__chSetMany;
    const its=parseM3U(L.text),m=new Map();others=[];removed=[];
    its.forEach((it,i)=>{
      const k=detectKind(it);
      if(k!=='live'&&k!=='radio'){others.push(it);return}
      it._o={n:numOfRaw(it)||i+1,name:it.name,group:it.group||'',url:it.url};
      const g=it.group||'';if(!m.has(g))m.set(g,{name:g,items:[]});m.get(g).items.push(it);
    });
    groups=[...m.values()];gi=0;ci=0;return true;
  }

  /* ---------- الحفظ ---------- */
  function mark(){stEl.textContent='جارٍ الحفظ…';clearTimeout(saveT);saveT=setTimeout(flush,600)}
  async function flush(){
    clearTimeout(saveT);saveT=null;
    if(saving){again=true;return}
    if(!L)return;saving=true;
    try{
      const flat=[];groups.forEach(g=>g.items.forEach(it=>flat.push(it)));
      if(builtin){
        const p=[];
        flat.forEach((it,i)=>{
          const k=window.__chKey(it);if(k==null)return;
          const o=it._o||{},patch={};
          if(o.n!==i+1)patch.n=i+1;
          if(o.name!==it.name)patch.name=it.name;
          if((o.group||'')!==(it.group||''))patch.group=it.group||'';
          if(o.url!==it.url)patch.url=it.url;
          if(Object.keys(patch).length)p.push([k,patch]);
          it._o={n:i+1,name:it.name,group:it.group||'',url:it.url};
        });
        removed.forEach(it=>{const k=window.__chKey(it);if(k!=null)p.push([k,{deleted:true}])});removed=[];
        if(p.length)window.__chSetMany(p);
      }else{
        const all=flat.concat(others);
        L.text=ser(all);L.n=all.length;L.upd=Date.now();
        await saveLists();
        if(active===id)openList(id);
      }
      stEl.textContent='تم الحفظ ✓';
    }catch(e){stEl.textContent='تعذّر الحفظ'}
    saving=false;
    if(again){again=false;flush()}
  }

  /* ---------- الرسم ---------- */
  function paintGroups(){
    gl.textContent='';
    const fr=document.createDocumentFragment();
    groups.forEach((g,i)=>{
      const r=document.createElement('div');r.className='cmr'+(i===gi?' cur':'')+(i===gi&&zone==='g'?' sel':'')+(grab&&grab.t==='g'&&i===gi?' grab':'');
      r.dataset.i=i;
      r.innerHTML='<span class="n"></span><span class="t"></span><button type="button" class="cmk" tabindex="-1" title="إجراءات">⋯</button>';
      r.children[0].textContent=g.items.length;r.children[1].textContent=gname(g);
      fr.appendChild(r);
    });
    gl.appendChild(fr);
    $('cmgc').textContent=groups.length+' مجموعة';
    const s=gl.querySelector('.cur');if(s)keepVisible(gl,s);
  }
  function paintChans(){
    const g=groups[gi];
    $('cmcn').textContent=g?gname(g):'القنوات';
    $('cmcc').textContent=g?g.items.length+' قناة':'';
    cl.textContent='';
    if(!g||!g.items.length){
      const d=document.createElement('div');d.className='cmempty';
      d.textContent=groups.length?'هذه المجموعة فارغة':'لا توجد قنوات مباشرة في هذا المصدر.\nالأفلام والمسلسلات تُدار من «المكتبة».';
      cl.appendChild(d);return;
    }
    const sp=document.createElement('div');sp.className='cmsp2';sp.style.height=g.items.length*H+'px';cl.appendChild(sp);
    paintWindow();
  }
  function paintWindow(){
    const g=groups[gi];if(!g||!g.items.length)return;
    const sp=cl.querySelector('.cmsp2');if(!sp)return;
    sp.textContent='';
    const top=cl.scrollTop,vh=cl.clientHeight||600;
    const a=Math.max(0,Math.floor(top/H)-4),b=Math.min(g.items.length,Math.ceil((top+vh)/H)+4),fr=document.createDocumentFragment();
    for(let i=a;i<b;i++){
      const it=g.items[i],r=document.createElement('div');
      r.className='cmr'+(i===ci?' cur':'')+(i===ci&&zone==='c'?' sel':'')+(grab&&grab.t==='c'&&i===ci?' grab':'');
      r.dataset.i=i;r.style.top=i*H+'px';
      r.innerHTML='<span class="n"></span><span class="t"></span><button type="button" class="cmk" tabindex="-1" title="إجراءات">⋯</button>';
      r.children[0].textContent=i+1;r.children[1].textContent=it.name;
      fr.appendChild(r);
    }
    sp.appendChild(fr);
  }
  function keepVisible(box,row){
    const t=row.offsetTop,h=row.offsetHeight;
    if(t<box.scrollTop)box.scrollTop=t-4;else if(t+h>box.scrollTop+box.clientHeight)box.scrollTop=t+h-box.clientHeight+4;
  }
  function ensureChan(){
    const t=ci*H;
    if(t<cl.scrollTop)cl.scrollTop=t;else if(t+H>cl.scrollTop+cl.clientHeight)cl.scrollTop=t+H-cl.clientHeight;
    paintWindow();
  }
  function paintFoot(){
    let h;
    if(menu)h=['↑ ↓ اختيار','OK تنفيذ','رجوع: إغلاق القائمة'];
    else if(grab)h=['↑ ↓ تحريك العنصر','OK أو رجوع: تثبيت المكان'];
    else h=['↑ ↓ تنقل','← → بين المجموعات والقنوات','OK إجراءات (نقل · تسمية · حذف)','رجوع: إغلاق'];
    foot.innerHTML=h.map(x=>'<span>'+x+'</span>').join('');
  }
  function paintAll(){paintGroups();paintChans();paintFoot();$('cmsub').textContent=L?L.name+' — '+groups.reduce((n,g)=>n+g.items.length,0)+' قناة':''}
  function refreshSel(){
    gl.querySelectorAll('.cmr').forEach(r=>{const i=+r.dataset.i;r.classList.toggle('cur',i===gi);r.classList.toggle('sel',i===gi&&zone==='g');r.classList.toggle('grab',!!grab&&grab.t==='g'&&i===gi)});
    const s=gl.querySelector('.cur');if(s)keepVisible(gl,s);
    paintWindow();
  }

  /* ---------- العمليات ---------- */
  function moveGroup(d){
    const j=gi+d;if(j<0||j>=groups.length)return false;
    const t=groups[gi];groups[gi]=groups[j];groups[j]=t;gi=j;mark();return true;
  }
  function moveChan(d){
    const g=groups[gi],j=ci+d;if(!g||j<0||j>=g.items.length)return false;
    const t=g.items[ci];g.items[ci]=g.items[j];g.items[j]=t;ci=j;mark();return true;
  }
  async function renameGroup(){
    const g=groups[gi];if(!g)return;
    const v=await kbPrompt('اسم المجموعة الجديد',g.name);if(v===null)return;
    const nv=v.trim().replace(/"/g,'');if(!nv){say('اكتب اسماً للمجموعة');return}
    const ex=groups.findIndex((x,i)=>i!==gi&&x.name===nv);
    g.items.forEach(it=>setGroup(it,nv));
    if(ex>=0){groups[ex].items.push(...g.items);groups.splice(gi,1);gi=ex>gi?ex-1:ex}else g.name=nv;
    ci=0;mark();paintAll();
  }
  async function deleteGroup(){
    const g=groups[gi];if(!g)return;
    if(builtin)g.items.forEach(it=>removed.push(it));
    groups.splice(gi,1);gi=Math.min(gi,Math.max(0,groups.length-1));ci=0;mark();paintAll();
  }
  async function renameChan(){
    const it=(groups[gi]||{items:[]}).items[ci];if(!it)return;
    const v=await kbPrompt('اسم القناة',it.name);if(v===null)return;
    const nv=v.trim();if(!nv){say('لا يمكن ترك الاسم فارغاً');return}
    setName(it,nv);mark();paintWindow();
  }
  async function editUrl(){
    const it=(groups[gi]||{items:[]}).items[ci];if(!it)return;
    const v=await kbPrompt('رابط القناة',it.url,'en');if(v===null)return;
    const nv=v.trim();if(!/^(https?|rtmp|rtsp|udp):\/\//i.test(nv)){say('رابط غير صالح');return}
    it.url=nv;mark();
  }
  function deleteChan(){
    const g=groups[gi];if(!g)return;
    const it=g.items.splice(ci,1)[0];if(builtin&&it)removed.push(it);
    if(!g.items.length){groups.splice(gi,1);gi=Math.min(gi,Math.max(0,groups.length-1));ci=0;zone='g'}
    else ci=Math.min(ci,g.items.length-1);
    mark();paintAll();
  }
  async function moveToGroup(target){
    const g=groups[gi];if(!g)return;
    let t;
    if(target===-1){
      const v=await kbPrompt('اسم المجموعة الجديدة','');if(v===null)return;
      const nv=v.trim().replace(/"/g,'');if(!nv)return;
      t=groups.find(x=>x.name===nv);if(!t){t={name:nv,items:[]};groups.push(t)}
    }else t=groups[target];
    if(!t||t===g)return;
    const it=g.items.splice(ci,1)[0];setGroup(it,t.name);t.items.push(it);
    if(!g.items.length){groups.splice(groups.indexOf(g),1);gi=Math.max(0,Math.min(gi,groups.length-1))}
    ci=Math.min(ci,Math.max(0,(groups[gi]||{items:[]}).items.length-1));
    mark();paintAll();toastIn('نُقلت إلى «'+gname(t)+'»');
  }
  function say(t){stEl.textContent=t;setTimeout(()=>{if(stEl.textContent===t)stEl.textContent=''},2500)}
  const toastIn=say;

  /* ---------- قائمة الإجراءات ---------- */
  function openMenu(title,items){
    menu=items.filter(Boolean);mi=0;mt.textContent=title;ml.textContent='';
    menu.forEach((m,i)=>{
      const d=document.createElement('div');d.className='cmi'+(m.danger?' danger':'');d.dataset.i=i;
      d.innerHTML='<i></i><span></span>';d.children[0].textContent=m.i||'';d.children[1].textContent=m.l;ml.appendChild(d);
    });
    menuEl.classList.add('on');markMenu();paintFoot();
  }
  function markMenu(){
    [...ml.children].forEach((d,i)=>d.classList.toggle('sel',i===mi));
    const s=ml.children[mi];if(s)s.scrollIntoView({block:'nearest'});
  }
  function closeMenu(){menu=null;menuEl.classList.remove('on');paintFoot()}
  function runMenu(i){const m=menu&&menu[i];if(!m)return;closeMenu();m.run()}
  function confirmMenu(title,label,fn){openMenu(title,[{i:'🗑',l:label,danger:true,run:fn},{i:'↩',l:'إلغاء',run:()=>{}}]);mi=1;markMenu()}

  function groupMenu(){
    const g=groups[gi];if(!g)return;
    openMenu('المجموعة: '+gname(g),[
      gi>0?{i:'⬆',l:'نقل للأعلى',run:()=>{moveGroup(-1);paintAll()}}:null,
      gi<groups.length-1?{i:'⬇',l:'نقل للأسفل',run:()=>{moveGroup(1);paintAll()}}:null,
      {i:'⇅',l:'تحريك بالأسهم',run:()=>{grab={t:'g'};paintFoot();refreshSel()}},
      {i:'✎',l:'إعادة تسمية المجموعة',run:renameGroup},
      {i:'🗑',l:'حذف المجموعة بكل قنواتها ('+g.items.length+')',danger:true,run:()=>confirmMenu('حذف «'+gname(g)+'»؟','نعم، احذف المجموعة وقنواتها',deleteGroup)}
    ]);
  }
  function chanMenu(){
    const g=groups[gi],it=g&&g.items[ci];if(!it)return;
    const others_=groups.map((x,i)=>({x,i})).filter(o=>o.i!==gi);
    openMenu(it.name,[
      ci>0?{i:'⬆',l:'نقل للأعلى',run:()=>{moveChan(-1);ensureChan()}}:null,
      ci<g.items.length-1?{i:'⬇',l:'نقل للأسفل',run:()=>{moveChan(1);ensureChan()}}:null,
      {i:'⇅',l:'تحريك بالأسهم',run:()=>{grab={t:'c'};paintFoot();paintWindow()}},
      {i:'📁',l:'نقل إلى مجموعة…',run:()=>openMenu('نقل «'+it.name+'» إلى',
        others_.slice(0,200).map(o=>({i:'📁',l:gname(o.x)+' ('+o.x.items.length+')',run:()=>moveToGroup(o.i)})).concat([{i:'＋',l:'مجموعة جديدة…',run:()=>moveToGroup(-1)}]))},
      {i:'✎',l:'تعديل الاسم',run:renameChan},
      {i:'🔗',l:'تعديل الرابط',run:editUrl},
      {i:'🗑',l:'حذف القناة',danger:true,run:()=>confirmMenu('حذف «'+it.name+'»؟','نعم، احذف القناة',deleteChan)}
    ]);
  }
  const openCurMenu=()=>zone==='g'?groupMenu():chanMenu();

  /* ---------- لوحة المفاتيح ---------- */
  document.addEventListener('keydown',e=>{
    if(!on||document.querySelector('dialog[open]'))return;
    if(e.ctrlKey||e.altKey||e.metaKey)return;
    e.preventDefault();e.stopPropagation();
    const k=/^(OK|Select)$/.test(e.key)?'Enter':e.key;
    if(menu){
      if(k==='ArrowDown')mi=Math.min(menu.length-1,mi+1);
      else if(k==='ArrowUp')mi=Math.max(0,mi-1);
      else if(k==='Enter'){runMenu(mi);return}
      else if(k==='Escape'||k==='Backspace'){closeMenu();return}
      markMenu();return;
    }
    const r=rtl(),toC=r?'ArrowLeft':'ArrowRight',toG=r?'ArrowRight':'ArrowLeft';
    if(grab){
      if(k==='ArrowUp'||k==='ArrowDown'){
        const d=k==='ArrowUp'?-1:1;
        if(grab.t==='g'){if(moveGroup(d))paintAll()}else if(moveChan(d))ensureChan();
      }else if(k==='Enter'||k==='Escape'||k==='Backspace'){grab=null;paintFoot();refreshSel()}
      return;
    }
    if(k==='Escape'||k==='Backspace'){close();return}
    if(k==='ContextMenu'||k==='F3'||k==='i'||k==='I'){openCurMenu();return}
    if(k==='Enter'){openCurMenu();return}
    if(k===toC&&zone==='g'&&groups[gi]&&groups[gi].items.length){zone='c';ci=Math.min(ci,groups[gi].items.length-1);refreshSel();return}
    if(k===toG&&zone==='c'){zone='g';refreshSel();return}
    const step=k==='ArrowDown'?1:k==='ArrowUp'?-1:k==='PageDown'?8:k==='PageUp'?-8:0;
    if(k==='Home'||k==='End'){
      if(zone==='g'){gi=k==='Home'?0:groups.length-1;ci=0;paintChans()}else{ci=k==='Home'?0:groups[gi].items.length-1;ensureChan()}
      refreshSel();return;
    }
    if(!step)return;
    if(zone==='g'){
      const n=Math.max(0,Math.min(groups.length-1,gi+step));
      if(n!==gi){gi=n;ci=0;cl.scrollTop=0;paintChans();refreshSel()}
    }else{
      const g=groups[gi];if(!g)return;
      ci=Math.max(0,Math.min(g.items.length-1,ci+step));ensureChan();
    }
  },true);

  /* ---------- فأرة/لمس ---------- */
  gl.addEventListener('click',e=>{
    const r=e.target.closest('.cmr');if(!r)return;
    const i=+r.dataset.i,was=(i===gi&&zone==='g');
    if(i!==gi){gi=i;ci=0;cl.scrollTop=0;paintChans()}
    zone='g';refreshSel();
    if(e.target.closest('.cmk')||was)groupMenu();
  });
  cl.addEventListener('click',e=>{
    const r=e.target.closest('.cmr');if(!r)return;
    const i=+r.dataset.i,was=(i===ci&&zone==='c');
    ci=i;zone='c';paintWindow();
    if(e.target.closest('.cmk')||was)chanMenu();
  });
  cl.addEventListener('scroll',()=>{if(on)paintWindow()},{passive:true});
  ml.addEventListener('click',e=>{const d=e.target.closest('.cmi');if(d){mi=+d.dataset.i;runMenu(mi)}});
  menuEl.addEventListener('click',e=>{if(e.target===menuEl)closeMenu()});
  $('cmdone').onclick=()=>close();

  /* ---------- فتح/إغلاق ---------- */
  function open(srcId){
    id=srcId||'';
    if(!id){const u=lists.filter(l=>l.id!==FAV_LIST_ID);id=u.length?u[0].id:''}
    if(!load()){return}
    on=true;zone='g';grab=null;menu=null;stEl.textContent='';
    root.classList.add('on');menuEl.classList.remove('on');
    paintAll();cl.scrollTop=0;
  }
  async function close(){
    if(!on)return;
    on=false;grab=null;menu=null;root.classList.remove('on');
    if(saveT)await flush();
    if(window.__openSettings)window.__openSettings('channels');
  }
  window.__openChanMan=open;
  window.__cmOn=()=>on;
  window.__cmBack=()=>{
    if(!on)return false;
    if(menu){closeMenu();return true}
    if(grab){grab=null;paintFoot();refreshSel();return true}
    close();return true;
  };
})();
