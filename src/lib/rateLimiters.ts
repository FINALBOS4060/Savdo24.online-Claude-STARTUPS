import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const ideaLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: { error: "Juda ko'p komment qoldirildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

export const upvoteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: "Juda ko'p ovoz berildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

export const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Juda ko'p shikoyat yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Juda ko'p fayl yuklandi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Juda ko'p urinish. Iltimos, 1 soatdan so'ng qayta urinib ko'ring." }
});

export const paymentStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "To'lov holatini tekshirish limiti tugadi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, keyinroq qayta urinib ko'ring." }
});
