'use client';

import { useState } from 'react';
import { applyXPModifiers } from '@dolmenwood/rules-engine';
import type { DwDate } from '@dolmenwood/rules-engine';
import { awardXP, insertPackAnimal, removePackAnimal } from '@/lib/api/campaigns';
import type { CampaignData, PackAnimal, PackAnimalType } from '@/lib/api/campaigns';
import { defaultXPAward } from './types';
import type { NewPackAnimalForm, XPAwardState } from './types';
import { CurrentDateCard } from './CurrentDateCard';
import { InviteCodePanel } from './InviteCodePanel';
import { MemberList } from './MemberList';
import { XPAwardPanel } from './XPAwardPanel';
import { PackAnimalsSection } from './PackAnimalsSection';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

interface Props {
  campaign: CampaignData;
  packAnimals: PackAnimal[];
  /** Reload campaign data after XP awards. */
  onRefresh: () => Promise<void>;
}

/** One campaign the viewer runs: role banner, roster w/ XP preview, XP award, collapsed settings. */
export function DMCampaignCard({ campaign, packAnimals: initialAnimals, onRefresh }: Props) {
  const [showMembers, setShowMembers] = useState(true);
  const [award, setAward] = useState<XPAwardState>(defaultXPAward());
  const [date, setDate] = useState<DwDate | null>(campaign.current_date ?? null);
  const [copied, setCopied] = useState(false);
  const [animals, setAnimals] = useState<PackAnimal[]>(initialAnimals);
  const [showAddAnimal, setShowAddAnimal] = useState(false);
  const [newAnimal, setNewAnimal] = useState<NewPackAnimalForm>({ name: '', mount_type: 'Mule' as PackAnimalType, speed: 30 });

  function patchXP(patch: Partial<XPAwardState>) {
    setAward(prev => ({ ...prev, ...patch }));
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(campaign.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAwardXP() {
    const base = parseInt(award.baseXP.trim(), 10);
    if (Number.isNaN(base) || base <= 0) { patchXP({ error: 'Enter a positive XP amount.' }); return; }

    const allChars = campaign.members.flatMap(m => m.characters);
    if (allChars.length === 0) { patchXP({ error: 'No characters to award XP to.' }); return; }

    patchXP({ awarding: true, error: '' });

    const updates = await Promise.all(
      allChars.map(ch => {
        const gain = award.applyModifier
          ? applyXPModifiers(base, ch.character_class, ch.ability_scores, ch.kindred)
          : base;
        return awardXP(ch.id, gain);
      })
    );

    const failed = updates.filter(r => r.error);
    if (failed.length > 0) {
      await onRefresh();
      patchXP({
        awarding: false,
        error: `${failed.length}/${updates.length} award(s) failed: ${failed[0]!.error!.message}`,
      });
      return;
    }

    patchXP({ awarding: false, lastAwardAt: base, baseXP: '' });
    await onRefresh();
  }

  async function addPackAnimal() {
    if (!newAnimal.name.trim()) return;
    const data = await insertPackAnimal({
      campaignId: campaign.id,
      name: newAnimal.name.trim(),
      mountType: newAnimal.mount_type,
      speed: newAnimal.speed,
    });
    if (data) {
      setAnimals(prev => [...prev, data]);
      setShowAddAnimal(false);
      setNewAnimal({ name: '', mount_type: 'Mule' as PackAnimalType, speed: 30 });
    }
  }

  async function deletePackAnimal(animalId: string) {
    if (!confirm('Remove this pack animal?')) return;
    setAnimals(prev => prev.filter(a => a.id !== animalId));
    await removePackAnimal(campaign.id, animalId);
  }

  return (
    <div style={{ backgroundColor: 'var(--color-dash-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Role banner */}
      <div style={{ padding: '0.875rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: '700', color: 'var(--color-text)', fontSize: '1rem' }}>
              {campaign.name}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
              {campaign.members.length} member{campaign.members.length !== 1 ? 's' : ''}
            </div>
          </div>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap',
            backgroundColor: 'var(--color-gold)', color: '#1e1b0f',
            padding: '0.2rem 0.5rem', borderRadius: '4px',
          }}>
            You are the DM
          </span>
        </div>

        {/* In-world date */}
        <div style={{ marginTop: '0.625rem' }}>
          <CurrentDateCard
            date={date}
            campaignId={campaign.id}
            isDM
            onChange={setDate}
          />
        </div>
      </div>

      {/* Members roster (with XP-award preview) */}
      <MemberList
        campaign={{ ...campaign, showMembers }}
        award={award}
        onToggle={() => setShowMembers(m => !m)}
      />

      {/* Award XP */}
      <XPAwardPanel
        campaign={campaign}
        award={award}
        onPatch={patchXP}
        onAward={handleAwardXP}
      />

      {/* Collapsed campaign settings */}
      <div style={{ padding: '0.25rem 1rem 0.875rem' }}>
        <CollapsibleSection title="Campaign Settings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <InviteCodePanel
              inviteCode={campaign.invite_code}
              copied={copied}
              onCopy={copyInviteCode}
            />
            <PackAnimalsSection
              animals={animals}
              showAdd={showAddAnimal}
              newAnimal={newAnimal}
              onToggleAdd={() => setShowAddAnimal(s => !s)}
              onPatchAnimal={patch => setNewAnimal(prev => ({ ...prev, ...patch }))}
              onAdd={addPackAnimal}
              onDelete={deletePackAnimal}
            />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
