import { describe, it, expect } from 'vitest';
import { splitRoster, type RosterMember } from '@/lib/api/roster';

const roster: RosterMember[] = [
  { account_id: 'a', display_name: 'Alice', is_referee: true },
  { account_id: 'b', display_name: 'Bob', is_referee: false },
  { account_id: 'c', display_name: 'Cara', is_referee: false },
];

describe('splitRoster', () => {
  it('puts everyone in notResponded when there are no responses', () => {
    const { groups, notResponded } = splitRoster(roster, []);
    expect(Object.keys(groups)).toHaveLength(0);
    expect(notResponded.map(m => m.account_id)).toEqual(['a', 'b', 'c']);
  });

  it('groups by status and preserves roster order, remainder in notResponded', () => {
    const { groups, notResponded } = splitRoster(roster, [
      { account_id: 'c', status: 'busy' as const },
      { account_id: 'a', status: 'available' as const },
    ]);
    expect(groups.available?.map(m => m.account_id)).toEqual(['a']);
    expect(groups.busy?.map(m => m.account_id)).toEqual(['c']);
    expect(notResponded.map(m => m.account_id)).toEqual(['b']);
  });

  it('places every roster member in exactly one bucket', () => {
    const { groups, notResponded } = splitRoster(roster, [
      { account_id: 'a', status: 'yes' as const },
      { account_id: 'b', status: 'no' as const },
    ]);
    const total = Object.values(groups).reduce((n, g) => n + (g?.length ?? 0), 0) + notResponded.length;
    expect(total).toBe(roster.length);
  });

  it('ignores responses for accounts not in the roster', () => {
    const { groups, notResponded } = splitRoster(roster, [
      { account_id: 'zzz', status: 'yes' as const },
    ]);
    expect(groups.yes).toBeUndefined();
    expect(notResponded).toHaveLength(3);
  });

  it('handles an empty roster', () => {
    const { groups, notResponded } = splitRoster([], [{ account_id: 'a', status: 'x' as const }]);
    expect(Object.keys(groups)).toHaveLength(0);
    expect(notResponded).toHaveLength(0);
  });
});
