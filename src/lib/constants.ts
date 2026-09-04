// Saytning rasmiy Telegram boti. Bitta joyda saqlanadi — agar bot
// almashtirilsa (masalan yangi tokenga o'tilsa), faqat shu qatorni
// o'zgartirish kifoya, har bir komponentni alohida qidirib yurish shart
// emas.
export const TELEGRAM_BOT_USERNAME = 'Savdo24_Register_bot';
export const TELEGRAM_BOT_URL = `https://t.me/${TELEGRAM_BOT_USERNAME}`;

// Hisobni ulash kodi bilan birga deep-link yaratadi — foydalanuvchi botni
// ochganda kod avtomatik yuborilib, hisob bir bosishda ulanadi (botning
// /start buyrug'i 6 xonali kodni avtomatik aniqlab, "/bogla" bilan bir xil
// ishlaydi — telegram-bot/index.ts'ga qarang).
export function telegramLinkDeepLink(code?: string | null): string {
  return code ? `${TELEGRAM_BOT_URL}?start=${code}` : TELEGRAM_BOT_URL;
}
