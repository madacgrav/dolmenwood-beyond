import { create } from 'zustand';
import type { Kindred, CharacterClass, Alignment, AbilityScores } from '@dolmenwood/types';

export type WizardMode = 'auto' | 'manual';

export interface WizardState {
  mode: WizardMode;
  step: number;
  totalSteps: 13;

  // Step data
  abilityScores: AbilityScores;
  kindred: Kindred | null;
  characterClass: CharacterClass | null;
  alignment: Alignment | null;
  hpMax: number;
  name: string;
  sex: string;
  age: string;
  height: string;
  weight: string;
  background: string;
  portraitUrl: string | null;

  // Actions
  setMode: (mode: WizardMode) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setAbilityScores: (scores: AbilityScores) => void;
  setKindred: (kindred: Kindred) => void;
  setCharacterClass: (cls: CharacterClass) => void;
  setAlignment: (alignment: Alignment) => void;
  setHpMax: (hp: number) => void;
  setName: (name: string) => void;
  setSex: (sex: string) => void;
  setAge: (age: string) => void;
  setHeight: (height: string) => void;
  setWeight: (weight: string) => void;
  setBackground: (background: string) => void;
  setPortraitUrl: (url: string | null) => void;
  reset: () => void;
}

const DEFAULT_SCORES: AbilityScores = { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: 10 };

export const useWizardStore = create<WizardState>((set) => ({
  mode: 'auto',
  step: 1,
  totalSteps: 13,
  abilityScores: DEFAULT_SCORES,
  kindred: null,
  characterClass: null,
  alignment: null,
  hpMax: 1,
  name: '',
  sex: '',
  age: '',
  height: '',
  weight: '',
  background: '',
  portraitUrl: null,

  setMode: (mode) => set({ mode }),
  setStep: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, s.totalSteps) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  setAbilityScores: (abilityScores) => set({ abilityScores }),
  setKindred: (kindred) => set({ kindred }),
  setCharacterClass: (characterClass) => set({ characterClass }),
  setAlignment: (alignment) => set({ alignment }),
  setHpMax: (hpMax) => set({ hpMax }),
  setName: (name) => set({ name }),
  setSex: (sex) => set({ sex }),
  setAge: (age) => set({ age }),
  setHeight: (height) => set({ height }),
  setWeight: (weight) => set({ weight }),
  setBackground: (background) => set({ background }),
  setPortraitUrl: (portraitUrl) => set({ portraitUrl }),
  reset: () => set({
    step: 1, abilityScores: DEFAULT_SCORES, kindred: null,
    characterClass: null, alignment: null, hpMax: 1,
    name: '', sex: '', age: '', height: '', weight: '',
    background: '', portraitUrl: null,
  }),
}));
