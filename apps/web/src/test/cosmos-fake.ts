/**
 * Shared in-memory fake of `@/lib/cosmos/client` for unit tests. Mirrors
 * the Cosmos behaviors the data layer depends on:
 *  - point reads are partition-scoped (wrong partition ⇒ not found)
 *  - reads/queries return clones, never store references
 *  - replace enforces IfMatch ETags (412 on staleness)
 *
 * Test files mock the real module with:
 *   vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));
 */

type Doc = Record<string, unknown> & { id: string; _etag?: string };

const stores = new Map<string, Map<string, Doc>>();

export const fakeState = {
  etagCounter: 0,
  /** When true, the next replace 412s once (simulating a concurrent writer). */
  failNextReplaceWith412: false,
  replaceCalls: 0,
};

/** Stable per-container Map — safe to capture in tests across resets. */
export function store(name: string): Map<string, Doc> {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name)!;
}

export function resetFake(): void {
  for (const m of stores.values()) m.clear();
  fakeState.etagCounter = 0;
  fakeState.failNextReplaceWith412 = false;
  fakeState.replaceCalls = 0;
}

function partitionKeyOf(name: string, doc: Doc): unknown {
  if (name === 'characters') return doc.ownerId;
  if (name === 'notifications') return doc.accountId;
  if (name === 'catalog_items') return doc.itemType;
  return doc.id; // accounts, campaigns
}

type QueryArg = string | { query: string; parameters?: { name: string; value: unknown }[] };

function runQuery(name: string, q: QueryArg): Doc[] {
  const query = typeof q === 'string' ? q : q.query;
  const params = typeof q === 'string' ? [] : (q.parameters ?? []);
  const param = (n: string) => params.find((p) => p.name === n)?.value;
  let all = [...store(name).values()].map((d) => structuredClone(d));

  if (query.includes('c.email = @email')) {
    all = all.filter((d) => d.email === param('@email'));
  }
  if (query.includes('c.id = @id')) {
    all = all.filter((d) => d.id === param('@id'));
  }
  if (query.includes('c.ownerId = @me')) {
    all = all.filter((d) => d.ownerId === param('@me'));
  }
  if (query.includes('c.ownerId = @id')) {
    all = all.filter((d) => d.ownerId === param('@id'));
  }
  if (query.includes('c.accountId = @id')) {
    all = all.filter((d) => d.accountId === param('@id'));
  }
  if (query.includes('c.refereeId = @id')) {
    all = all.filter((d) => d.refereeId === param('@id'));
  }
  if (query.includes('c.inviteCode = @code')) {
    all = all.filter((d) => d.inviteCode === param('@code'));
  }
  if (query.includes('m.accountId = @id')) {
    all = all.filter((d) =>
      ((d.members as { accountId: string }[] | undefined) ?? []).some(
        (m) => m.accountId === param('@id'),
      ),
    );
  }
  if (query.includes('ORDER BY c.name')) {
    all.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  if (query.includes('COUNT(1)')) {
    return [all.length] as unknown as Doc[];
  }
  return all;
}

export function getContainer(name: string) {
  return {
    item: (id: string, partitionKey?: unknown) => ({
      read: async () => {
        const doc = store(name).get(id);
        const visible = doc && partitionKeyOf(name, doc) === partitionKey;
        return { resource: visible ? structuredClone(doc) : undefined };
      },
      replace: async (
        doc: Doc,
        opts?: { accessCondition?: { type: string; condition: string } },
      ) => {
        fakeState.replaceCalls++;
        const stored = store(name).get(doc.id);
        if (!stored) throw Object.assign(new Error('not found'), { code: 404 });
        if (fakeState.failNextReplaceWith412) {
          fakeState.failNextReplaceWith412 = false;
          stored._etag = `etag-${++fakeState.etagCounter}`;
          throw Object.assign(new Error('precondition failed'), { code: 412 });
        }
        if (opts?.accessCondition && opts.accessCondition.condition !== stored._etag) {
          throw Object.assign(new Error('precondition failed'), { code: 412 });
        }
        const next = { ...doc, _etag: `etag-${++fakeState.etagCounter}` };
        store(name).set(doc.id, next);
        return { resource: next };
      },
      delete: async () => {
        store(name).delete(id);
      },
    }),
    items: {
      create: async (doc: Doc) => {
        const next = { ...doc, _etag: `etag-${++fakeState.etagCounter}` };
        store(name).set(doc.id, next);
        return { resource: next };
      },
      upsert: async (doc: Doc) => {
        const next = { ...doc, _etag: `etag-${++fakeState.etagCounter}` };
        store(name).set(doc.id, next);
        return { resource: next };
      },
      query: (q: QueryArg) => ({
        fetchAll: async () => ({ resources: runQuery(name, q) }),
      }),
    },
  };
}
