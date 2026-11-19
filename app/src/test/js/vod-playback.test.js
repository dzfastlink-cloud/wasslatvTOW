const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const playbackSource = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod-playback.js'), 'utf8');
const playbackModule = { exports: {} };
vm.runInNewContext(playbackSource, { module: playbackModule, exports: playbackModule.exports, globalThis: {} });
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
