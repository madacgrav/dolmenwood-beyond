import { describe, it, expect } from 'vitest';
import { getKnacks, getKnack } from '../knacks';

describe('getKnacks', () => {
  it('returns six knacks in d6 order', () => {
    expect(getKnacks().map(k => k.name)).toEqual([
      'Bird Friend', 'Lock Singer', 'Root Friend',
      'Thread Whistling', 'Wood Kenning', 'Yeast Master',
    ]);
  });
  it('each knack has abilities at levels 1, 3, 5, 7', () => {
    for (const k of getKnacks()) {
      expect(k.abilities.map(a => a.level)).toEqual([1, 3, 5, 7]);
    }
  });
});

describe('getKnack', () => {
  it('round-trips by name and returns null for unknown', () => {
    expect(getKnack('Wood Kenning')?.abilities).toHaveLength(4);
    expect(getKnack('Nope')).toBeNull();
  });
});
