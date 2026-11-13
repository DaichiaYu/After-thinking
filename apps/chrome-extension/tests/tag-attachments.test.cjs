'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'tag-attachments.js'), 'utf8');
function harness(ctx, fetchFn) {
  const sandbox = {
    ctx, msgs: [], config: { repo:'owner/private', token:'fake-token' }, branch:'main',
    renderList() {},
    document: { getElementById:()=>null, querySelectorAll:()=>[] },
    window: { addEventListener() {} },
    URL, Blob, Map, Set, Uint8Array, TextDecoder, atob,
    fetch: fetchFn || (async () => { throw new Error('unexpected network access'); })
  };
  const viewer = vm.runInNewContext(code + '\nATAttachments;', sandbox);
  return { viewer, sandbox };
}

test('ZIP attachment is loaded from its original source path without network access', async () => {
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,1,2,3]);
  const data = new Map([['chat-01/source/attachments/01.png', bytes]]);
  const { viewer } = harness({ kind:'zip',bundlePrefix:'chat-01/',bundleEntries:data });
  const att = { kind:'image', file:'attachments/01.png', name:'圖片.png' };
  const result = await viewer.getBytes(att);
  assert.deepEqual([...result], [...bytes]);
  assert.equal(viewer.typeOf(att, result), 'image/png');
});

test('unknown, traversal and nested attachment paths cannot be read', async () => {
  const { viewer } = harness({kind:'zip',bundlePrefix:'chat-01/',bundleEntries:new Map()});
  for (const unsafe of ['', '../secret', 'attachments/../secret', 'attachments/../../private', '/etc/passwd',
    'attachments/nested/a.png', 'attachments\\evil.png', 'attachments/..evil.png']) {
    assert.equal(viewer.pathFor({file:unsafe}), null);
  }
  await assert.rejects(viewer.getBytes({file:'attachments/01.png'}), /ZIP 中找不到/);
});

test('PDF type is recognized by signature and an extracted document is treated as text', () => {
  const { viewer } = harness({kind:'zip',bundlePrefix:'chat-01/',bundleEntries:new Map()});
  assert.equal(viewer.typeOf({name:'paper.bin',file:'attachments/01.bin'},new Uint8Array([37,80,68,70,45,1,2,3])), 'application/pdf');
  assert.equal(viewer.typeOf({name:'report.docx',file:'attachments/02.txt',content_note:'extracted_text'},
    new Uint8Array([72,101,108,108,111])), 'text/plain');
  assert.equal(viewer.typeOf({name:'vector.svg',file:'attachments/03.svg'},new Uint8Array([60,115,118,103,62])), 'text/plain');
});

test('GitHub binary file can be fetched with scoped token and decoded from base64', async () => {
  let calls = 0;
  const { viewer } = harness({kind:'repo',folder:'discussions/demo/'},async (url, opts) => {
    calls++;
    assert.equal(new URL(url).hostname,'api.github.com');
    assert.equal(opts.headers.Authorization,'Bearer fake-token');
    return {ok:true,status:200,json:async()=>({
      type:'file',size:3,encoding:'base64',content:'AAH/'
    })};
  });
  const bytes = await viewer.getBytes({file:'attachments/01.png'});
  assert.deepEqual([...bytes],[0,1,255]);
  assert.equal(calls,1);
});

test('same path in a new ZIP context does not reuse cached image contents', async () => {
  const left = {kind:'zip',bundlePrefix:'same/',bundleEntries:new Map([['same/source/attachments/01.png',new Uint8Array([1])]])};
  const { viewer, sandbox } = harness(left);
  assert.deepEqual([...await viewer.getBytes({file:'attachments/01.png'})],[1]);
  sandbox.ctx = {kind:'zip',bundlePrefix:'same/',bundleEntries:new Map([['same/source/attachments/01.png',new Uint8Array([2])]])};
  assert.deepEqual([...await viewer.getBytes({file:'attachments/01.png'})],[2]);
});
