'use client';
import { useState, useEffect } from 'react';
import type { ACBreakdown, Character } from '@dolmenwood/types';
import { getAttackBonus, getSaveTargets, getHitDie, getAbilityModifier } from '@dolmenwood/rules-engine';
import { listEquippedWeapons, type EquippedWeapon } from '@/lib/api/inventory';
import { ConditionsSection } from './combat/ConditionsSection';
import { ArmourClassSection } from './combat/ArmourClassSection';
import { AttackSection } from './combat/AttackSection';
import { AmmoSection } from './combat/AmmoSection';
import { BattleModal } from './combat/BattleModal';
import { HitDiceSection } from './combat/HitDiceSection';
import { SavingThrowsSection } from './combat/SavingThrowsSection';
import { MountsSection } from './combat/MountsSection';
import { useAmmoTracking } from './combat/use-ammo-tracking';
import { useMounts } from './combat/use-mounts';

interface Props {
  character: Character;
  characterId: string;
  acBreakdown: ACBreakdown | null;
  readOnly?: boolean;
}

const RANGED_WEAPON_PATTERNS = /bow|crossbow|sling|dart|javelin|thrown/i;

export function CombatTab({ character, characterId, acBreakdown, readOnly = false }: Props) {
  const [weapons, setWeapons] = useState<EquippedWeapon[]>([]);
  const [hasRangedWeapon, setHasRangedWeapon] = useState(false);

  useEffect(() => {
    listEquippedWeapons(characterId).then(ws => {
      setWeapons(ws);
      setHasRangedWeapon(ws.some(w => RANGED_WEAPON_PATTERNS.test(w.item_name)));
    });
  }, [characterId]);

  const ammo = useAmmoTracking(characterId);
  const mountsState = useMounts(characterId, character.characterClass);

  const attackBonus = getAttackBonus(character.characterClass, character.level);
  const saves = getSaveTargets(character.characterClass, character.level);
  const strMod = getAbilityModifier(character.abilityScores.str);
  const dexMod = getAbilityModifier(character.abilityScores.dex);

  const ac = acBreakdown?.total ?? 10;
  const hitDie = getHitDie(character.characterClass);

  const battleAmmoName = ammo.ammoItems.find(a => a.id === ammo.battleAmmoId)?.item_name ?? 'Ammo';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Conditions */}
      <ConditionsSection />

      {/* AC Breakdown */}
      <ArmourClassSection ac={ac} dexScore={character.abilityScores.dex} dexMod={dexMod} />

      {/* Attack — Equipped Weapons */}
      <AttackSection weapons={weapons} attackBonus={attackBonus} strMod={strMod} dexMod={dexMod} />

      {/* Ammo Counter */}
      {(hasRangedWeapon || ammo.ammoItems.length > 0) && (
        <AmmoSection
          ammoItems={ammo.ammoItems}
          adjustAmmo={ammo.adjustAmmo}
          openBattle={ammo.openBattle}
        />
      )}

      {/* Battle Modal */}
      {ammo.battleOpen && (
        <BattleModal
          ammoName={battleAmmoName}
          battleStartQty={ammo.battleStartQty}
          battleCurrentQty={ammo.battleCurrentQty}
          battleResult={ammo.battleResult}
          battleEnding={ammo.battleEnding}
          fireShotInBattle={ammo.fireShotInBattle}
          endBattle={ammo.endBattle}
          closeBattle={ammo.closeBattle}
        />
      )}

      {/* Hit Dice */}
      <HitDiceSection characterClass={character.characterClass} level={character.level} hitDie={hitDie} />

      {/* Saving Throws */}
      {saves && <SavingThrowsSection saves={saves as Record<string, number>} readOnly={readOnly} />}

      {/* Mounts */}
      <MountsSection readOnly={readOnly} {...mountsState} />
    </div>
  );
}
