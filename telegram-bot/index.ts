import { Bot, Context, session, SessionFlavor, InputFile } from "grammy";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from process.cwd() or root .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

interface SessionData {
  token: string;
  startupId: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

// Telegram parse_mode: "HTML" bilan yuborilgan xabarlarda foydalanuvchi/sotuvchi
// kiritgan matn (mahsulot nomi, tavsifi, foydalanuvchi ismi va h.k.) xom holda
// qo'yilsa, unda "<", "&" kabi belgilar bo'lsa Telegram xabarni yubormay xato
// qaytaradi (yoki formatlash buziladi). Shu sabab har doim shu funksiyadan o'tkazish kerak.
function escapeHtml(input: unknown): string {
  const str = input === null || input === undefined ? "" : String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_API_TOKEN || "";

// MUHIM: agar botToken bo'sh bo'lsa, `new Bot("")` grammy ichida darhol
// (tushunarsiz, inglizcha) xato tashlaydi — PM2 buni cheksiz qayta ishga
// tushirishga (restart loop) urinardi, log'da esa haqiqiy sabab yo'qolib
// ketardi. Boshqa skriptlarda (backup-db.ts DATABASE_URL kabi) mavjud
// bo'lgan aniq tekshiruv naqshi shu yerga ham qo'shildi.
if (!botToken) {
  console.error("❌ TELEGRAM_BOT_TOKEN (yoki TELEGRAM_BOT_API_TOKEN) .env faylida sozlanmagan — bot ishga tushmaydi.");
  process.exit(1);
}
if (!process.env.APP_URL) {
  console.error("❌ APP_URL .env faylida sozlanmagan — bot server bilan bog'lana olmaydi (barcha so'rovlar 'undefined/api/...' manziliga ketardi).");
  process.exit(1);
}

const bot = new Bot<MyContext>(botToken);

bot.use(session({ initial: () => ({ token: "", startupId: "" }) }));

bot.command("start", async (ctx) => {
  const token = ctx.match;
  if (!token) {
    return ctx.reply("Assalomu alaykum! Savdo24 botiga xush kelibsiz.\n\nFoydalanish uchun:\n/bogla {kod} - saytdagi hisobni ulash\n/mahsulot {id} - mahsulotni ko'rish va sotib olish");
  }

  try {
    // Agar token 6 ta harf-raqam bo'lsa, uni bog'lash kodi sifatida qabul qilamiz
    if (token.length === 6 && /^[A-Z0-9]+$/i.test(token)) {
      const linkRes = await fetch(`${process.env.APP_URL}/api/telegram/link`, {
        method: "POST",
        headers: { 
           "Content-Type": "application/json",
          "x-telegram-bot-secret": process.env.TELEGRAM_BOT_INTERNAL_SECRET || ""
        },
        body: JSON.stringify({ code: token.toUpperCase(), telegramUserId: ctx.from?.id })
      });
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        return ctx.reply(`Tabriklaymiz, ${linkData.name}! Hisobingiz muvaffaqiyatli tasdiqlandi va bog'landi.`);
      } else {
        const errData = await linkRes.json();
        return ctx.reply(errData.error || "Bog'lashda xatolik yuz berdi. Kod muddati tugagan bo'lishi mumkin.");
      }
    }

    // Aks holda u fayl olish tokni bo'lishi mumkin
    // 14-MUAMMO: server endi secret header talab qiladi, shu sabab qo'shildi
    const res = await fetch(`${process.env.APP_URL}/api/telegram/verify/${token}`, {
      headers: { "x-telegram-bot-secret": process.env.TELEGRAM_BOT_INTERNAL_SECRET || "" }
    });
    if (!res.ok) {
      return ctx.reply("Havola eskirgan yoki noto'g'ri.");
    }
    const data = await res.json();
    
    const channelsRes = await fetch(`${process.env.APP_URL}/api/telegram/sponsor-channels`);
    const channels = await channelsRes.json();
    
    ctx.session.token = token;
    ctx.session.startupId = data.startupId;
    
    ctx.reply("Sizga kerakli faylni olish uchun quyidagi kanallarga obuna bo'ling:", {
      reply_markup: {
        inline_keyboard: channels.map((c: any) => [
          { text: `➕ Obuna bo'lish: ${c.channelUsername}`, url: `https://t.me/${c.channelUsername.replace('@', '')}` }
        ]).concat([
          [{ text: "✅ Tekshirish", callback_data: "check_subscription" }]
        ])
      }
    });
  } catch (err) {
    ctx.reply("Xatolik yuz berdi, keyinroq urinib ko'ring.");
  }
});

bot.command("bogla", async (ctx) => {
  const code = ctx.match?.trim().toUpperCase();
  if (!code) {
    return ctx.reply("Iltimos ulanish kodini kiriting. Masalan: /bogla 123456\nKodni saytdagi Profil -> Sozlamalar bo'limidan olishingiz mumkin.");
  }

  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/link`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-telegram-bot-secret": process.env.TELEGRAM_BOT_INTERNAL_SECRET || ""
      },
      body: JSON.stringify({ code, telegramUserId: ctx.from?.id })
    });

    if (res.ok) {
      const data = await res.json();
      ctx.reply(`Tabriklaymiz, ${data.name}! Hisobingiz muvaffaqiyatli bog'landi.`);
    } else {
      const data = await res.json();
      ctx.reply(data.error || "Bog'lashda xatolik yuz berdi.");
    }
  } catch (err) {
    ctx.reply("Tarmoq xatoligi yuz berdi.");
  }
});

