import { Button, NumberField, Typography } from "@thenamespace/uikit";
import { formatEther } from "viem";

import type { PurchaseNameVariables, VaultTransactionProgress } from "@/hooks";
import { formatCountdown } from "@/lib/helpers";

export type VaultActionStatus = {
  isPending: boolean;
  progress: VaultTransactionProgress;
};
const ETH_NUMBER_FORMAT = { maximumFractionDigits: 18, useGrouping: false } as const;

export const VaultFundingActions = ({
  amount,
  canBegin,
  canDeposit,
  canWithdraw,
  error,
  inputMaximum,
  isCreator,
  transactionPending,
  beginAcquisition,
  cancelVault,
  deposit,
  withdraw,
  onAmountChange,
  onBegin,
  onCancel,
  onDeposit,
  onSetHalf,
  onSetMax,
  onWithdraw,
}: {
  amount: string;
  canBegin: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  error: string | undefined;
  inputMaximum: bigint;
  isCreator: boolean;
  transactionPending: boolean;
  beginAcquisition: VaultActionStatus;
  cancelVault: VaultActionStatus;
  deposit: VaultActionStatus;
  withdraw: VaultActionStatus;
  onAmountChange: (value: string) => void;
  onBegin: () => void;
  onCancel: () => void;
  onDeposit: () => void;
  onSetHalf: () => void;
  onSetMax: () => void;
  onWithdraw: () => void;
}) => {
  const handleAmountChange = useCallback(
    (value: number) => onAmountChange(Number.isNaN(value) ? "" : String(value)),
    [onAmountChange],
  );

  return (
    <div aria-live="polite">
      <NumberField
        aria-label="Contribution amount"
        className="mt-4"
        formatOptions={ETH_NUMBER_FORMAT}
        isDisabled={transactionPending}
        maxValue={Number(formatEther(inputMaximum))}
        minValue={0}
        step={0.001}
        value={amount === "" ? Number.NaN : Number(amount)}
        variant="secondary"
        onChange={handleAmountChange}
      >
        <NumberField.Group>
          <NumberField.DecrementButton aria-label="Decrease contribution" />
          <NumberField.Input
            className="min-w-0 flex-1"
            autoComplete="off"
            inputMode="decimal"
            name="vault-contribution"
            placeholder="0.00"
          />
          <NumberField.IncrementButton aria-label="Increase contribution" />
        </NumberField.Group>
      </NumberField>

      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onPress={onSetHalf}>
          50%
        </Button>
        <Button size="sm" variant="secondary" onPress={onSetMax}>
          Remaining
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button
          fullWidth
          isDisabled={!canDeposit}
          isPending={deposit.isPending}
          onPress={onDeposit}
        >
          {getVaultTransactionLabel("Deposit", deposit.progress)}
        </Button>
        <Button
          fullWidth
          isDisabled={!canWithdraw}
          isPending={withdraw.isPending}
          variant="secondary"
          onPress={onWithdraw}
        >
          {getVaultTransactionLabel("Withdraw", withdraw.progress)}
        </Button>
      </div>

      {isCreator ? (
        <div className="mt-3 grid gap-3 border-t border-default pt-3">
          {canBegin || beginAcquisition.isPending ? (
            <Button fullWidth isPending={beginAcquisition.isPending} onPress={onBegin}>
              {getVaultTransactionLabel("Begin Acquisition", beginAcquisition.progress)}
            </Button>
          ) : null}
          <Button
            fullWidth
            isDisabled={transactionPending}
            isPending={cancelVault.isPending}
            variant="secondary"
            onPress={onCancel}
          >
            {getVaultTransactionLabel("Cancel Vault", cancelVault.progress)}
          </Button>
        </div>
      ) : null}
      <VaultTransactionError message={error} />
    </div>
  );
};

export const VaultCommittedActions = ({
  acquisition,
  canClaim,
  canPurchase,
  error,
  isExpired,
  isWaiting,
  now,
  purchaseSecrets,
  claim,
  purchaseName,
  onClaim,
  onPurchase,
}: {
  acquisition: {
    committedAt: number;
    expiresAt: number;
    purchaseAvailableAt: number;
  } | null;
  canClaim: boolean;
  canPurchase: boolean;
  error: string | undefined;
  isExpired: boolean;
  isWaiting: boolean;
  now: number;
  purchaseSecrets: PurchaseNameVariables | undefined;
  claim: VaultActionStatus;
  purchaseName: VaultActionStatus;
  onClaim: () => void;
  onPurchase: () => void;
}) => (
  <div aria-live="polite" className="mt-4">
    {isExpired ? (
      <>
        <Typography.Paragraph color="muted" size="sm">
          The acquisition window ended without a purchase. Claim your deposited ETH.
        </Typography.Paragraph>
        <Button
          className="mt-3"
          fullWidth
          isDisabled={!canClaim}
          isPending={claim.isPending}
          onPress={onClaim}
        >
          {getVaultTransactionLabel("Claim ETH", claim.progress)}
        </Button>
      </>
    ) : (
      <>
        {purchaseSecrets ? (
          <Button
            fullWidth
            isDisabled={!canPurchase}
            isPending={purchaseName.isPending}
            onPress={onPurchase}
          >
            {getVaultTransactionLabel("Purchase Name", purchaseName.progress)}
          </Button>
        ) : (
          <Typography.Paragraph color="muted" size="sm">
            Funding is locked. The creator holds the purchase secrets for this acquisition.
          </Typography.Paragraph>
        )}
        {isWaiting && acquisition ? (
          <Typography.Paragraph className="mt-3" color="muted" size="xs">
            ENS requires a {acquisition.purchaseAvailableAt - acquisition.committedAt}-second wait.
            Purchase available in {formatCountdown(acquisition.purchaseAvailableAt - now)}.
          </Typography.Paragraph>
        ) : null}
      </>
    )}
    <VaultTransactionError message={error} />
  </div>
);

export const VaultTransactionError = ({ message }: { message: string | undefined }) =>
  message ? (
    <Typography.Paragraph className="mt-3 text-danger" role="alert" size="xs">
      {message}
    </Typography.Paragraph>
  ) : null;

export const getVaultTransactionLabel = (label: string, progress: VaultTransactionProgress) => {
  if (progress === "confirm-wallet") return "Confirm in Wallet";
  if (progress === "confirming-transaction") return "Confirming Transaction…";
  return label;
};
import { useCallback } from "react";
