import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useWizardStore } from '../../stores/wizard-store';

describe('useWizardStore', () => {
  beforeEach(() => {
    act(() => {
      useWizardStore.getState().reset();
    });
  });

  it('initialises with step 1 and mode auto', () => {
    const { step, mode } = useWizardStore.getState();
    expect(step).toBe(1);
    expect(mode).toBe('auto');
  });

  it('initialises with null kindred, class, and alignment', () => {
    const { kindred, characterClass, alignment } = useWizardStore.getState();
    expect(kindred).toBeNull();
    expect(characterClass).toBeNull();
    expect(alignment).toBeNull();
  });

  it('nextStep increments the step', () => {
    act(() => useWizardStore.getState().nextStep());
    expect(useWizardStore.getState().step).toBe(2);
  });

  it('nextStep clamps at totalSteps (13)', () => {
    act(() => useWizardStore.getState().setStep(13));
    act(() => useWizardStore.getState().nextStep());
    expect(useWizardStore.getState().step).toBe(13);
  });

  it('prevStep decrements the step', () => {
    act(() => useWizardStore.getState().setStep(5));
    act(() => useWizardStore.getState().prevStep());
    expect(useWizardStore.getState().step).toBe(4);
  });

  it('prevStep clamps at 1', () => {
    act(() => useWizardStore.getState().prevStep());
    expect(useWizardStore.getState().step).toBe(1);
  });

  it('setMode changes the mode', () => {
    act(() => useWizardStore.getState().setMode('manual'));
    expect(useWizardStore.getState().mode).toBe('manual');
  });

  it('setKindred updates kindred', () => {
    act(() => useWizardStore.getState().setKindred('Elf'));
    expect(useWizardStore.getState().kindred).toBe('Elf');
  });

  it('setCharacterClass updates characterClass', () => {
    act(() => useWizardStore.getState().setCharacterClass('Magician'));
    expect(useWizardStore.getState().characterClass).toBe('Magician');
  });

  it('setAlignment updates alignment', () => {
    act(() => useWizardStore.getState().setAlignment('lawful'));
    expect(useWizardStore.getState().alignment).toBe('lawful');
  });

  it('setHpMax updates hpMax', () => {
    act(() => useWizardStore.getState().setHpMax(8));
    expect(useWizardStore.getState().hpMax).toBe(8);
  });

  it('setName, setSex, setAge, setHeight, setWeight, setBackground all update state', () => {
    act(() => {
      const s = useWizardStore.getState();
      s.setName('Brom the Bard');
      s.setSex('male');
      s.setAge('25');
      s.setHeight("5'10\"");
      s.setWeight('160 lbs');
      s.setBackground('Wandering minstrel');
    });

    const state = useWizardStore.getState();
    expect(state.name).toBe('Brom the Bard');
    expect(state.sex).toBe('male');
    expect(state.age).toBe('25');
    expect(state.height).toBe("5'10\"");
    expect(state.weight).toBe('160 lbs');
    expect(state.background).toBe('Wandering minstrel');
  });

  it('reset() clears all fields back to defaults', () => {
    act(() => {
      const s = useWizardStore.getState();
      s.setStep(7);
      s.setKindred('Grimalkin');
      s.setCharacterClass('Thief');
      s.setAlignment('chaotic');
      s.setHpMax(6);
      s.setName('Scratch');
    });

    act(() => useWizardStore.getState().reset());

    const state = useWizardStore.getState();
    expect(state.step).toBe(1);
    expect(state.kindred).toBeNull();
    expect(state.characterClass).toBeNull();
    expect(state.alignment).toBeNull();
    expect(state.hpMax).toBe(1);
    expect(state.name).toBe('');
  });
});
