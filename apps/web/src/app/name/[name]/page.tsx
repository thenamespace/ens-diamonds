import { notFound, redirect } from "next/navigation";

import { NameDetailPage } from "@/components";
import { getSecondLevelEthLabel } from "@/lib/ens";

type NamePageProps = {
  params: Promise<{ name: string }>;
};

export default async function NamePage({ params }: NamePageProps) {
  const { name } = await params;
  const label = getSecondLevelEthLabel(name);
  if (label === null) notFound();

  const normalizedName = `${label}.eth`;
  if (name !== normalizedName) redirect(`/name/${encodeURIComponent(normalizedName)}`);

  return <NameDetailPage label={label} />;
}
