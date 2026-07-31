import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  validate: false,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const ideaLimiter = rateLimit({
  validate: false,
  windowMs: 1 * 60 * 1000,
  max: 3,
  keyGenerator: (req: any) => `${req.ip || "unknown"}:${req.cookies?.guest_id || "noguest"}`,
  message: { error: "Juda ko'p komment qoldirildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

export const upvoteLimiter = rateLimit({
  validate: false,
  windowMs: 1 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => `${req.ip || "unknown"}:${req.cookies?.guest_id || "noguest"}`,
  message: { error: "Juda ko'p ovoz berildi. Iltimos, 1 daqiqadan so'ng qayta urinib ko'ring." }
});

export const reportLimiter = rateLimit({
  validate: false,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: "Juda ko'p shikoyat yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const uploadLimiter = rateLimit({
  validate: false,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Juda ko'p fayl yuklandi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const passwordResetLimiter = rateLimit({
  validate: false,
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Juda ko'p urinish. Iltimos, 1 soatdan so'ng qayta urinib ko'ring." }
});

export const paymentStatusLimiter = rateLimit({
  validate: false,
  windowMs: 5 * 60 * 1000, // 5 minute window
  // The checkout page (CheckoutPage.tsx) polls this endpoint every 3 seconds for
  // up to ~15 minutes (the checkout countdown), i.e. up to ~100 requests per
  // 5-minute window from a single legitimate user. The previous max of 3 caused
  // real users to get rate-limited within ~9 seconds of starting checkout,
  // silently blocking payment-status updates. 120 leaves headroom for retries
  // while still bounding abuse well below an unthrottled endpoint.
  max: 120,
  message: { error: "Juda ko'p to'lov holatini tekshirish so'rovlari. Iltimos biroz kuting." }
});

export const globalLimiter = rateLimit({
  validate: false,
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, keyinroq qayta urinib ko'ring." }
});

export const supportLimiter = rateLimit({
  validate: false,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Juda ko'p so'rov yuborildi. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});

export const financialActionLimiter = rateLimit({
  validate: false,
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Juda ko'p urinish. Iltimos, 15 daqiqadan so'ng qayta urinib ko'ring." }
});
