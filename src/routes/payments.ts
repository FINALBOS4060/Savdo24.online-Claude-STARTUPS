import { Router, Request, Response } from "express";
import QRCode from "qrcode";
import { logger } from "../lib/logger";
// 128-bosqich: qolgan to'lov route'lari server.ts'dan bu yerga ko'chirildi
// (POST /api/payments/create, POST /api/telegram/create-payment, GET
// /api/payments/my, GET /api/payments/coingate-simulator, POST
// /api/payments/webhook, GET /api/payments/status/:id). Og'ir biznes-mantiq
// (createPaymentOrder/finalizeCompletedPayment) src/lib/payments.ts'ga
// ko'chirildi. DIQQAT: /api/payments/stripe-webhook BU YERDA EMAS — u xom
// (raw) so'rov tanasi kerak bo'lgani uchun global express.json()'dan OLDIN,
// server.ts'ning o'zida qoladi (lekin finalizeCompletedPayment'ni endi
// shu yerdagi bilan bir xil src/lib/payments.ts'dan import qiladi).
import {
  prisma,
  getSetting,
  authenticateToken,
  AuthRequest,
  TELEGRAM_BOT_INTERNAL_SECRET
} from "../lib/context";
import { paymentStatusLimiter, financialActionLimiter } from "../lib/rateLimiters";
import { safeCompare, escapeHtml, getErrorMessage } from "../lib/pure-helpers";
import { createPaymentOrder, finalizeCompletedPayment } from "../lib/payments";

const router = Router();

// financialActionLimiter: to'lov buyurtmasi yaratish tashqi Coingate API'ga so'rov
// yuboradi va DB'da yozuv yaratadi — escrow/release va escrow/dispute kabi
// moliyaviy amallardagi bilan bir xil limiter qo'yildi (ilgari bu yerda hech
// qanday limiter yo'q edi, faqat umumiy /api global limiter (300/15min) qo'llanardi).
router.post("/payments/create", authenticateToken, financialActionLimiter, async (req: AuthRequest, res: Response) => {
  const { startupId, referralCode } = req.body;

  if (!startupId) {
    return res.status(400).json({ error: "Loyiha ID si ko'rsatilishi shart." });
  }

  try {
    const { orderId, paymentUrl, amount, apiKeysMissing, gateway, discountPercent, discountType } = await createPaymentOrder(req.user!.id, startupId, referralCode, "web");

    res.status(201).json({
      id: orderId,
      amount: amount,
      status: "pending",
      currency: "USDT",
      paymentUrl,
      api_keys_missing: apiKeysMissing,
      gateway,
      discountPercent: discountPercent || 0,
      discountType: discountType || null
    });
  } catch (err: unknown) {
    logger.error({ err }, "POST /api/payments/create error");
    const errMsg = getErrorMessage(err);
    res.status(errMsg.includes("tasdiqlang") ? 403 : 400).json({ error: errMsg || "To'lov buyurtmasini yaratib bo'lmadi." });
  }
});

// Telegram-specific payment endpoint
router.post("/telegram/create-payment", async (req: Request, res: Response) => {
  // Ichki maxfiy kalitni tekshir (faqat bot chaqira olishi uchun)
  const secret = req.headers["x-telegram-bot-secret"];
  const internalSecret = TELEGRAM_BOT_INTERNAL_SECRET;
  
  if (!internalSecret || !secret || typeof secret !== "string" || !safeCompare(secret, internalSecret)) {
    return res.status(403).json({ error: "Ruxsat berilmagan." });
  }

  const { telegramUserId, startupId } = req.body;
  if (!telegramUserId || !startupId) {
    return res.status(400).json({ error: "Majburiy maydonlar to'ldirilmagan." });
  }

  try {
    // telegramUserId orqali bog'langan foydalanuvchini top
    const user = await prisma.user.findFirst({ where: { telegramUserId: telegramUserId.toString() } });
    if (!user) {
      return res.status(404).json({
        error: "Hisobingiz Telegram bilan bog'lanmagan. Avval /bogla {kod} buyrug'ini ishlating."
      });
    }

    const { orderId, paymentUrl } = await createPaymentOrder(user.id, startupId, undefined, "telegram");

    // QR-kod yaratish
    const qrCodeDataUrl = await QRCode.toDataURL(paymentUrl, { width: 400, margin: 2 });

    res.json({ paymentUrl, orderId, qrCode: qrCodeDataUrl });
  } catch (err: unknown) {
    logger.error({ err }, "POST /api/telegram/create-payment error");
    res.status(400).json({ error: getErrorMessage(err) || "To'lov yaratishda xatolik." });
  }
});

