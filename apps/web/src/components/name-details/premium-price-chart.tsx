"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import {
  AreaChart,
  Card,
  ChartTooltip,
  Chip,
  NumberValue,
  Skeleton,
  Typography,
  type ChartTooltipContentProps,
} from "@thenamespace/uikit";
import { useInterval } from "usehooks-ts";

import { CardHeading } from "@/components/common";
import { getPremiumPriceCurve, type PremiumName } from "@/lib/ens";
import { formatChartDate, getUnixTime } from "@/lib/helpers";

const CHART_MARGIN = { bottom: 0, left: 4, right: 12, top: 16 };
const ACTIVE_DOT = {
  fill: "#6572ce",
  r: 5,
  stroke: "var(--color-surface)",
  strokeWidth: 3,
};
const TOOLTIP_CURSOR = { strokeDasharray: "3 4" };
const TOOLTIP_WRAPPER_STYLE = { zIndex: 20 };
const X_AXIS_INTERVALS = 3;
const Y_AXIS_TARGET_INTERVALS = 8;
const ETH_TOOLTIP_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 4,
};
const USD_TOOLTIP_FORMAT: Intl.NumberFormatOptions = {
  currency: "USD",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
  style: "currency",
};
const ETH_AXIS_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const formatAxisPrice = (value: number) => `${ETH_AXIS_FORMATTER.format(value)} ETH`;
const formatTooltipDate = (value: number | string) => formatChartDate(Number(value));
const getAxisTicks = (maximum: number) => {
  if (maximum <= 0) {
    return {
      domain: [0, 1] as [number, number],
      ticks: [0, 1],
    };
  }

  const roughStep = maximum / Y_AXIS_TARGET_INTERVALS;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const multiplier =
    normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;
  const step = multiplier * magnitude;
  const upperBound = Math.ceil(maximum / step) * step;

  return {
    domain: [0, upperBound] as [number, number],
    ticks: Array.from({ length: Math.round(upperBound / step) + 1 }, (_, index) => index * step),
  };
};

type PremiumPriceChartProps = Pick<PremiumName, "availableAt" | "premiumStartsAt"> & {
  ethUsdPrice: bigint | undefined;
};

