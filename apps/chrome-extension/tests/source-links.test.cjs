'use strict';
// Source-link capture: the helpers live inside the injected capture functions (which must be self-contained),
// so the tests cut the marked blocks out of capture.js and run them on their own.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'capture.js'), 'utf8');
const block = (name) => {
  const m = src.match(new RegExp('// <' + name + '>([\\s\\S]*?)// </' + name + '>'));
  assert.ok(m, 'block ' + name + ' exists');
  return m[1];
};
const api = vm.runInNewContext(block('source-links') + block('grok-markup') +
  block('chatgpt-markup') +
  '\n({ makeSources, chatgptSources, chatgptRefIndex, cleanChatgptMarkup, claudeBlockText, grokCiter, cleanGrokMarkup, SOURCE_UNRESOLVED });', { URL, Map, Set });
const topLevel = vm.runInNewContext(src.slice(src.indexOf('// 來源網址統計')).split('\nfunction buildCaptureEntry')[0] +
  src.slice(src.indexOf('function buildJsonl')).split('\nfunction buildMetadata')[0] + '\n({ countSources, buildJsonl, buildConsultedJsonl, consultedFileEntries });', {});
const plain = (x) => JSON.parse(JSON.stringify(x));

test('sources are numbered once per URL and reject non-web links', () => {
  const reg = api.makeSources();
  assert.equal(reg.add('https://a.example/x', ' A  page ', true), 1);
  assert.equal(reg.add('https://b.example/', null, false), null);   // consulted only: kept apart, not numbered
  assert.equal(reg.add('https://b.example/', 'B', false), null);
  assert.equal(reg.add('https://c.example/', 'C', false), null);
  assert.equal(reg.add('https://c.example/', null, true), 2);       // later cited: moves over and keeps its title
  assert.equal(reg.add('https://a.example/x', 'other', false), 1);
  assert.equal(reg.add('javascript:alert(1)', 'bad', true), null);
  assert.equal(reg.add('', null, true), null);
  assert.deepEqual(plain(reg.list), [
    { n: 1, url: 'https://a.example/x', title: 'A page', inline: true },
    { n: 2, url: 'https://c.example/', title: 'C', inline: true }]);
  assert.deepEqual(plain(reg.extra), [{ url: 'https://b.example/', title: 'B' }]);
  assert.equal(reg.mark([1, 2, 1]), '[來源 1、2]');
  assert.equal(reg.mark([null]), api.SOURCE_UNRESOLVED);
});

test('ChatGPT: hidden citation markers become numbered markers backed by URLs', () => {
  const cite1 = 'citeturn0search0', cite2 = 'citeturn0search9';
  const text = 'Fact one.' + cite1 + ' Fact two.' + cite2 + ' The word plain stays.';
  const reg = api.makeSources();
  const out = api.chatgptSources(text, { content_references: [
    { type: 'grouped_webpages', matched_text: cite1, items: [
      { url: 'https://a.example/1', title: 'One', supporting_websites: [{ url: 'https://b.example/2', title: 'Two' }] }] },
    { type: 'grouped_webpages', matched_text: cite2, items: [] },
    { type: 'webpage', matched_text: 'plain', url: 'https://c.example/3', title: 'Three' },
    { type: 'sources_footnote', matched_text: ' ', sources: [{ url: 'https://a.example/1', title: 'One' }, { url: 'https://d.example/4' }] }
  ] }, reg);
  assert.equal(out, 'Fact one.[來源 1、2] Fact two.[來源：未取得網址] The word plain stays.');
  assert.deepEqual(plain(reg.list).map((s) => [s.n, s.url, s.inline]), [
    [1, 'https://a.example/1', true], [2, 'https://b.example/2', true]]);
  // Listed for the answer but not tied to a sentence: kept apart for the separate file.
  assert.deepEqual(plain(reg.extra), [{ url: 'https://c.example/3', title: 'Three' }, { url: 'https://d.example/4', title: null }]);
});

