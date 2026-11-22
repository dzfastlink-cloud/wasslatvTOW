/* ===== بيان التحديثات (GitHub Releases) =====
   كان هذا الملف مرجعياً في index.html وapp.js لكنه مفقود في المستودع الأصلي. */
(function (root) {
  const MANIFEST_URL =
    'https://github.com/dzfastlink-cloud/wasslatv-downloads/releases/latest/download/android-update.json';

  async function fetchLatest() {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    try {
      const res = await fetch(MANIFEST_URL + '?t=' + Date.now(), {
        cache: 'no-store',
        signal: ac.signal,
      });
      if (!res.ok) throw new Error('Manifest HTTP ' + res.status);
      const data = await res.json();
      const version = String(data.version || data.versionName || '').trim();
      const apkUrl = String(data.apkUrl || data.url || data.downloadUrl || '').trim();
      const notes = String(data.notes || data.changelog || '').trim();
      if (!version || !apkUrl) throw new Error('Invalid update manifest');
      return { version, apkUrl, notes };
    } finally {
      clearTimeout(timer);
    }
  }

  root.WasslaUpdateManifest = { MANIFEST_URL, fetchLatest };
})(typeof window !== 'undefined' ? window : globalThis);
