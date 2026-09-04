import crypto from "crypto";
import {
  prisma,
  getSetting,
  getStripe,
  createNotification,
  notifyUserTelegram,
  sendEmail,
  getReferralCount,
} from "./context";
import { splitAmount, roundToCents, PLATFORM_FEE_PERCENT } from "./money";
import { escapeHtml, getReferralTier } from "./pure-helpers";
import { logger } from "./logger";

// 128-bosqich (server.ts modullashtirish davomi): bu fayl server.ts'dan
// ko'chirildi — createPaymentOrder() va finalizeCompletedPayment(). Ikkalasi
// ham CoinGate/Stripe webhook'lari (src/routes/payments.ts va server.ts'dagi
// /api/payments/stripe-webhook, u xom (raw) body kerak bo'lgani uchun
// server.ts'da qoladi) tomonidan ishlatiladi. Mantiq AYNAN o'zgarishsiz —
// 91-band (o'z loyihasini sotib olish taqig'i), idempotentlik va
// referral/TOP/VIP/escrow ishlov berish logikasi ham shu bilan birga
// ko'chirildi.

export async function createPaymentOrder(userId: number, startupId: string, referralCode?: string, source: string = "web") {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user && !user.emailVerified && source === "web") {
    throw new Error("Xaridni amalga oshirish uchun iltimos avval email manzilingizni tasdiqlang.");
  }

  const startupRecord = await prisma.startup.findUnique({ where: { id: startupId } });
  if (!startupRecord || !startupRecord.price) {
    throw new Error("Loyiha topilmadi yoki narx belgilanmagan.");
  }
  if (startupRecord.soldStatus === "sotildi") {
    throw new Error("Bu loyiha allaqachon sotilgan.");
  }
  // 91-band: o'z loyihasini sotib olishni oldini olish (soxta "sotilgan" holat/pul aylanishi)
  if (startupRecord.userId === userId) {
    throw new Error("O'z loyihangizni sotib ololmaysiz.");
  }

  let basePrice = Number(startupRecord.price);
  let realAmount = basePrice;
  let discountApplied = 0;
  let referralId = null;

  // 1) B2B hisobni tekshirish (verified === true bo'lsa)
  const b2bAccount = await prisma.b2BAccount.findUnique({ where: { userId } });
  let b2bDiscountPercent = 0;
  if (b2bAccount && b2bAccount.verified) {
    b2bDiscountPercent = Number(b2bAccount.discount) || 0;
  }

  // 2) Referral kodni tekshirish
  let referralDiscountPercent = 0;
  let referralObj: any = null;

  if (referralCode) {
    const referral = await prisma.referral.findUnique({
      where: { code: referralCode.trim().toUpperCase(), isActive: true }
    });
    
    if (!referral) {
      throw new Error("Referral code topilmadi yoki faol emas.");
    }
    
    // Prevent self-referral
    if (referral.referrerId === userId) {
      throw new Error("O'zingizning referral kodingizdan foydalana olmaysiz.");
    }
    
    // Prevent repeat use
    const alreadyUsed = await prisma.referral.findFirst({
      where: { 
        code: referralCode.trim().toUpperCase(),
        refereeId: userId 
      }
    });
    
    if (alreadyUsed) {
      throw new Error("Siz bu referral koddan allaqachon foydalangansiz.");
    }
    
    // Check referrer is not banned
    const referrer = await prisma.user.findUnique({
      where: { id: referral.referrerId }
    });
    
    if (!referrer || referrer.isBanned) {
      throw new Error("Ushbu referral kodning egasi faol emas.");
    }

    referralDiscountPercent = Number(referral.discountPercent) || 0;
    referralObj = referral;
  }

  // 3) Kattaroq chegirmani tanlash (B2B vs Referral)
  let chosenDiscountPercent = 0;
  let discountType: "b2b" | "referral" | null = null;

  if (referralDiscountPercent > b2bDiscountPercent && referralDiscountPercent > 0) {
    chosenDiscountPercent = referralDiscountPercent;
    discountType = "referral";
    referralId = referralObj ? referralObj.id : null;
  } else if (b2bDiscountPercent > 0) {
    chosenDiscountPercent = b2bDiscountPercent;
    discountType = "b2b";
    referralId = null;
  }

  if (chosenDiscountPercent > 0) {
    discountApplied = (basePrice * chosenDiscountPercent) / 100;
    realAmount = basePrice - discountApplied;
  }

  let paymentSource = source;
  if (discountType === "b2b") {
    paymentSource = "b2b_discount";
  } else if (discountType === "referral") {
    paymentSource = "referral_discount";
  }

  const orderId = "CG-" + crypto.randomBytes(4).toString('hex').toUpperCase();
  const secureToken = crypto.randomBytes(24).toString('hex');

  // MUHIM: har safar checkout sahifasi qayta ochilsa yoki referral kod
  // qo'llanganda payment qayta yaratilsa, oldingi "pending" buyurtma
  // hech qachon yopilmasdi — bazada abadiy "pending" holatda qolib
  // ketardi (agar kimdir eski CoinGate havolasini keyinroq to'lasa,
  // finalizeCompletedPayment uni "refund_required"ga o'tkazadi, ammo
  // bu qo'lda qaytarish talab qiladi). Endi shu userId+startupId uchun
  // eski "pending" buyurtmalar yangisi yaratilishidan oldin "cancelled"
  // qilinadi.
  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { userId, startupId, status: "pending" },
      data: { status: "cancelled" }
    }),
    prisma.payment.create({
      data: {
        id: orderId,
        amount: realAmount,
        status: "pending",
        currency: "USDT",
        userId: userId,
        startupId: startupId,
        callbackToken: secureToken,
        gateway: "coingate",
        source: paymentSource,
        referralId: referralId
      },
    })
  ]);

  let paymentUrl = "";
  let useStripe = false;
  let usedGateway = "coingate";

  const coingateToken = await getSetting("COINGATE_API_TOKEN");
  const appUrlSetting = await getSetting("APP_URL") || "http://localhost:3000";

  if (coingateToken) {
    try {
      const response = await fetch("https://api.coingate.com/v2/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Token ${coingateToken}`,
        },
        body: new URLSearchParams({
          order_id: orderId,
          price_amount: realAmount.toFixed(2),
          price_currency: "USD",
          receive_currency: "USDT",
          callback_url: `${appUrlSetting}/api/payments/webhook?token=${secureToken}`,
          success_url: `${appUrlSetting}/checkout/success`,
          cancel_url: `${appUrlSetting}/checkout/cancel`,
          title: startupRecord.name,
        }),
      });

      if (response.ok) {
        const orderData: any = await response.json();
        paymentUrl = orderData.payment_url;
      } else {
        useStripe = true;
      }
    } catch (coinGateErr: unknown) {
      useStripe = true;
    }
  } else {
    useStripe = true;
  }

  if (useStripe) {
    const stripe = await getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: startupRecord.name },
              unit_amount: Math.round(realAmount * 100),
            },
            quantity: 1,
          }],
          mode: "payment",
          success_url: `${appUrlSetting}/checkout/success?paymentId=${orderId}`,
          cancel_url: `${appUrlSetting}/checkout/cancel`,
          metadata: { orderId, secureToken }
        });
        
        paymentUrl = session.url!;
        await prisma.payment.update({
          where: { id: orderId },
          // NOTE: previously this also set `id: session.id`, which overwrote the
          // payment's primary key. That broke /api/payments/status/:id polling on
          // the frontend (CheckoutPage.tsx polls using the original orderId, so the
          // lookup returned 404 the moment this ran). Keep orderId as the stable id;
          // metadata.orderId already carries it through to Stripe for correlation.
          data: { gateway: "stripe" }
        });
        usedGateway = "stripe";
      } catch (stripeErr) {
        logger.error({ err: stripeErr }, "Stripe fallback error");
      }
    }
  }

  let apiKeysMissing = false;
  if (!paymentUrl) {
    const stripeKey = await getSetting("STRIPE_SECRET_KEY") || process.env.STRIPE_SECRET_KEY;
    if (!coingateToken && !stripeKey && process.env.NODE_ENV === "production") {
      throw new Error("To'lov tizimi vaqtincha mavjud emas, keyinroq urinib ko'ring.");
    }
    apiKeysMissing = true;
    paymentUrl = `${appUrlSetting}/api/payments/coingate-simulator?orderId=${orderId}&token=${secureToken}&amount=${realAmount.toFixed(2)}&title=${encodeURIComponent(startupRecord.name)}`;
  }

  return {
    orderId,
    paymentUrl,
    amount: realAmount,
    apiKeysMissing,
    gateway: usedGateway,
    discountPercent: chosenDiscountPercent,
    discountType
  };
}

