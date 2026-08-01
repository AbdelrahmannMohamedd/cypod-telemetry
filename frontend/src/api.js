// cypod-telemetry
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Every request carries Accept-Language so the backend's error messages come back in
// whichever language the user currently has selected (spec: localized error messages).
async function request(path, { method = 'GET', token, locale = 'en', body } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept-Language': locale,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

export const api = {
  register: (email, password, locale) => request('/auth/register', { method: 'POST', locale, body: { email, password } }),
  login: (email, password, locale) => request('/auth/login', { method: 'POST', locale, body: { email, password } }),
  listDevices: (token, locale) => request('/devices', { token, locale }),
  getLatest: (deviceId, token, locale) => request(`/devices/${deviceId}/latest`, { token, locale }),
  getHistory: (deviceId, token, locale, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/devices/${deviceId}/history${qs ? `?${qs}` : ''}`, { token, locale });
  },
  listAlerts: (token, locale) => request('/alerts', { token, locale }),
};
