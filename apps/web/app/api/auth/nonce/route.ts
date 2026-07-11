import { generateNonce } from "@signinwithethereum/siwe";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  session.nonce = generateNonce();
  await session.save();
  return new Response(session.nonce, { headers: { "content-type": "text/plain" } });
}
