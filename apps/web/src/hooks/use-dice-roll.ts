'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { DICE_ROLL_DURATION_MS } from '@/components/wizard/AnimatedDie';

export interface UseDiceRoll<R> {
  results: Record<string, R>;            // settled verdicts, keyed; absent while rolling
  rollingKeys: Record<string, boolean>;  // true between roll() and land
  faceValues: Record<string, number>;    // raw die face to pass to AnimatedDie value
  roll: (key: string, compute: () => { face: number; result: R }) => void;
  clear: (key?: string) => void;
}

export function useDiceRoll<R>(opts?: { durationMs?: number }): UseDiceRoll<R> {
  const durationMs = opts?.durationMs ?? DICE_ROLL_DURATION_MS;
  const [results, setResults] = useState<Record<string, R>>({});
  const [rollingKeys, setRollingKeys] = useState<Record<string, boolean>>({});
  const [faceValues, setFaceValues] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const roll = useCallback(
    (key: string, compute: () => { face: number; result: R }) => {
      const { face, result } = compute();
      if (timers.current[key]) clearTimeout(timers.current[key]); // spam-safe
      // value-contract: face + rolling set together; hide any prior verdict
      setFaceValues(prev => ({ ...prev, [key]: face }));
      setRollingKeys(prev => ({ ...prev, [key]: true }));
      setResults(prev => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      timers.current[key] = setTimeout(() => {
        setResults(prev => ({ ...prev, [key]: result }));
        setRollingKeys(prev => ({ ...prev, [key]: false }));
        delete timers.current[key];
      }, durationMs);
    },
    [durationMs],
  );

  const clear = useCallback((key?: string) => {
    const drop = (obj: Record<string, unknown>, k: string) => {
      const n = { ...obj };
      delete n[k];
      return n;
    };
    if (key) {
      if (timers.current[key]) { clearTimeout(timers.current[key]); delete timers.current[key]; }
      setResults(prev => drop(prev, key) as Record<string, R>);
      setRollingKeys(prev => drop(prev, key) as Record<string, boolean>);
      setFaceValues(prev => drop(prev, key) as Record<string, number>);
    } else {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
      setResults({});
      setRollingKeys({});
      setFaceValues({});
    }
  }, []);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  return { results, rollingKeys, faceValues, roll, clear };
}
