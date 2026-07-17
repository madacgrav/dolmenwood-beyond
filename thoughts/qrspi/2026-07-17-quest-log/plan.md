# Implementation Plan

## Overview

Add a **Quests** tab to the campaign page: any participant can add/edit/delete quests, check them off (status `active`↔`completed`), and keep a freeform note + quest-giver per quest. Quests are an embedded array on `CampaignDoc`, following the NPC slice exactly, with the design's divergences (status enum, any-participant edit/delete, newest-first sort, `giver` field, on-card check-off toggle).

Verify commands run from `apps/web/`: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

---

## Phase 1: Server slice — types, data module, routes, unit tests

### Changes

#### 1. Types
**File**: `apps/web/src/lib/cosmos/types.ts`
**Action**: modify — add after `NpcEntryDoc` (near line 213), and add `quests?` to `CampaignDoc`.

```ts
export type QuestStatus = 'active' | 'completed';

/** Campaign quest log entry, embedded on the campaign. */
export interface QuestEntryDoc {
  id: string;
  title: string;
  /** Free text — who gave the quest. */
  giver: string;
  status: QuestStatus;
  note: string;
  addedBy: string;
  createdAt: string;
  updatedAt?: string;
}
```

In `CampaignDoc` (after the `npcs?` line 241):
```ts
  /** Optional: absent on documents created before the quest log — default to []. */
  quests?: QuestEntryDoc[];
```

#### 2. Data module
**File**: `apps/web/src/lib/data/quests.ts`
**Action**: create — mirror `lib/data/npcs.ts`. Divergences: default status `'active'`; **no** creator-or-DM check (any participant edits/deletes); newest-first sort.

```ts
import { requireAccountId } from '@/lib/auth/session';
import {
  assertCampaignParticipant,
  badRequest,
  forbidden,
  isCampaignParticipant,
  notFound,
} from '@/lib/authz';
import type { CampaignDoc, QuestEntryDoc, QuestStatus } from '@/lib/cosmos/types';
import type { Quest, QuestInput } from '@/lib/api/quests';
import { displayNamesFor, replaceCampaignWithRetry } from './campaigns';

/**
 * Server-only campaign quest log: shared quests live on the campaign doc,
 * like NPCs and sessions. Any participant may add, edit, complete, or delete.
 */

const STATUSES: QuestStatus[] = ['active', 'completed'];

function normStatus(s: unknown): QuestStatus {
  return STATUSES.includes(s as QuestStatus) ? (s as QuestStatus) : 'active';
}

async function questsToUi(doc: CampaignDoc): Promise<Quest[]> {
  const quests = [...(doc.quests ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const names = await displayNamesFor(quests.map((q) => q.addedBy));
  return quests.map((q) => ({
    id: q.id,
    campaign_id: doc.id,
    title: q.title,
    giver: q.giver,
    status: q.status,
    note: q.note,
    added_by: q.addedBy,
    added_by_name: names[q.addedBy] ?? 'Unknown',
  }));
}

export async function getCampaignQuests(campaignId: string): Promise<Quest[]> {
  const me = await requireAccountId();
  return questsToUi(await assertCampaignParticipant(campaignId, me));
}

export async function addQuest(campaignId: string, input: QuestInput): Promise<void> {
  const me = await requireAccountId();
  const title = String(input.title ?? '').trim();
  if (!title) throw badRequest('title is required');
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const quest: QuestEntryDoc = {
        id: crypto.randomUUID(),
        title,
        giver: String(input.giver ?? '').trim(),
        status: normStatus(input.status),
        note: String(input.note ?? '').trim(),
        addedBy: me,
        createdAt: new Date().toISOString(),
      };
      doc.quests = [...(doc.quests ?? []), quest];
    },
  );
}

export async function updateQuest(
  campaignId: string,
  questId: string,
  patch: QuestInput,
): Promise<void> {
  await requireAccountId();
  const title = String(patch.title ?? '').trim();
  if (!title) throw badRequest('title is required');
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const quest = (doc.quests ?? []).find((q) => q.id === questId);
      if (!quest) throw notFound('quest');
      quest.title = title;
      quest.giver = String(patch.giver ?? '').trim();
      quest.status = normStatus(patch.status);
      quest.note = String(patch.note ?? '').trim();
      quest.updatedAt = new Date().toISOString();
    },
  );
}

export async function deleteQuest(campaignId: string, questId: string): Promise<void> {
  await requireAccountId();
  await replaceCampaignWithRetry(
    campaignId,
    (doc, meId) => {
      if (!isCampaignParticipant(doc, meId)) throw forbidden();
    },
    (doc) => {
      const quest = (doc.quests ?? []).find((q) => q.id === questId);
      if (!quest) throw notFound('quest');
      doc.quests = (doc.quests ?? []).filter((q) => q.id !== questId);
    },
  );
}
```

