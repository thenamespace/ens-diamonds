"use client";

import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { cofferEscrow, statusName } from "@/lib/contract";
import { isEscrowConfigured } from "@/lib/chain";
import { fmtEth, pct, shortAddr } from "@/lib/format";

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

export default function PoolsPage() {
  const { data: countData } = useReadContract({
    ...cofferEscrow,
    functionName: "poolCount",
    query: { enabled: isEscrowConfigured, refetchInterval: 12000 },
  });
  const count = countData ? Number(countData) : 0;

  const contracts = Array.from({ length: count }, (_, i) => [
    { ...cofferEscrow, functionName: "pools", args: [BigInt(i)] },
    { ...cofferEscrow, functionName: "status", args: [BigInt(i)] },
  ]).flat();
  const { data } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: count > 0 },
  });

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Pools</h1>
          <p>
            Every pool on the deployed escrow (Sepolia). Ownership is always reconstructable from on-chain deposits.
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
      ) : count === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No pools yet</h3>
          <p>Be the first — start a pool for a name and invite people.</p>
          <Link className="btn btn-primary" href="/pools/new">
            Start a pool
          </Link>
        </div>
      ) : (
        <div className="grid">
          {Array.from({ length: count }, (_, i) => {
            const pool = data?.[i * 2]?.result as PoolTuple | undefined;
            const statusNum = data?.[i * 2 + 1]?.result as number | undefined;
            if (!pool) return null;
            const [label, creator, targetAmount, totalDeposited, , , threshold] = pool;
            const status = statusNum !== undefined ? statusName(statusNum) : "funding";
            const funded = pct(totalDeposited, targetAmount);
            return (
              <Link key={i} href={`/pools/${i}`} className="ncard">
                <div className="ncard-top">
                  <span className={`tag tag-${status}`}>{status}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                    #{i} · {threshold}-of-N
                  </span>
                </div>
                <div className="ncard-name">
                  {label}
                  <span className="eth">.eth</span>
                </div>
                <div className="ncard-sub mono">by {shortAddr(creator)}</div>
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
