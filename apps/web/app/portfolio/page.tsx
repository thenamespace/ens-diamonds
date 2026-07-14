"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import AddressLabel from "@/components/address-label";
import { fmtEth } from "@/lib/format";
import { APP_CHAIN } from "@/lib/app-chain";

type Solo = { label: string; expiry: number };
type Vault = {
  poolId: number;
  label: string;
  safe: string;
  safeOwns: boolean;
  expiry: number | null;
  yourDeposit: string;
  totalDeposited: string;
  coOwners: { address: string; deposit: string }[];
};

async function fetchPortfolio(address: string): Promise<{ solo: Solo[]; vaults: Vault[] }> {
  const res = await fetch(`/api/portfolio?address=${address}`);
  if (!res.ok) throw new Error("Failed to load portfolio");
  return res.json();
}

function fmtExpiry(unix: number | null): string {
  if (!unix) return "—";
  const months = Math.round((unix * 1000 - Date.now()) / (30.44 * 24 * 3600 * 1000));
  if (months <= 0) return "expired";
  return `expires in ~${months} month${months === 1 ? "" : "s"}`;
}

function sharePct(deposit: string, total: string): number {
  const t = BigInt(total || "0");
  if (t === 0n) return 0;
  return Number((BigInt(deposit || "0") * 10000n) / t) / 100;
}

function NameHead({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="row" style={{ gap: 14 }}>
      <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
        {label.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600 }}>
          {label}
          <span style={{ color: "var(--faint)", fontWeight: 400 }}>.eth</span>
        </div>
        <div className="sub" style={{ fontSize: 13 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function ActionButtons() {
  return (
    <div style={{ marginLeft: "auto", alignSelf: "center", flexWrap: "wrap", justifyContent: "flex-end" }} className="row">
      <button className="btn btn-ghost btn-sm">Renew</button>
      <button className="btn btn-ghost btn-sm">Transfer name</button>
      <button className="btn btn-ghost btn-sm">Sell name</button>
    </div>
  );
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", address?.toLowerCase()],
    queryFn: () => fetchPortfolio(address!),
    enabled: !!address,
    refetchInterval: 30000,
  });

  const solo = data?.solo ?? [];
  // Only vaults whose Safe actually holds the name belong in a portfolio.
  const vaults = (data?.vaults ?? []).filter((v) => v.safeOwns);
  const empty = solo.length === 0 && vaults.length === 0;

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Portfolio</h1>
          <p>Names your wallet owns or co-owns through vaults, verified live on-chain.</p>
        </div>
      </div>

      {!isConnected ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>Connect your wallet</h3>
          <p>Connect your wallet (top right) to see the names you own and co-own.</p>
        </div>
      ) : isLoading ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>Loading your names…</h3>
        </div>
      ) : empty ? (
        <div className="empty">
          <span className="mark" aria-hidden />
          <h3>No names yet</h3>
          <p>Buy a name solo or through a vault and it shows up here with your share and renewal status.</p>
          <Link className="btn btn-primary" href="/">
            Browse names in premium
          </Link>
        </div>
      ) : (
        <div className="stack">
          {solo.map((n) => (
            <div key={n.label} className="panel">
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <NameHead label={n.label} sub={`in your wallet · ${fmtExpiry(n.expiry)}`} />
                <span className="tag tag-finalized">Owned</span>
              </div>
              <div className="row mt-16" style={{ gap: 28, flexWrap: "wrap" }}>
                <div>
                  <div className="sub" style={{ fontSize: 12 }}>
                    Ownership
                  </div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                    100%
                  </div>
                </div>
                <div>
                  <div className="sub" style={{ fontSize: 12 }}>
                    Held by
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>Your wallet</div>
                </div>
                <ActionButtons />
              </div>
              <div className="row mt-16" style={{ gap: 8 }}>
                <a className="btn btn-soft btn-sm" href={`${APP_CHAIN.ensAppUrl}/${n.label}.eth`} target="_blank" rel="noreferrer">
                  View on ENS →
                </a>
              </div>
            </div>
          ))}

          {vaults.map((v) => {
            const coOwners = [...v.coOwners].sort((a, b) => (BigInt(b.deposit) > BigInt(a.deposit) ? 1 : -1));
            return (
              <div key={v.poolId} className="panel">
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <NameHead label={v.label} sub={`held by your vault's Safe · ${fmtExpiry(v.expiry)}`} />
                  <span className="tag tag-finalized">Co-owned</span>
                </div>

                <div className="row mt-16" style={{ gap: 28, flexWrap: "wrap" }}>
                  <div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Your share
                    </div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                      {sharePct(v.yourDeposit, v.totalDeposited).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Your deposit
                    </div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                      {fmtEth(BigInt(v.yourDeposit), 4)} ETH
                    </div>
                  </div>
                  <div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Pooled total
                    </div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                      {fmtEth(BigInt(v.totalDeposited), 4)} ETH
                    </div>
                  </div>
                  <ActionButtons />
                </div>

                <details className="coowners">
                  <summary className="coowners-head">
                    Co-owners · {coOwners.length}
                    <svg className="coowners-caret" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </summary>
                  <div className="coowner-list">
                    {coOwners.map((m) => {
                      const isYou = !!address && m.address.toLowerCase() === address.toLowerCase();
                      const pctN = sharePct(m.deposit, v.totalDeposited);
                      return (
                        <div key={m.address} className="coowner">
                          <span className="coowner-avatar" aria-hidden>
                            {m.address.slice(2, 3).toUpperCase()}
                          </span>
                          <span className="coowner-id">
                            <span className="coowner-name">
                              <AddressLabel address={m.address as `0x${string}`} />
                              {isYou && <span className="coowner-you">you</span>}
                            </span>
                            <span className="coowner-addr mono">{m.address}</span>
                          </span>
                          <span className="coowner-contrib mono">{fmtEth(BigInt(m.deposit), 4)} ETH</span>
                          <span className="coowner-share">
                            <span className="coowner-bar" aria-hidden>
                              <span style={{ width: `${Math.min(100, pctN)}%` }} />
                            </span>
                            <span className="mono coowner-pct">{pctN.toFixed(1)}%</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>

                <div className="row mt-16" style={{ gap: 8 }}>
                  <Link className="btn btn-soft btn-sm" href={`/pools/${v.poolId}`}>
                    View vault →
                  </Link>
                  <a className="btn btn-ghost btn-sm" href={`${APP_CHAIN.ensAppUrl}/${v.label}.eth`} target="_blank" rel="noreferrer">
                    View on ENS →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
