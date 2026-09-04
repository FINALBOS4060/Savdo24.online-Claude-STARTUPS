import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { JwtPayload } from "../types";
import { ideaLimiter, upvoteLimiter } from "../lib/rateLimiters";
import { escapeHtml, getErrorMessage, getErrorCode } from "../lib/pure-helpers";
import { logger } from "../lib/logger";
// 127-bosqich (server.ts modullashtirish davomi): bu fayl server.ts'dan
// ko'chirildi — GET/POST/PATCH /api/startups*, GET /api/ideas/top,
// GET/POST /api/startups/:id/ideas, POST /api/ideas/:id/upvote.
// Mantiq AYNAN o'zgarishsiz (4/5-bosqich va 45-MUAMMO status/includeMine
// fixlari, 43-MUAMMO repoIncluded fixi va deliveryUrl egasi/admin uchun
// tiklash logikasi ham shu bilan birga ko'chirildi).
import {
  prisma,
  isPostgres,
  JWT_SECRET,
  authenticateToken,
  requireAdmin,
  createNotification,
  sendEmail,
  formatStartup,
  AuthRequest
} from "../lib/context";

const router = Router();

router.get("/startups", async (req: Request, res: Response) => {
  const { category, status, search, listingType, page, limit, onlyActive, isTop, includeMine } = req.query;

  // MUHIM (4-BOSQICH): bu endpoint hech qanday autentifikatsiyasiz, butunlay
  // ochiq (public) — lekin `status` filtri berilmasa, moderatsiyadan
  // o'tmagan ("pending") va rad etilgan ("rejected") e'lonlarni ham qaytarib
  // yuborardi. Bu ma'lumotlar faqat Admin panelidagi moderatsiya ro'yxati
  // uchun mo'ljallangan edi, lekin App.tsx uni HAR BIR tashrif buyuruvchi
  // (mehmonlar ham) uchun cheklovsiz chaqiradi — natijada tasdiqlanmagan
  // e'lonlar butun saytga (va Telegram bot orqali ham) oshkor bo'lardi.
  // Endi faqat Admin (haqiqiy JWT token bilan) "pending"/"rejected"
  // statusini so'rashi mumkin; qolgan barcha hollarda faqat "active"
  // e'lonlar qaytariladi.
  let isRequestingAdmin = false;
  let requestingUserId: number | null = null;
  try {
    let adminCheckToken = req.cookies?.token;
    if (!adminCheckToken) {
      const authHeader = req.headers["authorization"];
      adminCheckToken = authHeader && authHeader.split(" ")[1];
    }
    if (adminCheckToken) {
      const decoded = jwt.verify(adminCheckToken, JWT_SECRET) as JwtPayload;
      if (decoded?.role === "Admin") isRequestingAdmin = true;
      if (decoded?.id) requestingUserId = decoded.id;
    }
  } catch {
    // Yaroqsiz/eskirgan token — mehmon sifatida davom etiladi (xato tashlanmaydi)
  }

  try {
    const filter: any = {};
    const andConditions: any[] = [];
    if (category) filter.category = category as string;
    if (status && isRequestingAdmin) {
      filter.status = status as string;
    } else if (!isRequestingAdmin) {
      // 45-MUAMMO: yuqoridagi (4/5-bosqich) fix "o'ziniki" e'lonlarni HAR QANDAY
      // /api/startups chaqiruviga (parametrsiz ham) qo'shib yuborardi — bu
      // Profilga mo'ljallangan edi, lekin BrowsePage.tsx ham xuddi shu
      // endpointdan (o'z sahifalash/filtrlari bilan) foydalanganda, tizimga
      // kirgan sotuvchining hali tasdiqlanmagan/rad etilgan e'loni hech qanday
      // belgisiz umumiy ommaviy katalogga (va totalCount/totalPages'ga ham)
      // aralashib qolardi. Endi "o'ziniki"ni qo'shish faqat aniq so'ralganda
      // (includeMine=true — App.tsx buni Profil uchun yuboradi) ishlaydi;
      // BrowsePage kabi ommaviy so'rovlar hamon faqat "active"ni ko'radi.
      if (includeMine === "true" && requestingUserId) {
        andConditions.push({
          OR: [{ status: "active" }, { userId: requestingUserId }],
        });
      } else {
        filter.status = "active";
      }
    }
    if (listingType && listingType !== "All") filter.listingType = listingType as string;
    if (onlyActive === "true") {
      filter.soldStatus = "sotuvda";
    }

    if (isTop === "true") {
      filter.isTop = true;
      filter.topExpiresAt = { gt: new Date() };
    } else if (isTop === "false") {
      filter.isTop = false;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      // 1. Limit length for performance and DOS prevention
      const rawSearch = search.trim().substring(0, 100);
      
      // 2. Sanitize XSS/injection characters (keep only alphanumeric, spaces, hyphens, Uzbek/Cyrillic letters)
      const sanitized = rawSearch.replace(/[^a-zA-Z0-9\s\-\u0400-\u04FFʻʼ'’]/g, '').trim();
      
      // 3. Prevent tiny empty string or whitespace queries
      if (sanitized.length >= 2) {
        const mode = isPostgres ? "insensitive" : undefined;
        andConditions.push({
          OR: [
            { name: { contains: sanitized, mode } },
            { description: { contains: sanitized, mode } },
            { category: { contains: sanitized, mode } },
            { id: { contains: sanitized, mode } },
          ],
        });
      }
    }

    if (andConditions.length > 0) filter.AND = andConditions;

    const parsedPage = parseInt(page as string, 10);
    const pageNum = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const parsedLimit = parseInt(limit as string, 10);
    let limitNum = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit;
    if (limitNum > 100) limitNum = 100; // Max limit 100 for security
    const skip = (pageNum - 1) * limitNum;

    const totalCount = await prisma.startup.count({ where: filter });
    const totalPages = Math.ceil(totalCount / limitNum);

    const startupsList = await prisma.startup.findMany({
      where: filter,
      orderBy: [
        { isTop: "desc" },
        { id: "desc" }
      ],
      skip,
      take: limitNum,
      include: { user: { select: { name: true, isVip: true, avatarUrl: true } } }
    });

    // XATO: formatStartup() deliveryUrl'ni HAMMA uchun (hatto egasi uchun ham)
    // o'chirib tashlaydi — natijada SellPage'da "Tahrirlash" ochilganda sotuvchi
    // o'zining saqlangan maxfiy yetkazish havolasini ko'ra olmasdi. Egasi yoki
    // admin uchun bu maydon qaytarib tiklanadi.
    // JIDDIY QO'SHIMCHA BUG (frontend-backend bog'liqligini tekshirishda
    // topildi): SellPage.tsx "Tahrirlash" rejimida formani shu RO'YXAT
    // endpoint'idan kelgan `startups` prop'i (App.tsx'dagi global keshdan)
    // orqali to'ldiradi — /api/startups/:id (bitta startap) endpoint'ini
    // ishlatmaydi. contactEmail/contactPhone/contactTelegram esa faqat
    // deliveryUrl kabi tiklanmagani uchun bu yerda doim bo'sh qaytardi —
    // SellPage ularni bo'sh input sifatida ko'rsatardi va "Saqlash"
    // bosilganda BO'SH qiymatlar bilan sotuvchining haqiqiy aloqa
    // ma'lumotlarini o'chirib yuborardi (jim ma'lumot yo'qotish). Endi
    // deliveryUrl bilan bir qatorda bu uchtasi ham egasi/admin uchun
    // tiklanadi.
    const formatted = startupsList.map((s: any) => {
      const f = formatStartup(s);
      if (isRequestingAdmin || (requestingUserId && s.userId === requestingUserId)) {
        f.deliveryUrl = s.deliveryUrl || '';
        f.contactEmail = s.contactEmail || '';
        f.contactPhone = s.contactPhone || '';
        f.contactTelegram = s.contactTelegram || '';
      }
      return f;
    });
    res.json({ startups: formatted, totalCount, totalPages });
  } catch (err: unknown) {
    logger.error({ err: err }, "GET /api/startups error");
    res.status(500).json({ error: "Startaplarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/startups/:id - bitta startap tafsiloti
router.get("/startups/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const startupRecord = await prisma.startup.findUnique({
      where: { id },
    });

    if (!startupRecord) {
      return res.status(404).json({ error: "Startap topilmadi." });
    }

    let currentUser = null;
    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers["authorization"];
      token = authHeader && authHeader.split(" ")[1];
    }
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        currentUser = await prisma.user.findUnique({ where: { id: decoded.id } });
      } catch (err) {}
    }

    const isOwner = !!(currentUser && currentUser.id === startupRecord.userId);
    const isAdmin = !!(currentUser && currentUser.role === "Admin");

    // Visibility Check
    if (startupRecord.status !== "active") {
      if (!isOwner && !isAdmin) {
        return res.status(404).json({ error: "Startap topilmadi." }); // Return 404 for privacy
      }
    }

    // XATO: formatStartup() deliveryUrl'ni hamma uchun o'chiradi — egasi/admin
    // uchun tiklanadi (Tahrirlash sahifasida ko'rinishi kerak).
    const formatted = formatStartup(startupRecord);
    if (isOwner || isAdmin) {
      formatted.deliveryUrl = startupRecord.deliveryUrl || '';
      formatted.contactEmail = startupRecord.contactEmail || '';
      formatted.contactPhone = startupRecord.contactPhone || '';
      formatted.contactTelegram = startupRecord.contactTelegram || '';
    }

    res.json(formatted);
  } catch (err: unknown) {
    logger.error({ err: err }, "GET /api/startups/:id error");
    res.status(500).json({ error: "Startapni yuklashda xatolik yuz berdi." });
  }
});


