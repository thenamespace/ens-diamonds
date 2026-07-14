import { isAddress, getAddress } from "viem";
import { normalize } from "viem/ens";
import { fetchAddress, fetchPrimaryName } from "@/lib/ens";

export const runtime = "nodejs";

// Resolve an invitee entry to a checksummed address, in both directions, via
// Resolvio (the same ENS backend the rest of the app uses — no mainnet RPC):
//  - an ENS name  → forward-resolve to its address (name shown in the UI)
//  - a 0x address → reverse-resolve to its primary ENS name (preferred in the UI)
// GET /api/resolve?q=<name-or-address> → { ok, address?, name? }
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length > 255) return Response.json({ ok: false });
  if (!q) return Response.json({ ok: false });

  try {
    if (isAddress(q)) {
      const address = getAddress(q);
      const name = await fetchPrimaryName(address); // Resolvio reverse
      return Response.json({ ok: true, address, name });
    }

    // Only treat dotted input as an ENS name (a bare word isn't resolvable).
    if (q.includes(".")) {
      const name = normalize(q);
      const resolved = await fetchAddress(name); // Resolvio forward
      if (resolved && isAddress(resolved)) return Response.json({ ok: true, address: getAddress(resolved), name });
      return Response.json({ ok: false, name });
    }

    return Response.json({ ok: false });
  } catch {
    return Response.json({ ok: false });
  }
}
