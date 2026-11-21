/* ===== طبقة التوافق للويب: تمرير الروابط الخارجية عبر خادم الوسيط + اختصارات لوحة المفاتيح ===== */
(function () {
  if (window.Android) return;

  const isHttpPage = location.protocol === 'http:' || location.protocol === 'https:';

  function shouldProxy(urlStr) {
    if (!isHttpPage || !urlStr || typeof urlStr !== 'string') return false;
    if (!/^https?:\/\//i.test(urlStr)) return false;
    try {
      const parsed = new URL(urlStr, location.href);
      if (parsed.origin === location.origin) return false;
      return true;
    } catch {
      return false;
    }
  }

  function splitPipeHeaders(rawUrl) {
    const str = String(rawUrl || '');
    const idx = str.indexOf('|');
    if (idx < 0) return { url: str, ua: '', ref: '' };
    const url = str.slice(0, idx).trim();
    const tail = str.slice(idx + 1);
    let ua = '';
    let ref = '';
    tail.split('&').forEach((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) return;
      const k = part.slice(0, eq).trim().toLowerCase();
      let v = part.slice(eq + 1).trim();
      try { v = decodeURIComponent(v); } catch {}
      if (k === 'user-agent') ua = v;
      else if (k === 'referer' || k === 'referrer') ref = v;
    });
    return { url, ua, ref };
  }

  window.__splitStreamUrl = splitPipeHeaders;

  window.__proxyUrl = function (urlStr, isHls, opts) {
    const parsed = splitPipeHeaders(urlStr);
    const cleanUrl = parsed.url;
    if (!shouldProxy(cleanUrl)) return cleanUrl;
    const ua = (opts && opts.ua) || parsed.ua || '';
    const ref = (opts && opts.ref) || parsed.ref || '';
    let out = '/api/proxy?url=' + encodeURIComponent(cleanUrl) + (isHls ? '&hls=1' : '');
    if (ua) out += '&ua=' + encodeURIComponent(ua);
    if (ref) out += '&ref=' + encodeURIComponent(ref);
    return out;
  };

  /* تمرير fetch للروابط الخارجية (قوائم M3U، Xtream API، بيانات VOD، التحديثات) عبر /api/proxy لتفادي CORS والمحتوى المختلط */
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input && input.url;
      if (urlStr && shouldProxy(urlStr)) {
        const proxied = window.__proxyUrl(urlStr, false);
        if (typeof input === 'string' || input instanceof URL) {
          return nativeFetch(proxied, init);
        }
        return nativeFetch(new Request(proxied, input), init);
      }
    } catch {
      /* fallback to native fetch */
    }
    return nativeFetch(input, init);
  };

  /* إعادة توجيه شعارات القنوات HTTP على صفحات HTTPS لتفادي حظر المحتوى المختلط */
  function fixImg(img) {
    if (!img || img.tagName !== 'IMG') return;
    const raw = img.getAttribute('src');
    if (raw && /^http:\/\//i.test(raw) && location.protocol === 'https:') {
      img.setAttribute('src', window.__proxyUrl(raw, false));
    }
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'src') {
        fixImg(m.target);
      } else if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'IMG') fixImg(node);
          else if (node.querySelectorAll) node.querySelectorAll('img[src^="http://"]').forEach(fixImg);
        });
      }
    }
  });

  if (document.documentElement) {
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }

  /* منتقي الملفات المحلي للمتصفح (بديل Android.pickFile في settings.js) */
  window.__webPickFile = function () {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.m3u,.m3u8,.txt,.json,audio/x-mpegurl,application/vnd.apple.mpegurl';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      let settled = false;
      const done = (res) => {
        if (settled) return;
        settled = true;
        inp.remove();
        resolve(res);
      };
      inp.onchange = () => {
        const file = inp.files && inp.files[0];
        if (!file) return done({ ok: false, why: 'cancel' });
        if (file.size > 20 * 1024 * 1024) return done({ ok: true, name: file.name, text: '' });
        const reader = new FileReader();
        reader.onload = () => done({ ok: true, name: file.name, text: String(reader.result || '') });
        reader.onerror = () => done({ ok: false, why: 'error' });
        reader.readAsText(file, 'UTF-8');
      };
      inp.addEventListener('cancel', () => done({ ok: false, why: 'cancel' }));
      inp.click();
    });
  };

  /* تنزيل ملف نصي على المتصفح (بديل Android.saveFile عند تصدير حساب Xtream) */
  window.__webSaveFile = function (filename, text) {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return filename;
    } catch {
      return '';
    }
  };

  /* دعم زر Escape / Backspace للرجوع في الويب (ما كان يعالجه WebActivity.onBackPressed + nav.js على أندرويد) */
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace') return;
      const el = document.activeElement;
      const isEditable =
        el &&
        ((el.tagName === 'INPUT' && !el.readOnly && /^(|text|search|url|number|tel|email|password)$/.test(el.type)) ||
          (el.tagName === 'TEXTAREA' && !el.readOnly));
      if (isEditable) {
        if (e.key === 'Escape') {
          e.preventDefault();
          el.blur();
        }
        return;
      }

      if (document.querySelector('dialog[open]')) return;

      if (window.__qpBack && window.__qpBack()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (window.__qpOn && window.__qpOn()) {
        e.preventDefault();
        e.stopPropagation();
        if (window.__quickClose) window.__quickClose(true);
        return;
      }
      if (window.__stOn && window.__stOn()) {
        e.preventDefault();
        e.stopPropagation();
        if (window.__stBack) window.__stBack();
        return;
      }
      if (window.__vodOn && window.__vodOn()) {
        return; // vod.js handles Escape/Backspace natively
      }
      const rcv = window.__rcvState ? window.__rcvState() : { on: false, open: false };
      if (rcv.on && !rcv.open) {
        e.preventDefault();
        e.stopPropagation();
        if (window.__openQuick) window.__openQuick();
      }
    },
    true
  );
})();
