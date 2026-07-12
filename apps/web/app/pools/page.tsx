"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { cofferEscrow, statusName } from "@/lib/contract";
import { isEscrowConfigured } from "@/lib/chain";
import { isPoolVisible } from "@/lib/pool-filter";
import { fmtEth, pct } from "@/lib/format";
import AddressLabel from "@/components/address-label";

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

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

  const { data: countData } = useReadContract({
    ...cofferEscrow,
    functionName: "poolCount",
    query: { enabled: isEscrowConfigured, refetchInterval: 12000 },
  });
  const count = countData ? Number(countData) : 0;

  const { data: privateData } = useQuery({ queryKey: ["pool-visibility"], queryFn: fetchPrivateIds });
  const privateIds = useMemo(() => new Set(privateData ?? []), [privateData]);

  const per = viewer ? 3 : 2;
  const contracts = Array.from({ length: count }, (_, i) => {
    const base: unknown[] = [
      { ...cofferEscrow, functionName: "pools", args: [BigInt(i)] },
      { ...cofferEscrow, functionName: "status", args: [BigInt(i)] },
    ];
    if (viewer) base.push({ ...cofferEscrow, functionName: "invited", args: [BigInt(i), viewer] });
    return base;
  }).flat();
  const { data } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: count > 0 },
  });

  const visible = Array.from({ length: count }, (_, i) => i).filter((i) => {
    const pool = data?.[i * per]?.result as PoolTuple | undefined;
    if (!pool) return false;
    const creator = pool[1];
    const invited = viewer ? (data?.[i * per + 2]?.result as boolean | undefined) === true : false;
    return isPoolVisible({ isPrivate: privateIds.has(i), viewer, creator, invited });
  });

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Pools</h1>
          <p>
            Public pools plus any private pools you belong to. Ownership is always reconstructable from on-chain
            deposits.
          </p>
        </div>
        <Link className="btn btn-primary" href="/pools/new">
          Start a pool
        </Link>
      </div>

      {!isEscrowConfigured ? (
        <div className="note note-warn">
          <span>⚠</span>
          <span>Escrow address not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>{count === 0 ? "No pools yet" : "No pools to show"}</h3>
          <p>
            {count === 0
              ? "Be the first — start a pool for a name and invite people."
              : "Public pools you can join appear here. Connect your wallet to also see private pools you belong to."}
          </p>
          <Link className="btn btn-primary" href="/pools/new">
            Start a pool
          </Link>
        </div>
      ) : (
        <div className="grid">
          {visible.map((i) => {
            const pool = data![i * per]!.result as PoolTuple;
            const statusNum = data?.[i * per + 1]?.result as number | undefined;
            const [label, creator, targetAmount, totalDeposited] = pool;
            const status = statusNum !== undefined ? statusName(statusNum) : "funding";
            const funded = pct(totalDeposited, targetAmount);
            const isPrivate = privateIds.has(i);
            return (
              <Link key={i} href={`/pools/${i}`} className="ncard">
                <div className="ncard-top">
                  <span className={`tag tag-${status}`}>{status}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {isPrivate ? "🔒 " : ""}#{i} · majority
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
    </div>
  );
}
