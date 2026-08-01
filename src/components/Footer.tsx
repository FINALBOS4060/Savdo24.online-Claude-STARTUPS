import React from 'react';
import { Send, Mail, Phone, ExternalLink } from 'lucide-react';

interface FooterProps {
  setView: (view: string) => void;
}

export default function Footer({ setView }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface-container-lowest dark:bg-primary-container border-t border-outline-variant/30 py-12 px-6 mt-12 transition-colors duration-300">
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
          <h4 className="font-bold text-sm text-white">Huquqiy</h4>
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
          <h4 className="font-bold text-sm text-white">Hamjamiyat</h4>
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
          <h4 className="font-bold text-sm text-white">Aloqa</h4>
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
