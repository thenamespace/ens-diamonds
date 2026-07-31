import {
  Card,
  ExternalLinkIcon,
  Link,
  NumberValue,
  Skeleton,
  Typography,
} from "@thenamespace/uikit";
import { formatEther } from "viem";

import type { EnsNameDetails } from "@/hooks";
import { weiToUsd } from "@/lib/ens";

const START_VAULT_URL = "/vaults/new";
const USD_FORMAT: Intl.NumberFormatOptions = {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
  style: "currency",
};
const ETH_FORMAT: Intl.NumberFormatOptions = {
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
    <Card.Header>
      <Card.Title>Register for one year</Card.Title>
      <Card.Description>Live pricing from the ENS registrar on Ethereum mainnet.</Card.Description>
    </Card.Header>
    <Card.Content>
      <div className="divide-y divide-default border-y border-default">
        <PriceRow ethUsd={details.ethUsd} label="Base price" value={details.basePrice} />
        <PriceRow ethUsd={details.ethUsd} label="Premium" value={details.premium} />
      </div>

      <Typography.Paragraph className="mt-4" color="muted" size="xs">
        Premium pricing changes continuously. Network gas is not included.
      </Typography.Paragraph>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-default px-4 text-center text-sm font-semibold transition-colors hover:bg-surface"
          href={`${ensAppUrl}/register`}
          rel="noreferrer"
          target="_blank"
        >
          Buy solo
          <ExternalLinkIcon aria-hidden className="size-3.5 opacity-60" />
        </Link>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-foreground px-4 text-center text-sm font-semibold text-background transition-opacity hover:opacity-85"
          href={START_VAULT_URL}
        >
          Start a vault
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
        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-center text-sm font-semibold text-background transition-opacity hover:opacity-85"
        href={ensAppUrl}
        rel="noreferrer"
        target="_blank"
      >
        View on ENS app
        <ExternalLinkIcon aria-hidden className="size-3.5 opacity-60" />
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
      <div className="space-y-4 border-y border-default py-4">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
      <Skeleton className="mt-6 h-10 w-full rounded-full" />
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
  const eth = value === undefined ? undefined : Number(formatEther(value));

  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <Typography.Paragraph color="muted" size="sm">
        {label}
      </Typography.Paragraph>
      {usd === undefined || eth === undefined ? (
        <span className="text-sm text-muted">Unavailable</span>
      ) : (
        <div className="text-right">
          <NumberValue
            className="block font-mono text-sm font-semibold text-foreground"
            formatOptions={USD_FORMAT}
            value={usd}
          />
          <NumberValue
            className="mt-0.5 block font-mono text-xs text-muted"
            formatOptions={ETH_FORMAT}
            value={eth}
          >
            <NumberValue.Suffix className="ml-1">ETH</NumberValue.Suffix>
          </NumberValue>
        </div>
      )}
    </div>
  );
};
