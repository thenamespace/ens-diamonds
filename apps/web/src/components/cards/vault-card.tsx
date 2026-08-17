"use client";

import NextLink from "next/link";

import { Card, Chip, ProgressBar, Skeleton, Typography } from "@thenamespace/uikit";
import { Diamond02Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import type { Address, Hex } from "viem";

import { EthValue, NameAvatar } from "@/components/common";
import { useVault, type VaultState } from "@/hooks";

export type VaultCardSummary = {
  identity:
    | { type: "metadata"; title: string; description: string }
    | { type: "name"; label: string };
  memberCount: number;
  vaultId: Hex;
};

type VaultCardProps = VaultCardSummary & {
  viewerAddress?: Address | null;
};

export const VaultCard = ({ identity, memberCount, vaultId, viewerAddress }: VaultCardProps) => {
  const vaultQuery = useVault(vaultId);
  const vault = vaultQuery.data;

  if (vaultQuery.isPending) return <VaultCardSkeleton />;

  const currentBalance =
    vault?.members.find(
      ({ address }) => viewerAddress && address.toLowerCase() === viewerAddress.toLowerCase(),
    )?.balance ?? 0n;
  const members = vault?.members.length ?? memberCount;
  const status = vault?.status;

  return (
    <NextLink className="group block h-full" href={`/vaults/${vaultId}`}>
      <Card className="h-full gap-0 bg-transparent p-0 shadow-none transition-[transform,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform filter-[drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:-translate-y-0.75 hover:filter-[drop-shadow(0_10px_14px_rgba(18,21,28,0.13))] motion-reduce:transform-none motion-reduce:transition-none">
        <div className="ticket-top flex min-h-40 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            {identity.type === "name" ? (
              <NameAvatar
                className="size-10 rounded-lg transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105"
                label={identity.label}
                resolveEnsAvatar={false}
              />
            ) : (
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-subtle transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
                <HugeiconsIcon aria-hidden icon={Diamond02Icon} width={21} />
              </span>
            )}
            {status ? (
              <Chip color={getStatusColor(status)} size="sm" variant="soft">
                <Chip.Label className="capitalize">{status}</Chip.Label>
              </Chip>
            ) : null}
          </div>

          <div className="mt-auto pt-5">
            <div className="text-xl leading-tight font-semibold tracking-tight wrap-break-word text-foreground">
              {identity.type === "name" ? `${identity.label}.eth` : identity.title}
            </div>
            {identity.type === "metadata" ? (
              <Typography.Paragraph className="mt-2 line-clamp-2" color="muted" size="sm">
                {identity.description}
              </Typography.Paragraph>
            ) : null}
          </div>
        </div>

        <div className="ticket-stub px-4 pt-3.5 pb-4">
          {vault ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {viewerAddress ? (
                  <VaultAmount
                    label={
                      status === "funding" || status === "committed"
                        ? "Your contribution"
                        : "Your balance"
                    }
                    value={currentBalance}
                  />
                ) : (
                  <VaultAmount label="Target" value={vault.maxSpend} />
                )}
                <VaultAmount className="text-right" label="Funded" value={vault.escrowed} />
              </div>

              <ProgressBar
                aria-label="Vault funding progress"
                className="mt-4"
                maxValue={100}
                minValue={0}
                value={Math.min(vault.fundingProgress, 100)}
              >
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                <span>{members} members</span>
                <span>
                  {vault.safe.threshold}-of-{members} Safe
                </span>
              </div>
            </>
          ) : (
            <Typography.Paragraph color="muted" size="sm">
              {vaultQuery.isError
                ? "Onchain details are temporarily unavailable."
                : "Vault not found."}
            </Typography.Paragraph>
          )}
        </div>
      </Card>
    </NextLink>
  );
};

const VaultAmount = ({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: bigint;
}) => (
  <div className={className}>
    <Typography.Paragraph color="muted" size="xs">
      {label}
    </Typography.Paragraph>
    <EthValue className="mt-1 text-base font-semibold" value={value} />
  </div>
);

const getStatusColor = (status: VaultState) => {
  if (status === "funding" || status === "acquired") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "default" as const;
};

export const VaultCardSkeleton = () => (
  <Card className="h-72 gap-0 overflow-hidden p-0 shadow-xs">
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start justify-between">
        <Skeleton className="size-10 rounded-lg" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-auto h-8 w-3/4 rounded-lg" />
    </div>
    <div className="border-t border-default px-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <Skeleton className="mt-4 h-2 w-full rounded-full" />
      <Skeleton className="mt-3 h-4 w-full rounded-md" />
    </div>
  </Card>
);