test('ChatGPT: text without references is untouched', () => {
  const reg = api.makeSources();
  assert.equal(api.chatgptSources('hello', undefined, reg), 'hello');
  assert.equal(reg.list.length, 0);
});

test('Claude: citations are placed at their end position inside the block', () => {
  const reg = api.makeSources();
  const out = api.claudeBlockText({ text: 'Alpha. Beta.', citations: [
    { end_index: 12, url: 'https://b.example/', title: 'B' },
    { end_index: 6, details: { url: 'https://a.example/' }, metadata: { title: 'A' } },
    { end_index: 6, url: 'https://c.example/' },
    { end_index: 999 }
  ] }, reg);
  assert.equal(out, 'Alpha.[來源 1、2] Beta.[來源 3]');
  assert.deepEqual(plain(reg.list).map((s) => [s.n, s.url, s.title]), [
    [1, 'https://a.example/', 'A'], [2, 'https://c.example/', null], [3, 'https://b.example/', 'B']]);
  assert.equal(api.claudeBlockText({ text: 'No citations.' }, api.makeSources()), 'No citations.');
});

test('Grok: citation cards resolve through cardAttachmentsJson; unresolved ones are labelled', () => {
  const tag = (id) => '<grok:render card_id="' + id + '" card_type="citation_card" type="render_inline_citation">\n<argument name="citation_id">0</argument>\n</grok:render>';
  const r = { cardAttachmentsJson: [JSON.stringify({ id: 'c1', url: 'https://a.example/' })],
    webSearchResults: [{ url: 'https://a.example/', title: 'A' }, { url: 'https://z.example/', title: 'Z' }] };
  const reg = api.makeSources();
  const cite = api.grokCiter(r, reg);
  const c = api.cleanGrokMarkup('Claim ' + tag('c1') + ' and another ' + tag('nope') + '.', cite);
  assert.equal(c.text, 'Claim[來源 1] and another[來源：未取得網址].');
  assert.equal(cite.unresolved, 1);
  cite.listAll();
  assert.deepEqual(plain(reg.list), [{ n: 1, url: 'https://a.example/', title: 'A', inline: true }]);
  assert.deepEqual(plain(reg.extra), [{ url: 'https://z.example/', title: 'Z' }]);
});

test('sources are written to conversation.jsonl and counted', () => {
  const items = [
    { speaker: 'author', content: 'q', platform_message_id: 'u1' },
    { speaker: 'assistant', content: 'a[來源 1] b[來源：未取得網址]', platform_message_id: 'a1',
      sources: [{ n: 1, url: 'https://a.example/', title: 'A', inline: true }],
      consulted: [{ url: 'https://z.example/', title: 'Z' }, { url: 'https://y.example/', title: null }] }];
  const rows = topLevel.buildJsonl(items).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal('sources' in rows[0], false);
  assert.deepEqual(rows[1].sources, items[1].sources);
  assert.equal(rows[1].consulted_sources, 2);
  assert.equal('consulted' in rows[1], false);
  assert.deepEqual(plain(topLevel.countSources(items)), { total: 1, consulted: 2, unresolved: 1 });
  // Consulted pages go to their own file, keyed by the same message_id.
  const extra = topLevel.buildConsultedJsonl(items).trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(extra, [{ message_id: 'msg-000002', platform_message_id: 'a1',
    sources: [{ url: 'https://z.example/', title: 'Z' }, { url: 'https://y.example/', title: null }] }]);
  assert.deepEqual(plain(topLevel.consultedFileEntries('d/', items, 'data')).map((f) => [f.path, typeof f.data]),
    [['d/source/consulted-sources.jsonl', 'string']]);
  assert.equal(topLevel.buildConsultedJsonl(items.slice(0, 1)), null);
  assert.deepEqual(plain(topLevel.consultedFileEntries('d/', items.slice(0, 1))), []);
});

