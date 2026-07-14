"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import { APP_CHAIN } from "@/lib/app-chain";
import { cofferEscrow, statusName } from "@/lib/contract";
import { isEscrowConfigured } from "@/lib/chain";
import { isPoolVisible } from "@/lib/pool-filter";
import { txErrorMessage } from "@/lib/tx-error";
import { fmtEth, pct, parseEther, fmtCountdown } from "@/lib/format";
import AddressLabel from "@/components/address-label";
import EnsAvatar from "@/components/ens-avatar";
import ShareButton from "@/components/share-button";
import PoolRegister from "@/components/pool-register";

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

export default function PoolDashboard() {
  const params = useParams<{ id: string }>();
  const idStr = params.id;
  const idOk = /^\d+$/.test(idStr);
  const id = idOk ? BigInt(idStr) : 0n;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== APP_CHAIN.chainId;
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("0.01");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contracts = [
    { ...cofferEscrow, functionName: "pools", args: [id] },
    { ...cofferEscrow, functionName: "status", args: [id] },
    { ...cofferEscrow, functionName: "getContributors", args: [id] },
    ...(address
      ? [
          { ...cofferEscrow, functionName: "deposits", args: [id, address] },
          { ...cofferEscrow, functionName: "ownershipBps", args: [id, address] },
          { ...cofferEscrow, functionName: "invited", args: [id, address] },
        ]
      : []),
  ];

  const { data: privateData } = useQuery({ queryKey: ["pool-visibility"], queryFn: fetchPrivateIds });

  const { data, refetch, isLoading } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: contracts as any,
    query: { enabled: isEscrowConfigured && idOk, refetchInterval: 12000 },
  });

  const pool = data?.[0]?.result as PoolTuple | undefined;
  const statusNum = data?.[1]?.result as number | undefined;
  const contributors = data?.[2]?.result as readonly [readonly `0x${string}`[], readonly bigint[]] | undefined;
  const yourDeposit = (data?.[3]?.result as bigint | undefined) ?? 0n;
  const yourBps = (data?.[4]?.result as bigint | undefined) ?? 0n;

  async function act(fn: "deposit" | "withdraw" | "finalize", value?: bigint) {
    if (!publicClient) return;
    setError(null);
    setPending(fn);
    try {
      // fn spans payable (deposit) + non-payable (withdraw/finalize); cast to reconcile the union.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hash = await writeContractAsync({ ...cofferEscrow, functionName: fn, args: [id], value } as any);
      await publicClient.waitForTransactionReceipt({ hash });
      await refetch();
    } catch (err) {
      setError(txErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  if (!isEscrowConfigured) {
    return (
      <div className="wrap">
        <div className="note note-warn">
          <span>⚠</span>
          <span>Escrow address not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.</span>
        </div>
      </div>
    );
  }

  if (!idOk || (data && (!pool || !pool[0]))) {
    return (
      <div className="wrap">
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>Vault #{idStr} not found</h3>
          <p>No vault with this id exists on the deployed escrow yet.</p>
          <Link className="btn btn-primary" href="/pools">
            All vaults
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !pool || statusNum === undefined) {
    return <div className="wrap">Loading vault #{idStr}…</div>;
  }

  const [label, creator, targetAmount, totalDeposited, fundingDeadline, fundedAt, threshold, safe] = pool;
  const status = statusName(statusNum);
  const funded = pct(totalDeposited, targetAmount);
  const lockEnds = fundedAt > 0 ? fundedAt + 7 * 86400 : 0;
  const contributorCount = contributors ? contributors[0].length : 0;
  const remaining = targetAmount > totalDeposited ? targetAmount - totalDeposited : 0n;
  const effThreshold = status === "finalized" ? threshold : Math.floor(contributorCount / 2) + 1;

  // Private pools are viewable only by the creator or an on-chain-invited member.
  // Ids are sequential/guessable, so gate the detail page — not just the list.
  const invitedYou = (data?.[5]?.result as boolean | undefined) === true;
  const isPrivate = (privateData ?? []).includes(Number(idStr));
  if (!isPoolVisible({ isPrivate, viewer: address, creator, invited: invitedYou })) {
    return (
      <div className="wrap">
        <div className="crumb">
          <Link href="/pools">Vaults</Link> <span>/</span> <span>#{idStr}</span>
        </div>
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>This vault is private</h3>
          <p>Only its creator and invited members can view it. If you were invited, connect the wallet that was invited.</p>
          <Link className="btn btn-primary" href="/pools">
            Browse public vaults
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/pools">Vaults</Link> <span>/</span> <span>#{idStr}</span>
      </div>

      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 12 }}>
            <h1 style={{ margin: 0 }}>{label}.eth vault</h1>
            <span className={`tag tag-${status}`}>{status}</span>
          </div>
          <p>
            {effThreshold}-of-{contributorCount || "N"} Safe · created by <AddressLabel address={creator} />
            {safe !== "0x0000000000000000000000000000000000000000" ? (
              <>
                {" "}
                ·{" "}
                <a style={{ color: "var(--accent-2)" }} href={`https://app.safe.global/home?safe=${APP_CHAIN.safePrefix}:${safe}`} target="_blank" rel="noreferrer">
                  <AddressLabel address={safe} />
                </a>
              </>
            ) : (
              " · Safe deploys at finalization"
            )}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <ShareButton name={label} />
          <Link className="btn btn-ghost" href={`/name/${label}`}>
            View {label}.eth →
          </Link>
        </div>
      </div>

      {/* state banner */}
      {status === "funded" && (
        <div className="banner b-funded">
          <div className="b-text">
            <h3>Target reached — execution window open</h3>
            <p>
              Funds locked until {new Date(lockEnds * 1000).toLocaleString()}. Any contributor can finalize — it
              deploys a {effThreshold}-of-{contributorCount} Safe.
            </p>
          </div>
          <div className="b-cta">
            {isConnected && yourDeposit === 0n ? (
              <span className="muted" style={{ fontSize: 13, textAlign: "right", display: "block", maxWidth: 240 }}>
                Only contributors can finalize — deposit into this vault to help finalize it.
              </span>
            ) : (
              <button
                className="btn btn-primary"
                disabled={!isConnected || wrongChain || pending !== null || yourDeposit === 0n}
                onClick={() => act("finalize")}
              >
                {pending === "finalize" ? "Finalizing…" : "Finalize & deploy Safe"}
              </button>
            )}
          </div>
        </div>
      )}
      {status === "funding" && (
        <div className="banner b-funding">
          <div className="b-text">
            <h3>Funding — {fmtCountdown(fundingDeadline)} left</h3>
            <p>Deposit to reach the target. Withdraw in full any time before the execution lock.</p>
          </div>
        </div>
      )}

      {status === "finalized" && (
        <div style={{ marginBottom: 20 }}>
          <PoolRegister poolId={Number(idStr)} label={label} safe={safe} />
        </div>
      )}

      {error && (
        <div className="note note-warn" style={{ marginBottom: 20 }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
      {wrongChain && (
        <div className="note note-warn" style={{ marginBottom: 20 }}>
          <span>⚠</span>
          <span>Switch your wallet to {APP_CHAIN.label} to transact.</span>
        </div>
      )}

      <div className="cols">
        <div className="stack">
          <div className="panel">
            <span className="panel-title">Funding progress</span>
            <div className="spread" style={{ alignItems: "baseline", marginBottom: 10 }}>
              <span className="v big mono" style={{ fontSize: 22, fontWeight: 600 }}>
                {fmtEth(totalDeposited, 4)}
              </span>
              <span className="muted">of {fmtEth(targetAmount, 4)}</span>
            </div>
            <div className="progress">
              <div className="fill" style={{ width: `${funded}%` }} />
            </div>
            <div className="progress-label">
              <span>{funded.toFixed(1)}% funded</span>
              <span>
                {contributorCount} contributor{contributorCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">Contributors · ownership from on-chain deposits</span>
            {contributors && contributors[0].length > 0 ? (
              contributors[0].map((addr, i) => {
                const amt = contributors[1][i];
                const bps = targetAmount > 0n ? Number((amt * 10000n) / targetAmount) : 0;
                return (
                  <div key={addr} className="mrow">
                    <EnsAvatar address={addr} size={34} className="avatar" fallback={<div className="avatar">{addr.slice(2, 3).toUpperCase()}</div>} />
                    <div>
                      <div className="who">
                        <AddressLabel address={addr} mono={false} />
                        {address && addr.toLowerCase() === address.toLowerCase() ? " · you" : ""}
                        {addr.toLowerCase() === creator.toLowerCase() ? <span className="pill pill-ok" style={{ marginLeft: 8 }}>creator</span> : null}
                      </div>
                      <div className="sub mono">{addr}</div>
                    </div>
                    <div className="amt">
                      <div className="a">{fmtEth(amt, 3)}</div>
                      <div className="b">{(bps / 100).toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>
                No contributors yet.
              </p>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <span className="panel-title">Your position</span>
            <div className="kv">
              <span className="k">Deposited</span>
              <span className="v">{fmtEth(yourDeposit, 4)}</span>
            </div>
            <div className="kv">
              <span className="k">Ownership</span>
              <span className="v accent">{(Number(yourBps) / 100).toFixed(1)}%</span>
            </div>

            {status === "funding" && remaining > 0n && (
              <div className="row mt-16" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {fmtEth(remaining, 4)} ETH left to fill
                </span>
                <button type="button" className="linkish" onClick={() => setAmount(formatEther(remaining))}>
                  Max · fill pool
                </button>
              </div>
            )}
            <div className={status === "funding" && remaining > 0n ? "input-group mt-8" : "input-group mt-16"}>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="unit">ETH</span>
            </div>
            <div className="row mt-8" style={{ gap: 8 }}>
              <button
                className="btn btn-primary btn-block"
                disabled={!isConnected || wrongChain || pending !== null || status !== "funding"}
                onClick={() => act("deposit", parseEther(amount || "0"))}
              >
                {pending === "deposit" ? "Depositing…" : "Deposit"}
              </button>
              <button
                className="btn btn-ghost btn-block"
                disabled={!isConnected || wrongChain || pending !== null || yourDeposit === 0n || status === "funded" || status === "finalized"}
                onClick={() => act("withdraw")}
              >
                {pending === "withdraw" ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
            {status === "funded" && (
              <div className="note note-warn mt-8">
                <span>🔒</span>
                <span>Withdrawals locked during the 7-day execution window.</span>
              </div>
            )}
            {!isConnected && (
              <div className="note note-info mt-8">
                <span>ℹ</span>
                <span>Connect your wallet to deposit or withdraw.</span>
              </div>
            )}
          </div>

          <div className="panel">
            <span className="panel-title">Multisig</span>
            {safe !== "0x0000000000000000000000000000000000000000" ? (
              <>
                <div className="kv">
                  <span className="k">Safe</span>
                  <AddressLabel address={safe} className="v accent" mono={false} />
                </div>
                <div className="kv">
                  <span className="k">Threshold</span>
                  <span className="v">
                    {effThreshold} of {contributorCount}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Network</span>
                  <span className="v">{APP_CHAIN.label}</span>
                </div>
                <a className="btn btn-soft btn-block mt-16" href={`https://app.safe.global/home?safe=${APP_CHAIN.safePrefix}:${safe}`} target="_blank" rel="noreferrer">
                  Open in Safe →
                </a>
              </>
            ) : (
              <div className="note note-info">
                <span>ℹ</span>
                <span>Not yet deployed — deploys at finalization with all contributors as owners.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
