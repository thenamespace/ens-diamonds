import { getSession } from "@/lib/session";
import { getPoolCreator } from "@/lib/sepolia-client";
import { getPrivatePoolIds, setPoolPrivate } from "@/lib/pool-visibility";

export const runtime = "nodejs";

export async function GET() {
  const ids = await getPrivatePoolIds();
  return Response.json({ private: ids }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.address) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { poolId?: unknown; public?: unknown };
  const poolId = body.poolId;
  const isPublic = body.public;
  if (typeof poolId !== "number" || !Number.isInteger(poolId) || poolId < 0 || typeof isPublic !== "boolean") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const creator = await getPoolCreator(poolId);
  if (!creator) return Response.json({ error: "Pool not found" }, { status: 404 });
  if (creator !== session.address) return Response.json({ error: "Not the pool creator" }, { status: 403 });

  await setPoolPrivate(poolId, !isPublic);
  return Response.json({ ok: true, public: isPublic });
}
