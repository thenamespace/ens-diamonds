import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { Hex } from "viem";

import { getVaultUri } from "@/db/actions";

const VAULT_ID_PATTERN = /^0x[\da-fA-F]{64}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!VAULT_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid vault ID." }, { status: 400 });
  }

  const metadata = await getVaultUri({ vaultId: id as Hex });
  if (!metadata) {
    return NextResponse.json({ error: "Vault metadata not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      name: metadata.name,
      description: metadata.description,
      external_url: new URL(`/vaults/${id}`, request.url).toString(),
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" } },
  );
}
