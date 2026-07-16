import type {
  AccountDoc,
  BankLedgerEntryDoc,
  CampaignDoc,
  CharacterDoc,
  InventoryEntryDoc,
  LevelUpLogDoc,
  MountEntryDoc,
  NotificationDoc,
  PartyMountDoc,
  ProposalEntryDoc,
  RetainerEntryDoc,
  SessionEntryDoc,
  SpellPrepDoc,
  SpellSlotDoc,
} from '../../apps/web/src/lib/cosmos/types';

/**
 * Pure row → document transforms for the one-time Supabase → Cosmos
 * migration. Rows come in as pg result objects (snake_case, Date for
 * timestamptz); documents go out in the shapes the app already reads.
 */

type Row = Record<string, unknown>;

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : v ? String(v) : new Date(0).toISOString();

const isoOrNull = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

export function toAccountDoc(row: Row): AccountDoc {
  return {
    id: String(row.id),
    email: String(row.email).toLowerCase(),
    displayName: String(row.display_name ?? ''),
    inviteCode: String(row.invite_code ?? ''),
    isAdmin: Boolean(row.is_admin),
    phone: (row.phone as string | null) ?? null,
    emailOptIn: row.email_opt_in !== false,
    smsOptIn: Boolean(row.sms_opt_in),
    whatsappOptIn: Boolean(row.whatsapp_opt_in),
    whatsappConsentAt: isoOrNull(row.whatsapp_consent_at),
    // DECISION (design #8): credentials are not migrated — every account
    // goes through the Resend password-reset flow at cutover.
    passwordHash: null,
    requiresPasswordReset: true,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export interface CharacterRelatedRows {
  inventory: Row[]; // character_inventory
  spellSlots: Row[];
  spellPreparations: Row[];
  bankLedger: Row[];
  levelUpLogs: Row[];
  mounts: Row[]; // owner_type = 'character'
  retainers: Row[];
}

export function toCharacterDoc(row: Row, related: CharacterRelatedRows): CharacterDoc {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    sex: (row.sex as string | null) ?? null,
    age: (row.age as string | null) ?? null,
    height: (row.height as string | null) ?? null,
    weight: (row.weight as string | null) ?? null,
    kindred: String(row.kindred),
    characterClass: String(row.character_class),
    alignment: String(row.alignment),
    moonSign: (row.moon_sign as string | null) ?? null,
    background: (row.background as string | null) ?? null,
    level: Number(row.level) || 1,
    xp: Number(row.xp) || 0,
    abilityScores: row.ability_scores as CharacterDoc['abilityScores'],
    hpCurrent: Number(row.hp_current) || 0,
    hpMax: Number(row.hp_max) || 1,
    portraitUrl: (row.portrait_url as string | null) ?? null,
    isActive: row.is_active !== false,
    extraLanguages: (row.extra_languages as string[] | null) ?? [],
    notes: (row.notes as string | null) ?? null,
    sessionNotes: (row.session_notes as CharacterDoc['sessionNotes']) ?? [],
    peopleOfNote: (row.people_of_note as CharacterDoc['peopleOfNote']) ?? [],
    coinsGp: Number(row.coins_gp) || 0,
    coinsSp: Number(row.coins_sp) || 0,
    coinsCp: Number(row.coins_cp) || 0,
    inventory: related.inventory.map(toInventoryEntry),
    spellSlots: related.spellSlots.map(toSpellSlot),
    spellPreparations: related.spellPreparations.map(toSpellPrep),
    spellbook: [], // character_spells never existed (see phase 3b)
    bankLedger: related.bankLedger.map(toBankLedgerEntry),
    levelUpLogs: related.levelUpLogs.map(toLevelUpLog),
    mounts: related.mounts.map(toMountEntry),
    retainers: related.retainers.map(toRetainerEntry),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toInventoryEntry(row: Row): InventoryEntryDoc {
  return {
    id: String(row.id),
    itemName: String(row.item_name),
    itemType: String(row.item_type ?? 'gear'),
    quantity: Number(row.quantity) || 1,
    weightCoins: Number(row.weight_coins) || 0,
    notes: (row.notes as string | null) ?? null,
    location: (['equipped', 'stowed', 'tiny'] as const).includes(
      row.location as 'equipped' | 'stowed' | 'tiny',
    )
      ? (row.location as InventoryEntryDoc['location'])
      : 'stowed',
    weaponDamageDice: (row.weapon_damage_dice as string | null) ?? null,
    armorAcBonus: row.armor_ac_bonus == null ? null : Number(row.armor_ac_bonus),
    catalogItemId: (row.catalog_item_id as string | null) ?? null,
  };
}

export function toSpellSlot(row: Row): SpellSlotDoc {
  return {
    id: String(row.id),
    rank: Number(row.spell_rank),
    slotsTotal: Number(row.slots_total) || 0,
    slotsUsed: Number(row.slots_used) || 0,
  };
}

export function toSpellPrep(row: Row): SpellPrepDoc {
  return {
    id: String(row.id),
    slotRank: Number(row.slot_rank),
    spellName: String(row.spell_name),
    isCast: Boolean(row.is_cast),
    createdAt: iso(row.created_at),
  };
}

export function toBankLedgerEntry(row: Row): BankLedgerEntryDoc {
  return {
    id: String(row.id),
    amountGp: Number(row.amount_gp),
    description: String(row.description ?? ''),
    performedBy: String(row.performed_by),
    createdAt: iso(row.created_at),
  };
}

export function toLevelUpLog(row: Row): LevelUpLogDoc {
  return {
    id: String(row.id),
    fromLevel: Number(row.from_level),
    toLevel: Number(row.to_level),
    timestamp: iso(row.timestamp),
    changes: (row.changes as LevelUpLogDoc['changes']) ?? [],
    hpRoll: Number(row.hp_roll) || 0,
    hpRollFinal: Number(row.hp_roll_final) || 0,
  };
}

export function toMountEntry(row: Row): MountEntryDoc {
  return {
    id: String(row.id),
    name: String(row.name),
    mountType: String(row.mount_type),
    speed: Number(row.speed) || 0,
    hasFullStats: Boolean(row.has_full_stats),
    ac: row.ac == null ? null : Number(row.ac),
    hpCurrent: row.hp_current == null ? null : Number(row.hp_current),
    hpMax: row.hp_max == null ? null : Number(row.hp_max),
    attackBonus: row.attack_bonus == null ? null : Number(row.attack_bonus),
    morale: row.morale == null ? null : Number(row.morale),
    createdAt: iso(row.created_at),
  };
}

export function toRetainerEntry(row: Row): RetainerEntryDoc {
  return {
    id: String(row.id),
    name: String(row.name),
    kindred: String(row.kindred),
    characterClass: String(row.character_class),
    level: Number(row.level) || 1,
    ac: Number(row.ac) || 10,
    hpCurrent: Number(row.hp_current) || 1,
    hpMax: Number(row.hp_max) || 1,
    attackBonus: Number(row.attack_bonus) || 0,
    morale: Number(row.morale) || 7,
    loyalty: Number(row.loyalty) || 7,
    wageType: row.wage_type === 'share' ? 'share' : 'daily',
    wageAmount: Number(row.wage_amount) || 0,
    isPromotedToPc: Boolean(row.is_promoted_to_pc),
    createdAt: iso(row.created_at),
  };
}

export interface CampaignRelatedRows {
  members: Row[]; // campaign_members
  sessions: Row[]; // campaign_sessions
  rsvps: Row[]; // session_rsvps (all; filtered per session)
  proposals: Row[]; // date_proposals
  availability: Row[]; // proposal_availability (all; filtered per proposal)
  partyMounts: Row[]; // mounts owner_type = 'party'
}

export function toCampaignDoc(row: Row, related: CampaignRelatedRows): CampaignDoc {
  const sessions: SessionEntryDoc[] = related.sessions.map((s) => ({
    id: String(s.id),
    title: String(s.title),
    scheduledAt: iso(s.scheduled_at),
    notes: String(s.notes ?? ''),
    createdBy: String(s.created_by),
    rsvps: related.rsvps
      .filter((r) => String(r.session_id) === String(s.id))
      .map((r) => ({
        accountId: String(r.account_id),
        status: (['yes', 'no', 'maybe'] as const).includes(r.status as 'yes' | 'no' | 'maybe')
          ? (r.status as 'yes' | 'no' | 'maybe')
          : 'maybe',
        updatedAt: iso(r.updated_at),
      })),
    createdAt: iso(s.created_at),
  }));

  const proposals: ProposalEntryDoc[] = related.proposals.map((p) => ({
    id: String(p.id),
    title: String(p.title),
    scheduledAt: iso(p.scheduled_at),
    notes: String(p.notes ?? ''),
    status: (['open', 'confirmed', 'cancelled'] as const).includes(
      p.status as 'open' | 'confirmed' | 'cancelled',
    )
      ? (p.status as ProposalEntryDoc['status'])
      : 'open',
    confirmedSessionId: (p.confirmed_session_id as string | null) ?? null,
    createdBy: String(p.created_by),
    availability: related.availability
      .filter((a) => String(a.proposal_id) === String(p.id))
      .map((a) => ({
        accountId: String(a.account_id),
        available: Boolean(a.available),
        updatedAt: iso(a.updated_at),
      })),
    createdAt: iso(p.created_at),
  }));

  const partyMounts: PartyMountDoc[] = related.partyMounts.map((m) => ({
    id: String(m.id),
    name: String(m.name),
    mountType: String(m.mount_type),
    speed: Number(m.speed) || 0,
    addedBy: String(m.owner_id),
    createdAt: iso(m.created_at),
  }));

  return {
    id: String(row.id),
    name: String(row.name),
    refereeId: String(row.referee_id),
    inviteCode: String(row.invite_code),
    members: related.members.map((m) => ({
      accountId: String(m.account_id),
      joinedAt: iso(m.joined_at),
    })),
    partyMounts,
    sessions,
    proposals,
    createdAt: iso(row.created_at),
  };
}

export function toNotificationDoc(row: Row, deliveries: Row[]): NotificationDoc {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    campaignId: (row.campaign_id as string | null) ?? null,
    kind: String(row.kind),
    body: String(row.body),
    relatedSessionId: (row.related_session_id as string | null) ?? null,
    read: Boolean(row.read),
    deliveries: deliveries.map((d) => ({
      channel: d.channel as 'email' | 'sms' | 'whatsapp',
      status: d.status as 'pending' | 'sent' | 'failed',
      sentAt: isoOrNull(d.sent_at),
      error: (d.error as string | null) ?? null,
      attempts: Number(d.attempts) || 0,
    })),
    createdAt: iso(row.created_at),
  };
}
