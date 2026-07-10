import Link from "next/link";
import { POOLS, eth } from "@/lib/data";

export default function PoolsPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Pools</h1>
          <p>Pools you&rsquo;re part of or watching. Ownership is always reconstructable from on-chain deposits.</p>
        </div>
        <Link className="btn btn-primary" href="/">
          Find a name to pool
        </Link>
      </div>

      <div className="grid">
        {POOLS.map((p) => {
          const pct = Math.min(100, Math.round((p.depositedEth / p.targetEth) * 100));
          return (
            <Link key={p.id} href={`/pools/${p.id}`} className="ncard">
              <div className="ncard-top">
                <span className={`tag tag-${p.status}`}>{p.status}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
                  {p.threshold}-of-{p.maxSigners}
                </span>
              </div>
              <div className="ncard-name">
                {p.label}
                <span className="eth">.eth</span>
              </div>
              <div className="ncard-sub">{p.members.length} members</div>
              <div className="progress mt-16">
                <div className="fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="progress-label">
                <span>{pct}% funded</span>
                <span>
                  {eth(p.depositedEth, 1)} / {eth(p.targetEth, 1)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
