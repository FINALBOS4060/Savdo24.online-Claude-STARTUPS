import React, { useState } from 'react';
import { Mail, ArrowLeft, AlertCircle, CheckCircle, Loader, Send } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ForgotPasswordPageProps {
  onNavigate: (page: string) => void;
}

type ResetMethod = 'email' | 'telegram';

export default function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<ResetMethod>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Tugma disabled bo'lsa ham, input ichida Enter bosilganda forma submit
    // bo'lishi mumkin — bu himoyani chetlab o'tib qayta-qayta yuborilishi
    // (SellPage/SupportPage/MessagesPage'dagi 60/74/76-band bilan bir xil
    // muammo turi, lekin bu yerda faqat tugma disabled edi, funksiya ichida
    // qayta kirishdan himoya yo'q edi).
    if (loading) return;
    if (!email) {
      setError('Email manzilini kiritishingiz lozim.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    // MUHIM: avval faqat email orqali tiklash bor edi — SMTP server
    // ishlamasa, xat spam papkaga tushib qolsa yoki foydalanuvchi email
    // parolini ham unutgan bo'lsa, hisobni tiklashning boshqa yo'li
    // qolmasdi. Endi Telegram bot orqali ham (agar hisob avval botga
    // ulangan bo'lsa) tiklash mumkin — tezroq va ko'proq holatlarda ishlaydi.
    const endpoint = method === 'telegram'
      ? '/api/auth/forgot-password-telegram'
      : '/api/auth/forgot-password';

    try {
      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(
          method === 'telegram'
            ? "Agar hisobingiz Telegram botga ulangan bo'lsa, parolni tiklash havolasi botga yuborildi. Telegram'ni tekshiring."
            : 'Parolni tiklash havolasi email manzilingizga yuborildi. Iltimos, pochtangizni tekshiring.'
        );
      } else {
        setError(data.error || 'Parolni tiklash so\'rovida xatolik yuz berdi.');
      }
    } catch (err: unknown) {
      setError('Server bilan bog\'lanishda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans" id="forgot-password-page">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-2xl border border-emerald-500/20">
            <Mail className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-medium tracking-tight text-on-primary-container">
          Parolni unutdingizmi?
        </h2>
        <p className="mt-2 text-center text-sm text-on-primary-container">
          Sizga parolingizni tiklash havolasini yuboramiz.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-container py-8 px-4 border border-outline/20 shadow-xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center bg-emerald-500/15 text-emerald-400 p-3 rounded-full mb-4">
                <CheckCircle className="h-6 w-6" />
              </div>
              <p className="text-emerald-400 font-medium mb-2">Muvaffaqiyatli!</p>
              <p className="text-sm text-on-primary-container mb-6">
                {success}
              </p>
              <button
                id="back-to-login-success-btn"
                onClick={() => onNavigate('login')}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Kirish sahifasiga qaytish
              </button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Usul tanlash — Email yoki Telegram */}
              <div className="flex items-center gap-2 bg-surface-container-low border border-outline/20 p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setMethod('email'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    method === 'email' ? 'bg-emerald-600 text-white' : 'text-on-primary-container'
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email orqali
                </button>
                <button
                  type="button"
                  onClick={() => { setMethod('telegram'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    method === 'telegram' ? 'bg-emerald-600 text-white' : 'text-on-primary-container'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  Telegram orqali
                </button>
              </div>

              {method === 'telegram' && (
                <p className="text-xs text-on-primary-container bg-white/5 border border-white/10 rounded-xl p-3 leading-relaxed">
                  ℹ️ Bu usul faqat Telegram hisobingiz saytga avval ulangan bo'lsa ishlaydi (Profil → Sozlamalar bo'limida ulash mumkin). Baribir pastga o'zingizning saytdagi email manzilingizni kiriting — biz hisobingizni shu orqali topamiz.
                </p>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                  Email manzilingiz
                </label>
                <div className="mt-1.5 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="block w-full pl-11 pr-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-on-primary-container placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-colors duration-200 disabled:opacity-60"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <div>
                <button
                  id="send-reset-link-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin h-4 w-4 mr-2" />
                      Yuborilmoqda...
                    </>
                  ) : method === 'telegram' ? (
                    "Telegram orqali yuborish"
                  ) : (
                    'Parolni tiklash havolasini olish'
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center">
                <button
                  id="back-to-login-btn"
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center gap-2 text-sm text-success hover:text-emerald-400 font-medium transition-colors duration-150"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kirish sahifasiga qaytish
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
