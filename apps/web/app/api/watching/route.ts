import { getSession } from "@/lib/session";
import { getWatched, addWatch, removeWatch, normalizeLabel } from "@/lib/watchlist";

export const runtime = "nodejs";

async function requireAddress() {
  const session = await getSession();
  return session.address ?? null;
}

export async function GET() {
  const addr = await requireAddress();
  if (!addr) return Response.json({ error: "Not signed in" }, { status: 401 });
  const labels = await getWatched(addr);
  return Response.json({ labels });
}

export async function POST(req: Request) {
  const addr = await requireAddress();
  if (!addr) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { label } = await req.json().catch(() => ({}) as { label?: unknown });
  const norm = typeof label === "string" ? normalizeLabel(label) : null;
  if (!norm) return Response.json({ error: "Invalid label" }, { status: 400 });
  await addWatch(addr, norm);
  return Response.json({ labels: await getWatched(addr) });
}

export async function DELETE(req: Request) {
  const addr = await requireAddress();
  if (!addr) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { label } = await req.json().catch(() => ({}) as { label?: unknown });
  const norm = typeof label === "string" ? normalizeLabel(label) : null;
  if (!norm) return Response.json({ error: "Invalid label" }, { status: 400 });
  await removeWatch(addr, norm);
  return Response.json({ labels: await getWatched(addr) });
}
