const assert = require('node:assert/strict');
const test = require('node:test');
// الجذر فيه package.json بنوع "module" (لمعاينة الويب) فلا يصلح require مباشر لملفات الواجهة؛ نحمّلها كـ CommonJS.
const fs = require('node:fs');
const path = require('node:path');
const load = (rel) => {
  const m = { exports: {} };
  new Function('module', 'exports', fs.readFileSync(path.join(__dirname, rel), 'utf8'))(m, m.exports);
  return m.exports;
};
const { parseM3U, serializeM3U, setM3UName } = load('../../main/assets/js/m3u.js');

test('parses the complete title when it contains commas', () => {
  const [item] = parseM3U('#EXTM3U\n#EXTINF:-1,News, World, Live\nhttps://example.test/stream');
  assert.equal(item.name, 'News, World, Live');
});

test('ignores commas inside quoted attributes and preserves Arabic title text', () => {
  const [item] = parseM3U('#EXTM3U\n#EXTINF:-1 tvg-name="اسم, بديل" group-title="أخبار, عربية",قناة الأخبار, مباشر\nhttps://example.test/stream');
  assert.equal(item.name, 'قناة الأخبار, مباشر');
  assert.equal(item.group, 'أخبار, عربية');
});

test('renaming, saving, and reparsing preserves metadata and comma-containing titles', () => {
  const [item] = parseM3U('#EXTM3U\n#EXTINF:-1 tvg-id="news" tvg-name="قناة, عربية" group-title="أخبار, عربية",الاسم القديم\n#EXTVLCOPT:http-user-agent=TV\nhttps://example.test/news');
  setM3UName(item, 'الأخبار, بث مباشر');

  const [saved] = parseM3U(serializeM3U([item]));
  assert.equal(saved.name, 'الأخبار, بث مباشر');
  assert.equal(saved.group, 'أخبار, عربية');
  assert.match(saved.raw, /tvg-id="news" tvg-name="قناة, عربية" group-title="أخبار, عربية"/);
  assert.deepEqual(saved.extra, ['#EXTVLCOPT:http-user-agent=TV']);
});
