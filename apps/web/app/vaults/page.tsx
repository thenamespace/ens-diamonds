"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Chip, EmptyState, ProgressBar, buttonVariants } from "@thenamespace/uikit";
import { cofferEscrow, statusName } from "@/lib/contract";
import { isEscrowConfigured } from "@/lib/chain";
import { APP_CHAIN } from "@/lib/app-chain";
import { isPoolVisible } from "@/lib/pool-filter";
import { fmtEth, pct } from "@/lib/format";
import AddressLabel from "@/components/address-label";
import { SkeletonCardGrid } from "@/components/skeletons";

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

// Bounds how many pools get detail reads per page — independent of total pool
// count, so a flood of spam pools can't blow up the number of contract reads.
const PAGE = 30;

// Pool status → Chip color.
const STATUS_CHIP: Record<string, "accent" | "warning" | "success" | "default"> = {
  funding: "accent",
  funded: "warning",
  finalized: "success",
  expired: "default",
};

async function fetchPrivateIds(): Promise<number[]> {
  try {
    const res = await fetch("/api/pools/visibility");
    if (!res.ok) return [];
    return ((await res.json()) as { private: number[] }).private ?? [];
  } catch {
    return [];
  }
}

export default function PoolsPage() {
  const { address: viewer } = useAccount();
  const [visibleCount, setVisibleCount] = useState(PAGE);

  // Read poolCount and page over ids (newest first) with plain eth_calls.
  // Deliberately NOT an event scan: public RPCs (the no-config fallback)
  // reject wide eth_getLogs ranges as archive requests, which left the page
  // stuck on "loading" in production.
  const {
    data: poolCountData,
    isError: countError,
    refetch: refetchCount,
  } = useReadContract({
    ...cofferEscrow,
    functionName: "poolCount",
    query: { enabled: isEscrowConfigured, refetchInterval: 15000 },
  });

  const total = poolCountData !== undefined ? Number(poolCountData) : undefined;
  // Newest first: poolCount-1 .. 0
  const ids = useMemo(() => (total ? Array.from({ length: total }, (_, i) => total - 1 - i) : []), [total]);
  const page = useMemo(() => ids.slice(0, visibleCount), [ids, visibleCount]);

  const { data: privateData } = useQuery({ queryKey: ["pool-visibility"], queryFn: fetchPrivateIds });
  const privateIds = useMemo(() => new Set(privateData ?? []), [privateData]);

  // Only fetch onchain details (pools/status/invited) for the bounded,
  // paginated slice of the newest ids.
  const per = viewer ? 3 : 2;
  const contracts = page
    .map((id) => {
      const base: unknown[] = [
        { ...cofferEscrow, functionName: "pools", args: [BigInt(id)] },
        { ...cofferEscrow, functionName: "status", args: [BigInt(id)] },
      ];
      if (viewer) base.push({ ...cofferEscrow, functionName: "invited", args: [BigInt(id), viewer] });
      return base;
    })
    .flat();
  const { data, isError: detailsError } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: page.length > 0 },
  });

  const visible = page
    .map((id, i) => ({ id, i }))
    .filter(({ id, i }) => {
      const pool = data?.[i * per]?.result as PoolTuple | undefined;
      if (!pool) return false;
      const creator = pool[1];
      const invited = viewer ? (data?.[i * per + 2]?.result as boolean | undefined) === true : false;
      return isPoolVisible({ isPrivate: privateIds.has(id), viewer, creator, invited });
    });

  const loading = isEscrowConfigured && !countError && (total === undefined || (page.length > 0 && data === undefined));
  const failed = countError || (page.length > 0 && detailsError && data === undefined);

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Vaults</h1>
          <p>
            Public vaults plus any private vaults you belong to. Ownership is always reconstructable from onchain
            deposits.
          </p>
        </div>
        <Link className={buttonVariants({ variant: "primary" })} href="/vaults/new">
          Start a vault
        </Link>
      </div>

      {!isEscrowConfigured ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Escrow address not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : failed ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>Couldn&rsquo;t load vaults</EmptyState.Title>
            <EmptyState.Description>
              The {APP_CHAIN.label} RPC didn&rsquo;t respond. Give it a moment and try again.
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Button variant="primary" onPress={() => refetchCount()}>
              Retry
            </Button>
          </EmptyState.Content>
        </EmptyState>
      ) : loading ? (
        <SkeletonCardGrid count={6} />
      ) : visible.length === 0 ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>{total === 0 ? "No vaults yet" : "No vaults to show"}</EmptyState.Title>
            <EmptyState.Description>
              {total === 0
                ? "Be the first. Start a vault for a name and invite people."
                : "Public vaults you can join appear here. Connect your wallet to also see private vaults you belong to."}
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Link className={buttonVariants({ variant: "primary" })} href="/vaults/new">
              Start a vault
            </Link>
          </EmptyState.Content>
        </EmptyState>
      ) : (
        <div className="card-grid">
          {visible.map(({ id, i }) => {
            const pool = data![i * per]!.result as PoolTuple;
            const statusNum = data?.[i * per + 1]?.result as number | undefined;
            const [label, creator, targetAmount, totalDeposited] = pool;
            const status = statusNum !== undefined ? statusName(statusNum) : "funding";
            const funded = pct(totalDeposited, targetAmount);
            const isPrivate = privateIds.has(id);
            return (
              <Link key={id} href={`/vaults/${id}`} className="group block">
                <Card className="h-full transition-colors">
                  <div className="flex items-center justify-between">
                    <Chip color={STATUS_CHIP[status] ?? "default"} size="sm" variant="soft">
                      {status}
                    </Chip>
                    <span className="mono text-xs text-muted">
                      {isPrivate ? "🔒 " : ""}#{id} · majority
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-semibold tracking-tight">
                    {label}
                    <span className="text-muted">.eth</span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    by <AddressLabel address={creator} />
                  </div>
                  <ProgressBar aria-label="Funding progress" className="mt-4" size="sm" value={funded}>
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                    <span>{funded.toFixed(0)}% funded</span>
                    <span>
                      {fmtEth(totalDeposited, 2)} / {fmtEth(targetAmount, 2)}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {isEscrowConfigured && !loading && !failed && (total ?? 0) > 0 && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {(total ?? 0) > page.length && (
            <p className="mono text-xs text-muted">
              Showing newest {page.length} of {total} vaults
            </p>
          )}
          {visibleCount < (total ?? 0) && (
            <Button size="sm" variant="secondary" onPress={() => setVisibleCount((c) => c + PAGE)}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
