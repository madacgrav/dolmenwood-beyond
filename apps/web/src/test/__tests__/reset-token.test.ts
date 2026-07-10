// @vitest-environment node
// (jose rejects jsdom's TextEncoder output — its Uint8Array comes from another realm)
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT } from 'jose';
import { createResetToken, verifyResetToken } from '@/lib/auth/reset-token';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-for-reset-tokens';
});

describe('password reset tokens', () => {
  it('round-trips: created token verifies back to the account id', async () => {
    const token = await createResetToken('account-123');
    expect(await verifyResetToken(token)).toBe('account-123');
  });

  it('rejects garbage and tokens signed with a different secret', async () => {
    expect(await verifyResetToken('not-a-token')).toBeNull();
    const forged = await new SignJWT({ purpose: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('account-123')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('wrong-secret'));
    expect(await verifyResetToken(forged)).toBeNull();
  });

  it('rejects tokens with the wrong purpose', async () => {
    const wrongPurpose = await new SignJWT({ purpose: 'something-else' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('account-123')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('test-secret-for-reset-tokens'));
    expect(await verifyResetToken(wrongPurpose)).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const expired = await new SignJWT({ purpose: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('account-123')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode('test-secret-for-reset-tokens'));
    expect(await verifyResetToken(expired)).toBeNull();
  });
});
