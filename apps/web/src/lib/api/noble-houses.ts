import type { NobleHouseDoc } from '@/lib/cosmos/types';

export async function listNobleHouses(): Promise<NobleHouseDoc[]> {
  const res = await fetch('/api/houses');
  if (!res.ok) return [];
  return res.json();
}