> Note: unlike npcs (which uses `() => undefined` authorize + creator-or-DM check inside mutate), quests put the participant check in the `authorize` callback for update/delete since there is no per-entry ownership rule.

#### 3. Collection route
**File**: `apps/web/src/app/api/campaigns/[id]/quests/route.ts`
**Action**: create — mirror npcs collection route.

```ts
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { getCampaignQuests, addQuest } from '@/lib/data/quests';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ quests: await getCampaignQuests(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await addQuest(id, {
      title: body?.title,
      giver: body?.giver ?? '',
      status: body?.status ?? 'active',
      note: body?.note ?? '',
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
```

#### 4. Item route
**File**: `apps/web/src/app/api/campaigns/[id]/quests/[questId]/route.ts`
**Action**: create — mirror npcs item route.

```ts
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { updateQuest, deleteQuest } from '@/lib/data/quests';

type Params = { params: Promise<{ id: string; questId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, questId } = await params;
    const body = await request.json();
    await updateQuest(id, questId, {
      title: body?.title,
      giver: body?.giver ?? '',
      status: body?.status ?? 'active',
      note: body?.note ?? '',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, questId } = await params;
    await deleteQuest(id, questId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
```

#### 5. Unit tests
**File**: `apps/web/src/test/__tests__/quests.test.ts`
**Action**: create — mirror `npcs.test.ts` structure (same mocks/`setupCampaign` helper). Cover the quests rules, including the divergence that **any member** can edit/delete.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AccountDoc, QuestEntryDoc } from '@/lib/cosmos/types';
import { store, resetFake } from '@/test/cosmos-fake';

const REFEREE = { id: 'ref-1', displayName: 'The Referee' } as AccountDoc;
const PLAYER = { id: 'player-1', displayName: 'Alice' } as AccountDoc;
const OUTSIDER = { id: 'outsider-1', displayName: 'Mallory' } as AccountDoc;
const MEMBER2 = { id: 'player-2', displayName: 'Bob' } as AccountDoc;
let currentAccount: AccountDoc = REFEREE;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => currentAccount.id,
  getCurrentAccount: async () => currentAccount,
}));
vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));

import { getCampaignQuests, addQuest, updateQuest, deleteQuest } from '@/lib/data/quests';
import { createCampaign, joinCampaign } from '@/lib/data/campaigns';

function seedAccounts() {
  for (const a of [REFEREE, PLAYER, OUTSIDER, MEMBER2]) {
    store('accounts').set(a.id, { ...a, email: `${a.id}@example.com` });
  }
}

beforeEach(() => {
  resetFake();
  seedAccounts();
  currentAccount = REFEREE;
});

async function setupCampaign(): Promise<string> {
  const { id } = await createCampaign('The Hollow Hills');
  const code = store('campaigns').get(id)!.inviteCode as string;
  currentAccount = PLAYER;
  await joinCampaign(code);
  currentAccount = MEMBER2;
  await joinCampaign(code);
  currentAccount = REFEREE;
  return id;
}

