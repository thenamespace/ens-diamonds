"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { getPool, eth, ETH_USD, usd, type Pool } from "@/lib/data";

type Tab = "funding" | "members" | "multisig" | "activity";

function StatusBanner({ p }: { p: Pool }) {
  if (p.status === "funded") {
    return (
      <div className="banner b-funded">
        <div className="b-text">
          <h3>Target reached — execution window open</h3>
          <p>Funds are locked for 7 days. Any contributor can finalize to deploy the Safe and register the name.</p>
        </div>
        <div className="b-cta">
          <button className="btn btn-primary">Finalize &amp; deploy Safe</button>
        </div>
      </div>
    );
  }
  if (p.status === "funding") {
    return (
      <div className="banner b-funding">
        <div className="b-text">
          <h3>Funding — {p.deadlineDays} days left</h3>
          <p>Deposit to reach the target. You can withdraw in full any time before the execution lock.</p>
        </div>
      </div>
    );
  }
  return null;
}

export default function PoolDashboard() {
  const params = useParams<{ id: string }>();
  const p = getPool(params.id);
  const [tab, setTab] = useState<Tab>("funding");
  const [amount, setAmount] = useState("0.25");

  if (!p) {
    return (
      <div className="wrap">
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>Pool not found</h3>
          <p>This pool doesn&rsquo;t exist or hasn&rsquo;t been indexed yet.</p>
          <Link className="btn btn-primary" href="/pools">
            All pools
          </Link>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((p.depositedEth / p.targetEth) * 100));
  const you = p.members.find((m) => m.handle === "you");

  return (
    <div className="wrap">
      <div className="crumb">
        <Link href="/pools">Pools</Link> <span>/</span> <span>{p.label}.eth</span>
      </div>

      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 12 }}>
            <h1 style={{ margin: 0 }}>{p.label}.eth pool</h1>
            <span className={`tag tag-${p.status}`}>{p.status}</span>
          </div>
          <p>
            {p.threshold}-of-{p.maxSigners} Safe · {p.members.length} members{p.safe ? ` · ${p.safe}` : " · deploys at finalization"}
          </p>
        </div>
        <Link className="btn btn-ghost" href={`/name/${p.label}`}>
          View {p.label}.eth →
        </Link>
      </div>

      <StatusBanner p={p} />

      <div className="tabs">
        {(["funding", "members", "multisig", "activity"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "funding" && (
        <div className="cols">
          <div className="panel">
            <span className="panel-title">Funding progress</span>
            <div className="kv" style={{ borderBottom: "none", paddingBottom: 8 }}>
              <span className="v big">{eth(p.depositedEth, 2)}</span>
              <span className="muted">of {eth(p.targetEth, 2)} target</span>
            </div>
            <div className="progress">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="progress-label">
              <span>{pct}% funded</span>
              <span>{usd(p.depositedEth * ETH_USD)}</span>
            </div>
          </div>

          <div className="panel">
            <span className="panel-title">Your position</span>
            {you ? (
              <>
                <div className="kv">
                  <span className="k">Deposited</span>
                  <span className="v">{eth(you.contributionEth, 2)}</span>
                </div>
                <div className="kv">
                  <span className="k">Ownership</span>
                  <span className="v accent">{(you.ownershipBps / 100).toFixed(1)}%</span>
                </div>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 14 }}>
                You haven&rsquo;t deposited to this pool yet.
              </p>
            )}
            <div className="input-group mt-16">
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="unit">ETH</span>
            </div>
            <div className="row mt-8" style={{ gap: 8 }}>
              <button className="btn btn-primary btn-block" disabled={p.status !== "funding"}>
                Deposit
              </button>
              <button className="btn btn-ghost btn-block" disabled={p.status === "funded"} title={p.status === "funded" ? "Locked during the execution window" : ""}>
                Withdraw
              </button>
            </div>
            {p.status === "funded" && (
              <div className="note note-warn mt-8">
                <span>🔒</span>
                <span>Withdrawals are locked during the 7-day execution window.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="panel">
          <span className="panel-title">Members · ownership from on-chain deposits</span>
          {p.members.map((m) => (
            <div key={m.address} className="mrow">
              <div className="avatar">{m.handle === "you" ? "Y" : m.handle.slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="who">
                  {m.handle} <span className={`pill ${m.status === "accepted" ? "pill-ok" : "pill-wait"}`}>{m.status}</span>
                </div>
                <div className="sub">
                  {m.address}
                  {m.via ? ` · via ${m.via}` : ""}
                </div>
              </div>
              <div className="amt">
                <div className="a">{eth(m.contributionEth, 2)}</div>
                <div className="b">{(m.ownershipBps / 100).toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "multisig" && (
        <div className="panel">
          <span className="panel-title">Multisig</span>
          {p.safe ? (
            <>
              <div className="kv">
                <span className="k">Safe address</span>
                <span className="v accent">{p.safe}</span>
              </div>
              <div className="kv">
                <span className="k">Threshold</span>
                <span className="v">
                  {p.threshold} of {p.members.length}
                </span>
              </div>
              <div className="kv">
                <span className="k">Balance</span>
                <span className="v">{eth(p.depositedEth, 2)}</span>
              </div>
              <div className="kv">
                <span className="k">Network</span>
                <span className="v">Ethereum</span>
              </div>
            </>
          ) : (
            <div className="note note-info">
              <span>ℹ</span>
              <span>
                Safe not yet deployed — it deploys at finalization with all contributors as owners and a{" "}
                {p.threshold}-of-N threshold.
              </span>
            </div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="panel">
          <span className="panel-title">Activity</span>
          {p.activity.map((a, i) => (
            <div key={i} className="feed-row">
              <span className="when">{a.at}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
