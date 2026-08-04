import { notFound } from "next/navigation";

import { NameDetailPage } from "@/components";
import { getSecondLevelEthLabel } from "@/lib/ens";

type NamePageProps = {
  params: Promise<{ name: string }>;
};

export default async function NamePage({ params }: NamePageProps) {
  const { name } = await params;
  const label = getSecondLevelEthLabel(name);
  if (label === null) notFound();

  return <NameDetailPage label={label} />;
}
