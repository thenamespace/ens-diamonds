import { getSession } from "@/lib/session";
import { recordFeedback, listFeedback } from "@/lib/feedback";
import { apiLimiter, clientId } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_MESSAGE = 2000;
const MAX_CONTACT = 200;

// POST /api/feedback — open to everyone (feedback shouldn't require sign-in);
// the wallet address is attached only when a session happens to exist.
export async function POST(req: Request) {
  if (!(await apiLimiter(clientId(req), "feedback"))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { message?: unknown; contact?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  if (message.length < 3 || message.length > MAX_MESSAGE || contact.length > MAX_CONTACT) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const session = await getSession().catch(() => null);
  await recordFeedback({
    message,
    contact: contact || null,
    address: session?.address ?? null,
    ts: Date.now(),
  });
  return Response.json({ ok: true });
}

// GET /api/feedback?key=… — admin read, enabled only when FEEDBACK_ADMIN_KEY
// is set. Constant 404 (not 401/403) so the endpoint doesn't advertise itself.
export async function GET(req: Request) {
  const adminKey = process.env.FEEDBACK_ADMIN_KEY;
  const key = new URL(req.url).searchParams.get("key");
  if (!adminKey || key !== adminKey) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ entries: await listFeedback() }, { headers: { "cache-control": "no-store" } });
}
