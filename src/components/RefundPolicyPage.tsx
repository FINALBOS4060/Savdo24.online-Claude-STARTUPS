import React from 'react';

interface RefundPolicyPageProps {
  setView: (view: string) => void;
}

export default function RefundPolicyPage({ setView }: RefundPolicyPageProps) {
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
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Qaytarish va nizolar siyosati</h1>
          <p className="text-xs text-on-primary-container">Oxirgi yangilanish: 2026-yil 11-iyul</p>
        </div>
      </div>

      <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-medium">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-[#f3ba2f]">1. Raqamli mahsulotlar xususiyati</h2>
          <p>
            Savdo24 platformasida sotiladigan loyihalar, startaplar, SaaS tizimlari, API kodlari va domenlar "Raqamli mahsulotlar" toifasiga kiradi. Ushbu mahsulotlar nusxalanadigan va qaytarib olib bo'lmaydigan xususiyatga ega bo'lganligi sababli, muvaffaqiyatli yetkazib berilgandan so'ng <strong>to'lovlar mutlaqo qaytarib berilmaydi</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-[#f3ba2f]">2. Qachon pul qaytarilishi mumkin?</h2>
          <p>
            Xaridor sotib olingan loyiha uchun pulni qaytarib olish huquqiga faqat quyidagi holatlarda ega bo'ladi:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Sotuvchi to'lov amalga oshirilgandan so'ng va'da qilingan vaqt ichida loyihaning manba kodlarini, fayllarini yoki drayverlarini xaridorga yetkazib bermagan bo'lsa.</li>
            <li>Yetkazib berilgan mahsulot e'lon tavsifida va texnik xususiyatlarida ko'rsatilgan talablarga butunlay zid yoki yaroqsiz bo'lsa.</li>
            <li>Sotuvchi foydalanuvchini aldash maqsadida soxta moliyaviy statistika yoki boshqa muallifga tegishli plagiat kodlarni taqdim etganligi isbotlansa.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-[#f3ba2f]">3. Nizo (Dispute) ochish tartibi</h2>
          <p>
            Agar sotuvchi loyihani va drayverlarni topshirishda sustkashlik qilsa yoki yetkazib bermasa, xaridor o'zining "Xaridlar tarixi" (Purchases) bo'limida tegishli buyurtma bo'yicha <strong>Nizo (Dispute)</strong> ochish tugmasini bosishi lozim.
          </p>
          <p>
            Nizo ochilganda xaridor muammoning mohiyatini batafsil tushuntiradi. Nizo holati to'g'ridan-to'g'ri Platforma adminstratsiyasi (Admin) nazoratiga o'tadi va ushbu buyurtma bo'yicha to'langan mablag'lar muzlatiladi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-[#f3ba2f]">4. Administrator vositachiligi va qarori</h2>
          <p>
            Administrator ochiq nizolarni har tomonlama o'rganib chiqadi:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Har ikki tomondan (sotuvchi va xaridor) dalillar, chat yozishmalari, topshirilgan kodlar yoki topshirish xatlarini so'raydi.</li>
            <li>Agar sotuvchi haqiqatan ham loyihani topshirishdan bosh tortsa yoki uning mahsuloti va'dalarga to'liq zid bo'lsa, admin bitimni bekor qiladi va muzlatilgan mablag'ni xaridor hamyoniga qaytaradi (Refund).</li>
            <li>Agar barcha talablar bajarilgan bo'lib, xaridor asossiz ravishda nizo ochgan bo'lsa, admin nizoni rad etadi (Rejected) va mablag'larni sotuvchiga o'tkazadi.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-[#f3ba2f]">5. Muloqot va kelishuv</h2>
          <p>
            Biz har doim nizolarni admin aralashuvisiz, o'zaro do'stona va professional muloqot orqali hal qilishni tavsiya qilamiz. Nizoni administrator ko'rib chiqish muddati odatda 1 kundan 3 ish kunigacha davom etishi mumkin.
          </p>
        </section>
      </div>
    </div>
  );
}
