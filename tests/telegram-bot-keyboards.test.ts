// telegram-bot/keyboards.ts uchun testlar.
//
// Bu yerdagi funksiyalarning aksariyati haqiqiy grammy `Context`ning
// FAQAT `ctx.session` maydoniga muhtoj — shu sabab haqiqiy Telegram
// update yoki bot instansiyasi o'rniga, kerakli qismini o'zida saqlagan
// yengil soxta (fake) obyekt bilan to'liq testlanadi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isMenuButton,
  clearAwaitingState,
  productsMenuKeyboard,
  moreMenuKeyboard,
  mainMenuKeyboard,
  backToMenuKeyboard,
  backToListButton
} from '../telegram-bot/keyboards';
import { t } from '../telegram-bot/i18n';
import { MyContext, SessionData } from '../telegram-bot/types';

function fakeCtx(session: Partial<SessionData> = {}): MyContext {
  return { session: { token: '', startupId: '', ...session } } as unknown as MyContext;
}

test('isMenuButton — "uz" yoki "en" matnidan istalgan biri kelsa true qaytaradi', () => {
  assert.equal(isMenuButton(t('menu_search', 'uz'), 'menu_search'), true);
  assert.equal(isMenuButton(t('menu_search', 'en'), 'menu_search'), true);
});

test('isMenuButton — mos kelmagan/bo\'lak matn uchun false qaytaradi', () => {
  assert.equal(isMenuButton('tasodifiy matn', 'menu_search'), false);
});

test('clearAwaitingState — barcha "awaiting*" bayroqlarni va vaqtinchalik holatlarni tozalaydi', () => {
  const ctx = fakeCtx({
    awaitingSearch: true,
    awaitingExchangeChannel: true,
    awaitingReviewComment: true,
    reviewStartupId: 'abc',
    reviewRating: 5,
    awaitingSupportSubject: true,
    awaitingSupportMessage: true,
    supportSubject: 'mavzu',
    awaitingReportReason: true,
    reportChannelId: 'xyz'
  });

  clearAwaitingState(ctx);

  assert.equal(ctx.session.awaitingSearch, false);
  assert.equal(ctx.session.awaitingExchangeChannel, false);
  assert.equal(ctx.session.awaitingReviewComment, false);
  assert.equal(ctx.session.reviewStartupId, undefined);
  assert.equal(ctx.session.reviewRating, undefined);
  assert.equal(ctx.session.awaitingSupportSubject, false);
  assert.equal(ctx.session.awaitingSupportMessage, false);
  assert.equal(ctx.session.supportSubject, undefined);
  assert.equal(ctx.session.awaitingReportReason, false);
  assert.equal(ctx.session.reportChannelId, undefined);
});

test('clearAwaitingState — "language" va "token" kabi awaiting bo\'lmagan maydonlarga tegmaydi', () => {
  const ctx = fakeCtx({ language: 'en', token: 'saqlanib-qolishi-kerak' });
  clearAwaitingState(ctx);
  assert.equal(ctx.session.language, 'en');
  assert.equal(ctx.session.token, 'saqlanib-qolishi-kerak');
});

test('productsMenuKeyboard/moreMenuKeyboard — har bir tugmada bo\'sh bo\'lmagan matn va callback_data bor', () => {
  for (const lang of ['uz', 'en'] as const) {
    for (const keyboard of [productsMenuKeyboard(lang), moreMenuKeyboard(lang)]) {
      for (const row of keyboard.inline_keyboard) {
        for (const button of row) {
          assert.ok(button.text.trim().length > 0, `Bo'sh tugma matni (${lang})`);
          assert.ok(button.callback_data.trim().length > 0, `Bo'sh callback_data (${lang})`);
        }
      }
    }
  }
});

test('mainMenuKeyboard — ctx.session.language bo\'lmasa "uz" standart tilida quriladi', () => {
  const ctx = fakeCtx({});
  const keyboard = mainMenuKeyboard(ctx);
  // grammy Keyboard obyekti .build() orqali qatorlarga aylantiriladi.
  const rows = (keyboard as any).build();
  const firstButtonText = rows[0][0].text;
  assert.equal(firstButtonText, t('menu_products', 'uz'));
});

test('backToMenuKeyboard — doim "bosh menyu" tugmasini o\'z ichiga oladi', () => {
  const ctx = fakeCtx({ language: 'en' });
  const keyboard = backToMenuKeyboard(ctx) as { inline_keyboard: { text: string; callback_data: string }[][] };
  const flatButtons = keyboard.inline_keyboard.flat();
  assert.ok(flatButtons.some((b) => b.callback_data === 'menu_home'));
  assert.ok(flatButtons.some((b) => b.text === t('back_to_menu', 'en')));
});

test('backToListButton — ctx.session.lastList bo\'lmasa null qaytaradi', () => {
  const ctx = fakeCtx({});
  assert.equal(backToListButton(ctx), null);
});

test('backToListButton — "category" ro\'yxati uchun cat_<id>_<page> callback_data quradi', () => {
  const ctx = fakeCtx({ lastList: { kind: 'category', page: 2, categoryId: 'cat-1' } });
  const result = backToListButton(ctx);
  assert.ok(result);
  assert.equal(result![0].callback_data, 'cat_cat-1_2');
});

test('backToListButton — "search" ro\'yxati uchun so\'rovni URL-encode qiladi', () => {
  const ctx = fakeCtx({ lastList: { kind: 'search', page: 1, query: 'wireless mouse' } });
  const result = backToListButton(ctx);
  assert.ok(result);
  assert.equal(result![0].callback_data, `search_${encodeURIComponent('wireless mouse')}_1`);
});

test('backToListButton — "new"/"top" ro\'yxatlari uchun list_<kind>_<page> quradi', () => {
  const ctx = fakeCtx({ lastList: { kind: 'top', page: 3 } });
  const result = backToListButton(ctx);
  assert.ok(result);
  assert.equal(result![0].callback_data, 'list_top_3');
});
