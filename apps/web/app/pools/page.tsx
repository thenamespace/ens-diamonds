"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, usePublicClient, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getAbiItem } from "viem";
import { cofferEscrow, statusName } from "@/lib/contract";
import { ESCROW_ADDRESS, ESCROW_DEPLOY_BLOCK, isEscrowConfigured } from "@/lib/chain";
import { isPoolVisible } from "@/lib/pool-filter";
import { fmtEth, pct } from "@/lib/format";
import AddressLabel from "@/components/address-label";

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

type PoolEvent = {
  poolId: number;
  label: string;
  creator: `0x${string}`;
};

// Bounds how many pools get detail reads per page — independent of total pool
// count, so a flood of spam pools can't blow up the number of contract reads.
const PAGE = 30;

const poolCreatedEvent = getAbiItem({ abi: cofferEscrow.abi, name: "PoolCreated" });

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
  const publicClient = usePublicClient();
  const [visibleCount, setVisibleCount] = useState(PAGE);

  // Read PoolCreated events once (cheap: one log scan) instead of iterating
  // poolCount and doing per-pool contract reads for every pool ever created.
  const { data: eventsData } = useQuery({
    queryKey: ["pool-events"],
    queryFn: async (): Promise<PoolEvent[]> => {
      const logs = await publicClient!.getLogs({
        address: ESCROW_ADDRESS,
        event: poolCreatedEvent,
        fromBlock: ESCROW_DEPLOY_BLOCK,
        toBlock: "latest",
      });
      return logs.map((log) => ({
        poolId: Number(log.args.poolId),
        label: log.args.label ?? "",
        creator: log.args.creator as `0x${string}`,
      }));
    },
    enabled: isEscrowConfigured && !!publicClient,
    refetchInterval: 15000,
  });

  const events = useMemo(() => [...(eventsData ?? [])].sort((a, b) => b.poolId - a.poolId), [eventsData]);

  const { data: privateData } = useQuery({ queryKey: ["pool-visibility"], queryFn: fetchPrivateIds });
  const privateIds = useMemo(() => new Set(privateData ?? []), [privateData]);

  // Only fetch on-chain details (pools/status/invited) for a bounded, paginated
  // slice of the newest events — this is what keeps reads flat regardless of
  // how many pools (or spam pools) exist in total.
  const page = useMemo(() => events.slice(0, visibleCount), [events, visibleCount]);

  const per = viewer ? 3 : 2;
  const contracts = page
    .map((e) => {
      const base: unknown[] = [
        { ...cofferEscrow, functionName: "pools", args: [BigInt(e.poolId)] },
        { ...cofferEscrow, functionName: "status", args: [BigInt(e.poolId)] },
      ];
      if (viewer) base.push({ ...cofferEscrow, functionName: "invited", args: [BigInt(e.poolId), viewer] });
      return base;
    })
    .flat();
  const { data } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: page.length > 0 },
  });

  const visible = page
    .map((e, i) => ({ e, i }))
    .filter(({ e, i }) => {
      const pool = data?.[i * per]?.result as PoolTuple | undefined;
      if (!pool) return false;
      const creator = pool[1];
      const invited = viewer ? (data?.[i * per + 2]?.result as boolean | undefined) === true : false;
      return isPoolVisible({ isPrivate: privateIds.has(e.poolId), viewer, creator, invited });
    });

  const loading = isEscrowConfigured && eventsData === undefined;

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Vaults</h1>
          <p>
            Public vaults plus any private vaults you belong to. Ownership is always reconstructable from on-chain
            deposits.
          </p>
        </div>
        <Link className="btn btn-primary" href="/pools/new">
          Start a vault
        </Link>
      </div>

      {!isEscrowConfigured ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Escrow address not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.</span>
        </div>
      ) : loading ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>Loading vaults…</h3>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>{events.length === 0 ? "No vaults yet" : "No vaults to show"}</h3>
          <p>
            {events.length === 0
              ? "Be the first — start a vault for a name and invite people."
              : "Public vaults you can join appear here. Connect your wallet to also see private vaults you belong to."}
          </p>
          <Link className="btn btn-primary" href="/pools/new">
            Start a vault
          </Link>
        </div>
      ) : (
        <div className="grid">
          {visible.map(({ e, i }) => {
            const pool = data![i * per]!.result as PoolTuple;
            const statusNum = data?.[i * per + 1]?.result as number | undefined;
            const [label, creator, targetAmount, totalDeposited] = pool;
            const status = statusNum !== undefined ? statusName(statusNum) : "funding";
            const funded = pct(totalDeposited, targetAmount);
            const isPrivate = privateIds.has(e.poolId);
            return (
              <Link key={e.poolId} href={`/pools/${e.poolId}`} className="ncard">
                <div className="ncard-top">
                  <span className={`tag tag-${status}`}>{status}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {isPrivate ? "🔒 " : ""}#{e.poolId} · majority
                  </span>
                </div>
                <div className="ncard-name">
                  {label}
                  <span className="eth">.eth</span>
                </div>
                <div className="ncard-sub">
                  by <AddressLabel address={creator} />
                </div>
                <div className="progress mt-16">
                  <div className="fill" style={{ width: `${funded}%` }} />
                </div>
                <div className="progress-label">
                  <span>{funded.toFixed(0)}% funded</span>
                  <span>
                    {fmtEth(totalDeposited, 2)} / {fmtEth(targetAmount, 2)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {isEscrowConfigured && !loading && events.length > 0 && (
        <div className="mt-16" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {events.length > page.length && (
            <p className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
              Showing newest {page.length} of {events.length} pools
            </p>
          )}
          {visibleCount < events.length && (
            <button className="btn btn-soft btn-sm" onClick={() => setVisibleCount((c) => c + PAGE)}>
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
