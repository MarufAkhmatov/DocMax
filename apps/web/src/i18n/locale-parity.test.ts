import { describe, expect, it } from 'vitest';
import uz from './locales/uz.json';
import ru from './locales/ru.json';
import en from './locales/en.json';

// CLAUDE.md 7-qoida — UI matnlar faqat lug'atda, uch tilda ham mos bo'lishi shart.
// Bu test uch fayl bir xil kalit to'plamiga ega ekanini tekshiradi (biri qolib ketsa aniqlaydi).

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n locale parity', () => {
  const uzKeys = flattenKeys(uz).sort();
  const ruKeys = flattenKeys(ru).sort();
  const enKeys = flattenKeys(en).sort();

  it('ru.json has the same keys as uz.json', () => {
    expect(ruKeys).toEqual(uzKeys);
  });

  it('en.json has the same keys as uz.json', () => {
    expect(enKeys).toEqual(uzKeys);
  });

  it('has a non-trivial number of keys (sanity check)', () => {
    expect(uzKeys.length).toBeGreaterThan(100);
  });
});