// Startups validation schemas
const techStackPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.string()).max(100, "Texnologiyalar soni juda ko'p").optional().nullable());

const galleryPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.string()).max(10, "Galereya ko'pi bilan 10 ta rasm bo'lishi kerak").optional().nullable());

const teamPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.any()).max(10, "Jamoa a'zolari ko'pi bilan 10 ta bo'lishi kerak").optional().nullable());

const milestonesPreprocess = z.preprocess((val) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}, z.array(z.any()).max(20, "Bosqichlar ko'pi bilan 20 ta bo'lik bo'lishi kerak").optional().nullable());

// Faqat http/https protokolli URL'larni qabul qiladi (javascript:, data: va h.k. XSS vektorlarini bloklaydi)
const safeUrl = z.string().max(2000).refine((val) => {
  if (!val) return true;
  try {
    const parsed = new URL(val);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, { message: "Havola http:// yoki https:// bilan boshlanishi va to'g'ri formatda bo'lishi kerak." }).optional().nullable().or(z.literal(""));

const createStartupSchema = z.object({
  name: z.string().min(1, "Nomi kamida 1 ta belgidan iborat bo'lishi kerak").max(150, "Nomi ko'pi bilan 150 ta belgidan iborat bo'lishi kerak"),
  
  slogan: z.string().max(200, "Slogan ko'pi bilan 200 ta belgidan iborat bo'lishi kerak").optional().nullable().or(z.literal("")),
  
  description: z.string().min(1, "Tavsifi kamida 1 ta belgidan iborat bo'lishi kerak").max(500, "Tavsifi ko'pi bilan 500 ta belgidan iborat bo'lishi kerak"),
  
  longDescription: z.string().max(5000, "Batafsil tavsif ko'pi bilan 5000 ta belgidan iborat bo'lishi kerak").optional().nullable().or(z.literal("")),
  
  category: z.string().min(1, "Kategoriya kiritilishi shart"),
  
  price: z.union([z.number(), z.string()]).refine((val) => {
    const parsed = parseFloat(String(val));
    return !isNaN(parsed) && parsed > 0;
  }, {
    message: "Narx musbat son bo'lishi shart."
  }).refine((val) => {
    const parsed = parseFloat(String(val));
    return parsed <= 1000000;
  }, {
    message: "Narx 1000000 dan oshmasligi kerak."
  }).transform((val) => parseFloat(String(val))),
  
  listingType: z.string().optional().nullable(),
  techStack: techStackPreprocess,
  demoUrl: safeUrl,
  deliveryUrl: safeUrl,
  githubUrl: safeUrl,
  repoIncluded: z.union([z.boolean(), z.string()]).optional().nullable().transform((val) => val === true || val === "true"),
  image: z.string().optional().nullable(),
  gallery: galleryPreprocess,
  team: teamPreprocess,
  milestones: milestonesPreprocess,
  contactEmail: z.string().optional().nullable().or(z.literal("")),
  contactPhone: z.string().optional().nullable().or(z.literal("")),
  contactTelegram: z.string().optional().nullable().or(z.literal("")),
  attributes: z.string().optional().nullable(),
});

const patchStartupSchema = createStartupSchema.partial();

// POST /api/startups — yangi startap qo'shish
router.post("/startups", authenticateToken, async (req: AuthRequest, res: Response) => {
  const parsed = createStartupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const {
    name,
    slogan,
    description,
    longDescription,
    category,
    price: parsedPrice,
    listingType,
    techStack,
    demoUrl,
    githubUrl,
    repoIncluded,
    image,
    gallery,
    team,
    milestones,
    contactEmail,
    contactPhone,
    contactTelegram,
    deliveryUrl,
    attributes,
  } = parsed.data;

  const validCategory = await prisma.category.findFirst({
    where: { id: category, status: "active" }
  });
  if (!validCategory) {
    return res.status(400).json({ error: "Yaroqsiz kategoriya tanlandi." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
    if (user && !user.emailVerified) {
      return res.status(403).json({ error: "Startap e'lon qilish uchun iltimos avval email manzilingizni tasdiqlang." });
    }

    // Generate unique slug (optimized high-performance generation)
    let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!baseSlug) baseSlug = 'startup';
    
    let slug = baseSlug;
    const existing = await prisma.startup.findUnique({ where: { id: slug } });
    if (existing) {
      slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
      const existingSecond = await prisma.startup.findUnique({ where: { id: slug } });
      if (existingSecond) {
        slug = `${baseSlug}-${crypto.randomBytes(4).toString('hex')}`;
      }
    }

    const newStartup = await prisma.startup.create({
      data: {
        id: slug,
        name,
        slogan: slogan || "",
        description,
        longDescription: longDescription || description,
        category,
        price: parsedPrice,
        listingType: listingType || "To'liq loyiha (manba kodi bilan)",
        techStack: JSON.stringify(techStack || []),
        demoUrl: demoUrl || "",
        githubUrl: githubUrl || "",
        deliveryUrl: deliveryUrl || "",
        repoIncluded: repoIncluded === true,
        soldStatus: "sotuvda",
        status: "pending", // default is pending
        proposalsCount: 0,
        image: image || "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800",
        gallery: JSON.stringify(gallery || []),
        team: JSON.stringify(team || []),
        milestones: JSON.stringify(milestones || []),
        contactEmail: contactEmail || req.user?.email || "",
        contactPhone: contactPhone || "",
        contactTelegram: contactTelegram || "",
        attributes: attributes || "{}",
        dateCreated: new Date().toISOString().split("T")[0],
        userId: req.user?.id,
      },
    });

    res.status(201).json(formatStartup(newStartup));
  } catch (err: unknown) {
    logger.error({ err: err }, "POST /api/startups error");
    res.status(500).json({ error: "Loyiha yaratishda xatolik yuz berdi." });
  }
});

// PATCH /api/startups/:id — startapni tahrirlash
router.patch("/startups/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const parsed = patchStartupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const validatedData = parsed.data;

  if (validatedData.category) {
    const validCategory = await prisma.category.findFirst({
      where: { id: validatedData.category, status: "active" }
    });
    if (!validCategory) {
      return res.status(400).json({ error: "Yaroqsiz kategoriya tanlandi." });
    }
  }

  try {
    const startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup) {
      return res.status(404).json({ error: "Startap topilmadi." });
    }

    if (startup.userId !== req.user?.id && req.user?.role !== "Admin") {
      return res.status(403).json({ error: "Siz faqat o'z startaplaringizni tahrirlashingiz mumkin." });
    }

    const updatedData: any = {};
    if (validatedData.name !== undefined) updatedData.name = validatedData.name;
    if (validatedData.price !== undefined) updatedData.price = validatedData.price;
    if (validatedData.description !== undefined) updatedData.description = validatedData.description;
    if (validatedData.longDescription !== undefined) updatedData.longDescription = validatedData.longDescription;
    if (validatedData.category !== undefined) updatedData.category = validatedData.category;
    if (validatedData.listingType !== undefined) updatedData.listingType = validatedData.listingType;
    if (validatedData.demoUrl !== undefined) updatedData.demoUrl = validatedData.demoUrl;
    if (validatedData.githubUrl !== undefined) updatedData.githubUrl = validatedData.githubUrl;
    if (validatedData.image !== undefined) updatedData.image = validatedData.image;
    if (validatedData.gallery !== undefined) {
      updatedData.gallery = JSON.stringify(validatedData.gallery || []);
    }
    if (validatedData.techStack !== undefined) {
      updatedData.techStack = JSON.stringify(validatedData.techStack || []);
    }
    if (validatedData.team !== undefined) {
      updatedData.team = JSON.stringify(validatedData.team || []);
    }
    if (validatedData.milestones !== undefined) {
      updatedData.milestones = JSON.stringify(validatedData.milestones || []);
    }
    if (validatedData.contactEmail !== undefined) updatedData.contactEmail = validatedData.contactEmail;
    if (validatedData.contactPhone !== undefined) updatedData.contactPhone = validatedData.contactPhone;
    if (validatedData.contactTelegram !== undefined) updatedData.contactTelegram = validatedData.contactTelegram;
    if (validatedData.deliveryUrl !== undefined) updatedData.deliveryUrl = validatedData.deliveryUrl;
    if (validatedData.attributes !== undefined) updatedData.attributes = validatedData.attributes;
    // 43-MUAMMO: SellPage.tsx tahrirlashda repoIncluded'ni ham yuborardi
    // (listingType'dan hisoblanadi), lekin bu yerda updatedData'ga
    // qo'shilmagani uchun bazada eskirgan qiymat qolib ketardi — listingType
    // o'zgarsa ham "Repo + Kod" / "Faqat litsenziya" ko'rsatkichi eskicha
    // qolardi (BrowsePage/DetailPage).
    if (validatedData.repoIncluded !== undefined) updatedData.repoIncluded = validatedData.repoIncluded;
    
    // Agar faol bo'lsa, moderatsiyaga qaytarsin (Xavfsizlik)
    if (startup.status === "active") {
        updatedData.status = "pending";
    }

    const updated = await prisma.startup.update({
      where: { id },
      data: updatedData,
    });

    res.json(formatStartup(updated));
  } catch (err: unknown) {
    logger.error({ err: err }, "PATCH /api/startups/:id error");
    res.status(500).json({ error: "Startapni tahrirlashda xatolik yuz berdi." });
  }
});

// PATCH /api/startups/:id/status — admin tomonidan tasdiqlash/rad etish
router.patch("/startups/:id/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // active, pending, rejected (admin) | "sold" (egasi)

  if (!status) {
    return res.status(400).json({ error: "Status taqdim etilishi shart." });
  }

  const isAdmin = req.user?.role === "Admin";

  if (!isAdmin) {
    // Faqat egasi o'z startapini "sold" holatiga o'tkaza oladi — bu
    // `status` (moderatsiya: "active"/"pending") emas, `soldStatus`
    // ("sotuvda"/"sotildi") maydoniga tegishli amal (pastda alohida
    // ishlov beriladi, sabab: MUAMMO izohiga qarang).
    if (status !== "sold") {
      return res.status(403).json({ error: "Siz faqat o'z startapingizni 'sold' holatiga o'tkaza olasiz." });
    }
    const startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup || startup.userId !== req.user?.id) {
      return res.status(403).json({ error: "Ushbu amalni bajarish uchun sizda ruxsat yo'q." });
    }

    // 132-bosqich: bu yerda avval `status: "sold"` yozilardi — lekin
    // `status` maydonining haqiqiy qiymatlari faqat "active"/"pending"
    // (prisma/schema.prisma), sotilganlik esa BUTUN loyihada `soldStatus`
    // ("sotuvda"/"sotildi") orqali tekshiriladi (lib/payments.ts to'lov
    // qabul qilishda, DetailSidebar/BrowsePage "Sotib olish" tugmasida).
    // Natijada: egasi loyihasini shu yo'l bilan "sotilgan" deb belgilasa
    // ham, `soldStatus` "sotuvda" bo'lib qolardi — ya'ni xaridor hamon
    // to'lov qilib sotib olishi mumkin edi (UI ham "Sotilgan" deb
    // ko'rsatmasdi). Ustiga, pastdagi bildirishnoma kodi `status ===
    // "active"` shartiga asoslangani uchun, egasiga xato ravishda
    // "Loyihangiz rad etildi" degan xabar yuborardi.
    try {
      const updated = await prisma.startup.update({
        where: { id },
        data: { soldStatus: "sotildi" },
      });
      return res.json(formatStartup(updated));
    } catch (err: unknown) {
      logger.error({ err }, "Mark startup as sold error");
      return res.status(500).json({ error: "Statusni yangilashda xatolik yuz berdi." });
    }
  }

  try {
    const updated = await prisma.startup.update({
      where: { id },
      data: { status },
    });

    // Notify founder
    if (updated.userId) {
      const title = status === "active" ? "Loyiha tasdiqlandi" : "Loyiha rad etildi";
      const message = status === "active" 
        ? `Sizning "${updated.name}" loyihangiz adminlar tomonidan tasdiqlandi va sotuvga qo'yildi.`
        : `Sizning "${updated.name}" loyihangiz rad etildi. Iltimos qoidalarni qayta ko'ring.`;
      await createNotification(updated.userId, "SYSTEM", title, message, `/startup/${id}`);
      
      const user = await prisma.user.findUnique({ where: { id: updated.userId } });
      if (user && status === "active") {
        await sendEmail(
          user.email,
          "Loyihangiz tasdiqlandi!",
          `<p>Tabriklaymiz! <b>${escapeHtml(updated.name)}</b> loyihangiz admin tomonidan ko'rib chiqildi va tasdiqlandi.</p><p>Endi u platformada sotuvda ko'rinadi.</p>`
        );
      }
    }

    await prisma.auditLog.create({
      data: {
        adminId: req.user?.id || 0,
        adminEmail: req.user?.email,
        action: status === "active" ? "approve_startup" : "reject_startup",
        targetId: id,
        details: `Startup status updated to ${status}`
      }
    }).catch((e: any) => logger.error({ err: e }, "Audit log error"));

    res.json(formatStartup(updated));
  } catch (err: unknown) {
    logger.error({ err: err }, "PATCH /api/startups/:id/status error");
    res.status(500).json({ error: "Statusni yangilashda xatolik yuz berdi." });
  }
});

