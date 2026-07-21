"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Chip, EmptyState, InputGroup, ProgressBar, buttonVariants } from "@thenamespace/uikit";
import { APP_CHAIN } from "@/lib/app-chain";
import { cofferEscrow, statusName, EXECUTION_WINDOW_SECONDS } from "@/lib/contract";
import { isEscrowConfigured } from "@/lib/chain";
import { isPoolVisible } from "@/lib/pool-filter";
import { txErrorMessage } from "@/lib/tx-error";
import { fmtEth, pct, parseEther, fmtCountdown } from "@/lib/format";
import AddressLabel from "@/components/address-label";
import EnsAvatar from "@/components/ens-avatar";
import ShareButton from "@/components/share-button";
import PoolRegister from "@/components/pool-register";
import { SkeletonPageHead, SkeletonPanelList } from "@/components/skeletons";

type PoolTuple = readonly [string, `0x${string}`, bigint, bigint, number, number, number, `0x${string}`];

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

  // Live registrar check for NOT-yet-finalized vaults: if someone registers
  // the name out from under the vault, fundraising is pointless — surface it
  // and shut deposits/finalize down so people withdraw instead. (Finalized
  // vaults get the equivalent "sniped" banner from the registration panel.)
  const poolLabel = pool?.[0];
  const notFinalized = statusNum !== undefined && statusName(statusNum) !== "finalized";
  const { data: registrarCheck } = useQuery({
    queryKey: ["name-taken", poolLabel],
    queryFn: async () => {
      const res = await fetch(`/api/name-status?label=${encodeURIComponent(poolLabel!)}`);
      if (!res.ok) throw new Error("status check failed");
      return (await res.json()) as { available: boolean | null };
    },
    enabled: !!poolLabel && notFinalized,
    // Fast poll so a snipe surfaces within seconds, without a refresh.
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
  });
  // Strictly `false` — null/unknown must never scare people or lock deposits.
  const nameTaken = notFinalized && registrarCheck?.available === false;

  // Finalized vaults: did this vault actually win the name? Shares the
  // registration panel's query key, so react-query dedupes the fetch.
  const { data: regState } = useQuery({
    queryKey: ["pool-register", Number(idStr)],
    queryFn: async () => {
      const res = await fetch(`/api/pools/registration?poolId=${Number(idStr)}`);
      if (!res.ok) throw new Error("Failed to load registration state");
      return (await res.json()) as { available: boolean | null; nameOwner: string | null; safe: string | null };
    },
    enabled: idOk && statusNum !== undefined && !notFinalized,
    refetchInterval: 30_000,
  });
  const wonName =
    !notFinalized &&
    regState?.available === false &&
    !!regState.nameOwner &&
    !!regState.safe &&
    regState.nameOwner.toLowerCase() === regState.safe.toLowerCase();

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
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Escrow address not configured. Set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </div>
    );
  }

  if (!idOk || (data && (!pool || !pool[0]))) {
    return (
      <div className="wrap">
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>Vault #{idStr} not found</EmptyState.Title>
            <EmptyState.Description>No vault with this id exists on the deployed escrow yet.</EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Link className={buttonVariants({ variant: "primary" })} href="/vaults">
              All vaults
            </Link>
          </EmptyState.Content>
        </EmptyState>
      </div>
    );
  }

  if (isLoading || !pool || statusNum === undefined) {
    return (
      <div className="wrap">
        <SkeletonPageHead />
        <SkeletonPanelList count={2} />
      </div>
    );
  }

  const [label, creator, targetAmount, totalDeposited, fundingDeadline, fundedAt, threshold, safe] = pool;
  const status = statusName(statusNum);
  const funded = pct(totalDeposited, targetAmount);
  const lockEnds = fundedAt > 0 ? fundedAt + EXECUTION_WINDOW_SECONDS : 0;
  const contributorCount = contributors ? contributors[0].length : 0;
  const remaining = targetAmount > totalDeposited ? targetAmount - totalDeposited : 0n;
  // At target but back in "funding": the 24h execution window lapsed without a
  // finalize. The contract rejects deposits here (PoolFull); recovery is a
  // withdraw + re-deposit by any contributor, which restarts the window.
  const windowLapsed = status === "funding" && remaining === 0n;
  const effThreshold = status === "finalized" ? threshold : Math.floor(contributorCount / 2) + 1;

  // Private pools are viewable only by the creator or an onchain-invited member.
  // Ids are sequential/guessable, so gate the detail page — not just the list.
  const invitedYou = (data?.[5]?.result as boolean | undefined) === true;
  const isPrivate = (privateData ?? []).includes(Number(idStr));
  if (!isPoolVisible({ isPrivate, viewer: address, creator, invited: invitedYou })) {
    return (
      <div className="wrap">
        <div className="crumb">
          <Link href="/vaults">Vaults</Link> <span>/</span> <span>#{idStr}</span>
        </div>
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>This vault is private</EmptyState.Title>
            <EmptyState.Description>
              Only its creator and invited members can view it. If you were invited, connect the wallet that was invited.
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Link className={buttonVariants({ variant: "primary" })} href="/vaults">
              Browse public vaults
            </Link>
          </EmptyState.Content>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/vaults">Vaults</Link> <span>/</span> <span>#{idStr}</span>
      </div>

      <div className="page-head">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="m-0">{label}.eth vault</h1>
            <Chip color={STATUS_CHIP[status] ?? "default"} size="sm" variant="soft">
              {status}
            </Chip>
            {wonName && (
              <Chip color="success" size="sm" variant="soft">
                winner 🥳
              </Chip>
            )}
          </div>
          <p>
            {effThreshold}-of-{contributorCount || "N"} Safe
            {safe !== "0x0000000000000000000000000000000000000000" ? (
              <>
                {" "}
                ·{" "}
                <a className="text-accent" href={`https://app.safe.global/home?safe=${APP_CHAIN.safePrefix}:${safe}`} target="_blank" rel="noreferrer">
                  <AddressLabel address={safe} />
                </a>
              </>
            ) : (
              " · Safe deploys at finalization"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton name={label} />
          <Link className={buttonVariants({ variant: "outline" })} href={`/name/${label}`}>
            View {label}.eth →
          </Link>
        </div>
      </div>

      {/* Name sniped while the vault was still raising: stop the fundraise. */}
      {nameTaken && (
        <Alert className="mb-5" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{label}.eth has already been registered by someone else</Alert.Title>
            <Alert.Description>
              This vault can no longer buy the name, so there&rsquo;s no reason to keep fundraising. Deposits and
              finalizing are disabled. Withdraw your deposit instead
              {status === "funded"
                ? " (withdrawals reopen the moment the 24-hour execution window ends)"
                : " (you can withdraw in full at any time)"}
              .
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* state banner */}
      {status === "funded" && !nameTaken && (
        <Alert className="mb-5" status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Target reached! Execution window open</Alert.Title>
            <Alert.Description>
              Withdrawals from this vault are locked until {new Date(lockEnds * 1000).toLocaleString()}.
              <br />
              Finalizing deploys a {effThreshold}-of-{contributorCount} Safe and moves the funds into it, ready
              to buy {label}.eth.
              <br />
              Any contributor can finalize.
            </Alert.Description>
          </Alert.Content>
          {isConnected && yourDeposit === 0n ? (
            <span className="block max-w-60 self-center text-right text-[13px] text-muted">
              {invitedYou
                ? "Only contributors can finalize. Deposit into this vault to help finalize it."
                : "Only this vault's contributors can finalize it."}
            </span>
          ) : (
            <Button
              className="self-center"
              variant="primary"
              isDisabled={!isConnected || wrongChain || pending !== null || yourDeposit === 0n}
              onPress={() => act("finalize")}
            >
              {pending === "finalize" ? "Finalizing…" : "Finalize & deploy Safe"}
            </Button>
          )}
        </Alert>
      )}
      {status === "funding" && !nameTaken && !windowLapsed && (
        <Alert className="mb-5" status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Funding · {fmtCountdown(fundingDeadline)} left</Alert.Title>
            <Alert.Description>Deposit to reach the target. Withdraw in full any time before the execution window.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {windowLapsed && !nameTaken && (
        <Alert className="mb-5" status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Execution window lapsed</Alert.Title>
            <Alert.Description>
              The vault hit its target but 24 hours passed without finalizing, so deposits are closed and
              withdrawals are open again. Any contributor can withdraw and re-deposit to restart the window,
              then finalize.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {status === "finalized" && (
        <div className="mb-5">
          <PoolRegister poolId={Number(idStr)} label={label} safe={safe} />
        </div>
      )}

      {error && (
        <Alert className="mb-5" status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {wrongChain && (
        <Alert className="mb-5" status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>Switch your wallet to {APP_CHAIN.label} to transact.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="cols">
        <div className="stack">
          <Card>
            <Card.Header>
              <Card.Title>Funding progress</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="mb-2.5 flex items-baseline justify-between">
                <span className="mono text-[22px] font-semibold">{fmtEth(totalDeposited, 4)}</span>
                <span className="text-muted">of {fmtEth(targetAmount, 4)}</span>
              </div>
              <ProgressBar aria-label="Funding progress" value={funded}>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                <span>{funded.toFixed(1)}% funded</span>
                <span>
                  {contributorCount} contributor{contributorCount === 1 ? "" : "s"}
                </span>
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>
                Contributors <span className="text-sm font-normal text-muted">· ownership from onchain deposits</span>
              </Card.Title>
            </Card.Header>
            <Card.Content>
              {contributors && contributors[0].length > 0 ? (
                contributors[0].map((addr, i) => {
                  const amt = contributors[1][i];
                  const bps = targetAmount > 0n ? Number((amt * 10000n) / targetAmount) : 0;
                  return (
                    <div key={addr} className="flex items-center gap-3 border-b border-separator py-3 first:pt-2 last:border-b-0 last:pb-0">
                      <EnsAvatar
                        address={addr}
                        size={34}
                        className="shrink-0 rounded-full"
                        fallback={
                          <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-semibold text-muted">
                            {addr.slice(2, 3).toUpperCase()}
                          </div>
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          <AddressLabel address={addr} linkEns mono={false} />
                          {address && addr.toLowerCase() === address.toLowerCase() ? " · you" : ""}
                          {addr.toLowerCase() === creator.toLowerCase() ? (
                            <Chip className="ml-2" color="success" size="sm" variant="soft">
                              creator
                            </Chip>
                          ) : null}
                        </div>
                        <div className="mono mt-1 truncate text-xs text-muted">{addr}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{fmtEth(amt, 3)}</div>
                        <div className="text-xs text-muted">{(bps / 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="m-0 text-sm text-muted">No contributors yet.</p>
              )}
            </Card.Content>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <Card.Header>
              <Card.Title>Your position</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="kv">
                <span className="k">Deposited</span>
                <span className="v">{fmtEth(yourDeposit, 4)}</span>
              </div>
              <div className="kv">
                <span className="k">Ownership</span>
                <span className="v accent">{(Number(yourBps) / 100).toFixed(1)}%</span>
              </div>

              {status === "funding" && remaining > 0n && (
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="text-xs text-muted">{fmtEth(remaining, 4)} left to fill</span>
                  <Button size="sm" variant="ghost" onPress={() => setAmount(formatEther(remaining))}>
                    Max · fill pool
                  </Button>
                </div>
              )}
              <InputGroup fullWidth className={status === "funding" && remaining > 0n ? "mt-2" : "mt-4"}>
                <InputGroup.Input
                  aria-label="Amount in ETH"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <InputGroup.Suffix>ETH</InputGroup.Suffix>
              </InputGroup>
              <div className="mt-2 flex gap-2">
                <Button
                  fullWidth
                  variant="primary"
                  isDisabled={!isConnected || wrongChain || pending !== null || status !== "funding" || windowLapsed || !invitedYou || nameTaken}
                  onPress={() => act("deposit", parseEther(amount || "0"))}
                >
                  {pending === "deposit" ? "Depositing…" : "Deposit"}
                </Button>
                <Button
                  fullWidth
                  variant="outline"
                  isDisabled={!isConnected || wrongChain || pending !== null || yourDeposit === 0n || status === "funded" || status === "finalized"}
                  onPress={() => act("withdraw")}
                >
                  {pending === "withdraw" ? "Withdrawing…" : "Withdraw"}
                </Button>
              </div>
              <div className="mt-2 text-center text-xs text-muted">
                By continuing you agree to the{" "}
                <Link className="font-semibold hover:text-foreground" href="/legal/terms">
                  Terms
                </Link>{" "}
                and acknowledge the{" "}
                <Link className="font-semibold hover:text-foreground" href="/legal/risks">
                  Risks
                </Link>
                .
              </div>
              {status === "funded" && (
                <Alert className="mt-2" status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Withdrawals locked during the 24-hour execution window.</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              {!isConnected && (
                <Alert className="mt-2" status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Connect your wallet to deposit or withdraw.</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              {isConnected && !invitedYou && (
                <Alert className="mt-2" status="accent">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      This wallet isn&rsquo;t on the invite list, so it can&rsquo;t deposit. Only the creator and invited
                      members can contribute to a vault.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>Multisig</Card.Title>
            </Card.Header>
            <Card.Content>
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
                  <a
                    className={buttonVariants({ variant: "secondary", fullWidth: true, className: "mt-4" })}
                    href={`https://app.safe.global/home?safe=${APP_CHAIN.safePrefix}:${safe}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Safe →
                  </a>
                </>
              ) : (
                <p className="m-0 text-sm text-muted">
                  Not yet deployed. Deploys at finalization with all contributors as owners.
                </p>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