export async function finalizeCompletedPayment(payment: any): Promise<string> {
    let updatedStatus = "completed";
    const isDirectPurchase = payment.startupId && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-");

    // TUZATISH (poyga holati / ikki marta sotish): faqat haqiqiy xarid
    // to'lovlari uchun (TOP-/UPG- boost to'lovlari emas — ular sotilgan
    // loyihada ham amalga oshirilishi mumkin va soldStatus'ga bog'liq
    // emas), soldStatus'ni ATOMIK ravishda "band qilamiz": avval o'qib,
    // keyin alohida yozish o'rniga (bu ikkita bir vaqtdagi to'lov uchun
    // ikkalasi ham "hali sotilmagan"ni ko'rib, ikkalasi ham "completed"
    // bo'lib ketishiga olib kelardi — ya'ni bitta loyiha ikki marta
    // sotilardi). updateMany + soldStatus shart bilan faqat BITTA
    // to'lov "g'olib" bo'lishini kafolatlaydi.
    if (isDirectPurchase) {
      const claimed = await prisma.startup.updateMany({
        where: { id: payment.startupId, soldStatus: { not: "sotildi" } },
        data: { soldStatus: "sotildi", proposalsCount: { increment: 1 } }
      });
      if (claimed.count === 0) {
        updatedStatus = "refund_required";
        logger.info({ startupId: payment.startupId, paymentId: payment.id }, "Startup already sold, setting payment to refund_required");
      }
    }

    const numAmount = Number(payment.amount);
    let platformFeeAmount = null;
    let sellerPayoutAmount = null;
    if (updatedStatus === "completed") {
      const { fee, payout } = splitAmount(numAmount, PLATFORM_FEE_PERCENT);
      platformFeeAmount = fee;
      sellerPayoutAmount = payout;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { 
        status: updatedStatus,
        platformFeeAmount,
        sellerPayoutAmount
      },
    });

    if (updatedStatus === "completed" && payment.referralId) {
      const referral = await prisma.referral.findUnique({
        where: { id: payment.referralId }
      });
      if (referral) {
        // Eslatma: refereeId shu yerda faqat "oxirgi referal qilingan
        // foydalanuvchi" sifatida ma'lumot uchun yoziladi — bitta doimiy
        // referral qatori ko'p marta ishlatilishi mumkinligi sabab, haqiqiy
        // referal soni endi getReferralCount() (ReferralReward asosida)
        // orqali hisoblanadi, bu maydon orqali emas.
        await prisma.referral.update({
          where: { id: referral.id },
          data: { refereeId: payment.userId || 0 }
        });
        
        const rewardAmount = roundToCents((numAmount * Number(referral.commissionPercent)) / 100);
        await prisma.referralReward.create({
          data: {
            referralId: referral.id,
            paymentId: payment.id,
            rewardAmount,
            status: "earned"
          }
        });
        
        await createNotification(
          referral.referrerId,
          "SYSTEM",
          "Referral mukofoti!",
          `Tabriklaymiz! Sizning referralingiz orqali xarid amalga oshirildi. Sizga $${rewardAmount.toFixed(2)} miqdorida mukofot hisoblandi.`,
          `/profile`
        );

        // 96-band: referralCount endi to'g'ri hisoblanadi (yuqoriga qarang),
        // lekin referral qatoridagi discountPercent/commissionPercent hali ham
        // faqat kod BIRINCHI marta yaratilganda (referralCount=0, Tier 1)
        // o'rnatilib, keyin hech qachon yangilanmasdi — ya'ni 6/21+ referaldan
        // keyin ham foydalanuvchi abadiy Tier 1 (5%) da qolib ketardi. Endi har
        // bir muvaffaqiyatli referaldan so'ng daraja qayta hisoblanadi va
        // o'zgargan bo'lsa (keyingi referallar uchun) yangilanadi.
        const newReferralCount = await getReferralCount(referral.referrerId);
        const newTier = getReferralTier(newReferralCount);
        if (newTier.discount !== Number(referral.discountPercent) || newTier.commission !== Number(referral.commissionPercent)) {
          await prisma.referral.update({
            where: { id: referral.id },
            data: { discountPercent: newTier.discount, commissionPercent: newTier.commission }
          }).catch((tierErr: any) => logger.error({ err: tierErr }, "Referral tier update error"));
        }
      }
    }

    if (updatedStatus === "completed" && payment.startupId && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-")) {
      // Create Escrow Payment
      await prisma.escrowPayment.upsert({
        where: { paymentId: payment.id },
        update: {},
        create: {
          paymentId: payment.id,
          status: "held",
          holdEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    }

    // FIX: TOP-/UPG- to'lovlarida ham startupId bor (boost/upgrade o'zi shu startap uchun),
    // lekin bu "startapni sotib oldim" emas — email faqat haqiqiy xariddan keyin yuborilishi kerak.
    if (updatedStatus === "completed" && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-")) {
      const buyer = await prisma.user.findUnique({ where: { id: payment.userId } });
      const startup = await prisma.startup.findUnique({ where: { id: payment.startupId }, include: { user: true } });
      
      if (buyer && startup) {
        // To Buyer
        await sendEmail(
          buyer.email,
          "Xarid muvaffaqiyatli yakunlandi",
          `<p>Tabriklaymiz! Siz <b>${escapeHtml(startup.name)}</b> loyihasini muvaffaqiyatli sotib oldingiz.</p><p>Loyiha fayllari va tafsilotlari tez orada sizga yetkaziladi.</p>`,
          true
        );
        await createNotification(
          buyer.id,
          "PURCHASE",
          "Xarid muvaffaqiyatli yakunlandi",
          `"${startup.name}" loyihasini muvaffaqiyatli sotib oldingiz.`,
          `/profile?tab=purchases`
        );
        notifyUserTelegram(
          buyer.id,
          `✅ Xaridingiz muvaffaqiyatli yakunlandi! "<b>${escapeHtml(startup.name)}</b>" endi sizniki.`,
          `/profile?tab=purchases`
        );
        // To Seller
        if (startup.user) {
          await sendEmail(
            startup.user.email,
            "Loyihangiz sotildi!",
            `<p>Tabriklaymiz! Sizning <b>${escapeHtml(startup.name)}</b> loyihangiz sotib olindi.</p><p>To'lov qabul qilindi. Tafsilotlar uchun dashboardni ko'ring.</p>`,
            true
          );
          await createNotification(
            startup.user.id,
            "PURCHASE",
            "Loyihangiz sotildi!",
            `"${startup.name}" loyihangiz sotib olindi.`,
            `/profile?tab=earnings`
          );
          notifyUserTelegram(
            startup.user.id,
            `🎉 Tabriklaymiz! "<b>${escapeHtml(startup.name)}</b>" loyihangiz sotib olindi.`,
            `/profile?tab=earnings`
          );
        }
      }
    }

    // Yuqoridagi bo'lim endi manbasidan qat'i nazar (sayt yoki Telegram)
    // xaridorga ham botdan xabar yuboradi, shuning uchun faqat Telegram
    // manbasi uchun alohida takroriy xabar shart emas edi — olib
    // tashlandi (soldStatus/telegramDelivery mantiqi yuqorida o'zgarishsiz qoldi).

    if (updatedStatus === "completed" && payment.startupId && !payment.id.startsWith("TOP-") && !payment.id.startsWith("UPG-")) {
      await prisma.telegramDelivery.create({
        data: {
          token: crypto.randomBytes(24).toString('hex'),
          paymentId: payment.id,
          startupId: payment.startupId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    }

    // soldStatus endi yuqorida (funksiya boshida) atomik ravishda
    // o'rnatiladi. Xaridor/sotuvchi bildirishnomasi (email + ilova ichi +
    // Telegram) yuqorida — manbasidan (sayt/bot) qat'i nazar — allaqachon
    // yuborildi.
    // Listing Tier Upgrade logic
    if (updatedStatus === "completed" && payment.id.startsWith("UPG-")) {
      const subscription = await prisma.listingSubscription.findFirst({
        where: { paymentId: payment.id },
        include: { tier: true }
      });
      if (subscription && payment.startupId) {
        // MUHIM: eski expiresAt to'lov "pending" holatda yaratilgan paytda
        // hisoblangan edi — to'lov (ayniqsa CoinGate) tasdiqlanishi soatlab
        // cho'zilsa, sotib olingan muddat jimgina qisqarib qolardi. Endi
        // muddat aynan to'lov tasdiqlangan shu paytdan hisoblanadi.
        const realExpiresAt = new Date(Date.now() + subscription.tier.durationDays * 24 * 60 * 60 * 1000);
        await prisma.listingSubscription.update({
          where: { id: subscription.id },
          data: { expiresAt: realExpiresAt }
        });
        await prisma.startup.update({
          where: { id: payment.startupId },
          data: { 
            currentTier: subscription.tier.tier,
            isTop: subscription.tier.tier !== "standard",
            topExpiresAt: realExpiresAt
          }
        });
        logger.info({ startupId: payment.startupId, tier: subscription.tier.tier }, "Upgraded startup tier");
        
        await createNotification(
          payment.userId || 0,
          "SYSTEM",
          "Loyiha upgrade qilindi!",
          `Sizning loyihangiz muvaffaqiyatli ${subscription.tier.displayName} darajasiga ko'tarildi.`,
          `/startup/${payment.startupId}`
        );
      }
    }

    // TOP and VIP activations
    if (updatedStatus === "completed") {
      if (payment.id.startsWith("TOP-") && payment.startupId && payment.userId) {
        const days = parseInt(payment.id.split("-")[1]);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        await prisma.startup.update({
          where: { id: payment.startupId },
          data: {
            isTop: true,
            topExpiresAt: expiresAt
          }
        });
        
        await prisma.topBoost.create({
          data: {
            startupId: payment.startupId,
            userId: payment.userId,
            days,
            pricePaid: payment.amount,
            expiresAt
          }
        });
      } else if (payment.id.startsWith("VIP-") && payment.userId) {
        const days = parseInt(payment.id.split("-")[1]);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        
        await prisma.user.update({
          where: { id: payment.userId },
          data: {
            isVip: true,
            vipExpiresAt: expiresAt
          }
        });
        
        await prisma.vipSubscription.create({
          data: {
            userId: payment.userId,
            days,
            pricePaid: payment.amount,
            expiresAt
          }
        });
      }
    }

  return updatedStatus;
}
