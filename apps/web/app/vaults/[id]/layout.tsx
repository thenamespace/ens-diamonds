import type { Metadata } from "next";
import { isEscrowConfigured } from "@/lib/chain";
import { getPool } from "@/lib/sepolia-client";

// The vault page itself is a client component; this server layout provides its
// metadata. OG/Twitter images come from the sibling image routes.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const idNum = /^\d+$/.test(id) ? Number(id) : null;
  const pool = idNum !== null && isEscrowConfigured ? await getPool(idNum) : null;
  const title = pool ? `Vault nº ${id}: ${pool.label}.eth` : `Vault nº ${id}`;
  const description = pool
    ? `A shared vault pooling ETH to register ${pool.label}.eth. Contribute, track funding progress, and co-own the name through a Safe multisig.`
    : "A shared vault on ens.diamonds pooling ETH to register an ENS name together.";
  return {
    title,
    description,
    alternates: { canonical: `/vaults/${id}` },
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
