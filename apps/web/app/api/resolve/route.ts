import { isAddress, getAddress } from "viem";
import { normalize } from "viem/ens";
import { ensClient } from "@/lib/ens-client";

export const runtime = "nodejs";

// Resolve an invitee entry to a checksummed address, in both directions:
//  - an ENS name  → forward-resolve to its address (name shown in the UI)
//  - a 0x address → reverse-resolve to its primary ENS name (preferred in the UI)
// Resolution runs against mainnet ENS; the address is the same on Sepolia.
// GET /api/resolve?q=<name-or-address> → { ok, address?, name? }
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ ok: false });

  try {
    if (isAddress(q)) {
      const address = getAddress(q);
      let name: string | null = null;
      try {
        name = await ensClient.getEnsName({ address });
      } catch {
        /* no primary name set — address is still valid */
      }
      return Response.json({ ok: true, address, name });
    }

    // Only treat dotted input as an ENS name (a bare word isn't resolvable).
    if (q.includes(".")) {
      const name = normalize(q);
      const address = await ensClient.getEnsAddress({ name });
      if (address) return Response.json({ ok: true, address: getAddress(address), name });
      return Response.json({ ok: false, name });
    }

    return Response.json({ ok: false });
  } catch {
    return Response.json({ ok: false });
  }
}
