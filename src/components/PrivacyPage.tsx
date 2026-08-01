import React from 'react';

interface PrivacyPageProps {
  setView: (view: string) => void;
}

export default function PrivacyPage({ setView }: PrivacyPageProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in text-left">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <button
          onClick={() => setView('browse')}
          className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Maxfiylik siyosati</h1>
          <p className="text-xs text-on-primary-container">Oxirgi yangilanish: 2026-yil 11-iyul</p>
        </div>
      </div>

      <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-medium">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">1. Umumiy qoidalar</h2>
          <p>
            Ushbu Maxfiylik siyosati Savdo24 platformasi foydalanuvchilarining shaxsiy ma'lumotlarini to'plash, qayta ishlash, saqlash va ulardan foydalanish tartibini belgilaydi. Biz foydalanuvchilarimizning shaxsiy hayoti va daxlsizligini hurmat qilamiz hamda ma'lumotlar xavfsizligini ta'minlash majburiyatini olamiz.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">2. To'planadigan ma'lumotlar</h2>
          <p>
            Platformadan foydalanish jarayonida biz quyidagi shaxsiy ma'lumotlarni yig'ishimiz mumkin:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Ro'yxatdan o'tish paytida kiritilgan foydalanuvchi ismi, elektron pochta manzili (email) va parol.</li>
            <li>Profil sozlamalarida taqdim etiladigan ma'lumotlar, jumladan ijtimoiy tarmoq profillari havolalari yoki avatar rasmlari.</li>
            <li>Platformada amalga oshirilgan tranzaksiyalar, sotuvlar, xaridlar va to'lovlar tarixi.</li>
            <li>Texnik xarakterdagi ma'lumotlar: IP-manzil, foydalanilayotgan brauzer turi va platforma ichidagi sahifalarga kirish tarixi.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">3. Ma'lumotlardan foydalanish maqsadlari</h2>
          <p>
            Yig'ilgan ma'lumotlar faqat quyidagi maqsadlarda foydalaniladi:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Platforma xizmatlarini taqdim etish, hisoblarni boshqarish va autentifikatsiyani ta'minlash.</li>
            <li>Kafolatlangan xavfsiz to'lovlarni amalga oshirish va sotib olingan startap yoki raqamli fayllarni xaridorga yetkazish.</li>
            <li>Foydalanuvchilarni yangi xizmatlar, e'lonlar va maxsus takliflar to'g'risida xabardor qilish (Newsletter/Obuna tizimi orqali).</li>
            <li>Platforma sifatini oshirish va texnik muammolarni bartaraf etish uchun tahlillar o'tkazish.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">4. Ma'lumotlarni himoya qilish va saqlash</h2>
          <p>
            Biz foydalanuvchilar ma'lumotlarini ruxsatsiz kirish, o'zgartirish yoki yo'q qilishdan himoya qilish uchun zamonaviy xavfsizlik protokollaridan (jumladan, SSL shifrlash, xavfsiz ma'lumotlar bazasi saqlash tizimlari) foydalanamiz. Shaxsiy ma'lumotlar qat'iy himoyalangan serverlarda saqlanadi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">5. Ma'lumotlarni uchinchi tomonlarga berilmasligi</h2>
          <p>
            Savdo24 foydalanuvchilarning shaxsiy ma'lumotlarini uchinchi tomonlarga sotmaydi, ijaraga bermaydi va ulashmaydi. Istisno holatlar faqat qonun talablariga muvofiq rasmiy davlat organlarining so'rovlariga ko'ra yuzaga kelishi mumkin.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">6. Cookie fayllari</h2>
          <p>
            Tizim ishlashini yaxshilash, foydalanuvchi parametrlarini yodda saqlash va platformani qulayroq qilish maqsadida brauzerlarda "cookie" fayllaridan foydalaniladi. Siz istalgan vaqtda o'z brauzeringiz sozlamalari orqali cookies qabul qilishni o'chirib qo'yishingiz mumkin.
          </p>
        </section>
      </div>
    </div>
  );
}
