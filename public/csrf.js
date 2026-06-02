(function () {
  const API_BASE = '/api';
  const CSRF_HEADER = 'X-CSRF-Token';
  const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  let csrfToken = null;

  function capture(response) {
    const token = response.headers.get(CSRF_HEADER);
    if (token) csrfToken = token;
    return token;
  }

  function isUnsafe(method) {
    return UNSAFE_METHODS.has(String(method || 'GET').toUpperCase());
  }

  async function ensureToken() {
    if (csrfToken) return csrfToken;
    const response = await fetch(`${API_BASE}/csrf-token`, { credentials: 'same-origin' });
    capture(response);
    if (!response.ok) {
      throw new Error('Unable to initialize CSRF protection.');
    }
    const body = await response.json().catch(() => ({}));
    csrfToken = csrfToken || body.csrfToken || null;
    return csrfToken;
  }

  async function apply(headers, options = {}) {
    if (!isUnsafe(options.method)) return headers;
    const token = await ensureToken();
    if (token) headers[CSRF_HEADER] = token;
    return headers;
  }

  window.TravelGlowCsrf = {
    apply,
    capture,
    ensureToken
  };
}());
