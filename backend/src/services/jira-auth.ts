import crypto from 'crypto';
import axios from 'axios';
import { config } from '../config';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const successCache = new Map<string, number>();

function removeExpiredEntries(now: number): void {
  for (const [key, expiresAt] of successCache) {
    if (expiresAt <= now) {
      successCache.delete(key);
    }
  }
}

export async function verifyJiraAuth(authHeader: string): Promise<boolean> {
  const cacheKey = crypto.createHash('sha256').update(authHeader).digest('hex');
  const now = Date.now();
  const cachedExpiry = successCache.get(cacheKey);
  if (cachedExpiry && cachedExpiry > now) {
    return true;
  }
  if (cachedExpiry) {
    successCache.delete(cacheKey);
  }

  try {
    const response = await axios.get(`${config.jiraBaseUrl}/rest/api/2/myself`, {
      headers: { Authorization: `Basic ${authHeader}` },
      timeout: 8000,
    });
    if (response.status >= 200 && response.status < 300) {
      removeExpiredEntries(now);
      while (successCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = successCache.keys().next().value;
        if (!oldestKey) break;
        successCache.delete(oldestKey);
      }
      successCache.set(cacheKey, now + CACHE_TTL_MS);
      return true;
    }
    return false;
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status !== 401 && status !== 403) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[jira-auth] verification failed:', message);
    }
    return false;
  }
}
