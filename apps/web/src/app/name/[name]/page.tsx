import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { normalize } from "viem/ens";

import { NameDetailPage } from "@/components";

type NamePageProps = {
  params: Promise<{ name: string }>;
};

export const generateMetadata = async ({ params }: NamePageProps): Promise<Metadata> => {
  const { name } = await params;
  const label = getNormalizedLabel(name);
  const normalizedName = label === null ? name : `${label}.eth`;

  return {
    title: `${normalizedName} · ENS Diamonds`,
    description: `View the live ENS premium and one-year registration price for ${normalizedName}.`,
  };
};

export default async function NamePage({ params }: NamePageProps) {
  const { name } = await params;
  const label = getNormalizedLabel(name);
  if (label === null) notFound();

  return <NameDetailPage label={label} />;
}

const getNormalizedLabel = (name: string) => {
  const label = name.trim().replace(/\.eth$/iu, "");
  if (!label || label.includes(".")) return null;

  try {
    return normalize(`${label}.eth`).slice(0, -4);
  } catch {
    return null;
  }
};
