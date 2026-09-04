# ⚠️ Bu papka eskirgan (faqat 6/30 model)

`prisma/migrations/` faqat dastlabki 6 ta jadvalni (`User`, `Category`,
`Startup`, `Payment`, `Idea`, `Subscriber`) yaratadi. `prisma/schema.prisma`
da esa 30 ta model bor — qolgan 24 tasi migratsiyasiz, to'g'ridan-to'g'ri
`prisma db push` orqali qo'shilgan (batafsili: `tuzatish.txt`, 94-band).

**HECH QACHON ishlatmang:**
- `npx prisma migrate deploy`
- `npx prisma migrate resolve`
- `npx prisma migrate dev`

Bularning barchasi shu eskirgan migratsiya tarixiga tayanadi va production
bazani buzishi mumkin.

**Faqat shu buyruqni ishlating** (`deploy.sh` ham aynan shunday qiladi):
```bash
npx prisma db push --schema=prisma/schema.prisma
```

Agar kelajakda migratsiya tarixini to'g'ri boshidan tiklamoqchi bo'lsangiz,
avval joriy production bazadan zaxira oling (`npm run backup`), so'ng
`prisma migrate diff` / `prisma db pull` yordamida schema'ga mos yangi
"baseline" migratsiya yarating — bu ish DB ulanishi talab qiladi va bu
muhitda bajarilmagan.

## Kutilayotgan o'zgarish: `User.joinDate` (String → DateTime)

## Yangi migratsiya: Review/Dispute unique cheklovlari (2026-08-02)
`20260802000000_add_review_dispute_unique_constraints` — `Review(startupId,
buyerId)` va `Dispute(paymentId)`ga `@@unique` qo'shildi (kod tekshiruvida
topilgan poyga holati: ikkita bir vaqtdagi so'rov dublikat sharh/nizo
yaratishi mumkin edi — IdeaVote/Report/Conversation'da bu himoya bor edi,
Review/Dispute'da yo'q edi). Bu migratsiya FAQAT QO'SHADI (CREATE UNIQUE
INDEX, ikkita buyruq) — mavjud ustun/jadvalga tegmaydi. Agar bazada
allaqachon dublikat qatorlar bo'lsa, bu migratsiya xato bilan to'xtaydi —
avval dublikatlarni tozalang. Batafsil: migration.sql ichidagi izoh.

`schema.prisma`/`schema.sqlite.prisma`da `joinDate` endi `String` emas,
`DateTime` (`@default(now())`). Sabab: avval bu ustunga tayyor formatlangan
matn (masalan `"2026-yil avgust"`) yozilardi, keyin esa boshqa joylarda
ISO sana bilan solishtirilar edi (`/api/social-proof`, admin analytics) —
bu solishtirish hech qachon to'g'ri ishlamas edi, va `orderBy: { joinDate:
"desc" }` ham xato tartibda saralardi (oy nomlari alifbo tartibida,
xronologik emas).

**Production'ga qo'llashdan oldin albatta tekshiring:** yuqoridagi
ogohlantirish sababli (6/30 model migratsiyasi, `deploy.sh` esa `migrate
deploy` ishlatadi) — bu maydon o'zgarishini qanday qo'llash kerakligi
(`db push` yoki yangi migration fayli orqali) production bazadagi haqiqiy
migratsiya holatiga bog'liq. Mavjud qatorlardagi matn qiymatlarini (masalan
`"2026-yil avgust"`) haqiqiy sanaga konvertatsiya qilib bo'lmaydi (oy-yil
darajasida aniqlik bor, kun yo'q) — shu sababli ustunni almashtirishdan
oldin buni hisobga oling (masalan eski qiymatni boshqa ustunga saqlab
qo'yish yoki oyning 1-kuni deb qabul qilish kabi qaror kerak bo'ladi).
