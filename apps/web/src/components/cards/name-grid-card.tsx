import Link from "next/link";

import { Card, Skeleton } from "@thenamespace/uikit";

import { NameAvatar } from "@/components/common";
import type { PremiumName } from "@/lib/ens";

import { FavouriteButton } from "./favourite-button";
import { PremiumDecayMeter } from "./premium-decay";
import { PremiumNamePrice } from "./premium-name-price";

type NameGridCardProps = {
  name: PremiumName;
  price: bigint | undefined;
  ethUsd: bigint | undefined;
  isPricePending: boolean;
};

export const NameGridCard = ({ name, price, ethUsd, isPricePending }: NameGridCardProps) => {
  return (
    <div className="group relative h-full">
      <Link className="block h-full" href={`/name/${name.label}.eth`}>
        <Card className="h-full gap-0 bg-transparent p-0 shadow-none transition-[transform,filter] duration-200 filter-[drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:-translate-y-0.75 hover:filter-[drop-shadow(0_10px_14px_rgba(18,21,28,0.13))]">
          <div className="ticket-top flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-2.5">
              <span className="inline-flex transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
                <NameAvatar className="size-10 rounded-lg" label={name.label} />
              </span>
            </div>

            <div className="mt-4 mb-5 text-[29px] leading-[1.05] font-semibold tracking-tight wrap-break-word text-foreground">
              {name.label}
              <span className="font-normal text-muted">.eth</span>
            </div>
          </div>

          <div className="ticket-stub px-4 pt-3.5 pb-4">
            <PremiumNamePrice ethUsd={ethUsd} isPending={isPricePending} price={price} />
            <PremiumDecayMeter
              availableAt={name.availableAt}
              premiumStartsAt={name.premiumStartsAt}
            />
          </div>
        </Card>
      </Link>
      <div className="absolute top-3 right-3 z-10">
        <FavouriteButton label={name.label} />
      </div>
    </div>
  );
};

export const NameGridCardSkeleton = ({ count = 8 }: { count?: number }) => (
  <output
    aria-label="Loading premium names"
    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    {Array.from({ length: count }, (_, index) => (
      <GridCardSkeleton key={index} />
    ))}
  </output>
);

const GridCardSkeleton = () => (
  <Card className="h-72 gap-0 overflow-hidden p-0 shadow-xs">
    <div className="flex flex-1 flex-col p-4">
      <Skeleton className="size-8 rounded-lg" />
      <Skeleton className="mt-5 h-8 w-3/4 rounded-lg" />
    </div>
    <div className="border-t border-default px-4 py-4">
      <Skeleton className="h-3 w-20 rounded-md" />
      <Skeleton className="mt-2 h-6 w-36 rounded-md" />
      <Skeleton className="mt-5 h-2 w-full rounded-full" />
      <Skeleton className="mt-3 h-7 w-24 rounded-full" />
    </div>
  </Card>
);
