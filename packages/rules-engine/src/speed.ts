export function calculateSpeed(totalEquippedWeightCoins: number): 10 | 20 | 30 | 40 {
  if (totalEquippedWeightCoins <= 400) return 40;
  if (totalEquippedWeightCoins <= 600) return 30;
  if (totalEquippedWeightCoins <= 800) return 20;
  return 10;
}
