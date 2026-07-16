import type { Coins } from '@/lib/data/characters';

// Silver standard: 1 gp = 20 sp, 1 sp = 10 cp.
const CP_PER_GP = 200;
const CP_PER_SP = 10;

/** Total purse value in copper pieces. */
export function toCp(c: Coins): number {
  return c.gp * CP_PER_GP + c.sp * CP_PER_SP + c.cp;
}

/** Reconstitute a copper total into gp/sp/cp (largest denominations first). */
export function fromCp(cp: number): Coins {
  const n = Math.max(0, Math.floor(cp));
  return {
    gp: Math.floor(n / CP_PER_GP),
    sp: Math.floor((n % CP_PER_GP) / CP_PER_SP),
    cp: n % CP_PER_SP,
  };
}

/** Convert a whole-number amount in the given denomination to copper. */
export function amountToCp(amount: number, denom: 'gp' | 'sp' | 'cp'): number {
  const a = Math.floor(amount);
  return denom === 'gp' ? a * CP_PER_GP : denom === 'sp' ? a * CP_PER_SP : a;
}
