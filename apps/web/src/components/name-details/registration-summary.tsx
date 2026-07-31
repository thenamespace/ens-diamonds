import { Card, NumberValue, Skeleton, Typography } from "@thenamespace/uikit";
import { formatEther } from "viem";

import type { EnsNameDetails } from "@/hooks";
import { weiToUsd } from "@/lib/ens";

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
};

export const RegistrationSummary = ({ details }: RegistrationSummaryProps) => {
  const baseUsd = weiToUsd(details.basePrice, details.ethUsd);
  const premiumUsd = weiToUsd(details.premium, details.ethUsd);
  const totalUsd = weiToUsd(details.totalPrice, details.ethUsd);
  const totalEth =
    details.totalPrice === undefined ? undefined : Number(formatEther(details.totalPrice));

  return (
    <Card className="lg:sticky lg:top-6" variant="default">
      <Card.Header>
        <Card.Title>Register for one year</Card.Title>
        <Card.Description>
          Live pricing from the ENS registrar controller on Ethereum mainnet.
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-1">
        <PriceRow isPending={details.isPending} label="Registration" value={baseUsd} />
        <PriceRow isPending={details.isPending} label="Temporary premium" value={premiumUsd} />

        <div className="mt-3 border-t border-default pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <Typography.Paragraph color="muted" size="sm">
              Total today
            </Typography.Paragraph>
            {details.isPending ? (
              <Skeleton className="h-8 w-28 rounded-lg" />
            ) : totalUsd === undefined ? (
              <span className="text-sm text-muted">Unavailable</span>
            ) : (
              <NumberValue
                className="text-2xl font-semibold tracking-tight text-foreground"
                formatOptions={USD_FORMAT}
                value={totalUsd}
              />
            )}
          </div>

          {totalEth === undefined ? null : (
            <NumberValue
              className="mt-1 justify-end font-mono text-xs text-muted"
              formatOptions={ETH_FORMAT}
              value={totalEth}
            >
              <NumberValue.Suffix className="ml-1">ETH</NumberValue.Suffix>
            </NumberValue>
          )}
        </div>

        <Typography.Paragraph className="pt-4" color="muted" size="xs">
          The temporary premium changes continuously. Network gas is not included.
        </Typography.Paragraph>
      </Card.Content>
    </Card>
  );
};

const PriceRow = ({
  label,
  value,
  isPending,
}: {
  label: string;
  value: number | undefined;
  isPending: boolean;
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-default py-3 last:border-0">
    <Typography.Paragraph color="muted" size="sm">
      {label}
    </Typography.Paragraph>
    {isPending ? (
      <Skeleton className="h-5 w-20 rounded-md" />
    ) : value === undefined ? (
      <span className="text-sm text-muted">Unavailable</span>
    ) : (
      <NumberValue
        className="font-mono text-sm font-semibold text-foreground"
        formatOptions={USD_FORMAT}
        value={value}
      />
    )}
  </div>
);
