import { formatEther } from "viem";
import { getEnsNameData, weiToUsd, GRACE, PREMIUM } from "@/lib/ens-name";

export const runtime = "nodejs";

// Live ENS status + mainnet price for a label. Used by the vault-creation form
// (status gating) and the vault Buy panel (live price display).
// GET /api/name-status?label=<label> → { status, price? }
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("label") ?? "";
  const label = raw.trim().toLowerCase().replace(/\.eth$/, "");
  if (label.length < 3) return Response.json({ status: "tooShort" });
  try {
    const d = await getEnsNameData(label);
    const price = d.buyable
      ? {
          baseUsd: weiToUsd(d.baseWei, d.ethUsd),
          premiumUsd: weiToUsd(d.premiumWei, d.ethUsd),
          totalUsd: weiToUsd(d.totalWei, d.ethUsd),
          totalEth: Number(formatEther(d.totalWei)),
          // when the premium hits $0 (only meaningful while status === "premium")
          premiumEndsAt: d.status === "premium" ? d.expiry + GRACE + PREMIUM : null,
        }
      : null;
    return Response.json({ status: d.status, price });
  } catch {
    return Response.json({ status: "unknown", price: null });
  }
}
