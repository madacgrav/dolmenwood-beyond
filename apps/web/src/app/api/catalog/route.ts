import { NextResponse } from 'next/server';
import { listCatalogItems } from '@/lib/data/catalog';

export async function GET() {
  try {
    const items = await listCatalogItems();
    return NextResponse.json(items);
  } catch (e) {
    console.error('catalog fetch failed:', e);
    return NextResponse.json({ error: 'catalog unavailable' }, { status: 500 });
  }
}
