// telegram-bot/format.ts uchun testlar.
//
// format.ts o'zi hech qanday bot/sessiya holatiga ega emas (kirish
// qiymati asosida chiqish qaytaradi) — shu sabab bu yerda haqiqiy
// Telegram bot, HTTP so'rov yoki bazaga ulanish shart emas. (Eslatma:
// avval bu faylni import qilishning o'zi ham — telegram-bot/i18n.ts
// orqali bilvosita — telegram-bot/db.ts'dagi Prisma clientini DARHOL
// yaratishga urinardi, bu esa DB sozlanmagan test muhitida importning
// o'ziyoq muvaffaqiyatsiz bo'lishiga olib kelardi. db.ts endi lazy —
// client faqat haqiqatan ishlatilganda yaratiladi, shu sabab bu test
// hech qanday DATABASE_URL'siz ham ishonchli ishlaydi.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  categoryEmoji,
  paymentStatusLabel,
  parseChannelLinkToUsername,
  mapWithConcurrency,
  renderScreen,
  exchangeChannelStatusLine
} from '../telegram-bot/format';
import { MyContext } from '../telegram-bot/types';

// DIZAYN TUZATISH testlari: renderScreen — inline-tugma bosilganda mavjud
// xabarni tahrirlaydi (chatni "o'lik" eski ekranlar bilan to'ldirmaslik
// uchun), lekin tahrirlab bo'lmasa (yoki chaqiruv oddiy xabardan kelgan
// bo'lsa) muloyimlik bilan yangi xabarga qaytadi.
function fakeCtxWithCallback(overrides: { editThrows?: Error } = {}): MyContext & {
  editCalls: unknown[][];
  replyCalls: unknown[][];
} {
  const editCalls: unknown[][] = [];
  const replyCalls: unknown[][] = [];
  const ctx = {
    from: { id: 1 },
    callbackQuery: { message: { message_id: 10, text: 'eski matn' } },
    editMessageText: async (text: unknown, extra: unknown) => {
      editCalls.push([text, extra]);
      if (overrides.editThrows) throw overrides.editThrows;
      return true;
    },
    reply: async (text: unknown, extra: unknown) => {
      replyCalls.push([text, extra]);
      return {};
    }
  };
  return Object.assign(ctx, { editCalls, replyCalls }) as unknown as MyContext & {
    editCalls: unknown[][];
    replyCalls: unknown[][];
  };
}

test('escapeHtml — &, <, > belgilarini HTML-xavfsiz shaklga o\'giradi', () => {
  assert.equal(escapeHtml('<b>Salom & Xayr</b>'), '&lt;b&gt;Salom &amp; Xayr&lt;/b&gt;');
});

test('escapeHtml — null/undefined kiritilsa bo\'sh satr qaytaradi (xato tashlamaydi)', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml — son kabi HTML-belgisiz qiymatlarni ham xavfsiz string qiladi', () => {
  assert.equal(escapeHtml(42), '42');
});

test('categoryEmoji — ma\'lum ikon kaliti uchun mos emoji qaytaradi', () => {
  assert.equal(categoryEmoji('rocket_launch'), '🚀');
  assert.equal(categoryEmoji('security'), '🔒');
});

test('categoryEmoji — noma\'lum yoki bo\'sh kalit uchun standart 📦 qaytaradi', () => {
  assert.equal(categoryEmoji('mavjud_bolmagan_kalit'), '📦');
  assert.equal(categoryEmoji(undefined), '📦');
});

test('paymentStatusLabel — mos til uchun to\'g\'ri belgi qaytaradi', () => {
  assert.equal(paymentStatusLabel('completed', 'uz'), '✅ Tugallandi');
  assert.equal(paymentStatusLabel('completed', 'en'), '✅ Completed');
});

test('paymentStatusLabel — noma\'lum status uchun uz-fallback, undan keyin xom qiymat qaytadi', () => {
  // 'en' lug'atida yo'q, lekin 'uz'da bor bo'lgan holat yo'q shu sabab
  // ikkalasida ham yo'q kalit — funksiya statusning o'zini qaytarishi kerak.
  assert.equal(paymentStatusLabel('unknown_status', 'en'), 'unknown_status');
});

