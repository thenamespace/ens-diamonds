"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "next-auth/react";
import type { Hex } from "viem";

import { HomeAction, PageState } from "@/components/common";
import { getPublicVault, getVault } from "@/db/actions";
import { useVault } from "@/hooks";
import { appNetwork } from "@/lib/network";

import { PublicVaultContent } from "./public-vault-content";
import { VaultContent } from "./vault-content";

type VaultDetailPageProps = {
  id: Hex;
};

export const VaultDetailPage = ({ id }: VaultDetailPageProps) => {
  const session = useSession();
  const record = useQuery({
    enabled: session.status === "authenticated",
    queryKey: ["vault-record", appNetwork, id, session.data?.address],
    queryFn: () => getVault({ vaultId: id }),
  });
  const publicRecord = useQuery({
    queryKey: ["public-vault-record", appNetwork, id],
    queryFn: () => getPublicVault({ vaultId: id }),
  });
  const onchain = useVault(id);

  if (session.status === "loading") {
    return <PageState isLoading title="Loading Vault" />;
  }

  if (
    publicRecord.isPending ||
    (session.status === "authenticated" && record.isPending) ||
    onchain.isPending
  ) {
    return <PageState isLoading title="Loading Vault" />;
  }

  if (record.isError || publicRecord.isError || onchain.isError) {
    return (
      <PageState
        description="The vault data could not be loaded. Refresh the page and try again."
        title="Couldn't Load Vault"
      >
        <HomeAction href="/vaults" label="View Your Vaults" />
      </PageState>
    );
  }

  if (!onchain.data || (!record.data && !publicRecord.data)) {
    return (
      <PageState
        description="This vault is private, does not exist, or the connected wallet is not a member."
        title="Vault Unavailable"
      >
        <HomeAction href="/vaults" label="View Your Vaults" />
      </PageState>
    );
  }

  if (record.data)
    return (
      <VaultContent
        currentAddress={session.data?.address}
        id={id}
        record={record.data}
        vault={onchain.data}
      />
    );

  return publicRecord.data ? (
    <PublicVaultContent id={id} record={publicRecord.data} vault={onchain.data} />
  ) : null;
};
