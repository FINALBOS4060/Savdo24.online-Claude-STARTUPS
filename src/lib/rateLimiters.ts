import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true }, windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const ideaLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true }, windowMs: 1 * 60 * 1000,
  max: 3,
  message: { error: "Juda ko'p komment qoldirildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

export const upvoteLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true }, windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: "Juda ko'p ovoz berildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

export const reportLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true }, windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Juda ko'p shikoyat yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const uploadLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true }, windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Juda ko'p fayl yuklandi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const passwordResetLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true }, windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Juda ko'p urinish. Iltimos, 1 soatdan so'ng qayta urinib ko'ring." }
});

export const paymentStatusLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true },
  windowMs: 5 * 60 * 1000, // 5 minute window
  max: 3, // Max 3 attempts
  message: { error: "Juda ko'p to'lov holatini tekshirish so'rovlari. Iltimos biroz kuting." }
});

export const globalLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true }, windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, keyinroq qayta urinib ko'ring." }
});

export const supportLimiter = rateLimit({
  validate: { xForwardedForHeader: false, default: true },
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});