bot.command("mahsulot", async (ctx) => {
  const id = ctx.match;
  if (!id) return ctx.reply("Mahsulot ID'sini kiriting. Masalan: /mahsulot 123");
  await showProduct(ctx, id);
});

bot.command("new_listings", async (ctx) => {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/startups?limit=5`);
    const data = await res.json();
    const startups = data.startups || data || [];
    
    if (!startups.length) return ctx.reply("Hozircha yangi elonlar yo'q.");
    
    let text = "<b>🆕 Eng so'nggi elonlar:</b>\n\n";
    startups.forEach((s: any) => {
      text += `• <b>${escapeHtml(s.name)}</b> - ${escapeHtml(s.price)} USDT\n/mahsulot ${escapeHtml(s.id)}\n\n`;
    });
    
    ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    ctx.reply("Ma'lumotlarni yuklashda xatolik.");
  }
});

bot.command("top_deals", async (ctx) => {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/startups?isTop=true&limit=5`);
    const data = await res.json();
    const startups = data.startups || data || [];
    
    if (!startups.length) return ctx.reply("Hozircha TOP elonlar yo'q.");
    
    let text = "<b>🔥 TOP Takliflar:</b>\n\n";
    startups.forEach((s: any) => {
      text += `• <b>${escapeHtml(s.name)}</b> - ${escapeHtml(s.price)} USDT\n/mahsulot ${escapeHtml(s.id)}\n\n`;
    });
    
    ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    ctx.reply("Ma'lumotlarni yuklashda xatolik.");
  }
});

