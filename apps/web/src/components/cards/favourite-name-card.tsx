"use client";

import Link from "next/link";

import { Card, Chip, Typography } from "@thenamespace/uikit";

import { NameAvatar } from "@/components/common";
import type { FavouriteNameDetails } from "@/hooks";

import { FavouriteButton } from "./favourite-button";
import { PremiumDecayMeter } from "./premium-decay";
import { PremiumNamePrice } from "./premium-name-price";

type FavouriteNameCardProps = {
  ethUsd: bigint | undefined;
  isPricePending: boolean;
  name: FavouriteNameDetails;
  now: number;
  price: bigint | undefined;
};

export const FavouriteNameCard = ({
  ethUsd,
  isPricePending,
  name,
  now,
  price,
}: FavouriteNameCardProps) => {
  const isInPremium =
    name.isAvailable === true &&
    name.premiumStartsAt !== undefined &&
    name.availableAt !== undefined &&
    name.premiumStartsAt <= now &&
    now < name.availableAt;

  return (
    <Card className="group relative h-full gap-0 bg-transparent p-0 shadow-none transition-[transform,filter] duration-200 filter-[drop-shadow(0_2px_6px_rgba(18,21,28,0.08))] hover:-translate-y-0.75 hover:filter-[drop-shadow(0_10px_14px_rgba(18,21,28,0.13))]">
      <Link
        aria-label={`View ${name.label}.eth`}
        className="absolute inset-0 z-0 rounded-[inherit]"
        href={`/name/${name.label}.eth`}
      />
      <div className="pointer-events-none relative z-[1] flex h-full flex-col">
        <div className="ticket-top flex min-h-40 flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3 pr-10">
            <span className="inline-flex transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-105">
              <NameAvatar
                className="size-10 rounded-lg"
                label={name.label}
                resolveEnsAvatar={false}
              />
            </span>
            <NameStatus isAvailable={name.isAvailable} />
          </div>

          <div className="mt-auto pt-5 text-[29px] leading-[1.05] font-semibold tracking-tight wrap-break-word text-foreground">
            {name.label}
            <span className="font-normal text-muted">.eth</span>
          </div>
        </div>

        <div className="ticket-stub px-4 pt-3.5 pb-4">
          {name.isAvailable === true ? (
            <>
              <PremiumNamePrice ethUsd={ethUsd} isPending={isPricePending} price={price} />
              {isInPremium ? (
                <PremiumDecayMeter
                  availableAt={name.availableAt as number}
                  now={now}
                  premiumStartsAt={name.premiumStartsAt as number}
                />
              ) : null}
            </>
          ) : (
            <Typography.Paragraph className="min-h-12" color="muted" size="sm">
              {name.isAvailable === false
                ? "This name is currently registered."
                : "ENS status is temporarily unavailable."}
            </Typography.Paragraph>
          )}
        </div>
      </div>
      <div className="absolute top-3 right-3 z-10">
        <FavouriteButton label={name.label} />
      </div>
    </Card>
  );
};

const NameStatus = ({ isAvailable }: { isAvailable: boolean | undefined }) => (
  <Chip color={isAvailable ? "success" : "default"} size="sm" variant="soft">
    <Chip.Label>
      {isAvailable === undefined ? "Unknown" : isAvailable ? "Available" : "Registered"}
    </Chip.Label>
  </Chip>
);
