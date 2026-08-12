import NextLink from "next/link";

import {
  buttonVariants,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
  Typography,
} from "@thenamespace/uikit";
import { Diamond02Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import type { Address } from "viem";

import { VaultCard, type VaultCardSummary } from "@/components/cards";
import { ConnectButton, PageMain } from "@/components/common";

type VaultsOverviewProps = {
  isAuthenticated: boolean;
  mode: "public" | "portfolio";
  vaults: VaultCardSummary[];
  viewerAddress: Address | null;
};

export const VaultsOverview = ({
  isAuthenticated,
  mode,
  vaults,
  viewerAddress,
}: VaultsOverviewProps) => (
  <PageMain>
    <header className="max-w-2xl">
      <Typography.Heading className="text-balance text-3xl tracking-tight sm:text-4xl" level={1}>
        {mode === "public" ? "Explore vaults" : "Your portfolio"}
      </Typography.Heading>
      <Typography.Paragraph className="mt-3 leading-7" color="muted">
        {mode === "public"
          ? "Discover public group vaults without revealing the ENS names they are targeting."
          : "Track every ENS acquisition you are funding or co-own through this wallet."}
      </Typography.Paragraph>
    </header>

    {(mode === "public" || viewerAddress) && vaults.length > 0 ? (
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {vaults.map((vault) => (
          <VaultCard {...vault} key={vault.vaultId} viewerAddress={viewerAddress} />
        ))}
      </div>
    ) : (
      <EmptyState className="mt-16" size="lg">
        <EmptyStateHeader>
          <EmptyStateMedia variant="icon">
            <HugeiconsIcon aria-hidden icon={Diamond02Icon} strokeWidth={1.5} width={22} />
          </EmptyStateMedia>
          <Typography.Heading className="empty-state__title text-balance" level={2}>
            {mode === "public"
              ? "No public vaults yet"
              : isAuthenticated
                ? "No vaults yet"
                : "Connect your wallet"}
          </Typography.Heading>
          <EmptyStateDescription>
            {mode === "public"
              ? "Public vaults will appear here after they are created."
              : isAuthenticated
                ? "Choose a premium ENS name and start a vault with the people you want to co-own it with."
                : "Connect and sign in with Ethereum to see the vaults where you are a member."}
          </EmptyStateDescription>
        </EmptyStateHeader>
        <EmptyStateContent>
          {isAuthenticated || mode === "public" ? (
            <NextLink className={buttonVariants({ size: "sm", variant: "primary" })} href="/">
              Discover Names
            </NextLink>
          ) : (
            <ConnectButton />
          )}
        </EmptyStateContent>
      </EmptyState>
    )}
  </PageMain>
);
