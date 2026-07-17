import type { QuestStatus } from '@/lib/api/quests';

export const STATUS_ORDER: QuestStatus[] = ['active', 'completed'];

export const STATUS_META: Record<QuestStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'var(--color-primary)' },
  completed: { label: 'Completed', color: 'var(--color-text-muted)' },
};
