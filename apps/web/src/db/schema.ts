import {
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
import { v7 as uuidv7 } from "uuid";
import type { Address, Hex } from "viem";

import type { AppNetwork } from "@/lib/network";

export const vaultsTable = pgTable(
  "vaults",
  {
    id: uuid("id").$defaultFn(uuidv7).primaryKey(),
    network: varchar("network", { length: 7 }).$type<AppNetwork>().notNull(),
    vaultId: varchar("vault_id", { length: 66 }).$type<Hex>().notNull(),
    creatorAddress: varchar("creator_address", { length: 42 }).$type<Address>().notNull(),
    encryptedData: text("encrypted_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("vaults_network_vault_uidx").on(table.network, table.vaultId)],
);

export const vaultMembersTable = pgTable(
  "vault_members",
  {
    vaultRecordId: uuid("vault_record_id")
      .notNull()
      .references(() => vaultsTable.id, { onDelete: "cascade" }),
    memberAddress: varchar("member_address", { length: 42 }).$type<Address>().notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      name: "vault_members_pk",
      columns: [table.vaultRecordId, table.memberAddress],
    }),
    index("vault_members_member_address_idx").on(table.memberAddress),
  ],
);

export type Vault = typeof vaultsTable.$inferSelect;
export type VaultMember = typeof vaultMembersTable.$inferSelect;
