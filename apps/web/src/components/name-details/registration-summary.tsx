"use client";

import { useCallback, useState } from "react";

import NumberFlow, { type Format } from "@number-flow/react";
import { buttonVariants, Card, Link, Skeleton, Typography } from "@thenamespace/uikit";
import { ArrowUpRight01Icon, HugeiconsIcon } from "@thenamespace/uikit/icons";
import { useInterval } from "usehooks-ts";

import { CardHeading } from "@/components/common";
import type { EnsNameDetails } from "@/hooks";
import { weiToUsd } from "@/lib/ens";
import { formatCompactDuration, getUnixTime, weiToEth } from "@/lib/helpers";
import { networkDisplayName } from "@/lib/network";

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
        <AvailableRegistration
          details={details}
          ensAppUrl={ensAppUrl}
          startVaultUrl={`/vaults/new/${encodeURIComponent(name)}`}
        />
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
  startVaultUrl,
}: {
  details: EnsNameDetails;
  ensAppUrl: string;
  startVaultUrl: string;
}) => (
  <>
    <Card.Header className="pb-0">
      <CardHeading>Register for one year</CardHeading>
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
          className={buttonVariants({ fullWidth: true, size: "sm", variant: "primary" })}
          href={`${ensAppUrl}/register`}
          rel="noreferrer"
          target="_blank"
        >
          Buy now (pay solo)
        </Link>
        <Link
          className={buttonVariants({ fullWidth: true, size: "sm", variant: "secondary" })}
          href={startVaultUrl}
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
      <CardHeading>
        {isUnavailable ? "Not available to register" : "Availability unavailable"}
      </CardHeading>
      <Card.Description>
        {isUnavailable
          ? `${name} is currently registered or unavailable through ENS.`
          : `Open ${name} in the ENS app to check its current state.`}
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Link
        className={buttonVariants({ fullWidth: true, size: "lg", variant: "primary" })}
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
      <CardHeading>Checking availability</CardHeading>
      <Card.Description>
        Reading the current registration state from {networkDisplayName}.
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
  const eth = value === undefined ? undefined : weiToEth(value);

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

  return <span>premium gone in {formatCompactDuration(availableAt - now)}</span>;
};