test('parseChannelLinkToUsername — oddiy t.me/username havolasini to\'g\'ri o\'giradi', () => {
  assert.deepEqual(parseChannelLinkToUsername('https://t.me/savdo24'), {
    username: '@savdo24',
    isInviteLink: false
  });
});

test('parseChannelLinkToUsername — telegram.me, www. va query/hash qismlarini ham qo\'llab-quvvatlaydi', () => {
  assert.deepEqual(parseChannelLinkToUsername('http://www.telegram.me/savdo24?start=abc'), {
    username: '@savdo24',
    isInviteLink: false
  });
  assert.deepEqual(parseChannelLinkToUsername('https://t.me/savdo24#section'), {
    username: '@savdo24',
    isInviteLink: false
  });
});

test('parseChannelLinkToUsername — "t.me/s/username" (veb-preview havolasi) uchun "s/" prefiksini olib tashlaydi', () => {
  assert.deepEqual(parseChannelLinkToUsername('https://t.me/s/savdo24'), {
    username: '@savdo24',
    isInviteLink: false
  });
});

test('parseChannelLinkToUsername — taklif havolalarini (t.me/+xxx va t.me/joinchat/xxx) alohida bayroq bilan belgilaydi', () => {
  assert.deepEqual(parseChannelLinkToUsername('https://t.me/+AbCdEfGhIjK'), {
    username: null,
    isInviteLink: true
  });
  assert.deepEqual(parseChannelLinkToUsername('https://t.me/joinchat/AbCdEfGhIjK'), {
    username: null,
    isInviteLink: true
  });
});

test('parseChannelLinkToUsername — t.me domeniga tegishli bo\'lmagan matn uchun null qaytaradi', () => {
  assert.deepEqual(parseChannelLinkToUsername('shunchaki matn, havola emas'), {
    username: null,
    isInviteLink: false
  });
  assert.deepEqual(parseChannelLinkToUsername('https://example.com/savdo24'), {
    username: null,
    isInviteLink: false
  });
});

test('parseChannelLinkToUsername — ichida qo\'shimcha "/" bo\'lgan (masalan post havolasi) manzilni rad etadi', () => {
  assert.deepEqual(parseChannelLinkToUsername('https://t.me/savdo24/123'), {
    username: null,
    isInviteLink: false
  });
});

test('mapWithConcurrency — natijalarni kiritilgan massiv bilan bir xil tartibda qaytaradi', async () => {
  const items = [5, 1, 4, 2, 3];
  const results = await mapWithConcurrency(items, 2, async (n) => {
    // Har xil "kechikish" bilan ham tartib buzilmasligini tekshirish uchun.
    await new Promise((resolve) => setTimeout(resolve, n));
    return n * 10;
  });
  assert.deepEqual(results, [50, 10, 40, 20, 30]);
});

test('mapWithConcurrency — bir vaqtning o\'zida "concurrency" dan ortiq chaqiruv ishlamaydi', async () => {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 10 }, (_, i) => i);

  await mapWithConcurrency(items, 3, async (i) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return i;
  });

  assert.ok(maxActive <= 3, `Kutilgan eng ko'p 3 ta parallel chaqiruv, lekin ${maxActive} ta bo'ldi`);
});

test('mapWithConcurrency — bo\'sh massiv uchun bo\'sh natija qaytaradi (worker ishga tushmaydi)', async () => {
  const results = await mapWithConcurrency([], 5, async (n: number) => n);
  assert.deepEqual(results, []);
});

test('renderScreen — callbackQuery orqali kelsa mavjud xabarni TAHRIRLAYDI, yangi xabar yubormaydi', async () => {
  const ctx = fakeCtxWithCallback();
  await renderScreen(ctx, 'yangi matn', { parse_mode: 'HTML' });
  assert.equal(ctx.editCalls.length, 1);
  assert.equal(ctx.editCalls[0][0], 'yangi matn');
  assert.equal(ctx.replyCalls.length, 0);
});

test('renderScreen — callbackQuery YO\'Q bo\'lsa (masalan /start yoki matn xabar) to\'g\'ridan-to\'g\'ri yangi xabar yuboradi', async () => {
  const editCalls: unknown[][] = [];
  const replyCalls: unknown[][] = [];
  const ctx = {
    from: { id: 1 },
    callbackQuery: undefined,
    editMessageText: async (...args: unknown[]) => { editCalls.push(args); },
    reply: async (...args: unknown[]) => { replyCalls.push(args); return {}; }
  } as unknown as MyContext;
  await renderScreen(ctx, 'salom', {});
  assert.equal(editCalls.length, 0);
  assert.equal(replyCalls.length, 1);
});

