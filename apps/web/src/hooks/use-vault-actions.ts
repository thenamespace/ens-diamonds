"use client";

import type { Address, Hex } from "viem";

import { Contracts } from "@/lib/network";

import { useVaultTransaction } from "./use-vault-transaction";

export const useDeposit = (vaultId: Hex) =>
  useVaultTransaction<bigint, undefined, Hex>({
    errorMessage: "Deposit failed.",
    invalidateQueryKey: ["vault", Contracts.ensDiamonds.address, vaultId],
    mutationKey: ["deposit", vaultId],
    submit: async (amount, { account, publicClient, writeContractAsync }) => {
      if (amount <= 0n) throw new Error("Invalid deposit.");

      const simulation = await publicClient.simulateContract({
        abi: Contracts.ensDiamonds.abi,
        account,
        address: Contracts.ensDiamonds.address,
        args: [vaultId],
        functionName: "deposit",
        value: amount,
      });
      const transactionHash = await writeContractAsync(simulation.request);

      return { data: undefined, transactionHash };
    },
    onConfirmed: ({ transactionHash }) => transactionHash,
  });

type WithdrawVariables = {
  amount: bigint;
  recipient?: Address;
};

export const useWithdraw = (vaultId: Hex) =>
  useVaultTransaction<WithdrawVariables, undefined, Hex>({
    errorMessage: "Withdrawal failed.",
    invalidateQueryKey: ["vault", Contracts.ensDiamonds.address, vaultId],
    mutationKey: ["withdraw", vaultId],
    submit: async ({ amount, recipient }, { account, publicClient, writeContractAsync }) => {
      if (amount <= 0n) throw new Error("Invalid withdrawal.");

      const simulation = await publicClient.simulateContract({
        abi: Contracts.ensDiamonds.abi,
        account,
        address: Contracts.ensDiamonds.address,
        args: [vaultId, amount, recipient ?? account],
        functionName: "withdraw",
      });
      const transactionHash = await writeContractAsync(simulation.request);

      return { data: undefined, transactionHash };
    },
    onConfirmed: ({ transactionHash }) => transactionHash,
  });

export const useCancelVault = (vaultId: Hex) =>
  useVaultTransaction<void, undefined, Hex>({
    errorMessage: "Vault cancellation failed.",
    invalidateQueryKey: ["vault", Contracts.ensDiamonds.address, vaultId],
    mutationKey: ["cancel-vault", vaultId],
    submit: async (_, { account, publicClient, writeContractAsync }) => {
      const simulation = await publicClient.simulateContract({
        abi: Contracts.ensDiamonds.abi,
        account,
        address: Contracts.ensDiamonds.address,
        args: [vaultId],
        functionName: "cancel",
      });
      const transactionHash = await writeContractAsync(simulation.request);

      return { data: undefined, transactionHash };
    },
    onConfirmed: ({ transactionHash }) => transactionHash,
  });

export const useBeginAcquisition = (vaultId: Hex) =>
  useVaultTransaction<void, undefined, Hex>({
    errorMessage: "Acquisition could not be started.",
    invalidateQueryKey: ["vault", Contracts.ensDiamonds.address, vaultId],
    mutationKey: ["begin-acquisition", vaultId],
    submit: async (_, { account, publicClient, writeContractAsync }) => {
      const simulation = await publicClient.simulateContract({
        abi: Contracts.ensDiamonds.abi,
        account,
        address: Contracts.ensDiamonds.address,
        args: [vaultId],
        functionName: "beginAcquisition",
      });
      const transactionHash = await writeContractAsync(simulation.request);

      return { data: undefined, transactionHash };
    },
    onConfirmed: ({ transactionHash }) => transactionHash,
  });

export type PurchaseNameVariables = {
  ensSecret: Hex;
  label: string;
  targetSalt: Hex;
};

export const usePurchaseName = (vaultId: Hex) =>
  useVaultTransaction<PurchaseNameVariables, undefined, Hex>({
    errorMessage: "Name purchase failed.",
    invalidateQueryKey: ["vault", Contracts.ensDiamonds.address, vaultId],
    mutationKey: ["purchase-name", vaultId],
    submit: async (
      { ensSecret, label, targetSalt },
      { account, publicClient, writeContractAsync },
    ) => {
      const simulation = await publicClient.simulateContract({
        abi: Contracts.ensDiamonds.abi,
        account,
        address: Contracts.ensDiamonds.address,
        args: [vaultId, label, targetSalt, ensSecret],
        functionName: "purchase",
      });
      const transactionHash = await writeContractAsync(simulation.request);

      return { data: undefined, transactionHash };
    },
    onConfirmed: ({ transactionHash }) => transactionHash,
  });

export const useClaim = (vaultId: Hex) =>
  useVaultTransaction<void, undefined, Hex>({
    errorMessage: "Funds could not be claimed.",
    invalidateQueryKey: ["vault", Contracts.ensDiamonds.address, vaultId],
    mutationKey: ["claim", vaultId],
    submit: async (_, { account, publicClient, writeContractAsync }) => {
      const simulation = await publicClient.simulateContract({
        abi: Contracts.ensDiamonds.abi,
        account,
        address: Contracts.ensDiamonds.address,
        args: [vaultId, account],
        functionName: "claim",
      });
      const transactionHash = await writeContractAsync(simulation.request);

      return { data: undefined, transactionHash };
    },
    onConfirmed: ({ transactionHash }) => transactionHash,
  });
