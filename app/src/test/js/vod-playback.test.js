const assert = require('node:assert/strict');
const test = require('node:test');
const { deferPositionRestore } = require('../../main/assets/js/vod-playback.js');

class Video {
  duration = 0;
  listeners = new Set();
  addEventListener(name, listener) {
    if (name === 'loadedmetadata') this.listeners.add(listener);
  }
  removeEventListener(name, listener) {
    if (name === 'loadedmetadata') this.listeners.delete(listener);
  }
  emitMetadata() {
    [...this.listeners].forEach(listener => listener());
  }
}

test('cancels the previous resume seek when playback changes before metadata loads', () => {
  const video = new Video();
  const restored = [];
  let cancel = deferPositionRestore(video, 120, time => restored.push(time));
  cancel();
  cancel = deferPositionRestore(video, 20, time => restored.push(time));
  video.duration = 200;
  video.emitMetadata();

  assert.deepEqual(restored, [20]);
  assert.equal(video.listeners.size, 0);
  cancel();
});

test('restores only positions before the media duration and removes the listener', () => {
  const video = new Video();
  const restored = [];
  deferPositionRestore(video, 120, time => restored.push(time));
  video.duration = 100;
  video.emitMetadata();

  assert.deepEqual(restored, []);
  assert.equal(video.listeners.size, 0);
});
