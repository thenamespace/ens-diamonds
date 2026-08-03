"use client";

import { useCallback, useState } from "react";

import NumberFlow, { type Format } from "@number-flow/react";
import { Card, Link, Skeleton, Typography } from "@thenamespace/uikit";
import { ArrowUpRight01Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import { useInterval } from "usehooks-ts";
import { formatEther } from "viem";

import type { EnsNameDetails } from "@/hooks";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "@/lib/constants";
import { weiToUsd } from "@/lib/ens";
import { getUnixTime } from "@/lib/helpers";

const START_VAULT_URL = "/vaults/new";
const USD_FORMAT: Format = {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
  style: "currency",
};
const ETH_FORMAT: Format = {
  maximumFractionDigits: 4,
  minimumFractionDigits: 3,
};

type RegistrationSummaryProps = {
  details: EnsNameDetails;
  name: string;
};

export const RegistrationSummary = ({ details, name }: RegistrationSummaryProps) => {
  const ensAppUrl = `https://app.ens.domains/${encodeURIComponent(name)}`;

  return (
    <Card className="lg:sticky lg:top-6" variant="default">
      {details.isPending ? (
        <RegistrationSummarySkeleton />
      ) : details.isAvailable === true ? (
        <AvailableRegistration details={details} ensAppUrl={ensAppUrl} />
      ) : (
        <UnavailableRegistration
          ensAppUrl={ensAppUrl}
          isUnavailable={details.isAvailable === false}
          name={name}
        />
      )}
    </Card>
  );
};

const AvailableRegistration = ({
  details,
  ensAppUrl,
}: {
  details: EnsNameDetails;
  ensAppUrl: string;
}) => (
  <>
    <Card.Header className="pb-0">
      <Card.Title>Register for one year</Card.Title>
    </Card.Header>
    <Card.Content>
      <div className="divide-y divide-dashed divide-default">
        <PriceRow ethUsd={details.ethUsd} label="Registration (1 yr)" value={details.basePrice} />
        <PriceRow ethUsd={details.ethUsd} label="Temporary premium" value={details.premium} />
        <TotalPriceRow ethUsd={details.ethUsd} value={details.totalPrice} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-dashed border-default py-3 font-mono text-xs text-muted">
        <EthPrice value={details.totalPrice} />
        <PremiumEndCountdown availableAt={details.availableAt} isInPremium={details.isInPremium} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-3 text-center text-xs font-semibold text-background transition-opacity hover:opacity-85 sm:text-sm"
          href={`${ensAppUrl}/register`}
          rel="noreferrer"
          target="_blank"
        >
          Buy now (pay solo)
        </Link>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-surface px-3 text-center text-xs font-semibold text-foreground transition-colors hover:bg-surface-secondary sm:text-sm"
          href={START_VAULT_URL}
        >
          Start a vault to buy
        </Link>
      </div>
    </Card.Content>
  </>
);

const UnavailableRegistration = ({
  ensAppUrl,
  isUnavailable,
  name,
}: {
  ensAppUrl: string;
  isUnavailable: boolean;
  name: string;
}) => (
  <>
    <Card.Header>
      <Card.Title>
        {isUnavailable ? "Not available to register" : "Availability unavailable"}
      </Card.Title>
      <Card.Description>
        {isUnavailable
          ? `${name} is currently registered or unavailable through ENS.`
          : `Open ${name} in the ENS app to check its current state.`}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Link
        className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-5 text-center text-sm font-semibold text-background transition-opacity hover:opacity-85"
        href={ensAppUrl}
        rel="noreferrer"
        target="_blank"
      >
        View on ENS app
        <HugeiconsIcon aria-hidden icon={ArrowUpRight01Icon} strokeWidth={1.5} width={12} />
      </Link>
    </Card.Content>
  </>
);

const RegistrationSummarySkeleton = () => (
  <>
    <Card.Header>
      <Card.Title>Checking availability</Card.Title>
      <Card.Description>
        Reading the current registration state from Ethereum mainnet.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <div className="divide-y divide-dashed divide-default">
        <div className="flex items-center justify-between py-4">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
        </div>
        <div className="flex items-center justify-between py-4">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
        </div>
        <div className="flex items-center justify-between py-4">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>
      <div className="flex justify-between border-t border-dashed border-default py-3">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-10 rounded-full" />
      </div>
    </Card.Content>
  </>
);

const PriceRow = ({
  label,
  value,
  ethUsd,
}: {
  label: string;
  value: bigint | undefined;
  ethUsd: bigint | undefined;
}) => {
  const usd = weiToUsd(value, ethUsd);

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <Typography.Paragraph color="muted" size="sm">
        {label}
      </Typography.Paragraph>
      {usd === undefined ? (
        <span className="text-sm text-muted">Unavailable</span>
      ) : (
        <NumberFlow
          className="font-mono text-base font-semibold text-foreground"
          format={USD_FORMAT}
          value={usd}
        />
      )}
    </div>
  );
};

const TotalPriceRow = ({
  value,
  ethUsd,
}: {
  value: bigint | undefined;
  ethUsd: bigint | undefined;
}) => {
  const usd = weiToUsd(value, ethUsd);

  return (
    <div className="flex items-end justify-between gap-4 py-4">
      <Typography.Paragraph color="muted" size="sm">
        Total to buy now
      </Typography.Paragraph>
      {usd === undefined ? (
        <span className="text-sm text-muted">Unavailable</span>
      ) : (
        <NumberFlow
          className="font-mono text-2xl font-semibold tracking-tight text-foreground"
          format={USD_FORMAT}
          value={usd}
        />
      )}
    </div>
  );
};

const EthPrice = ({ value }: { value: bigint | undefined }) => {
  const eth = value === undefined ? undefined : Number(formatEther(value));

  return eth === undefined ? (
    <span>ETH unavailable</span>
  ) : (
    <span className="flex items-baseline gap-1.5">
      <span>≈</span>
      <NumberFlow format={ETH_FORMAT} value={eth} />
      <span>ETH</span>
    </span>
  );
};

const PremiumEndCountdown = ({
  availableAt,
  isInPremium,
}: {
  availableAt: number | undefined;
  isInPremium: boolean | undefined;
}) => {
  const [now, setNow] = useState(getUnixTime);
  const updateNow = useCallback(() => setNow(getUnixTime()), []);
  useInterval(updateNow, isInPremium === true ? 60_000 : null);

  if (isInPremium !== true || availableAt === undefined) return null;

  return <span>premium gone in {formatPremiumCountdown(availableAt - now)}</span>;
};

const formatPremiumCountdown = (seconds: number) => {
  if (seconds <= 0) return "now";

  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
};
