"use client";

import { useMemo } from "react";

import { Alert, Breadcrumbs, Chip, Typography } from "@thenamespace/uikit";
import type { Hex } from "viem";

import { CopyButton, PageMain } from "@/components/common";
import type { getVault } from "@/db/actions";
import { useEnsNameDetails, type useVault } from "@/hooks";
import { SECONDS_PER_YEAR } from "@/lib/constants";

import { VaultCertificate } from "./vault-certificate";
import { VaultFunding } from "./vault-funding";
import { VaultMembers } from "./vault-members";
import { VaultSidebar } from "./vault-sidebar";

type VaultRecord = NonNullable<Awaited<ReturnType<typeof getVault>>>;
type OnchainVault = NonNullable<ReturnType<typeof useVault>["data"]>;

type VaultContentProps = {
  currentAddress: string | undefined;
  id: Hex;
  record: VaultRecord;
  vault: OnchainVault;
};

export const VaultContent = ({ currentAddress, id, record, vault }: VaultContentProps) => {
  const label = record.vault.secrets.label;
  const name = `${label}.eth`;
  const shortId = `${id.slice(0, 10)}…${id.slice(-6)}`;
  const nameDetails = useEnsNameDetails({ duration: vault.registrationDuration, label });
  const currentMember = vault.members.find(
    ({ address }) => address.toLowerCase() === currentAddress?.toLowerCase(),
  );
  const purchaseSecrets = useMemo(
    () =>
      "ensSecret" in record.vault.secrets && "targetSalt" in record.vault.secrets
        ? {
            ensSecret: record.vault.secrets.ensSecret,
            label,
            targetSalt: record.vault.secrets.targetSalt,
          }
        : undefined,
    [label, record.vault.secrets],
  );

  return (
    <PageMain>
      <div className="flex items-center gap-1">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/vaults">Vaults</Breadcrumbs.Item>
          <Breadcrumbs.Item>Vault {shortId}</Breadcrumbs.Item>
        </Breadcrumbs>
        <CopyButton label="Copy vault ID" value={id} />
      </div>

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <Typography.Heading
            className="text-balance text-3xl tracking-tight sm:text-4xl"
            level={1}
          >
            {name} vault
          </Typography.Heading>
          <Chip color={getStatusColor(vault.status)} size="sm" variant="soft">
            <span className="capitalize">{vault.status}</span>
          </Chip>
        </div>
      </header>

      {nameDetails.isAvailable === false && vault.status !== "acquired" ? (
        <UnavailableNameAlert name={name} status={vault.status} />
      ) : null}

      {vault.status === "acquired" ? (
        <VaultCertificate name={name} safeAddress={vault.safe.address} />
      ) : null}

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-5">
          <VaultFunding vault={vault} />
          <VaultMembers currentAddress={currentAddress} members={vault.members} />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <VaultSidebar
            acquisition={vault.acquisition}
            balance={currentMember?.balance ?? 0n}
            currentPrice={nameDetails.totalPrice}
            escrowed={vault.escrowed}
            isCreator={currentMember?.isCreator ?? false}
            isNameAvailable={nameDetails.isAvailable}
            isSafeDeployed={vault.safe.isDeployed}
            maxSpend={vault.maxSpend}
            memberCount={vault.members.length}
            purchaseSecrets={purchaseSecrets}
            registrationYears={vault.registrationDuration / SECONDS_PER_YEAR}
            status={vault.status}
            threshold={vault.safe.threshold}
            vaultId={vault.id}
          />
        </aside>
      </div>
    </PageMain>
  );
};

const UnavailableNameAlert = ({
  name,
  status,
}: {
  name: string;
  status: OnchainVault["status"];
}) => {
  const description =
    status === "funding"
      ? "This vault can no longer buy it. Do not add more ETH; withdraw your deposited funds."
      : status === "committed"
        ? "Funding is locked until the commitment expires. After expiry, each contributor can claim their deposited ETH."
        : "This vault can no longer buy it. Claim any remaining balance from the vault.";

  return (
    <Alert className="mt-6" status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{name} has already been registered</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
};

const getStatusColor = (status: OnchainVault["status"]) => {
  if (status === "funding" || status === "acquired") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "default" as const;
};
