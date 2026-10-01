const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load({ configured = true, sizes = [250000], fetch: fetchMock } = {}) {
  let closed = false;
  let calls = 0;
  const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob(callback) { callback(new Blob([new Uint8Array(sizes[Math.min(calls++, sizes.length - 1)])], { type: 'image/jpeg' })); } };
  const source = fs.readFileSync('src/lib/cloudinary.ts', 'utf8').replaceAll('import.meta.env', '__env');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, __env: configured ? { VITE_CLOUDINARY_CLOUD_NAME: 'test-cloud', VITE_CLOUDINARY_UPLOAD_PRESET: 'test-preset' } : {}, Blob, FormData, AbortSignal, encodeURIComponent, fetch: fetchMock, document: { createElement: () => canvas }, createImageBitmap: async () => ({ width: 4000, height: 3000, close() { closed = true; } }) };
  vm.runInNewContext(js, context);
  return { ...context.exports, canvas, closed: () => closed };
}

test('rejects unsupported formats and oversized originals', async () => {
  const api = load();
  await assert.rejects(api.compressPhoto({ type: 'image/svg+xml', size: 100 }), /JPG/);
  await assert.rejects(api.compressPhoto({ type: 'image/jpeg', size: 21 * 1024 * 1024 }), /20 MB/);
});
test('shrinks large images to budget and releases decoded bitmap', async () => {
  const api = load({ sizes: [700000, 600000, 300000] });
  const result = await api.compressPhoto({ type: 'image/jpeg', size: 3000000 });
  assert.equal(result.size, 300000);
  assert.ok(api.canvas.width <= 1600);
  assert.equal(api.closed(), true);
});
test('rejects images that cannot fit the budget', async () => {
  const api = load({ sizes: [600000] });
  await assert.rejects(api.compressPhoto({ type: 'image/png', size: 3000000 }), /500 KB/);
  assert.equal(api.closed(), true);
});
test('missing configuration blocks upload', async () => {
  await assert.rejects(load({ configured: false }).uploadPhoto(new Blob()), /ตั้งค่า/);
});
test('uploads compressed image with preset and returns only photo metadata', async () => {
  const api = load({ fetch: async (url, options) => {
    assert.equal(url, 'https://api.cloudinary.com/v1_1/test-cloud/image/upload');
    assert.equal(options.body.get('upload_preset'), 'test-preset');
    assert.equal(options.body.get('file').size, 3);
    return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/photo.jpg', public_id: 'photo', bytes: 3 }) };
  } });
  const photo = await api.uploadPhoto(new Blob(['abc']));
  assert.equal(photo.publicId, 'photo');
  assert.equal(photo.bytes, 3);
});
test('handles upload errors and invalid URLs', async () => {
  const failed = load({ fetch: async () => ({ ok: false, json: async () => ({}) }) });
  await assert.rejects(failed.uploadPhoto(new Blob()), /อัปโหลดรูปไม่สำเร็จ/);
  const invalid = load({ fetch: async () => ({ ok: true, json: async () => ({ secure_url: 'javascript:alert(1)', public_id: 'x', bytes: 1 }) }) });
  await assert.rejects(invalid.uploadPhoto(new Blob()), /ไม่ถูกต้อง/);
});
