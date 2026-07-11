'use client';

import { useRouter } from 'next/navigation';
import type { CampaignData } from '@/lib/api/campaigns';
import { CurrentDateCard } from './CurrentDateCard';
import { RestPrompt } from './RestPrompt';

interface Props {
  campaign: CampaignData;
  userId: string;
}

export function PartyRoster({ campaign, userId }: Props) {
  const router = useRouter();
  const myCharacters = campaign.members.find(m => m.account_id === userId)?.characters ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
    <CurrentDateCard date={campaign.current_date} />
    <RestPrompt characters={myCharacters} currentDate={campaign.current_date} />
    <div
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}
    >
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: '700', fontSize: '1rem', color: 'var(--color-text)' }}>
          {campaign.name}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
          {campaign.members.length} adventurer{campaign.members.length !== 1 ? 's' : ''}
        </div>
      </div>

      {campaign.members.map(member => (
        <div
          key={member.account_id}
          style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: member.account_id === userId ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <span style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.875rem' }}>
              {member.display_name}
            </span>
            {member.account_id === userId && (
              <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--color-primary)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                You
              </span>
            )}
          </div>
          {member.characters.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No characters yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {member.characters.map(ch => {
                const hpPct = (ch.hp_max ?? 0) > 0 ? Math.max(0, (ch.hp_current ?? 0) / ch.hp_max!) : 0;
                const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';
                return (
                  <div
                    key={ch.id}
                    onClick={() => { if (member.account_id === userId) router.push(`/characters/${ch.id}`); }}
                    style={{
                      backgroundColor: 'var(--color-bg)', borderRadius: '8px',
                      padding: '0.5rem 0.625rem', border: '1px solid var(--color-border)',
                      cursor: member.account_id === userId ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                        <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                          {ch.character_class}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Lv {ch.level}</span>
                        {(ch.hp_max ?? 0) > 0 && (
                          <span style={{ fontSize: '0.72rem', color: hpColor, fontWeight: '600' }}>
                            ❤️ {ch.hp_current}/{ch.hp_max}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginBottom: (ch.hp_max ?? 0) > 0 ? '0.375rem' : 0 }}>
                      {ch.kindred}
                    </div>
                    {(ch.hp_max ?? 0) > 0 && (
                      <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '2px', transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
    </div>
  );
}
