// Restock catalog — prices in SP (silver standard: 1 GP = 20 SP, 1 SP = 10 CP)
export interface RestockEntry {
  name: string;
  unit: number;        // quantity added per purchase
  priceSp: number;     // price in SP (fractional: 0.05 SP = 0.5 CP ≈ 1 cp)
  category: string;
  weightCoins: number; // per-unit carried weight in coins (ammo is fractional: weight per arrow, not per bundle)
}

// ponytail: ammo per-unit weights are provisional — confirm against the Dolmenwood rulebook before tuning
export const RESTOCK_ITEMS: RestockEntry[] = [
  { name: 'Arrow',                unit: 20, priceSp: 1,    category: 'ammo', weightCoins: 0.1 },
  { name: 'Crossbow Quarrel',     unit: 20, priceSp: 2,    category: 'ammo', weightCoins: 0.1 },
  { name: 'Sling Stone',          unit: 20, priceSp: 0.25, category: 'ammo', weightCoins: 0.2 },
  { name: 'Oil Flask',            unit: 1,  priceSp: 1,    category: 'gear', weightCoins: 10 },
  { name: 'Torch',                unit: 1,  priceSp: 0.05, category: 'gear', weightCoins: 10 },
  { name: 'Ration',               unit: 1,  priceSp: 1,    category: 'gear', weightCoins: 15 },
  { name: 'Waterskin Refill',     unit: 1,  priceSp: 0.05, category: 'gear', weightCoins: 0 },
  { name: 'Horse Feed (per day)', unit: 1,  priceSp: 0.25, category: 'gear', weightCoins: 0 },
  { name: 'Dog Feed (per day)',   unit: 1,  priceSp: 0.10, category: 'gear', weightCoins: 0 },
];

/** Total SP value of coins on hand (1 GP = 20 SP, 1 CP = 0.1 SP) */
export function totalSpOnHand(c: { gp: number; sp: number; cp: number }): number {
  return c.gp * 20 + c.sp + c.cp / 10;
}

/** Deduct amountSp from coin purse, returning updated coin counts */
export function deductSp(
  current: { gp: number; sp: number; cp: number },
  amountSp: number,
): { gp: number; sp: number; cp: number } {
  // Work in CP to avoid floating-point drift
  const totalCp = current.gp * 200 + current.sp * 10 + current.cp;
  const costCp = Math.round(amountSp * 10);
  const remainCp = Math.max(0, totalCp - costCp);
  const gp = Math.floor(remainCp / 200);
  const spRem = Math.floor((remainCp % 200) / 10);
  const cp = remainCp % 10;
  return { gp, sp: spRem, cp };
}
