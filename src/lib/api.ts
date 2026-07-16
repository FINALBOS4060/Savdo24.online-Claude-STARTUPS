// Global Fetch Interceptor to add CSRF header, handle credentials, and auto-token-refresh on 401
const originalFetch = window.fetch;

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let options = init || {};
  options.credentials = 'include'; // Send cookies with all requests
  
  // Set CSRF token header for state-changing requests
  const csrfToken = getCookie('csrfToken');
  const method = (options.method || 'GET').toUpperCase();
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    options.headers = options.headers || {};
    if (!(options.headers instanceof Headers)) {
      if (Array.isArray(options.headers)) {
        // Skip
      } else {
        options.headers = {
          ...options.headers,
          'x-csrf-token': csrfToken
        };
      }
    } else {
      options.headers.set('x-csrf-token', csrfToken);
    }
  }

  let response = await originalFetch(input, options);

  if (response.status === 401 && !String(input).includes('/api/auth/refresh') && !String(input).includes('/api/auth/login')) {
    try {
      const refreshResponse = await originalFetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });

      if (refreshResponse.ok) {
        // Dispatch event to sync react state
        window.dispatchEvent(new CustomEvent('savdo24_auth_change', { detail: { token: 'cookie_authenticated' } }));

        // Retry the original request
        response = await originalFetch(input, options);
      } else {
        // Refresh failed, notify logout
        window.dispatchEvent(new CustomEvent('savdo24_auth_change', { detail: { token: null, logout: true } }));
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
    }
  }

  return response;
}

// Intercept window.fetch globally so any standard fetch call uses our credentials and CSRF setup
window.fetch = apiFetch;