router.get("/payments/my", authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payments = await prisma.payment.findMany({
      where: {
        userId: req.user.id,
        status: "completed",
      },
      include: {
        startup: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return res.json({ payments });
  } catch (err) {
    logger.error({ err: err }, "GET /api/payments/my error");
    return res.status(500).json({ error: "Xatolik yuz berdi" });
  }
});

router.get("/payments/coingate-simulator", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Forbidden: Mock gateway is only available in development mode." });
  }

  const { orderId, token, amount, title } = req.query;

  if (!orderId || !token) {
    return res.status(400).send("Buyurtma ID si yoki token yo'q.");
  }

  const safeOrderId = JSON.stringify(String(orderId));
  const safeToken = JSON.stringify(String(token));
  const safeAmount = JSON.stringify(String(amount || ""));

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Savdo24 CoinGate Simulator</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', sans-serif;
            background: #0d131a;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: #18202c;
            border-radius: 20px;
            padding: 36px;
            text-align: center;
            max-width: 440px;
            width: 100%;
            border: 1px solid #2d3848;
            box-shadow: 0 15px 40px rgba(0,0,0,0.6);
          }
          h2 { color: #10b981; margin-top: 0; font-size: 24px; font-weight: 800; }
          .logo { color: #10b981; font-size: 32px; font-weight: 900; margin-bottom: 20px; letter-spacing: -1px; }
          .order-id { font-size: 13px; color: #a0aec0; margin-bottom: 12px; font-family: monospace; }
          .amount { font-size: 36px; font-weight: 900; color: #ffffff; margin: 20px 0; }
          .currency { font-size: 18px; color: #10b981; }
          .info-text { font-size: 13px; color: #718096; line-height: 1.6; margin-bottom: 30px; }
          button {
            background: #10b981;
            color: #ffffff;
            border: none;
            padding: 14px 28px;
            font-weight: 700;
            font-size: 16px;
            border-radius: 12px;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(16,185,129,0.2);
          }
          button:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(16,185,129,0.3);
          }
          button:active {
            transform: translateY(0);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">CoinGate</div>
          <h2>To'lov Shlyuzi (Simulyator)</h2>
          <p class="order-id">Buyurtma ID: <strong>${escapeHtml(String(orderId))}</strong></p>
          <p style="color: #cbd5e0; font-size: 15px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(String(title || "Loyiha xaridi"))}</p>
          <div class="amount">${escapeHtml(String(amount || ""))} <span class="currency">USDT</span></div>
          <p class="info-text">Bu CoinGate to'lov tizimining integratsiyasini va webhook qayta qo'ng'iroqlarini tekshirish uchun maxsus simulyatordir.</p>
          <button onclick="pay()">To'lovni tasdiqlash</button>
        </div>
        <script>
          async function pay() {
            try {
              const params = new URLSearchParams();
              params.append('order_id', ${safeOrderId});
              params.append('status', 'paid');
              params.append('price_amount', ${safeAmount});
              params.append('price_currency', 'USD');
              params.append('id', 'CG-' + Math.floor(Math.random() * 1000000));

              const res = await fetch('/api/payments/webhook?token=' + encodeURIComponent(${safeToken}), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
              });

              if (res.ok) {
                alert("To'lov muvaffaqiyatli amalga oshirildi! CoinGate Webhook yuborildi.");
                window.close();
                document.body.innerHTML = \`
                  <div class="card">
                    <div class="logo">CoinGate</div>
                    <h2 style="color: #10b981;">✓ To'lov tasdiqlandi!</h2>
                    <p style="color: #cbd5e0;">Muvaffaqiyatli yakunlandi. Endi ushbu oynani yopishingiz mumkin.</p>
                  </div>
                \`;
              } else {
                const text = await res.text();
                alert("To'lov webhook xatosi: " + text);
              }
            } catch(err) {
              alert("Xatolik: " + err.message);
            }
          }
        </script>
      </body>
    </html>
  `);
});

// POST /api/payments/webhook — CoinGate webhook callback qabul qilish

router.post("/payments/webhook", async (req: Request, res: Response) => {
  const token = req.query.token as string;
  const { order_id, status, price_amount, price_currency, id } = req.body;

  if (!order_id || !status) {
    return res.status(400).json({ error: "Missing required webhook parameters." });
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { id: order_id } });
    if (!payment) {
      return res.status(404).json({ error: "Payment order not found." });
    }

    // Kelgan token query parametrini bazadagi saqlangan callbackToken bilan constant-time solishtir
    const savedToken = payment.callbackToken;
    if (!token || !savedToken || !safeCompare(token, savedToken)) {
      logger.warn({ order_id }, "Secure token verification failed for order_id");
      return res.status(401).json({ error: "Unauthorized: Token mismatch or missing." });
    }

    // IDEMPOTENTLIK: to'lov tizimlari (CoinGate/Stripe) bir xil webhook'ni bir necha marta
    // qayta yuborishi mumkin (retry). Agar bu buyurtma allaqachon yakuniy holatga o'tgan
    // bo'lsa, butun jarayonni qayta ishlamasdan darhol muvaffaqiyatli javob qaytaramiz —
    // aks holda referral mukofoti, email/bildirishnomalar va TOP/VIP muddati har safar
    // qayta hisoblanib, foydalanuvchiga bir necha marta pul/bonus berilib ketishi mumkin edi.
    if (payment.status === "completed" || payment.status === "refund_required") {
      return res.json({ success: true, orderId: order_id, status: payment.status, idempotent: true });
    }

    // Token mos kelsa ham, CoinGate'ning GET Order endpointiga qo'shimcha so'rov yuborib qayta tekshir
    let verifiedStatus = status;
    let verifiedAmount = price_amount;

    const coingateToken = await getSetting("COINGATE_API_TOKEN");

    if (coingateToken && id) {
      try {
        const checkResponse = await fetch(`https://api.coingate.com/v2/orders/${id}`, {
          method: "GET",
          headers: {
            "Authorization": `Token ${coingateToken}`
          }
        });
        if (checkResponse.ok) {
          const checkData: any = await checkResponse.json();
          verifiedStatus = checkData.status;
          verifiedAmount = checkData.price_amount;
          logger.info({ checkData }, "Verified Order via CoinGate API GET check");
        } else {
          logger.error({ status: checkResponse.status }, "CoinGate GET Order check failed");
          return res.status(400).json({ error: "CoinGate API verification failed." });
        }
      } catch (apiErr: unknown) {
        logger.error({ errMsg: getErrorMessage(apiErr) }, "Failed to connect to CoinGate GET Order API");
        return res.status(500).json({ error: "CoinGate API connection failed." });
      }
    }

    if (!coingateToken || !id) {
      logger.warn({ order_id }, "Webhook COINGATE_API_TOKEN yoki id yo'qligi sababli mustaqil tasdiqlanmadi — faqat callback token bilan cheklanmoqda.");
    }

    // CoinGate statuses: paid or completed mean successful payment
    const isCompleted = verifiedStatus === "paid" || verifiedStatus === "completed";

    if (!isCompleted) {
      const localStatus = (verifiedStatus === "expired" || verifiedStatus === "canceled" || verifiedStatus === "invalid") ? "failed" : "pending";
      await prisma.payment.update({
        where: { id: order_id },
        data: { status: localStatus }
      });
      return res.json({ success: true, orderId: order_id, status: localStatus });
    }

    // Qayta tekshirilgan summa to'g'ri kelishini solishtir
    if (Math.abs(parseFloat(verifiedAmount) - payment.amount) > 0.01) {
      logger.warn(`Payment amount mismatch. Expected: ${payment.amount}, Got: ${verifiedAmount}`);
      return res.status(400).json({ error: "Payment amount mismatch." });
    }

    const updatedStatus = await finalizeCompletedPayment(payment);

    res.json({ success: true, orderId: order_id, status: updatedStatus });
  } catch (err: unknown) {
    logger.error({ err: err }, "Webhook processing error");
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

router.get("/payments/status/:id", authenticateToken, paymentStatusLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { startup: true }
    });
    if (!payment) {
      return res.status(404).json({ error: "To'lov topilmadi." });
    }

    // Ownership check
    if (payment.userId !== req.user?.id && req.user?.role !== "Admin") {
      return res.status(403).json({ error: "Ruxsat etilmagan. Faqat o'z to'lovlaringizni ko'rishingiz mumkin." });
    }
    
    if (payment.status === "completed" && payment.startup) {
      const delivery = await prisma.telegramDelivery.findFirst({ where: { paymentId: id } });
      return res.json({
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        deliveryUrl: payment.startup.deliveryUrl || "",
        sellerContact: payment.startup.contactTelegram || payment.startup.contactEmail || payment.startup.contactPhone || "Sotuvchi aloqa ma'lumoti kiritilmagan",
        repoUrl: payment.startup.deliveryUrl || "",
        telegramToken: delivery?.token
      });
    }
    
    res.json({ id: payment.id, status: payment.status, amount: payment.amount });
  } catch (err: unknown) {
    logger.error({ err: err }, "Get payment status error");
    res.status(500).json({ error: "To'lov holatini olishda xatolik yuz berdi." });
  }
});

export default router;
