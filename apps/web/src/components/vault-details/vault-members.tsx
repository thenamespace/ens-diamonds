"use client";

import { useCallback, useState } from "react";

import { Avatar, Card, Chip, Typography } from "@thenamespace/uikit";
import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { useEnsAvatar, useEnsName } from "wagmi";

import { CardHeading, CopyButton, EthValue, getDeterministicAvatar } from "@/components/common";
import { truncateAddress } from "@/lib/helpers";

type VaultMember = {
  address: Address;
  balance: bigint;
  isCreator: boolean;
};

type VaultMembersProps = {
  currentAddress: string | undefined;
  members: readonly VaultMember[];
};

export const VaultMembers = ({ currentAddress, members }: VaultMembersProps) => (
  <Card variant="default">
    <Card.Header className="gap-1">
      <CardHeading>Members</CardHeading>
      <Typography.Paragraph color="muted" size="sm">
        Every member is an equal Safe owner; balances track ETH in the vault.
      </Typography.Paragraph>
    </Card.Header>
    <Card.Content>
      <div className="divide-y divide-default">
        {members.map((member) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_9rem]"
            key={member.address}
          >
            <MemberIdentity
              address={member.address}
              isCreator={member.isCreator}
              isCurrent={member.address.toLowerCase() === currentAddress?.toLowerCase()}
            />

            <div className="text-right">
              <EthValue className="text-sm font-semibold" value={member.balance} />
            </div>
          </div>
        ))}
      </div>
    </Card.Content>
  </Card>
);

const MemberIdentity = ({
  address,
  isCreator,
  isCurrent,
}: {
  address: Address;
  isCreator: boolean;
  isCurrent: boolean;
}) => {
  const [failedAvatar, setFailedAvatar] = useState(false);
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: ensAvatar } = useEnsAvatar({
    chainId: mainnet.id,
    name: ensName ?? undefined,
    query: { enabled: Boolean(ensName) },
  });
  const fallbackAvatar = getDeterministicAvatar(address);
  const avatar = ensAvatar && !failedAvatar ? ensAvatar : fallbackAvatar;
  const handleAvatarError = useCallback(() => setFailedAvatar(true), []);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0">
        <Avatar.Image alt="" onError={handleAvatarError} src={avatar} />
        <Avatar.Fallback />
      </Avatar>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold">
            {ensName ?? truncateAddress(address)}
          </span>
          {isCurrent ? (
            <Chip className="shrink-0" color="default" size="sm" variant="soft">
              You
            </Chip>
          ) : null}
          <CopyButton
            className="-my-1 shrink-0"
            label={`Copy ${ensName ?? address}`}
            value={address}
          />
        </div>
        <Typography.Paragraph className="-mt-0.5 truncate leading-4" color="muted" size="xs">
          {isCreator ? "Creator" : "Member"}
          {ensName ? ` · ${truncateAddress(address)}` : ""}
        </Typography.Paragraph>
      </div>
    </div>
  );
};
