import { ethereum, Bytes, Address, BigInt } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";

import {
  AcquisitionCommitted,
  AcquisitionExpired,
  Claimed,
  Deposited,
  NameAcquired,
  VaultCancelled,
  VaultCreated,
  Withdrawn,
} from "../generated/ENSDiamonds/ENSDiamonds";

export function createAcquisitionCommittedEvent(
  vaultId: Bytes,
  ensCommitment: Bytes,
  predictedSafe: Address,
  committedAt: BigInt,
  threshold: BigInt,
): AcquisitionCommitted {
  const acquisitionCommittedEvent = changetype<AcquisitionCommitted>(newMockEvent());

  acquisitionCommittedEvent.parameters = new Array();

  acquisitionCommittedEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );
  acquisitionCommittedEvent.parameters.push(
    new ethereum.EventParam("ensCommitment", ethereum.Value.fromFixedBytes(ensCommitment)),
  );
  acquisitionCommittedEvent.parameters.push(
    new ethereum.EventParam("predictedSafe", ethereum.Value.fromAddress(predictedSafe)),
  );
  acquisitionCommittedEvent.parameters.push(
    new ethereum.EventParam("committedAt", ethereum.Value.fromUnsignedBigInt(committedAt)),
  );
  acquisitionCommittedEvent.parameters.push(
    new ethereum.EventParam("threshold", ethereum.Value.fromUnsignedBigInt(threshold)),
  );

  return acquisitionCommittedEvent;
}

export function createAcquisitionExpiredEvent(vaultId: Bytes): AcquisitionExpired {
  const acquisitionExpiredEvent = changetype<AcquisitionExpired>(newMockEvent());

  acquisitionExpiredEvent.parameters = new Array();

  acquisitionExpiredEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );

  return acquisitionExpiredEvent;
}

export function createClaimedEvent(
  vaultId: Bytes,
  member: Address,
  recipient: Address,
  amount: BigInt,
): Claimed {
  const claimedEvent = changetype<Claimed>(newMockEvent());

  claimedEvent.parameters = new Array();

  claimedEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );
  claimedEvent.parameters.push(
    new ethereum.EventParam("member", ethereum.Value.fromAddress(member)),
  );
  claimedEvent.parameters.push(
    new ethereum.EventParam("recipient", ethereum.Value.fromAddress(recipient)),
  );
  claimedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)),
  );

  return claimedEvent;
}

export function createDepositedEvent(vaultId: Bytes, member: Address, amount: BigInt): Deposited {
  const depositedEvent = changetype<Deposited>(newMockEvent());

  depositedEvent.parameters = new Array();

  depositedEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );
  depositedEvent.parameters.push(
    new ethereum.EventParam("member", ethereum.Value.fromAddress(member)),
  );
  depositedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)),
  );

  return depositedEvent;
}

export function createNameAcquiredEvent(
  vaultId: Bytes,
  labelhash: Bytes,
  safe: Address,
  protocolPrice: BigInt,
  refundableBalance: BigInt,
): NameAcquired {
  const nameAcquiredEvent = changetype<NameAcquired>(newMockEvent());

  nameAcquiredEvent.parameters = new Array();

  nameAcquiredEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );
  nameAcquiredEvent.parameters.push(
    new ethereum.EventParam("labelhash", ethereum.Value.fromFixedBytes(labelhash)),
  );
  nameAcquiredEvent.parameters.push(
    new ethereum.EventParam("safe", ethereum.Value.fromAddress(safe)),
  );
  nameAcquiredEvent.parameters.push(
    new ethereum.EventParam("protocolPrice", ethereum.Value.fromUnsignedBigInt(protocolPrice)),
  );
  nameAcquiredEvent.parameters.push(
    new ethereum.EventParam(
      "refundableBalance",
      ethereum.Value.fromUnsignedBigInt(refundableBalance),
    ),
  );

  return nameAcquiredEvent;
}

export function createVaultCancelledEvent(vaultId: Bytes): VaultCancelled {
  const vaultCancelledEvent = changetype<VaultCancelled>(newMockEvent());

  vaultCancelledEvent.parameters = new Array();

  vaultCancelledEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );

  return vaultCancelledEvent;
}

export function createVaultCreatedEvent(
  vaultId: Bytes,
  creator: Address,
  maxSpend: BigInt,
  registrationDuration: BigInt,
  owners: Array<Address>,
  targetIntent: Bytes,
  ensCommitment: Bytes,
  creatorDeposit: BigInt,
): VaultCreated {
  const vaultCreatedEvent = changetype<VaultCreated>(newMockEvent());

  vaultCreatedEvent.parameters = new Array();

  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );
  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator)),
  );
  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam("maxSpend", ethereum.Value.fromUnsignedBigInt(maxSpend)),
  );
  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "registrationDuration",
      ethereum.Value.fromUnsignedBigInt(registrationDuration),
    ),
  );
  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam("owners", ethereum.Value.fromAddressArray(owners)),
  );
  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam("targetIntent", ethereum.Value.fromFixedBytes(targetIntent)),
  );
  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam("ensCommitment", ethereum.Value.fromFixedBytes(ensCommitment)),
  );
  vaultCreatedEvent.parameters.push(
    new ethereum.EventParam("creatorDeposit", ethereum.Value.fromUnsignedBigInt(creatorDeposit)),
  );

  return vaultCreatedEvent;
}

export function createWithdrawnEvent(
  vaultId: Bytes,
  member: Address,
  recipient: Address,
  amount: BigInt,
): Withdrawn {
  const withdrawnEvent = changetype<Withdrawn>(newMockEvent());

  withdrawnEvent.parameters = new Array();

  withdrawnEvent.parameters.push(
    new ethereum.EventParam("vaultId", ethereum.Value.fromFixedBytes(vaultId)),
  );
  withdrawnEvent.parameters.push(
    new ethereum.EventParam("member", ethereum.Value.fromAddress(member)),
  );
  withdrawnEvent.parameters.push(
    new ethereum.EventParam("recipient", ethereum.Value.fromAddress(recipient)),
  );
  withdrawnEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)),
  );

  return withdrawnEvent;
}