test('renderScreen — "message is not modified" xatosini jim o\'tkazadi (qayta yangi xabar YUBORMAYDI)', async () => {
  const ctx = fakeCtxWithCallback({ editThrows: Object.assign(new Error('Bad Request'), { description: 'Bad Request: message is not modified' }) });
  await renderScreen(ctx, 'bir xil matn', {});
  assert.equal(ctx.editCalls.length, 1);
  assert.equal(ctx.replyCalls.length, 0);
});

test('renderScreen — tahrirlab bo\'lmasa (masalan asl xabar rasm edi) yangi xabarga MULOYIM QAYTADI', async () => {
  const ctx = fakeCtxWithCallback({ editThrows: Object.assign(new Error('Bad Request'), { description: 'Bad Request: there is no text in the message to edit' }) });
  await renderScreen(ctx, 'mahsulotlar ro\'yxati', { parse_mode: 'HTML' });
  assert.equal(ctx.editCalls.length, 1);
  assert.equal(ctx.replyCalls.length, 1);
  assert.equal(ctx.replyCalls[0][0], 'mahsulotlar ro\'yxati');
});

// TUZATILDI (foydalanuvchi talabi — "yana qancha odam obuna bo'lishi va
// undan keyin navbatdan olinishi haqida ma'lumot bo'lsin"): endi bu
// funksiya 5 xil holatni aniq ajratadi — quyidagi testlar shu farqlarni
// tekshiradi.

test('exchangeChannelStatusLine — blockedByAdmin hamma narsadan ustun', () => {
  const line = exchangeChannelStatusLine({ blockedByAdmin: true, isActive: false, lastOfferedAt: null }, 'uz', 2);
  assert.match(line, /Admin tomonidan bloklangan/);
});

test('exchangeChannelStatusLine — isActive=true va lastOfferedAt=null bo\'lsa "navbatda kutmoqda" (hali ko\'rsatilmagan)', () => {
  const line = exchangeChannelStatusLine({ blockedByAdmin: false, isActive: true, lastOfferedAt: null }, 'uz', 2);
  assert.match(line, /kutmoqda/);
  assert.doesNotMatch(line, /1 ta kanalga obuna/);
});

test('exchangeChannelStatusLine — isActive=true va lastOfferedAt bor bo\'lsa aniq multiplier bilan keyingi qadamni ko\'rsatadi', () => {
  const line = exchangeChannelStatusLine({ blockedByAdmin: false, isActive: true, lastOfferedAt: new Date() }, 'uz', 3);
  assert.match(line, /\+3 obunachi/);
  assert.match(line, /ko'rsatilmoqda/);
});

test('exchangeChannelStatusLine — multiplier berilmasa standart qiymat (2) ishlatiladi', () => {
  const line = exchangeChannelStatusLine({ blockedByAdmin: false, isActive: true, lastOfferedAt: new Date() }, 'uz');
  assert.match(line, /\+2 obunachi/);
});

test('exchangeChannelStatusLine — suspendedDueToLapse bo\'lsa "to\'xtatilgan" holati', () => {
  const line = exchangeChannelStatusLine({ blockedByAdmin: false, isActive: false, suspendedDueToLapse: true, lastOfferedAt: new Date() }, 'uz', 2);
  assert.match(line, /To'xtatilgan/);
});

test('exchangeChannelStatusLine — navbatdan olib tashlangan (kvota) holatida qayta qo\'shish yo\'li ko\'rsatiladi', () => {
  const line = exchangeChannelStatusLine({ blockedByAdmin: false, isActive: false, suspendedDueToLapse: false, suspendedReason: 'obunachi yig\'ilgan', lastOfferedAt: new Date() }, 'uz', 2);
  assert.match(line, /Kanalimni qo'shish/);
});

test('exchangeChannelStatusLine — inglizcha tilda ham ishlaydi', () => {
  const line = exchangeChannelStatusLine({ blockedByAdmin: false, isActive: true, lastOfferedAt: new Date() }, 'en', 2);
  assert.match(line, /\+2 subscribers/);
  assert.match(line, /currently being shown/);
});
