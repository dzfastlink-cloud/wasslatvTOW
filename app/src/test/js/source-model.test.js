const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '../../../..');
const readWeb = rel => fs.readFileSync(path.join(rootDir, rel), 'utf8');
const readAnd = rel => fs.readFileSync(path.join(rootDir, 'app/src/main/assets', rel), 'utf8');

const sourceModelCode = readWeb('public/js/source-model.js');
const mod = { exports: {} };
vm.runInNewContext(sourceModelCode, { module: mod, exports: mod.exports, window: {} });
const Model = mod.exports;

test('web and Android source-separation assets stay synchronized', () => {
  const pairs = [
    ['public/js/source-model.js', 'js/source-model.js'],
    ['public/js/app.js', 'js/app.js'],
    ['public/js/channels.js', 'js/channels.js'],
    ['public/js/receiver.js', 'js/receiver.js'],
    ['public/js/quickpanel.js', 'js/quickpanel.js'],
    ['public/js/settings.js', 'js/settings.js'],
    ['public/js/vod.js', 'js/vod.js'],
    ['public/js/vod-state.js', 'js/vod-state.js'],
    ['public/css/quickpanel.css', 'css/quickpanel.css'],
    ['public/css/vod.css', 'css/vod.css']
  ];
  for (const [webRel, andRel] of pairs) {
    assert.equal(readWeb(webRel), readAnd(andRel), `${webRel} should match app/src/main/assets/${andRel}`);
  }
});

const clone = v => JSON.parse(JSON.stringify(v));

test('normalizeSelection filters unknown IDs, deduplicates, and respects defaultAll', () => {
  assert.deepEqual(clone(Model.normalizeSelection(null, ['s1', 's2'], true)), ['s1', 's2']);
  assert.deepEqual(clone(Model.normalizeSelection(null, ['s1', 's2'], false)), []);
  assert.deepEqual(clone(Model.normalizeSelection(['s2', 'missing', 's2', 's1'], ['s1', 's2', 's3'], false)), ['s2', 's1']);
  assert.deepEqual(clone(Model.normalizeSelection([], ['s1', 's2'], true)), []);
});

test('toggleSelection adds and removes sources without affecting other checked IDs', () => {
  let sel = ['s1', 's2'];
  sel = clone(Model.toggleSelection(sel, 's3', ['s1', 's2', 's3']));
  assert.deepEqual(sel, ['s1', 's2', 's3']);
  sel = clone(Model.toggleSelection(sel, 's2', ['s1', 's2', 's3']));
  assert.deepEqual(sel, ['s1', 's3']);
  sel = clone(Model.toggleSelection(sel, 's1', ['s1', 's2', 's3']));
  assert.deepEqual(sel, ['s3']);
  sel = clone(Model.toggleSelection(sel, 's3', ['s1', 's2', 's3']));
  assert.deepEqual(sel, []);
  sel = clone(Model.toggleSelection(sel, 'unknown', ['s1', 's2', 's3']));
  assert.deepEqual(sel, []);
});

test('reconcileAddedSource auto-checks newly discovered sources while keeping user unchecks intact', () => {
  const first = clone(Model.reconcileAddedSource(null, [], ['s1', 's2']));
  assert.deepEqual(first.selected, ['s1', 's2']);
  assert.deepEqual(first.known, ['s1', 's2']);

  // User unchecks s1; later s3 is added -> s1 stays unchecked, s2 stays checked, s3 is auto-checked
  const next = clone(Model.reconcileAddedSource(['s2'], first.known, ['s1', 's2', 's3']));
  assert.deepEqual(next.selected, ['s2', 's3']);
  assert.deepEqual(next.known, ['s1', 's2', 's3']);

  // Selective filter prevents non-eligible sources from auto-enabling
  const filtered = clone(Model.reconcileAddedSource(['s2'], ['s1', 's2'], ['s1', 's2', 's4'], id => id !== 's4'));
  assert.deepEqual(filtered.selected, ['s2']);
});

test('summarizeSelection formats empty, single, partial, and all-selected summaries', () => {
  const cands = [
    { id: 'a', name: 'باقة الرياضة' },
    { id: 'b', name: 'أفلام كلاسيك' },
    { id: 'c', name: 'وثائقيات' }
  ];
  assert.equal(Model.summarizeSelection([], cands, 'غير محدد'), 'غير محدد');
  assert.equal(Model.summarizeSelection(['b'], cands), 'أفلام كلاسيك');
  assert.equal(Model.summarizeSelection(['a', 'c'], cands), '2 مصادر من 3');
  assert.equal(Model.summarizeSelection(['a', 'b', 'c'], cands), 'كل المصادر (3)');
});

test('Live TV and VOD Library use completely independent storage keys and multi-select popovers', () => {
  const appJs = readWeb('public/js/app.js');
  const vodJs = readWeb('public/js/vod.js');
  const qpJs = readWeb('public/js/quickpanel.js');
  const settingsJs = readWeb('public/js/settings.js');
  const webHtml = readWeb('index.html');
  const andHtml = readAnd('index.html');

  assert.match(appJs, /LS\.get\('m3u_live_sources'/);
  assert.match(appJs, /LS\.set\('m3u_live_known_sources'/);
  assert.doesNotMatch(appJs, /m3u_vod_sources/);

  assert.match(vodJs, /LS\.get\('m3u_vod_sources'/);
  assert.match(vodJs, /LS\.get\('m3u_vod_known_sources'/);
  assert.doesNotMatch(vodJs, /m3u_live_sources/);

  assert.match(qpJs, /qd-chk/);
  assert.match(qpJs, /window\.__liveSources\.toggle/);
  assert.match(vodJs, /vsrc-chk/);
  assert.match(vodJs, /window\.__vodSources\.toggle/);
  assert.match(settingsJs, /liveSourcesPicker/);
  assert.match(settingsJs, /vodSourcesPicker/);

  for (const html of [webHtml, andHtml]) {
    assert.match(html, /id="vodsrcwrap"/);
    assert.match(html, /id="vodsrcpop"/);
  }
});
