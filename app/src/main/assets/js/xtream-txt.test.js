const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '../../main/assets/js/xtream-txt.js'),
  'utf8'
);

function loadParser() {
  const window = { addList: async () => false, xtAdd: async () => true };
  vm.runInNewContext(source, { URL, window });
  return window;
}

test('parses keyed, URL, and delimited Xtream credentials', () => {
  const { xtParseTxt } = loadParser();
  for (const text of [
    'host=https://iptv.example:8080\nusername=viewer\npassword=secret',
    'https://iptv.example:8080/get.php?username=viewer&password=secret&type=m3u_plus',
    'https://iptv.example:8080 | viewer | secret',
    'https://iptv.example:8080,viewer,secret',
    'https://iptv.example:8080\nviewer\nsecret'
  ]) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(xtParseTxt(text))),
      [{ host: 'https://iptv.example:8080', user: 'viewer', pass: 'secret', name: '', src: 'explicit' }]
    );
  }
});

test('parses Arabic credential labels and names', () => {
  const { xtParseTxt } = loadParser();
  assert.deepEqual(
    JSON.parse(JSON.stringify(xtParseTxt('السيرفر: http://iptv.example:8080\nالمستخدم: مشاهد\nكلمة المرور: سر\nالاسم: قنوات عربية'))),
    [{ host: 'http://iptv.example:8080', user: 'مشاهد', pass: 'سر', name: 'قنوات عربية', src: 'explicit' }]
  );
});

test('does not interpret M3U text as Xtream credentials', () => {
  const { xtParseTxt } = loadParser();
  assert.deepEqual(
    JSON.parse(JSON.stringify(xtParseTxt('#EXTM3U\n#EXTINF:-1,Channel\nhttps://iptv.example/channel.m3u8'))),
    []
  );
});

test('reports an unsupported TXT format separately from a server failure', async () => {
  const invalidWindow = loadParser();
  await invalidWindow.addList('unsupported credential text', 'account.txt', '');
  assert.match(invalidWindow.__lastImportError, /لم يتم التعرف على بيانات Xtream/);

  const failedWindow = {
    addList: async () => false,
    xtAdd: async () => true,
    xtPrepare: async () => { throw new Error('offline'); }
  };
  vm.runInNewContext(source, { URL, window: failedWindow });
  await failedWindow.addList('host=http://iptv.example:8080\nusername=viewer\npassword=secret', 'account.txt', '');
  assert.match(failedWindow.__lastImportError, /تعذّر الاتصال بسيرفر Xtream/);
});
