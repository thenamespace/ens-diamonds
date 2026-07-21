import { normalize } from "viem/ens";
import { getKv } from "./kv";

// Normalize a user-supplied name to a bare label (no .eth), or null if invalid
// / too short. Mirrors the ENS rules used elsewhere.
export function normalizeLabel(raw: string): string | null {
  const stripped = raw.trim().replace(/\.eth$/i, "");
  let n: string;
  try {
    n = normalize(stripped);
  } catch {
    return null;
  }
  // A .eth label maxes out at 63 chars; reject longer so an oversized string
  // can't become a giant Redis key (watchers:<label>) and bloat the store.
  if (n.length < 3 || n.length > 63) return null;
  return n;
}

const watchKey = (addr: string) => `watch:${addr.toLowerCase()}`;
const watchersKey = (label: string) => `watchers:${label}`;

export async function getWatched(addr: string): Promise<string[]> {
  const kv = getKv();
  const members = (await kv.smembers(watchKey(addr))) as string[];
  return members.sort();
}

export async function addWatch(addr: string, label: string): Promise<void> {
  const kv = getKv();
  const a = addr.toLowerCase();
  await Promise.all([kv.sadd(watchKey(a), label), kv.sadd(watchersKey(label), a)]);
}

export async function removeWatch(addr: string, label: string): Promise<void> {
  const kv = getKv();
  const a = addr.toLowerCase();
  await Promise.all([kv.srem(watchKey(a), label), kv.srem(watchersKey(label), a)]);
}

// label → watcher count for every label anyone is watching. Computed straight
// from the authoritative `watchers:<label>` sets (SCAN the keys, SCARD each) so
// it can NEVER drift from the source of truth — unlike a denormalized counter.
// Watched labels are sparse; the whole thing is one SCAN + a pipelined SCARD.
// Returns an empty map if KV is unreachable so Trending degrades gracefully.
export async function getWatcherCounts(): Promise<Map<string, number>> {
  const prefix = "watchers:";
  try {
    const kv = getKv();
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await kv.scan(cursor, { match: `${prefix}*`, count: 500 });
      cursor = String(next);
      // Skip the legacy "watchers:z" ZSET (a different type — SCARD would throw).
      for (const k of batch) if (k.startsWith(prefix) && k !== "watchers:z") keys.push(k);
    } while (cursor !== "0");

    const m = new Map<string, number>();
    if (keys.length === 0) return m;

    const pipe = kv.pipeline();
    for (const k of keys) pipe.scard(k);
    const counts = (await pipe.exec()) as number[];
    keys.forEach((k, i) => {
      const n = Number(counts[i]) || 0;
      if (n > 0) m.set(k.slice(prefix.length), n);
    });
    return m;
  } catch {
    return new Map();
  }
}
