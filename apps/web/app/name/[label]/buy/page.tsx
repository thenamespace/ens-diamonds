"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { labelhash } from "viem";
import { Alert, Button, buttonVariants, Card, ProgressBar, Stepper } from "@thenamespace/uikit";
import { APP_CHAIN } from "@/lib/app-chain";
import {
  ENS_CONTROLLER,
  ENS_BASE_REGISTRAR,
  REGISTRATION_MODE,
  controllerAbi,
  baseRegistrarAbi,
  v2ControllerAbi,
  buildRegistration,
  randomSecret,
  ONE_YEAR,
  MIN_COMMIT_WAIT,
} from "@/lib/ens-registrar";
import { registerValue, commitFreshness } from "@/lib/registrar-flow";
import { fmtEth, shortLabel } from "@/lib/format";
import { txErrorMessage as errMsg } from "@/lib/tx-error";

export default function BuySoloPage() {
  return REGISTRATION_MODE === "commit-reveal" ? <BuyCommitReveal /> : <BuyInstant />;
}

// ---------------------------------------------------------------------------
// Sepolia: TestnetV1PremigrationRegistrar — one free register() tx, no
// commit-reveal (the registrar refunds any ETH sent).
// ---------------------------------------------------------------------------

type InstantStep = "idle" | "registering" | "done";

