import { Bot, Context, session, SessionFlavor, InputFile } from "grammy";
import dotenv from "dotenv";

dotenv.config();

interface SessionData {
  token: string;
  startupId: string;
}

type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_API_TOKEN || "");

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
    const res = await fetch(`${process.env.APP_URL}/api/telegram/verify/${token}`);
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
  const code = ctx.match;
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
      text += `• <b>${s.name}</b> - ${s.price} USDT\n/mahsulot ${s.id}\n\n`;
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
      text += `• <b>${s.name}</b> - ${s.price} USDT\n/mahsulot ${s.id}\n\n`;
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
    let text = `<b>👤 Profil: ${data.name}</b>\n\n`;
    text += `📧 Email: ${data.email}\n`;
    text += `💰 Balans: ${data.balance} USDT\n`;
    text += `🔗 Referral kod: <code>${data.referralCode || 'Mavjud emas'}</code>\n`;
    text += `👥 Jami referrallar: ${data.referralCount}\n`;
    text += `🎁 Jami mukofot: ${data.totalEarned} USDT`;
    
    ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    ctx.reply("Profil ma'lumotlarini yuklashda xatolik.");
  }
});

// Handle plain text ID as well
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  if (!text.startsWith("/") && text.length < 20) {
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

    const message = `<b>${product.name}</b>\n\n${product.shortDescription || "Tavsif mavjud emas."}\n\n💰 Narxi: ${product.price} USDT`;
    
    const keyboard = [
      [{ text: `💳 Sotib olish (${product.price} USDT)`, callback_data: `buy_${product.id}` }]
    ];

    if (product.imageUrl) {
      await ctx.replyWithPhoto(product.imageUrl, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard }
      });
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

    // Asosiy post caption'ini yangilash
    await ctx.editMessageCaption({
      caption: (ctx.callbackQuery.message?.caption || "") + "\n\n✅ To'lov havolasi tayyor! Quyidagi tugma yoki QR-kod orqali to'lang.",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💰 To'lovni yakunlash", url: data.paymentUrl }]
        ]
      }
    });

    // QR-kodni reply sifatida yuborish
    const qrBuffer = Buffer.from(data.qrCode.split(",")[1], "base64");
    await ctx.replyWithPhoto(
      new InputFile(qrBuffer, "qr-payment.png"),
      {
        caption: "📱 Kripto hamyoningiz orqali to'lash uchun shu QR-kodni skanerlang.",
        reply_to_message_id: ctx.callbackQuery.message?.message_id
      }
    );

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
  
    const res = await fetch(`${process.env.APP_URL}/api/telegram/deliver/${ctx.session.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramUserId: ctx.from?.id })
    });

    if (res.ok) {
      const data = await res.json();
      ctx.reply(`Faylingiz tayyor: ${data.deliveryUrl}`);
    } else {
      ctx.reply("Xatolik yuz berdi, faylni olib bo'lmadi.");
    }
  } catch (err) {
    ctx.answerCallbackQuery("Tekshirishda xatolik yuz berdi.");
  }
});

bot.start();
