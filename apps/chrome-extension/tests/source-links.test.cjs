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
  '\n({ makeSources, chatgptSources, claudeBlockText, grokCiter, cleanGrokMarkup, SOURCE_UNRESOLVED });', { URL, Map });
const topLevel = vm.runInNewContext(src.slice(src.indexOf('// 來源網址統計')).split('\nfunction buildCaptureEntry')[0] +
  src.slice(src.indexOf('function buildJsonl')).split('\n}\n')[0] + '\n}\n({ countSources, buildJsonl });', {});
const plain = (x) => JSON.parse(JSON.stringify(x));

test('sources are numbered once per URL and reject non-web links', () => {
  const reg = api.makeSources();
  assert.equal(reg.add('https://a.example/x', ' A  page ', true), 1);
  assert.equal(reg.add('https://b.example/', null, false), 2);
  assert.equal(reg.add('https://a.example/x', 'other', false), 1);
  assert.equal(reg.add('javascript:alert(1)', 'bad', true), null);
  assert.equal(reg.add('', null, true), null);
  assert.deepEqual(plain(reg.list), [
    { n: 1, url: 'https://a.example/x', title: 'A page', inline: true },
    { n: 2, url: 'https://b.example/', title: null, inline: false }]);
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
    [1, 'https://a.example/1', true], [2, 'https://b.example/2', true],
    [3, 'https://c.example/3', false], [4, 'https://d.example/4', false]]);
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
  assert.deepEqual(plain(reg.list), [
    { n: 1, url: 'https://a.example/', title: 'A', inline: true },
    { n: 2, url: 'https://z.example/', title: 'Z', inline: false }]);
});

test('sources are written to conversation.jsonl and counted', () => {
  const items = [
    { speaker: 'author', content: 'q', platform_message_id: 'u1' },
    { speaker: 'assistant', content: 'a[來源 1] b[來源：未取得網址]', platform_message_id: 'a1',
      sources: [{ n: 1, url: 'https://a.example/', title: 'A', inline: true }] }];
  const rows = topLevel.buildJsonl(items).trim().split('\n').map((l) => JSON.parse(l));
  assert.equal('sources' in rows[0], false);
  assert.deepEqual(rows[1].sources, items[1].sources);
  assert.deepEqual(plain(topLevel.countSources(items)), { total: 1, unresolved: 1 });
});
