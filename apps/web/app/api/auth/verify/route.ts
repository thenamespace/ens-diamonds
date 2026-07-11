import { SiweMessage } from "@signinwithethereum/siwe";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.nonce) return Response.json({ error: "No sign-in challenge" }, { status: 422 });

  let body: { message?: unknown; signature?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const { message, signature } = body;
  if (typeof message !== "string" || typeof signature !== "string") {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const host = req.headers.get("host") ?? "";
  try {
    const siwe = new SiweMessage(message);
    const result = await siwe.verify(
      { signature, domain: host, nonce: session.nonce },
      { suppressExceptions: true },
    );
    if (!result.success) {
      return Response.json({ error: "Verification failed" }, { status: 422 });
    }
    session.address = siwe.address.toLowerCase();
    session.nonce = undefined; // single-use
    await session.save();
    return Response.json({ address: session.address });
  } catch {
    return Response.json({ error: "Verification failed" }, { status: 422 });
  }
}
