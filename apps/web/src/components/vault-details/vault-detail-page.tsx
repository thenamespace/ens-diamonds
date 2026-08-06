"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "next-auth/react";
import type { Hex } from "viem";

import { ConnectButton, HomeAction, PageState } from "@/components/common";
import { getVault } from "@/db/actions";
import { useVault } from "@/hooks";
import { appNetwork } from "@/lib/network";

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
  const onchain = useVault(record.data?.vault.vaultId);

  if (session.status === "loading") {
    return <PageState isLoading title="Loading Vault" />;
  }

  if (session.status === "unauthenticated") {
    return (
      <PageState
        description="Connect and sign in with a vault member wallet to view this vault."
        title="Sign In to View This Vault"
      >
        <ConnectButton />
      </PageState>
    );
  }

  if (record.isPending || (record.data && onchain.isPending)) {
    return <PageState isLoading title="Loading Vault" />;
  }

  if (record.isError || onchain.isError) {
    return (
      <PageState
        description="The vault data could not be loaded. Refresh the page and try again."
        title="Couldn't Load Vault"
      >
        <HomeAction href="/vaults" label="View Your Vaults" />
      </PageState>
    );
  }

  if (!record.data || !onchain.data) {
    return (
      <PageState
        description="This vault does not exist or the connected wallet is not a member."
        title="Vault Unavailable"
      >
        <HomeAction href="/vaults" label="View Your Vaults" />
      </PageState>
    );
  }

  return (
    <VaultContent
      currentAddress={session.data?.address}
      id={id}
      record={record.data}
      vault={onchain.data}
    />
  );
};
