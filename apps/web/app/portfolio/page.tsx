"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { buttonVariants, EmptyState, Spinner } from "@thenamespace/uikit";
import { SoloTicket, VaultTicket, type Solo, type Vault } from "@/components/portfolio-tickets";

async function fetchPortfolio(address: string): Promise<{ solo: Solo[]; vaults: Vault[] }> {
  const res = await fetch(`/api/portfolio?address=${address}`);
  if (!res.ok) throw new Error("Failed to load portfolio");
  return res.json();
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
            <SoloTicket key={n.label} n={n} />
          ))}
          {vaults.map((v) => (
            <VaultTicket key={v.poolId} v={v} viewer={address} />
          ))}
        </div>
      )}
    </div>
  );
}
