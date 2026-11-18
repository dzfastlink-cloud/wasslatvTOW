const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod-remote.js'), 'utf8');
const window = {};
vm.runInNewContext(source, { window });
const { routeKey, detailStep } = window.WasslaVodRemote;

test('fullscreen playback owns every key', () => {
  assert.equal(routeKey({ fullscreen: true }, 'ArrowLeft'), 'fullscreen');
  assert.equal(routeKey({ fullscreen: true, details: true }, 'MediaPlayPause'), 'fullscreen');
});

test('media keys control the mini player from any screen', () => {
  for (const key of ['MediaPlayPause', 'MediaFastForward', 'MediaRewind']) {
    assert.equal(routeKey({ mini: true }, key), 'media');
    assert.equal(routeKey({ mini: true, details: true }, key), 'media');
  }
});

test('PageUp/PageDown drive playback only on the embedded details player', () => {
  assert.equal(routeKey({ mini: true, detailMini: true, details: true }, 'PageDown'), 'media');
  assert.equal(routeKey({ mini: true, details: false }, 'PageDown'), 'home');
});

test('Back is no longer routed here (single __vodBack path) and screens fall through', () => {
  assert.equal(routeKey({ mini: true, detailMini: true, details: true }, 'Backspace'), 'details');
  assert.equal(routeKey({ series: true }, 'ArrowDown'), 'series');
  assert.equal(routeKey({}, 'ArrowDown'), 'home');
});

test('details buttons follow reading direction', () => {
  assert.equal(detailStep('ArrowLeft', true), 1);
  assert.equal(detailStep('ArrowRight', true), -1);
  assert.equal(detailStep('ArrowRight', false), 1);
  assert.equal(detailStep('ArrowLeft', false), -1);
  assert.equal(detailStep('ArrowDown', true), 1);
  assert.equal(detailStep('ArrowUp', true), -1);
  assert.equal(detailStep('Enter', true), 0);
});