// GET /api/ideas/top — barcha elonlar bo'yicha eng yuqori reytingli g'oyalar ro'yxati (startap nomi bilan birga), sahifalash bilan (?limit=20&page=1)
router.get("/ideas/top", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const { category, time } = req.query;

    const where: any = {
      // XAVFSIZLIK: bu endpoint auth'siz ochiq — faqat tasdiqlangan (active)
      // e'lonlarga tegishli g'oyalar ko'rsatiladi, aks holda pending/rejected
      // startap nomi/kategoriyasi ommaviy reytingda oshkor bo'lib qolardi.
      startup: { status: "active" },
    };

    if (category && category !== "all") {
      where.startup = {
        ...where.startup,
        category: category as string,
      };
    }

    if (time && time !== "all") {
      const now = new Date();
      let startDate: Date | null = null;
      if (time === "today") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (time === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      if (startDate) {
        where.createdAt = {
          gte: startDate,
        };
      }
    }

    const [ideas, total] = await Promise.all([
      prisma.idea.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { upvotes: "desc" },
          { createdAt: "desc" }
        ],
        include: {
          startup: {
            select: {
              name: true,
              category: true,
            }
          }
        }
      }),
      prisma.idea.count({ where })
    ]);

    res.json({
      ideas,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err: unknown) {
    logger.error({ err: err }, "GET top ideas error");
    res.status(500).json({ error: "Yuqori reytingli g'oyalarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/startups/top-rated — loyihalar reytingi: g'oyalariga to'plangan ovozlar
// yig'indisi bo'yicha eng sara loyihalar ro'yxati, har biri ostida eng yaxshi
// (eng ko'p ovoz olgan) g'oyalari bilan birga, sahifalash bilan (?limit=15&page=1)
router.get("/startups/top-rated", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const { category, time } = req.query;
    const TOP_IDEAS_PER_STARTUP = 3;

    const startupWhere: any = { status: "active" };
    if (category && category !== "all") {
      startupWhere.category = category as string;
    }

    const ideaWhere: any = {};
    if (time && time !== "all") {
      const now = new Date();
      let startDate: Date | null = null;
      if (time === "today") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (time === "week") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      if (startDate) {
        ideaWhere.createdAt = { gte: startDate };
      }
    }

    // Faqat kamida bitta g'oyasi bor loyihalarni ko'rib chiqamiz — g'oyasiz
    // loyiha "g'oyalar reytingi"da ma'noga ega emas.
    const startups = await prisma.startup.findMany({
      where: {
        ...startupWhere,
        ideas: { some: ideaWhere },
      },
      select: {
        id: true,
        name: true,
        category: true,
        image: true,
        ideas: {
          where: ideaWhere,
          orderBy: [{ upvotes: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    const ranked = startups
      .map((s: (typeof startups)[number]) => {
        const totalUpvotes = s.ideas.reduce((sum: number, i: (typeof s.ideas)[number]) => sum + i.upvotes, 0);
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          image: s.image,
          totalUpvotes,
          ideaCount: s.ideas.length,
          topIdeas: s.ideas.slice(0, TOP_IDEAS_PER_STARTUP),
        };
      })
      .sort((a: { totalUpvotes: number; ideaCount: number }, b: { totalUpvotes: number; ideaCount: number }) => {
        if (b.totalUpvotes !== a.totalUpvotes) return b.totalUpvotes - a.totalUpvotes;
        return b.ideaCount - a.ideaCount;
      });

    const total = ranked.length;
    const skip = (page - 1) * limit;
    const pageItems = ranked.slice(skip, skip + limit);

    res.json({
      startups: pageItems,
      pagination: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err: unknown) {
    logger.error({ err: err }, "GET top-rated startups error");
    res.status(500).json({ error: "Yuqori reytingli loyihalarni yuklashda xatolik yuz berdi." });
  }
});

// GET /api/startups/:id/ideas — shu elonga tegishli barcha g'oyalarni olish (eng ko'p ovoz olgani birinchi bo'lib chiqsin)
router.get("/startups/:id/ideas", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const ideas = await prisma.idea.findMany({
      where: { startupId: id },
      orderBy: [
        { upvotes: "desc" },
        { createdAt: "desc" }
      ],
    });
    res.json(ideas);
  } catch (err: unknown) {
    logger.error({ err: err }, "GET ideas error");
    res.status(500).json({ error: "G'oyalarni yuklashda xatolik yuz berdi." });
  }
});

// POST /api/startups/:id/ideas — yangi g'oya qo'shish (mehmon yoki login qilgan foydalanuvchi)
router.post("/startups/:id/ideas", ideaLimiter, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, authorName } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "G'oya matni bo'sh bo'lmasligi kerak." });
  }

  if (content.length > 500) {
    return res.status(400).json({ error: "G'oya matni 500 belgidan oshmasligi kerak." });
  }

  try {
    let userId: number | undefined = undefined;
    let finalAuthorName = authorName?.trim();

    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers["authorization"];
      token = authHeader && authHeader.split(" ")[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        userId = decoded.id;
        if (!finalAuthorName) {
          finalAuthorName = decoded.name;
        }
      } catch (authErr) {
        // Token validation failed, fallback to guest
      }
    }

    if (!finalAuthorName) {
      finalAuthorName = "Mehmon";
    }

    const newIdea = await prisma.idea.create({
      data: {
        content: content.trim(),
        startupId: id,
        userId,
        authorName: finalAuthorName,
        upvotes: 0,
      },
    });

    res.status(201).json(newIdea);
  } catch (err: unknown) {
    logger.error({ err: err }, "POST idea error");
    res.status(500).json({ error: "Xatolik yuz berdi, keyinroq qayta urinib ko'ring." });
  }
});

// POST /api/ideas/:id/upvote — g'oyaga ovoz berish (+1)
router.post("/ideas/:id/upvote", upvoteLimiter, async (req: Request, res: Response) => {
  const { id } = req.params;
  const ideaIdNum = parseInt(id);

  if (isNaN(ideaIdNum)) {
    return res.status(400).json({ error: "Noto'g'ri g'oya ID si." });
  }

  // Identify voter
  let voterKey = "";
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) {
        voterKey = "user-" + decoded.id;
      }
    } catch (err) {
      // ignore decoding error and fallback to guest
    }
  }

  if (!voterKey) {
    let guestId = req.cookies?.guest_id;
    if (!guestId) {
      guestId = crypto.randomUUID();
      res.cookie("guest_id", guestId, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "lax" });
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const rawKey = `guest-${guestId}-${ip}-${userAgent}`;
    voterKey = crypto.createHash("sha256").update(rawKey).digest("hex");
  }

  try {
    // Check if voter already voted
    const existingVote = await prisma.ideaVote.findUnique({
      where: {
        ideaId_voterKey: {
          ideaId: ideaIdNum,
          voterKey: voterKey,
        }
      }
    });

    if (existingVote) {
      return res.status(409).json({ error: "Siz allaqachon ovoz bergansiz" });
    }

    // Try to record the vote
    try {
      await prisma.ideaVote.create({
        data: {
          ideaId: ideaIdNum,
          voterKey: voterKey,
        }
      });
    } catch (createErr: unknown) {
      if (getErrorCode(createErr) === 'P2002' || getErrorMessage(createErr).includes('Unique constraint failed')) {
        return res.status(409).json({ error: "Siz allaqachon ovoz bergansiz" });
      }
      throw createErr;
    }

    const updatedIdea = await prisma.idea.update({
      where: { id: ideaIdNum },
      data: {
        upvotes: { increment: 1 }
      }
    });
    res.json(updatedIdea);
  } catch (err: unknown) {
    logger.error({ err: err }, "Upvote idea error");
    res.status(500).json({ error: "Ovoz berishda xatolik yuz berdi." });
  }
});

export default router;
