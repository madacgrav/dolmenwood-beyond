'use client';
import { primaryBtn as sharedPrimaryBtn } from '@/components/wizard/shared';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';

const ADVENTURE_GEAR = [
  'Torches (6)', 'Rope (50ft)', 'Rations (1 week)', 'Waterskin', 'Blanket',
  'Flint & Steel', 'Oil Flask', 'Iron Spikes (12)', 'Small Hammer', 'Mirror (steel)',
  'Chalk (3)', 'Crowbar', 'Pole (10ft)', 'Sack (large)', 'Bandages', 'Caltrops',
  'Grappling Hook', 'Lantern', 'Whetstone', 'Writing Kit', 'Fishhook & Line',
  'Candles (6)', 'Nails (dozen)', 'Bell (small)',
];

const CLASS_STARTING_ITEMS: Record<string, string[]> = {
  Fighter: ['Battle axe', 'Chain mail armour', 'Shield'],
  Knight: ['Sword', 'Plate armour', 'Shield', 'Warhorse'],
  Cleric: ['Mace', 'Chain mail armour', 'Holy symbol'],
  Friar: ['Staff', 'Leather armour', 'Holy symbol'],
  Magician: ['Dagger', 'Spellbook', 'Inkpot & quill'],
  Enchanter: ['Dagger', 'Spellbook', 'Fairy charm'],
  Thief: ['Short sword', 'Leather armour', "Thieves' tools"],
  Hunter: ['Short bow', 'Arrows (20)', 'Leather armour'],
  Bard: ['Dagger', 'Musical instrument', 'Travelling clothes'],
};

function classItemsFor(cls: string): string[] {
  return CLASS_STARTING_ITEMS[cls] ?? ['Dagger', 'Travelling clothes'];
}

export function Step8Equipment({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const { characterClass, kindred, setEquipment, setStartingGold } = useWizardStore();
  const [items, setItems] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [buyMode, setBuyMode] = useState(false);
  const [gold, setGold] = useState(0);

  async function handleRoll() {
    setRolling(true);
    setItems([]);

    const classItems = classItemsFor(characterClass ?? 'Fighter');

    // Roll up to 3 adventuring items (d24 each, avoid duplicates)
    const gearRolls: string[] = [];
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 300));
      const idx = Math.floor(Math.random() * ADVENTURE_GEAR.length);
      const item = ADVENTURE_GEAR[idx];
      if (item && !gearRolls.includes(item)) gearRolls.push(item);
    }

    const trinket = `${kindred ?? 'Human'} trinket`;
    const rolledItems = [...classItems, ...gearRolls, trinket];
    setItems(rolledItems);
    setEquipment(rolledItems);
    setStartingGold(0);
    setRolled(true);
    setRolling(false);
  }

  function handleBuyMode() {
    setBuyMode(true);
    const g = (Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6)) * 10;
    setGold(g);
    setStartingGold(g);
    setEquipment([]);
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh' }}>
      <WizardProgress step={8} totalSteps={13} title="Starting Equipment"
        onBack={() => router.push(`${basePath}/7`)} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => { setBuyMode(false); setRolled(false); setItems([]); setEquipment([]); setStartingGold(0); }}
            style={{
              flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
              backgroundColor: !buyMode ? 'var(--color-primary)' : 'var(--color-surface)',
              color: !buyMode ? 'white' : 'var(--color-text)',
              border: `1px solid ${!buyMode ? 'var(--color-primary)' : 'var(--color-border)'}`,
              fontWeight: '600', fontSize: '0.875rem',
            }}>
            Roll Equipment
          </button>
          <button
            onClick={handleBuyMode}
            style={{
              flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer',
              backgroundColor: buyMode ? 'var(--color-primary)' : 'var(--color-surface)',
              color: buyMode ? 'white' : 'var(--color-text)',
              border: `1px solid ${buyMode ? 'var(--color-primary)' : 'var(--color-border)'}`,
              fontWeight: '600', fontSize: '0.875rem',
            }}>
            Buy Equipment
          </button>
        </div>

        {buyMode ? (
          <div style={{
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '10px', padding: '1rem', marginBottom: '1rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2rem', color: 'var(--color-gold)', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }}>
              {gold} gp
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Starting gold to spend at market
            </div>
          </div>
        ) : (
          <>
            {!rolled && !rolling && (
              <button onClick={handleRoll} style={primaryBtn}>
                Roll Starting Equipment
              </button>
            )}
            {rolling && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--color-text-muted)' }}>
                Rolling equipment…
              </div>
            )}
            {items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {items.map((item, i) => (
                  <div key={i} style={{
                    backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: '8px', padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center',
                  }}>
                    <span style={{ color: 'var(--color-primary)', flexShrink: 0 }}>✓</span>
                    <span style={{ color: 'var(--color-text)', fontSize: '0.9rem' }}>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {(rolled || buyMode) && (
          <button onClick={() => router.push(`${basePath}/9`)} style={primaryBtn}>
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}


const primaryBtn: React.CSSProperties = { ...sharedPrimaryBtn, marginBottom: '0.5rem' };
