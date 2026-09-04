import React, { useState, useEffect } from 'react';
import { KeyRound, ArrowLeft, AlertCircle, CheckCircle, Loader, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ResetPasswordPageProps {
  onNavigate: (page: string) => void;
}

export default function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Extract token from query parameters
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // ForgotPasswordPage'dagi bilan bir xil 117-band tuzatishi: tugma
    // disabled bo'lishi Enter kalitidan qayta submit bo'lishini bloklamaydi.
    if (loading) return;
    setError('');
    setSuccess('');

    if (!token) {
      setError('Tiklash kaliti (token) topilmadi. Iltimos, havoladan to\'g\'ri foydalanilganligiga ishonch hosil qiling.');
      return;
    }

    if (password.length < 8) {
      setError('Parol kamida 8 ta belgidan iborat bo\'lishi kerak.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Parollar bir-biriga mos kelmadi.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Parolingiz muvaffaqiyatli o\'zgartirildi. Endi yangi parol bilan kirishingiz mumkin.');
        // Clear search query param so it doesn't leak
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setError(data.error || 'Parolni yangilashda xatolik yuz berdi.');
      }
    } catch (err: unknown) {
      setError('Server bilan bog\'lanishda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans" id="reset-password-page">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-2xl border border-emerald-500/20">
            <KeyRound className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-medium tracking-tight text-on-primary-container">
          Yangi parolni o'rnatish
        </h2>
        <p className="mt-2 text-center text-sm text-on-primary-container">
          Iltimos, hisobingiz uchun yangi xavfsiz parol kiriting.
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
                id="back-to-login-success-reset-btn"
                onClick={() => onNavigate('login')}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors duration-200"
              >
                Kirish sahifasiga o'tish
              </button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {!token && (
                <div>
                  <label htmlFor="token-input" className="block text-sm font-medium text-slate-300">
                    Tiklash kaliti (Token)
                  </label>
                  <input
                    id="token-input"
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={loading}
                    className="mt-1.5 block w-full px-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-on-primary-container placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-colors duration-200 disabled:opacity-60"
                    placeholder="Email orqali yuborilgan tokenni kiriting"
                  />
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Yangi parol
                </label>
                <div className="mt-1.5 relative rounded-lg shadow-sm">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="block w-full px-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-on-primary-container placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm pr-12 transition-colors duration-200 disabled:opacity-60"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-on-primary-container"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300">
                  Yangi parolni tasdiqlang
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="mt-1.5 block w-full px-4 py-3 bg-surface-container-low border border-outline/20 rounded-xl text-on-primary-container placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition-colors duration-200 disabled:opacity-60"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <button
                  id="reset-password-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors duration-200"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin h-4 w-4 mr-2" />
                      Yangilanmoqda...
                    </>
                  ) : (
                    'Parolni yangilash'
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center">
                <button
                  id="back-to-login-from-reset-btn"
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center gap-2 text-sm text-success hover:text-emerald-400 font-medium transition-colors duration-150"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Ortga qaytish
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
