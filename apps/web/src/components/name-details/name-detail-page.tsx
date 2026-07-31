"use client";

import { Breadcrumbs, Card, Chip, Skeleton, Surface, Typography } from "@thenamespace/uikit";

import { useEnsNameDetails } from "@/hooks";

import { NameAvatar } from "../name-avatar";
import { NameFacts } from "./name-facts";
import { PremiumPriceChart } from "./premium-price-chart";
import { RegistrationSummary } from "./registration-summary";

type NameDetailPageProps = {
  label: string;
};

export const NameDetailPage = ({ label }: NameDetailPageProps) => {
  const details = useEnsNameDetails({ label });
  const name = `${label}.eth`;
  const statusLabel = details.isPending
    ? "Checking availability"
    : details.isAvailable === undefined
      ? "Unable to verify"
      : details.isAvailable === false
        ? "Unavailable"
        : details.isInPremium
          ? "Available in premium"
          : "Available";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Discover</Breadcrumbs.Item>
        <Breadcrumbs.Item>{name}</Breadcrumbs.Item>
      </Breadcrumbs>

      <Surface className="mt-8 flex flex-col gap-5 bg-transparent p-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <NameAvatar className="size-14 shrink-0 rounded-2xl" label={label} />
          <div className="min-w-0">
            <Typography.Heading className="break-all text-3xl tracking-tight sm:text-5xl" level={1}>
              {label}
              <span className="font-normal text-muted">.eth</span>
            </Typography.Heading>
          </div>
        </div>
        <Chip
          className="self-end sm:self-center"
          color={
            details.isPending || details.isAvailable === undefined
              ? "default"
              : details.isAvailable === false
                ? "danger"
                : "success"
          }
          size="sm"
          variant="soft"
        >
          <Chip.Label>{statusLabel}</Chip.Label>
        </Chip>
      </Surface>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)]">
        {details.isInPremium === true &&
        details.availableAt !== undefined &&
        details.premiumStartsAt !== undefined ? (
          <PremiumPriceChart
            availableAt={details.availableAt}
            ethUsdPrice={details.ethUsd}
            premiumStartsAt={details.premiumStartsAt}
          />
        ) : (
          <Card className="flex min-h-[452px] flex-col" variant="default">
            <Card.Header>
              <Card.Title>Temporary premium decay</Card.Title>
              <Card.Description>
                {details.isPending
                  ? "Reading the current premium from Ethereum mainnet."
                  : "This name does not currently have a temporary premium."}
              </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-1 items-center justify-center">
              {details.isPending ? (
                <Skeleton className="h-80 w-full rounded-xl" />
              ) : (
                <Typography.Paragraph color="muted" size="sm">
                  No active temporary premium
                </Typography.Paragraph>
              )}
            </Card.Content>
          </Card>
        )}
        <RegistrationSummary details={details} name={name} />
        <NameFacts details={details} label={label} />
      </div>
    </main>
  );
};