function BuyInstant() {
  const { label: rawLabel } = useParams<{ label: string }>();
  const label = decodeURIComponent(rawLabel).toLowerCase().replace(/\.eth$/, "");

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== APP_CHAIN.chainId;
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<InstantStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const { data: available, isLoading } = useReadContract({
    address: ENS_BASE_REGISTRAR,
    abi: baseRegistrarAbi,
    functionName: "available",
    args: [BigInt(labelhash(label))],
    query: { enabled: label.length >= 3 },
  });

  async function doRegister() {
    if (!publicClient || !address) return;
    setError(null);
    const reg = buildRegistration(label, address);
    try {
      setStep("registering");
      const hash = await writeContractAsync({
        address: ENS_CONTROLLER,
        abi: controllerAbi,
        functionName: "register",
        args: [reg],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStep("done");
      // Record for the portfolio page (server re-verifies ownership onchain).
      fetch("/api/portfolio/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, label }),
      }).catch(() => {});
    } catch (err) {
      setStep("idle");
      setError(errMsg(err));
    }
  }

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span> <Link href={`/name/${label}`}>{label}.eth</Link>{" "}
        <span>/</span> <span>Buy solo</span>
      </div>

      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }} title={`${label}.eth`}>
            Buy {shortLabel(label)}.eth <span className="font-normal text-muted">solo</span>
          </h1>
          <p>Register it to your own wallet on Sepolia — no vault needed. One transaction and it&rsquo;s yours.</p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href={`/name/${label}`}>
          ← Back
        </Link>
      </div>

      <Alert status="accent" className="mb-5">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            This registers on <strong>Sepolia testnet</strong>, where ENS registration is free — you pay only gas.
            Mainnet buying (with real premium pricing) arrives with the mainnet deployment.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="grid grid-cols-1 items-start gap-[22px] min-[901px]:grid-cols-[1.4fr_0.9fr]">
        <div className="stack">
          <Card>
            <Card.Header>
              <Card.Title>Register for 1 year</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="kv">
                <span className="k">Name</span>
                <span className="v">{label}.eth</span>
              </div>
              <div className="kv">
                <span className="k">Duration</span>
                <span className="v">1 year</span>
              </div>
              <div className="kv">
                <span className="k">Registration cost</span>
                <span className="v big accent">Free</span>
              </div>
              <p className="mt-2 mb-0 text-[12.5px] text-muted">
                Sepolia&rsquo;s ENS registrar charges nothing and refunds any ETH sent — the only cost is gas.
              </p>
            </Card.Content>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <Card.Header>
              <Card.Title>Buy it</Card.Title>
            </Card.Header>
            <Card.Content>
              {label.length < 3 ? (
                <Alert status="warning" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>ENS names must be at least 3 characters.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : isLoading ? (
                <p className="text-muted">Checking availability…</p>
              ) : available === false && step !== "done" ? (
                <Alert status="warning" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {label}.eth is already registered on Sepolia. Try another name.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : step === "done" ? (
                <Alert status="success" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      Registered! {label}.eth is now owned by your wallet on Sepolia.{" "}
                      <a
                        href={`${APP_CHAIN.ensAppUrl}/${label}.eth`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent"
                      >
                        View on ENS →
                      </a>
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : !isConnected ? (
                <Alert status="accent" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Connect your wallet (top right) to register.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : wrongChain ? (
                <Button
                  variant="primary"
                  className="mt-2 w-full"
                  onPress={() => switchChain({ chainId: APP_CHAIN.chainId })}
                >
                  Switch to Sepolia
                </Button>
              ) : (
                <>
                  <p className="text-[13.5px] text-muted">
                    One transaction registers <strong>{label}.eth</strong> to your wallet and sets the public resolver.
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    className="mt-4 w-full"
                    isPending={step === "registering"}
                    onPress={doRegister}
                  >
                    {step === "registering" ? "Confirm in wallet…" : "Register & claim"}
                  </Button>
                </>
              )}

              {error && (
                <Alert status="warning" className="mt-4">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mainnet: ETHRegistrarController v2 — paid, commit-reveal. commit(hash) →
// wait ≥60s → register{value}. The controller refunds any overpayment.
// ---------------------------------------------------------------------------

type CommitStep = "idle" | "committing" | "waiting" | "registering" | "done";
type Saved = { secret: `0x${string}`; committedAt: number; owner: string };

function BuyCommitReveal() {
  const { label: rawLabel } = useParams<{ label: string }>();
  const label = decodeURIComponent(rawLabel).toLowerCase().replace(/\.eth$/, "");
  const lsKey = `coffer:commit:${APP_CHAIN.key}:${label}`;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== APP_CHAIN.chainId;
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const [committedAt, setCommittedAt] = useState<number | null>(null);
  const [committedOwner, setCommittedOwner] = useState<string | null>(null);
  const [step, setStep] = useState<CommitStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const { data: available, isLoading } = useReadContract({
    address: ENS_BASE_REGISTRAR,
    abi: baseRegistrarAbi,
    functionName: "available",
    args: [BigInt(labelhash(label))],
    query: { enabled: label.length >= 3, refetchInterval: 10_000 },
  });

  const { data: price } = useReadContract({
    address: ENS_CONTROLLER,
    abi: v2ControllerAbi,
    functionName: "rentPrice",
    args: [label, ONE_YEAR],
    query: { enabled: label.length >= 3, refetchInterval: 10_000 },
  });
  const total = price ? price.base + price.premium : 0n;
  const value = registerValue(total, "commit-reveal");

  // Recover an in-progress commit after a refresh during the wait.
  useEffect(() => {
    if (!address) return;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Saved;
      // A corrupt record must not fall through commitFreshness as NaN → "ready".
      const valid =
        typeof saved === "object" &&
        saved !== null &&
        typeof saved.committedAt === "number" &&
        Number.isFinite(saved.committedAt) &&
        typeof saved.secret === "string" &&
        /^0x[0-9a-fA-F]{64}$/.test(saved.secret) &&
        typeof saved.owner === "string";
      if (!valid) {
        localStorage.removeItem(lsKey);
        return;
      }
      if (saved.owner.toLowerCase() !== address.toLowerCase()) return;
      const now = Math.floor(Date.now() / 1000);
      if (commitFreshness(saved.committedAt, now) === "expired") {
        localStorage.removeItem(lsKey);
        return;
      }
      setSecret(saved.secret);
      setCommittedAt(saved.committedAt);
      setCommittedOwner(saved.owner);
      setNowSec(now);
      setStep((s) => (s === "idle" ? "waiting" : s));
    } catch {
      /* ignore corrupt state */
    }
  }, [address, lsKey]);

  useEffect(() => {
    if (step !== "waiting") return;
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [step]);

  const freshness = committedAt !== null ? commitFreshness(committedAt, nowSec) : null;
  const waited = committedAt ? nowSec - committedAt : 0;
  const remaining = Math.max(0, MIN_COMMIT_WAIT - waited);
  // Switching accounts mid-flow would rebuild the register struct with the NEW
  // address → guaranteed CommitmentNotFound revert (wasted mainnet gas). Block it.
  const ownerMismatch =
    !!committedOwner && !!address && committedOwner.toLowerCase() !== address.toLowerCase();
  const canRegister = step === "waiting" && freshness === "ready" && !ownerMismatch;

  // A commit can go stale (24h) while the tab is sitting open on "waiting".
  useEffect(() => {
    if (step !== "waiting" || freshness !== "expired") return;
    localStorage.removeItem(lsKey);
    setSecret(null);
    setCommittedAt(null);
    setCommittedOwner(null);
    setStep("idle");
    setError("Your commit expired (24h) — start again.");
  }, [step, freshness, lsKey]);

  async function doCommit() {
    if (!publicClient || !address) return;
    setError(null);
    const s = randomSecret();
    const reg = buildRegistration(label, address, s);
    try {
      setStep("committing");
      const commitment = await publicClient.readContract({
        address: ENS_CONTROLLER,
        abi: v2ControllerAbi,
        functionName: "makeCommitment",
        args: [reg],
      });
      const hash = await writeContractAsync({
        address: ENS_CONTROLLER,
        abi: v2ControllerAbi,
        functionName: "commit",
        args: [commitment],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const ts = Math.floor(Date.now() / 1000);
      setSecret(s);
      setCommittedAt(ts);
      setCommittedOwner(address);
      setNowSec(ts);
      setStep("waiting");
      localStorage.setItem(lsKey, JSON.stringify({ secret: s, committedAt: ts, owner: address } satisfies Saved));
    } catch (err) {
      setStep("idle");
      setError(errMsg(err));
    }
  }

  async function doRegister() {
    if (!publicClient || !address || !secret || ownerMismatch) return;
    setError(null);
    try {
      setStep("registering");
      // Re-read the price at click time — it may have drifted since the commit.
      const fresh = await publicClient.readContract({
        address: ENS_CONTROLLER,
        abi: v2ControllerAbi,
        functionName: "rentPrice",
        args: [label, ONE_YEAR],
      });
      const freshValue = registerValue(fresh.base + fresh.premium, "commit-reveal");
      const reg = buildRegistration(label, address, secret);
      const hash = await writeContractAsync({
        address: ENS_CONTROLLER,
        abi: v2ControllerAbi,
        functionName: "register",
        args: [reg],
        value: freshValue,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      localStorage.removeItem(lsKey);
      setStep("done");
      // Record for the portfolio page (server re-verifies ownership onchain).
      fetch("/api/portfolio/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, label }),
      }).catch(() => {});
    } catch (err) {
      setStep("waiting");
      setError(errMsg(err));
    }
  }

  // Stepper display state: 0 = commit, 1 = wait, 2 = register. Steps below
  // `currentStep` render as complete, the current one as active.
  const currentStep = step === "idle" || step === "committing" ? 0 : step === "waiting" && !canRegister ? 1 : 2;

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span> <Link href={`/name/${label}`}>{label}.eth</Link>{" "}
        <span>/</span> <span>Buy solo</span>
      </div>

      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }} title={`${label}.eth`}>
            Buy {shortLabel(label)}.eth <span className="font-normal text-muted">solo</span>
          </h1>
          <p>Register it to your own wallet — no vault needed. ENS uses a two-step commit → wait → register.</p>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href={`/name/${label}`}>
          ← Back
        </Link>
      </div>

      <Alert status="accent" className="mb-5">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            This registers on <strong>Ethereum mainnet with real ETH</strong>. ENS uses a two-step commit → wait →
            register to prevent front-running.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="grid grid-cols-1 items-start gap-[22px] min-[901px]:grid-cols-[1.4fr_0.9fr]">
        <div className="stack">
          <Card>
            <Card.Header>
              <Card.Title>Register for 1 year</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="kv">
                <span className="k">Name</span>
                <span className="v">{label}.eth</span>
              </div>
              <div className="kv">
                <span className="k">Registration (1 yr)</span>
                <span className="v">{price ? fmtEth(price.base, 4) : "…"}</span>
              </div>
              <div className="kv">
                <span className="k">Temporary premium</span>
                <span className="v">{price ? fmtEth(price.premium, 4) : "…"}</span>
              </div>
              <div className="kv">
                <span className="k">Total</span>
                <span className="v">{price ? fmtEth(total, 4) : "…"}</span>
              </div>
              <div className="kv">
                <span className="k">You pay (with buffer)</span>
                <span className="v big accent">{value > 0n ? fmtEth(value, 4) : "…"}</span>
              </div>
              <p className="mt-2 mb-0 text-[12.5px] text-muted">
                We send a 10% buffer over the quoted price; ENS refunds any overpayment in the same transaction.
              </p>
            </Card.Content>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <Card.Header>
              <Card.Title>Buy it</Card.Title>
            </Card.Header>
            <Card.Content>
              {label.length < 3 ? (
                <Alert status="warning" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>ENS names must be at least 3 characters.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : isLoading ? (
                <p className="text-muted">Checking availability…</p>
              ) : available === false && step !== "done" ? (
                <Alert status="warning" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{label}.eth is already registered. Try another name.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : step === "done" ? (
                <Alert status="success" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      Registered! {label}.eth is now owned by your wallet.{" "}
                      <a
                        href={`${APP_CHAIN.ensAppUrl}/${label}.eth`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-accent"
                      >
                        View on ENS →
                      </a>
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : !isConnected ? (
                <Alert status="accent" className="mt-2">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>Connect your wallet (top right) to register.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : wrongChain ? (
                <Button
                  variant="primary"
                  className="mt-2 w-full"
                  onPress={() => switchChain({ chainId: APP_CHAIN.chainId })}
                >
                  Switch to Ethereum
                </Button>
              ) : (
                <>
                  <Stepper orientation="vertical" size="sm" currentStep={currentStep}>
                    <Stepper.Step>
                      <Stepper.Indicator />
                      <Stepper.Content>
                        <Stepper.Title>Commit</Stepper.Title>
                        <Stepper.Description>A first transaction that reserves your claim.</Stepper.Description>
                      </Stepper.Content>
                      <Stepper.Separator />
                    </Stepper.Step>

                    <Stepper.Step>
                      <Stepper.Indicator />
                      <Stepper.Content>
                        <Stepper.Title>Wait 60 seconds</Stepper.Title>
                        <Stepper.Description>ENS&rsquo;s anti-front-running delay.</Stepper.Description>
                        {step === "waiting" && !canRegister && (
                          <span className="mt-2 block">
                            <ProgressBar
                              aria-label="Commit wait"
                              size="sm"
                              value={Math.min(100, (waited / MIN_COMMIT_WAIT) * 100)}
                            >
                              <ProgressBar.Track>
                                <ProgressBar.Fill />
                              </ProgressBar.Track>
                            </ProgressBar>
                            <span className="mono mt-1.5 flex justify-between gap-3 text-[11px] text-muted">
                              <span>Keep this tab open · safe to refresh</span>
                              <span>{remaining}s</span>
                            </span>
                          </span>
                        )}
                      </Stepper.Content>
                      <Stepper.Separator />
                    </Stepper.Step>

                    <Stepper.Step>
                      <Stepper.Indicator />
                      <Stepper.Content>
                        <Stepper.Title>Register</Stepper.Title>
                        <Stepper.Description>
                          A second transaction that mints the name to your wallet.
                        </Stepper.Description>
                      </Stepper.Content>
                      <Stepper.Separator />
                    </Stepper.Step>
                  </Stepper>

                  {step === "idle" || step === "committing" ? (
                    <Button
                      variant="primary"
                      size="lg"
                      className="mt-4 w-full"
                      isDisabled={!price}
                      isPending={step === "committing"}
                      onPress={doCommit}
                    >
                      {step === "committing" ? "Confirm commit in wallet…" : "Commit"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        size="lg"
                        className="mt-4 w-full"
                        isDisabled={!canRegister}
                        isPending={step === "registering"}
                        onPress={doRegister}
                      >
                        {step === "registering"
                          ? "Confirm register in wallet…"
                          : canRegister
                            ? "Register & claim"
                            : `Register — ready in ${remaining}s`}
                      </Button>
                      {ownerMismatch && (
                        <Alert status="warning" className="mt-4">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Description>
                              This commit was made with a different wallet (
                              <span className="mono">
                                {committedOwner!.slice(0, 6)}…{committedOwner!.slice(-4)}
                              </span>
                              ). Switch back to that account to register, or start a new commit.
                            </Alert.Description>
                          </Alert.Content>
                        </Alert>
                      )}
                    </>
                  )}
                </>
              )}

              {error && (
                <Alert status="warning" className="mt-4">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
