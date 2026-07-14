import { formatEther, labelhash } from "viem";
import { getEnsNameData, weiToUsd, GRACE, PREMIUM } from "@/lib/ens-name";
import { sepoliaClient } from "@/lib/sepolia-client";
import { ENS_BASE_REGISTRAR, baseRegistrarAbi } from "@/lib/ens-registrar";

export const runtime = "nodejs";

// Live ENS status + mainnet price for a label. Used by the vault-creation form
// (status gating) and the vault Buy panel (live price display).
// GET /api/name-status?label=<label> → { status, price?, available? }
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("label") ?? "";
  if (raw.length > 255) return Response.json({ status: "invalid", available: null });
  const label = raw.trim().toLowerCase().replace(/\.eth$/, "");
  if (label.length > 63) return Response.json({ status: "invalid", available: null });
  if (label.length < 3) return Response.json({ status: "tooShort", available: null });

  // Start both queries concurrently (mainnet data and app-chain availability)
  const ensDataPromise = getEnsNameData(label);
  const availabilityPromise = (async () => {
    let available: boolean | null = null;
    try {
      available = (await sepoliaClient.readContract({
        address: ENS_BASE_REGISTRAR,
        abi: baseRegistrarAbi,
        functionName: "available",
        args: [BigInt(labelhash(label))],
      })) as boolean;
    } catch {
      /* leave null */
    }
    return available;
  })();

  try {
    const [d, available] = await Promise.all([ensDataPromise, availabilityPromise]);
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
    return Response.json({ status: d.status, price, available });
  } catch {
    // Compute availability independently in case mainnet read failed
    const available = await availabilityPromise;
    return Response.json({ status: "unknown", price: null, available });
  }
}