export const PremiumPriceChart = ({
  availableAt,
  ethUsdPrice,
  premiumStartsAt,
}: PremiumPriceChartProps) => {
  const now = useMinuteClock(premiumStartsAt);
  const data = useMemo(
    () =>
      ethUsdPrice === undefined
        ? []
        : getPremiumPriceCurve(premiumStartsAt, availableAt, ethUsdPrice),
    [availableAt, ethUsdPrice, premiumStartsAt],
  );
  const xAxisTicks = useMemo(
    () =>
      Array.from(
        { length: X_AXIS_INTERVALS + 1 },
        (_, index) =>
          premiumStartsAt + ((availableAt - premiumStartsAt) * index) / X_AXIS_INTERVALS,
      ),
    [availableAt, premiumStartsAt],
  );
  const xAxisDomain = useMemo<[number, number]>(
    () => [premiumStartsAt, availableAt],
    [availableAt, premiumStartsAt],
  );
  const yAxis = useMemo(() => getAxisTicks(data[0]?.premiumEth ?? 0), [data]);
  const premiumTooltip = useMemo(
    () => <PremiumTooltipContent ethUsdPrice={ethUsdPrice ?? 0n} />,
    [ethUsdPrice],
  );
  const currentProgress = Math.min(
    Math.max((now - premiumStartsAt) / (availableAt - premiumStartsAt), 0),
    1,
  );
  const markerStyle = useMemo<CSSProperties>(
    () => ({
      left: `calc(76px + (100% - 88px) * ${currentProgress})`,
    }),
    [currentProgress],
  );

  return (
    <Card className="overflow-hidden" variant="default">
      <Card.Header className="flex-row items-start justify-between gap-4">
        <div>
          <CardHeading>Temporary premium decay</CardHeading>
          <Card.Description>
            The premium halves daily until the name reaches its standard registration price.
          </Card.Description>
        </div>
        <Chip color="default" size="sm" variant="soft">
          <Chip.Label>ETH</Chip.Label>
        </Chip>
      </Card.Header>
      <Card.Content>
        {ethUsdPrice === undefined ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : (
          <div className="relative">
            <AreaChart data={data} height={320} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="premium-price-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6572ce" stopOpacity={0.28} />
                  <stop offset="72%" stopColor="#6572ce" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#6572ce" stopOpacity={0} />
                </linearGradient>
              </defs>
              <AreaChart.Grid strokeDasharray="3 5" vertical={false} />
              <AreaChart.XAxis
                dataKey="timestamp"
                domain={xAxisDomain}
                scale="linear"
                tickFormatter={formatChartDate}
                tickMargin={10}
                ticks={xAxisTicks}
                type="number"
              />
              <AreaChart.YAxis
                domain={yAxis.domain}
                scale="linear"
                tickFormatter={formatAxisPrice}
                ticks={yAxis.ticks}
                width={72}
              />
              <AreaChart.Area
                activeDot={ACTIVE_DOT}
                dataKey="premiumEth"
                dot={false}
                fill="url(#premium-price-fill)"
                name="Premium"
                stroke="#6572ce"
                strokeWidth={2.5}
                type="monotone"
              />
              <AreaChart.Tooltip
                content={premiumTooltip}
                cursor={TOOLTIP_CURSOR}
                wrapperStyle={TOOLTIP_WRAPPER_STYLE}
              />
            </AreaChart>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-4 bottom-8 z-10 -translate-x-1/2"
              style={markerStyle}
            >
              <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                Now
              </span>
              <span className="mt-5 block h-[calc(100%-1.25rem)] border-l border-dashed border-foreground/45" />
            </div>
          </div>
        )}

        <Typography.Paragraph className="mt-2" color="muted" size="xs">
          The curve mirrors the registrar oracle&apos;s fixed-point decay and live ETH/USD
          conversion. Hover anywhere for the premium in ETH at that time.
        </Typography.Paragraph>
      </Card.Content>
    </Card>
  );
};

const PremiumTooltipContent = ({
  active,
  ethUsdPrice,
  label,
  payload,
}: ChartTooltipContentProps & { ethUsdPrice: bigint }) => {
  if (!active || !payload?.length) return null;

  const premiumEth = Number(payload[0]?.value ?? 0);
  const premiumUsd = premiumEth * (Number(ethUsdPrice) / 1e8);

  return (
    <ChartTooltip active indicator="line">
      <ChartTooltip.Header>{formatTooltipDate(label ?? "")}</ChartTooltip.Header>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="#6572ce" />
        <ChartTooltip.Label>Premium (USD)</ChartTooltip.Label>
        <ChartTooltip.Value>
          <NumberValue
            className="font-semibold text-[#6572ce]"
            formatOptions={USD_TOOLTIP_FORMAT}
            value={premiumUsd}
          />
        </ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="#2a9d8f" />
        <ChartTooltip.Label>Premium (ETH)</ChartTooltip.Label>
        <ChartTooltip.Value>
          <NumberValue
            className="font-mono font-semibold text-[#2a9d8f]"
            formatOptions={ETH_TOOLTIP_FORMAT}
            value={premiumEth}
          >
            <NumberValue.Suffix className="ml-1">ETH</NumberValue.Suffix>
          </NumberValue>
        </ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
};

const useMinuteClock = (fallback: number) => {
  const [now, setNow] = useState<number>();
  const updateNow = useCallback(() => setNow(getUnixTime()), []);

  useEffect(() => {
    updateNow();
  }, [updateNow]);
  useInterval(updateNow, 60_000);

  return now ?? fallback;
};
