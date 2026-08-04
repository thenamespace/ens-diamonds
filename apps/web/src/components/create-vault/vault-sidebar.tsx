import type { ReactNode } from "react";

import { Accordion, Button, Card, NumberValue, Typography } from "@thenamespace/uikit";

import { CardHeading, ConnectButton } from "@/components/common";
import type { CreateVaultProgress } from "@/hooks";

import { CREATE_VAULT_FORM_ID } from "./vault-form-types";

const DEFAULT_EXPANDED_KEYS = ["how-vault-works"];

type VaultSidebarProps = {
  error: string | undefined;
  initialContribution: string;
  isConnected: boolean;
  isPending: boolean;
  maxSpend: string;
  name: string;
  ownerCount: number;
  progress: CreateVaultProgress;
  registrationYears: number;
  threshold: number;
};

export const VaultSidebar = ({
  error,
  initialContribution,
  isConnected,
  isPending,
  maxSpend,
  name,
  ownerCount,
  progress,
  registrationYears,
  threshold,
}: VaultSidebarProps) => (
  <aside className="space-y-4 lg:sticky lg:top-6">
    <Card className="p-0" variant="default">
      <Accordion hideSeparator defaultExpandedKeys={DEFAULT_EXPANDED_KEYS} variant="default">
        <Accordion.Item id="how-vault-works">
          <Accordion.Heading>
            <Accordion.Trigger className="data-[hovered=true]:bg-transparent! hover:bg-transparent!">
              <span className="text-left font-semibold">How a vault works</span>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="pb-2">
              <ol className="space-y-4">
                <VaultStep number={1}>Choose the people who will own the name with you.</VaultStep>
                <VaultStep number={2}>
                  Everyone can add ETH while the vault is open, or take their ETH back before buying
                  starts.
                </VaultStep>
                <VaultStep number={3}>
                  When the group is ready, the vault gets one chance to buy the name. Funds are
                  locked during this step.
                </VaultStep>
                <VaultStep number={4}>
                  If the purchase succeeds, {name} belongs to a shared Safe. Most owners must agree
                  before it can be moved or changed.
                </VaultStep>
              </ol>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Card>

    <Card variant="default">
      <Card.Header>
        <CardHeading>Vault summary</CardHeading>
      </Card.Header>
      <Card.Content>
        <div className="divide-y divide-default">
          <SummaryRow label="Owners" value={`${ownerCount} addresses`} />
          <SummaryRow label="Approval required" value={`${threshold} of ${ownerCount}`} />
          <SummaryAmount label="Maximum spend" value={maxSpend} />
          <SummaryAmount label="Your contribution" value={initialContribution} />
          <SummaryRow
            label="Registration"
            value={`${registrationYears} ${registrationYears === 1 ? "year" : "years"}`}
          />
        </div>

        <div className="mt-5">
          {isConnected ? (
            <Button
              fullWidth
              form={CREATE_VAULT_FORM_ID}
              isDisabled={isPending}
              isPending={isPending}
              type="submit"
            >
              {progress === "confirm-wallet"
                ? "Confirm in Wallet"
                : progress === "confirming-transaction"
                  ? "Confirming Transaction…"
                  : "Create Vault"}
            </Button>
          ) : (
            <ConnectButton fullWidth />
          )}
        </div>
        {!isConnected ? (
          <Typography.Paragraph className="mt-3 text-center" color="muted" size="sm">
            Connect and sign in to create this vault.
          </Typography.Paragraph>
        ) : null}
        {error ? (
          <Typography.Paragraph
            aria-live="polite"
            className="mt-3 text-danger"
            role="alert"
            size="sm"
          >
            {error}
          </Typography.Paragraph>
        ) : null}
      </Card.Content>
    </Card>
  </aside>
);

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
    <Typography.Paragraph color="muted" size="sm">
      {label}
    </Typography.Paragraph>
    <span className="text-right text-sm font-semibold">{value}</span>
  </div>
);

const SummaryAmount = ({ label, value }: { label: string; value: string }) => {
  const amount = Number(value);
  const isValid = value.trim() !== "" && Number.isFinite(amount) && amount >= 0;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <Typography.Paragraph color="muted" size="sm">
        {label}
      </Typography.Paragraph>
      {isValid ? (
        <NumberValue className="text-sm font-semibold" maximumFractionDigits={6} value={amount}>
          <NumberValue.Suffix className="ml-1 text-xs text-muted">ETH</NumberValue.Suffix>
        </NumberValue>
      ) : (
        <span className="text-sm text-muted">—</span>
      )}
    </div>
  );
};

const VaultStep = ({ children, number }: { children: ReactNode; number: number }) => (
  <li className="grid grid-cols-[1.25rem_1fr] gap-2 text-sm leading-5">
    <span className="text-muted">{number}.</span>
    <span>{children}</span>
  </li>
);
