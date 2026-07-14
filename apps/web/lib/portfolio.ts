import { getKv } from "./kv";

// Labels a wallet registered solo through the app, recorded at registration
// time (the chain can't enumerate an address's names, and the Sepolia subgraph
// doesn't learn label strings from the premigration registrar). Every read is
// re-verified on-chain before display, so a stale record is harmless.
// Server-only — never import from a "use client" file.

const soloKey = (addr: string) => `solo:${addr.toLowerCase()}`;

export async function recordSoloName(addr: string, label: string): Promise<void> {
  await getKv().sadd(soloKey(addr), label.toLowerCase());
}

export async function getSoloNames(addr: string): Promise<string[]> {
  try {
    const labels = await getKv().smembers(soloKey(addr));
    return (labels ?? []).map(String);
  } catch {
    return [];
  }
}
