const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const webCss = fs.readFileSync(path.join(__dirname, '../../../../public/css/vod.css'), 'utf8');
const androidCss = fs.readFileSync(path.join(__dirname, '../../main/assets/css/vod.css'), 'utf8');
const webPlayerCss = fs.readFileSync(path.join(__dirname, '../../../../public/css/vodplay.css'), 'utf8');
const androidPlayerCss = fs.readFileSync(path.join(__dirname, '../../main/assets/css/vodplay.css'), 'utf8');
const webJs = fs.readFileSync(path.join(__dirname, '../../../../public/js/vod.js'), 'utf8');
const androidJs = fs.readFileSync(path.join(__dirname, '../../main/assets/js/vod.js'), 'utf8');
const webHtml = fs.readFileSync(path.join(__dirname, '../../../../index.html'), 'utf8');
const androidHtml = fs.readFileSync(path.join(__dirname, '../../main/assets/index.html'), 'utf8');

test('web and Android render the cinematic Arabic detail screen', () => {
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
    assert.match(js, /shell\.append\(head,playerStage,extra\)/);
  }
  for (const css of [webCss, androidCss]) {
    assert.match(css, /body\.cine-mini\.vod-detail-play #player[\s\S]*grid-template-columns:minmax\(190px,42%\)/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #vodplaypause[\s\S]*display:inline-flex/);
    assert.match(css, /body\.cine-mini\.vod-detail-play #vodclose[\s\S]*display:inline-flex/);
  }
});

test('VOD playback mounts into a separate full-screen player layer', () => {
  for (const html of [webHtml, androidHtml]) {
    assert.match(html, /id="vod-player-overlay"[^>]*role="dialog"[^>]*aria-modal="true"/);
    assert.match(html, /id="vod-player-frame"/);
    assert.match(html, /id="vtbar" role="slider" tabindex="0"/);
  }
  for (const js of [webJs, androidJs]) {
    assert.match(js, /function showPlayerOverlay\(\)[\s\S]*playerFrame\.appendChild\(\$\('player'\)\)/);
    assert.match(js, /function hidePlayerOverlay\(\)[\s\S]*playerOverlay\.classList\.remove\('is-open'\)/);
    assert.match(js, /function showPlayerBackground\([\s\S]*function showPlayerOverlay/);
    assert.match(js, /setTimeout\(\(\)=>\{[\s\S]*B\.classList\.add\('cine-track-hidden'\);?[\s\S]*\},2000\)/);
  }
  for (const css of [webPlayerCss, androidPlayerCss]) {
    assert.match(css, /\.vod-player-overlay\.is-open\{opacity:1;visibility:visible;pointer-events:auto\}/);
    assert.match(css, /#player:fullscreen video\{[\s\S]*object-fit:contain!important/);
    assert.match(css, /#player:fullscreen \.ctl\{[\s\S]*env\(safe-area-inset-bottom\)/);
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

test('remote detail focus and favorite state use the active detail overlay', () => {
  for (const js of [webJs, androidJs]) {
    assert.match(js, /const root=detailOverlay\|\|bodyEl/);
    assert.match(js, /\(detailOverlay\|\|bodyEl\)\.querySelector\('\[data-act="vod-fav"\]'\)/);
    assert.match(js, /actions\.appendChild\(addPlayAction/);
    assert.match(js, /favBtn\.appendChild\(favIcon\)/);
  }
});