describe('campaign quests (embedded on the campaign)', () => {
  it('participant adds a quest; all participants see it; outsider 403', async () => {
    const id = await setupCampaign();
    currentAccount = PLAYER;
    await addQuest(id, { title: 'Find the Drune', giver: 'Sister Aelfled', status: 'active', note: 'abbey' });
    expect(store('campaigns').get(id)!.quests).toHaveLength(1);

    currentAccount = REFEREE;
    const seen = await getCampaignQuests(id);
    expect(seen.map((q) => q.title)).toEqual(['Find the Drune']);
    expect(seen[0]).toMatchObject({
      campaign_id: id, giver: 'Sister Aelfled', status: 'active',
      added_by: PLAYER.id, added_by_name: 'Alice',
    });

    currentAccount = OUTSIDER;
    await expect(getCampaignQuests(id)).rejects.toMatchObject({ status: 403 });
    await expect(
      addQuest(id, { title: 'X', giver: '', status: 'active', note: '' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects empty title and clamps bogus status to active', async () => {
    const id = await setupCampaign();
    await expect(
      addQuest(id, { title: '   ', giver: '', status: 'active', note: '' }),
    ).rejects.toMatchObject({ status: 400 });
    await addQuest(id, { title: 'Recover the relic', giver: '', status: 'bogus' as never, note: '' });
    expect((store('campaigns').get(id)!.quests as QuestEntryDoc[])[0]!.status).toBe('active');
  });

  it('sorts newest-first and defaults quests to [] on old docs', async () => {
    const id = await setupCampaign();
    expect(await getCampaignQuests(id)).toEqual([]);
    await addQuest(id, { title: 'First', giver: '', status: 'active', note: '' });
    await addQuest(id, { title: 'Second', giver: '', status: 'active', note: '' });
    // newest createdAt first
    expect((await getCampaignQuests(id)).map((q) => q.title)).toEqual(['Second', 'First']);
  });

  it('any participant can complete/edit/delete; unknown id 404', async () => {
    const id = await setupCampaign();
    currentAccount = PLAYER;
    await addQuest(id, { title: 'Escort the caravan', giver: '', status: 'active', note: '' });
    const questId = (store('campaigns').get(id)!.quests as QuestEntryDoc[])[0]!.id;

    // a different member (not creator, not DM) CAN complete — divergence from NPCs
    currentAccount = MEMBER2;
    await updateQuest(id, questId, { title: 'Escort the caravan', giver: '', status: 'completed', note: 'done' });
    const edited = (store('campaigns').get(id)!.quests as QuestEntryDoc[])[0]!;
    expect(edited).toMatchObject({ status: 'completed', note: 'done' });
    expect(edited.updatedAt).toBeTruthy();

    // empty-title edit rejected
    await expect(
      updateQuest(id, questId, { title: ' ', giver: '', status: 'active', note: '' }),
    ).rejects.toMatchObject({ status: 400 });

    // outsider still blocked
    currentAccount = OUTSIDER;
    await expect(deleteQuest(id, questId)).rejects.toMatchObject({ status: 403 });

    // any member deletes
    currentAccount = MEMBER2;
    await deleteQuest(id, questId);
    expect(store('campaigns').get(id)!.quests).toHaveLength(0);
    await expect(deleteQuest(id, 'nope')).rejects.toMatchObject({ status: 404 });
  });
});
```

### Verification
#### Automated
- [x] `npm run typecheck` passes
- [x] `npm run test -- quests` passes (all 4 quests specs green)
- [x] `npm run test` passes (no regression in npcs/campaigns specs)

#### Manual
- [ ] None — no UI yet.

---

## Phase 2: Client wrapper + UI components

### Changes

#### 1. Client wrapper
**File**: `apps/web/src/lib/api/quests.ts`
**Action**: create — mirror `lib/api/npcs.ts`.

```ts
/** Client-side wrappers over /api/campaigns/[id]/quests. */
import type { QuestStatus } from '@/lib/cosmos/types';

export type { QuestStatus };
export const QUEST_STATUSES: QuestStatus[] = ['active', 'completed'];

export interface Quest {
  id: string;
  campaign_id: string;
  title: string;
  giver: string;
  status: QuestStatus;
  note: string;
  added_by: string;
  added_by_name: string;
}

export interface QuestInput {
  title: string;
  giver: string;
  status: QuestStatus;
  note: string;
}

type MaybeError = { error: { message: string } | null };

async function errorOf(res: Response): Promise<MaybeError> {
  if (res.ok) return { error: null };
  const body = await res.json().catch(() => null);
  return { error: { message: body?.error ?? `request failed (${res.status})` } };
}

export async function loadQuests(campaignId: string): Promise<Quest[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.quests ?? [];
}

export async function createQuest(campaignId: string, input: QuestInput): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return errorOf(res);
}

export async function updateQuest(
  campaignId: string,
  questId: string,
  patch: QuestInput,
): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests/${questId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return errorOf(res);
}

export async function deleteQuest(campaignId: string, questId: string): Promise<MaybeError> {
  const res = await fetch(`/api/campaigns/${campaignId}/quests/${questId}`, { method: 'DELETE' });
  return errorOf(res);
}
```

#### 2. List status metadata
**File**: `apps/web/src/components/campaign/quests/types.ts`
**Action**: create — mirror npcs `types.ts`.

```ts
import type { QuestStatus } from '@/lib/api/quests';

export const STATUS_ORDER: QuestStatus[] = ['active', 'completed'];

export const STATUS_META: Record<QuestStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'var(--color-primary)' },
  completed: { label: 'Completed', color: 'var(--color-text-muted)' },
};
```

#### 3. Form
**File**: `apps/web/src/components/campaign/quests/QuestForm.tsx`
**Action**: create — mirror `NpcForm.tsx` but **no status `<select>`** (status is set via the card toggle; create defaults active). Fields: title, giver, note.

```tsx
'use client';

