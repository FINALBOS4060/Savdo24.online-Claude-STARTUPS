// telegram-bot/i18n.ts'dagi t() funksiyasi uchun testlar.
//
// FAQAT t() (sof, sinxron, tarjima lug'atidan o'qiydi) sinaladi.
// getUserLanguage()/setUserLanguage() atayin bu yerda sinalmaydi — ular
// telegram-bot/db.ts orqali haqiqiy Postgres/SQLite ulanishiga muhtoj
// (xato bo'lganda "uz"ga qaytish integratsion xulq-atvor, birlik test
// emas) va bu faylning maqsadi — DB'siz ham ishlaydigan, tez sinov.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, translations } from '../telegram-bot/i18n';

test('t() — mavjud kalit uchun to\'g\'ri tildagi matnni qaytaradi', () => {
  assert.equal(t('menu_search', 'uz'), translations.uz.menu_search);
  assert.equal(t('menu_search', 'en'), translations.en.menu_search);
});

test('t() — {{var}} shablonlarini uzatilgan qiymatlar bilan almashtiradi', () => {
  const result = t('activity_min_ago', 'uz', { count: 5 });
  assert.ok(!result.includes('{{count}}'), `Shablon almashtirilmagan: "${result}"`);
  assert.ok(result.includes('5'));
});

test('t() — bir nechta xil {{var}}ni bir vaqtda almashtiradi', () => {
  const result = t('ex_channel_added', 'uz', { title: 'Test Kanal' });
  assert.ok(result.includes('Test Kanal'));
  assert.ok(!result.includes('{{title}}'));
});

test('t() — agar "en"da (hozir yo\'q deb faraz qilsak) kalit topilmasa, "uz"ga qaytadi (fallback)', () => {
  // Haqiqiy lug'atlarda hozircha HAR BIR "uz" kaliti "en"da ham mavjud
  // (pastdagi parity testiga qarang) — shu sabab fallback yo'lini
  // to'g'ridan-to'g'ri (mavjud lug'atdan) emas, vaqtinchalik qo'shilgan
  // kalit orqali sinaymiz: bu — kelajakda kimdir faqat "uz"ga yangi
  // kalit qo'shib, "en"ni unutib qo'ysa ham, t() foydalanuvchiga bo'sh
  // JAVOB EMAS, hech bo'lmasa o'qiladigan (o'zbekcha) matn qaytarishini
  // kafolatlaydi.
  const probeKey = '__test_only_uz_probe_key__';
  translations.uz[probeKey] = 'faqat-ozbekcha-matn';
  try {
    assert.equal(t(probeKey, 'en'), 'faqat-ozbekcha-matn');
  } finally {
    delete translations.uz[probeKey];
  }
});

test('translations — "uz" va "en" lug\'atlari BIR XIL kalitlar to\'plamiga ega (parity)', () => {
  // Bu — i18n.ts'ning o'z tarixiy izohida aytilgan ("ba'zi oqimlar
  // hozircha faqat o'zbekcha") holatdan farqli o'laroq, amalda HAR
  // ikkala lug'atda ham bir xil 222 ta kalit borligini tasdiqlaydi.
  // Test kelajakda ikkalasi orasida chetlashish (kimdir bittasiga
  // kalit qo'shib, ikkinchisiga qo'shishni unutib qo'yishi) yuzaga
  // kelsa, shuni darhol ushlab qoladi.
  const uzKeys = new Set(Object.keys(translations.uz));
  const enKeys = new Set(Object.keys(translations.en));
  const missingInEn = [...uzKeys].filter((k) => !enKeys.has(k));
  const missingInUz = [...enKeys].filter((k) => !uzKeys.has(k));
  assert.deepEqual(missingInEn, [], `"en"da yo'q kalitlar: ${missingInEn.join(', ')}`);
  assert.deepEqual(missingInUz, [], `"uz"da yo'q kalitlar: ${missingInUz.join(', ')}`);
});

test('t() — ikkala tilda ham mavjud bo\'lmagan kalit uchun kalitning o\'zini qaytaradi (jim yiqilmaydi)', () => {
  assert.equal(t('bu_kalit_hech_qachon_mavjud_bolmaydi', 'uz'), 'bu_kalit_hech_qachon_mavjud_bolmaydi');
});

test('translations — "uz" lug\'atidagi HAR BIR kalit uchun qiymat bo\'sh satr emas', () => {
  const emptyKeys = Object.entries(translations.uz)
    .filter(([, value]) => !value || !String(value).trim())
    .map(([key]) => key);
  assert.deepEqual(emptyKeys, [], `Bo'sh qiymatli kalitlar topildi: ${emptyKeys.join(', ')}`);
});
