import { Bytes } from "@graphprotocol/graph-ts";

import {
  AcquisitionCommitted as AcquisitionCommittedEvent,
  AcquisitionExpired as AcquisitionExpiredEvent,
  Claimed as ClaimedEvent,
  Deposited as DepositedEvent,
  NameAcquired as NameAcquiredEvent,
  VaultCancelled as VaultCancelledEvent,
  VaultCreated as VaultCreatedEvent,
  Withdrawn as WithdrawnEvent,
} from "../generated/ENSDiamonds/ENSDiamonds";
import {
  AcquisitionCommitted,
  AcquisitionExpired,
  Claimed,
  Deposited,
  NameAcquired,
  VaultCancelled,
  VaultCreated,
  Withdrawn,
} from "../generated/schema";

export function handleAcquisitionCommitted(event: AcquisitionCommittedEvent): void {
  const entity = new AcquisitionCommitted(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;
  entity.ensCommitment = event.params.ensCommitment;
  entity.predictedSafe = event.params.predictedSafe;
  entity.committedAt = event.params.committedAt;
  entity.threshold = event.params.threshold;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleAcquisitionExpired(event: AcquisitionExpiredEvent): void {
  const entity = new AcquisitionExpired(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleClaimed(event: ClaimedEvent): void {
  const entity = new Claimed(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;
  entity.member = event.params.member;
  entity.recipient = event.params.recipient;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleDeposited(event: DepositedEvent): void {
  const entity = new Deposited(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;
  entity.member = event.params.member;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleNameAcquired(event: NameAcquiredEvent): void {
  const entity = new NameAcquired(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;
  entity.labelhash = event.params.labelhash;
  entity.safe = event.params.safe;
  entity.protocolPrice = event.params.protocolPrice;
  entity.refundableBalance = event.params.refundableBalance;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleVaultCancelled(event: VaultCancelledEvent): void {
  const entity = new VaultCancelled(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleVaultCreated(event: VaultCreatedEvent): void {
  const entity = new VaultCreated(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;
  entity.creator = event.params.creator;
  entity.maxSpend = event.params.maxSpend;
  entity.registrationDuration = event.params.registrationDuration;
  entity.owners = changetype<Bytes[]>(event.params.owners);
  entity.targetIntent = event.params.targetIntent;
  entity.ensCommitment = event.params.ensCommitment;
  entity.vaultURI = event.params.vaultURI;
  entity.creatorDeposit = event.params.creatorDeposit;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}

export function handleWithdrawn(event: WithdrawnEvent): void {
  const entity = new Withdrawn(event.transaction.hash.concatI32(event.logIndex.toI32()));
  entity.vaultId = event.params.vaultId;
  entity.member = event.params.member;
  entity.recipient = event.params.recipient;
  entity.amount = event.params.amount;

  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;

  entity.save();
}
