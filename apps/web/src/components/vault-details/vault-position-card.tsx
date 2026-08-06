"use client";

import { useCallback, useState } from "react";

import { Button, Card, Typography } from "@thenamespace/uikit";
import { useInterval } from "usehooks-ts";
import type { Hex } from "viem";

import { CardHeading, EthValue } from "@/components/common";
import {
  useBeginAcquisition,
  useCancelVault,
  useClaim,
  useDeposit,
  usePurchaseName,
  useWithdraw,
  type PurchaseNameVariables,
  type VaultState,
} from "@/hooks";
import { getUnixTime, parsePositiveEth } from "@/lib/helpers";

import {
  getVaultTransactionLabel,
  VaultCommittedActions,
  VaultFundingActions,
  VaultTransactionError,
} from "./vault-position-actions";

export type VaultPositionCardProps = {
  acquisition: {
    committedAt: number;
    expiresAt: number;
    purchaseAvailableAt: number;
  } | null;
  balance: bigint;
  currentPrice: bigint | undefined;
  escrowed: bigint;
  isCreator: boolean;
  isNameAvailable: boolean | undefined;
  maxSpend: bigint;
  purchaseSecrets: PurchaseNameVariables | undefined;
  status: VaultState;
  vaultId: Hex;
};

export const VaultPositionCard = ({
  acquisition,
  balance,
  currentPrice,
  escrowed,
  isCreator,
  isNameAvailable,
  maxSpend,
  purchaseSecrets,
  status,
  vaultId,
}: VaultPositionCardProps) => {
  const [amount, setAmount] = useState("");
  const [now, setNow] = useState(getUnixTime);
  const beginAcquisition = useBeginAcquisition(vaultId);
  const cancelVault = useCancelVault(vaultId);
  const claim = useClaim(vaultId);
  const deposit = useDeposit(vaultId);
  const purchaseName = usePurchaseName(vaultId);
  const withdraw = useWithdraw(vaultId);
  const parsedAmount = parsePositiveEth(amount);
  const updateNow = useCallback(() => setNow(getUnixTime()), []);
  useInterval(updateNow, status === "committed" ? 1_000 : null);

  const isWaitingForCommitment =
    status === "committed" && acquisition !== null && now < acquisition.purchaseAvailableAt;
  const isAcquisitionExpired =
    status === "committed" && acquisition !== null && now >= acquisition.expiresAt;
  const isPurchaseWindow =
    status === "committed" &&
    acquisition !== null &&
    !isWaitingForCommitment &&
    !isAcquisitionExpired;
  const depositCapacity = maxSpend - escrowed;
  const inputMaximum = depositCapacity > balance ? depositCapacity : balance;
  const transactionPending =
    beginAcquisition.isPending ||
    cancelVault.isPending ||
    claim.isPending ||
    deposit.isPending ||
    purchaseName.isPending ||
    withdraw.isPending;
  const canDeposit =
    status === "funding" &&
    isNameAvailable === true &&
    parsedAmount !== null &&
    parsedAmount <= depositCapacity &&
    !transactionPending;
  const canWithdraw =
    status === "funding" && parsedAmount !== null && parsedAmount <= balance && !transactionPending;
  const canBegin =
    status === "funding" &&
    isCreator &&
    isNameAvailable === true &&
    currentPrice !== undefined &&
    escrowed >= currentPrice &&
    !transactionPending;
  const canPurchase =
    isPurchaseWindow &&
    purchaseSecrets !== undefined &&
    isNameAvailable === true &&
    currentPrice !== undefined &&
    escrowed >= currentPrice &&
    !transactionPending;
  const isTerminal = status === "acquired" || status === "cancelled" || status === "failed";
  const canClaim = balance > 0n && (isTerminal || isAcquisitionExpired) && !transactionPending;
  const fundingError =
    beginAcquisition.error?.message ??
    cancelVault.error?.message ??
    deposit.error?.message ??
    withdraw.error?.message;
  const committedError = isAcquisitionExpired ? claim.error?.message : purchaseName.error?.message;

  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(value);
      deposit.reset();
      withdraw.reset();
    },
    [deposit, withdraw],
  );
  const handleDeposit = useCallback(async () => {
    if (!canDeposit || parsedAmount === null) return;
    try {
      await deposit.mutateAsync(parsedAmount);
      setAmount("");
    } catch {
      // The mutation error is rendered below the controls.
    }
  }, [canDeposit, deposit, parsedAmount]);
  const handleWithdraw = useCallback(async () => {
    if (!canWithdraw || parsedAmount === null) return;
    try {
      await withdraw.mutateAsync({ amount: parsedAmount });
      setAmount("");
    } catch {
      // The mutation error is rendered below the controls.
    }
  }, [canWithdraw, parsedAmount, withdraw]);
  const handleCancel = useCallback(async () => {
    if (!isCreator || status !== "funding" || transactionPending) return;
    try {
      await cancelVault.mutateAsync();
    } catch {
      // The mutation error is rendered below the controls.
    }
  }, [cancelVault, isCreator, status, transactionPending]);
  const handleBeginAcquisition = useCallback(async () => {
    if (!canBegin) return;
    try {
      await beginAcquisition.mutateAsync();
    } catch {
      // The mutation error is rendered below the controls.
    }
  }, [beginAcquisition, canBegin]);
  const handlePurchase = useCallback(async () => {
    if (!canPurchase || !purchaseSecrets) return;
    try {
      await purchaseName.mutateAsync(purchaseSecrets);
    } catch {
      // The mutation error is rendered below the controls.
    }
  }, [canPurchase, purchaseName, purchaseSecrets]);
  const handleClaim = useCallback(async () => {
    if (!canClaim) return;
    try {
      await claim.mutateAsync();
    } catch {
      // The mutation error is rendered below the controls.
    }
  }, [canClaim, claim]);

  return (
    <Card variant="default">
      <Card.Header className="gap-1">
        <CardHeading>Your position</CardHeading>
        <Typography.Paragraph color="muted" size="sm">
          {getPositionDescription(status)}
        </Typography.Paragraph>
      </Card.Header>
      <Card.Content>
        <div className="flex items-center justify-between gap-4">
          <Typography.Paragraph color="muted" size="sm">
            {getBalanceLabel(status)}
          </Typography.Paragraph>
          <EthValue className="text-sm font-semibold" value={balance} />
        </div>

        {status === "funding" ? (
          <VaultFundingActions
            amount={amount}
            canBegin={canBegin}
            canDeposit={canDeposit}
            canWithdraw={canWithdraw}
            error={fundingError}
            inputMaximum={inputMaximum}
            isCreator={isCreator}
            transactionPending={transactionPending}
            beginAcquisition={beginAcquisition}
            cancelVault={cancelVault}
            deposit={deposit}
            withdraw={withdraw}
            onAmountChange={handleAmountChange}
            onBegin={handleBeginAcquisition}
            onCancel={handleCancel}
            onDeposit={handleDeposit}
            onWithdraw={handleWithdraw}
          />
        ) : null}

        {status === "committed" ? (
          <VaultCommittedActions
            acquisition={acquisition}
            canClaim={canClaim}
            canPurchase={canPurchase}
            error={committedError}
            isExpired={isAcquisitionExpired}
            isWaiting={isWaitingForCommitment}
            now={now}
            purchaseSecrets={purchaseSecrets}
            claim={claim}
            purchaseName={purchaseName}
            onClaim={handleClaim}
            onPurchase={handlePurchase}
          />
        ) : null}

        {isTerminal ? (
          <div aria-live="polite">
            <Button
              className="mt-4"
              fullWidth
              isDisabled={!canClaim}
              isPending={claim.isPending}
              onPress={handleClaim}
            >
              {getVaultTransactionLabel("Claim ETH", claim.progress)}
            </Button>
            <VaultTransactionError message={claim.error?.message} />
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
};

const getBalanceLabel = (status: VaultState) => {
  if (status === "funding") return "Deposited";
  if (status === "committed") return "Locked balance";
  return "Claimable";
};

const getPositionDescription = (status: VaultState) => {
  if (status === "funding") return "Deposit or withdraw while funding remains open.";
  if (status === "committed") return "Deposits and withdrawals are locked during acquisition.";
  if (status === "acquired") return "Claim your share of the unused ETH after purchase.";
  return "Claim your remaining deposited ETH from this closed vault.";
};
