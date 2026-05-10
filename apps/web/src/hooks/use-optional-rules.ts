'use client';
import { useState, useCallback } from 'react';

export interface OptionalRules {
  subParReroll: boolean;
  hpRerollLowRolls: boolean;
  coinWeightEnabled: boolean;
}

const STORAGE_KEY = 'dolmenwood-rules';

const DEFAULTS: OptionalRules = {
  subParReroll: true,
  hpRerollLowRolls: false,
  coinWeightEnabled: false,
};

function load(): OptionalRules {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<OptionalRules>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function useOptionalRules(): [OptionalRules, React.Dispatch<React.SetStateAction<OptionalRules>>] {
  const [rules, setRulesState] = useState<OptionalRules>(load);

  const setRules: React.Dispatch<React.SetStateAction<OptionalRules>> = useCallback((action) => {
    setRulesState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return [rules, setRules];
}
