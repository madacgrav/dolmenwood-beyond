// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  toAccountDoc,
  toCharacterDoc,
  toCampaignDoc,
  toNotificationDoc,
} from '../../../../../scripts/lib/transform';

const T1 = new Date('2026-05-01T12:00:00Z');
const T2 = new Date('2026-06-15T08:30:00Z');

describe('toAccountDoc', () => {
  it('maps the account row and forces the password reset', () => {
    const doc = toAccountDoc({
      id: 'a-1', email: 'Alice@Example.com', role: 'referee', display_name: 'Alice',
      invite_code: 'ABC123', is_admin: true, phone: '+15551234567',
      email_opt_in: true, sms_opt_in: false, whatsapp_opt_in: true,
      whatsapp_consent_at: T1, created_at: T1, updated_at: T2,
    });
    expect(doc).toMatchObject({
      id: 'a-1',
      email: 'alice@example.com', // normalized for the Auth.js lookup
      displayName: 'Alice',
      inviteCode: 'ABC123',
      isAdmin: true,
      whatsappOptIn: true,
      whatsappConsentAt: T1.toISOString(),
      passwordHash: null,
      requiresPasswordReset: true,
      createdAt: T1.toISOString(),
      updatedAt: T2.toISOString(),
    });
  });
});

describe('toCharacterDoc', () => {
  it('assembles the full aggregate with embedded arrays', () => {
    const doc = toCharacterDoc(
      {
        id: 'c-1', owner_id: 'a-1', name: 'Aldric', sex: null, age: '32',
        height: null, weight: null, kindred: 'Human', character_class: 'Fighter',
        alignment: 'lawful', moon_sign: 'Fox', background: 'Soldier',
        level: 3, xp: 4200, ability_scores: { str: 13, int: 9, wis: 10, dex: 12, con: 14, cha: 8 },
        hp_current: 11, hp_max: 18, portrait_url: 'https://x.supabase.co/p.png',
        is_active: true, extra_languages: ['Woldish'], notes: 'gruff',
        session_notes: [{ id: 's1' }], people_of_note: [],
        coins_gp: 42, coins_sp: 7, coins_cp: 0, created_at: T1, updated_at: T2,
      },
      {
        inventory: [{
          id: 'i-1', item_name: 'Longsword', item_type: 'weapon', quantity: 1,
          weight_coins: 30, notes: null, location: 'equipped',
          weapon_damage_dice: '1d8', armor_ac_bonus: null, catalog_item_id: 'cat-9',
        }],
        spellSlots: [{ id: 'ss-1', spell_rank: 1, slots_total: 2, slots_used: 1 }],
        spellPreparations: [{ id: 'sp-1', slot_rank: 1, spell_name: 'Sleep', is_cast: false, created_at: T1 }],
        bankLedger: [{ id: 'b-1', amount_gp: 40, description: 'dep', performed_by: 'a-1', created_at: T1 }],
        levelUpLogs: [{ id: 'l-1', from_level: 2, to_level: 3, timestamp: T2, changes: [{ field: 'hp', oldValue: 1, newValue: 2 }], hp_roll: 6, hp_roll_final: 8 }],
        mounts: [{ id: 'm-1', name: 'Bess', mount_type: 'Horse', speed: 40, has_full_stats: false, ac: null, hp_current: null, hp_max: null, attack_bonus: null, morale: null, created_at: T1 }],
        retainers: [{ id: 'r-1', name: 'Wilfred', kindred: 'Human', character_class: 'Fighter', level: 1, ac: 11, hp_current: 4, hp_max: 4, attack_bonus: 0, morale: 7, loyalty: 7, wage_type: 'daily', wage_amount: 1, is_promoted_to_pc: false, created_at: T1 }],
      },
    );
    expect(doc.ownerId).toBe('a-1');
    expect(doc.coinsGp).toBe(42);
    expect(doc.inventory![0]).toMatchObject({ itemName: 'Longsword', location: 'equipped', catalogItemId: 'cat-9' });
    expect(doc.spellSlots![0]).toMatchObject({ rank: 1, slotsTotal: 2, slotsUsed: 1 });
    expect(doc.spellPreparations![0]).toMatchObject({ spellName: 'Sleep', isCast: false });
    expect(doc.bankLedger![0]).toMatchObject({ amountGp: 40, performedBy: 'a-1' });
    expect(doc.levelUpLogs![0]).toMatchObject({ fromLevel: 2, toLevel: 3, hpRollFinal: 8 });
    expect(doc.mounts![0]).toMatchObject({ name: 'Bess', hasFullStats: false, ac: null });
    expect(doc.retainers![0]).toMatchObject({ name: 'Wilfred', isPromotedToPc: false, wageType: 'daily' });
    expect(doc.spellbook).toEqual([]);
  });

  it('coerces an unknown inventory location to stowed', () => {
    const doc = toCharacterDoc(
      { id: 'c', owner_id: 'a', name: 'X', kindred: 'Human', character_class: 'Thief',
        alignment: 'neutral', level: 1, xp: 0, ability_scores: {}, hp_current: 1, hp_max: 1,
        created_at: T1, updated_at: T1 },
      { inventory: [{ id: 'i', item_name: 'Rope', item_type: 'gear', quantity: 1, weight_coins: 0, location: 'backpack', created_at: T1 }],
        spellSlots: [], spellPreparations: [], bankLedger: [], levelUpLogs: [], mounts: [], retainers: [] },
    );
    expect(doc.inventory![0]!.location).toBe('stowed');
  });
});

