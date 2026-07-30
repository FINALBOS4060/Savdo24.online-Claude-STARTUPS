import crypto from 'crypto';

// 122-bosqich: bu uch funksiya server.ts'dan shu yerga ko'chirildi (mantiq
// AYNAN bir xil, faqat joyi o'zgardi). Sabab: ularning hech biri prisma/DB'ga
// bog'liq emas (sof funksiyalar), shu sabab avtomatik test yozish uchun
// server.ts'ni (Express app, socket.io, Prisma ulanishi va h.k. bilan)
// to'liq import qilishga hojat qoldirmaydi. server.ts hali ham shu yerdan
// import qilib qayta eksport qiladi — boshqa fayllardagi
// `import { escapeHtml } from "../../server"` kabi qatorlar o'zgarmaydi.

// XSS/HTML-injection oldini olish uchun: foydalanuvchi matnini email va Telegram
// HTML xabarlariga qo'shishdan oldin har doim shu funksiya orqali o'tkazish kerak.
export function escapeHtml(input: unknown): string {
  const str = input === null || input === undefined ? "" : String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getReferralTier(referralCount: number) {
  if (referralCount >= 21) {
    return { discount: 15, commission: 15, badge: "👑 Referral King", monthlyBonus: 50 };
  } else if (referralCount >= 6) {
    return { discount: 10, commission: 10, badge: "🌟 Referral Star", monthlyBonus: 0 };
  } else {
    return { discount: 5, commission: 5, badge: null, monthlyBonus: 0 };
  }
}

export function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
