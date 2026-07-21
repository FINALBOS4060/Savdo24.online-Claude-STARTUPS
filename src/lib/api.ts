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

  // Check if this is a retry attempt
  const isRefreshEndpoint = String(input).includes('/api/auth/refresh');
  const isLoginEndpoint = String(input).includes('/api/auth/login');
  const isRetryAttempt = (options as any)._retryAttempt || 0;

  // Only retry if: 401, not auth endpoint, and haven't retried yet
  if (response.status === 401 && isRetryAttempt < 1 && !isRefreshEndpoint && !isLoginEndpoint) {
    try {
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * (isRetryAttempt + 1)));

      const refreshResponse = await originalFetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        window.dispatchEvent(new CustomEvent('savdo24_auth_change', {
          detail: { token: refreshData.accessToken || 'cookie_authenticated' }
        }));

        // Retry original request with marked attempt
        const retryOptions = {
          ...options,
          _retryAttempt: isRetryAttempt + 1
        };
        response = await originalFetch(input, retryOptions);
      } else {
        // Refresh failed - logout
        window.dispatchEvent(new CustomEvent('savdo24_auth_change', {
          detail: { token: null, logout: true }
        }));
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      window.dispatchEvent(new CustomEvent('savdo24_auth_change', {
        detail: { token: null, logout: true }
      }));
    }
  }

  return response;
}

// Intercept window.fetch globally so any standard fetch call uses our credentials and CSRF setup
// window.fetch = apiFetch;


