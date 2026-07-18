import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

export default function SupportPage({ setView }: { setView: (view: string) => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const faqs: FAQItem[] = [
    {
      question: "Savdo24 nima va u qanday ishlaydi?",
      answer: "Savdo24 — bu IT loyihalar, startaplar va innovatsion g'oyalar uchun onlayn savdo maydonchasi. Bu yerda siz o'z loyihangizni sotishingiz yoki istiqbolli loyihalarni sotib olishingiz mumkin."
    },
    {
      question: "Loyihani sotib olish qanday amalga oshiriladi?",
      answer: "Loyiha sahifasidagi 'Sotib olish' yoki 'Taklif yuborish' tugmasi orqali hisob-kitob qilinadi. Xarid tasdiqlangach, loyiha yuklab olish havolasi yoki sotuvchi bilan to'g'ridan-to'g'ri aloqa ma'lumotlari taqdim etiladi."
    },
    {
      question: "E'lon berish bepulmi?",
      answer: "Ha, Savdo24 platformasida loyihalarni e'lon qilish va yangi g'oyalar kiritish mutlaqo bepul. Hech qanday yashirin to'lovlar yoki komissiyalar yo'q."
    },
    {
      question: "Sotib olingan loyihani qaytarish mumkinmi?",
      answer: "Blokcheyn tranzaksiyalari yakuniy va qaytarib bo'lmas hisoblanadi. Agar loyihada muammo yuzaga kelsa, support@savdo24.uz yoki sotuvchi aloqa ma'lumotlari orqali biz bilan bog'lanishingiz mumkin."
    },
    {
      question: "Xavfsizlik qanday ta'minlanadi?",
      answer: "Har bir e'lon va foydalanuvchi ma'lumotlari adminlar tomonidan tekshiriladi. Shuningdek, xaridlar va to'lovlar blokcheyn konsensusi orqali kafolatlanadi."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && subject && message) {
      try {
        const res = await fetch('/api/support', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, subject, message })
        });
        
        if (res.ok) {
          setFormSubmitted(true);
          setEmail('');
          setSubject('');
          setMessage('');
        } else {
          const err = await res.json();
          alert(err.error || "Xatolik yuz berdi.");
        }
      } catch (err) {
        alert("Server bilan ulanishda xatolik.");
      }
    }
  };

  return (
    <div className="space-y-10 animate-fade-in text-left max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary-container text-4xl">help_center</span>
            Qo'llab-quvvatlash markazi
          </h1>
          <p className="text-xs text-on-primary-container mt-1">
            Savollaringiz bormi? Biz sizga yordam berishdan mamnunmiz.
          </p>
        </div>
        <button
          onClick={() => setView('browse')}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 border border-outline-variant/20 transition-all"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Asosiy sahifaga qaytish
        </button>
      </div>

      {/* Grid: Contact & FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Contact info and form */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 space-y-6 shadow-xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-container text-xl">contact_support</span>
              To'g'ridan-to'g'ri aloqa
            </h2>

            <div className="space-y-4">
              <a
                href="mailto:support@savdo24.uz"
                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-secondary-container/10 flex items-center justify-center text-secondary-container">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-on-primary-container font-extrabold">Elektron pochta</p>
                  <p className="text-sm font-bold text-white group-hover:text-secondary-container transition-colors">support@savdo24.uz</p>
                </div>
              </a>

              <a
                href="https://t.me/savdo24_support"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-secondary-container/10 flex items-center justify-center text-secondary-container">
                  <span className="material-symbols-outlined">send</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-on-primary-container font-extrabold">Telegram aloqa</p>
                  <p className="text-sm font-bold text-white group-hover:text-secondary-container transition-colors">@savdo24_support</p>
                </div>
              </a>
            </div>
          </div>

          {/* Quick Ticket Form */}
          <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-secondary-container text-xl">edit_note</span>
              Murojaat qoldirish
            </h2>

            {formSubmitted ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center space-y-2 animate-scale-up">
                <span className="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
                <p className="text-sm font-bold text-white">Murojaatingiz qabul qilindi!</p>
                <p className="text-xs text-on-primary-container">Tez orada operatorlarimiz siz bilan bog'lanishadi.</p>
                <button
                  onClick={() => setFormSubmitted(false)}
                  className="text-xs text-secondary-container font-extrabold underline block mx-auto pt-2"
                >
                  Yana xabar yozish
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-on-primary-container uppercase">Sizning pochtangiz</label>
                  <input
                    type="email"
                    required
                    placeholder="example@mail.com"
                    className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-on-primary-container uppercase">Mavzu</label>
                  <input
                    type="text"
                    required
                    placeholder="Murojaat mavzusi"
                    className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-all"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-on-primary-container uppercase">Xabar matni</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Savolingizni batafsil tushuntiring..."
                    className="w-full bg-[#0b1426] border border-outline-variant/30 text-white rounded-xl p-3 text-sm focus:outline-none focus:border-secondary-container focus:ring-1 focus:ring-secondary-container transition-all resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-secondary-container text-on-secondary-fixed rounded-xl font-bold text-xs shadow-lg shadow-secondary-container/10 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  Yuborish
                </button>
              </form>
            )}
          </div>
        </div>

        {/* FAQs */}
        <div className="md:col-span-7 space-y-4">
          <div className="bg-primary-container border border-outline-variant/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-black text-white flex items-center gap-2 mb-6 border-b border-outline-variant/15 pb-4">
              <span className="material-symbols-outlined text-secondary-container">quiz</span>
              Ko'p beriladigan savollar (FAQ)
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={index}
                    className="border border-outline-variant/15 rounded-xl overflow-hidden bg-white/[0.02]"
                  >
                    <button
                      onClick={() => toggleFaq(index)}
                      className="w-full flex justify-between items-center p-4 text-left hover:bg-white/5 transition-all"
                    >
                      <span className="font-bold text-sm text-white pr-4">{faq.question}</span>
                      <span className={`material-symbols-outlined text-secondary-container transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>
                    
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isOpen ? 'max-h-[200px] border-t border-outline-variant/15' : 'max-h-0'
                      }`}
                    >
                      <p className="p-4 text-xs text-on-primary-container leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
