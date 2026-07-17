import { renderVaultCard, OG_SIZE } from "@/lib/og-cert-card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "ens.diamonds vault certificate";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderVaultCard(id);
}