describe('toCampaignDoc', () => {
  it('nests members, sessions+rsvps, proposals+availability, and party mounts', () => {
    const doc = toCampaignDoc(
      { id: 'camp-1', name: 'Abbey', referee_id: 'ref-1', invite_code: 'ZZZ999', created_at: T1 },
      {
        members: [{ campaign_id: 'camp-1', account_id: 'a-1', joined_at: T1 }],
        sessions: [{ id: 'sess-1', campaign_id: 'camp-1', title: 'S0', scheduled_at: T2, notes: '', created_by: 'a-1', created_at: T1 }],
        rsvps: [
          { session_id: 'sess-1', account_id: 'a-1', status: 'yes', updated_at: T2 },
          { session_id: 'other', account_id: 'a-1', status: 'no', updated_at: T2 },
        ],
        proposals: [{ id: 'prop-1', campaign_id: 'camp-1', title: 'Friday?', scheduled_at: T2, notes: '', status: 'confirmed', confirmed_session_id: 'sess-1', created_by: 'a-1', created_at: T1 }],
        availability: [
          { proposal_id: 'prop-1', account_id: 'a-1', available: true, updated_at: T2 },
          { proposal_id: 'nope', account_id: 'a-1', available: false, updated_at: T2 },
        ],
        partyMounts: [{ id: 'pm-1', owner_id: 'a-1', mount_type: 'Mule', name: 'Bess', speed: 30, created_at: T1 }],
      },
    );
    expect(doc.members).toEqual([{ accountId: 'a-1', joinedAt: T1.toISOString() }]);
    expect(doc.sessions![0]!.rsvps).toEqual([
      { accountId: 'a-1', status: 'yes', updatedAt: T2.toISOString() },
    ]); // rsvp for 'other' session filtered out
    expect(doc.proposals![0]).toMatchObject({ status: 'confirmed', confirmedSessionId: 'sess-1' });
    expect(doc.proposals![0]!.availability).toHaveLength(1); // 'nope' filtered
    expect(doc.partyMounts[0]).toMatchObject({ name: 'Bess', addedBy: 'a-1' });
  });
});

describe('toNotificationDoc', () => {
  it('embeds deliveries with their send status', () => {
    const doc = toNotificationDoc(
      { id: 'n-1', account_id: 'a-1', campaign_id: 'camp-1', kind: 'date_confirmed',
        body: 'Session confirmed: Friday?', related_session_id: 'sess-1', read: false, created_at: T1 },
      [{ notification_id: 'n-1', channel: 'email', status: 'sent', sent_at: T2, error: null, attempts: 1 }],
    );
    expect(doc).toMatchObject({
      accountId: 'a-1',
      kind: 'date_confirmed',
      relatedSessionId: 'sess-1',
      read: false,
    });
    expect(doc.deliveries[0]).toEqual({
      channel: 'email', status: 'sent', sentAt: T2.toISOString(), error: null, attempts: 1,
    });
  });
});
