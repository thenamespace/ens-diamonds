import { notFound } from "next/navigation";

import { CreateVaultPage } from "@/components";
import { getSecondLevelEthLabel } from "@/lib/ens";

type NewVaultPageProps = {
  params: Promise<{ name: string }>;
};

export default async function NewVaultPage({ params }: NewVaultPageProps) {
  const { name } = await params;
  const label = getSecondLevelEthLabel(name);
  if (label === null) notFound();

  return <CreateVaultPage label={label} />;
}
