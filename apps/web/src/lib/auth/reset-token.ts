import { SignJWT, jwtVerify } from 'jose';

/**
 * Signed, short-lived password-reset tokens (replaces Supabase's recovery
 * email flow). Reuses AUTH_SECRET so no extra key management is needed.
 */

const PURPOSE = 'password-reset';
const TTL = '1h';

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET must be set');
  return new TextEncoder().encode(s);
}

export async function createResetToken(accountId: string): Promise<string> {
  return new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

/** Returns the account id, or null if the token is invalid/expired. */
export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== PURPOSE || !payload.sub) return null;
    return payload.sub;
  } catch {
    return null;
  }
}
