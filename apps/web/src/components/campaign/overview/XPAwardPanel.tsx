'use client';

import {
  getPrimeAbilities,
  getXPModifier,
  getKindredXPBonus,
  applyXPModifiers,
} from '@dolmenwood/rules-engine';
import type { CampaignData } from '@/lib/data/campaigns';
import { canLevelUpAfter } from './types';
import type { XPAwardState } from './types';

interface Props {
  campaign: CampaignData;
  award: XPAwardState;
  onPatch: (patch: Partial<XPAwardState>) => void;
  onAward: () => void;
}

export function XPAwardPanel({ campaign, award, onPatch, onAward }: Props) {
  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <button
        onClick={() => onPatch({ showPanel: !award.showPanel })}
        style={{
          width: '100%', padding: '0.625rem 1rem',
          backgroundColor: 'var(--color-bg)', border: 'none',
          color: 'var(--color-primary)', fontSize: '0.8rem',
          cursor: 'pointer', textAlign: 'left', minHeight: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span>✨ Award XP</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {award.lastAwardAt != null ? `Last: ${award.lastAwardAt} XP` : ''}
          {' '}{award.showPanel ? '▲' : '▼'}
        </span>
      </button>

      {award.showPanel && (
        <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              min="0"
              value={award.baseXP}
              onChange={e => onPatch({ baseXP: e.target.value, error: '' })}
              placeholder="Base XP (e.g. 300)"
              style={{
                flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px',
                border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)', fontSize: '0.875rem', minHeight: '44px',
              }}
            />
            <button
              onClick={onAward}
              disabled={award.awarding}
              style={{
                padding: '0.5rem 1rem', borderRadius: '6px',
                backgroundColor: award.awarding ? 'var(--color-border)' : 'var(--color-primary)',
                color: '#fff', border: 'none', fontSize: '0.875rem',
                cursor: award.awarding ? 'not-allowed' : 'pointer',
                minHeight: '44px', whiteSpace: 'nowrap',
              }}
            >
              {award.awarding ? 'Awarding…' : 'Award to All'}
            </button>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={award.applyModifier}
              onChange={e => onPatch({ applyModifier: e.target.checked })}
            />
            Apply XP modifier (based on prime abilities)
          </label>

          {award.error && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>
              {award.error}
            </div>
          )}

          {parseInt(award.baseXP.trim(), 10) > 0 && campaign.members.some(m => m.characters.length > 0) && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
               {campaign.members.flatMap(m => m.characters).map(ch => {
                const applyMod = award.applyModifier;
                const baseVal = parseInt(award.baseXP.trim(), 10) || 0;
                const gain = applyMod
                  ? applyXPModifiers(baseVal, ch.character_class, ch.ability_scores, ch.kindred)
                  : baseVal;
                const willLevel = canLevelUpAfter(ch, gain);
                const primes = getPrimeAbilities(ch.character_class);
                 const scores = primes.map(p => ch.ability_scores[p.toLowerCase()] ?? 0);
                const abilityMod = applyMod ? getXPModifier(scores) : 0;
                const kindredBonus = applyMod ? getKindredXPBonus(ch.kindred) : 0;
                const totalMod = abilityMod + kindredBonus;
                const modLabel = totalMod !== 0
                  ? ` (${totalMod > 0 ? '+' : ''}${totalMod}%${kindredBonus > 0 ? ` incl. +${kindredBonus}% ${ch.kindred}` : ''})`
                  : '';
                return (
                  <div key={ch.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                    <span>
                      {ch.name}
                      {willLevel && <span title="Level up eligible!"> ⬆️</span>}
                    </span>
                    <span style={{ color: 'var(--color-gold)' }}>
                      +{gain} XP{modLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
