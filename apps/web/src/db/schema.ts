import { defineRelations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { Address, Hex } from "viem";

export const vaultsTable = pgTable(
  "vaults",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: bigint("chain_id", { mode: "number" }).notNull(),
    protocolAddress: varchar("protocol_address", { length: 42 }).$type<Address>().notNull(),
    vaultId: varchar("vault_id", { length: 66 }).$type<Hex>().notNull(),
    creatorAddress: varchar("creator_address", { length: 42 }).$type<Address>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("vaults_chain_protocol_vault_uidx").on(
      table.chainId,
      table.protocolAddress,
      table.vaultId,
    ),
    check("vaults_chain_id_positive", sql`${table.chainId} > 0`),
    check("vaults_chain_id_safe_integer", sql`${table.chainId} <= 9007199254740991`),
    check("vaults_protocol_address_format", sql`${table.protocolAddress} ~ '^0x[0-9a-f]{40}$'`),
    check("vaults_vault_id_format", sql`${table.vaultId} ~ '^0x[0-9a-f]{64}$'`),
    check("vaults_creator_address_format", sql`${table.creatorAddress} ~ '^0x[0-9a-f]{40}$'`),
  ],
);

export const vaultMembersTable = pgTable(
  "vault_members",
  {
    vaultRecordId: uuid("vault_record_id")
      .notNull()
      .references(() => vaultsTable.id, { onDelete: "cascade" }),
    memberAddress: varchar("member_address", { length: 42 }).$type<Address>().notNull(),
  },
  (table) => [
    primaryKey({
      name: "vault_members_pk",
      columns: [table.vaultRecordId, table.memberAddress],
    }),
    index("vault_members_member_address_idx").on(table.memberAddress),
    check("vault_members_member_address_format", sql`${table.memberAddress} ~ '^0x[0-9a-f]{40}$'`),
  ],
);

export const vaultSecretsTable = pgTable(
  "vault_secrets",
  {
    vaultRecordId: uuid("vault_record_id")
      .primaryKey()
      .references(() => vaultsTable.id, { onDelete: "cascade" }),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authenticationTag: text("authentication_tag").notNull(),
    keyVersion: integer("key_version").default(1).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("vault_secrets_ciphertext_not_empty", sql`length(${table.ciphertext}) > 0`),
    check("vault_secrets_iv_not_empty", sql`length(${table.iv}) > 0`),
    check(
      "vault_secrets_authentication_tag_not_empty",
      sql`length(${table.authenticationTag}) > 0`,
    ),
    check("vault_secrets_key_version_positive", sql`${table.keyVersion} > 0`),
  ],
);

export const relations = defineRelations(
  { vaultsTable, vaultMembersTable, vaultSecretsTable },
  (relation) => ({
    vaultsTable: {
      members: relation.many.vaultMembersTable(),
      secrets: relation.one.vaultSecretsTable({
        from: relation.vaultsTable.id,
        to: relation.vaultSecretsTable.vaultRecordId,
      }),
    },
    vaultMembersTable: {
      vault: relation.one.vaultsTable({
        from: relation.vaultMembersTable.vaultRecordId,
        to: relation.vaultsTable.id,
        optional: false,
      }),
    },
    vaultSecretsTable: {
      vault: relation.one.vaultsTable({
        from: relation.vaultSecretsTable.vaultRecordId,
        to: relation.vaultsTable.id,
        optional: false,
      }),
    },
  }),
);

export type Vault = typeof vaultsTable.$inferSelect;
export type NewVault = typeof vaultsTable.$inferInsert;
export type VaultMember = typeof vaultMembersTable.$inferSelect;
export type NewVaultMember = typeof vaultMembersTable.$inferInsert;
export type VaultSecrets = typeof vaultSecretsTable.$inferSelect;
export type NewVaultSecrets = typeof vaultSecretsTable.$inferInsert;
