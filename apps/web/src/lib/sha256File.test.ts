// @vitest-environment node
//
// Node muhitida ishlatiladi (jsdom emas) — jsdom Web Crypto SubtleCrypto'ni to'liq
// implement qilmaydi, Node 20+ esa global crypto.subtle/File'ni beradi.
import { describe, expect, it } from 'vitest';
import { sha256File } from './api';

describe('sha256File', () => {
  it('computes the correct SHA-256 hex digest of a file', async () => {
    const file = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
    const hash = await sha256File(file);
    // sha256("hello world") — ma'lum, barqaror test vektori
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(hash).toHaveLength(64);
  });

  it('produces different hashes for different content', async () => {
    const a = await sha256File(new File(['a'], 'a.txt'));
    const b = await sha256File(new File(['b'], 'b.txt'));
    expect(a).not.toBe(b);
  });
});
