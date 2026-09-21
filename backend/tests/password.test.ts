import { describe, expect, it } from 'vitest';
import { hashSecret, verifySecret } from '../src/lib/password.js';

describe('password helpers', () => {
  it('hashes and verifies PIN', async () => {
    const hash = await hashSecret('1234');
    expect(hash).not.toBe('1234');
    expect(await verifySecret('1234', hash)).toBe(true);
    expect(await verifySecret('0000', hash)).toBe(false);
  });
});
