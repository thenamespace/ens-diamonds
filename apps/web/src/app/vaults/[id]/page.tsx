import { notFound } from "next/navigation";

import type { Hex } from "viem";
import { isHex, size } from "viem";

import { VaultDetailPage } from "@/components";

type VaultPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VaultPage({ params }: VaultPageProps) {
  const { id } = await params;
  if (!isHex(id, { strict: true }) || size(id) !== 32) notFound();

  return <VaultDetailPage id={id as Hex} />;
}
