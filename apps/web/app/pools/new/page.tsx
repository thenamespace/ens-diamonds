"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";
import { isAddress, parseEventLogs } from "viem";
import { cofferEscrow } from "@/lib/contract";
import { cofferEscrowAbi } from "@/lib/abi/coffer-escrow";
import { isEscrowConfigured } from "@/lib/chain";
import { parseEther } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { txErrorMessage } from "@/lib/tx-error";

const MAX_SIGNERS = 10;
const MIN_CONTRIB = 0.01; // matches CofferEscrow MIN_CONTRIBUTION for partial deposits

type Invitee = { id: number; addr: string; contribEth: string };

function NewPoolForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const label = (sp.get("label") ?? "").toLowerCase().replace(/\.eth$/, "");

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [target, setTarget] = useState("0.03");
  const [yourContrib, setYourContrib] = useState("0.02");
  const [days, setDays] = useState(7);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [labelInput, setLabelInput] = useState(label || "");
  const [isPublic, setIsPublic] = useState(true);
  const { isSignedIn, signIn } = useAuth();

  const [step, setStep] = useState<"idle" | "creating" | "depositing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const targetNum = Math.max(0, parseFloat(target) || 0);
  const yourNum = Math.max(0, parseFloat(yourContrib) || 0);
  const validInvitees = invitees.filter((i) => isAddress(i.addr.trim()));
  const badInvitees = invitees.filter((i) => i.addr.trim() && !isAddress(i.addr.trim()));
  const signers = validInvitees.length + 1;
  const majority = Math.floor(signers / 2) + 1;
  const yourPct = targetNum > 0 ? Math.min(100, (yourNum / targetNum) * 100) : 0;

  // The contract requires a partial deposit be >= 0.01 ETH unless it funds the
  // exact remaining gap. The creator's initial deposit is partial whenever it
  // doesn't cover the whole target, so enforce the same rule to avoid a revert.
  const fundsFullTarget = targetNum > 0 && yourNum >= targetNum;
  const contribTooLow = yourNum > 0 && !fundsFullTarget && yourNum < MIN_CONTRIB;

  const wrongChain = isConnected && chainId !== sepolia.id;
  const canSubmit =
    isConnected &&
    !wrongChain &&
    isEscrowConfigured &&
    labelInput.trim().length >= 3 &&
    targetNum > 0 &&
    yourNum > 0 &&
    yourNum <= targetNum &&
    !contribTooLow &&
    signers <= MAX_SIGNERS &&
    badInvitees.length === 0 &&
    step === "idle";

  function addInvitee() {
    if (invitees.length + 1 >= MAX_SIGNERS) return;
    setInvitees((v) => [...v, { id: Date.now(), addr: "", contribEth: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !publicClient) return;
    setError(null);
    try {
      const deadline = Math.floor(Date.now() / 1000) + days * 86400; // uint40 → number
      const targetWei = parseEther(target);
      const inviteeAddrs = validInvitees.map((i) => i.addr.trim() as `0x${string}`);

      setStep("creating");
      const hash1 = await writeContractAsync({
        ...cofferEscrow,
        functionName: "createPool",
        args: [labelInput.trim(), targetWei, deadline, inviteeAddrs],
      });
      const rc1 = await publicClient.waitForTransactionReceipt({ hash: hash1 });
      const events = parseEventLogs({ abi: cofferEscrowAbi, logs: rc1.logs, eventName: "PoolCreated" });
      const poolId = (events[0] as unknown as { args: { poolId: bigint } }).args.poolId;

      setStep("depositing");
      const hash2 = await writeContractAsync({
        ...cofferEscrow,
        functionName: "deposit",
        args: [poolId],
        value: parseEther(yourContrib),
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });

      // Public is the default (absence of a record). Only a private pool needs a
      // creator-signed visibility write; failure is non-fatal.
      if (!isPublic) {
        try {
          if (!isSignedIn) await signIn();
          await fetch("/api/pools/visibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ poolId: Number(poolId), public: false }),
          });
        } catch {
          /* non-fatal: pool stays public until retried */
        }
      }

      setStep("done");
      router.push(`/pools/${poolId.toString()}`);
    } catch (err) {
      setStep("idle");
      setError(txErrorMessage(err));
    }
  }

  const busy = step === "creating" || step === "depositing";

  return (
    <form className="wrap" onSubmit={submit}>
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span>
        {label ? (
          <>
            <Link href={`/name/${label}`}>{label}.eth</Link> <span>/</span>
          </>
        ) : null}
        <span>Start a pool</span>
      </div>

      <div className="page-head">
        <div>
          <h1>Start a pool{labelInput ? ` to buy ${labelInput}.eth` : ""}</h1>
          <p>
            Set your stake, then invite people by address. Everyone deposits into the audited escrow on Sepolia; on
            success it deploys a multisig you all control.
          </p>
        </div>
      </div>

      {!isEscrowConfigured && (
        <div className="note note-warn" style={{ marginBottom: 20 }}>
          <span>⚠</span>
          <span>Escrow address not configured — set NEXT_PUBLIC_ESCROW_ADDRESS and restart the dev server.</span>
        </div>
      )}

      <div className="cols">
        <div className="stack">
          <div className="panel">
            <span className="panel-title">1 · Pool basics</span>

            <div className="field">
              <label>
                Name <span className="hint">.eth label, min 3 chars</span>
              </label>
              <div className="input-group">
                <input value={labelInput} onChange={(e) => setLabelInput(e.target.value.toLowerCase())} placeholder="defi" />
                <span className="unit">.eth</span>
              </div>
            </div>

            <div className="field">
              <label>
                Target amount <span className="hint">wei-precise; overpay refunded at registration</span>
              </label>
              <div className="input-group">
                <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
                <span className="unit">ETH</span>
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                {signers > 1
                  ? `Each of the ${signers} signers deposits at least ${MIN_CONTRIB} ETH — aim for a target of ≥ ${(signers * MIN_CONTRIB).toFixed(2)} ETH.`
                  : `Invite people below to split the cost; each contributor deposits at least ${MIN_CONTRIB} ETH.`}
              </p>
            </div>

            <div className="field">
              <label>
                Your contribution{" "}
                <span className="hint">
                  {yourPct.toFixed(1)}% ownership · min {MIN_CONTRIB} ETH
                </span>
              </label>
              <div className="input-group">
                <input inputMode="decimal" value={yourContrib} onChange={(e) => setYourContrib(e.target.value)} />
                <span className="unit">ETH</span>
              </div>
              <input
                className="range mt-8"
                type="range"
                min={0}
                max={targetNum || 1}
                step={0.001}
                value={Math.min(yourNum, targetNum || 1)}
                onChange={(e) => setYourContrib(e.target.value)}
              />
              <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                Everyone deposits at least {MIN_CONTRIB} ETH — the only exception is whoever tops the pool up to
                its exact target.
              </p>
              {contribTooLow && (
                <div className="note note-warn mt-8">
                  <span>⚠</span>
                  <span>
                    Your contribution is below the {MIN_CONTRIB} ETH minimum. Raise it to at least {MIN_CONTRIB} ETH,
                    or fund the full {targetNum > 0 ? targetNum.toFixed(3) : ""} ETH target yourself.
                  </span>
                </div>
              )}
            </div>

            <div className="field">
              <label>
                Funding deadline <span className="hint">days from now</span>
              </label>
              <div className="row" style={{ gap: 14 }}>
                <input className="range" type="range" min={1} max={30} value={days} onChange={(e) => setDays(+e.target.value)} />
                <span className="mono" style={{ minWidth: 60, textAlign: "right", fontWeight: 600 }}>
                  {days}d
                </span>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>
                Signatures to buy <span className="hint">automatic majority</span>
              </label>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Buying the name needs a <strong>majority</strong> of contributors to sign — {majority} of {signers}.
                No single person can act alone.
              </p>
              {signers === 2 && (
                <div className="note note-warn mt-8">
                  <span>⚠</span>
                  <span>With 2 people it’s 2-of-2: if one loses their key, the wallet is frozen. Add a third for a safety margin.</span>
                </div>
              )}
            </div>

            <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>
                  List this pool publicly <span className="hint">shows in the Pools directory</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublic}
                  className={`toggle${isPublic ? " on" : ""}`}
                  onClick={() => setIsPublic((v) => !v)}
                >
                  <span className="toggle-knob" />
                </button>
              </label>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {isPublic
                  ? "Anyone can find this pool in the directory. Only addresses you invite can deposit."
                  : "Private — only you and the people you invite can see it. You’ll sign a quick message to confirm you’re the creator."}
              </p>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">2 · Invite members (optional)</span>
            <p className="muted" style={{ fontSize: 13.5, marginTop: -6 }}>
              Paste wallet addresses to invite. Leave empty to fund it solo. (ENS-name invites come later.)
            </p>
            {invitees.map((i) => (
              <div key={i.id} className="row mt-8" style={{ gap: 8 }}>
                <input
                  className="input"
                  placeholder="0x… address"
                  value={i.addr}
                  onChange={(e) => setInvitees((v) => v.map((x) => (x.id === i.id ? { ...x, addr: e.target.value } : x)))}
                  style={{ borderColor: i.addr.trim() && !isAddress(i.addr.trim()) ? "var(--danger)" : undefined }}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInvitees((v) => v.filter((x) => x.id !== i.id))}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-soft btn-sm mt-16" onClick={addInvitee} disabled={invitees.length + 1 >= MAX_SIGNERS}>
              + Add member {invitees.length + 1 >= MAX_SIGNERS ? "(max 10)" : ""}
            </button>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <span className="panel-title">Deploy</span>
            <div className="kv">
              <span className="k">Target</span>
              <span className="v">{targetNum.toFixed(3)} ETH</span>
            </div>
            <div className="kv">
              <span className="k">Your deposit</span>
              <span className="v accent">
                {yourNum.toFixed(3)} ETH · {yourPct.toFixed(1)}%
              </span>
            </div>
            <div className="kv">
              <span className="k">Scheme</span>
              <span className="v">
                {majority}-of-{signers}
              </span>
            </div>

            {!isConnected ? (
              <div className="note note-info mt-16">
                <span>ℹ</span>
                <span>Connect your wallet (top right) to create the pool.</span>
              </div>
            ) : wrongChain ? (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>Switch your wallet to Sepolia to continue.</span>
              </div>
            ) : null}

            {error && (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg mt-16" disabled={!canSubmit}>
              {step === "creating" ? "Confirm create in wallet…" : step === "depositing" ? "Confirm deposit in wallet…" : "Create pool & deposit"}
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, color: "var(--faint)" }}>
              {busy ? "Two transactions: createPool, then your deposit." : `Deploys a ${majority}-of-${signers} Safe at finalization.`}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function NewPoolPage() {
  return (
    <Suspense fallback={<div className="wrap">Loading…</div>}>
      <NewPoolForm />
    </Suspense>
  );
}
