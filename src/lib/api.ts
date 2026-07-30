// Global Fetch Interceptor to add CSRF header, handle credentials, and auto-token-refresh on 401
const originalFetch = window.fetch;

// 94-band: getCookie() faqat o'chirilgan CSRF header kodi uchun ishlatilardi
// (pastdagi izohga qarang) — o'zi hech qayerda chaqirilmaydigan o'lik funksiya
// bo'lib qolgan edi, olib tashlandi.

// Bir vaqtning o'zida bir nechta so'rov 401 bilan qaytsa (masalan sahifa ochilganda
// bir nechta useEffect parallel fetch chaqirsa), ularning HAMMASI emas, faqat BITTASI
// /api/auth/refresh so'rovini yuborishi kerak — chunki backend refresh token'ni rotatsiya
// qiladi (eskisini o'chirib, yangisini beradi) va eskisi qayta yuborilsa "o'g'irlangan"
// deb hisoblab, foydalanuvchining BARCHA seansini bekor qiladi. Bitta umumiy promise orqali
// bu poyga holatini (race condition) oldini olamiz.
let refreshPromise: Promise<boolean> | null = null;

function performTokenRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshResponse = await originalFetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          window.dispatchEvent(new CustomEvent('savdo24_auth_change', {
            detail: { token: refreshData.accessToken || 'cookie_authenticated' }
          }));
          return true;
        }

        window.dispatchEvent(new CustomEvent('savdo24_auth_change', {
          detail: { token: null, logout: true }
        }));
        return false;
      } catch (err) {
        console.error("Token refresh failed:", err);
        return false;
      } finally {
        // Keyingi 401 kelganda yangi refresh urinishi bo'lishi uchun tozalaymiz
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let options = init || {};
  options.credentials = 'include'; // Send cookies with all requests

  // MUHIM: bu yerda ilgari "CSRF token" header qo'shish uchun kod bor edi,
  // lekin `csrfToken` cookie'si loyihaning hech bir joyida (server tomonida)
  // o'rnatilmagan edi — shuning uchun getCookie('csrfToken') doim `null`
  // qaytarardi va bu kod HECH QACHON ishlamas edi (o'lik kod). Bu esa
  // loyihada CSRF himoyasi bor degan noto'g'ri taassurot berardi.
  // Haqiqiy CSRF himoyasi autentifikatsiya cookie'lari (`token`,
  // `refreshToken`) uchun sozlangan `sameSite: "strict"` orqali ta'minlanadi
  // (qarang: src/routes/auth.ts / server.ts setAuthCookies) — bu zamonaviy
  // brauzerlarda cross-site so'rovlarni samarali bloklaydi.

  let response: Response;
  
  try {
    response = await originalFetch(input, options);
  } catch (err) {
    // Network error occurred
    console.error("Fetch network error:", err);
    // Return 0 status to indicate network error
    return new Response(
      JSON.stringify({ error: "Tarmoq xatosi" }),
      { status: 0, statusText: 'Network Error' }
    );
  }

  // Check if this is a retry attempt
  const isRefreshEndpoint = String(input).includes('/api/auth/refresh');
  const isLoginEndpoint = String(input).includes('/api/auth/login');
  const isRetryAttempt = (options as any)._retryAttempt || 0;

  // MUHIM (72-band, KATTA MUAMMO): 5xx uchun "qayta urinish" xuddi shu so'rov
  // tanasi bilan qayta yuboriladi — GET uchun xavfsiz, lekin POST/PUT/PATCH/
  // DELETE (masalan CheckoutPage'dagi to'lov yaratish, SellPage'dagi e'lon
  // joylash) uchun xavfli edi: agar server mutatsiyani muvaffaqiyatli
  // bajarib, javobni yuborishda (masalan proxy timeout) 5xx qaytarsa,
  // avtomatik qayta urinish IKKINCHI marta bir xil to'lov/e'lon yaratib
  // qo'yishi mumkin edi. Endi 5xx qayta urinish faqat xavfsiz (GET/HEAD)
  // metodlar uchun ishlaydi; 401 uchun (mutatsiyadan OLDIN, auth
  // middleware'da to'xtaydi, shuning uchun xavfsiz) hammasi uchun qoladi.
  const method = (options.method || 'GET').toUpperCase();
  const isSafeMethodFor5xxRetry = method === 'GET' || method === 'HEAD';

  // Retry on 401 or 5xx errors (but not network errors)
  // MUHIM (regressiya tuzatildi): ilgari 5xx server xatolari ham 401 bilan bir
  // xil token-refresh yo'lidan o'tar edi — mehmon yoki eskirgan seansda
  // muvaffaqiyatsiz refresh, umuman aloqasi yo'q 5xx xato uchun ham foydalanuvchini
  // majburan chiqarib yuborardi (logout). Endi faqat 401 refresh/logout yo'lini
  // ishga tushiradi, 5xx esa refreshsiz oddiy qayta urinish (retry) qiladi.
  if (
    (response.status === 401 || (response.status >= 500 && isSafeMethodFor5xxRetry)) &&
    isRetryAttempt < 1 &&
    !isRefreshEndpoint &&
    !isLoginEndpoint
  ) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000 * (isRetryAttempt + 1)));

      const shouldRetry = response.status === 401 ? await performTokenRefresh() : true;

      if (shouldRetry) {
        const retryOptions = {
          ...options,
          _retryAttempt: isRetryAttempt + 1
        };
        
        try {
          response = await originalFetch(input, retryOptions);
        } catch (retryErr) {
          console.error("Retry fetch failed:", retryErr);
          return response; // Return original error response
        }
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
    }
  }

  return response;
}

// Intercept window.fetch globally so any standard fetch call uses our credentials and CSRF setup
// window.fetch = apiFetch;


