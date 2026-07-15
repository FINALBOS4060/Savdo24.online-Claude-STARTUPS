// Global Fetch Interceptor to add Authorization header and handle auto-token-refresh on 401
const originalFetch = window.fetch;

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('savdo24_token');
  let options = init || {};
  if (token) {
    options.headers = options.headers || {};
    if (!(options.headers instanceof Headers)) {
      if (Array.isArray(options.headers)) {
        // Skip
      } else {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        };
      }
    } else {
      options.headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let response = await originalFetch(input, options);

  if (response.status === 401 && !String(input).includes('/api/auth/refresh') && !String(input).includes('/api/auth/login')) {
    const refreshToken = localStorage.getItem('savdo24_refresh_token');
    if (refreshToken) {
      try {
        const refreshResponse = await originalFetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          const newToken = refreshData.accessToken;
          const newRefreshToken = refreshData.refreshToken;

          localStorage.setItem('savdo24_token', newToken);
          if (newRefreshToken) {
            localStorage.setItem('savdo24_refresh_token', newRefreshToken);
          }

          // Dispatch event to sync react state
          window.dispatchEvent(new CustomEvent('savdo24_auth_change', { detail: { token: newToken } }));

          // Retry
          if (options.headers && !Array.isArray(options.headers) && !(options.headers instanceof Headers)) {
            (options.headers as any)['Authorization'] = `Bearer ${newToken}`;
          } else if (options.headers instanceof Headers) {
            options.headers.set('Authorization', `Bearer ${newToken}`);
          }
          response = await originalFetch(input, options);
        } else {
          // Refresh failed
          localStorage.removeItem('savdo24_token');
          localStorage.removeItem('savdo24_refresh_token');
          localStorage.removeItem('savdo24_user');
          window.dispatchEvent(new CustomEvent('savdo24_auth_change', { detail: { token: null, logout: true } }));
        }
      } catch (err) {
        console.error("Token refresh failed:", err);
      }
    }
  }

  return response;
}
