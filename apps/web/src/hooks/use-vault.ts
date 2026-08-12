"use client";

import { useQuery } from "@tanstack/react-query";

import type { Address, Hex } from "viem";
import {
  encodeAbiParameters,
  encodeFunctionData,
  getCreate2Address,
  keccak256,
  parseAbi,
  parseAbiParameters,
  toBytes,
  zeroAddress,
} from "viem";
import { useConfig } from "wagmi";
import { getBytecode, readContracts } from "wagmi/actions";

import { getMajorityThreshold } from "@/lib/helpers";
import { activeChain, Contracts } from "@/lib/network";

const VAULT_STATES = ["funding", "committed", "acquired", "cancelled", "failed"] as const;
const TERMINAL_STATES = new Set<VaultState>(["acquired", "cancelled", "failed"]);
const SAFE_SALT_DOMAIN = keccak256(toBytes("ENS_DIAMONDS_SAFE_V1"));
const SAFE_SALT_PARAMETERS = parseAbiParameters(
  "bytes32 domain, uint256 chainId, address protocol, bytes32 vaultId",
);
const CREATE2_SALT_PARAMETERS = parseAbiParameters("bytes32 initializerHash, uint256 saltNonce");
const SAFE_SETUP_ABI = parseAbi([
  "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address paymentReceiver)",
]);
const COMMITMENT_AGE_ABI = parseAbi([
  "function minCommitmentAge() view returns (uint256)",
  "function maxCommitmentAge() view returns (uint256)",
]);

export type VaultState = (typeof VAULT_STATES)[number];

export const useVault = (vaultId: Hex | undefined) => {
  const config = useConfig();

  return useQuery({
    enabled: vaultId !== undefined,
    queryKey: ["vault", Contracts.ensDiamonds.address, vaultId],
    queryFn: async () => {
      if (!vaultId) throw new Error("Vault ID is required.");

      const contract = {
        abi: Contracts.ensDiamonds.abi,
        address: Contracts.ensDiamonds.address,
        chainId: activeChain.id,
      } as const;
      const [
        vault,
        safeProxyFactory,
        safeFallbackHandler,
        safeProxyInitCodeHash,
        minCommitmentAge,
        maxCommitmentAge,
      ] = await readContracts(config, {
        allowFailure: false,
        contracts: [
          { ...contract, functionName: "vaults", args: [vaultId] },
          { ...contract, functionName: "SAFE_PROXY_FACTORY" },
          { ...contract, functionName: "SAFE_FALLBACK_HANDLER" },
          { ...contract, functionName: "SAFE_PROXY_INIT_CODE_HASH" },
          {
            abi: COMMITMENT_AGE_ABI,
            address: Contracts.ensEthRegistrarController.address,
            chainId: activeChain.id,
            functionName: "minCommitmentAge",
          },
          {
            abi: COMMITMENT_AGE_ABI,
            address: Contracts.ensEthRegistrarController.address,
            chainId: activeChain.id,
            functionName: "maxCommitmentAge",
          },
        ],
      });

      const [creator, escrowed, maxSpend, committedAt, registrationDuration, state, , , vaultUri] =
        vault;
      if (creator === zeroAddress) return null;

      const [owners] = await readContracts(config, {
        allowFailure: false,
        contracts: [{ ...contract, functionName: "getOwners", args: [vaultId] }],
      });
      const balances = await readContracts(config, {
        allowFailure: false,
        contracts: owners.map((owner) => ({
          ...contract,
          functionName: "balanceOf" as const,
          args: [vaultId, owner] as const,
        })),
      });
      const threshold = getMajorityThreshold(owners.length);
      const safeAddress = predictSafeAddress({
        fallbackHandler: safeFallbackHandler,
        initCodeHash: safeProxyInitCodeHash,
        owners,
        proxyFactory: safeProxyFactory,
        threshold: BigInt(threshold),
        vaultId,
      });
      const bytecode = await getBytecode(config, {
        address: safeAddress,
        chainId: activeChain.id,
      });
      const status = VAULT_STATES[state];
      if (!status) throw new Error(`Unknown vault state: ${state}.`);

      return {
        acquisition:
          committedAt === 0
            ? null
            : {
                committedAt,
                expiresAt: committedAt + Number(maxCommitmentAge),
                purchaseAvailableAt: committedAt + Number(minCommitmentAge),
              },
        escrowed,
        fundingProgress: maxSpend === 0n ? 0 : Number((escrowed * 10_000n) / maxSpend) / 100,
        id: vaultId,
        maxSpend,
        members: owners.map((address, index) => {
          const balance = balances[index] ?? 0n;
          return {
            address,
            balance,
            isCreator: address === creator,
          };
        }),
        registrationDuration,
        safe: {
          address: safeAddress,
          isDeployed: bytecode !== undefined && bytecode !== "0x",
          threshold,
        },
        status,
        vaultUri,
      };
    },
    refetchInterval: ({ state }) =>
      state.data?.status && TERMINAL_STATES.has(state.data.status) ? false : 12_000,
    staleTime: 10_000,
  });
};

type PredictSafeAddressParameters = {
  fallbackHandler: Address;
  initCodeHash: Hex;
  owners: readonly Address[];
  proxyFactory: Address;
  threshold: bigint;
  vaultId: Hex;
};

const predictSafeAddress = ({
  fallbackHandler,
  initCodeHash,
  owners,
  proxyFactory,
  threshold,
  vaultId,
}: PredictSafeAddressParameters) => {
  const saltNonce = BigInt(
    keccak256(
      encodeAbiParameters(SAFE_SALT_PARAMETERS, [
        SAFE_SALT_DOMAIN,
        BigInt(activeChain.id),
        Contracts.ensDiamonds.address,
        vaultId,
      ]),
    ),
  );
  const initializer = encodeFunctionData({
    abi: SAFE_SETUP_ABI,
    functionName: "setup",
    args: [
      [...owners],
      threshold,
      zeroAddress,
      "0x",
      fallbackHandler,
      zeroAddress,
      0n,
      zeroAddress,
    ],
  });
  const salt = keccak256(
    encodeAbiParameters(CREATE2_SALT_PARAMETERS, [keccak256(initializer), saltNonce]),
  );

  return getCreate2Address({ bytecodeHash: initCodeHash, from: proxyFactory, salt });
};
