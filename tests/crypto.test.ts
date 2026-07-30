// 122-bosqich: lib/crypto.ts uchun avtomatik testlar. ENCRYPTION_KEY
// atayin test boshida (importdan OLDIN) o'rnatiladi — aks holda dev
// rejimida tasodifiy vaqtinchalik kalit ishlatiladi (bu ham to'g'ri
// ishlaydi, lekin har test ishga tushganda kalit boshqacha bo'ladi;
// aniq kalit bilan test qilish natijani takrorlanadigan qiladi).
process.env.ENCRYPTION_KEY = 'test-encryption-key-for-automated-tests-only';
process.env.NODE_ENV = 'test';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';

test('encryptSecret + decryptSecret — round-trip asl matnni qaytaradi', () => {
  const original = 'sk_live_super_secret_stripe_key_12345';
  const encrypted = encryptSecret(original);
  assert.notEqual(encrypted, original);
  assert.equal(decryptSecret(encrypted), original);
});

test('encryptSecret — natija "iv:encrypted:tag" formatida (3 qism)', () => {
  const encrypted = encryptSecret('hello');
  assert.equal(encrypted.split(':').length, 3);
});

test('encryptSecret — bir xil matn har safar boshqa natija beradi (tasodifiy IV)', () => {
  const a = encryptSecret('same-text');
  const b = encryptSecret('same-text');
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), 'same-text');
  assert.equal(decryptSecret(b), 'same-text');
});

test('decryptSecret — noto\'g\'ri formatdagi matnda xato tashlaydi (jimgina noto\'g\'ri natija bermaydi)', () => {
  assert.throws(() => decryptSecret('faqat-bitta-qism'));
});

test('decryptSecret — buzilgan tag bilan xato tashlaydi (GCM yaxlitlik tekshiruvi)', () => {
  const encrypted = encryptSecret('maxfiy-matn');
  const [iv, data, tag] = encrypted.split(':');
  const corruptedTag = tag.slice(0, -2) + (tag.slice(-2) === '00' ? '11' : '00');
  assert.throws(() => decryptSecret(`${iv}:${data}:${corruptedTag}`));
});
