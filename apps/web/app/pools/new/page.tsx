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

const MAX_SIGNERS = 10;

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
  const [threshold, setThreshold] = useState(1);
  const [days, setDays] = useState(7);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [labelInput, setLabelInput] = useState(label || "");

  const [step, setStep] = useState<"idle" | "creating" | "depositing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const targetNum = Math.max(0, parseFloat(target) || 0);
  const yourNum = Math.max(0, parseFloat(yourContrib) || 0);
  const validInvitees = invitees.filter((i) => isAddress(i.addr.trim()));
  const badInvitees = invitees.filter((i) => i.addr.trim() && !isAddress(i.addr.trim()));
  const signers = validInvitees.length + 1;
  const yourPct = targetNum > 0 ? Math.min(100, (yourNum / targetNum) * 100) : 0;

  const wrongChain = isConnected && chainId !== sepolia.id;
  const canSubmit =
    isConnected &&
    !wrongChain &&
    isEscrowConfigured &&
    labelInput.trim().length >= 3 &&
    targetNum > 0 &&
    yourNum > 0 &&
    yourNum <= targetNum &&
    threshold >= 1 &&
    threshold <= signers &&
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
        args: [labelInput.trim(), targetWei, deadline, threshold, inviteeAddrs],
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

      setStep("done");
      router.push(`/pools/${poolId.toString()}`);
    } catch (err) {
      setStep("idle");
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.split("\n")[0].slice(0, 200));
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
            </div>

            <div className="field">
              <label>
                Your contribution <span className="hint">{yourPct.toFixed(1)}% ownership</span>
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
                Signatures to buy <span className="hint">of up to {signers} signers</span>
              </label>
              <div className="row" style={{ gap: 14 }}>
                <input className="range" type="range" min={1} max={Math.max(signers, 1)} value={threshold} onChange={(e) => setThreshold(+e.target.value)} />
                <span className="mono" style={{ fontWeight: 600, minWidth: 88, textAlign: "right" }}>
                  {threshold} of {signers}
                </span>
              </div>
              {threshold === signers && signers > 1 && (
                <div className="note note-warn mt-8">
                  <span>⚠</span>
                  <span>N-of-N: one unresponsive signer freezes the Safe forever.</span>
                </div>
              )}
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
                {threshold}-of-{signers}
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
              {busy ? "Two transactions: createPool, then your deposit." : `Deploys a ${threshold}-of-${signers} Safe at finalization.`}
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
