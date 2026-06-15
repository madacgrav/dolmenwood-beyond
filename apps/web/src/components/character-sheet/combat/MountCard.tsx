'use client';
import type { DBMount } from '@/lib/data/mounts';

interface Props {
  mount: DBMount;
  readOnly: boolean;
  adjustMountHP: (mount: DBMount, delta: number) => void;
  deleteMount: (id: string) => Promise<void>;
}

export function MountCard({ mount, readOnly, adjustMountHP, deleteMount }: Props) {
  const hpPct = (mount.hp_max ?? 0) > 0 ? Math.max(0, (mount.hp_current ?? 0) / mount.hp_max!) : 0;
  const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Mount card header */}
      <div style={{ padding: '0.75rem 0.875rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)' }}>
              {mount.name}
            </span>
            <span style={{
              fontSize: '0.65rem', fontWeight: '600',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px', padding: '0.1rem 0.375rem',
              color: 'var(--color-text-muted)',
            }}>
              {mount.mount_type}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              {mount.speed} ft/round
            </span>
          </div>

          {mount.has_full_stats && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                {[
                  { label: 'AC', value: mount.ac ?? '—' },
                  { label: 'ATK', value: mount.attack_bonus != null ? `+${mount.attack_bonus}` : '—' },
                  { label: 'Morale', value: mount.morale ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: '6px', padding: '0.2rem 0.5rem', textAlign: 'center', minWidth: '46px',
                  }}>
                    <div style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--color-primary)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* HP bar */}
              {(mount.hp_max ?? 0) > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                    <span style={{ color: hpColor, fontWeight: '600' }}>
                      ❤️ {mount.hp_current ?? 0} / {mount.hp_max}
                    </span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--color-border)', overflow: 'hidden', marginBottom: '0.375rem' }}>
                    <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                      {[-5, -1, 1, 5].map(d => (
                        <button
                          key={d}
                          onClick={() => adjustMountHP(mount, d)}
                          style={{
                            padding: '0.2rem 0.5rem', borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: d < 0
                              ? 'color-mix(in srgb, var(--color-danger) 12%, var(--color-bg))'
                              : 'color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))',
                            color: d < 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                            fontSize: '0.75rem', fontWeight: '700',
                            cursor: 'pointer', minHeight: '44px',
                          }}
                        >
                          {d > 0 ? `+${d}` : d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!mount.has_full_stats && (
            <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Tack &amp; inventory tracked in Inventory tab
            </div>
          )}
        </div>

        {!readOnly && (
          <button
            onClick={() => deleteMount(mount.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-danger)', fontSize: '1rem',
              padding: '0.25rem', borderRadius: '4px',
              minHeight: '44px', minWidth: '44px',
              flexShrink: 0,
            }}
            aria-label={`Remove ${mount.name}`}
            title="Remove mount"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
