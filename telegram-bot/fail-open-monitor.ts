// FAIL-OPEN MONITORING: rate-limit.ts va sponsor-gate.ts kabi joylar
// tashqi bog'liqlik (baza, asosiy server API) vaqtincha ishlamay
// qolganda ataylab "cheklamaymiz / bloklamaymiz" (fail-open) siyosatini
// tanlaydi — bu botni butunlay to'xtatib qo'yishdan ancha yaxshiroq.
//
// LEKIN muammo bor edi: bu holat faqat `logger.warn`/`logger.error`
// bilan, HAR SAFAR bir xil darajada yozilardi va hech qanday
// eskalatsiya yo'q edi — bitta lahzalik tarmoq xatosi bilan, baza
// SOATLAB butunlay ishlamay qolishi (masalan noto'g'ri migratsiya,
// ulanish sozlamasi xato) log darajasida farqlanmasdi. Amalda bu
// degani: spam-himoya yoki majburiy-obuna tekshiruvi uzoq vaqt
// butunlay o'chib tursa ham, buni faqat log fayllarni qo'lda titkilab
// ko'rgandagina bilib olish mumkin edi — hech qanday avtomatik signal
// yo'q edi.
//
// Bu yerdagi kichik hisoblagich har bir "manba" (masalan "rate-limit",
// "sponsor-gate") uchun KETMA-KET necha marta fail-open bo'lganini
// kuzatadi:
//   • Muvaffaqiyatli chaqiruvda hisoblagich 0'ga qaytariladi (va agar
//     oldin uzilish eskalatsiya qilingan bo'lsa, "tiklandi" deb bir
//     marta yoziladi).
//   • Ketma-ket muvaffaqiyatsizlik ESCALATION_THRESHOLD'ga yetganda —
//     bu endi bir martalik tarmoq xatosi emas, balki DAVOM ETAYOTGAN
//     uzilish ekanligini bildiradi — shu sabab `logger.error` bilan
//     (production monitoring/alert tizimlarida odatda `warn`dan farqli
//     ravishda kuzatiladi va ogohlantirish yuboradi) yoziladi, keyin
//     har ESCALATION_REPEAT_EVERY marta sayin qayta eslatiladi — log
//     spam bo'lib ketmasligi uchun, lekin muammo hali davom etayotgani
//     doim ko'rinib turishi uchun.
//
// Bu — to'liq monitoring/alerting tizimining o'rnini bosmaydi (masalan
// Sentry, Prometheus va h.k.), lekin ularsiz ham production log'da
// darhol ko'zga tashlanadigan, arzon va zudlik bilan qo'yiladigan signal
// beradi.
import { logger } from "../src/lib/logger";

const ESCALATION_THRESHOLD = 5; // shuncha ketma-ket muvaffaqiyatsizlikdan keyin logger.error'ga o'tiladi
const ESCALATION_REPEAT_EVERY = 30; // shundan keyin har N marta sayin qayta eslatiladi

const consecutiveFailures = new Map<string, number>();

export function recordFailOpenOutcome(
  source: string,
  ok: boolean,
  context?: Record<string, unknown>
): void {
  if (ok) {
    const prev = consecutiveFailures.get(source) ?? 0;
    if (prev >= ESCALATION_THRESHOLD) {
      logger.warn(
        { source, failedAttempts: prev, ...context },
        `✅ ${source}: uzilishdan keyin tiklandi (${prev} marta ketma-ket fail-open bo'lgandan so'ng)`
      );
    }
    consecutiveFailures.delete(source);
    return;
  }

  const count = (consecutiveFailures.get(source) ?? 0) + 1;
  consecutiveFailures.set(source, count);

  const justCrossedThreshold = count === ESCALATION_THRESHOLD;
  const repeatedEscalation =
    count > ESCALATION_THRESHOLD && (count - ESCALATION_THRESHOLD) % ESCALATION_REPEAT_EVERY === 0;

  if (justCrossedThreshold || repeatedEscalation) {
    logger.error(
      { source, consecutiveFailures: count, ...context },
      `🚨 ${source}: ${count} marta ketma-ket fail-open bo'ldi — bu vaqtinchalik tarmoq xatosi emas, DAVOM ETAYOTGAN uzilish bo'lishi mumkin (baza/API holatini tekshiring)`
    );
  }
}

// 🆕 KANAL DARAJASIDA "BOT ADMIN EMAS" BO'SHLIG'INI ANIQLASH: yuqoridagi
// `recordFailOpenOutcome` bitta MANBA (masalan butun "sponsor-gate") uchun
// umumiy hisoblaydi — agar 10 ta kanaldan faqat BITTASIDA bot admin
// bo'lmasa-yu, qolgan 9 tasida muvaffaqiyatli javob kelsa, umumiy hisoblagich
// har safar 0'ga tushib qoladi va bitta doimiy muammoli kanal HECH QACHON
// alohida ko'rinmaydi (u boshqa kanallarning muvaffaqiyati ichida
// "cho'kib" qoladi). Bu esa aynan ikkita botning har biri sponsor/exchange
// kanallariga ALOHIDA admin qilib qo'yilishi kerakligi unutilib qolgan
// holatni (jim fail-open) sezishni qiyinlashtiradi.
//
// Shu sabab bu yerda HAR BIR KANAL uchun alohida ketma-ket muvaffaqiyatsizlik
// hisoblanadi. Muvaffaqiyatli chaqiruvda yozuv XARITADAN BUTUNLAY
// O'CHIRILADI (nolga tushirilmaydi) — shu bilan xarita hajmi vaqt o'tishi
// bilan cheksiz o'smaydi, balki FAQAT hozir haqiqatan muammoli (bot admin
// bo'lmagan) kanallar soniga teng bo'lib qoladi.
const CHANNEL_ADMIN_GAP_THRESHOLD = 5; // shuncha ketma-ket muvaffaqiyatsizlikdan keyin ogohlantirish
const CHANNEL_ADMIN_GAP_REPEAT_EVERY = 200; // shundan keyin qayta eslatiladi (log/admin-xabar spam bo'lib ketmasligi uchun)
const channelCheckFailures = new Map<string, number>();

