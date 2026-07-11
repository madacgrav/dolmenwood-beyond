import type { NobleHouseDoc } from '@/lib/cosmos/types';

export async function listNobleHouses(): Promise<NobleHouseDoc[]> {
  const res = await fetch('/api/houses');
  if (!res.ok) return [];
  return res.json();
}

export async function fetchNobleHouse(id: string): Promise<NobleHouseDoc | null> {
  const res = await fetch(`/api/houses/${id}`);
  if (!res.ok) return null;
  return res.json();
}
