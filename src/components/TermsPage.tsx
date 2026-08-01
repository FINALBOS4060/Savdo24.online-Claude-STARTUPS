import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface TermsPageProps {
  setView: (view: string) => void;
}

export default function TermsPage({ setView }: TermsPageProps) {
  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-8 animate-fade-in text-left">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <button
          onClick={() => setView('browse')}
          className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Foydalanish shartlari</h1>
          <p className="text-xs text-on-primary-container">Oxirgi yangilanish: 2026-yil 11-iyul</p>
        </div>
      </div>

      <div className="space-y-6 text-sm text-gray-300 leading-relaxed font-medium">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">1. Shartlarning qabul qilinishi</h2>
          <p>
            Savdo24 platformasiga (keyingi o'rinlarda "Platforma") kirish yoki undan foydalanish orqali siz ushbu Foydalanish shartlariga to'liq rozilik bildirasiz. Agar siz ushbu shartlarga rozi bo'lmasangiz, iltimos, Platforma xizmatlaridan foydalanmang.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">2. Xizmat tavsifi</h2>
          <p>
            Savdo24 — bu raqamli mahsulotlar, startaplar, SaaS loyihalari, API xizmatlar va dasturiy ta'minot kodlarini sotish va sotib olishga mo'ljallangan xavfsiz vositachilik platformasidir. Platforma xaridor va sotuvchilarga o'zaro shartnomalar tuzish, xavfsiz to'lovlarni amalga oshirish hamda loyihalarni topshirish imkonini beradi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">3. Foydalanuvchilarning majburiyatlari</h2>
          <p>
            Platformadan foydalanganda quyidagi qoidalarga qat'iy rioya qilishingiz shart:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Sotuvga qo'yiladigan har qanday mahsulot yoki startap sotuvchining shaxsiy mulki yoki mualliflik huquqi ostida bo'lishi lozim.</li>
            <li>Platformada taqdim etilayotgan barcha ma'lumotlar (ism, email, loyiha tavsifi, statistika) to'liq, aniq va haqiqiy bo'lishi shart.</li>
            <li>Sotuvchilar o'z mahsulotlarining barcha texnik nosozliklari va kamchiliklarini tavsifda aniq ko'rsatishlari shart.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">4. Taqiqlangan kontent va harakatlar</h2>
          <p>
            Platformada quyidagi kontent turlarini sotish yoki joylashtirish qat'iyan man etiladi:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Uchinchi tomonlarning intellektual va mualliflik huquqlarini buzuvchi plagiat mahsulotlar yoki dasturlar.</li>
            <li>Zararli kodlar, viruslar, shaxsiy ma'lumotlarni o'g'irlovchi skriptlar yoki fishing havolalarini o'z ichiga olgan fayllar.</li>
            <li>Noqonuniy materiallar, pornografiya yoki zo'ravonlikni targ'ib qiluvchi loyihalar.</li>
            <li>Sun'iy ravishda ko'p ko'rsatilgan sotuvlar yoki soxtalashtirilgan moliyaviy statistika ma'lumotlari.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">5. Bitimlar va vositachilik komissiyasi</h2>
          <p>
            Platformada muvaffaqiyatli amalga oshirilgan har bir xarid bitimidan Savdo24 tizimi 5% miqdorida vositachilik komissiyasi ushlab qoladi. To'lovlar xavfsiz kripto to'lov tizimi (CoinGate) orqali amalga oshiriladi va loyiha xaridorga to'liq topshirilgunga qadar platforma depozitida saqlanadi.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider text-secondary">6. Shartlarning o'zgartirilishi</h2>
          <p>
            Savdo24 ushbu Foydalanish shartlarini istalgan vaqtda bir tomonlama o'zgartirish huquqini o'zida saqlab qoladi. Shartlar o'zgargandan so'ng xizmatlardan foydalanishda davom etishingiz yangilangan qoidalarni qabul qilganingizni anglatadi.
          </p>
        </section>
      </div>
    </div>
  );
}
