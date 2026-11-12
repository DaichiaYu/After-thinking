'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const code = fs.readFileSync(path.join(__dirname, '..', 'offline-bundle.js'), 'utf8');
const sandbox = { TextEncoder, TextDecoder, Blob, Uint8Array, Uint32Array, DataView, ArrayBuffer, Map, Response, DecompressionStream };
const ATBundle = vm.runInNewContext(code + '\nATBundle;', sandbox);

test('portable ZIP preserves UTF-8 filenames, JSONL and binary attachments', async () => {
  const inputs = [
    { path: 'chat-01/README-請先看.md', data: '# 繁體中文 ✅\n' },
    { path: 'chat-01/source/conversation.jsonl', data: '{"content":"中文\\n下一行"}\n' },
    { path: 'chat-01/source/attachments/01.png', data: new Uint8Array([0, 255, 1, 222, 9]) }
  ];
  const files = await ATBundle.unpack(ATBundle.pack(inputs));
  assert.deepEqual([...files.keys()], inputs.map(x => x.path));
  assert.equal(ATBundle.decode(files.get(inputs[0].path)), inputs[0].data);
  assert.equal(ATBundle.decode(files.get(inputs[1].path)), inputs[1].data);
  assert.deepEqual([...files.get(inputs[2].path)], [...inputs[2].data]);
});
test('ZIP rejects corruption with CRC verification', async () => {
  const blob = ATBundle.pack([{ path: 'a/source/conversation.jsonl', data: 'a'.repeat(100) }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  bytes[50] ^= 0x01;
  await assert.rejects(() => ATBundle.unpack(new Blob([bytes])), /ZIP 項目檢查失敗/);
});
test('ZIP rejects duplicate or unsafe paths', () => {
  assert.throws(() => ATBundle.pack([{ path: '../outside', data: 'x' }]), /路徑/);
  assert.throws(() => ATBundle.pack([{ path: 'a.txt', data: 'x' }, { path: 'a.txt', data: 'y' }]), /路徑/);
});
