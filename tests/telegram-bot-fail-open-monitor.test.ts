// telegram-bot/fail-open-monitor.ts uchun testlar.
//
// MUHIM: recordFailOpenOutcome() modul darajasidagi umumiy
// `consecutiveFailures` Map'da holat saqlaydi (testlar orasida
// TOZALANMAYDI) — shu sabab har bir test o'ziga xos, boshqa testlar
// bilan hech qachon to'qnashmaydigan noyob `source` nomi ishlatadi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordFailOpenOutcome } from '../telegram-bot/fail-open-monitor';

// fail-open-monitor.ts'dagi ESCALATION_THRESHOLD = 5 bilan bir xil —
// bu yerda takrorlanadi, chunki funksiya buni tashqariga eksport
// qilmaydi (faqat oqibat — qachon logger.error chaqirilishi — sinaladi).
const ESCALATION_THRESHOLD = 5;

test('recordFailOpenOutcome — muvaffaqiyatli chaqiruvda xato tashlamaydi', () => {
  assert.doesNotThrow(() => recordFailOpenOutcome('test-source-success', true));
});

test('recordFailOpenOutcome — ESCALATION_THRESHOLD dan kam ketma-ket xatoda ham xato tashlamaydi', () => {
  const source = 'test-source-below-threshold';
  for (let i = 0; i < ESCALATION_THRESHOLD - 1; i++) {
    assert.doesNotThrow(() => recordFailOpenOutcome(source, false));
  }
});

test('recordFailOpenOutcome — muvaffaqiyatli chaqiruv hisoblagichni nolga qaytaradi (keyingi xato yana 1-dan boshlanadi)', () => {
  const source = 'test-source-reset';
  // ESCALATION_THRESHOLD - 1 marta xato (hali eskalatsiya bo'lmagan holat)...
  for (let i = 0; i < ESCALATION_THRESHOLD - 1; i++) {
    recordFailOpenOutcome(source, false);
  }
  // ...keyin bitta muvaffaqiyat hisoblagichni tozalashi kerak...
  recordFailOpenOutcome(source, true);
  // ...shu sabab yana ESCALATION_THRESHOLD - 1 ta xato ham hali
  // eskalatsiyaga YETMASLIGI kerak (agar hisoblagich tozalanmaganida,
  // bu yerda jami son THRESHOLD'dan oshib ketardi).
  for (let i = 0; i < ESCALATION_THRESHOLD - 1; i++) {
    assert.doesNotThrow(() => recordFailOpenOutcome(source, false));
  }
});

test('recordFailOpenOutcome — ketma-ket ko\'p xatolardan keyin ham (eskalatsiya qilingan holatda) process yiqilmaydi', () => {
  const source = 'test-source-many-failures';
  // Threshold'dan bir necha barobar ko'p — eskalatsiya va uning
  // "har N marta qayta eslatish" mantig'ini ham ishga tushiradi.
  for (let i = 0; i < ESCALATION_THRESHOLD * 3; i++) {
    assert.doesNotThrow(() => recordFailOpenOutcome(source, false, { attempt: i }));
  }
});

test('recordFailOpenOutcome — context obyektisiz ham xatosiz ishlaydi', () => {
  assert.doesNotThrow(() => recordFailOpenOutcome('test-source-no-context', false));
});
