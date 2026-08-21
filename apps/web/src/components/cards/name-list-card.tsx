import Link from "next/link";

import { Card, Skeleton } from "@thenamespace/uikit";

import { NameAvatar } from "@/components/common";
import type { PremiumName } from "@/lib/ens";

import { FavouriteButton } from "./favourite-button";
import { CompactPremiumDecay } from "./premium-decay";
import { PremiumNamePrice } from "./premium-name-price";

type NameListCardProps = {
  name: PremiumName;
  price: bigint | undefined;
  ethUsd: bigint | undefined;
  isPricePending: boolean;
  now: number;
};

export const NameListCard = ({ name, price, ethUsd, isPricePending, now }: NameListCardProps) => (
  <Card className="group relative grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-3 pr-16 pl-4 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(9rem,auto)] sm:gap-5">
    <Link
      aria-label={`View ${name.label}.eth`}
      className="absolute inset-0 z-0 rounded-[inherit]"
      href={`/name/${name.label}.eth`}
    />
    <div className="pointer-events-none contents">
      <NameAvatar
        className="relative z-[1] size-11 rounded-xl transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
        label={name.label}
        resolveEnsAvatar={false}
      />

      <div className="relative z-[1] min-w-0">
        <div className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {name.label}
          <span className="font-normal text-muted">.eth</span>
        </div>
      </div>

      <div className="relative z-[1] col-start-2 row-start-2 sm:col-auto sm:row-auto">
        <CompactPremiumDecay
          availableAt={name.availableAt}
          now={now}
          premiumStartsAt={name.premiumStartsAt}
        />
      </div>

      <div className="relative z-[1] hidden text-right sm:block">
        <PremiumNamePrice compact ethUsd={ethUsd} isPending={isPricePending} price={price} />
      </div>
    </div>
    <div className="absolute top-1/2 right-3 z-10 -translate-y-1/2 sm:right-4">
      <FavouriteButton label={name.label} />
    </div>
  </Card>
);

export const NameListCardSkeleton = ({ count = 8 }: { count?: number }) => (
  <output aria-label="Loading premium names" className="block space-y-3">
    {Array.from({ length: count }, (_, index) => (
      <ListCardSkeleton key={index} />
    ))}
  </output>
);

const ListCardSkeleton = () => (
  <Card className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 shadow-xs sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(9rem,auto)] sm:gap-5">
    <Skeleton className="size-11 rounded-xl" />
    <Skeleton className="h-6 w-36 rounded-md" />
    <Skeleton className="col-start-2 row-start-2 h-7 w-24 rounded-full sm:col-auto sm:row-auto" />
    <div className="hidden sm:block">
      <Skeleton className="ml-auto h-5 w-24 rounded-md" />
      <Skeleton className="mt-2 ml-auto h-3 w-16 rounded-md" />
    </div>
  </Card>
);
