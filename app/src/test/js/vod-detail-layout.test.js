const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const webCss = fs.readFileSync(path.join(__dirname, '../../../../public/css/vod.css'), 'utf8');
const androidCss = fs.readFileSync(path.join(__dirname, '../../main/assets/css/vod.css'), 'utf8');
const webJs = fs.readFileSync(path.join(__dirname, '../../../../public/js/vod.js'), 'utf8');
const androidJs = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod.js'), 'utf8');

test('web and Android use a centered bounded detail overlay', () => {
  for (const css of [webCss, androidCss]) {
    assert.match(css, /#vod\.vod-details \.vdetail-overlay\{[\s\S]*position:absolute[\s\S]*place-items:center/);
    assert.match(css, /#vod\.vod-details \.vdetails\{[\s\S]*width:min\(1180px,100%\)[\s\S]*max-height:92vh/);
    assert.match(css, /#vod\.vod-details \.vdetail-head[\s\S]*grid-template-columns:clamp\(150px,18vw,220px\)/);
    assert.match(css, /#vod\.vod-details \.vdetail-info[\s\S]*overflow-y:auto/);
  }
  for (const js of [webJs, androidJs]) {
    assert.match(js, /overlay\.appendChild\(panel\);el\.appendChild\(overlay\);detailOverlay=overlay/);
    assert.match(js, /function clearDetailsOverlay\(\)[\s\S]*detailOverlay\.remove\(\)/);
  }
});

test('detail mini-player is compact and placed directly after the detail head', () => {
  for (const js of [webJs, androidJs]) {
    assert.match(js, /shell\.append\(head,playerStage,extra,trailerSection\)/);
  }
  for (const css of [webCss, androidCss]) {
    assert.match(css, /body\.cine-mini\.vod-detail-play #player[\s\S]*grid-template-columns:minmax\(190px,42%\)/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #vodplaypause[\s\S]*display:inline-flex/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #vodclose[\s\S]*display:inline-flex/);
  }
});

test('unrelated mini-player controls are hidden while detail mini-player is active', () => {
  for (const css of [webCss, androidCss]) {
    assert.match(css, /body\.cine-mini\.vod-detail-play #vodwatched/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #vodexpand/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #vodfav/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #prev/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #pipb/);
  }
});

test('returning from details closes detail-origin mini playback', () => {
  for (const js of [webJs, androidJs]) {
    assert.match(js, /function returnFromDetails\(\)[\s\S]*if\(playerFromDetails&&B\.classList\.contains\('cine-mini'\)\)[\s\S]*stopPlay\(\)/);
  }
});