bot.command("profile", async (ctx) => {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/user-stats/${ctx.from?.id}`, {
      headers: { "x-telegram-bot-secret": process.env.TELEGRAM_BOT_INTERNAL_SECRET || "" }
    });
    
    if (!res.ok) return ctx.reply("Profil ma'lumotlarini olish uchun hisobingizni bog'lang: /bogla {kod}");
    
    const data = await res.json();
    let text = `<b>👤 Profil: ${escapeHtml(data.name)}</b>\n\n`;
    text += `📧 Email: ${escapeHtml(data.email)}\n`;
    text += `💰 Balans: ${escapeHtml(data.balance)} USDT\n`;
    text += `🔗 Referral kod: <code>${escapeHtml(data.referralCode || 'Mavjud emas')}</code>\n`;
    text += `👥 Jami referrallar: ${escapeHtml(data.referralCount)}\n`;
    text += `🎁 Jami mukofot: ${escapeHtml(data.totalEarned)} USDT`;
    
    ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    ctx.reply("Profil ma'lumotlarini yuklashda xatolik.");
  }
});

// Handle plain text ID as well
// 123-band: startup ID'lar (server.ts) foydalanuvchi kiritgan nomdan
// generatsiya qilinadigan slug (kamida 150 belgigacha + tasodifiy hex
// qo'shimcha) — avval bu yerda `text.length < 20` sharti bor edi, ya'ni
// 20 belgidan uzunroq (haqiqatda ko'pchilik) slug'lar oddiy matn sifatida
// yuborilganda SIZINGDA jimgina e'tiborsiz qoldirilardi (hech qanday
// javob yo'q). Endi uzunlik chegarasi haqiqiy slug formatiga mos (160)
// va faqat slug pattern'iga (kichik harf/raqam/tire) mos matnlar mahsulot
// ID sifatida qabul qilinadi — bo'sh joy/tinish belgili oddiy xabarlar
// (savol, shikoyat va h.k.) endi ID qidiruviga yuborilib, keraksiz
// API so'rovi yaratmaydi.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text.startsWith("/") && text.length <= 160 && SLUG_PATTERN.test(text)) {
    await showProduct(ctx, text);
  }
});

async function showProduct(ctx: any, id: string) {
  try {
    const res = await fetch(`${process.env.APP_URL}/api/startups/${id}`);
    if (!res.ok) return ctx.reply("Mahsulot topilmadi.");
    
    const product = await res.json();
    if (product.soldStatus === "sotildi") {
      return ctx.reply(`"${product.name}" mahsuloti allaqachon sotilgan.`);
    }

    const message = `<b>${escapeHtml(product.name)}</b>\n\n${escapeHtml(product.description || "Tavsif mavjud emas.")}\n\n💰 Narxi: ${escapeHtml(product.price)} USDT`;
    
    const keyboard = [
      [{ text: `💳 Sotib olish (${product.price} USDT)`, callback_data: `buy_${product.id}` }]
    ];

    // MUHIM: /api/upload orqali yuklangan rasmlar uchun `image` maydoni
    // nisbiy (relative) yo'l ko'rinishida saqlanadi (masalan "/api/files/xxx"),
    // to'liq URL emas. Telegram replyWithPhoto esa to'liq (http/https) URL
    // yoki file_id talab qiladi — nisbiy yo'l yuborilsa Telegram uni rad etib,
    // xato tashlaydi. Shu sabab kerak bo'lsa APP_URL bilan to'liqlanadi.
    const imageUrl = product.image
      ? (product.image.startsWith("/") ? `${process.env.APP_URL}${product.image}` : product.image)
      : null;

    if (imageUrl) {
      try {
        await ctx.replyWithPhoto(imageUrl, {
          caption: message,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch (photoErr) {
        // Rasm yuborib bo'lmasa (masalan Telegram tomonidan noto'g'ri format
        // deb rad etilsa), foydalanuvchi hech narsa olmay qolmasligi uchun
        // oddiy matnli xabarga qaytamiz.
        console.error("replyWithPhoto error, falling back to text:", photoErr);
        await ctx.reply(message, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard }
        });
      }
    } else {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  } catch (err) {
    ctx.reply("Mahsulot ma'lumotlarini yuklashda xatolik.");
  }
}

bot.callbackQuery(/^buy_(.+)$/, async (ctx) => {
  const startupId = ctx.match[1];
  await ctx.answerCallbackQuery("To'lov tayyorlanmoqda...");

  try {
    const res = await fetch(`${process.env.APP_URL}/api/telegram/create-payment`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-telegram-bot-secret": process.env.TELEGRAM_BOT_INTERNAL_SECRET || ""
      },
      body: JSON.stringify({ 
        telegramUserId: ctx.from?.id,
        startupId 
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return ctx.reply(data.error || "To'lov yaratishda xatolik.");
    }

    // 41-MUAMMO: rasmsiz mahsulotlar oddiy matnli xabar (text) sifatida
    // yuborilgan, rasmli mahsulotlar esa caption bilan (photo) — shu farqni
    // hisobga olmay doim editMessageCaption chaqirilsa, matnli xabarlarda
    // Telegram xato qaytarib, butun xarid oqimi try/catch ichida "Xatolik
    // yuz berdi"ga tushib qolardi. Endi xabar turiga qarab tanlanadi.
    const newMarkup = {
      inline_keyboard: [
        [{ text: "💰 To'lovni yakunlash", url: data.paymentUrl }]
      ]
    };
    const hasPhoto = !!(ctx.callbackQuery.message as any)?.photo;
    if (hasPhoto) {
      await ctx.editMessageCaption({
        caption: (ctx.callbackQuery.message?.caption || "") + "\n\n✅ To'lov havolasi tayyor! Quyidagi tugma yoki QR-kod orqali to'lang.",
        parse_mode: "HTML",
        reply_markup: newMarkup
      });
    } else {
      await ctx.editMessageText(
        (ctx.callbackQuery.message?.text || "") + "\n\n✅ To'lov havolasi tayyor! Quyidagi tugma yoki QR-kod orqali to'lang.",
        { parse_mode: "HTML", reply_markup: newMarkup }
      );
    }

    // QR-kodni reply sifatida yuborish (mavjud bo'lsa)
    if (data.qrCode && typeof data.qrCode === "string" && data.qrCode.includes(",")) {
      const qrBuffer = Buffer.from(data.qrCode.split(",")[1], "base64");
      await ctx.replyWithPhoto(
        new InputFile(qrBuffer, "qr-payment.png"),
        {
          caption: "📱 Kripto hamyoningiz orqali to'lash uchun shu QR-kodni skanerlang.",
          reply_to_message_id: ctx.callbackQuery.message?.message_id
        }
      );
    }

  } catch (err) {
    console.error("Buy callback error:", err);
    await ctx.reply("Xatolik yuz berdi, iltimos qayta urinib ko'ring.");
  }
});

const checkSubscription = async (channels: any[], userId: number) => {
  const notSubscribed = [];
  for (const channel of channels) {
    try {
      const member = await bot.api.getChatMember(channel.channelId, userId);
      if (!["member", "administrator", "creator"].includes(member.status)) {
        notSubscribed.push(channel);
      }
    } catch (err) {
      notSubscribed.push(channel);
    }
  }
  return notSubscribed;
};

bot.callbackQuery("check_subscription", async (ctx) => {
  if (!ctx.session?.token) return ctx.answerCallbackQuery("Sessiya eskirgan.");

  try {
    const channelsRes = await fetch(`${process.env.APP_URL}/api/telegram/sponsor-channels`);
    const channels = await channelsRes.json();

    const notSubscribed = await checkSubscription(channels, ctx.from!.id);
    
    if (notSubscribed.length > 0) {
      return ctx.answerCallbackQuery("Hali quyidagi kanallarga obuna bo'lmagansiz: " + notSubscribed.map((c:any)=>c.channelUsername).join(", "));
    }
  
    // 13-MUAMMO: server endi secret header talab qiladi, shu sabab qo'shildi
    const res = await fetch(`${process.env.APP_URL}/api/telegram/deliver/${ctx.session.token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-secret": process.env.TELEGRAM_BOT_INTERNAL_SECRET || ""
      },
      body: JSON.stringify({ telegramUserId: ctx.from?.id })
    });

    if (res.ok) {
      const data = await res.json();
      await ctx.answerCallbackQuery();
      ctx.reply(`Faylingiz tayyor: ${data.deliveryUrl}`);
    } else {
      // 68-MUAMMO: bu yo'lda ctx.answerCallbackQuery() umuman chaqirilmagan
      // edi (faqat "kanalga obuna bo'lmagan" holatida chaqirilardi) —
      // tugma Telegram mijozida "yuklanmoqda" holatida osilib qolardi.
      // Bundan tashqari serverdan qaytgan aniq xato matni ham o'qilmasdi.
      const data = await res.json().catch(() => ({}));
      await ctx.answerCallbackQuery(data.error || "Xatolik yuz berdi, faylni olib bo'lmadi.");
      ctx.reply(data.error || "Xatolik yuz berdi, faylni olib bo'lmadi.");
    }
  } catch (err) {
    ctx.answerCallbackQuery("Tekshirishda xatolik yuz berdi.");
  }
});

bot.start();
