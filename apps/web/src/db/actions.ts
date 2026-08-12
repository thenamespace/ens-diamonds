"use server";

import Cryptr from "cryptr";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Address, Hex } from "viem";
import { getAddress } from "viem";

import { auth } from "@/auth";
import { appNetwork } from "@/lib/network";

import { db } from ".";
import { favouritesTable, vaultMembersTable, vaultsTable, vaultUrisTable } from "./schema";

const cryptr = new Cryptr(process.env.ENCRYPTION_SECRET as string);

type VaultIdentity = {
  vaultId: Hex;
};

export type CreateVaultInput = VaultIdentity & {
  creatorAddress: Address;
  memberAddresses: Address[];
  isPublic: boolean;
  metadata: {
    name: string;
    description: string;
  };
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

  const [[vault], members, [metadata]] = await db.batch([
    db
      .insert(vaultsTable)
      .values({
        creatorAddress: input.creatorAddress,
        encryptedData,
        id: vaultRecordId,
        isPublic: input.isPublic,
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
    db
      .insert(vaultUrisTable)
      .values({ vaultRecordId, ...input.metadata })
      .returning(),
  ]);

  if (!vault || !metadata) throw new Error("Vault could not be saved.");
  return { members, metadata, vault: { ...withoutEncryptedData(vault), secrets: input.secrets } };
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

  const [metadata] = await db
    .select()
    .from(vaultUrisTable)
    .where(eq(vaultUrisTable.vaultRecordId, result.vault.id))
    .limit(1);

  return { members, metadata: metadata ?? null, vault: decryptVault(result.vault, address) };
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
  const metadata = await db
    .select()
    .from(vaultUrisTable)
    .where(
      inArray(
        vaultUrisTable.vaultRecordId,
        rows.map(({ vault }) => vault.id),
      ),
    );

  return rows.map(({ vault }) => ({
    members: members.filter(({ vaultRecordId }) => vaultRecordId === vault.id),
    metadata: metadata.find(({ vaultRecordId }) => vaultRecordId === vault.id) ?? null,
    vault: decryptVault(vault, address),
  }));
}

export async function getPublicVaults() {
  const rows = await db
    .select({ vault: vaultsTable, metadata: vaultUrisTable })
    .from(vaultsTable)
    .innerJoin(vaultUrisTable, eq(vaultUrisTable.vaultRecordId, vaultsTable.id))
    .where(and(eq(vaultsTable.network, appNetwork), eq(vaultsTable.isPublic, true)))
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

  return rows.map(({ vault, metadata }) => ({
    members: members.filter(({ vaultRecordId }) => vaultRecordId === vault.id),
    metadata,
    vault: withoutEncryptedData(vault),
  }));
}

export async function getVaultUri(input: VaultIdentity) {
  const [result] = await db
    .select({ metadata: vaultUrisTable })
    .from(vaultsTable)
    .innerJoin(vaultUrisTable, eq(vaultUrisTable.vaultRecordId, vaultsTable.id))
    .where(and(eq(vaultsTable.network, appNetwork), eq(vaultsTable.vaultId, input.vaultId)))
    .limit(1);
  return result?.metadata ?? null;
}

export async function getFavouriteLabels() {
  const session = await auth();
  if (!session?.address) return [];
  return db
    .select({ label: favouritesTable.label })
    .from(favouritesTable)
    .where(
      and(
        eq(favouritesTable.network, appNetwork),
        eq(favouritesTable.address, getAddress(session.address)),
      ),
    );
}

export async function toggleFavourite(label: string) {
  const session = await auth();
  if (!session?.address) throw new Error("Sign in to save favourites.");
  const address = getAddress(session.address);
  const normalizedLabel = label.toLowerCase();
  const key = and(
    eq(favouritesTable.network, appNetwork),
    eq(favouritesTable.address, address),
    eq(favouritesTable.label, normalizedLabel),
  );
  const [existing] = await db.select().from(favouritesTable).where(key).limit(1);
  if (existing) {
    await db.delete(favouritesTable).where(key);
    return false;
  }
  await db.insert(favouritesTable).values({ address, label: normalizedLabel, network: appNetwork });
  return true;
}

export async function getTrendingLabels(limit = 100) {
  return db
    .select({ label: favouritesTable.label, favourites: count() })
    .from(favouritesTable)
    .where(eq(favouritesTable.network, appNetwork))
    .groupBy(favouritesTable.label)
    .orderBy(desc(count()), asc(favouritesTable.label))
    .limit(limit);
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