import { type QuestInput } from '@/lib/api/quests';

interface Props {
  mode: 'create' | 'edit';
  value: QuestInput;
  error: string;
  loading: boolean;
  onChange: (patch: Partial<QuestInput>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.625rem', borderRadius: '6px',
  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '40px',
  boxSizing: 'border-box', width: '100%',
};

export function QuestForm({ mode, value, error, loading, onChange, onSubmit, onCancel }: Props) {
  const canSubmit = !!value.title.trim() && !loading;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.875rem',
      borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
    }}>
      <input type="text" placeholder="Quest title" value={value.title}
        onChange={e => onChange({ title: e.target.value })} style={inputStyle} />
      <input type="text" placeholder="Quest-giver (optional)" value={value.giver}
        onChange={e => onChange({ giver: e.target.value })} style={inputStyle} />
      <textarea placeholder="Notes about this quest (optional)" value={value.note}
        onChange={e => onChange({ note: e.target.value })} rows={3}
        style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)',
          backgroundColor: 'transparent', color: 'var(--color-text-muted)', fontSize: '0.85rem',
          cursor: 'pointer', minHeight: '40px',
        }}>Cancel</button>
        <button onClick={onSubmit} disabled={!canSubmit} style={{
          flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none',
          backgroundColor: canSubmit ? 'var(--color-primary)' : 'var(--color-border)',
          color: 'white', fontSize: '0.85rem', fontWeight: '600',
          cursor: canSubmit ? 'pointer' : 'not-allowed', minHeight: '40px',
        }}>
          {loading ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add Quest'}
        </button>
      </div>
    </div>
  );
}
```

#### 4. Card (with check-off toggle)
**File**: `apps/web/src/components/campaign/quests/QuestCard.tsx`
**Action**: create. Divergence from `NpcCard`: any participant sees controls (no `canEdit` gate); add a check-off toggle button (styled-button idiom from `ConditionsSection.tsx`). Completed cards muted + title strikethrough.

```tsx
'use client';

import type { Quest } from '@/lib/api/quests';

interface Props {
  quest: Quest;
  onToggle: (quest: Quest) => void;
  onEdit: (quest: Quest) => void;
  onDelete: (questId: string) => void;
}

