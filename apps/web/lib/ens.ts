// ENS reverse resolution (address → primary name) via Resolvio.
// https://api.resolvio.xyz/api-docs — no auth, mainnet reverse records.
import { isAddress, getAddress } from "viem";
import { ZERO } from "./chain";

const ROOT = "https://api.resolvio.xyz/ens/v2";
const REVERSE = `${ROOT}/reverse`;

type ReverseRecord = { name: string | null; hasReverseRecord: boolean; address: string };
type TextRecord = { key: string; value: string; exists: boolean };
type AddressRecord = { coin: number; chain: string; value?: string; exists: boolean };

/**
 * Forward-resolve an ENS name to its Ethereum address (coin type 60), or null
 * if the name doesn't resolve. Same Resolvio backend as the reverse lookups.
 */
export async function fetchAddress(name: string): Promise<string | null> {
  const res = await fetch(`${ROOT}/addresses/${encodeURIComponent(name)}?chains=eth`);
  if (!res.ok) return null;
  const data = (await res.json()) as { addresses?: AddressRecord[] };
  const eth = data.addresses?.find((a) => a.chain === "eth" && a.exists && a.value);
  return eth?.value ?? null;
}

/** Resolve a single address to its primary ENS name, or null if none set. */
export async function fetchPrimaryName(address: string): Promise<string | null> {
  const res = await fetch(`${REVERSE}/${address}`);
  if (!res.ok) return null;
  const data = (await res.json()) as ReverseRecord;
  return data?.name ?? null;
}

/**
 * Resolve many addresses at once. Returns a map keyed by lowercased address →
 * primary name (only addresses that have a name are included).
 */
export async function fetchPrimaryNames(addresses: string[]): Promise<Record<string, string>> {
  const valid = Array.from(
    new Set(addresses.filter((a) => isAddress(a) && a.toLowerCase() !== ZERO).map((a) => getAddress(a))),
  );
  if (valid.length === 0) return {};

  const res = await fetch(`${REVERSE}/bulk?addresses=${valid.join(",")}`);
  if (!res.ok) return {};
  // The bulk endpoint returns the records under `addresses` (the OpenAPI docs
  // mislabel it `result`); accept either for safety.
  const data = (await res.json()) as { addresses?: ReverseRecord[]; result?: ReverseRecord[] };
  const out: Record<string, string> = {};
  for (const r of data.addresses ?? data.result ?? []) {
    if (r.name) out[r.address.toLowerCase()] = r.name;
  }
  return out;
}

/**
 * Resolve the `avatar` text record for a name to a directly usable image URL
 * (Resolvio returns a gateway URL, e.g. https://euc.li/<name>, that already
 * handles NFT/IPFS avatars). Returns null if the name has no avatar set.
 */
export async function fetchAvatar(name: string): Promise<string | null> {
  const res = await fetch(`${ROOT}/texts/${encodeURIComponent(name)}?keys=avatar`);
  if (!res.ok) return null;
  const data = (await res.json()) as { texts?: TextRecord[] };
  const rec = data.texts?.find((t) => t.key === "avatar");
  return rec?.exists && rec.value ? rec.value : null;
}
