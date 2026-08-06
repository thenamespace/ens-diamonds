"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Address, Hex, TransactionReceipt } from "viem";
import type { Config } from "wagmi";
import { useAccount, useConfig, usePublicClient, useWriteContract } from "wagmi";

import { activeChain } from "@/lib/network";

export type VaultTransactionProgress = "confirm-wallet" | "confirming-transaction" | null;

type VaultTransactionContext = {
  account: Address;
  config: Config;
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
};

type SubmittedTransaction<TData> = {
  data: TData;
  transactionHash: Hex;
};

type ConfirmedTransaction<TVariables, TData> = VaultTransactionContext & {
  data: TData;
  receipt: TransactionReceipt;
  transactionHash: Hex;
  variables: TVariables;
};

type UseVaultTransactionOptions<TVariables, TData, TResult> = {
  errorMessage: string;
  invalidateQueryKey?: readonly unknown[];
  mutationKey: readonly unknown[];
  onConfirmed: (transaction: ConfirmedTransaction<TVariables, TData>) => Promise<TResult> | TResult;
  submit: (
    variables: TVariables,
    context: VaultTransactionContext,
  ) => Promise<SubmittedTransaction<TData>>;
};

export const useVaultTransaction = <TVariables, TData, TResult>({
  errorMessage,
  invalidateQueryKey,
  mutationKey,
  onConfirmed,
  submit,
}: UseVaultTransactionOptions<TVariables, TData, TResult>) => {
  const [progress, setProgress] = useState<VaultTransactionProgress>(null);
  const account = useAccount();
  const config = useConfig();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  const mutation = useMutation({
    mutationKey,
    retry: false,
    onMutate: () => setProgress("confirm-wallet"),
    mutationFn: async (variables: TVariables) => {
      try {
        if (!account.address || account.chainId !== activeChain.id || !publicClient) {
          throw new Error("Invalid transaction context.");
        }

        const context = {
          account: account.address,
          config,
          publicClient,
          writeContractAsync,
        };
        const submitted = await submit(variables, context);

        setProgress("confirming-transaction");
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: submitted.transactionHash,
        });
        if (receipt.status !== "success") throw new Error("Transaction failed.");

        const result = await onConfirmed({
          ...context,
          data: submitted.data,
          receipt,
          transactionHash: submitted.transactionHash,
          variables,
        });

        if (invalidateQueryKey) {
          await queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
        }

        return result;
      } catch (error) {
        // eslint-disable-next-line no-console -- Surface wallet and contract diagnostics during the POC.
        console.error(`[vault transaction] ${mutationKey.join(":")}`, error);
        throw new Error(errorMessage, { cause: error });
      }
    },
    onSettled: () => setProgress(null),
  });

  return { ...mutation, progress };
};
