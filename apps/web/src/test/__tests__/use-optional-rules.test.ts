import { renderHook, act } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { useOptionalRules } from '../../hooks/use-optional-rules';

// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('useOptionalRules', () => {
  it('returns defaults when localStorage is empty', () => {
    const { result } = renderHook(() => useOptionalRules());
    const [rules] = result.current;
    expect(rules.subParReroll).toBe(true);
    expect(rules.hpRerollLowRolls).toBe(false);
    expect(rules.coinWeightEnabled).toBe(false);
  });

  it('loads saved state from localStorage', () => {
    localStorage.setItem(
      'dolmenwood-rules',
      JSON.stringify({ subParReroll: false, hpRerollLowRolls: true, coinWeightEnabled: true }),
    );
    const { result } = renderHook(() => useOptionalRules());
    const [rules] = result.current;
    expect(rules.subParReroll).toBe(false);
    expect(rules.hpRerollLowRolls).toBe(true);
  });

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem('dolmenwood-rules', 'not-valid-json');
    const { result } = renderHook(() => useOptionalRules());
    const [rules] = result.current;
    expect(rules.subParReroll).toBe(true);
  });

  it('persists state to localStorage on setRules', () => {
    const { result } = renderHook(() => useOptionalRules());
    act(() => {
      const [rules, setRules] = result.current;
      setRules({ ...rules, coinWeightEnabled: true });
    });
    const saved = JSON.parse(localStorage.getItem('dolmenwood-rules') ?? '{}');
    expect(saved.coinWeightEnabled).toBe(true);
  });

  it('merges partial records — known keys load, missing keys fall back to defaults', () => {
    localStorage.setItem(
      'dolmenwood-rules',
      JSON.stringify({ subParReroll: false, unknownKey: 'x' }),
    );
    const { result } = renderHook(() => useOptionalRules());
    const [rules] = result.current;
    // Known key overrides default
    expect(rules.subParReroll).toBe(false);
    // Missing known keys still have their defaults
    expect(rules.hpRerollLowRolls).toBe(false);
    expect(rules.coinWeightEnabled).toBe(false);
  });
});
