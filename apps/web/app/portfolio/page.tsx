import Link from "next/link";
import AddressLabel from "@/components/address-label";
import { POOLS, eth, usd, ETH_USD } from "@/lib/data";

export default function PortfolioPage() {
  // Names the connected wallet co-owns = finalized pools where "you" contributed.
  const owned = POOLS.filter((p) => p.status === "finalized" || p.status === "funded").filter((p) =>
    p.members.some((m) => m.handle === "you"),
  );

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Portfolio</h1>
          <p>Names your wallet co-owns across pools, with your cost basis and renewal status.</p>
        </div>
      </div>

      {owned.length === 0 ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No co-owned names yet</h3>
          <p>Once a pool you&rsquo;re in registers its name, it shows up here with your share and renewal status.</p>
          <Link className="btn btn-primary" href="/">
            Browse names in premium
          </Link>
        </div>
      ) : (
        <div className="stack">
          {owned.map((p) => {
            const you = p.members.find((m) => m.handle === "you")!;
            return (
              <div key={p.id} className="panel">
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <div className="row" style={{ gap: 14 }}>
                    <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                      {p.label.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 600 }}>
                        {p.label}
                        <span style={{ color: "var(--faint)", fontWeight: 400 }}>.eth</span>
                      </div>
                      <div className="sub" style={{ fontSize: 13 }}>
                        Safe {p.safe ? <AddressLabel address={p.safe} mono={false} /> : "deploying"} · expires in ~11 months
                      </div>
                    </div>
                  </div>
                  <span className="tag tag-finalized">Owned</span>
                </div>

                <div className="row mt-16" style={{ gap: 28, flexWrap: "wrap" }}>
                  <div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Your share
                    </div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                      {(you.ownershipBps / 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Your cost basis
                    </div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                      {eth(you.contributionEth, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Acquisition cost
                    </div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                      {usd(p.depositedEth * ETH_USD)}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", alignSelf: "center", flexWrap: "wrap", justifyContent: "flex-end" }} className="row">
                    <button className="btn btn-ghost btn-sm">Renew (pay solo)</button>
                    <button className="btn btn-soft btn-sm">Propose Safe renewal</button>
                    <button className="btn btn-ghost btn-sm">Transfer name</button>
                    <button className="btn btn-ghost btn-sm">Sell name</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
