const assert = require('node:assert/strict');
const test = require('node:test');
const { load, snap } = require('./helpers/vod-harness');

const wait = () => new Promise((r) => setTimeout(r, 20));
const it = { name: 'Test Movie', url: 'http://x/movie.mp4' };
const card = { title: 'Test Movie', kind: 'movie', item: it };

async function openLibrary() {
  const h = load();
  h.t.open();
  await wait();
  return h;
}
const has = (s, cls) => s.body.split(' ').includes(cls);

test('full-screen: library hidden, overlay open, shared player mounted in the overlay frame', async () => {
  const { E, t } = await openLibrary();
  t.playItem(it, null, 0, card, 0, false);
  const s = snap(E, t);
  assert.ok(has(s, 'cine-play') && has(s, 'vod-player-open') && !has(s, 'cine-mini'));
  assert.equal(s.playerIn, 'vod-player-frame');
  assert.equal(s.libraryDisplay, 'none');
  assert.equal(s.overlayDisplay, 'block');
  assert.equal(s.overlayOpen, true);
  assert.equal(s.vodAria, 'true');
  assert.equal(s.screen, 'player');
});

test('minimize: back to the library with the player returned to its original host', async () => {
  const { E, t } = await openLibrary();
  t.playItem(it, null, 0, card, 0, false);
  t.minimizePlayer();
  const s = snap(E, t);
  assert.ok(has(s, 'cine-mini') && !has(s, 'cine-play') && !has(s, 'vod-player-open'));
  assert.equal(s.playerIn, '__playerhost');
  assert.equal(s.libraryDisplay, 'block');
  assert.equal(s.overlayDisplay, 'none');
  assert.equal(s.overlayOpen, false);
  assert.equal(s.screen, 'home');
});

test('a visible library is never left aria-hidden after minimizing (fixes a stuck aria-hidden)', async () => {
  const { E, t } = await openLibrary();
  t.playItem(it, null, 0, card, 0, false);
  t.minimizePlayer();
  assert.equal(snap(E, t).vodAria, null);
});

test('expand after minimize returns to the same full-screen state', async () => {
  const { E, t } = await openLibrary();
  t.playItem(it, null, 0, card, 0, false);
  const full = snap(E, t);
  t.minimizePlayer();
  t.expandPlayer();
  assert.deepEqual(snap(E, t), full);
});

test('stop clears every playback class and puts the shared player back for live TV', async () => {
  const { E, t } = await openLibrary();
  t.playItem(it, null, 0, card, 0, false);
  t.minimizePlayer();
  t.stopPlay();
  const s = snap(E, t);
  assert.equal(s.body, '');
  assert.equal(s.playerIn, '__playerhost');
  assert.equal(s.libraryDisplay, 'block');
  assert.equal(s.overlayDisplay, 'none');
});

test('back chain: full → minimize → arm → stop → exit, one layer per press', async () => {
  const { E, t, W } = await openLibrary();
  t.playItem(it, null, 0, card, 0, false);
  W.__vodBack();                                   // minimize
  assert.ok(has(snap(E, t), 'cine-mini'));
  W.__vodBack();                                   // arm (still playing)
  assert.ok(has(snap(E, t), 'cine-mini'));
  W.__vodBack();                                   // second press within window: stop
  assert.equal(snap(E, t).body, '');
  assert.equal(W.__vodOn(), true);                 // library still open
  W.__vodBack();                                   // exit the library
  assert.equal(W.__vodOn(), false);
  assert.equal(W.__vodBack(), false);              // nothing left to close
});

test('the shared player is always in exactly one place: its host or the overlay frame', async () => {
  const { E, t } = await openLibrary();
  const places = [];
  const mark = () => places.push(snap(E, t).playerIn);
  mark();
  t.playItem(it, null, 0, card, 0, false); mark();
  t.minimizePlayer(); mark();
  t.expandPlayer(); mark();
  t.minimizePlayer(); mark();
  t.stopPlay(); mark();
  for (const p of places) assert.ok(p === '__playerhost' || p === 'vod-player-frame', String(p));
});
