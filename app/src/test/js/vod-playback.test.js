const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const playbackSource = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod-playback.js'), 'utf8');
const playbackModule = { exports: {} };
vm.runInNewContext(playbackSource, { module: playbackModule, exports: playbackModule.exports, globalThis: {}, URL, setTimeout, clearTimeout });
const Playback = playbackModule.exports;
const webPlayer = fs.readFileSync(path.join(__dirname, '../../../../public/js/app.js'), 'utf8');
const androidPlayer = fs.readFileSync(path.join(__dirname, '../../main/assets/js/app.js'), 'utf8');

test('selects an HLS-first route for playlists and keeps fallback engines', () => {
  assert.deepEqual(Array.from(Playback.playbackModes('https://media.example/movie.m3u8?token=test')), ['hls', 'native']);
});

test('selects native playback first for Xtream VOD streams', () => {
  assert.deepEqual(Array.from(Playback.playbackModes('https://media.example/movie/user/pass/12.mp4')), ['native', 'hls', 'mpegts']);
});

test('retains MPEG-TS fallback for direct transport streams', () => {
  assert.deepEqual(Array.from(Playback.playbackModes('https://media.example/live/12.ts')), ['mpegts', 'hls', 'native']);
});

test('web and Android wait for a playable frame and cancel stale attempts', () => {
  for (const source of [webPlayer, androidPlayer]) {
    assert.match(source, /v\.addEventListener\('canplay',onReady\)/);
    assert.match(source, /if\(v\.readyState<2\)return/);
    assert.match(source, /const request=v\.play\(\)/);
    assert.match(source, /if\(my!==tok\)return/);
    assert.match(source, /playbackAttemptCleanup\(\)/);
  }
});

test('prioritizeModes promotes remembered engine without dropping fallbacks', () => {
  assert.equal(Playback.sourceKey('xt1', 'https://cdn.example/a.mp4'), 'src:xt1');
  assert.equal(Playback.sourceKey('', 'https://CDN.Example.com/movie.mp4'), 'host:cdn.example.com');
  assert.deepEqual(
    Array.from(Playback.prioritizeModes('https://media.example/movie/u/p/12.mp4', 'hls')),
    ['hls', 'native', 'mpegts']
  );
});

test('createSeekAccumulator batches rapid steps and supports cancel', async () => {
  const commits = [];
  const acc = Playback.createSeekAccumulator(d => commits.push(d), 25);
  assert.equal(acc.push(10), 10);
  assert.equal(acc.push(10), 20);
  assert.equal(acc.push(10), 30);
  await new Promise(r => setTimeout(r, 60));
  assert.deepEqual(commits, [30]);
  acc.push(-10);
  acc.cancel();
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(commits, [30]);
});

test('formatFinishClock renders HH:MM from remaining seconds', () => {
  const base = new Date(2026, 0, 1, 20, 15, 0).getTime();
  assert.equal(Playback.formatFinishClock(45 * 60, base), '21:00');
  assert.equal(Playback.formatFinishClock(0, base), '');
});

