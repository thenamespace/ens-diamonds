"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  ENS_CONTROLLER,
  controllerAbi,
  ONE_YEAR,
  MIN_COMMIT_WAIT,
  MAX_COMMIT_AGE,
  randomSecret,
  buildRegistration,
} from "@/lib/ens-registrar";
import { fmtEth } from "@/lib/format";
import { txErrorMessage as errMsg } from "@/lib/tx-error";

type Step = "idle" | "committing" | "waiting" | "registering" | "done";
type Saved = { secret: `0x${string}`; committedAt: number; owner: string };

export default function BuySoloPage() {
  const { label: rawLabel } = useParams<{ label: string }>();
  const label = decodeURIComponent(rawLabel).toLowerCase().replace(/\.eth$/, "");
  const lsKey = `coffer:commit:${label}`;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== sepolia.id;
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const [committedAt, setCommittedAt] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const { data: reads, isLoading } = useReadContracts({
    contracts: [
      { address: ENS_CONTROLLER, abi: controllerAbi, functionName: "available", args: [label] },
      { address: ENS_CONTROLLER, abi: controllerAbi, functionName: "rentPrice", args: [label, ONE_YEAR] },
    ],
    query: { enabled: label.length >= 3 },
  });
  const available = reads?.[0]?.result as boolean | undefined;
  const price = reads?.[1]?.result as { base: bigint; premium: bigint } | undefined;
  const total = price ? price.base + price.premium : 0n;
  const value = total > 0n ? (total * 110n) / 100n : 0n; // +10% buffer for price/gas drift

  // Recover an in-progress commit after a refresh during the 60s wait.
  useEffect(() => {
    if (!address) return;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Saved;
      if (saved.owner?.toLowerCase() !== address.toLowerCase()) return;
      if (Math.floor(Date.now() / 1000) - saved.committedAt > MAX_COMMIT_AGE) {
        localStorage.removeItem(lsKey);
        return;
      }
      setSecret(saved.secret);
      setCommittedAt(saved.committedAt);
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

  const waited = committedAt ? nowSec - committedAt : 0;
  const remaining = Math.max(0, MIN_COMMIT_WAIT - waited);
  const canRegister = step === "waiting" && remaining === 0;

  async function doCommit() {
    if (!publicClient || !address) return;
    setError(null);
    const s = randomSecret();
    const reg = buildRegistration(label, address, s);
    try {
      setStep("committing");
      const commitment = (await publicClient.readContract({
        address: ENS_CONTROLLER,
        abi: controllerAbi,
        functionName: "makeCommitment",
        args: [reg],
      })) as `0x${string}`;
      const hash = await writeContractAsync({
        address: ENS_CONTROLLER,
        abi: controllerAbi,
        functionName: "commit",
        args: [commitment],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const ts = Math.floor(Date.now() / 1000);
      setSecret(s);
      setCommittedAt(ts);
      setNowSec(ts);
      setStep("waiting");
      localStorage.setItem(lsKey, JSON.stringify({ secret: s, committedAt: ts, owner: address } satisfies Saved));
    } catch (err) {
      setStep("idle");
      setError(errMsg(err));
    }
  }

  async function doRegister() {
    if (!publicClient || !address || !secret) return;
    setError(null);
    const reg = buildRegistration(label, address, secret);
    try {
      setStep("registering");
      const hash = await writeContractAsync({
        address: ENS_CONTROLLER,
        abi: controllerAbi,
        functionName: "register",
        args: [reg],
        value,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      localStorage.removeItem(lsKey);
      setStep("done");
    } catch (err) {
      setStep("waiting");
      setError(errMsg(err));
    }
  }

  const busy = step === "committing" || step === "registering";

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span> <Link href={`/name/${label}`}>{label}.eth</Link>{" "}
        <span>/</span> <span>Buy solo</span>
      </div>

      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>
            Buy {label}.eth <span style={{ color: "var(--faint)", fontWeight: 400 }}>solo</span>
          </h1>
          <p>Register it to your own wallet on Sepolia — no pool needed. ENS uses a two-step commit → wait → register.</p>
        </div>
        <Link className="btn btn-ghost" href={`/name/${label}`}>
          ← Back
        </Link>
      </div>

      <div className="note note-info" style={{ marginBottom: 20 }}>
        <span>ℹ</span>
        <span>
          This registers on <strong>Sepolia testnet</strong> (test ETH, no real funds). Mainnet buying arrives with the
          mainnet deployment.
        </span>
      </div>

      <div className="cols">
        <div className="stack">
          <div className="panel">
            <span className="panel-title">Register for 1 year</span>
            <div className="kv">
              <span className="k">Name</span>
              <span className="v">{label}.eth</span>
            </div>
            <div className="kv">
              <span className="k">Registration (1 yr)</span>
              <span className="v">{price ? fmtEth(price.base, 4) + " ETH" : "…"}</span>
            </div>
            <div className="kv">
              <span className="k">Temporary premium</span>
              <span className="v">{price ? fmtEth(price.premium, 4) + " ETH" : "…"}</span>
            </div>
            <div className="kv">
              <span className="k">You pay (with buffer)</span>
              <span className="v big accent">{value > 0n ? fmtEth(value, 4) + " ETH" : "…"}</span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              We send a 10% buffer over the quoted price; ENS refunds any overpayment.
            </p>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <span className="panel-title">Buy it</span>

            {label.length < 3 ? (
              <div className="note note-warn mt-8">
                <span>⚠</span>
                <span>ENS names must be at least 3 characters.</span>
              </div>
            ) : isLoading ? (
              <p className="muted">Checking availability…</p>
            ) : available === false && step !== "done" ? (
              <div className="note note-warn mt-8">
                <span>⚠</span>
                <span>{label}.eth is already registered on Sepolia. Try another name.</span>
              </div>
            ) : step === "done" ? (
              <div className="note note-ok mt-8" style={{ background: "rgba(34,197,94,0.1)" }}>
                <span>✓</span>
                <span>
                  Registered! {label}.eth is now owned by your wallet on Sepolia.{" "}
                  <a href={`https://sepolia.app.ens.domains/${label}.eth`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-2)" }}>
                    View on ENS →
                  </a>
                </span>
              </div>
            ) : !isConnected ? (
              <div className="note note-info mt-8">
                <span>ℹ</span>
                <span>Connect your wallet (top right) to register.</span>
              </div>
            ) : wrongChain ? (
              <button className="btn btn-primary btn-block mt-8" onClick={() => switchChain({ chainId: sepolia.id })}>
                Switch to Sepolia
              </button>
            ) : (
              <>
                <ol className="buy-steps">
                  <li className={step === "idle" || step === "committing" ? "on" : waited > 0 ? "done" : ""}>
                    <strong>1. Commit</strong> — a first tx that reserves your claim.
                  </li>
                  <li className={step === "waiting" ? "on" : step === "registering" ? "done" : ""}>
                    <strong>2. Wait ~60s</strong> — ENS anti-front-running delay.
                  </li>
                  <li className={step === "registering" ? "on" : ""}>
                    <strong>3. Register</strong> — a second tx that mints the name to you.
                  </li>
                </ol>

                {step === "idle" || step === "committing" ? (
                  <button className="btn btn-primary btn-block btn-lg mt-16" disabled={busy || !price} onClick={doCommit}>
                    {step === "committing" ? "Confirm commit in wallet…" : "Step 1 · Commit"}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-block btn-lg mt-16" disabled={!canRegister} onClick={doRegister}>
                    {step === "registering"
                      ? "Confirm register in wallet…"
                      : canRegister
                        ? "Step 3 · Register & claim"
                        : `Waiting… ${remaining}s`}
                  </button>
                )}

                {step === "waiting" && !canRegister && (
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 10, textAlign: "center" }}>
                    Keep this tab open. Safe to refresh — your commit is saved for 24h.
                  </p>
                )}
              </>
            )}

            {error && (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