// TUZATILDI (KO'RINMAS DARVOZA MUAMMOSI): bu funksiya ilgari FAQAT
// `logger.error` bilan yozardi — bu esa faylga yozilgan log satri edi,
// hech kim kuzatib turmaydigan. Amalda bu degani: agar sponsor-gate.ts
// (MAJBURIY obuna — botning HAR BIR foydalanuvchisi uchun umumiy)
// tarkibidagi kanal(lar)dan biri buzilgan bo'lsa (masalan username
// noto'g'ri kiritilgan, kanal o'chirilgan yoki bot admin qilinmagan),
// BUTUN bot cheksiz vaqt davomida HAMMA foydalanuvchi uchun bloklanib
// qolaverardi — buni admin faqat server loglarini qo'lda titkilab
// ko'rgandagina bilar edi. Endi bu funksiya threshold'ga YETGANDA (va
// keyin CHANNEL_ADMIN_GAP_REPEAT_EVERY marta sayin qayta) `true`
// qaytaradi — chaqiruvchi (sponsor-gate.ts) buni ko'rib, adminga
// TO'G'RIDAN-TO'G'RI Telegram orqali xabar yuborishni ishga tushiradi
// (qarang: reportBrokenSponsorChannel), shunchaki log yozib qo'ymaydi.
export function recordChannelCheckOutcome(source: string, channelId: string, ok: boolean): boolean {
  const key = `${source}:${channelId}`;
  if (ok) {
    channelCheckFailures.delete(key);
    return false;
  }

  const count = (channelCheckFailures.get(key) ?? 0) + 1;
  channelCheckFailures.set(key, count);

  const justCrossedThreshold = count === CHANNEL_ADMIN_GAP_THRESHOLD;
  const repeatedEscalation =
    count > CHANNEL_ADMIN_GAP_THRESHOLD && (count - CHANNEL_ADMIN_GAP_THRESHOLD) % CHANNEL_ADMIN_GAP_REPEAT_EVERY === 0;

  if (justCrossedThreshold || repeatedEscalation) {
    logger.error(
      { source, channelId, consecutiveFailures: count },
      `🚨 ${source}: "${channelId}" kanalida getChatMember ${count} marta ketma-ket muvaffaqiyatsiz bo'ldi — ehtimol BOT BU KANALDA ADMIN EMAS yoki kanal/username noto'g'ri (deploy/kanal sozlamalarini tekshiring). Bu vaqtgacha bu kanal bo'yicha tekshiruvlar jim fail-open bo'lib kelmoqda.`
    );
    return true;
  }
  return false;
}

// 🆕 KANALNI DOIMIY O'CHIRISHDAN OLDINGI HIMOYA: exchange-service.ts'dagi
// checkExchangeChannelHealth avval BITTA muvaffaqiyatsiz getChatMember
// chaqiruvidanoq (hatto oddiy tarmoq uzilishi/timeout bo'lsa ham) kanalni
// DOIMIY ravishda isActive=false qilib qo'yardi — bu esa vaqtinchalik
// tarmoq xatosini "bot admin emas" bilan aralashtirib yuborardi va
// kanal egasi hech nima qilmagan bo'lsa ham kanali navbatdan chiqib
// ketardi (qayta ulash uchun qo'lda harakat talab qilardi). Bu alohida,
// engilroq hisoblagich orqali FAQAT bir necha marta KETMA-KET muvaffaqiyatsiz
// bo'lgandagina (bitta lahzalik xato emas, balki barqaror holat) chaqiruvchi
// tomonga "haqiqatan o'chirish vaqti keldi" signalini beradi.
const CHANNEL_DEACTIVATION_THRESHOLD = 3; // shuncha ketma-ket muvaffaqiyatsizlikdan keyingina isActive=false qilinadi
const channelHealthFailures = new Map<string, number>();

/**
 * Kanal sog'lig'i tekshiruvining ketma-ket muvaffaqiyatsizliklarini
 * kuzatadi. `ok=true` bo'lsa hisoblagich butunlay tozalanadi. `ok=false`
 * bo'lsa hisoblagich oshiriladi va faqat CHANNEL_DEACTIVATION_THRESHOLD'ga
 * yetgandagina `true` qaytaradi — shungina chaqiruvchi kodga kanalni
 * haqiqatan isActive=false qilish kerakligini bildiradi.
 */
export function recordChannelHealthOutcome(channelId: string, ok: boolean): boolean {
  if (ok) {
    channelHealthFailures.delete(channelId);
    return false;
  }

  const count = (channelHealthFailures.get(channelId) ?? 0) + 1;
  channelHealthFailures.set(channelId, count);

  if (count >= CHANNEL_DEACTIVATION_THRESHOLD) {
    logger.warn(
      { channelId, consecutiveFailures: count },
      `exchange-channel-health: "${channelId}" ${count} marta ketma-ket muvaffaqiyatsiz — endi isActive=false qilinadi`
    );
    // Kanal o'chirilgandan keyin hisoblagichni tozalaymiz — aks holda
    // kanal keyinchalik qayta ulanib, yana muvaffaqiyatsiz bo'lsa, eski
    // hisob bilan boshlanib, kutilganidan tezroq (threshold'siz) yana
    // o'chib qolishi mumkin edi.
    channelHealthFailures.delete(channelId);
    return true;
  }
  return false;
}
