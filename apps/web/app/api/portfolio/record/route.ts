import { isAddress, getAddress, labelhash } from "viem";
import { sepoliaClient } from "@/lib/sepolia-client";
import { recordSoloName } from "@/lib/portfolio";
import { ENS_BASE_REGISTRAR, baseRegistrarAbi } from "@/lib/ens-registrar";
import { apiLimiter, clientId } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Record a solo-registered name for a wallet's portfolio. On-chain ownership is
// the auth: we only save the label if the claimed address actually owns it, so
// nobody can pollute someone else's portfolio (or their own with names they
// don't hold).
export async function POST(req: Request) {
  if (!(await apiLimiter(clientId(req), "portfolio-record"))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { address?: unknown; label?: unknown };
  const address = typeof body.address === "string" && isAddress(body.address) ? getAddress(body.address) : null;
  const label = typeof body.label === "string" ? body.label.trim().toLowerCase().replace(/\.eth$/, "") : "";
  if (!address || label.length < 3) return Response.json({ error: "Bad request" }, { status: 400 });

  try {
    const owner = (await sepoliaClient.readContract({
      address: ENS_BASE_REGISTRAR,
      abi: baseRegistrarAbi,
      functionName: "ownerOf",
      args: [BigInt(labelhash(label))],
    })) as string;
    if (owner.toLowerCase() !== address.toLowerCase()) return Response.json({ error: "Not the owner" }, { status: 403 });
  } catch {
    return Response.json({ error: "Name not registered" }, { status: 404 });
  }

  await recordSoloName(address, label);
  return Response.json({ ok: true });
}
