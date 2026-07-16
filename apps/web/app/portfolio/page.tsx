"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants, Card, Chip, EmptyState, Spinner } from "@thenamespace/uikit";
import AddressLabel from "@/components/address-label";
import NameAvatar from "@/components/name-avatar";
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
      <NameAvatar className="rounded-full" label={label} size={44} />
      <div>
        <div style={{ fontSize: 22, fontWeight: 600 }}>
          {label}
          <span className="font-normal text-muted">.eth</span>
        </div>
        <div className="text-[13px] text-muted">{sub}</div>
      </div>
    </div>
  );
}

function Stat({ label, children, mono = true }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`${mono ? "mono " : ""}text-xl font-semibold`}>{children}</div>
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
          <p>Names your wallet owns or co-owns through vaults, verified live onchain.</p>
        </div>
      </div>

      {!isConnected ? (
        <EmptyState size="lg">
          <EmptyState.Header>
            <EmptyState.Title>Connect your wallet</EmptyState.Title>
            <EmptyState.Description>
              Connect your wallet (top right) to see the names you own and co-own.
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : isLoading ? (
        <EmptyState size="lg">
          <EmptyState.Header>
            <EmptyState.Media>
              <Spinner />
            </EmptyState.Media>
            <EmptyState.Title>Loading your names…</EmptyState.Title>
          </EmptyState.Header>
        </EmptyState>
      ) : empty ? (
        <EmptyState size="lg">
          <EmptyState.Header>
            <EmptyState.Title>No names yet</EmptyState.Title>
            <EmptyState.Description>
              Buy a name solo or through a vault and it shows up here with your share and renewal status.
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Link className={buttonVariants({ variant: "primary" })} href="/">
              Browse names in premium
            </Link>
          </EmptyState.Content>
        </EmptyState>
      ) : (
        <div className="stack">
          {solo.map((n) => (
            <Card key={n.label}>
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <NameHead label={n.label} sub={`in your wallet · ${fmtExpiry(n.expiry)}`} />
                <Chip color="success" variant="soft" size="sm" className="mono text-[10.5px] uppercase tracking-[0.07em]">
                  Owned
                </Chip>
              </div>
              <div className="row mt-4" style={{ gap: 28, flexWrap: "wrap" }}>
                <Stat label="Ownership">100%</Stat>
                <Stat label="Held by" mono={false}>
                  Your wallet
                </Stat>
              </div>
              <div className="row mt-4" style={{ gap: 8 }}>
                <a
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  href={`${APP_CHAIN.ensAppUrl}/${n.label}.eth`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on ENS →
                </a>
              </div>
            </Card>
          ))}

          {vaults.map((v) => {
            const coOwners = [...v.coOwners].sort((a, b) => (BigInt(b.deposit) > BigInt(a.deposit) ? 1 : -1));
            return (
              <Card key={v.poolId}>
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <NameHead label={v.label} sub={`held by your vault's Safe · ${fmtExpiry(v.expiry)}`} />
                  <Chip color="success" variant="soft" size="sm" className="mono text-[10.5px] uppercase tracking-[0.07em]">
                    Co-owned
                  </Chip>
                </div>

                <div className="row mt-4" style={{ gap: 28, flexWrap: "wrap" }}>
                  <Stat label="Your share">{sharePct(v.yourDeposit, v.totalDeposited).toFixed(1)}%</Stat>
                  <Stat label="Your deposit">{fmtEth(BigInt(v.yourDeposit), 4)}</Stat>
                  <Stat label="Pooled total">{fmtEth(BigInt(v.totalDeposited), 4)}</Stat>
                  </div>

                <details className="group mt-4 border-t border-separator pt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-muted [&::-webkit-details-marker]:hidden">
                    Co-owners · {coOwners.length}
                    <svg
                      className="transition-transform duration-150 group-open:rotate-180"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </summary>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {coOwners.map((m) => {
                      const isYou = !!address && m.address.toLowerCase() === address.toLowerCase();
                      const pctN = sharePct(m.deposit, v.totalDeposited);
                      return (
                        <div key={m.address} className="flex flex-wrap items-center gap-3">
                          <span
                            className="grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
                            aria-hidden
                          >
                            {m.address.slice(2, 3).toUpperCase()}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <AddressLabel address={m.address as `0x${string}`} />
                              {isYou && (
                                <Chip color="accent" variant="soft" size="sm">
                                  you
                                </Chip>
                              )}
                            </span>
                            <span className="mono truncate text-[11px] text-muted">{m.address}</span>
                          </span>
                          <span className="mono text-[13px]">{fmtEth(BigInt(m.deposit), 4)}</span>
                          <span className="flex w-[130px] flex-none items-center gap-2">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden>
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{ width: `${Math.min(100, pctN)}%` }}
                              />
                            </span>
                            <span className="mono text-[11.5px] text-muted">{pctN.toFixed(1)}%</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>

                <div className="row mt-4" style={{ gap: 8 }}>
                  <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/pools/${v.poolId}`}>
                    View vault →
                  </Link>
                  <a
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`${APP_CHAIN.ensAppUrl}/${v.label}.eth`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on ENS →
                  </a>
                  <a
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`https://app.safe.global/home?safe=${APP_CHAIN.safePrefix}:${v.safe}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View in Safe →
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
