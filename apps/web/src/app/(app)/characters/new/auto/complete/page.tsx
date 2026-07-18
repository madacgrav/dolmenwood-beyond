'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { createCharacter, saveCoins } from '@/lib/api/characters';
import { insertInventoryItem } from '@/lib/api/inventory';
import { insertCharacterSpell } from '@/lib/api/spells';
import { parseCountSuffix } from '@/lib/inventory/parse-count';
import { canonicalName } from '@/lib/inventory/consumables';
import { hasInnateGlamours, hasKnacks, getSpellsForClass, getKnacks, pickRandom } from '@dolmenwood/rules-engine';

interface CatalogDoc {
  name: string; itemType: string; weight: number;
  weaponDamageDice: string | null; armorAcBonus: number | null;
  isShield?: boolean; armorBulk?: string | null;
}

/** Best-effort: the character exists either way; a failed insert is logged and skipped. */
async function seedInventory(characterId: string, equipment: string[], startingGold: number) {
  let catalog: CatalogDoc[] = [];
  try {
    const res = await fetch('/api/catalog');
    if (res.ok) catalog = await res.json();
  } catch { /* fall back to zero-weight gear */ }

  for (const raw of equipment) {
    const parsed = parseCountSuffix(raw);
    const name = canonicalName(raw);
    const cat = catalog.find(c => canonicalName(c.name) === name);
    const catCount = cat ? parseCountSuffix(cat.name).quantity : null;
    const weight = cat ? Math.round((cat.weight / (catCount ?? 1)) * 100) / 100 : 0;
    const itemType = cat?.itemType ?? 'gear';
    const payload: Record<string, unknown> = {
      character_id: characterId,
      item_name: name,
      item_type: itemType,
      quantity: parsed.quantity ?? 1,
      weight_coins: weight,
      location: itemType === 'armor' || itemType === 'weapon' ? 'equipped' : 'stowed',
    };
    if (cat?.weaponDamageDice) payload.weapon_damage_dice = cat.weaponDamageDice;
    if (cat?.armorAcBonus != null) payload.armor_ac_bonus = cat.armorAcBonus;
    if (cat?.isShield) payload.is_shield = true;
    if (cat?.armorBulk) payload.armor_bulk = cat.armorBulk;
    try {
      await insertInventoryItem(payload);
    } catch (e) {
      console.error('starting equipment insert failed', raw, e);
    }
  }
  if (startingGold > 0) {
    try { await saveCoins(characterId, { gp: startingGold, sp: 0, cp: 0 }); }
    catch (e) { console.error('starting gold save failed', e); }
  }
}

/** Best-effort: rolls the kindred's random glamour/knack. Failures are logged and skipped. */
async function seedKindredAbilities(characterId: string, kindred: string) {
  try {
    if (hasInnateGlamours(kindred)) {
      const name = pickRandom(getSpellsForClass('Enchanter').map(s => s.name));
      if (name) {
        await insertCharacterSpell(characterId, {
          character_id: characterId, spell_name: name, spell_level: 0,
          is_memorized: false, kind: 'kindred-glamour',
        });
      }
    }
    if (hasKnacks(kindred)) {
      const name = pickRandom(getKnacks().map(k => k.name));
      if (name) {
        await insertCharacterSpell(characterId, {
          character_id: characterId, spell_name: name, spell_level: 0,
          is_memorized: false, kind: 'knack',
        });
      }
    }
  } catch (e) {
    console.error('kindred ability seed failed', e);
  }
}

export default function CharacterCompletePage() {
  const router = useRouter();
  const wizard = useWizardStore();
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(true);
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    async function save() {
      const { id, error: insertError } = await createCharacter({
        name: wizard.name,
        sex: wizard.sex,
        age: wizard.age,
        height: wizard.height,
        weight: wizard.weight,
        kindred: wizard.kindred ?? 'Human',
        characterClass: wizard.characterClass ?? 'Fighter',
        alignment: wizard.alignment ?? 'neutral',
        background: wizard.background,
        abilityScores: wizard.abilityScores,
        hpMax: wizard.hpMax,
        portraitUrl: wizard.portraitUrl,
      });

      setSaving(false);

      if (insertError) {
        setError(insertError);
      } else if (id) {
        await seedInventory(id, wizard.equipment, wizard.startingGold);
        await seedKindredAbilities(id, wizard.kindred ?? 'Human');
        setCharacterId(id);
        wizard.reset();
      }
    }

    save();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (saving) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'pulse 1.5s ease infinite' }}>⚔️</div>
          <div style={{ color: 'var(--color-text-muted)' }}>Creating your adventurer…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-bg)', padding: '1.5rem',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <p style={{ color: 'var(--color-danger)', marginBottom: '1.5rem' }}>
            Failed to save character: {error}
          </p>
          <button
            onClick={() => router.back()}
            style={primaryBtn}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '2rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '1rem', animation: 'celebrationBounce 0.7s ease both' }}>
        ⚔️
      </div>
      <h1 style={{
        fontFamily: 'var(--font-display), Georgia, serif',
        fontSize: '2rem', color: 'var(--color-primary)', margin: '0 0 0.5rem',
      }}>
        Adventure Awaits!
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontSize: '1rem' }}>
        Your character is ready.
      </p>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
        May fortune favour the bold.
      </p>
      <button
        onClick={() => { if (characterId) router.push(`/characters/${characterId}`); }}
        disabled={!characterId}
        style={{ ...primaryBtn, padding: '1rem 2.5rem', fontSize: '1.1rem', minHeight: '54px', borderRadius: '10px' }}>
        Begin Adventure →
      </button>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '0.875rem 1.5rem', backgroundColor: 'var(--color-primary)', color: 'white',
  border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700',
  cursor: 'pointer', minHeight: '44px',
};
