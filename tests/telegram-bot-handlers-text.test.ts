// telegram-bot/format.ts'dagi SLUG_PATTERN uchun testlar (bu naqsh
// handlers-text.ts'dagi oxirgi fallback handler tomonidan ishlatiladi:
// erkin matn xabari mahsulot-slug sifatida talqin qilinishi kerakmi
// yoki "unrecognized_input" javobiga tushishi kerakmi, shuni hal qiladi).
// Regexni testda qayta yozish o'rniga, haqiqiy kodda ishlatiladigan
// naqshning O'ZI import qilinadi — shu bilan test va ishlab chiqarish
// kodi hech qachon bir-biridan chetlashib qolmaydi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLUG_PATTERN } from '../telegram-bot/format';

test('SLUG_PATTERN — oddiy bir so\'zli va tire bilan ajratilgan slug\'larni qabul qiladi', () => {
  assert.equal(SLUG_PATTERN.test('iphone15'), true);
  assert.equal(SLUG_PATTERN.test('premium-vpn-1-oy'), true);
  assert.equal(SLUG_PATTERN.test('a-b-c-d-1-2-3'), true);
});

test('SLUG_PATTERN — bosh harf, bo\'sh joy yoki maxsus belgili matnni rad etadi', () => {
  assert.equal(SLUG_PATTERN.test('iPhone15'), false);
  assert.equal(SLUG_PATTERN.test('salom dunyo'), false);
  assert.equal(SLUG_PATTERN.test('slug_bilan_pastki_chiziq'), false);
  assert.equal(SLUG_PATTERN.test('slug!'), false);
});

test('SLUG_PATTERN — bo\'sh satrni va yakka tiredan iborat matnni rad etadi', () => {
  assert.equal(SLUG_PATTERN.test(''), false);
  assert.equal(SLUG_PATTERN.test('-'), false);
  assert.equal(SLUG_PATTERN.test('slug-'), false);
  assert.equal(SLUG_PATTERN.test('-slug'), false);
});

test('SLUG_PATTERN — ikki marta ketma-ket tireni ("--") rad etadi', () => {
  assert.equal(SLUG_PATTERN.test('slug--ikkinchi'), false);
});
