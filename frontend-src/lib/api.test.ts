import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  apiBackend,
  clearAuth,
  getAuthHeader,
  getStoredUser,
  isAuthenticated,
  saveAuth,
} from './api';

/** Replaces the axios adapter so requests never hit the network. */
function captureRequest(client: typeof api): { config?: InternalAxiosRequestConfig } {
  const captured: { config?: InternalAxiosRequestConfig } = {};
  const adapter: AxiosAdapter = async (config) => {
    captured.config = config as InternalAxiosRequestConfig;
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  client.defaults.adapter = adapter;
  return captured;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete api.defaults.adapter;
  delete apiBackend.defaults.adapter;
});

describe('auth storage helpers', () => {
  it('stores base64 credentials and the user object', () => {
    saveAuth('sang', 'secret', { name: 'sang', displayName: 'Sang' });

    expect(localStorage.getItem('jira_auth')).toBe(btoa('sang:secret'));
    expect(getStoredUser()).toEqual({ name: 'sang', displayName: 'Sang' });
    expect(getAuthHeader()).toBe(btoa('sang:secret'));
    expect(isAuthenticated()).toBe(true);
  });

  it('returns falsy values when nothing is stored', () => {
    expect(getAuthHeader()).toBe('');
    expect(getStoredUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('clears both auth entries', () => {
    saveAuth('sang', 'secret', { name: 'sang' });

    clearAuth();

    expect(localStorage.getItem('jira_auth')).toBeNull();
    expect(localStorage.getItem('jira_user')).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('overwrites previously stored credentials', () => {
    saveAuth('a', 'one', { name: 'a' });
    saveAuth('b', 'two', { name: 'b' });

    expect(getAuthHeader()).toBe(btoa('b:two'));
    expect(getStoredUser()).toEqual({ name: 'b' });
  });
});

describe('axios clients', () => {
  it('prefixes the jira client with /api/jira and leaves the backend client bare', () => {
    expect(api.defaults.baseURL).toBe('http://localhost:3001/api/jira');
    expect(apiBackend.defaults.baseURL).toBe('http://localhost:3001');
  });

  it.each([
    ['jira', () => api],
    ['backend', () => apiBackend],
  ])('injects the X-Jira-Auth header on the %s client when authenticated', async (_name, get) => {
    const client = get();
    const captured = captureRequest(client);
    saveAuth('sang', 'secret', {});

    await client.get('/anything');

    expect(captured.config?.headers['X-Jira-Auth']).toBe(btoa('sang:secret'));
  });

  it('omits the X-Jira-Auth header when not authenticated', async () => {
    const captured = captureRequest(api);

    await api.get('/anything');

    expect(captured.config?.headers['X-Jira-Auth']).toBeUndefined();
  });
});

describe('401 response interceptor', () => {
  it('clears stored auth and redirects to /login', async () => {
    saveAuth('sang', 'secret', {});
    const location = { href: '/board' };
    Object.defineProperty(window, 'location', { value: location, writable: true, configurable: true });
    api.defaults.adapter = async (config) =>
      Promise.reject(
        Object.assign(new Error('Unauthorized'), {
          response: { status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config },
        }),
      );

    await expect(api.get('/anything')).rejects.toThrowError('Unauthorized');

    expect(localStorage.getItem('jira_auth')).toBeNull();
    expect(localStorage.getItem('jira_user')).toBeNull();
    expect(location.href).toBe('/login');
  });

  it('leaves stored auth untouched for non-401 errors', async () => {
    saveAuth('sang', 'secret', {});
    api.defaults.adapter = async (config) =>
      Promise.reject(
        Object.assign(new Error('Server error'), {
          response: { status: 500, data: {}, statusText: 'Error', headers: {}, config },
        }),
      );

    await expect(api.get('/anything')).rejects.toThrowError('Server error');

    expect(localStorage.getItem('jira_auth')).toBe(btoa('sang:secret'));
  });
});
