'use strict';
// ChatGPT now draws many answers as <svg> diagrams whose labels live in template data
// ({@body const items = [...]} + {#each items as item}…{item.t}…{/each}).
// The capture must keep every label as readable text instead of dropping the data or leaving coordinates.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'capture.js'), 'utf8');
const block = src.match(/\/\/ <chatgpt-markup>([\s\S]*?)\/\/ <\/chatgpt-markup>/);
assert.ok(block, 'chatgpt-markup block exists');
const { cleanChatgptMarkup } = vm.runInNewContext(block[1] + '\n({ cleanChatgptMarkup });', {});
const clean = (t) => cleanChatgptMarkup(t).text;

test('svg diagram becomes a [圖示] block with one line per <text>', () => {
  const raw = [
    '## 一、整體流程',
    '',
    '<svg viewBox="0 0 340 120" width="100%">',
    '<defs><marker id="arr" markerWidth="7"><path d="M0 0L6 3L0 6" fill="none"/></marker></defs>',
    '<rect x="12" y="8" width="316" height="60" rx="9" fillOpacity=".09"/>',
    '<g fill="currentColor" textAnchor="middle"><text x="170" y="32" fontWeight="500">原始 AI 對話</text><text x="170" y="52" fontSize="11">ChatGPT · Claude &amp; Gemini</text></g>',
    '<path d="M112 68V88" markerEnd="url(#arr)"/>',
    '</svg>',
    '',
    '這張圖的重點是……'
  ].join('\n');
  const out = clean(raw);
  assert.match(out, /\[圖示\]\n- 原始 AI 對話\n- ChatGPT · Claude & Gemini\n/);
  assert.doesNotMatch(out, /<rect|viewBox|markerEnd/);
  assert.match(out, /^## 一、整體流程/);
  assert.match(out, /這張圖的重點是……$/);
  assert.deepEqual(cleanChatgptMarkup(raw).visuals, 1);
});

test('{#each} over an inline string array keeps every label', () => {
  const raw = '<svg viewBox="0 0 340 140">\n<text x="170" y="30">Chrome Capture 插件</text>\n' +
    '{#each ["單篇擷取","批次擷取","Agent 擷取"] as s, i}\n<rect x={5+i*114} y="69" width="102"/>\n<text x={56+i*114} y="92">{i+1}. {s}</text>\n{/each}\n</svg>';
  assert.equal(clean(raw), '[圖示]\n- Chrome Capture 插件\n- 1. 單篇擷取\n- 2. 批次擷取\n- 3. Agent 擷取');
});

test('{@body} object data with bare keys feeds {#each} inside svg', () => {
  const raw = [
    '{@body const nodes = [{x:20, y:10, t:"Stage 4", s:"認知結構"}, {x:120, y:10, t:\'Stage 5\', s:"討論缺口",},]}',
    '<svg viewBox="0 0 320 307" width="100%">',
    '{#each nodes as n (n.t)}',
    '<rect x={n.x} y={n.y} width="80" height="49" fill={n.t==="Stage 4"?"#0D9488":"#8B5CF6"}/>',
    '<text x={n.x+40} y={n.y+20}>{n.t}</text><text x={n.x+40} y={n.y+36} fontSize="10">{n.s}</text>',
    '{/each}',
    '</svg>',
    '簡化的現行階段依賴關係。'
  ].join('\n');
  assert.equal(clean(raw), '[圖示]\n- Stage 4\n- 認知結構\n- Stage 5\n- 討論缺口\n\n簡化的現行階段依賴關係。');
});

test('{#each} outside svg (card grids) expands with the item fields', () => {
  const raw = '{@body const items = [{t:"軟體開發者", s:"提取需求"}, {t:"研究者", s:"提取假設"}]}\n' +
    '<grid>{#each items as {t, s}}<box><text>**{t}**</text>\n<text>{s}</text></box>\n{/each}</grid>';
  assert.equal(clean(raw), '**軟體開發者**\n提取需求\n**研究者**\n提取假設');
});

test('nested {#each} and {#if} keep all content', () => {
  const raw = '{@body const rows = [{name:"A", tags:["x","y"]}, {name:"B", tags:[]}]}\n' +
    '{#each rows as r}{r.name}:{#each r.tags as g} {g}{/each}{#if r.tags.length}!{:else}?{/if}\n{/each}';
  assert.equal(clean(raw), 'A: x y!?\nB:!?');
});

test('decorative svg with no text is dropped; svg in code is untouched', () => {
  const deco = '前\n<svg viewBox="0 0 300 40"><g stroke="currentColor"><path d="M150 0V13H38V30"/></g></svg>\n後';
  assert.equal(clean(deco), '前\n\n後');
  const code = '```html\n<svg><text>keep</text></svg>\n```\n`<svg><text>inline</text></svg>`';
  assert.equal(clean(code), code);
});

test('data that cannot be read is kept, never silently deleted', () => {
  const raw = '{@body const total = items.length * 2}\n{#each items.slice(0, 2) as it}<text>{it.t}</text>{/each}';
  const out = clean(raw);
  assert.match(out, /\{@body const total = items\.length \* 2\}/);
  assert.match(out, /\[重複區塊：資料未能還原\]\n\{it\.t\}/);
});

test('svg title and tspan lines, entities, nested svg', () => {
  const raw = '<svg><title>依賴關係</title><svg x="10"><text>內層</text></svg>' +
    '<text x="0" y="10"><tspan x="0" dy="0">第一行</tspan><tspan x="0" dy="12">第二行 <tspan fontWeight="bold">粗</tspan>體</tspan></text>' +
    '<text>&lt;outline.json&gt; &#x2192; &#8594;</text></svg>';
  assert.equal(clean(raw), '[圖示：依賴關係]\n- 內層\n- 第一行\n- 第二行 粗體\n- <outline.json> → →');
});

test('old interactive checklist still renders as a checklist', () => {
  const raw = '{@body const opts = ["選項一","選項二"]}\n{#each opts as o}<checkbox label={o}/>{/each}\n已選：{selected.length}';
  assert.equal(clean(raw), '- [ ] 選項一\n- [ ] 選項二\n已選：[互動值未保存]');
});

test('plain prose with braces is left alone', () => {
  const raw = '一般文字 {不是模板}、JSON 範例 {"a": 1}，還有單獨的 { 括號。\n<box>卡片</box>';
  assert.equal(clean(raw), '一般文字 {不是模板}、JSON 範例 {"a": 1}，還有單獨的 { 括號。\n卡片');
});
