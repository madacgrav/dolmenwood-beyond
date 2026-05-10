/**
 * Dolmenwood rule: recover floor(shots/2) arrows after battle.
 */
export function calcAmmoRecovery(shotsUsed: number): number {
  return Math.floor(Math.max(0, shotsUsed) / 2);
}

