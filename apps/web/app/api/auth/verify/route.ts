import { SiweMessage, configure, createViemConfig } from "@signinwithethereum/siwe";
import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// The siwe lib needs a signature backend; unconfigured it tries `ethers` (not
// installed). Configure it with viem. The publicClient is only used to verify
// smart-contract-wallet (ERC-1271/6492) signatures, so match it to the chain
// the wallet reported; EOA signatures (MetaMask) are recovered chain-agnostically.
let configuredChainId: number | null = null;
async function ensureSiweConfigured(chainId: number): Promise<void> {
  if (configuredChainId === chainId) return;
  const chain = chainId === sepolia.id ? sepolia : mainnet;
  const publicClient = createPublicClient({ chain, transport: http() });
  configure(await createViemConfig({ publicClient }));
  configuredChainId = chainId;
}

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
  const challenge = session.nonce;
  // Consume the nonce now: a single challenge gets exactly one verify attempt,
  // success or fail. A retry must fetch a fresh nonce.
  session.nonce = undefined;
  await session.save();

  try {
    const siwe = new SiweMessage(message);
    await ensureSiweConfigured(siwe.chainId);
    const result = await siwe.verify(
      { signature, domain: host, nonce: challenge },
      { suppressExceptions: true },
    );
    if (!result.success) {
      return Response.json({ error: "Verification failed" }, { status: 422 });
    }
    session.address = siwe.address.toLowerCase();
    await session.save();
    return Response.json({ address: session.address });
  } catch {
    return Response.json({ error: "Verification failed" }, { status: 422 });
  }
}
