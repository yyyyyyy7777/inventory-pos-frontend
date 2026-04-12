/**
 * Merge server-fetched sales with local-only rows so refreshes never drop
 * optimistic or queued sales, and multi-cabinet state is preserved.
 */

export interface SaleMergeRow {
  id: string;
  requestKey?: string;
  cabinet: string;
  synced?: boolean;
  date: string;
  createdAt?: string;
}

export function mergeServerWithUnsyncedLocal<T extends SaleMergeRow>(
  serverRows: T[],
  unsyncedLocals: T[]
): T[] {
  const serverIds = new Set(serverRows.map((s) => s.id));
  const serverReq = new Set(
    serverRows.map((s) => s.requestKey).filter(Boolean) as string[]
  );
  const extra = unsyncedLocals.filter(
    (u) =>
      !serverIds.has(u.id) &&
      !(u.requestKey && serverReq.has(u.requestKey))
  );
  const byId = new Map<string, T>();
  for (const s of serverRows) byId.set(s.id, s);
  for (const u of extra) byId.set(u.id, u);
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.createdAt || b.date).getTime() -
      new Date(a.createdAt || a.date).getTime()
  );
}

export function mergeAfterCabinetRefresh<T extends SaleMergeRow>(
  prev: T[],
  cabinet: string,
  fetched: T[]
): T[] {
  if (cabinet === "all") {
    const unsynced = prev.filter((s) => s.synced === false);
    return mergeServerWithUnsyncedLocal(fetched, unsynced);
  }
  const serverIds = new Set(fetched.map((s) => s.id));
  const serverReq = new Set(
    fetched.map((s) => s.requestKey).filter(Boolean) as string[]
  );
  const otherCabinets = prev.filter((s) => s.cabinet !== cabinet);
  const pendingSameCab = prev.filter(
    (s) =>
      s.cabinet === cabinet &&
      s.synced === false &&
      !serverIds.has(s.id) &&
      !(s.requestKey && serverReq.has(s.requestKey))
  );
  const byId = new Map<string, T>();
  for (const s of otherCabinets) byId.set(s.id, s);
  for (const s of pendingSameCab) byId.set(s.id, s);
  for (const s of fetched) byId.set(s.id, s);
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.createdAt || b.date).getTime() -
      new Date(a.createdAt || a.date).getTime()
  );
}
