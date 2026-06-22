export function calculateSpeed(totalEquippedWeightCoins: number): 10 | 20 | 30 | 40 {
  if (totalEquippedWeightCoins <= 400) return 40;
  if (totalEquippedWeightCoins <= 600) return 30;
  if (totalEquippedWeightCoins <= 800) return 20;
  return 10;
}

/** Each coin weighs 1 coin-weight unit (Dolmenwood encumbrance is measured in coins). */
export function calculateCoinWeight(coins: { gp: number; sp: number; cp: number; pp?: number }): number {
  return coins.gp + coins.sp + coins.cp + (coins.pp ?? 0);
}
