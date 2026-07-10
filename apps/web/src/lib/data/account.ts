import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getContainer } from '@/lib/cosmos/client';
import type { AccountDoc } from '@/lib/cosmos/types';

/**
 * Single source of truth for account documents and account-level data
 * operations. Server-only: every function runs against Cosmos with the
 * caller's identity resolved by the route/session layer — never pass
 * ids taken from the client where the session should be authoritative.
 *
 * The narrow snake_case `Account` shape is what the settings UI consumes
 * (kept from the Supabase era to avoid churn in the components).
 */

export type Account = {
  id: string;
  display_name: string;
  email: string;
  role: string;
  invite_code: string;
  phone: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
};

export interface SignUpInput {
  email: string;
  password: string;
  role: 'player' | 'referee';
  displayName?: string;
}

const accounts = () => getContainer('accounts');

function docToAccount(doc: AccountDoc): Account {
  return {
    id: doc.id,
    display_name: doc.displayName,
    email: doc.email,
    role: doc.role,
    invite_code: doc.inviteCode,
    phone: doc.phone,
    email_opt_in: doc.emailOptIn,
    sms_opt_in: doc.smsOptIn,
    whatsapp_opt_in: doc.whatsappOptIn,
  };
}

export async function fetchAccountDoc(accountId: string): Promise<AccountDoc | null> {
  try {
    const { resource } = await accounts().item(accountId, accountId).read<AccountDoc>();
    return resource ?? null;
  } catch {
    return null;
  }
}

export async function fetchAccountDocByEmail(email: string): Promise<AccountDoc | null> {
  const { resources } = await accounts()
    .items.query<AccountDoc>({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email.trim().toLowerCase() }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

export async function fetchAccount(accountId: string): Promise<Account | null> {
  const doc = await fetchAccountDoc(accountId);
  return doc ? docToAccount(doc) : null;
}

// Port of generate_account_invite_code() (migration 20260425000004): random
// 6-char code, retry on collision, give up after 20 attempts.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = randomBytes(6);
    let code = '';
    for (const byte of bytes) code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
    const { resources } = await accounts()
      .items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.inviteCode = @code',
        parameters: [{ name: '@code', value: code }],
      })
      .fetchAll();
    if (resources[0] === 0) return code;
  }
  throw new Error('could not generate a unique invite code');
}

/**
 * Port of the handle_new_user() trigger: creates the account document at
 * sign-up (default role, generated invite code, display name defaulting to
 * the email local part).
 */
export async function createAccount(input: SignUpInput): Promise<AccountDoc> {
  const email = input.email.trim().toLowerCase();
  if (await fetchAccountDocByEmail(email)) {
    throw new Error('an account with this email already exists');
  }
  const now = new Date().toISOString();
  const doc: AccountDoc = {
    id: crypto.randomUUID(),
    email,
    role: input.role === 'referee' ? 'referee' : 'player',
    displayName: input.displayName?.trim() || (email.split('@')[0] ?? email),
    inviteCode: await generateInviteCode(),
    isAdmin: false,
    phone: null,
    emailOptIn: true,
    smsOptIn: false,
    whatsappOptIn: false,
    whatsappConsentAt: null,
    passwordHash: await bcrypt.hash(input.password, 10),
    requiresPasswordReset: false,
    createdAt: now,
    updatedAt: now,
  };
  await accounts().items.create(doc);
  return doc;
}

/** Verify a password against a stored account. Null hash (migrated account) never matches. */
export async function verifyPassword(doc: AccountDoc, password: string): Promise<boolean> {
  if (!doc.passwordHash) return false;
  return bcrypt.compare(password, doc.passwordHash);
}

/** Set a new password (also completes the forced-reset flow for migrated accounts). */
export async function setPassword(accountId: string, password: string): Promise<void> {
  const doc = await fetchAccountDoc(accountId);
  if (!doc) throw new Error('account not found');
  doc.passwordHash = await bcrypt.hash(password, 10);
  doc.requiresPasswordReset = false;
  doc.updatedAt = new Date().toISOString();
  await accounts().item(doc.id, doc.id).replace(doc);
}

export async function updateDisplayName(accountId: string, displayName: string): Promise<void> {
  const doc = await fetchAccountDoc(accountId);
  if (!doc) throw new Error('account not found');
  doc.displayName = displayName;
  doc.updatedAt = new Date().toISOString();
  await accounts().item(doc.id, doc.id).replace(doc);
}

export async function updateNotificationPrefs(
  accountId: string,
  prefs: { phone?: string | null; email_opt_in?: boolean; sms_opt_in?: boolean; whatsapp_opt_in?: boolean },
): Promise<void> {
  const doc = await fetchAccountDoc(accountId);
  if (!doc) throw new Error('account not found');
  if (prefs.phone !== undefined) doc.phone = prefs.phone;
  if (prefs.email_opt_in !== undefined) doc.emailOptIn = prefs.email_opt_in;
  if (prefs.sms_opt_in !== undefined) doc.smsOptIn = prefs.sms_opt_in;
  if (prefs.whatsapp_opt_in !== undefined) doc.whatsappOptIn = prefs.whatsapp_opt_in;
  // Enabling WhatsApp is an explicit consent event — timestamp it.
  if (prefs.whatsapp_opt_in === true) doc.whatsappConsentAt = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
  await accounts().item(doc.id, doc.id).replace(doc);
}

/**
 * Port of delete_my_account(): the FK cascade becomes explicit deletes —
 * the account's characters, notifications, campaigns it referees, and its
 * membership entries in other campaigns all go with it.
 */
export async function deleteAccount(accountId: string): Promise<void> {
  const campaigns = getContainer('campaigns');
  const { resources: refereed } = await campaigns
    .items.query<{ id: string }>({
      query: 'SELECT c.id FROM c WHERE c.refereeId = @id',
      parameters: [{ name: '@id', value: accountId }],
    })
    .fetchAll();
  for (const c of refereed) await campaigns.item(c.id, c.id).delete();

  const { resources: memberOf } = await campaigns
    .items.query<{ id: string; members: { accountId: string; joinedAt: string }[] }>({
      query:
        'SELECT c.id, c.members FROM c WHERE EXISTS (SELECT VALUE m FROM m IN c.members WHERE m.accountId = @id)',
      parameters: [{ name: '@id', value: accountId }],
    })
    .fetchAll();
  for (const c of memberOf) {
    const { resource: doc } = await campaigns.item(c.id, c.id).read<Record<string, unknown>>();
    if (!doc) continue;
    doc.members = (doc.members as { accountId: string }[]).filter(
      (m) => m.accountId !== accountId,
    );
    await campaigns.item(c.id, c.id).replace(doc);
  }

  const characters = getContainer('characters');
  const { resources: chars } = await characters
    .items.query<{ id: string }>({
      query: 'SELECT c.id FROM c WHERE c.ownerId = @id',
      parameters: [{ name: '@id', value: accountId }],
    })
    .fetchAll();
  for (const c of chars) await characters.item(c.id, accountId).delete();

  const notifications = getContainer('notifications');
  const { resources: notes } = await notifications
    .items.query<{ id: string }>({
      query: 'SELECT c.id FROM c WHERE c.accountId = @id',
      parameters: [{ name: '@id', value: accountId }],
    })
    .fetchAll();
  for (const n of notes) await notifications.item(n.id, accountId).delete();

  await accounts().item(accountId, accountId).delete();
}
