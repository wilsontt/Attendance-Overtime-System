import { describe, expect, it } from 'vitest';

/** 與 service 相同的正規化規則（純函式測，不需 DB） */
function normalizeWorkLocationText(raw: string, maxLen = 40): string {
  return Array.from(raw.replace(/\r?\n/g, '').trim()).slice(0, maxLen).join('');
}

describe('workLocation normalize', () => {
  it('trims and caps at 40 chars', () => {
    expect(normalizeWorkLocationText('  台北辦公室  ')).toBe('台北辦公室');
    expect(normalizeWorkLocationText('甲'.repeat(50)).length).toBe(40);
  });

  it('strips newlines', () => {
    expect(normalizeWorkLocationText('A\nB\r\nC')).toBe('ABC');
  });
});
