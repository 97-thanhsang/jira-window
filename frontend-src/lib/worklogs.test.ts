import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorklogs, saveWorklog, type WorklogEntry } from './worklogs';

const STORAGE_KEY = 'recent_worklogs';

const entry = (issueKey: string): WorklogEntry => ({
  issueKey,
  summary: `summary of ${issueKey}`,
  timeSpent: '1h',
  date: '2026-03-10',
  comment: '',
});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('getWorklogs', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(getWorklogs()).toEqual([]);
  });

  it('returns an empty list when the stored value is not valid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    expect(getWorklogs()).toEqual([]);
  });

  it('returns an empty list when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(getWorklogs()).toEqual([]);
  });
});

describe('saveWorklog', () => {
  it('stores the entry so it can be read back', () => {
    saveWorklog(entry('ABC-1'));

    expect(getWorklogs()).toEqual([entry('ABC-1')]);
  });

  it('prepends new entries so the most recent comes first', () => {
    saveWorklog(entry('ABC-1'));
    saveWorklog(entry('ABC-2'));

    expect(getWorklogs().map(e => e.issueKey)).toEqual(['ABC-2', 'ABC-1']);
  });

  it('caps the history at 20 entries, dropping the oldest', () => {
    for (let i = 1; i <= 25; i++) saveWorklog(entry(`ABC-${i}`));

    const stored = getWorklogs();
    expect(stored).toHaveLength(20);
    expect(stored[0].issueKey).toBe('ABC-25');
    expect(stored.at(-1)?.issueKey).toBe('ABC-6');
  });

  it('leaves a corrupted store untouched instead of throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'garbage');

    expect(() => saveWorklog(entry('ABC-1'))).not.toThrow();

    // The parse failure aborts the write, so the corrupted value is kept as-is.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('garbage');
    expect(getWorklogs()).toEqual([]);
  });

  it('swallows localStorage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => saveWorklog(entry('ABC-1'))).not.toThrow();
  });
});