export function QuestCard({ quest, onToggle, onEdit, onDelete }: Props) {
  const done = quest.status === 'completed';
  return (
    <div style={{
      padding: '0.625rem 0.75rem', borderRadius: '10px',
      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
      opacity: done ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => onToggle(quest)}
          style={{
            width: '28px', height: '28px', minHeight: '28px', flexShrink: 0,
            borderRadius: '6px', cursor: 'pointer',
            border: `2px solid ${done ? 'var(--color-primary)' : 'var(--color-border)'}`,
            backgroundColor: done ? 'var(--color-primary)' : 'transparent',
            color: 'white', fontSize: '0.85rem', lineHeight: 1,
          }}
          aria-label={done ? `Mark ${quest.title} active` : `Mark ${quest.title} completed`}
          aria-pressed={done}
        >
          {done ? '✓' : ''}
        </button>
        <span style={{
          color: 'var(--color-text)', fontWeight: '600', fontSize: '0.9rem',
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {quest.title}
        </span>
        {quest.giver && (
          <>
            <span style={{ color: 'var(--color-text-muted)' }}>·</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{quest.giver}</span>
          </>
        )}
        <button onClick={() => onEdit(quest)} style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0.125rem',
          minHeight: '28px', minWidth: '28px',
        }} aria-label={`Edit ${quest.title}`}>✎</button>
        <button onClick={() => onDelete(quest.id)} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)',
          fontSize: '0.85rem', padding: '0.125rem', minHeight: '28px', minWidth: '28px',
        }} aria-label={`Delete ${quest.title}`}>✕</button>
      </div>
      {quest.note && (
        <p style={{ margin: '0.375rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>
          {quest.note}
        </p>
      )}
      <p style={{ margin: '0.375rem 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
        Added by {quest.added_by_name}
      </p>
    </div>
  );
}
```

#### 5. List
**File**: `apps/web/src/components/campaign/quests/QuestList.tsx`
**Action**: create — mirror `NpcList.tsx`, grouped by `STATUS_ORDER`, empty state "No quests yet."

```tsx
'use client';

import type { Quest } from '@/lib/api/quests';
import { QuestCard } from './QuestCard';
import { STATUS_META, STATUS_ORDER } from './types';

interface Props {
  quests: Quest[];
  onToggle: (quest: Quest) => void;
  onEdit: (quest: Quest) => void;
  onDelete: (questId: string) => void;
}

export function QuestList({ quests, onToggle, onEdit, onDelete }: Props) {
  if (quests.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
        No quests yet.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {STATUS_ORDER.map(status => {
        const group = quests.filter(q => q.status === status);
        if (group.length === 0) return null;
        return (
          <div key={status}>
            <h3 style={{
              margin: '0 0 0.375rem', fontSize: '0.7rem', fontWeight: '700',
              textTransform: 'uppercase', letterSpacing: '0.05em', color: STATUS_META[status].color,
            }}>
              {STATUS_META[status].label} ({group.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {group.map(quest => (
                <QuestCard key={quest.id} quest={quest} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

#### 6. Tab
**File**: `apps/web/src/components/campaign/quests/QuestTab.tsx`
**Action**: create — mirror `NpcTab.tsx`. Drop `isDM`/`userId` gating (any participant edits). Add `handleToggle` that sends full-input PATCH with flipped status. `EMPTY_INPUT` status `'active'`.

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadQuests, createQuest, updateQuest, deleteQuest, type Quest, type QuestInput,
} from '@/lib/api/quests';
import { listMyCampaignNames } from '@/lib/api/campaigns';
import { QuestList } from './QuestList';
import { QuestForm } from './QuestForm';

interface CampaignOption { id: string; name: string; is_dm: boolean; }

const EMPTY_INPUT: QuestInput = { title: '', giver: '', status: 'active', note: '' };

export function QuestTab() {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState<QuestInput>(EMPTY_INPUT);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadCampaigns() {
      const list: CampaignOption[] = await listMyCampaignNames();
      setCampaigns(list);
      const first = list[0];
      if (first) setCampaignId(first.id);
      else setLoading(false);
    }
    loadCampaigns();
  }, []);

  const refetch = useCallback(async () => {
    if (!campaignId) return;
    setQuests(await loadQuests(campaignId));
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setLoading(true);
    (async () => {
      const data = await loadQuests(campaignId);
      if (active) { setQuests(data); setLoading(false); }
    })();
    return () => { active = false; };
  }, [campaignId]);

  function resetForm() {
    setShowForm(false); setEditingId(null); setFormValue(EMPTY_INPUT); setFormError('');
  }

  function handleEdit(quest: Quest) {
    setEditingId(quest.id);
    setShowForm(true);
    setFormValue({ title: quest.title, giver: quest.giver, status: quest.status, note: quest.note });
    setFormError('');
  }

  async function handleToggle(quest: Quest) {
    const next: QuestInput = {
      title: quest.title, giver: quest.giver, note: quest.note,
      status: quest.status === 'completed' ? 'active' : 'completed',
    };
    const { error } = await updateQuest(campaignId, quest.id, next);
    if (!error) await refetch();
  }

  async function handleDelete(questId: string) {
    if (!window.confirm('Delete this quest?')) return;
    const { error } = await deleteQuest(campaignId, questId);
    if (!error) await refetch();
  }

  async function handleSubmit() {
    if (!formValue.title.trim()) { setFormError('Enter a title.'); return; }
    setSaving(true);
    setFormError('');
    const input: QuestInput = {
      title: formValue.title.trim(), giver: formValue.giver.trim(),
      status: formValue.status, note: formValue.note.trim(),
    };
    const { error } = editingId
      ? await updateQuest(campaignId, editingId, input)
      : await createQuest(campaignId, input);
    setSaving(false);
    if (error) setFormError(error.message);
    else { resetForm(); await refetch(); }
  }

  if (campaigns.length === 0 && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📜</div>
        <p>Join or create a campaign to track quests.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {campaigns.length > 1 && (
        <select value={campaignId} onChange={e => setCampaignId(e.target.value)} style={{
          padding: '0.5rem 0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '40px',
        }}>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {showForm ? (
        <QuestForm mode={editingId ? 'edit' : 'create'} value={formValue} error={formError} loading={saving}
          onChange={patch => setFormValue(v => ({ ...v, ...patch }))} onSubmit={handleSubmit} onCancel={resetForm} />
      ) : (
        <button onClick={() => setShowForm(true)} style={{
          padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)',
          color: 'white', fontWeight: '600', fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
        }}>➕ Add Quest</button>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '70px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <QuestList quests={quests} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
      )}
    </div>
  );
}
```

### Verification
#### Automated
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

#### Manual
- [ ] None — not wired into nav until Phase 3.

---

## Phase 3: Register Quests tab

### Changes

#### 1. Campaign page
**File**: `apps/web/src/app/(app)/campaign/page.tsx`
**Action**: modify — 4 edits mirroring the `npcs` tab.

- Import (after the `NpcTab` import, line 8):
  ```ts
  import { QuestTab } from '@/components/campaign/quests/QuestTab';
  ```
- `TabId` union (line 11): add `| 'quests'`
  ```ts
  type TabId = 'overview' | 'bank' | 'schedule' | 'npcs' | 'quests';
  ```
- `tabs` array (after the npcs entry, line 37):
  ```ts
    { id: 'quests', label: '📜 Quests' },
  ```
- Render branch (after the npcs branch, line 123):
  ```tsx
  {activeTab === 'quests' && userId && (
    <QuestTab />
  )}
  ```

### Verification
#### Automated
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` + `npm run lint` + `npm run test` all pass

#### Manual (dev server, in a shared campaign with a DM + ≥1 player)
- [ ] Quests tab (📜) appears in the campaign tab bar.
- [ ] Add a quest with title + giver + notes → appears under **Active**, shows "Added by <name>".
- [ ] Click the check-off box → quest moves to **Completed**, card muted, title strikethrough, box shows ✓.
- [ ] Click again → back to **Active**.
- [ ] Edit a quest (✎) → title/giver/notes change persist.
- [ ] Delete (✕) → `confirm` dialog, then quest removed.
- [ ] As a non-DM player in the campaign: can add, complete, edit, and delete (any-participant rule).
- [ ] Reload the page → all quests + statuses persist (stored on campaign doc).
- [ ] Log in as a non-member → cannot reach these quests (403 from API; tab shows other campaign or empty state).

---

## Deviations from structure.md
- None in scope. One concrete choice locked from the design's open item: the **check-off toggle sends a full-input PATCH** with the flipped status (`handleToggle` in `QuestTab`), keeping the NPC-style full-object PATCH rather than adding partial-patch support to the data layer.
- `updateQuest`/`deleteQuest` put the participant check in the `authorize` callback (not a no-op like npcs) because quests have no per-entry ownership rule — this is the mechanism for the any-participant divergence.
- `QuestCard`/`QuestList` drop the `userId`/`isDM` props npcs carried (unused once edit/delete is open to all participants), so `QuestTab` needs no `userId` prop and the page renders `<QuestTab />` with no args.
