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
