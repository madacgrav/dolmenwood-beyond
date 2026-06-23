import { renderHook, act } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { useDiceRoll } from '../../hooks/use-dice-roll';
import { DICE_ROLL_DURATION_MS } from '../../components/wizard/AnimatedDie';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDiceRoll', () => {
  it('sets face + rolling immediately, result only after duration', () => {
    const { result } = renderHook(() => useDiceRoll<{ v: number }>());
    act(() => result.current.roll('k', () => ({ face: 4, result: { v: 4 } })));
    expect(result.current.rollingKeys['k']).toBe(true);
    expect(result.current.faceValues['k']).toBe(4);
    expect(result.current.results['k']).toBeUndefined();
    act(() => vi.advanceTimersByTime(DICE_ROLL_DURATION_MS));
    expect(result.current.rollingKeys['k']).toBe(false);
    expect(result.current.results['k']).toEqual({ v: 4 });
  });

  it('re-rolling a key cancels the prior timer and hides the prior result', () => {
    const { result } = renderHook(() => useDiceRoll<{ v: number }>());
    act(() => result.current.roll('k', () => ({ face: 1, result: { v: 1 } })));
    act(() => vi.advanceTimersByTime(DICE_ROLL_DURATION_MS));
    expect(result.current.results['k']).toEqual({ v: 1 });
    act(() => result.current.roll('k', () => ({ face: 6, result: { v: 6 } })));
    expect(result.current.results['k']).toBeUndefined();
    act(() => vi.advanceTimersByTime(DICE_ROLL_DURATION_MS));
    expect(result.current.results['k']).toEqual({ v: 6 });
  });

  it('rolls keys independently', () => {
    const { result } = renderHook(() => useDiceRoll<{ v: number }>());
    act(() => result.current.roll('a', () => ({ face: 2, result: { v: 2 } })));
    act(() => result.current.roll('b', () => ({ face: 3, result: { v: 3 } })));
    act(() => vi.advanceTimersByTime(DICE_ROLL_DURATION_MS));
    expect(result.current.results['a']).toEqual({ v: 2 });
    expect(result.current.results['b']).toEqual({ v: 3 });
  });

  it('clear() resets everything', () => {
    const { result } = renderHook(() => useDiceRoll<{ v: number }>());
    act(() => result.current.roll('k', () => ({ face: 5, result: { v: 5 } })));
    act(() => vi.advanceTimersByTime(DICE_ROLL_DURATION_MS));
    act(() => result.current.clear());
    expect(result.current.results).toEqual({});
    expect(result.current.rollingKeys).toEqual({});
  });
});
