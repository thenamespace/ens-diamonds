import { Button, InputGroup, TextField, Typography } from "@thenamespace/uikit";
import { formatEther } from "viem";

import type { PurchaseNameVariables, VaultTransactionProgress } from "@/hooks";
import { formatCountdown } from "@/lib/helpers";

export type VaultActionStatus = {
  isPending: boolean;
  progress: VaultTransactionProgress;
};

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
  onWithdraw: () => void;
}) => (
  <div aria-live="polite">
    <TextField
      aria-label="Contribution amount"
      className="mt-4"
      isDisabled={transactionPending}
      value={amount}
      variant="secondary"
      onChange={onAmountChange}
    >
      <InputGroup fullWidth>
        <InputGroup.Input
          autoComplete="off"
          inputMode="decimal"
          max={formatEther(inputMaximum)}
          min="0.000000000000000001"
          name="vault-contribution"
          placeholder="0.00"
          step="any"
          type="number"
        />
        <InputGroup.Suffix>ETH</InputGroup.Suffix>
      </InputGroup>
    </TextField>

    <div className="mt-3 grid grid-cols-2 gap-3">
      <Button fullWidth isDisabled={!canDeposit} isPending={deposit.isPending} onPress={onDeposit}>
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
