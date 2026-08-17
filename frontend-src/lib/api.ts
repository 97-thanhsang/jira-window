import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function getAuthHeader(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('jira_auth') || '';
}

export const api = axios.create({
  baseURL: `${API_URL}/api/jira`,
});

// Generic backend client (không prefix /api/jira) — dùng cho OpenCode routes
export const apiBackend = axios.create({
  baseURL: API_URL,
});

apiBackend.interceptors.request.use((config) => {
  const auth = getAuthHeader();
  if (auth) {
    config.headers['X-Jira-Auth'] = auth;
  }
  return config;
});

api.interceptors.request.use((config) => {
  const auth = getAuthHeader();
  if (auth) {
    config.headers['X-Jira-Auth'] = auth;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('jira_auth');
      localStorage.removeItem('jira_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function saveAuth(username: string, password: string, user: object) {
  const encoded = btoa(`${username}:${password}`);
  localStorage.setItem('jira_auth', encoded);
  localStorage.setItem('jira_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('jira_auth');
  localStorage.removeItem('jira_user');
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('jira_user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated(): boolean {
  return !!getAuthHeader();
}
