import { Bytes, Address, BigInt } from "@graphprotocol/graph-ts";
import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index";

import { handleAcquisitionCommitted } from "../src/ens-diamonds";
import { createAcquisitionCommittedEvent } from "./ens-diamonds-utils";

describe("AcquisitionCommitted", () => {
  beforeAll(() => {
    const vaultId = Bytes.fromI32(1234567890);
    const ensCommitment = Bytes.fromI32(1234567890);
    const predictedSafe = Address.fromString("0x0000000000000000000000000000000000000001");
    const committedAt = BigInt.fromI32(234);
    const threshold = BigInt.fromI32(234);
    const event = createAcquisitionCommittedEvent(
      vaultId,
      ensCommitment,
      predictedSafe,
      committedAt,
      threshold,
    );
    handleAcquisitionCommitted(event);
  });

  afterAll(() => {
    clearStore();
  });

  test("AcquisitionCommitted created and stored", () => {
    assert.entityCount("AcquisitionCommitted", 1);

    const entityId = "0xa16081f360e3847006db660bae1c6d1b2e17ec2a01000000";
    assert.fieldEquals("AcquisitionCommitted", entityId, "vaultId", "0xd2029649");
    assert.fieldEquals("AcquisitionCommitted", entityId, "ensCommitment", "0xd2029649");
    assert.fieldEquals(
      "AcquisitionCommitted",
      entityId,
      "predictedSafe",
      "0x0000000000000000000000000000000000000001",
    );
    assert.fieldEquals("AcquisitionCommitted", entityId, "committedAt", "234");
    assert.fieldEquals("AcquisitionCommitted", entityId, "threshold", "234");
  });
});
