import { NumberValue, Skeleton } from "@thenamespace/uikit";
import { formatEther } from "viem";

type PremiumNamePriceProps = {
  price: bigint | undefined;
  ethUsd: bigint | undefined;
  isPending: boolean;
  compact?: boolean;
};

const USD_FORMAT: Intl.NumberFormatOptions = {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
  style: "currency",
};

export const PremiumNamePrice = ({
  price,
  ethUsd,
  isPending,
  compact = false,
}: PremiumNamePriceProps) => {
  if (isPending) {
    return (
      <div aria-label="Loading current price">
        <Skeleton className={compact ? "ml-auto h-5 w-24 rounded-md" : "h-3 w-24 rounded-md"} />
        <Skeleton
          className={compact ? "mt-2 ml-auto h-3 w-16 rounded-md" : "mt-2 h-7 w-36 rounded-md"}
        />
      </div>
    );
  }

  if (price === undefined) {
    return <p className="text-xs text-muted">Price unavailable</p>;
  }

  const eth = Number(formatEther(price));
  const usd = ethUsd === undefined ? undefined : (eth * Number(ethUsd)) / 1e8;

  if (compact) {
    return (
      <>
        <NumberValue
          className="block font-mono text-base font-semibold text-foreground"
          maximumFractionDigits={4}
          minimumFractionDigits={3}
          value={eth}
        >
          <NumberValue.Suffix className="ml-1">ETH</NumberValue.Suffix>
        </NumberValue>
        {usd === undefined ? null : (
          <NumberValue
            className="mt-0.5 block font-mono text-xs text-muted"
            formatOptions={USD_FORMAT}
            value={usd}
          />
        )}
      </>
    );
  }

  return (
    <>
      <span className="text-[10.5px] font-semibold tracking-[0.09em] uppercase text-muted">
        Current 1-year price
      </span>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {usd === undefined ? (
          <NumberValue
            className="font-mono text-[22px] font-semibold tracking-tight text-foreground"
            maximumFractionDigits={4}
            minimumFractionDigits={3}
            value={eth}
          >
            <NumberValue.Suffix className="ml-1">ETH</NumberValue.Suffix>
          </NumberValue>
        ) : (
          <>
            <NumberValue
              className="font-mono text-[22px] font-semibold tracking-tight text-foreground"
              formatOptions={USD_FORMAT}
              value={usd}
            />
            <NumberValue
              className="font-mono text-[12px] whitespace-nowrap text-muted"
              maximumFractionDigits={4}
              minimumFractionDigits={3}
              value={eth}
            >
              <NumberValue.Prefix>≈&nbsp;</NumberValue.Prefix>
              <NumberValue.Suffix className="ml-1">ETH</NumberValue.Suffix>
            </NumberValue>
          </>
        )}
      </div>
    </>
  );
};
