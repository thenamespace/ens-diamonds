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
  if (n.length < 3) return null;
  return n;
}

const watchKey = (addr: string) => `watch:${addr.toLowerCase()}`;
const watchersKey = (label: string) => `watchers:${label}`;
// Global leaderboard of watcher counts, drives the Discover "Trending" sort.
// Maintained incrementally alongside the per-label watcher sets.
const trendingKey = "watchers:z";

export async function getWatched(addr: string): Promise<string[]> {
  const kv = getKv();
  const members = (await kv.smembers(watchKey(addr))) as string[];
  return members.sort();
}

export async function addWatch(addr: string, label: string): Promise<void> {
  const kv = getKv();
  const a = addr.toLowerCase();
  // Only bump the leaderboard on a first-time watch (sadd returns 1 when newly
  // added, 0 if already present) so re-watching can't inflate the count.
  const added = await kv.sadd(watchersKey(label), a);
  await Promise.all([kv.sadd(watchKey(a), label), added ? kv.zincrby(trendingKey, 1, label) : Promise.resolve()]);
}

export async function removeWatch(addr: string, label: string): Promise<void> {
  const kv = getKv();
  const a = addr.toLowerCase();
  const removed = await kv.srem(watchersKey(label), a);
  await Promise.all([kv.srem(watchKey(a), label), removed ? kv.zincrby(trendingKey, -1, label) : Promise.resolve()]);
}

// label → watcher count for every label anyone is currently watching (counts > 0),
// newest-watched first is irrelevant here — callers order by score. Returns an
// empty map if KV is unreachable so the Trending sort degrades gracefully.
export async function getTrendingScores(): Promise<Map<string, number>> {
  try {
    const flat = (await getKv().zrange(trendingKey, 0, -1, { withScores: true })) as (string | number)[];
    const m = new Map<string, number>();
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const score = Number(flat[i + 1]);
      if (score > 0) m.set(String(flat[i]), score);
    }
    return m;
  } catch {
    return new Map();
  }
}