test('ChatGPT: <Cite ref> tags resolve through search results stored on other messages', () => {
  const conv = { mapping: {
    a: { message: { author: { role: 'tool' }, content: {}, metadata: { search_result_groups: [{ domain: 'a.example', entries: [
      { url: 'https://a.example/7', title: 'Seven', ref_id: { turn_index: 724155, ref_type: 'search', ref_index: 7 } },
      { url: 'https://a.example/news', title: 'News', ref_id: 'turn267042news45' }] }] } } },
    b: { message: { author: { role: 'assistant' }, content: {}, metadata: { content_references: [
      { type: 'grouped_webpages', items: [{ url: 'https://b.example/14', title: 'Fourteen', refs: [{ turn_index: 458767, ref_type: 'search', ref_index: 14 }] }] }] } } },
    c: { message: null }
  } };
  const index = api.chatgptRefIndex(conv);
  assert.deepEqual(Object.keys(index.map).sort(), ['turn267042news45', 'turn458767search14', 'turn724155search7']);
  assert.ok(index.paths.includes('metadata.search_result_groups[].entries[].ref_id'));
  const reg = api.makeSources();
  let unresolved = 0;
  const cite = (ids) => reg.mark(ids.map((id) => { const hit = index.map[id]; if (!hit) { unresolved++; return null; } return reg.add(hit.url, hit.title, true); }));
  const text = 'One.<Cite ref="turn724155search7"/> Two.<Cite refs={["turn458767search14","turn458767search8"]}/> Three.<Cite ref="turn1search1"/>';
  const out = api.cleanChatgptMarkup(text, cite).text;
  assert.equal(out, 'One.[來源 1] Two.[來源 2] Three.[來源：未取得網址]');
  assert.equal(unresolved, 2);
  assert.deepEqual(plain(reg.list).map((s) => s.url), ['https://a.example/7', 'https://b.example/14']);
  // Without a resolver the reference id is kept, as before.
  assert.equal(api.cleanChatgptMarkup('<Cite ref="turn1search1"/>').text, '[來源：turn1search1]');
});

test('Gemini: source addresses are read from the recorded page data and kept as consulted pages', () => {
  const fn = (name) => { const a = src.indexOf('function ' + name + '('); const b = src.indexOf('\n}\n', a); return src.slice(a, b + 3); };
  const gem = vm.runInNewContext(fn('geminiPayloadsOf') + fn('applyGeminiSources') + '\n({ applyGeminiSources });', { URL });
  const answer = ['rc_abc123', ['## 標題\n\n**輝達**執行長目前由財務長暫時代理。\n\n另外出口管制新規擴大到海外資料中心的算力。'],
    [null, [[[0, 30], [1]], [[['https://news.example/a', 'News A', null, 'https://www.gstatic.com/favicon.ico']]],
      [['https://gov.example/rule', 'Rule page']]]],
    ['https://lh3.googleusercontent.com/img.png']];
  const other = ['rc_zzz999', ['完全不同的另一個草稿內容，跟畫面不一樣的文字很多很多。'], [['https://other.example/']]];
  const payload = JSON.stringify([[null, [answer, other]]]);
  const raw = ")]}'\n\n123\n" + JSON.stringify([['wrb.fr', 'hNvQHb', payload, null, null, null, 'generic']]) + '\n';
  const page = { recorder: 'active', items: [
    { speaker: 'author', text: '問題' },
    { speaker: 'assistant', text: '標題\n\n輝達執行長目前由財務長暫時代理。[來源：未取得網址]\n\n另外出口管制新規擴大到海外資料中心的算力。[來源：未取得網址]' }] };
  const probe = gem.applyGeminiSources(page, [raw]);
  assert.deepEqual(plain(page.items[1].consulted), [
    { url: 'https://news.example/a', title: 'News A' }, { url: 'https://gov.example/rule', title: 'Rule page' }]);
  assert.equal(probe.payloads, 1);
  assert.equal(probe.candidates, 2);
  assert.equal(probe.matched, 1);
  assert.equal(probe.kept, 2);
  assert.equal(probe.urls, 4);
  assert.ok(!JSON.stringify(probe).includes('example'), 'probe carries no URLs or text');
  assert.equal(gem.applyGeminiSources({ items: [{ speaker: 'assistant', text: 'x' }] }, []).payloads, 0);
});
