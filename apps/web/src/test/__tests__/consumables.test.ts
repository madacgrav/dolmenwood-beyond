import { describe, it, expect } from 'vitest';
import { lightSourceFor } from '../../lib/light-data';
import { canonicalName } from '../../lib/inventory/consumables';
import { parseCountSuffix } from '../../lib/inventory/parse-count';

describe('lightSourceFor (alias-aware)', () => {
  it('matches exact, plural, cased, and count-suffixed names', () => {
    expect(lightSourceFor('Torch')?.name).toBe('Torch');
    expect(lightSourceFor('Torches')?.name).toBe('Torch');
    expect(lightSourceFor('torch')?.name).toBe('Torch');
    expect(lightSourceFor('Torch (3)')?.name).toBe('Torch');
    expect(lightSourceFor('Torches x3')?.name).toBe('Torch');
  });

  it('matches oil flask variants', () => {
    expect(lightSourceFor('Oil Flask')?.name).toBe('Oil Flask');
    expect(lightSourceFor('Flask of Oil')?.name).toBe('Oil Flask');
    expect(lightSourceFor('lamp oil')?.name).toBe('Oil Flask');
  });

  it('matches candles and firewood aliases', () => {
    expect(lightSourceFor('Candles')?.name).toBe('Candle');
    expect(lightSourceFor('Logs')?.name).toBe('Firewood');
    expect(lightSourceFor('wood')?.name).toBe('Firewood');
  });

  it('does not match lanterns or unrelated items', () => {
    expect(lightSourceFor('Lantern')).toBeUndefined();
    expect(lightSourceFor('Rope')).toBeUndefined();
    expect(lightSourceFor('Oil-soaked rag')).toBeUndefined();
  });
});

describe('canonicalName', () => {
  it('canonicalizes ammo names to singular', () => {
    expect(canonicalName('Arrows (20)')).toBe('Arrow');
    expect(canonicalName('Arrows')).toBe('Arrow');
    expect(canonicalName('Crossbow Quarrels')).toBe('Crossbow Quarrel');
    expect(canonicalName('quarrels')).toBe('Crossbow Quarrel');
    expect(canonicalName('Sling Stones')).toBe('Sling Stone');
  });

  it('canonicalizes light sources via the registry', () => {
    expect(canonicalName('Torches (3)')).toBe('Torch');
    expect(canonicalName('candles')).toBe('Candle');
    expect(canonicalName('flask of oil')).toBe('Oil Flask');
  });

  it('canonicalizes rations', () => {
    expect(canonicalName('Preserved Rations')).toBe('Ration');
    expect(canonicalName('rations')).toBe('Ration');
  });

  it('passes unknown names through (count-stripped only)', () => {
    expect(canonicalName('Rope')).toBe('Rope');
    expect(canonicalName('Bag of marbles x 2')).toBe('Bag of marbles');
    expect(canonicalName('Lantern')).toBe('Lantern');
  });

  it('canonicalizes bundle-phrase ammo names', () => {
    expect(canonicalName('Arrows (quiver of 20)')).toBe('Arrow');
    expect(canonicalName('Quarrels (case of 20)')).toBe('Crossbow Quarrel');
  });
});

describe('parseCountSuffix (bundle phrases)', () => {
  it('parses bundle-of-N parentheticals', () => {
    expect(parseCountSuffix('Arrows (quiver of 20)')).toEqual({ name: 'Arrows', quantity: 20 });
    expect(parseCountSuffix('Quarrels (case of 20)')).toEqual({ name: 'Quarrels', quantity: 20 });
    expect(parseCountSuffix('Candles (bundle of 12)')).toEqual({ name: 'Candles', quantity: 12 });
  });

  it('still parses plain numeric suffixes', () => {
    expect(parseCountSuffix('Torches (3)')).toEqual({ name: 'Torches', quantity: 3 });
    expect(parseCountSuffix('Torches x 3')).toEqual({ name: 'Torches', quantity: 3 });
  });

  it('leaves non-count parentheticals untouched', () => {
    expect(parseCountSuffix('Rations (1 week)')).toEqual({ name: 'Rations (1 week)', quantity: null });
    expect(parseCountSuffix('Horse Feed (per day)')).toEqual({ name: 'Horse Feed (per day)', quantity: null });
    expect(parseCountSuffix('Potion (minor)')).toEqual({ name: 'Potion (minor)', quantity: null });
  });
});
