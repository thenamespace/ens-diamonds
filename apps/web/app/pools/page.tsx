"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { cofferEscrow, statusName } from "@/lib/contract";
import { isEscrowConfigured } from "@/lib/chain";
import { isPoolVisible } from "@/lib/pool-filter";
import { fmtEth, pct } from "@/lib/format";
import AddressLabel from "@/components/address-label";

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

// Bounds how many pools get detail reads per page — independent of total pool
// count, so a flood of spam pools can't blow up the number of contract reads.
const PAGE = 30;

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

  // Only fetch on-chain details (pools/status/invited) for the bounded,
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
      ) : failed ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>Couldn&rsquo;t load vaults</h3>
          <p>The Sepolia RPC didn&rsquo;t respond. Give it a moment and try again.</p>
          <button className="btn btn-primary" onClick={() => refetchCount()}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>Loading vaults…</h3>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>{total === 0 ? "No vaults yet" : "No vaults to show"}</h3>
          <p>
            {total === 0
              ? "Be the first — start a vault for a name and invite people."
              : "Public vaults you can join appear here. Connect your wallet to also see private vaults you belong to."}
          </p>
          <Link className="btn btn-primary" href="/pools/new">
            Start a vault
          </Link>
        </div>
      ) : (
        <div className="grid">
          {visible.map(({ id, i }) => {
            const pool = data![i * per]!.result as PoolTuple;
            const statusNum = data?.[i * per + 1]?.result as number | undefined;
            const [label, creator, targetAmount, totalDeposited] = pool;
            const status = statusNum !== undefined ? statusName(statusNum) : "funding";
            const funded = pct(totalDeposited, targetAmount);
            const isPrivate = privateIds.has(id);
            return (
              <Link key={id} href={`/pools/${id}`} className="ncard">
                <div className="ncard-top">
                  <span className={`tag tag-${status}`}>{status}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {isPrivate ? "🔒 " : ""}#{id} · majority
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

      {isEscrowConfigured && !loading && !failed && (total ?? 0) > 0 && (
        <div className="mt-16" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {(total ?? 0) > page.length && (
            <p className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
              Showing newest {page.length} of {total} vaults
            </p>
          )}
          {visibleCount < (total ?? 0) && (
            <button className="btn btn-soft btn-sm" onClick={() => setVisibleCount((c) => c + PAGE)}>
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
