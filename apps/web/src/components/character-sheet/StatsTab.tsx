'use client';
import type { ACBreakdown, CharacterWithNotes } from '@dolmenwood/types';
import {
  getPrimeAbilities, getSaveTargets,
  getAttackBonus, calculateSpeed,
  getMaxRetainers, getRetainerLoyaltyBase,
  getMagicResistance, getKindredMagicResistance,
  getExplorationRate, getOverlandRate,
} from '@dolmenwood/rules-engine';
import { AbilityScoresSection } from './stats/AbilityScoresSection';
import { CombatStatsSection } from './stats/CombatStatsSection';
import { TraitsSection } from './stats/TraitsSection';
import { SkillsSection } from './stats/SkillsSection';
import { SavingThrowsSection } from './stats/SavingThrowsSection';
import { LanguagesSection } from './stats/LanguagesSection';
import { RetainersSection } from './stats/RetainersSection';
import { PromoteRetainerModal } from './stats/PromoteRetainerModal';
import { PromoteSuccessToast } from './stats/PromoteSuccessToast';
import { useLanguages } from './stats/use-languages';
import { useRetainers } from './stats/use-retainers';

interface Props {
  character: CharacterWithNotes;
  acBreakdown: ACBreakdown | null;
  /** Carried weight in coins (non-tiny inventory), for the encumbrance-based Speed. */
  carriedWeight: number;
  editMode: boolean;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
  readOnly?: boolean;
}

export function StatsTab({ character, acBreakdown, carriedWeight, editMode, onUpdate, readOnly }: Props) {
  const primes = getPrimeAbilities(character.characterClass);
  const saves = getSaveTargets(character.characterClass, character.level);
  const attackBonus = getAttackBonus(character.characterClass, character.level);
  const ac = acBreakdown?.total ?? 10;
  const speed = calculateSpeed(carriedWeight);
  const exploring = getExplorationRate(speed);
  const overland = getOverlandRate(speed);
  const magicResistance = getMagicResistance(character.abilityScores.wis, getKindredMagicResistance(character.kindred));
  const maxRetainers = getMaxRetainers(character.abilityScores.cha);
  const loyaltyBase = getRetainerLoyaltyBase(character.abilityScores.cha);

  const languages = useLanguages(character.id, character.extraLanguages);
  const retainerState = useRetainers(character.id, loyaltyBase);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <AbilityScoresSection
        abilityScores={character.abilityScores}
        primes={primes}
        editMode={editMode}
        readOnly={readOnly}
        onUpdate={onUpdate}
      />

      <CombatStatsSection ac={ac} attackBonus={attackBonus} speed={speed} exploring={exploring} overland={overland} />

      <TraitsSection traits={character.traits} onUpdate={onUpdate} readOnly={readOnly} />

      <SkillsSection
        characterClass={character.characterClass}
        level={character.level}
        kindred={character.kindred}
      />

      <SavingThrowsSection saves={saves} magicResistance={magicResistance} />

      <LanguagesSection
        kindred={character.kindred}
        intScore={character.abilityScores.int}
        editMode={editMode}
        readOnly={readOnly}
        extraLanguages={languages.extraLanguages}
        newLang={languages.newLang}
        setNewLang={languages.setNewLang}
        langError={languages.langError}
        addLanguage={languages.addLanguage}
        removeLanguage={languages.removeLanguage}
      />

      <RetainersSection
        readOnly={readOnly}
        maxRetainers={maxRetainers}
        loyaltyBase={loyaltyBase}
        retainers={retainerState.retainers}
        retainerLoading={retainerState.retainerLoading}
        showAddRetainer={retainerState.showAddRetainer}
        setShowAddRetainer={retainerState.setShowAddRetainer}
        newRetainer={retainerState.newRetainer}
        setNewRetainer={retainerState.setNewRetainer}
        expandedRetainer={retainerState.expandedRetainer}
        setExpandedRetainer={retainerState.setExpandedRetainer}
        addRetainer={retainerState.addRetainer}
        updateRetainerHP={retainerState.updateRetainerHP}
        handlePromoteClick={retainerState.handlePromoteClick}
        dismissRetainer={retainerState.dismissRetainer}
      />

      <PromoteRetainerModal
        retainers={retainerState.retainers}
        promotingRetainer={retainerState.promotingRetainer}
        promoteLoading={retainerState.promoteLoading}
        promoteError={retainerState.promoteError}
        onCancel={() => retainerState.setPromotingRetainer(null)}
        promoteRetainer={retainerState.promoteRetainer}
      />

      <PromoteSuccessToast
        promoteSuccess={retainerState.promoteSuccess}
        onDismiss={() => retainerState.setPromoteSuccess(null)}
      />
    </div>
  );
}
