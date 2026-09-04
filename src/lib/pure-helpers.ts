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

// YANGI (progress-bar / "yana N kishi qoldi", foydalanuvchi talabi —
// "Obunachi yig'ish"da faollikni rag'batlantirish): bu SOF kosmetik
// bosqichlar tizimi — hech qanday chegirma/komissiyaga ta'sir qilmaydi
// (bu getReferralTier'dan MUSTAQIL, saytdagi marketing referal
// dasturi bilan aralashtirmaslik kerak). Faqat foydalanuvchiga o'zi
// yig'gan JAMI obunachi soni (totalEarnedSubscribers) qanchalik
// "keyingi bosqich"ka yaqinligini ko'rsatish, aniq va ko'zga ko'rinuvchi
// maqsad qo'yib berish uchun.
export const EXCHANGE_MILESTONES = [
  { threshold: 10, badge: "🥉" },
  { threshold: 25, badge: "🥈" },
  { threshold: 50, badge: "🥇" },
  { threshold: 100, badge: "💎" },
  { threshold: 250, badge: "🏆" },
  { threshold: 500, badge: "👑" }
] as const;

export interface ExchangeMilestoneProgress {
  reached: boolean; // true = eng yuqori bosqichga yetgan (keyingi maqsad yo'q)
  badge: string;
  remaining: number; // keyingi bosqichgacha yana nechta obunachi kerak (reached=true bo'lsa 0)
  progressPercent: number; // 0-100, joriy bosqich ichidagi progress
  nextThreshold: number | null;
}

export function getExchangeMilestoneProgress(totalEarnedSubscribers: number): ExchangeMilestoneProgress {
  const count = Math.max(0, totalEarnedSubscribers);
  const nextIndex = EXCHANGE_MILESTONES.findIndex((m) => count < m.threshold);

  if (nextIndex === -1) {
    const last = EXCHANGE_MILESTONES[EXCHANGE_MILESTONES.length - 1];
    return { reached: true, badge: last.badge, remaining: 0, progressPercent: 100, nextThreshold: null };
  }

  const next = EXCHANGE_MILESTONES[nextIndex];
  const prevThreshold = nextIndex === 0 ? 0 : EXCHANGE_MILESTONES[nextIndex - 1].threshold;
  const remaining = next.threshold - count;
  const progressPercent = Math.round(((count - prevThreshold) / (next.threshold - prevThreshold)) * 100);

  return { reached: false, badge: next.badge, remaining, progressPercent, nextThreshold: next.threshold };
}

// 10 segmentli oddiy matnli progress-bar (Telegram xabarlarida chiroyli
// ko'rinadi, hech qanday rasm/HTML kerak emas).
export function renderProgressBar(percent: number, length: number = 10): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * length);
  return "▓".repeat(filled) + "░".repeat(length - filled);
}

// catch (err: unknown) bloklarida xato xabari/kodini xavfsiz olish uchun.
// Ilgari kodning ko'p joyida `catch (err: any)` yozilib, `err.message`ga
// to'g'ridan-to'g'ri murojaat qilinardi — bu TypeScript'ning tip
// tekshiruvini butunlay chetlab o'tardi. Endi `unknown` + shu ikki funksiya
// ishlatiladi.
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Noma'lum xatolik";
}

export function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
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

export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  joinDate: true,
  avatarUrl: true,
  coverUrl: true,
  averageRating: true,
  totalReviews: true,
  isVip: true,
  emailVerified: true,
  verified: true
} as const;

// TUZATISH (/telegram-stats "Bugun" va 7 kunlik grafik): ilgari kun
// chegaralari `new Date(now.getFullYear(), now.getMonth(), now.getDate())`
// orqali hisoblanardi — bu SERVER PROTSESSINING mahalliy vaqt zonasiga
// (process.env.TZ yoki host OS sozlamasiga, odatda UTC bo'ladi, lekin
// kafolat yo'q) bog'liq. Keyin esa kun kalitlari `toISOString().slice(0,10)`
// orqali, ya'ni doim UTC bo'yicha formatlanardi. Ikkala qadam turli vaqt
// zonasiga tayanishi mumkin edi — natijada masalan server TZ=Asia/Tashkent
// (UTC+5) bilan ishlasa-yu, kalit UTC bo'yicha yozilsa, kunning oxirgi
// 5 soatidagi hodisalar noto'g'ri kunga (ertangi UTC saniyasiga) tushib
// qolardi va aksincha.
//
// Yechim: server qaysi TZ'da ishlashidan QAT'IY NAZAR, har doim BITTA
// aniq belgilangan vaqt zonasi (Savdo24 — O'zbekiston uchun, Asia/Tashkent,
// doimiy UTC+5, yozgi vaqtga o'tish yo'q) bo'yicha hisoblanadi — buning
// uchun `Intl.DateTimeFormat`dan foydalaniladi, u process.env.TZ'ga
// bog'liq emas.
export const APP_TIMEZONE = "Asia/Tashkent";

// Berilgan lahzani (Date) belgilangan vaqt zonasidagi "YYYY-MM-DD" kalendar
// kuniga aylantiradi.
export function formatDateInTimezone(date: Date, timeZone: string = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

// Berilgan vaqt lahzasida, belgilangan TZ UTC'dan necha daqiqa
// "ilgarilab" turganini qaytaradi (Asia/Tashkent uchun doim +300).
function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Berilgan lahza belgilangan vaqt zonasida qaysi kalendar kuniga to'g'ri
// kelishini aniqlab, O'SHA kunning 00:00:00'iga (shu TZ bo'yicha) mos
// keluvchi HAQIQIY vaqt lahzasini (server TZ'idan mustaqil, to'g'ri UTC
// instant sifatida) qaytaradi — bu DB'dagi createdAt (har doim UTC
// saqlanadi) bilan to'g'ri solishtirish (`gte: ...`) uchun zarur.
export function getStartOfDayInTimezone(date: Date, timeZone: string = APP_TIMEZONE): Date {
  const dateKey = formatDateInTimezone(date, timeZone);
  const utcGuess = new Date(`${dateKey}T00:00:00.000Z`);
  const offsetMinutes = getTimezoneOffsetMinutes(timeZone, utcGuess);
  return new Date(utcGuess.getTime() - offsetMinutes * 60 * 1000);
}


