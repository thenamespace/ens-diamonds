import { getEnsNameData } from "@/lib/ens-name";

export const runtime = "nodejs";

// Live ENS status for a label, used by the pool-creation form to steer people
// away from names they can't actually register (registered / in grace).
// GET /api/name-status?label=<label> → { status }
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("label") ?? "";
  const label = raw.trim().toLowerCase().replace(/\.eth$/, "");
  if (label.length < 3) return Response.json({ status: "tooShort" });
  try {
    const d = await getEnsNameData(label);
    return Response.json({ status: d.status });
  } catch {
    return Response.json({ status: "unknown" });
  }
}
