"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { getAddress, isAddress, parseEventLogs } from "viem";
import { APP_CHAIN } from "@/lib/app-chain";
import { cofferEscrow } from "@/lib/contract";
import { cofferEscrowAbi } from "@/lib/abi/coffer-escrow";
import { isEscrowConfigured } from "@/lib/chain";
import { parseEther } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { txErrorMessage } from "@/lib/tx-error";

const MAX_SIGNERS = 10;
const MIN_CONTRIB = 0.01; // matches CofferEscrow MIN_CONTRIBUTION for partial deposits

type Invitee = { id: number; value: string };

// Result of resolving one invitee entry (name→address or address→name).
type Resolution = "checking" | "bad" | { address: `0x${string}`; name: string | null };

type NameCheck = null | "checking" | "premium" | "available" | "active" | "grace" | "tooShort" | "invalid" | "unknown";

// How each live ENS status reads in the create form. `ok` = poolable; `block`
// = you can't register it, so funding a pool would waste everyone's money.
const NAME_STATUS: Record<
  Exclude<NameCheck, null | "checking">,
  { text: string; kind: "ok" | "block" | "info"; note: string }
> = {
  premium: {
    text: "In temporary premium",
    kind: "ok",
    note: "In its 21-day premium auction — exactly what vaults are for. Good to go.",
  },
  available: {
    text: "Available",
    kind: "ok",
    note: "Expired and available at base price — good to start a vault for.",
  },
  active: {
    text: "Registered",
    kind: "block",
    note: "This name is currently registered to someone else — you can't register it, so a vault for it can never succeed.",
  },
  grace: {
    text: "In grace period",
    kind: "block",
    note: "Expired but still in its 90-day grace period, so the current owner can renew it. You can't start a vault for it until it enters the premium auction.",
  },
  tooShort: { text: "Too short", kind: "info", note: "ENS names need at least 3 characters." },
  invalid: { text: "Not a valid name", kind: "block", note: "This isn't a registrable ENS label." },
  unknown: { text: "Couldn't verify", kind: "info", note: "Couldn't check this name's status right now — double-check before funding." },
};

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// One invitee input that live-resolves ENS names ↔ addresses against mainnet and
// reports the resolved address up to the form. Names are shown over addresses.
function InviteeRow({
  value,
  selfAddress,
  duplicate,
  onChange,
  onRemove,
  onResolve,
}: {
  value: string;
  selfAddress?: string;
  duplicate?: boolean;
  onChange: (v: string) => void;
  onRemove: () => void;
  onResolve: (r: Resolution | null) => void;
}) {
  const v = value.trim();
  const [res, setRes] = useState<Resolution | null>(null);

  useEffect(() => {
    if (!v) {
      setRes(null);
      onResolve(null);
      return;
    }
    let cancelled = false;

    // A raw address is valid immediately (local checksum) — show ✓ now and only
    // look up its primary ENS name in the background, upgrading the display if
    // one exists. A failed name lookup never invalidates a good address.
    if (isAddress(v)) {
      const address = getAddress(v);
      const base: Resolution = { address, name: null };
      setRes(base);
      onResolve(base);
      const t = setTimeout(async () => {
        try {
          const r = await fetch(`/api/resolve?q=${encodeURIComponent(v)}`);
          const j = (await r.json()) as { name?: string | null };
          if (cancelled || !j.name) return;
          const named: Resolution = { address, name: j.name };
          setRes(named);
          onResolve(named);
        } catch {
          /* keep the address-only ✓ */
        }
      }, 350);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    // An ENS name genuinely needs the network to resolve to an address.
    setRes("checking");
    onResolve("checking");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/resolve?q=${encodeURIComponent(v)}`);
        const j = (await r.json()) as { ok?: boolean; address?: `0x${string}`; name?: string | null };
        if (cancelled) return;
        if (j.ok && j.address) {
          const out: Resolution = { address: j.address, name: j.name ?? null };
          setRes(out);
          onResolve(out);
        } else {
          setRes("bad");
          onResolve("bad");
        }
      } catch {
        if (!cancelled) {
          setRes("bad");
          onResolve("bad");
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  const ok = res && res !== "checking" && res !== "bad" ? res : null;
  const isSelf = !!(ok && selfAddress && ok.address.toLowerCase() === selfAddress.toLowerCase());
  const isDupe = !!(ok && duplicate);
  const invalid = res === "bad" || isSelf || isDupe;

  return (
    <div className="mt-8">
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="vitalik.eth or 0x… address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ borderColor: invalid ? "var(--danger)" : ok ? "var(--good)" : undefined }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>
          ✕
        </button>
      </div>
      {res === "checking" ? (
        <div className="invitee-status muted">Resolving…</div>
      ) : isSelf ? (
        <div className="invitee-status bad">That&rsquo;s your own wallet — invite someone else.</div>
      ) : isDupe ? (
        <div className="invitee-status bad">
          Already added{ok.name ? ` as ${ok.name}` : ""} — remove this duplicate.
        </div>
      ) : ok ? (
        <div className="invitee-status ok">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {ok.name ? (
            <>
              <strong>{ok.name}</strong>
              <span className="mono invitee-addr">{shortAddr(ok.address)}</span>
            </>
          ) : (
            <span className="mono">{shortAddr(ok.address)}</span>
          )}
        </div>
      ) : res === "bad" ? (
        <div className="invitee-status bad">Couldn&rsquo;t resolve — enter a valid ENS name or 0x address.</div>
      ) : null}
    </div>
  );
}

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
  const [days, setDays] = useState(1);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [resolved, setResolved] = useState<Record<number, Resolution | undefined>>({});
  const [labelInput, setLabelInput] = useState(label || "");
  const [isPublic, setIsPublic] = useState(true);
  const { isSignedIn, signIn } = useAuth();

  const [step, setStep] = useState<"idle" | "creating" | "depositing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // Live ENS status of the typed name (debounced), so people don't fund a pool
  // for a name they could never register.
  const cleanLabel = labelInput.trim().toLowerCase().replace(/\.eth$/, "");
  const [nameStatus, setNameStatus] = useState<NameCheck>(null);
  useEffect(() => {
    if (cleanLabel.length < 3) {
      setNameStatus(null);
      return;
    }
    setNameStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/name-status?label=${encodeURIComponent(cleanLabel)}`);
        const json = (await res.json()) as { status?: NameCheck };
        if (!cancelled) setNameStatus(json.status ?? "unknown");
      } catch {
        if (!cancelled) setNameStatus("unknown");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [cleanLabel]);

  // Only hard-block the states where a pool provably can't work.
  const nameBlocked = nameStatus === "active" || nameStatus === "grace" || nameStatus === "invalid";
  const statusInfo = nameStatus && nameStatus !== "checking" ? NAME_STATUS[nameStatus] : null;

  const targetNum = Math.max(0, parseFloat(target) || 0);
  const yourNum = Math.max(0, parseFloat(yourContrib) || 0);
  const selfLower = (address ?? "").toLowerCase();
  const badInvitees = invitees.filter((i) => resolved[i.id] === "bad");
  const checkingInvitees = invitees.filter((i) => resolved[i.id] === "checking");
  const okResolutions = invitees
    .map((i) => resolved[i.id])
    .filter((r): r is { address: `0x${string}`; name: string | null } => !!r && r !== "checking" && r !== "bad");
  const hasSelfInvite = okResolutions.some((r) => r.address.toLowerCase() === selfLower);
  // The 2nd+ row resolving to an address already listed is a duplicate — the
  // contract rejects these (DuplicateInvitee), and they carry no meaning since
  // ownership is by ETH contributed, not by owner-slot count.
  const duplicateIds = new Set<number>();
  {
    const seen = new Set<string>();
    for (const i of invitees) {
      const r = resolved[i.id];
      if (r && r !== "checking" && r !== "bad") {
        const key = r.address.toLowerCase();
        if (seen.has(key)) duplicateIds.add(i.id);
        else seen.add(key);
      }
    }
  }
  const hasDuplicate = duplicateIds.size > 0;
  // Unique invitee addresses, excluding the creator's own wallet.
  const inviteeAddrs = Array.from(
    new Map(
      okResolutions.filter((r) => r.address.toLowerCase() !== selfLower).map((r) => [r.address.toLowerCase(), r.address]),
    ).values(),
  );
  const signers = inviteeAddrs.length + 1;
  const majority = Math.floor(signers / 2) + 1;
  // Until a real co-owner is added, the scheme is a placeholder (a solo pool
  // isn't allowed), so don't imply a misleading 1-of-1.
  const schemeLabel = inviteeAddrs.length === 0 ? "n-of-n" : `${majority}-of-${signers}`;
  const yourPct = targetNum > 0 ? Math.min(100, (yourNum / targetNum) * 100) : 0;

  // The contract requires a partial deposit be >= 0.01 ETH unless it funds the
  // exact remaining gap. The creator's initial deposit is partial whenever it
  // doesn't cover the whole target, so enforce the same rule to avoid a revert.
  const fundsFullTarget = targetNum > 0 && yourNum >= targetNum;
  const contribTooLow = yourNum > 0 && !fundsFullTarget && yourNum < MIN_CONTRIB;

  const wrongChain = isConnected && chainId !== APP_CHAIN.chainId;
  const canSubmit =
    isConnected &&
    !wrongChain &&
    isEscrowConfigured &&
    labelInput.trim().length >= 3 &&
    !nameBlocked &&
    targetNum > 0 &&
    yourNum > 0 &&
    yourNum <= targetNum &&
    !contribTooLow &&
    inviteeAddrs.length >= 1 &&
    !hasSelfInvite &&
    !hasDuplicate &&
    checkingInvitees.length === 0 &&
    signers <= MAX_SIGNERS &&
    badInvitees.length === 0 &&
    step === "idle";

  function addInvitee() {
    if (invitees.length + 1 >= MAX_SIGNERS) return;
    setInvitees((v) => [...v, { id: Date.now(), value: "" }]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !publicClient) return;
    setError(null);
    try {
      const deadline = Math.floor(Date.now() / 1000) + days * 86400; // uint40 → number
      const targetWei = parseEther(target);

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
        <span>Start a vault</span>
      </div>

      <div className="page-head">
        <div>
          <h1>Start a vault{labelInput ? ` to buy ${labelInput}.eth` : ""}</h1>
          <p>
            Set your stake, then invite people by address. Everyone deposits into the open-source escrow on Sepolia; on
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
            <span className="panel-title">1 · Vault basics</span>

            <div className="field">
              <label>
                Name <span className="hint">the one .eth name this vault will buy · min 3 chars</span>
              </label>
              <div className="input-group" style={{ borderColor: nameBlocked ? "var(--danger)" : undefined }}>
                <input value={labelInput} onChange={(e) => setLabelInput(e.target.value.toLowerCase())} placeholder="defi" />
                <span className="unit">.eth</span>
              </div>
              {nameStatus === "checking" ? (
                <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                  Checking {cleanLabel}.eth…
                </p>
              ) : statusInfo ? (
                <div
                  className={`note ${statusInfo.kind === "ok" ? "note-ok" : statusInfo.kind === "block" ? "note-warn" : "note-info"} mt-8`}
                >
                  <span>{statusInfo.kind === "ok" ? "✓" : statusInfo.kind === "block" ? "⚠" : "ℹ"}</span>
                  <span>
                    <strong>{cleanLabel}.eth — {statusInfo.text}.</strong> {statusInfo.note}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="field">
              <label>
                Target amount <span className="hint">total the vault must raise · overpay refunded</span>
              </label>
              <div className="input-group">
                <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
                <span className="unit">ETH</span>
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
                {signers > 1
                  ? `Split across ${signers} people. Aim for at least ${(signers * MIN_CONTRIB).toFixed(2)} ETH so each can clear the minimum.`
                  : "The full amount to raise. Invite people below to split it."}
              </p>
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
              <div className="amount-bar">
                <span className="amount-min">
                  Minimum <strong>{MIN_CONTRIB} ETH</strong> per person
                </span>
                <div className="chip-row">
                  <button
                    type="button"
                    className={`chip-btn${yourNum === MIN_CONTRIB ? " active" : ""}`}
                    onClick={() => setYourContrib(String(MIN_CONTRIB))}
                  >
                    Min
                  </button>
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={targetNum <= 0}
                    onClick={() => setYourContrib((targetNum / 2).toFixed(3))}
                  >
                    Half
                  </button>
                  <button
                    type="button"
                    className={`chip-btn${fundsFullTarget ? " active" : ""}`}
                    disabled={targetNum <= 0}
                    onClick={() => setYourContrib(target)}
                  >
                    Fund it all
                  </button>
                </div>
              </div>
              {contribTooLow && (
                <div className="note note-warn mt-8">
                  <span>⚠</span>
                  <span>
                    That&rsquo;s below the {MIN_CONTRIB} ETH minimum. Raise it to at least {MIN_CONTRIB} ETH, or fund the
                    full {targetNum > 0 ? targetNum.toFixed(3) : ""} ETH target yourself.
                  </span>
                </div>
              )}
            </div>

            <div className="field">
              <label>
                Funding deadline <span className="hint">days from now</span>
              </label>
              <div className="row" style={{ gap: 14 }}>
                <input className="range" type="range" min={1} max={14} value={days} onChange={(e) => setDays(+e.target.value)} />
                <span className="mono" style={{ minWidth: 60, textAlign: "right", fontWeight: 600 }}>
                  {days}d
                </span>
              </div>
            </div>

            <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span>
                  List this vault publicly <span className="hint">shows in the Vaults directory</span>
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
                  ? "Anyone can find this vault in the directory. Only addresses you invite can deposit."
                  : "Private — only you and the people you invite can see it. You’ll sign a quick message to confirm you’re the creator."}
              </p>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">2 · Invite co-owners</span>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>
              <strong>At least one co-owner is required</strong> — a vault splits a name between people. Add each by ENS
              name or wallet address.
            </p>
            {invitees.map((i) => (
              <InviteeRow
                key={i.id}
                value={i.value}
                selfAddress={address}
                duplicate={duplicateIds.has(i.id)}
                onChange={(val) => setInvitees((v) => v.map((x) => (x.id === i.id ? { ...x, value: val } : x)))}
                onRemove={() => {
                  setInvitees((v) => v.filter((x) => x.id !== i.id));
                  setResolved((m) => {
                    const next = { ...m };
                    delete next[i.id];
                    return next;
                  });
                }}
                onResolve={(r) => setResolved((m) => ({ ...m, [i.id]: r ?? undefined }))}
              />
            ))}
            <button type="button" className="btn btn-soft btn-sm mt-16" onClick={addInvitee} disabled={invitees.length + 1 >= MAX_SIGNERS}>
              + Add member {invitees.length + 1 >= MAX_SIGNERS ? "(max 10)" : ""}
            </button>
            {signers === 2 && (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>With 2 people it&rsquo;s 2-of-2: if one loses their key, the wallet is frozen. Add a third for a safety margin.</span>
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="howto">
            <strong className="howto-title">How a vault works</strong>
            <div className="howto-steps">
              <div className="howto-step">
                <span className="howto-num">1</span>
                <span>
                  You raise ETH to buy <strong>{labelInput ? `${labelInput}.eth` : "one specific name"}</strong>.
                </span>
              </div>
              <div className="howto-step">
                <span className="howto-num">2</span>
                <span>Everyone you invite deposits toward the target.</span>
              </div>
              <div className="howto-step">
                <span className="howto-num">3</span>
                <span>
                  Once it&rsquo;s met, a shared Safe wallet is deployed to buy the name with. Each person co-owns it in
                  proportion to their deposit.
                </span>
              </div>
              <div className="howto-step">
                <span className="howto-num">4</span>
                <span>
                  Buying needs a <strong>majority</strong> of co-owners to sign, so no one can act alone.
                </span>
              </div>
            </div>
            <p className="howto-foot">The name is locked in once you start, so choose carefully.</p>
          </div>

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
              <span className="v">{schemeLabel}</span>
            </div>

            {!isConnected ? (
              <div className="note note-info mt-16">
                <span>ℹ</span>
                <span>Connect your wallet (top right) to create the vault.</span>
              </div>
            ) : wrongChain ? (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>Switch your wallet to Sepolia to continue.</span>
              </div>
            ) : checkingInvitees.length > 0 ? (
              <div className="note note-info mt-16">
                <span>ℹ</span>
                <span>Resolving co-owners… hang on a moment.</span>
              </div>
            ) : badInvitees.length > 0 || hasDuplicate || hasSelfInvite ? (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>Fix the highlighted co-owner {badInvitees.length + duplicateIds.size + (hasSelfInvite ? 1 : 0) === 1 ? "error" : "errors"} above before creating the vault.</span>
              </div>
            ) : inviteeAddrs.length === 0 ? (
              <div className="note note-info mt-16">
                <span>ℹ</span>
                <span>Invite at least one co-owner to start a vault, or buy the name solo instead.</span>
              </div>
            ) : null}

            {error && (
              <div className="note note-warn mt-16">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary btn-block btn-lg mt-16" disabled={!canSubmit}>
              {step === "creating" ? "Confirm create in wallet…" : step === "depositing" ? "Confirm deposit in wallet…" : "Create vault & deposit"}
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, color: "var(--faint)" }}>
              {busy ? "Two transactions: createPool, then your deposit." : `A ${schemeLabel} Safe deploys at finalization.`}
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
