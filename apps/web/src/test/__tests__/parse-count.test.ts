import { describe, it, expect } from 'vitest';
import { parseCountSuffix } from '../../lib/inventory/parse-count';

describe('parseCountSuffix', () => {
  it('splits a trailing parenthesized count', () => {
    expect(parseCountSuffix('Torches (3)')).toEqual({ name: 'Torches', quantity: 3 });
    expect(parseCountSuffix('Iron Spikes (12)')).toEqual({ name: 'Iron Spikes', quantity: 12 });
  });

  it('splits trailing x-counts with and without spaces', () => {
    expect(parseCountSuffix('Bag of marbles x 2')).toEqual({ name: 'Bag of marbles', quantity: 2 });
    expect(parseCountSuffix('Torches x3')).toEqual({ name: 'Torches', quantity: 3 });
    expect(parseCountSuffix('Arrows ×20')).toEqual({ name: 'Arrows', quantity: 20 });
  });

  it('leaves non-numeric parentheticals untouched', () => {
    expect(parseCountSuffix('Potion (minor)')).toEqual({ name: 'Potion (minor)', quantity: null });
    expect(parseCountSuffix('Horse Feed (per day)')).toEqual({ name: 'Horse Feed (per day)', quantity: null });
  });

  it('leaves plain names untouched', () => {
    expect(parseCountSuffix('Torch')).toEqual({ name: 'Torch', quantity: null });
    expect(parseCountSuffix('Nails (dozen)')).toEqual({ name: 'Nails (dozen)', quantity: null });
  });

  it('does not treat a word-final x as a multiplier', () => {
    expect(parseCountSuffix('Box 3')).toEqual({ name: 'Box 3', quantity: null });
  });

  it('rejects zero counts and empty names', () => {
    expect(parseCountSuffix('Torches (0)')).toEqual({ name: 'Torches (0)', quantity: null });
    expect(parseCountSuffix('(3)')).toEqual({ name: '(3)', quantity: null });
  });

  it('trims surrounding whitespace', () => {
    expect(parseCountSuffix('  Torches (3)  ')).toEqual({ name: 'Torches', quantity: 3 });
  });
});
