"use client";

import NextLink from "next/link";

import {
  buttonVariants,
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
  Spinner,
  Typography,
} from "@thenamespace/uikit";
import { FavouriteIcon, HugeiconsIcon } from "@thenamespace/uikit/icons";

import { FavouriteNameCard } from "@/components/cards";
import { ConnectButton, PageMain } from "@/components/common";
import { useEnsNamePrices, useFavouriteNameDetails, useFavourites, useMinuteClock } from "@/hooks";

type FavouriteNamesProps = {
  asOf: number;
  initialFavourites: Array<{ label: string }>;
  isAuthenticated: boolean;
};

export const FavouriteNames = ({
  asOf,
  initialFavourites,
  isAuthenticated,
}: FavouriteNamesProps) => {
  const now = useMinuteClock(asOf);
  const favourites = useFavourites(initialFavourites);
  const details = useFavouriteNameDetails(favourites.labels);
  const prices = useEnsNamePrices(favourites.labels);

  return (
    <PageMain>
      <header className="max-w-2xl">
        <Typography.Heading className="text-balance text-3xl tracking-tight sm:text-4xl" level={1}>
          Favourites
        </Typography.Heading>
        <Typography.Paragraph className="mt-3 leading-7" color="muted">
          Track names you care about, whether they are available now or already registered.
        </Typography.Paragraph>
      </header>

      {!isAuthenticated ? (
        <FavouriteState
          description="Connect and sign in with Ethereum to see the names saved by this wallet."
          title="Connect your wallet"
        >
          <ConnectButton />
        </FavouriteState>
      ) : favourites.labels.length === 0 ? (
        <FavouriteState
          description="Save names from Discover and they will stay here, even after their availability changes."
          title="No favourite names yet"
        >
          <NextLink className={buttonVariants({ size: "sm", variant: "primary" })} href="/">
            Discover names
          </NextLink>
        </FavouriteState>
      ) : details.isPending ? (
        <div className="flex min-h-80 items-center justify-center">
          <Spinner aria-label="Loading favourite names" />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {details.names.map((name) => (
            <FavouriteNameCard
              ethUsd={prices.ethUsd}
              isPricePending={prices.prices.get(name.label) === undefined && prices.isPending}
              key={name.label}
              name={name}
              now={now}
              price={prices.prices.get(name.label)}
            />
          ))}
        </div>
      )}
    </PageMain>
  );
};

const FavouriteState = ({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) => (
  <EmptyState className="mt-12 min-h-80" size="lg">
    <EmptyStateHeader>
      <EmptyStateMedia variant="icon">
        <HugeiconsIcon aria-hidden icon={FavouriteIcon} width={22} />
      </EmptyStateMedia>
      <Typography.Heading className="empty-state__title text-balance" level={2}>
        {title}
      </Typography.Heading>
      <EmptyStateDescription>{description}</EmptyStateDescription>
    </EmptyStateHeader>
    <EmptyStateContent>{children}</EmptyStateContent>
  </EmptyState>
);
