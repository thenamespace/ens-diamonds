"use client";

import { Breadcrumbs, Chip, Typography } from "@thenamespace/uikit";
import type { Hex } from "viem";

import { CopyButton, PageMain } from "@/components/common";
import type { getPublicVault } from "@/db/actions";
import type { useVault } from "@/hooks";

import { VaultFunding } from "./vault-funding";
import { VaultMembers } from "./vault-members";

type PublicVaultRecord = NonNullable<Awaited<ReturnType<typeof getPublicVault>>>;
type OnchainVault = NonNullable<ReturnType<typeof useVault>["data"]>;

export const PublicVaultContent = ({
  id,
  record,
  vault,
}: {
  id: Hex;
  record: PublicVaultRecord;
  vault: OnchainVault;
}) => (
  <PageMain>
    <div className="flex items-center gap-1">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/vaults">Vaults</Breadcrumbs.Item>
        <Breadcrumbs.Item>{record.metadata.name}</Breadcrumbs.Item>
      </Breadcrumbs>
      <CopyButton label="Copy vault ID" value={id} />
    </div>

    <header className="mt-8 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <Typography.Heading className="text-balance text-3xl tracking-tight sm:text-4xl" level={1}>
          {record.metadata.name}
        </Typography.Heading>
        <Chip size="sm" variant="soft">
          <span className="capitalize">{vault.status}</span>
        </Chip>
      </div>
      <Typography.Paragraph className="mt-3 leading-7" color="muted">
        {record.metadata.description}
      </Typography.Paragraph>
    </header>

    <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <VaultFunding vault={vault} />
      <VaultMembers members={vault.members} />
    </div>
  </PageMain>
);
