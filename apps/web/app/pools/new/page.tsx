"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { getName, usd, ETH_USD } from "@/lib/data";

const MAX_SIGNERS_CAP = 10; // matches CofferEscrow.MAX_OWNERS

type Invitee = { id: number; handle: string; contribEth: string };

function NewPoolForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const label = (sp.get("label") ?? "").toLowerCase().replace(/\.eth$/, "");
  const name = getName(label);

  const defaultTarget = name ? +((name.registrationUsd + name.premiumUsd) / ETH_USD).toFixed(2) : 2;

  const [target, setTarget] = useState(String(defaultTarget));
  const [yourContrib, setYourContrib] = useState(String(+(defaultTarget * 0.32).toFixed(2)));
  const [threshold, setThreshold] = useState(3);
  const [invitees, setInvitees] = useState<Invitee[]>([
    { id: 1, handle: "vitalik.eth", contribEth: "" },
    { id: 2, handle: "", contribEth: "" },
  ]);
  const [ack, setAck] = useState(false);

  const targetNum = Math.max(0, parseFloat(target) || 0);
  const yourNum = Math.max(0, parseFloat(yourContrib) || 0);
  const filledInvitees = invitees.filter((i) => i.handle.trim());
  const signers = filledInvitees.length + 1; // + creator
  const yourPct = targetNum > 0 ? Math.min(100, (yourNum / targetNum) * 100) : 0;

  const warnNofN = threshold === signers && signers > 1;
  const warnThreshold = threshold > signers;

  function addInvitee() {
    if (invitees.length + 1 >= MAX_SIGNERS_CAP) return;
    setInvitees((v) => [...v, { id: Date.now(), handle: "", contribEth: "" }]);
  }
  function removeInvitee(id: number) {
    setInvitees((v) => v.filter((i) => i.id !== id));
  }
  function setInvitee(id: number, patch: Partial<Invitee>) {
    setInvitees((v) => v.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  const canSubmit = targetNum > 0 && yourNum > 0 && yourNum <= targetNum && threshold >= 1 && threshold <= signers && signers <= MAX_SIGNERS_CAP && ack;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    // Later: sends createPool() + the creator's deposit. For now, open a dashboard.
    router.push("/pools/defi-eth");
  }

  const invAllocated = filledInvitees.reduce((s, i) => s + (parseFloat(i.contribEth) || 0), 0);
  const unallocated = Math.max(0, targetNum - yourNum - invAllocated);

  return (
    <form className="wrap" onSubmit={submit}>
      <div className="crumb">
        <Link href="/">Discover</Link> <span>/</span>
        {name ? (
          <>
            <Link href={`/name/${label}`}>{label}.eth</Link> <span>/</span>
          </>
        ) : null}
        <span>Start a pool</span>
      </div>

      <div className="page-head">
        <div>
          <h1>Start a pool{name ? ` to buy ${name.label}.eth` : ""}</h1>
          <p>
            Set your stake, then invite people. Everyone deposits into one audited escrow, and on success it deploys a
            multisig you all control — no one can move the funds alone.
          </p>
        </div>
      </div>

      <div className="cols">
        {/* left: the form */}
        <div className="stack">
          <div className="panel">
            <span className="panel-title">1 · Pool basics</span>

            <div className="field">
              <label>
                Target amount <span className="hint">locked to price at execution — overpay is refunded</span>
              </label>
              <div className="input-group">
                <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
                <span className="unit">ETH</span>
              </div>
              {name && (
                <div className="progress-label" style={{ marginTop: 6 }}>
                  <span>current buy price ≈ {usd(name.registrationUsd + name.premiumUsd)}</span>
                  <span>{usd(targetNum * ETH_USD)}</span>
                </div>
              )}
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
                step={0.01}
                value={Math.min(yourNum, targetNum || 1)}
                onChange={(e) => setYourContrib(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>
                Signatures required to buy <span className="hint">of up to {signers} signers</span>
              </label>
              <div className="row" style={{ gap: 14 }}>
                <input
                  className="range"
                  type="range"
                  min={1}
                  max={Math.max(signers, 1)}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(+e.target.value)}
                />
                <span className="mono" style={{ fontWeight: 600, minWidth: 88, textAlign: "right" }}>
                  {threshold} of {signers}
                </span>
              </div>
              {warnNofN && (
                <div className="note note-warn mt-8">
                  <span>⚠</span>
                  <span>N-of-N: if one signer goes unresponsive, the Safe is frozen forever. Consider a lower threshold.</span>
                </div>
              )}
              {warnThreshold && (
                <div className="note note-warn mt-8">
                  <span>⚠</span>
                  <span>Threshold exceeds signers — if fewer than {threshold} people contribute, the pool can never finalize.</span>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">2 · Invite members</span>
            <p className="muted" style={{ fontSize: 13.5, marginTop: -6 }}>
              Add someone by ENS name and we&rsquo;ll deliver the invite through their on-chain email or Telegram record
              — or paste an address directly.
            </p>
            {invitees.map((i) => (
              <div key={i.id} className="row mt-8" style={{ gap: 8 }}>
                <input
                  className="input"
                  placeholder="vitalik.eth or 0x…"
                  value={i.handle}
                  onChange={(e) => setInvitee(i.id, { handle: e.target.value })}
                />
                <div className="input-group" style={{ maxWidth: 130 }}>
                  <input
                    inputMode="decimal"
                    placeholder="0.0"
                    value={i.contribEth}
                    onChange={(e) => setInvitee(i.id, { contribEth: e.target.value })}
                  />
                  <span className="unit">ETH</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeInvitee(i.id)} aria-label="Remove">
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-soft btn-sm mt-16"
              onClick={addInvitee}
              disabled={invitees.length + 1 >= MAX_SIGNERS_CAP}
            >
              + Add member {invitees.length + 1 >= MAX_SIGNERS_CAP ? "(max 10 per pool)" : ""}
            </button>
          </div>
        </div>

        {/* right: summary */}
        <div className="stack">
          <div className="panel">
            <span className="panel-title">Ownership split</span>
            <div className="kv">
              <span className="k">Target</span>
              <span className="v">{targetNum.toFixed(2)} ETH</span>
            </div>
            <div className="mrow">
              <div className="avatar">Y</div>
              <div>
                <div className="who">You</div>
                <div className="sub">creator</div>
              </div>
              <div className="amt">
                <div className="a">{yourNum.toFixed(2)} ETH</div>
                <div className="b">{yourPct.toFixed(1)}%</div>
              </div>
            </div>
            {filledInvitees.map((i) => {
              const c = parseFloat(i.contribEth) || 0;
              return (
                <div key={i.id} className="mrow">
                  <div className="avatar">{i.handle.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="who">{i.handle}</div>
                    <div className="sub">invited</div>
                  </div>
                  <div className="amt">
                    <div className="a">{c ? c.toFixed(2) : "—"} ETH</div>
                    <div className="b">{targetNum ? ((c / targetNum) * 100).toFixed(1) : "0"}%</div>
                  </div>
                </div>
              );
            })}
            {unallocated > 0.001 && (
              <div className="mrow" style={{ opacity: 0.7 }}>
                <div className="avatar" style={{ background: "var(--surface-3)", color: "var(--faint)" }}>
                  ?
                </div>
                <div>
                  <div className="who">Unallocated</div>
                  <div className="sub">open to contributors</div>
                </div>
                <div className="amt">
                  <div className="a">{unallocated.toFixed(2)} ETH</div>
                  <div className="b">{targetNum ? ((unallocated / targetNum) * 100).toFixed(1) : "0"}%</div>
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <label className="row" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                I understand: funds lock for a 7-day execution window once the target is hit; every contributor becomes a
                Safe signer with equal signing power; shares are proportional to deposits.
              </span>
            </label>
            <button className="btn btn-primary btn-block btn-lg mt-16" disabled={!canSubmit}>
              Create pool &amp; deploy escrow
            </button>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, color: "var(--faint)" }}>
              Deploys a {threshold}-of-{signers} Safe at finalization · you deposit right after
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
