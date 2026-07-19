'use client';
import type { ACBreakdown, CharacterWithNotes } from '@dolmenwood/types';
import {
  getPrimeAbilities,
  getAttackBonus, calculateSpeed,
  getMaxRetainers, getRetainerLoyaltyBase,
  getExplorationRate, getOverlandRate,
} from '@dolmenwood/rules-engine';
import { AbilityScoresSection } from './stats/AbilityScoresSection';
import { CombatStatsSection } from './stats/CombatStatsSection';
import { TraitsSection } from './stats/TraitsSection';
import { SkillsSection } from './stats/SkillsSection';
import { LanguagesSection } from './stats/LanguagesSection';
import { RetainersSection } from './stats/RetainersSection';
import { PromoteRetainerModal } from './stats/PromoteRetainerModal';
import { PromoteSuccessToast } from './stats/PromoteSuccessToast';
import { useLanguages } from './stats/use-languages';
import { useRetainers } from './stats/use-retainers';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

interface Props {
  character: CharacterWithNotes;
  acBreakdown: ACBreakdown | null;
  /** Carried weight in coins (non-tiny inventory), for the encumbrance-based Speed. */
  carriedWeight: number;
  editMode: boolean;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
  readOnly?: boolean;
  onGoToCombat?: () => void;
}

export function StatsTab({ character, acBreakdown, carriedWeight, editMode, onUpdate, readOnly, onGoToCombat }: Props) {
  const primes = getPrimeAbilities(character.characterClass);
  const attackBonus = getAttackBonus(character.characterClass, character.level);
  const ac = acBreakdown?.total ?? 10;
  const speed = calculateSpeed(carriedWeight);
  const exploring = getExplorationRate(speed);
  const overland = getOverlandRate(speed);
  const maxRetainers = getMaxRetainers(character.abilityScores.cha);
  const loyaltyBase = getRetainerLoyaltyBase(character.abilityScores.cha);

  const languages = useLanguages(character.id, character.extraLanguages);
  const retainerState = useRetainers(character.id, loyaltyBase);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
        ▸ sections are collapsed, nothing removed — tap to expand.
      </p>

      <AbilityScoresSection
        abilityScores={character.abilityScores}
        primes={primes}
        editMode={editMode}
        readOnly={readOnly}
        onUpdate={onUpdate}
      />

      <CombatStatsSection ac={ac} attackBonus={attackBonus} speed={speed} exploring={exploring} overland={overland} onGoToCombat={onGoToCombat} />

      <CollapsibleSection title="Traits">
        <TraitsSection traits={character.traits} onUpdate={onUpdate} readOnly={readOnly} />
      </CollapsibleSection>

      <CollapsibleSection title="Skills">
        <SkillsSection
          characterClass={character.characterClass}
          level={character.level}
          kindred={character.kindred}
        />
      </CollapsibleSection>

      <CollapsibleSection title="Languages">
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
      </CollapsibleSection>

      <CollapsibleSection title="Retainers" count={retainerState.retainers.length}>
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
      </CollapsibleSection>

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
