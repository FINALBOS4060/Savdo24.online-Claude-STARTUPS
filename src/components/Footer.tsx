import React from 'react';
import { Send, Mail, Phone, ExternalLink, Bot } from 'lucide-react';
import { TELEGRAM_BOT_URL } from '../lib/constants';

interface FooterProps {
  setView: (view: string) => void;
}

export default function Footer({ setView }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    // MUHIM (LAYOUT XATOSI): Sidebar `position: fixed` bo'lgani uchun u
    // sahifa qanchalik pastga aylantirilmasin, doim ekranning chap
    // tomonida (top-16 dan 100vh gacha) ko'rinib turadi. <main> buni
    // `lg:pl-64` bilan hisobga oladi, lekin Footer <main> tashqarisida
    // joylashgan edi va bu paddingga ega emas edi — natijada footer
    // ekranga to'liq sig'ganda fixed sidebar uning chap ~256px qismini
    // (matn/havolalarni) yopib qo'yardi. Endi <main> bilan bir xil
    // `lg:pl-64` qo'shildi — ikkalasi mos keladi.
    <footer className="bg-surface-container-lowest dark:bg-primary-container border-t border-outline-variant/30 py-12 px-6 lg:pl-64 mt-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Logo & Description */}
        <div className="space-y-3">
          <span className="text-2xl font-black text-secondary-container tracking-tight">Savdo24</span>
          <p className="text-xs text-on-primary-container leading-relaxed">
            Startaplar, SaaS loyihalari va dasturiy ta'minot kodlarini xavfsiz sotish va sotib olish uchun ishonchli platforma.
          </p>
        </div>

        {/* Legal Links */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-on-primary-container">Huquqiy</h4>
          <div className="flex flex-col gap-2 text-xs text-on-primary-container">
            {/* MUHIM (73-band): SupportPage (/support — FAQ va murojaat formasi)
                mavjud edi, lekin uni ochish uchun saytda HECH QANDAY havola
                yo'q edi (MessagesPage'dagi 67-banddagi bilan bir xil muammo
                turi) — faqat URL'ni qo'lda kiritib topish mumkin edi. */}
            <button onClick={() => setView('support')} className="hover:text-secondary-container transition-colors text-left">Yordam va FAQ</button>
            <button onClick={() => setView('terms')} className="hover:text-secondary-container transition-colors text-left">Foydalanish shartlari</button>
            <button onClick={() => setView('privacy')} className="hover:text-secondary-container transition-colors text-left">Maxfiylik siyosati</button>
            <button onClick={() => setView('refund')} className="hover:text-secondary-container transition-colors text-left">Qaytarish siyosati</button>
          </div>
        </div>

        {/* Community */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-on-primary-container">Hamjamiyat</h4>
          {/* MUHIM: sayt bo'yicha hech qayerda Savdo24'ning o'z Telegram
              botiga ochiq havola yo'q edi — foydalanuvchilar uni faqat
              Profil → Sozlamalar bo'limiga kirib, "ulanish kodi" olgandan
              keyingina bilib olishardi. Bu botni umuman bilmagan
              (ro'yxatdan o'tmagan) tashrif buyuruvchilar uchun butunlay
              ko'rinmas edi. Endi Footer'da — saytning istalgan sahifasida
              — doim ko'rinadi. */}
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-on-primary-container hover:text-secondary-container transition-colors"
          >
            <Bot className="w-4 h-4" />
            Savdo24 Telegram bot
            <ExternalLink className="w-3 h-3 ml-auto" />
          </a>
          <a
            href="https://t.me/Dasturchilar_Python_JS_HTML_CSS"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-on-primary-container hover:text-secondary-container transition-colors"
          >
            <Send className="w-4 h-4" />
            Telegram guruh
            <ExternalLink className="w-3 h-3 ml-auto" />
          </a>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <h4 className="font-bold text-sm text-on-primary-container">Aloqa</h4>
          <div className="flex flex-col gap-2 text-xs text-on-primary-container">
            <a href="mailto:support@savdo24.online" className="flex items-center gap-2 hover:text-secondary-container transition-colors">
              <Mail className="w-4 h-4" />
              support@savdo24.online
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-outline-variant/10 text-center">
        <p className="text-xs text-on-primary-container/60">
          © {currentYear} Savdo24. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </footer>
  );
}
