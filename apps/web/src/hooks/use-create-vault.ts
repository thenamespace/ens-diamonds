"use client";

import { baseRegistrarAvailableSnippet } from "@ensdomains/ensjs/contracts";
import { makeCommitmentFromCallData } from "@ensdomains/ensjs/utils";
import { useSession } from "next-auth/react";
import type { Address, Hex } from "viem";
import {
  bytesToHex,
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
  parseEventLogs,
  toBytes,
  zeroAddress,
  zeroHash,
} from "viem";
import { readContracts } from "wagmi/actions";

import { createVault as saveVault } from "@/db/actions";
import { ensDiamondsAbi } from "@/lib/abi";
import { activeChain, Contracts } from "@/lib/network";
import { SITE_URL } from "@/lib/seo";

import { useVaultTransaction, type VaultTransactionProgress } from "./use-vault-transaction";

const TARGET_INTENT_PARAMETERS = parseAbiParameters(
  "bytes32 typehash, uint256 chainId, address protocol, bytes32 vaultId, address creator, bytes32 labelhash, uint32 registrationDuration, bytes32 targetSalt",
);

export type CreateVaultVariables = {
  label: string;
  owners: Address[];
  maxSpend: bigint;
  registrationDuration: number;
  initialContribution: bigint;
  isPublic: boolean;
  metadata: {
    name: string;
    description: string;
  };
};

export type CreateVaultProgress = VaultTransactionProgress;

type CreateVaultTransactionData = {
  ensSecret: Hex;
  label: string;
  owners: Address[];
  predictedSafe: Address;
  targetSalt: Hex;
  threshold: bigint;
  isPublic: boolean;
  metadata: CreateVaultVariables["metadata"];
};

export const useCreateVault = () => {
  const session = useSession();

  return useVaultTransaction<
    CreateVaultVariables,
    CreateVaultTransactionData,
    { predictedSafe: Address; threshold: bigint; transactionHash: Hex; vaultId: Hex }
  >({
    errorMessage: "Vault creation failed.",
    mutationKey: ["create-vault"],
    submit: async (variables, { account, config, publicClient, writeContractAsync }) => {
      if (!session.data?.address || getAddress(session.data.address) !== getAddress(account)) {
        throw new Error("Invalid vault creator.");
      }

      const label = variables.label;
      const owners = variables.owners.map((owner) => getAddress(owner));
      const vaultSalt = randomBytes32();
      const targetSalt = randomBytes32();
      const ensSecret = randomBytes32();
      const labelhash = keccak256(toBytes(label));
      const protocol = {
        abi: ensDiamondsAbi,
        address: Contracts.ensDiamonds.address,
        chainId: activeChain.id,
      } as const;

      const [targetIntentTypehash, prediction, isAvailable] = await readContracts(config, {
        allowFailure: false,
        contracts: [
          { ...protocol, functionName: "TARGET_INTENT_TYPEHASH" },
          {
            ...protocol,
            functionName: "predictSafe",
            args: [account, vaultSalt, owners],
          },
          {
            abi: baseRegistrarAvailableSnippet,
            address: Contracts.ensBaseRegistrar.address,
            chainId: activeChain.id,
            functionName: "available",
            args: [BigInt(labelhash)],
          },
        ],
      });
      if (!isAvailable) throw new Error("ENS name is unavailable.");

      const [predictedVaultId, predictedSafe, threshold] = prediction;
      const vaultUri = `${SITE_URL}/vault-uri/${predictedVaultId}`;
      const targetIntent = keccak256(
        encodeAbiParameters(TARGET_INTENT_PARAMETERS, [
          targetIntentTypehash,
          BigInt(activeChain.id),
          Contracts.ensDiamonds.address,
          predictedVaultId,
          account,
          labelhash,
          variables.registrationDuration,
          targetSalt,
        ]),
      );
      const ensCommitment = makeCommitmentFromCallData({
        data: [] as Hex[],
        duration: BigInt(variables.registrationDuration),
        label,
        owner: predictedSafe,
        referrer: zeroHash,
        resolver: zeroAddress,
        reverseRecord: 0,
        secret: ensSecret,
      });
      const simulation = await publicClient.simulateContract({
        account,
        ...protocol,
        functionName: "createVault",
        args: [
          vaultSalt,
          variables.maxSpend,
          variables.registrationDuration,
          owners,
          targetIntent,
          ensCommitment,
          vaultUri,
        ],
        value: variables.initialContribution,
      });
      const transactionHash = await writeContractAsync(simulation.request);

      return {
        data: {
          ensSecret,
          isPublic: variables.isPublic,
          label,
          metadata: variables.metadata,
          owners,
          predictedSafe,
          targetSalt,
          threshold,
        },
        transactionHash,
      };
    },
    onConfirmed: async ({ account, data, receipt, transactionHash }) => {
      const event = parseEventLogs({
        abi: ensDiamondsAbi,
        eventName: "VaultCreated",
        logs: receipt.logs.filter(
          ({ address }) => address.toLowerCase() === Contracts.ensDiamonds.address.toLowerCase(),
        ),
      })[0];
      if (!event) throw new Error("Vault event was not emitted.");

      const vaultId = event.args.vaultId;
      await saveVault({
        creatorAddress: account,
        memberAddresses: data.owners,
        isPublic: data.isPublic,
        metadata: data.metadata,
        secrets: {
          ensSecret: data.ensSecret,
          label: data.label,
          targetSalt: data.targetSalt,
        },
        vaultId,
      });

      return {
        predictedSafe: data.predictedSafe,
        threshold: data.threshold,
        transactionHash,
        vaultId,
      };
    },
  });
};

const randomBytes32 = () => {
  let value: Hex;
  do value = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  while (value === zeroHash);
  return value;
};
