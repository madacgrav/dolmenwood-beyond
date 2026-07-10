'use client';

import { useRouter } from 'next/navigation';
import { applyXPModifiers } from '@dolmenwood/rules-engine';
import type { CampaignData } from '@/lib/api/campaigns';
import { canLevelUpAfter } from './types';
import type { XPAwardState } from './types';

interface Props {
  campaign: CampaignData;
  award: XPAwardState;
  onToggle: () => void;
}

export function MemberList({ campaign, award, onToggle }: Props) {
  const router = useRouter();

  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '0.625rem 1rem',
          backgroundColor: 'var(--color-bg)', border: 'none',
          color: 'var(--color-text-muted)', fontSize: '0.8rem',
          cursor: 'pointer', textAlign: 'left', minHeight: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>⚔️ Party ({campaign.members.length})</span>
        <span>{campaign.showMembers ? '▲' : '▼'}</span>
      </button>

      {campaign.showMembers && (
        <div>
          {campaign.members.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              No players yet. Share the invite code above.
            </div>
          ) : (
            campaign.members.map(member => (
              <div
                key={member.account_id}
                style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)' }}
              >
                <div style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                  {member.display_name}
                </div>
                {member.characters.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No characters yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {member.characters.map(ch => {
                      const base = parseInt(award.baseXP.trim(), 10) || 0;
                      const gain = base > 0
                        ? (award.applyModifier ? applyXPModifiers(base, ch.character_class, ch.ability_scores, ch.kindred) : base)
                        : 0;
                      const willLevel = gain > 0 && canLevelUpAfter(ch, gain);
                      return (
                        <div
                          key={ch.id}
                          onClick={() => router.push(`/characters/${ch.id}/view`)}
                          style={{
                            fontSize: '0.78rem', color: 'var(--color-text-muted)',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            cursor: 'pointer', padding: '0.25rem 0.375rem',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            marginTop: '0.2rem',
                          }}
                        >
                          <span style={{ color: 'var(--color-text)' }}>{ch.name}</span>
                          {' · '}{ch.character_class} · Lv {ch.level}
                          {' · '}{ch.xp.toLocaleString()} XP
                          {gain > 0 && (
                            <span style={{ color: 'var(--color-gold)', fontSize: '0.7rem' }}>+{gain}</span>
                          )}
                          {willLevel && (
                            <span title="Can level up!" style={{ fontSize: '0.8rem' }}>⬆️</span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>👁</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
