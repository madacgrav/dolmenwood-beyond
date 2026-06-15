import {
  getXPThresholdForNextLevel,
  canLevelUpAfterGain,
} from '@dolmenwood/rules-engine';
import type { MemberCharacter, PackAnimalType } from '@/lib/data/campaigns';

export type {
  CampaignData,
  Member,
  MemberCharacter,
  PackAnimal,
  PackAnimalType,
} from '@/lib/data/campaigns';

export interface XPAwardState {
  showPanel: boolean;
  baseXP: string;
  applyModifier: boolean;
  awarding: boolean;
  error: string;
  lastAwardAt: number | null;
}

export function defaultXPAward(): XPAwardState {
  return { showPanel: false, baseXP: '', applyModifier: true, awarding: false, error: '', lastAwardAt: null };
}

export interface NewPackAnimalForm {
  name: string;
  mount_type: PackAnimalType;
  speed: number;
}

export function canLevelUpAfter(ch: MemberCharacter, gain: number): boolean {
  const threshold = getXPThresholdForNextLevel(ch.character_class, ch.level);
  return canLevelUpAfterGain(ch.xp, gain, threshold);
}
