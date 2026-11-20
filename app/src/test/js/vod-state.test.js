const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod-state.js'), 'utf8');
const window = {};
vm.runInNewContext(source, { window });
const S = window.WasslaVodState;
/* كائنات vm من سياق آخر: نطبّعها قبل deepEqual */
const plain = (x) => JSON.parse(JSON.stringify(x));
const Remote = (() => {
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod-remote.js'), 'utf8'), { window: w });
  return w.WasslaVodRemote;
})();

test('every declared screen has an edge table and all edges point at real screens', () => {
  for (const screen of S.SCREENS) {
    assert.ok(S.SCREEN_EDGES[screen], `missing edges for ${screen}`);
    for (const to of S.SCREEN_EDGES[screen]) assert.ok(S.SCREENS.includes(to), `${screen} -> ${to}`);
  }
});

test('screen transitions: legal paths pass, illegal ones are rejected', () => {
  assert.equal(S.canGo('home', 'details'), true);
  assert.equal(S.canGo('details', 'trailer'), true);
  assert.equal(S.canGo('trailer', 'details'), true);
  assert.equal(S.canGo('series', 'player'), true);
  assert.equal(S.canGo('home', 'trailer'), false, 'trailer opens only from details');
  assert.equal(S.canGo('trailer', 'series'), false);
  assert.equal(S.canGo('home', 'nowhere'), false);
});

test('going to home or staying put is always allowed (open / repaint)', () => {
  for (const from of S.SCREENS) {
    assert.equal(S.canGo(from, 'home'), true);
    assert.equal(S.canGo(from, from), true);
  }
});

test('player mode projects onto the legacy body classes other modules still read', () => {
  assert.deepEqual(plain(S.projectPlayer('full', 'mini').classes), { 'cine-play': true, 'cine-mini': false, 'vod-player-open': true });
  assert.deepEqual(plain(S.projectPlayer('mini', 'full').classes), { 'cine-play': false, 'cine-mini': true, 'vod-player-open': false });
  assert.deepEqual(plain(S.projectPlayer('closed', 'mini').classes), { 'cine-play': false, 'cine-mini': false, 'vod-player-open': false });
});

test('exactly one of full / mini / closed is ever active', () => {
  for (const mode of S.PLAYER_MODES) {
    const c = S.projectPlayer(mode, 'closed').classes;
    assert.ok(!(c['cine-play'] && c['cine-mini']), `${mode}: full and mini together`);
  }
});

test('layers: the library is hidden only while the player is full-screen', () => {
  assert.deepEqual(plain(S.projectPlayer('full', 'mini').layers), { library: false, playerOverlay: true });
  assert.deepEqual(plain(S.projectPlayer('mini', 'full').layers), { library: true, playerOverlay: false });
  assert.deepEqual(plain(S.projectPlayer('closed', 'closed').layers), { library: true, playerOverlay: false });
});

test('leaving full-screen clears the hidden-track flag and fit modes; entering it does not', () => {
  const leaving = S.projectPlayer('mini', 'full').remove;
  for (const cls of ['cine-track-hidden', 'vod-fit-contain', 'vod-fit-cover', 'vod-fit-zoom']) assert.ok(leaving.includes(cls), cls);
  assert.ok(!leaving.includes('vod-detail-play'), 'minimize keeps the embedded details player');
  assert.deepEqual(plain(S.projectPlayer('full', 'mini').remove), []);
});

test('closing clears every playback class, including the details-player and large-subtitle flags', () => {
  const rm = S.projectPlayer('closed', 'mini').remove;
  for (const cls of ['cine-track-hidden', 'vod-detail-play', 'vod-fit-contain', 'vod-fit-cover', 'vod-fit-zoom', 'vod-sub-large']) assert.ok(rm.includes(cls), cls);
});

test('back closes only the topmost layer, in the agreed priority order', () => {
  const base = { on: true, screen: 'home', mode: 'closed' };
  assert.equal(S.backAction({ on: false }), 'none');
  assert.equal(S.backAction({ ...base, srcPopOpen: true, screen: 'trailer', mode: 'full' }), 'closeSourcePop');
  assert.equal(S.backAction({ ...base, screen: 'trailer' }), 'closeTrailer');
  assert.equal(S.backAction({ ...base, mode: 'full', optsOpen: true, upNextVisible: true }), 'closeOptions');
  assert.equal(S.backAction({ ...base, mode: 'full', upNextVisible: true }), 'dismissUpNext');
  assert.equal(S.backAction({ ...base, mode: 'full' }), 'minimize');
  assert.equal(S.backAction({ ...base, screen: 'details', mode: 'mini' }), 'returnFromDetails');
  assert.equal(S.backAction({ ...base, screen: 'series' }), 'seriesToHome');
  assert.equal(S.backAction(base), 'exit');
});

test('back on a mini player needs a double press to stop playback', () => {
  const mini = { on: true, screen: 'home', mode: 'mini' };
  assert.equal(S.backAction({ ...mini, stopArmed: false }), 'armStop');
  assert.equal(S.backAction({ ...mini, stopArmed: true }), 'stopPlayer');
});

test('walking full -> mini -> double back -> exit never skips a layer', () => {
  const steps = [];
  let ctx = { on: true, screen: 'home', mode: 'full' };
  steps.push(S.backAction(ctx));                       // full -> minimize
  ctx = { ...ctx, mode: 'mini' };
  steps.push(S.backAction(ctx));                       // mini -> arm
  steps.push(S.backAction({ ...ctx, stopArmed: true })); // mini armed -> stop
  ctx = { ...ctx, mode: 'closed' };
  steps.push(S.backAction(ctx));                       // closed -> exit
  assert.deepEqual(steps, ['minimize', 'armStop', 'stopPlayer', 'exit']);
});

test('key routing: state maps onto WasslaVodRemote.routeKey', () => {
  const route = (s, key) => Remote.routeKey(S.keyRouteState(s), key);
  assert.equal(route({ mode: 'full', screen: 'home' }, 'ArrowLeft'), 'fullscreen');
  assert.equal(route({ mode: 'mini', screen: 'home' }, 'MediaPlayPause'), 'media');
  assert.equal(route({ mode: 'mini', screen: 'details', playerFromDetails: true }, 'PageDown'), 'media');
  assert.equal(route({ mode: 'mini', screen: 'home', playerFromDetails: true }, 'PageDown'), 'home');
  assert.equal(route({ mode: 'closed', screen: 'details' }, 'ArrowDown'), 'details');
  assert.equal(route({ mode: 'closed', screen: 'series' }, 'ArrowDown'), 'series');
  assert.equal(route({ mode: 'closed', screen: 'home' }, 'ArrowDown'), 'home');
});

const vodJs = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../main/assets/index.html'), 'utf8');

test('player mode is written only through setPlayerMode (no scattered class writes)', () => {
  assert.equal(/classList\.(add|remove)\('cine-(play|mini)'/.test(vodJs), false);
  assert.equal(/classList\.toggle\('cine-(play|mini)'/.test(vodJs), false);
});

test('screen is assigned only through go() (the declaration aside)', () => {
  const writes = vodJs.split('\n').filter((l) => /\bscreen='[a-z]+'/.test(l) && !l.trim().startsWith('let screen='));
  assert.deepEqual(writes, []);
});

test('index.html loads the state module before vod.js', () => {
  const state = html.indexOf('js/vod-state.js');
  const vod = html.indexOf('js/vod.js');
  assert.ok(state > 0, 'vod-state.js is not referenced');
  assert.ok(state < vod, 'vod-state.js must load before vod.js');
});
