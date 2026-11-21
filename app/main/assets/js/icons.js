/* ===== مجموعة أيقونات SVG موحّدة (سماكة وزوايا واحدة) ===== */
(function(){
  const B={
    tv:'<rect x="2.5" y="5" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 18v3"/>',
    dish:'<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19a10 10 0 0 1 0-14"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    server:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    hash:'<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
    power:'<path d="M12 3v9"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    news:'<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2M8.5 8h6M8.5 12h6M8.5 16h4"/>',
    ball:'<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/>',
    smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    radio:'<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l10-4"/><circle cx="9" cy="14" r="2.5"/><path d="M15 12.5h3M15 15.5h3"/>',
    moon:'<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'
  };
  const M=[[/mbc/i,'tv'],[/أخبار|اخبار|news/i,'news'],[/رياض|sport|bein|كرة/i,'ball'],[/أطفال|اطفال|kids|cartoon|toon|كرتون/i,'smile'],
    [/أفلام|افلام|سينما|movie|film|مسلسل|series|دراما/i,'film'],[/موسيق|music|أغاني|اغاني|clip/i,'music'],[/إذاع|اذاع|راديو|radio/i,'radio'],
    [/دين|قرآن|قران|إسلام|اسلام|quran|relig|islam/i,'moon'],[/وثائق|documentary|علوم|طبيعة|science|nature/i,'globe'],[/الجزائر|algeri|dz\b/i,'pin']];
  const ico=(n,f)=>B[n]?'<svg viewBox="0 0 24 24" fill="'+(f===1||f==='f'||f===true?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+B[n]+'</svg>':'';
  const catKey=(v,name)=>{
    if(v==='__fav')return'star';if(v==='__rec')return'clock';if(v==='__avail')return'check';if(v===''||v==='__k_live')return'tv';
    const s=String(name||v||'');for(const m of M)if(m[0].test(s))return m[1];return'folder';
  };
  window.WI={ico:ico,catKey:catKey};
})();
