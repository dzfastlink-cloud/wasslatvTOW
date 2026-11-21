const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const webSource = fs.readFileSync(path.join(__dirname, '../../../../public/js/vod-model.js'), 'utf8');
const androidSource = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod-model.js'), 'utf8');
const mod = { exports: {} };
vm.runInNewContext(androidSource, { module: mod, exports: mod.exports, window: {} });
const Model = mod.exports;

test('web and Android vod-model files match', () => {
  assert.equal(webSource, androidSource);
});

test('shouldResume skips records shorter than MIN_RESUME_SECONDS or marked watched', () => {
  assert.equal(Model.MIN_RESUME_SECONDS, 15);
  assert.equal(Model.shouldResume({ position: 10, duration: 1800, watched: false }), false);
  assert.equal(Model.shouldResume({ position: 120, duration: 1800, watched: true }), false);
  assert.equal(Model.shouldResume({ position: 320, duration: 1800, watched: false }), true);
});

test('shouldAutoComplete and shouldResume enforce 92% completion threshold', () => {
  assert.equal(Model.AUTO_COMPLETE_RATIO, 0.92);
  assert.equal(Model.shouldAutoComplete(919, 1000), false);
  assert.equal(Model.shouldAutoComplete(920, 1000), true);
  assert.equal(Model.shouldResume({ position: 925, duration: 1000, watched: false }), false);
  assert.equal(Model.progressPercent({ position: 460, duration: 1000, watched: false }), 46);
});
