import { formatEther } from "viem";

import { SECONDS_PER_DAY } from "@/lib/constants";

const PRECISION = 10n ** 18n;
const ORACLE_DECIMALS = 10n ** 8n;
const START_PREMIUM_ATTO_USD = 100_000_000n * PRECISION;
const PREMIUM_PERIOD_DAYS = 21n;
const END_PREMIUM_ATTO_USD = START_PREMIUM_ATTO_USD >> PREMIUM_PERIOD_DAYS;
const FRACTIONAL_BITS = [
  999989423469314432n,
  999978847050491904n,
  999957694548431104n,
  999915390886613504n,
  999830788931929088n,
  999661606496243712n,
  999323327502650752n,
  998647112890970240n,
  997296056085470080n,
  994599423483633152n,
  989228013193975424n,
  978572062087700096n,
  957603280698573696n,
  917004043204671232n,
  840896415253714560n,
  707106781186547584n,
] as const;
const CURVE_INTERVALS = Number(PREMIUM_PERIOD_DAYS) * 40;

export type PremiumPricePoint = Record<"premiumEth" | "timestamp", number>;

export const getPremiumWeiAt = (
  timestamp: number,
  premiumStartsAt: number,
  ethUsdPrice: bigint,
) => {
  if (ethUsdPrice <= 0n) return 0n;

  const elapsed = BigInt(Math.max(Math.floor(timestamp - premiumStartsAt), 0));
  const daysPast = (elapsed * PRECISION) / BigInt(SECONDS_PER_DAY);
  const integerDays = daysPast / PRECISION;
  let premium = START_PREMIUM_ATTO_USD >> integerDays;
  const partialDay = daysPast - integerDays * PRECISION;
  const fraction = (partialDay * (1n << 16n)) / PRECISION;

  for (const [index, multiplier] of FRACTIONAL_BITS.entries()) {
    if ((fraction & (1n << BigInt(index))) !== 0n) {
      premium = (premium * multiplier) / PRECISION;
    }
  }

  const adjustedPremium = premium >= END_PREMIUM_ATTO_USD ? premium - END_PREMIUM_ATTO_USD : 0n;

  return (adjustedPremium * ORACLE_DECIMALS) / ethUsdPrice;
};

export const getPremiumPriceCurve = (
  premiumStartsAt: number,
  availableAt: number,
  ethUsdPrice: bigint,
): PremiumPricePoint[] =>
  Array.from({ length: CURVE_INTERVALS + 1 }, (_, index) => {
    const timestamp = Math.floor(
      premiumStartsAt + ((availableAt - premiumStartsAt) * index) / CURVE_INTERVALS,
    );
    const premiumWei = getPremiumWeiAt(timestamp, premiumStartsAt, ethUsdPrice);

    return {
      premiumEth: Number(formatEther(premiumWei)),
      timestamp,
    };
  });
