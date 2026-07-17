export function calculateSpeed(totalEquippedWeightCoins: number): 10 | 20 | 30 | 40 {
  if (totalEquippedWeightCoins <= 400) return 40;
  if (totalEquippedWeightCoins <= 600) return 30;
  if (totalEquippedWeightCoins <= 800) return 20;
  return 10;
}

/** Dungeon exploration rate: Speed × 3 feet per Turn (Player's Book p148). */
export function getExplorationRate(speed: 10 | 20 | 30 | 40): number {
  return speed * 3;
}

/** Overland travel: Speed ÷ 5 Travel Points per day (Player's Book p148/p157). */
export function getOverlandRate(speed: 10 | 20 | 30 | 40): number {
  return speed / 5;
}

/** Each coin weighs 1 coin-weight unit (Dolmenwood encumbrance is measured in coins). */
export function calculateCoinWeight(coins: { gp: number; sp: number; cp: number; pp?: number }): number {
  return coins.gp + coins.sp + coins.cp + (coins.pp ?? 0);
}
