import NumberFlow, { type Format } from "@number-flow/react";
import { Skeleton } from "@thenamespace/uikit";

import { weiToEth } from "@/lib/helpers";

type PremiumNamePriceProps = {
  price: bigint | undefined;
  ethUsd: bigint | undefined;
  isPending: boolean;
  compact?: boolean;
};

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

export const PremiumNamePrice = ({
  price,
  ethUsd,
  isPending,
  compact = false,
}: PremiumNamePriceProps) => {
  if (compact) {
    return (
      <div aria-busy={isPending} className="h-10 text-right">
        <CompactPriceContent ethUsd={ethUsd} isPending={isPending} price={price} />
      </div>
    );
  }

  return (
    <div aria-busy={isPending} className="h-[49px]">
      <span className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">
        Current 1-year price
      </span>
      <div className="mt-1 flex h-7 items-baseline gap-2 whitespace-nowrap">
        {isPending ? (
          <Skeleton aria-label="Loading current price" className="h-7 w-36 rounded-md" />
        ) : price === undefined ? (
          <span className="text-xs text-muted">Price unavailable</span>
        ) : (
          <PriceValues ethUsd={ethUsd} price={price} />
        )}
      </div>
    </div>
  );
};

const CompactPriceContent = ({
  ethUsd,
  isPending,
  price,
}: Omit<PremiumNamePriceProps, "compact">) => {
  if (isPending) {
    return (
      <div aria-label="Loading current price">
        <Skeleton className="ml-auto h-5 w-24 rounded-md" />
        <Skeleton className="mt-1 ml-auto h-3 w-16 rounded-md" />
      </div>
    );
  }

  if (price === undefined) {
    return <span className="inline-flex h-full items-center text-xs text-muted">Unavailable</span>;
  }

  const eth = weiToEth(price);
  const usd = ethUsd === undefined ? undefined : (eth * Number(ethUsd)) / 1e8;

  return (
    <>
      <NumberFlow
        className="block h-5 font-mono text-base font-semibold text-foreground"
        format={ETH_FORMAT}
        suffix=" ETH"
        value={eth}
      />
      {usd === undefined ? null : (
        <NumberFlow
          className="mt-0.5 block h-4 font-mono text-xs text-muted"
          format={USD_FORMAT}
          value={usd}
        />
      )}
    </>
  );
};

const PriceValues = ({ ethUsd, price }: Pick<PremiumNamePriceProps, "ethUsd" | "price">) => {
  if (price === undefined) return null;

  const eth = weiToEth(price);
  const usd = ethUsd === undefined ? undefined : (eth * Number(ethUsd)) / 1e8;

  return usd === undefined ? (
    <NumberFlow
      className="font-mono text-[22px] font-semibold tracking-tight text-foreground"
      format={ETH_FORMAT}
      suffix=" ETH"
      value={eth}
    />
  ) : (
    <>
      <NumberFlow
        className="font-mono text-[22px] font-semibold tracking-tight text-foreground"
        format={USD_FORMAT}
        value={usd}
      />
      <NumberFlow
        className="font-mono text-[12px] text-muted"
        format={ETH_FORMAT}
        prefix="≈ "
        suffix=" ETH"
        value={eth}
      />
    </>
  );
};
