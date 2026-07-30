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
