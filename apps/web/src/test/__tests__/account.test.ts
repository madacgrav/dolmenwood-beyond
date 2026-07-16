import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import type { AccountDoc } from '@/lib/cosmos/types';

import { store, resetFake } from '@/test/cosmos-fake';

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));
import {
  createAccount,
  verifyPassword,
  setPassword,
  fetchAccount,
  deleteAccount,
} from '@/lib/data/account';

beforeEach(() => resetFake());

describe('createAccount', () => {
  it('creates an account with a bcrypt-verifiable hash and 6-char invite code', async () => {
    const doc = await createAccount({ email: 'Test@Example.com', password: 'hunter2boat' });
    expect(doc.email).toBe('test@example.com'); // normalized
    expect(doc.inviteCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(doc.displayName).toBe('test'); // defaults to email local part
    expect(doc.isAdmin).toBe(false);
    expect(doc.requiresPasswordReset).toBe(false);
    expect(await bcrypt.compare('hunter2boat', doc.passwordHash!)).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    await createAccount({ email: 'dup@example.com', password: 'password1' });
    await expect(
      createAccount({ email: 'DUP@example.com', password: 'password2' }),
    ).rejects.toThrow(/already exists/);
  });

  it('generates unique invite codes across accounts', async () => {
    const a = await createAccount({ email: 'a@example.com', password: 'password1' });
    const b = await createAccount({ email: 'b@example.com', password: 'password1' });
    expect(a.inviteCode).not.toBe(b.inviteCode);
  });
});

describe('verifyPassword', () => {
  it('never matches an account with a null hash (migrated, forced reset)', async () => {
    const doc = { passwordHash: null } as AccountDoc;
    expect(await verifyPassword(doc, 'anything')).toBe(false);
  });

  it('accepts the right password and rejects the wrong one', async () => {
    const doc = await createAccount({ email: 'v@example.com', password: 'correcthorse' });
    expect(await verifyPassword(doc, 'correcthorse')).toBe(true);
    expect(await verifyPassword(doc, 'wronghorse')).toBe(false);
  });
});

describe('setPassword', () => {
  it('sets a new hash and clears requiresPasswordReset', async () => {
    const doc = await createAccount({ email: 's@example.com', password: 'oldpassword' });
    store('accounts').set(doc.id, { ...doc, passwordHash: null, requiresPasswordReset: true });

    await setPassword(doc.id, 'newpassword1');
    const updated = store('accounts').get(doc.id) as unknown as AccountDoc;
    expect(updated.requiresPasswordReset).toBe(false);
    expect(await bcrypt.compare('newpassword1', updated.passwordHash!)).toBe(true);
  });
});

describe('fetchAccount / deleteAccount', () => {
  it('returns the narrow snake_case shape the settings UI consumes', async () => {
    const doc = await createAccount({ email: 'n@example.com', password: 'password1', displayName: 'Narrator' });
    const account = await fetchAccount(doc.id);
    expect(account).toEqual({
      id: doc.id,
      display_name: 'Narrator',
      email: 'n@example.com',
      invite_code: doc.inviteCode,
      phone: null,
      email_opt_in: true,
      sms_opt_in: false,
      whatsapp_opt_in: false,
    });
  });

  it('cascades: deletes the account plus its characters and notifications', async () => {
    const doc = await createAccount({ email: 'd@example.com', password: 'password1' });
    store('characters').set('char-1', { id: 'char-1', ownerId: doc.id });
    store('notifications').set('note-1', { id: 'note-1', accountId: doc.id });
    store('characters').set('char-2', { id: 'char-2', ownerId: 'someone-else' });

    await deleteAccount(doc.id);
    expect(store('accounts').has(doc.id)).toBe(false);
    expect(store('characters').has('char-1')).toBe(false);
    expect(store('notifications').has('note-1')).toBe(false);
    expect(store('characters').has('char-2')).toBe(true); // other owners untouched
  });
});
