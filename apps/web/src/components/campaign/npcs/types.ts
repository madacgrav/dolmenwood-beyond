import type { NpcStatus } from '@/lib/api/npcs';

export const STATUS_ORDER: NpcStatus[] = ['alive', 'unknown', 'missing', 'dead'];

export const STATUS_META: Record<NpcStatus, { label: string; color: string }> = {
  alive: { label: 'Alive', color: 'var(--color-primary)' },
  unknown: { label: 'Unknown', color: 'var(--color-text-muted)' },
  missing: { label: 'Missing', color: 'var(--color-warning, #b8860b)' },
  dead: { label: 'Dead', color: 'var(--color-danger)' },
};
