"use server";

import Cryptr from "cryptr";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";

import { auth } from "@/auth";
import { appNetwork } from "@/lib/network";

import { db } from ".";
import { vaultMembersTable, vaultsTable } from "./schema";

const cryptr = new Cryptr(process.env.ENCRYPTION_SECRET as string);

type VaultIdentity = {
  vaultId: Hex;
};

export type CreateVaultInput = VaultIdentity & {
  creatorAddress: Address;
  memberAddresses: Address[];
  secrets: {
    label: string;
    ensSecret: Hex;
    targetSalt: Hex;
  };
};

export async function createVault(input: CreateVaultInput) {
  const session = await auth();
  if (!session?.address || session.address.toLowerCase() !== input.creatorAddress.toLowerCase()) {
    throw new Error("Sign in with the wallet that created this vault.");
  }

  const existingVault = await getVault(input);
  if (existingVault) return existingVault;

  const encryptedData = cryptr.encrypt(JSON.stringify(input.secrets));
  const vaultRecordId = uuidv7();

  const [[vault], members] = await db.batch([
    db
      .insert(vaultsTable)
      .values({
        creatorAddress: input.creatorAddress,
        encryptedData,
        id: vaultRecordId,
        network: appNetwork,
        vaultId: input.vaultId,
      })
      .returning(),
    db
      .insert(vaultMembersTable)
      .values(
        input.memberAddresses.map((memberAddress, position) => ({
          memberAddress,
          position,
          vaultRecordId,
        })),
      )
      .returning(),
  ]);

  if (!vault) throw new Error("Vault could not be saved.");
  return { members, vault: { ...withoutEncryptedData(vault), secrets: input.secrets } };
}

export async function getVault(input: VaultIdentity) {
  const session = await auth();
  if (!session?.address) return null;
  const address = getAddress(session.address);

  const [result] = await db
    .select({ vault: vaultsTable })
    .from(vaultsTable)
    .innerJoin(vaultMembersTable, eq(vaultMembersTable.vaultRecordId, vaultsTable.id))
    .where(
      and(
        eq(vaultsTable.network, appNetwork),
        eq(vaultsTable.vaultId, input.vaultId),
        eq(vaultMembersTable.memberAddress, address),
      ),
    )
    .limit(1);

  if (!result) return null;

  const members = await db
    .select()
    .from(vaultMembersTable)
    .where(eq(vaultMembersTable.vaultRecordId, result.vault.id))
    .orderBy(asc(vaultMembersTable.position));

  return { members, vault: decryptVault(result.vault, address) };
}

export async function getVaultsForUser() {
  const session = await auth();
  if (!session?.address) return [];
  const address = getAddress(session.address);

  const rows = await db
    .select({ vault: vaultsTable })
    .from(vaultsTable)
    .innerJoin(vaultMembersTable, eq(vaultMembersTable.vaultRecordId, vaultsTable.id))
    .where(and(eq(vaultsTable.network, appNetwork), eq(vaultMembersTable.memberAddress, address)))
    .orderBy(desc(vaultsTable.createdAt));

  if (rows.length === 0) return [];

  const members = await db
    .select()
    .from(vaultMembersTable)
    .where(
      inArray(
        vaultMembersTable.vaultRecordId,
        rows.map(({ vault }) => vault.id),
      ),
    )
    .orderBy(asc(vaultMembersTable.position));

  return rows.map(({ vault }) => ({
    members: members.filter(({ vaultRecordId }) => vaultRecordId === vault.id),
    vault: decryptVault(vault, address),
  }));
}

function withoutEncryptedData({ encryptedData: _, ...vault }: typeof vaultsTable.$inferSelect) {
  return vault;
}

function decryptVault(vault: typeof vaultsTable.$inferSelect, address: Address) {
  const secrets = JSON.parse(cryptr.decrypt(vault.encryptedData)) as CreateVaultInput["secrets"];

  return {
    ...withoutEncryptedData(vault),
    secrets:
      address === vault.creatorAddress
        ? secrets
        : {
            label: secrets.label,
          },
  };
}
