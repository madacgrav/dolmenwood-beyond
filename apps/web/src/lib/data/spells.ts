import { requireAccountId } from '@/lib/auth/session';
import { assertCharacterOwner, badRequest, notFound } from '@/lib/authz';
import type { CharacterDoc, SpellSlotDoc, SpellPrepDoc, SpellbookEntryDoc } from '@/lib/cosmos/types';
import type { DwDate } from '@dolmenwood/rules-engine';
import type { DBSpellSlot, DBPreparation, DBSpell, MagicData } from '@/lib/api/spells';
import { mutateOwnedCharacterDoc } from './characters';

/**
 * Server-only spell tracking: slots, preparations, and the spell book all
 * live as embedded arrays on the character doc. One read serves the whole
 * magic tab; mutations dispatch through applyMagicOp so the route stays a
 * thin shell over ETag-guarded document updates.
 *
 * (The spell book replaces the legacy `character_spells` table, which was
 * never created by any migration — the old queries silently returned [].)
 */

const slotToUi = (characterId: string, s: SpellSlotDoc): DBSpellSlot => ({
  id: s.id,
  character_id: characterId,
  spell_rank: s.rank,
  slots_total: s.slotsTotal,
  slots_used: s.slotsUsed,
});

const prepToUi = (characterId: string, p: SpellPrepDoc): DBPreparation => ({
  id: p.id,
  character_id: characterId,
  slot_rank: p.slotRank,
  spell_name: p.spellName,
  is_cast: p.isCast,
  created_at: p.createdAt,
});

const spellToUi = (characterId: string, s: SpellbookEntryDoc): DBSpell => ({
  id: s.id,
  character_id: characterId,
  spell_name: s.spellName,
  spell_level: s.spellLevel,
  is_memorized: s.isMemorized,
  notes: s.notes ?? undefined,
});

function magicDataOf(characterId: string, doc: CharacterDoc): MagicData {
  return {
    slots: [...(doc.spellSlots ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .map((s) => slotToUi(characterId, s)),
    preparations: [...(doc.spellPreparations ?? [])]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((p) => prepToUi(characterId, p)),
    spells: [...(doc.spellbook ?? [])]
      .sort((a, b) => a.spellLevel - b.spellLevel)
      .map((s) => spellToUi(characterId, s)),
  };
}

export async function fetchMagicData(characterId: string): Promise<MagicData> {
  const me = await requireAccountId();
  return magicDataOf(characterId, await assertCharacterOwner(me, characterId));
}

export type MagicOp =
  | { op: 'initSlots'; slots: { spell_rank: number; slots_total: number; slots_used?: number }[] }
  | { op: 'updateSlotTotals'; slotId: string; slots_total: number; slots_used: number }
  | { op: 'updateSlotUsage'; slotId: string; slots_used: number }
  | { op: 'rest'; restDate?: DwDate }
  | { op: 'addPreparation'; slot_rank: number; spell_name: string }
  | { op: 'setPreparationCast'; prepId: string; is_cast: boolean }
  | { op: 'addSpell'; spell_name: string; spell_level: number; is_memorized?: boolean; notes?: string | null }
  | { op: 'setSpellMemorized'; spellId: string; is_memorized: boolean }
  | { op: 'deleteSpell'; spellId: string };

export async function applyMagicOp(characterId: string, op: MagicOp): Promise<unknown> {
  let result: unknown = { ok: true };

  await mutateOwnedCharacterDoc(characterId, (doc) => {
    switch (op.op) {
      case 'initSlots': {
        if ((doc.spellSlots ?? []).length > 0) {
          // Another tab already initialised — old code hit a 23505 here.
          result = {
            alreadyInitialized: true,
            slots: (doc.spellSlots ?? []).map((s) => slotToUi(characterId, s)),
          };
          return;
        }
        doc.spellSlots = op.slots.map((s) => ({
          id: crypto.randomUUID(),
          rank: Number(s.spell_rank),
          slotsTotal: Math.max(0, Number(s.slots_total) || 0),
          slotsUsed: Math.max(0, Number(s.slots_used) || 0),
        }));
        result = { slots: doc.spellSlots.map((s) => slotToUi(characterId, s)) };
        return;
      }
      case 'updateSlotTotals': {
        const slot = (doc.spellSlots ?? []).find((s) => s.id === op.slotId);
        if (!slot) throw notFound('spell slot');
        slot.slotsTotal = Math.max(0, Number(op.slots_total) || 0);
        slot.slotsUsed = Math.min(Math.max(0, Number(op.slots_used) || 0), slot.slotsTotal);
        return;
      }
      case 'updateSlotUsage': {
        const slot = (doc.spellSlots ?? []).find((s) => s.id === op.slotId);
        if (!slot) throw notFound('spell slot');
        slot.slotsUsed = Math.min(Math.max(0, Number(op.slots_used) || 0), slot.slotsTotal);
        return;
      }
      case 'rest': {
        doc.spellPreparations = [];
        doc.spellSlots = (doc.spellSlots ?? []).map((s) => ({ ...s, slotsUsed: 0 }));
        if (op.restDate) doc.lastRestDate = op.restDate;
        return;
      }
      case 'addPreparation': {
        const name = String(op.spell_name ?? '').trim();
        if (!name) throw badRequest('spell_name is required');
        const prep: SpellPrepDoc = {
          id: crypto.randomUUID(),
          slotRank: Number(op.slot_rank),
          spellName: name,
          isCast: false,
          createdAt: new Date().toISOString(),
        };
        doc.spellPreparations = [...(doc.spellPreparations ?? []), prep];
        result = prepToUi(characterId, prep);
        return;
      }
      case 'setPreparationCast': {
        const prep = (doc.spellPreparations ?? []).find((p) => p.id === op.prepId);
        if (!prep) throw notFound('preparation');
        prep.isCast = Boolean(op.is_cast);
        return;
      }
      case 'addSpell': {
        const name = String(op.spell_name ?? '').trim();
        if (!name) throw badRequest('spell_name is required');
        const spell: SpellbookEntryDoc = {
          id: crypto.randomUUID(),
          spellName: name,
          spellLevel: Number(op.spell_level) || 0,
          isMemorized: Boolean(op.is_memorized),
          notes: op.notes ?? null,
        };
        doc.spellbook = [...(doc.spellbook ?? []), spell];
        result = spellToUi(characterId, spell);
        return;
      }
      case 'setSpellMemorized': {
        const spell = (doc.spellbook ?? []).find((s) => s.id === op.spellId);
        if (!spell) throw notFound('spell');
        spell.isMemorized = Boolean(op.is_memorized);
        return;
      }
      case 'deleteSpell': {
        doc.spellbook = (doc.spellbook ?? []).filter((s) => s.id !== op.spellId);
        return;
      }
      default:
        throw badRequest('unknown magic op');
    }
  });

  return result;
}
